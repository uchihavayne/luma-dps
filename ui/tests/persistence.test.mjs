import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreferenceCommitter } from '../persistence.mjs';
import { numericPreferenceEdit } from '../model.mjs';

function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('valid numeric input persists without a blur event while intermediate values never clamp or replace the typed text', async () => {
  const written = [];
  let preferences = { targetFontSize: 21, numberPrecision: 2 };
  const writer = createPreferenceCommitter(preferences, { write: value => { written.push(value); return Promise.resolve(); } });
  const input = (name, value) => { writer.invalidate(); const patch = numericPreferenceEdit(name, value); if (!patch) return null; preferences = { ...preferences, ...patch }; return writer.save(preferences); };
  assert.equal(input('targetFontSize', ''), null); assert.equal(input('targetFontSize', '1'), null);
  await input('targetFontSize', '15'); // The drawer closes immediately; no change/blur is dispatched.
  assert.equal(written.at(-1).targetFontSize, 15);
  assert.equal(input('targetFontSize', '2'), null); assert.equal(preferences.targetFontSize, 15);
  await input('targetFontSize', '20'); assert.equal(written.at(-1).targetFontSize, 20);
  await input('numberPrecision', '0'); assert.equal(written.at(-1).numberPrecision, 0);
  assert.equal(input('numberPrecision', ''), null); assert.equal(numericPreferenceEdit('targetFontSize', '29'), null);
});

test('a stale failed write does not roll back a newer edit, and persistence waits for acknowledgement', async () => {
  const first = deferred(), confirmed = [], rejected = [], written = [];
  const writer = createPreferenceCommitter({ theme: 'aurora' }, {
    write: value => { written.push(value); return written.length === 1 ? first.promise : Promise.resolve(); },
    onConfirmed: value => confirmed.push(value), onRejected: (error, rollback) => rejected.push(rollback),
  });
  const old = writer.save({ theme: 'ember' }), latest = writer.save({ theme: 'white' });
  await Promise.resolve();
  assert.deepEqual(confirmed, []); assert.equal(written.length, 1);
  first.reject(new Error('disk failure'));
  assert.equal(await old, false); assert.equal(await latest, true);
  assert.deepEqual(rejected, [null]); assert.deepEqual(confirmed, [{ theme: 'white' }]);
});

test('the latest failed edit rolls back to the last acknowledged preferences', async () => {
  const rejected = [], confirmed = [];
  const writer = createPreferenceCommitter({ theme: 'aurora' }, {
    write: value => value.theme === 'white' ? Promise.resolve() : Promise.reject(new Error('disk failure')),
    onConfirmed: value => confirmed.push(value), onRejected: (error, rollback) => rejected.push(rollback),
  });
  await writer.save({ theme: 'white' }); await writer.save({ theme: 'rose' });
  assert.deepEqual(confirmed, [{ theme: 'white' }]); assert.deepEqual(rejected, [{ theme: 'white' }]);
});

test('an in-progress slider edit prevents an older failure from overwriting it', async () => {
  const pending = deferred(), rejected = [];
  const writer = createPreferenceCommitter({ opacity: 0.96 }, { write: () => pending.promise, onRejected: (error, rollback) => rejected.push(rollback) });
  const save = writer.save({ opacity: 0.9 }); writer.invalidate();
  pending.reject(new Error('disk failure')); await save;
  assert.deepEqual(rejected, [null]);
});

test('startup read cannot overwrite a fast edit, and its baseline is used if the queued first write fails', async () => {
  const read = deferred(), written = [], rejected = [];
  const writer = createPreferenceCommitter({ theme: 'cached' }, {
    write: preferences => { written.push(preferences); return Promise.reject(new Error('disk failure')); },
    onRejected: (error, rollback) => rejected.push(rollback),
  });
  const loading = writer.load(() => read.promise);
  const saving = writer.save({ theme: 'edited-before-load' });
  await Promise.resolve();
  assert.deepEqual(written, []);
  read.resolve({ theme: 'confirmed-native-baseline' });
  const loaded = await loading;
  assert.equal(loaded.untouched, false);
  assert.deepEqual(loaded.preferences, { theme: 'confirmed-native-baseline' });
  assert.equal(await saving, false);
  assert.deepEqual(written, [{ theme: 'edited-before-load' }]);
  assert.deepEqual(rejected, [{ theme: 'confirmed-native-baseline' }]);
});

test('rapid numeric edits persist the final state with bounded writes while the first write is busy', async () => {
  const first = deferred(), written = [], confirmed = [];
  const writer = createPreferenceCommitter({ targetFontSize: 8 }, {
    write: value => { written.push(structuredClone(value)); return written.length === 1 ? first.promise : Promise.resolve(); },
    onConfirmed: value => confirmed.push(value),
  });
  const initial = writer.save({ targetFontSize: 9 });
  await Promise.resolve();
  const saves = [];
  for (let size = 10; size <= 28; size++) saves.push(writer.save({ targetFontSize: size, theme: 'white' }));
  assert.deepEqual(written, [{ targetFontSize: 9 }]);
  first.resolve(); await initial;
  assert.ok((await Promise.all(saves)).every(Boolean));
  assert.deepEqual(written, [{ targetFontSize: 9 }, { targetFontSize: 28, theme: 'white' }]);
  assert.equal(confirmed.at(-1).targetFontSize, 28);
});

test('a failed combined edit rolls back once to the latest acknowledged snapshot', async () => {
  const first = deferred(), rejected = []; let calls = 0;
  const writer = createPreferenceCommitter({ targetFontSize: 8 }, { write: () => ++calls === 1 ? first.promise : Promise.reject(new Error('disk failure')), onRejected: (_, rollback) => rejected.push(rollback) });
  const initial = writer.save({ targetFontSize: 9 });
  const second = writer.save({ targetFontSize: 10 });
  const final = writer.save({ targetFontSize: 20 });
  first.resolve(); assert.equal(await initial, true);
  assert.equal(await second, false); assert.equal(await final, false);
  assert.deepEqual(rejected, [{ targetFontSize: 9 }]); assert.equal(calls, 2);
});

test('reads form a barrier and new edits cannot be merged ahead of the refreshed baseline', async () => {
  const first = deferred(), order = []; let writes = 0;
  const writer = createPreferenceCommitter({}, { write: value => { order.push(value.size); return ++writes === 1 ? first.promise : Promise.resolve(); } });
  const saves = [writer.save({ size: 1 }), writer.save({ size: 2 })];
  const reading = writer.load(async () => { order.push('read'); return { size: 2 }; });
  saves.push(writer.save({ size: 3 }), writer.save({ size: 4 }));
  first.resolve(); await Promise.all([...saves, reading]);
  assert.deepEqual(order, [1, 2, 'read', 4]);
});

test('an explicit capture stop waits for pending preferences and separates later edits from older merged writes', async () => {
  const first = deferred(), order = []; let writes = 0;
  const writer = createPreferenceCommitter({}, { write: async value => { order.push(value.edit); if (++writes === 1) await first.promise; } });
  const older = [writer.save({ edit: 1, cubeAutoListen: true }), writer.save({ edit: 2, cubeAutoListen: true })];
  let stopped = false;
  const stopping = writer.run(async () => { order.push('stop'); stopped = true; });
  const newer = [writer.save({ edit: 3, cubeAutoListen: false }), writer.save({ edit: 4, cubeAutoListen: false })];
  await Promise.resolve(); assert.equal(stopped, false); assert.deepEqual(order, [1]);
  first.resolve(); await Promise.all([...older, stopping, ...newer]);
  assert.deepEqual(order, [1, 2, 'stop', 4]); assert.equal(stopped, true);
});

test('a failed stop persistence cannot let a queued stale preference or rollback restart captured audio', async () => {
  const first = deferred(), order = [], written = [], rejected = [];
  let intent = null, preferences = { theme: 'original', cubeAutoListen: true }, audioRunning = true;
  const protectIntent = value => intent === null ? value : { ...value, cubeAutoListen: intent };
  const writer = createPreferenceCommitter(preferences, {
    write: async value => {
      const actual = protectIntent(value); written.push(actual); order.push(actual.theme);
      if (written.length === 1) await first.promise;
      if (actual.theme === 'newest') throw new Error('settings disk is full');
      audioRunning = actual.cubeAutoListen;
    },
    onRejected: (_, rollback) => { rejected.push(rollback); if (rollback) preferences = protectIntent(rollback); },
  });
  const older = [writer.save({ theme: 'old-in-flight', cubeAutoListen: true }), writer.save({ theme: 'old-queued', cubeAutoListen: true })];
  await Promise.resolve();
  intent = false; preferences = { ...preferences, cubeAutoListen: false };
  const stopping = writer.run(async () => { order.push('explicit-stop'); audioRunning = false; throw new Error('stop succeeded but saving failed'); });
  const expectedFailure = assert.rejects(stopping, /saving failed/);
  const newest = writer.save({ ...preferences, theme: 'newest' });
  first.resolve(); await Promise.all([...older, expectedFailure, newest]);
  assert.deepEqual(order, ['old-in-flight', 'old-queued', 'explicit-stop', 'newest']);
  assert.equal(audioRunning, false); assert.equal(preferences.cubeAutoListen, false);
  assert.ok(written.slice(1).every(value => value.cubeAutoListen === false));
  assert.equal(rejected.length, 1); assert.equal(rejected[0].cubeAutoListen, true);
});

test('a failed older write cannot roll back a newer capture action even without a later settings edit', async () => {
  const first = deferred(), rejected = [], order = [];
  const writer = createPreferenceCommitter({ cubeAutoListen: true }, { write: () => first.promise, onRejected: (_, rollback) => rejected.push(rollback) });
  const old = writer.save({ cubeAutoListen: true, theme: 'old' });
  const stop = writer.run(async () => { order.push('stop'); });
  first.reject(new Error('older save failed'));
  assert.equal(await old, false); await stop;
  assert.deepEqual(rejected, [null]); assert.deepEqual(order, ['stop']);
});
