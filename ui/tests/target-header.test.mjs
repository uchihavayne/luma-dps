import test from 'node:test';
import assert from 'node:assert/strict';
import { targetHeaderTarget, targetVital } from '../bosses.mjs';

const larger = { id: '900', name: 'Previous boss', npc_id: 2300207, damage: 9_000_000 };
const killed = { id: '901', name: 'Watchdog Kwapo', npc_id: 2300908, damage: 1000,
  current_hp: 0, reported_max_hp: 500_000, current_hp_observed_at_ms: 1100 };
const targets = [larger, killed];
const state = { local_player_id: '1', local_identity_source: 'server', capture: { status: 'capturing' },
  recent_personal_target: { actor_id: '1', target_id: '901', target_npc_id: 2300908, hit_at_ms: 1000, source: 'server-self-hit' } };

test('a just-killed miniboss keeps its name and received zero HP rather than the previous largest target', () => {
  const before = structuredClone(targets);
  const value = targetHeaderTarget(state, null, targets, 1200);
  assert.equal(value, killed);
  assert.equal(targetVital(value, 1200).percent, 0);
  assert.equal(targetVital(value, 1200).status, 'dead');
  assert.deepEqual(targets, before, 'display choice cannot change damage totals or order');
  const next = { id: '902', name: 'New live target', damage: 5 };
  assert.equal(targetHeaderTarget(state, next, targets, 1200), next);
});

test('expired, mismatched or recycled recent targets cannot rename the encounter header', () => {
  for (const patch of [
    { actor_id: '2' }, { target_id: '999' }, { target_id: null },
    { target_npc_id: 9999999 }, { hit_at_ms: 1201 }, { hit_at_ms: 0 }, { source: 'manual' },
  ]) {
    const value = { ...state, recent_personal_target: { ...state.recent_personal_target, ...patch } };
    assert.equal(targetHeaderTarget(value, null, targets, patch.hit_at_ms === 0 ? 11000 : 1200), larger);
  }
  assert.equal(targetHeaderTarget({ ...state, capture: { status: 'disconnected' } }, null, targets, 1200), larger);
  assert.equal(targetHeaderTarget({ ...state, local_player_id: null }, null, targets, 1200), larger);
  assert.equal(targetHeaderTarget({}, null, [], 1200), null);
});
