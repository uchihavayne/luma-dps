import test from 'node:test';
import assert from 'node:assert/strict';
import { characterSnapshot, fieldBossSnapshot, fieldBossTimers, metadataEpoch } from '../character.mjs';
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
