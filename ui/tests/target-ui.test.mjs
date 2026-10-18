import test from 'node:test';
import assert from 'node:assert/strict';
import { displayPlayerName, displayTargetName, rosterEligible, normalizePreferences, normalizeState } from '../model.mjs';
import { bossPresentation } from '../bosses.mjs';
import { targetDemoState } from '../target-demo.mjs';
import { exportEncounterJson } from '../reports.mjs';

test('display never substitutes actor numbers for a missing player name and preserves actual received names', () => {
  assert.equal(displayPlayerName({ id: 54600, name: '#54600' }), 'İsim bekleniyor');
  assert.equal(displayPlayerName({ id: 54600, name: 'Unknown' }, 'en'), 'Name pending');
  assert.equal(displayPlayerName({ id: 7, name: '弓手', identity_confirmed: true }), '弓手');
  assert.equal(displayPlayerName({ id: 7, name: 'Unknown', identity_confirmed: true }), 'Unknown');
  assert.equal(displayTargetName({ id: 9, name: 'NPC #9', is_boss: true }), 'Boss adı bekleniyor');
  assert.equal(displayTargetName({ name: 'Ashen Warden' }), 'Ashen Warden');
});

test('anonymous zero-damage artifacts are excluded while real supporters and unnamed damage remain', () => {
  assert.equal(rosterEligible({ damage: 0, unclassified_player_target_amount: 1000 }), false);
  for (const row of [{ damage: 1 }, { damage: 0, identity_confirmed: true }, { damage: 0, is_local: true }, { damage: 0, in_party: true }]) assert.equal(rosterEligible(row), true);
});

test('the focused target survives a crowded encounter and an independent boss category filter', () => {
  const now = 1_000_000, source = targetDemoState({}, now), focused = source.targets[0];
  const state = normalizeState({ ...source, targets: [...Array.from({ length: 120 }, (_, index) => ({ id: index + 1000, name: 'Other', damage: 1 })), focused] });
  assert.equal(state.targets.length, 100); assert.equal(state.targets[0].id, '900');
  const filtered = normalizeState({ ...source, targets: [], live_target: focused });
  assert.equal(bossPresentation(filtered, { now }).target.id, '900');
  assert.equal(bossPresentation(filtered, { now }).roster.rows.length, 10);
});

test('target mode separates other-target damage, keeps the own row below ten and can be disabled', () => {
  const now = 1_000_000, state = normalizeState(targetDemoState({}, now)), view = bossPresentation(state, { now });
  assert.equal(view.roster.ownRank, 12); assert.equal(view.roster.rows.some(row => row.id === '7'), false);
  assert.equal(view.summary.totalDamage, 50_000); assert.equal(state.personal_total_damage, 250_000);
  assert.equal(normalizePreferences().autoTargetRoster, true);
  assert.equal(bossPresentation(state, { now, autoBossRoster: false }).automatic, false);
  assert.equal(normalizePreferences({ autoTargetRoster: false }).autoTargetRoster, false);
});

test('live target participant identities and focus handles cannot leak through anonymous report exports', () => {
  const target = { id: 50, name: 'Boss', damage: 100, participants_available: true, participants: [{ id: 3999012345, name: 'NestedPrivateName', damage: 100 }], own_participant: { id: 3999012345, name: 'NestedPrivateName' } };
  const record = { id: 1, started_ms: 1000, ended_ms: 2000, elapsed_ms: 1000, total_damage: 100, dps: 100,
    players: [{ id: 7, name: 'PrivateSelf', damage: 100, dps: 100, skills: [] }], targets: [target], live_target: target, focused_target_id: 3999012345, focused_target_observed_at_ms: 1999 };
  const json = exportEncounterJson([record], { anonymize: true, scope: 'observed' });
  assert.ok(!json.includes('NestedPrivateName')); assert.ok(!json.includes('3999012345')); assert.ok(!json.includes('live_target')); assert.ok(!json.includes('participants')); assert.ok(!json.includes('focused_target'));
});
