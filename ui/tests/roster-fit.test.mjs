import test from 'node:test';
import assert from 'node:assert/strict';
import { mainRoster, rosterFit } from '../hud.mjs';

const players = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), name: `Player${i + 1}`, class_name: ['Ranger', 'Chanter', 'Cleric', 'Gladiator', 'Sorcerer'][i], identity_confirmed: true, damage: (5 - i) * 600_000, dps: (5 - i) * 10_000 }));

test('five named players remain visible without turning unbound periodic sources into players or changing damage', () => {
  const unbound = Array.from({ length: 32 }, (_, i) => ({ id: String(50_000 + i), name: `#${50_000 + i}`, class_name: 'Unknown', identity_confirmed: false, damage: 12_000, dps: 200 }));
  const input = [...players, ...unbound], before = structuredClone(input);
  const result = mainRoster(input);
  assert.deepEqual(result.players.map(row => row.name), players.map(row => row.name));
  assert.equal(result.unclassifiedCount, 32);
  assert.equal(result.unclassifiedDamage, 384_000);
  assert.deepEqual(input, before);
  assert.equal(result.players.reduce((sum, row) => sum + row.damage, 0) + result.unclassifiedDamage, input.reduce((sum, row) => sum + row.damage, 0));
});

test('known classes, own identity and confirmed party members survive a delayed name', () => {
  for (const evidence of [{ class_name: 'Ranger' }, { is_local: true }, { identity_confirmed: true }, { in_party: true }]) {
    assert.equal(mainRoster([{ id: '42', name: '#42', damage: 100, ...evidence }]).players.length, 1);
  }
  assert.equal(mainRoster([{ id: '42', name: '#42', damage: 100 }], { party_membership_source: 'server', party_member_ids: [42] }).players.length, 1);
});

test('party names resolve only their actors; a missing damage row is unknown and a received zero stays zero', () => {
  const state = { encounter_active: true, local_player_id: 1, party_member_ids: [1, 2], party_membership_source: 'server', party_identity_roster: { source: 'server', members: [
    { actor_id: 1, name: 'Local', class_name: 'Ranger', identity_confirmed: true },
    { actor_id: 2, name: 'Healer', class_name: 'Cleric', identity_confirmed: true },
    { actor_id: null, name: 'Joining', class_name: 'Chanter', identity_confirmed: false },
  ] } };
  const result = mainRoster([{ id: '1', name: '#1', damage: 100, dps: 10 }], state);
  assert.deepEqual(result.players.map(row => row.name), ['Local', 'Healer', 'Joining']);
  assert.equal(result.players[0].damage, 100);
  assert.equal(result.players[1].dps, null);
  assert.equal(result.players[1].damage, null);
  assert.equal(result.players[1].pending_combat, true);
  const zero = mainRoster([{ id: '2', name: 'Healer', damage: 0, dps: 0, identity_confirmed: true }], state);
  assert.equal(zero.players.find(row => row.id === '2').dps, 0);
  assert.equal(result.players[2].dps, null);
  assert.equal(result.players[2].pending_actor, true);
  assert.equal(mainRoster([], state, { scope: 'personal' }).players.length, 0);
  assert.equal(mainRoster([], state, { ranked: true }).players.length, 0);
  assert.equal(mainRoster([], { ...state, encounter_active: false }).players.length, 0);
  assert.equal(mainRoster([], { ...state, live_team_identity: { party_membership_source: 'server', party_member_ids: [9] } }).players.length, 0);
});

test('five and six rows fit the small HUD without scrolling or sub-11px text at every scale', () => {
  for (const count of [2, 4, 5, 6]) for (const scale of [.85, .9, 1, 1.25, 2]) for (const density of ['compact', 'comfortable']) {
    const fit = rosterFit({ count, height: 108, width: 306, scale, density, both: true });
    assert.equal(fit.fits, true);
    assert.ok(fit.rowHeight * count + fit.gap * (count - 1) <= 108.1);
    assert.ok(fit.font >= 11 && fit.icon >= 14);
  }
});

test('larger rosters request enough height instead of unreadable type and a narrow Cube dock prioritizes DPS', () => {
  const large = rosterFit({ count: 12, height: 108, width: 306 });
  assert.equal(large.fits, false); assert.equal(large.minimum, 216); assert.ok(large.font >= 11);
  assert.equal(rosterFit({ count: 12, height: large.minimum, width: 306 }).fits, true);
  const narrow = rosterFit({ count: 5, height: 150, width: 190, both: true });
  assert.equal(narrow.suppressDamage, true); assert.equal(narrow.damageWidth, 0); assert.ok(narrow.font >= 11);
  for (const count of [0, 13, NaN, Infinity]) assert.equal(rosterFit({ count }).enabled, false);
});
