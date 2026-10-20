import test from 'node:test';
import assert from 'node:assert/strict';
import { characterSnapshot, characterCollections, renderCharacterCollections, fieldBossSnapshot, fieldBossTimers, metadataEpoch, characterSnapshotReader } from '../character.mjs';
import { normalizePreferences, normalizeState, normalizeEncounter } from '../model.mjs';

test('unbound gear stays unbound and unavailable equipment attributes stay unknown', () => {
  const value = characterSnapshot({ unbound_own: { actor_id: null, equipment: [{ item_id: 4433 }], skills: [{ skill_id: 7, level: 4, base_level: 3 }] } });
  assert.equal(value.own, null); assert.equal(value.unbound_own.actor_id, null);
  assert.equal(value.unbound_own.equipment[0].slot, null); assert.equal(value.unbound_own.equipment[0].enchant, null);
  assert.equal(value.unbound_own.equipment[0].stones, null); assert.equal(value.unbound_own.equipment_complete, false);
  assert.equal(value.unbound_own.skills[0].level, 4);
});

test('received gear, stones, skill bonuses and Daevanion preserve actual server IDs', () => {
  const build = characterSnapshot({ own: { actor_id: 8, name: 'Ranger', equipment_complete: true, equipment: [{ item_id: 200, slot: 3, enchant: 0, stones: [{ stat_id: 7, tier: 2 }], stats: [{ stat_id: 10, value: 55 }], skill_bonuses: [{ skill_id: 900, levels: 2 }] }], boards: [{ board_id: 4, node_ids: [1, 2] }] } }).own;
  assert.equal(build.actor_id, '8'); assert.equal(build.equipment[0].enchant, 0); assert.equal(build.equipment[0].stones[0].stat_id, '7');
  assert.deepEqual(build.boards[0].node_ids, ['1', '2']); assert.equal(build.equipment_complete, true);
});

test('inspected characters have no inferred local binding and malformed snapshots remain empty', () => {
  const value = characterSnapshot({ inspected: [{ name: 'Other', class_code: 4, level: 45, gear_score: 1234 }] });
  assert.equal(value.own, null); assert.equal(value.inspected[0].actor_id, null); assert.equal(value.inspected[0].gear_score, 1234);
  assert.deepEqual(characterSnapshot(null).inspected, []);
});

test('only a dead boss with an actual future server deadline has a countdown; expiry never invents a spawn', () => {
  const data = { maps: [{ map_id: 1, slots: [{ slot_id: 2, alive: false, server_time_ms: 10000, source: 'server-map' }, { slot_id: 3, alive: true, server_time_ms: 9000, source: 'server-map' }, { slot_id: 4, alive: false, server_time_ms: null, source: 'server-map' }] }] };
  const timers = fieldBossTimers(data, 8000);
  assert.equal(timers[0].remaining, 2000); assert.equal(timers[0].status, 'countdown');
  assert.equal(timers[1].status, 'alive'); assert.equal(timers[1].remaining, null);
  assert.equal(timers[2].status, 'unknown'); assert.equal(fieldBossTimers(data, 11000)[0].status, 'awaiting');
});

test('observed boss header choice survives preferences while guessed sources and malformed choices do not', () => {
  assert.equal(normalizePreferences({ activeEventId: 'boss:123:4' }).activeEventId, 'boss:123:4');
  assert.equal(normalizePreferences({ activeEventId: 'boss:javascript:4' }).activeEventId, 'builtin:rift');
  assert.equal(fieldBossSnapshot({ maps: [{ slots: [{ source: 'estimated', alive: true }] }] }).maps[0].slots.length, 0);
});

test('lean metadata revisions and actor identity distinguish stale build/map responses without copying rich snapshots', () => {
  const a = normalizeState({ local_player_id: 7, character_revision: 3, character_available: true, field_boss_revision: 5, field_boss_available: true });
  const b = normalizeState({ ...a, local_player_id: 8 });
  assert.notEqual(metadataEpoch(a, 'character'), metadataEpoch(b, 'character'));
  assert.notEqual(metadataEpoch(a, 'world'), metadataEpoch({ ...a, field_boss_available: false }, 'world'));
  assert.equal(normalizeState(a).character_revision, 3); assert.equal('character_build' in a, false);
  const record = normalizeEncounter({ total_damage: 5, character_build: { actor_id: 7, equipment: [{ item_id: 9, enchant: null }] } });
  assert.equal(record.character_build.actor_id, '7'); assert.equal(record.character_build.equipment[0].enchant, null);
});

const extras = () => ({
  actor_id: 7, name: 'Own', source: 'server-self',
  combat_power: { current: 356559, highest: 400000, observed_at_ms: 1000, source: 'server-self', token: 'private' },
  wing: { wing_id: 30500200, skin_id: 30400400, observed_at_ms: 1100, source: 'server-self' },
  species: Array.from({ length: 5 }, (_, index) => ({ species_id: index + 2, level: 12, progress: 0, effects: [{ page: 1, slot: 0, kind: 3, stat_id: 42, value: -123 }] })),
  species_observed_at_ms: 1200,
});

test('received power, equipped wing and all five genus groups survive immutable build normalization', () => {
  const input = extras(), before = structuredClone(input);
  const result = characterSnapshot({ own: input }).own;
  assert.equal(result.combat_power.current, 356559);
  assert.equal(result.wing.skin_id, 30400400);
  assert.equal(result.species[0].progress, 0);
  assert.equal(result.species[4].effects[0].value, -123);
  assert.equal(result.species_observed_at_ms, 1200);
  assert.equal(result.source, 'server-self');
  assert.equal('token' in result.combat_power, false);
  result.species[0].effects[0].value = 1;
  assert.deepEqual(input, before);
  assert.equal(normalizeEncounter({ total_damage: 0, character_build: input }).character_build.wing.wing_id, 30500200);
});

test('invalid new collection fields become unavailable; strict report mode rejects them', () => {
  for (const mutate of [
    data => data.combat_power.current = -1,
    data => data.combat_power.observed_at_ms = Infinity,
    data => data.combat_power.source = 'estimated',
    data => data.wing.wing_id = 30400400,
    data => data.wing.skin_id = 30500200,
    data => data.species.pop(),
    data => data.species[0].effects[0].value = Number.MAX_SAFE_INTEGER,
    data => data.species[0].effects.push(data.species[0].effects[0]),
  ]) {
    const data = extras(); mutate(data);
    assert.throws(() => characterCollections(data, { strict: true }), /Invalid build/);
    assert.doesNotThrow(() => characterCollections(data));
  }
  assert.deepEqual(characterCollections(null), { combat_power: null, wing: null, species: [], species_observed_at_ms: null });
});

test('collection cards distinguish bound, pending and imported observations without invented unlock percentages', () => {
  const input = extras();
  const rendered = renderCharacterCollections(input, { locale: 'en' });
  assert.match(rendered, /356,559/); assert.match(rendered, /Equipped wing/);
  assert.match(rendered, /Genus #6/); assert.match(rendered, /threshold is unknown/);
  assert.doesNotMatch(rendered, /100%|GPS|private/);
  assert.match(renderCharacterCollections({ ...input, actor_id: null }, { locale: 'en' }), /Waiting for self identity/);
  assert.match(renderCharacterCollections({ ...input, source: 'imported' }, { locale: 'en' }), /Imported · unverified/);
  assert.equal(renderCharacterCollections({}), '');
});


test('concurrent character reads wait for one current snapshot through an identity change', async () => {
  let currentEpoch = 'old', calls = 0, settled = 0;
  const waiting = [], accepted = [];
  const read = characterSnapshotReader({ epoch: () => currentEpoch,
    read: () => { calls++; return new Promise(resolve => waiting.push(resolve)); },
    accept: value => accepted.push(value), settled: () => settled++ });
  const first = read(), exported = read();
  assert.equal(first, exported); assert.equal(calls, 1);
  currentEpoch = 'new'; waiting.shift()({ owner: 'old' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2); assert.deepEqual(accepted, []); assert.equal(settled, 0);
  assert.equal(read(), first);
  waiting.shift()({ owner: 'new', progress: 12 });
  await exported;
  assert.deepEqual(accepted, [{ owner: 'new', progress: 12 }]); assert.equal(settled, 1);
});

test('a failed character read settles all callers and permits an automatic retry', async () => {
  let fail = true, errors = 0, accepted = 0;
  const read = characterSnapshotReader({ epoch: () => 1,
    read: async () => { if (fail) throw new Error('temporary'); return { progress: 12 }; },
    accept: () => accepted++, failed: () => errors++ });
  await Promise.all([read(), read()]); assert.equal(errors, 1); assert.equal(accepted, 0);
  fail = false; await read(); assert.equal(accepted, 1);
});

test('continuous same-character metadata changes cannot starve accepted pet snapshots or keep readers pending forever', async () => {
  let revision = 0, calls = 0, settled = 0;
  const accepted = [];
  const read = characterSnapshotReader({ epoch: () => 'same-owner-generation', revision: () => revision,
    read: async () => { calls++; revision++; return { progress: calls }; },
    accept: snapshot => accepted.push(snapshot.progress), settled: () => settled++ });
  await read();
  assert.deepEqual(accepted, [1, 2, 3]); assert.equal(calls, 3); assert.equal(settled, 1);
  await read();
  assert.deepEqual(accepted, [1, 2, 3, 4, 5, 6]); assert.equal(settled, 2);
});
