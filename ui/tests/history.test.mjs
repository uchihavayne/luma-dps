import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryCache, clearImportedHistory } from '../history.mjs';
import { normalizeEncounter, normalizeState } from '../model.mjs';

const record = id => ({ id, name: `Encounter ${id}`, total_damage: 100, elapsed_ms: 1000, players: [] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('revision zero is known empty and unchanged live frames do not fetch history', async () => {
  let reads = 0;
  const cache = createHistoryCache({ read: async () => { reads += 1; return { revision: 1, history: [record(1)] }; }, normalizeRecord: normalizeEncounter });
  await cache.observe(0); await cache.observe(0);
  assert.equal(reads, 0); assert.deepEqual(cache.history, []);
  await cache.observe(1);
  const stored = cache.history;
  await cache.observe(1); await cache.observe(1); await cache.observe(0);
  assert.equal(reads, 1); assert.equal(cache.revision, 1); assert.equal(cache.history, stored);
  assert.equal(cache.history[0].id, '1');
});

test('pending changes coalesce and an older response never replaces the newer desired revision', async () => {
  const first = deferred(), second = deferred(); const changes = []; let reads = 0;
  const cache = createHistoryCache({ read: () => (++reads === 1 ? first.promise : second.promise), onChanged: value => changes.push(value.revision) });
  const pending = cache.observe(1);
  assert.equal(cache.observe(2), pending); assert.equal(cache.observe(2), pending); assert.equal(reads, 1);
  first.resolve({ revision: 1, history: [record('old')] });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(cache.history, []); assert.deepEqual(changes, []); assert.equal(reads, 2);
  second.resolve({ revision: 2, history: [record('new')] });
  await pending;
  assert.equal(cache.history[0].id, 'new'); assert.equal(cache.revision, 2); assert.deepEqual(changes, [2]);
});

test('a response ahead of its triggering live frame is kept and older frames cannot roll it back', async () => {
  let reads = 0;
  const cache = createHistoryCache({ read: async () => { reads += 1; return { revision: 4, history: [record(4)] }; } });
  await cache.observe(2); await cache.observe(3); await cache.observe(2); await cache.observe(4);
  assert.equal(reads, 1); assert.equal(cache.revision, 4); assert.equal(cache.desiredRevision, 4); assert.equal(cache.history[0].id, 4);
});

test('history cache survives lean live updates and normalization retains the revision contract', async () => {
  const cache = createHistoryCache({ read: async () => ({ revision: 2, history: [record(2)] }) });
  await cache.observe(2);
  const live = normalizeState({ history: [], history_revision: 2, history_count: 1, encounter_active: false, dps: 100 });
  await cache.observe(live.history_revision);
  assert.deepEqual(live.history, []); assert.equal(cache.history.length, 1);
  assert.equal(live.history_count, 1); assert.equal(live.encounter_active, false);
  assert.equal(normalizeState(normalizeState(live)).history_revision, 2);
  assert.equal(normalizeState({ encounter_active: true }).encounter_active, true);
});

test('failed reads preserve confirmed records and retry only for explicit retry or newer revision', async () => {
  let reads = 0, fail = false;
  const cache = createHistoryCache({ read: async () => { reads += 1; if (fail) throw new Error('Unavailable'); return { revision: reads === 1 ? 1 : 2, history: [record(reads)] }; } });
  assert.equal(cache.failed, false);
  await cache.observe(1); fail = true; await cache.observe(2);
  assert.equal(cache.failed, true);
  const confirmed = cache.history;
  await cache.observe(2); assert.equal(reads, 2); assert.equal(cache.history, confirmed); assert.equal(cache.revision, 1);
  fail = false; await cache.retry(); assert.equal(reads, 3); assert.equal(cache.revision, 2);
  assert.equal(cache.failed, false);
});

test('an older pending request failing does not suppress a newer revision that still needs a fetch', async () => {
  const first = deferred(); let reads = 0;
  const cache = createHistoryCache({ read: () => ++reads === 1 ? first.promise : Promise.resolve({ revision: 2, history: [record(2)] }) });
  const pending = cache.observe(1); cache.observe(2); first.reject(new Error('Old request failed'));
  await pending;
  assert.equal(reads, 2); assert.equal(cache.revision, 2);
});

test('malformed or stale history responses cannot erase confirmed history', async () => {
  let result = { revision: 1, history: [record(1)] };
  const cache = createHistoryCache({ read: async () => result, normalizeRecord: normalizeEncounter });
  await cache.observe(1); const confirmed = cache.history;
  await cache.observe(2); assert.equal(cache.history, confirmed);
  result = { revision: 2, history: [{}] }; await cache.retry(); assert.equal(cache.history, confirmed);
  result = { revision: 2, history: [] }; await cache.retry(); assert.equal(cache.revision, 2); assert.deepEqual(cache.history, []);
});

test('all 31 and 200 native records remain available to filters and sharing candidates', async () => {
  for (const count of [31, 200]) {
    const records = Array.from({ length: count }, (_, index) => ({ ...record(count - index), source: index < 30 ? 'imported' : 'captured' }));
    const cache = createHistoryCache({ read: async () => ({ revision: 1, history: records }), normalizeRecord: normalizeEncounter });
    await cache.observe(1);
    assert.equal(cache.history.length, count);
    assert.equal(cache.history.at(-1).id, '1');
    assert.equal(cache.history.filter(row => row.provenance !== 'imported-unverified').length, count - 30);
  }
});

test('native cache stays bounded at 200 without normalizing or traversing a larger response tail', async () => {
  let normalized = 0;
  const input = Array.from({ length: 400 }, (_, index) => record(index + 1));
  const cache = createHistoryCache({ read: async () => ({ revision: 1, history: input }), normalizeRecord: value => { normalized += 1; return normalizeEncounter(value); } });
  await cache.observe(1);
  assert.equal(cache.history.length, 200); assert.equal(normalized, 200);
  assert.equal(cache.history.at(-1).id, '200'); assert.equal(input.length, 400);
});

test('a successful clear to empty history advances revision and removes previously cached imported records', async () => {
  let result = { revision: 1, history: [{ ...record(1), source: 'imported' }] };
  const cache = createHistoryCache({ read: async () => result, normalizeRecord: normalizeEncounter });
  await cache.observe(1);
  assert.equal(cache.history[0].provenance, 'imported-unverified');
  result = { revision: 2, history: [] };
  await cache.observe(2);
  assert.equal(cache.revision, 2); assert.deepEqual(cache.history, []);
});

test('desktop clear waits for native acknowledgement before local removal and refresh', async () => {
  const pending = deferred(), calls = [], state = { history_revision: 2 };
  const operation = clearImportedHistory({ native: true,
    clearNative: () => { calls.push('native'); return pending.promise; },
    clearLocal: () => { calls.push('local'); },
    refresh: value => { assert.equal(value, state); calls.push('refresh'); },
  });
  assert.deepEqual(calls, ['native']);
  pending.resolve(state);
  assert.equal(await operation, state); assert.deepEqual(calls, ['native', 'local', 'refresh']);
});

test('failed desktop clear preserves local imported records and does not announce a refreshed success', async () => {
  const records = [record(1)], calls = [];
  await assert.rejects(clearImportedHistory({ native: true,
    clearNative: async () => { throw new Error('Synthetic denied write'); },
    clearLocal: () => { records.length = 0; calls.push('local'); },
    refresh: () => { calls.push('refresh'); },
  }), /Synthetic denied write/);
  assert.equal(records.length, 1); assert.deepEqual(calls, []);
  await assert.rejects(clearImportedHistory({ native: true, clearLocal: () => { records.length = 0; } }), /unavailable/);
  assert.equal(records.length, 1);
});

test('browser clear only removes local imports and never invokes an available native callback', async () => {
  const calls = [];
  assert.equal(await clearImportedHistory({ native: false, clearNative: () => { throw new Error('Must not run'); }, clearLocal: () => { calls.push('local'); }, refresh: value => { assert.equal(value, null); calls.push('refresh'); } }), null);
  assert.deepEqual(calls, ['local', 'refresh']);
});
