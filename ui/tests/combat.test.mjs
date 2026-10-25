import test from 'node:test';
import assert from 'node:assert/strict';
import { frenzyLabel, healthFraction, normalizeCombat, normalizeCombatDetection, normalizeFrenzy, normalizeOwnHealth } from '../combat.mjs';
import { bossCasts } from '../assistance.mjs';
import { DEFAULTS, normalizePreferences, normalizeState } from '../model.mjs';

test('the combat-detection setting is always one the desktop shell accepts', () => {
  assert.deepEqual(normalizeCombatDetection({ source: 'game', seconds: 45 }), { source: 'game', seconds: 45 });
  assert.deepEqual(normalizeCombatDetection({ source: 'party', seconds: 1 }), { source: 'hits', seconds: 5 });
  assert.deepEqual(normalizeCombatDetection({ source: 'game', seconds: 9999 }), { source: 'game', seconds: 300 });
  assert.deepEqual(normalizeCombatDetection({ source: 'game', seconds: 12.6 }), { source: 'game', seconds: 13 });
  for (const value of [null, undefined, 'game', 7, [], { seconds: 'x' }, { seconds: NaN }]) {
    const odd = normalizeCombatDetection(value);
    assert.ok(['hits', 'game'].includes(odd.source) && odd.seconds >= 5 && odd.seconds <= 300);
  }
  const prefs = normalizePreferences({ combatDetection: { source: 'game', seconds: 30 }, alerts: { ownHealth: true } });
  assert.deepEqual(prefs.combatDetection, { source: 'game', seconds: 30 });
  assert.equal(prefs.alerts.ownHealth, true);
  assert.deepEqual(normalizePreferences({}).combatDetection, DEFAULTS.combatDetection);
  assert.equal(normalizePreferences({}).alerts.ownHealth, false);
  assert.deepEqual(normalizePreferences(normalizePreferences({ combatDetection: { source: 'game', seconds: 30 } })).combatDetection, { source: 'game', seconds: 30 });
});

test('combat, frenzy and own health survive garbage and keep what is unknown unknown', () => {
  assert.deepEqual(normalizeCombat({ source: 'game', tail_ms: 45_000, game_in_combat: true }), { source: 'game', tail_ms: 45_000, game_in_combat: true });
  assert.deepEqual(normalizeCombat(null), { source: 'hits', tail_ms: 10_000, game_in_combat: null });
  assert.equal(normalizeCombat({ game_in_combat: 'yes' }).game_in_combat, null);
  assert.equal(normalizeFrenzy({ target_id: 9, target_name: ' Boss\u0007 ', at_ms: 1_760_000_100_000 }).target_name, 'Boss');
  for (const value of [null, undefined, [], 'x', { at_ms: -1 }, { at_ms: NaN }, { at_ms: 0 }, {}]) assert.equal(normalizeFrenzy(value), null);
  assert.deepEqual(normalizeOwnHealth({ hp: 4000, max_hp: 10_000, observed_at_ms: 5 }), { hp: 4000, max_hp: 10_000, observed_at_ms: 5 });
  // A maximum below the current health cannot be right, so only the health is kept.
  assert.equal(normalizeOwnHealth({ hp: 4000, max_hp: 3000 }).max_hp, null);
  for (const value of [null, [], 'x', { hp: -1 }, { hp: NaN }, {}]) assert.equal(normalizeOwnHealth(value), null);
  const state = normalizeState({ combat: { source: 'game' }, frenzy: { at_ms: 5 }, own_health: { hp: 7 } });
  assert.equal(state.combat.source, 'game'); assert.equal(state.frenzy.at_ms, 5); assert.equal(state.own_health.hp, 7);
  assert.deepEqual([normalizeState({}).frenzy, normalizeState({}).own_health, normalizeState({}).combat.game_in_combat], [null, null, null]);
  assert.equal(normalizeState(normalizeState({ frenzy: { at_ms: 5 } })).frenzy.at_ms, 5);
});

test('the frenzy label counts down, warns in the last thirty seconds and goes away after it applies', () => {
  const at = 1_760_000_100_000, frenzy = { at_ms: at };
  assert.deepEqual(frenzyLabel(frenzy, { now: at - 65_000 }), { text: 'Öfke 1:05', clock: '1:05', urgent: false, seconds: 65 });
  assert.equal(frenzyLabel(frenzy, { now: at - 65_000, locale: 'en' }).text, 'Frenzy 1:05');
  assert.deepEqual(frenzyLabel(frenzy, { now: at - 29_100 }), { text: 'Öfke 0:30', clock: '0:30', urgent: true, seconds: 30 });
  assert.equal(frenzyLabel(frenzy, { now: at - 100 }).text, 'Öfke 0:01');
  assert.deepEqual(frenzyLabel(frenzy, { now: at + 1000 }), { text: 'Öfke!', clock: 'ŞİMDİ', urgent: true, seconds: 0 });
  assert.equal(frenzyLabel(frenzy, { now: at + 6000 }), null);
  assert.equal(frenzyLabel(frenzy, { now: at - 7_200_000 }), null);
  assert.equal(frenzyLabel(null), null);
});

test('health is a fraction only when the game reported a maximum', () => {
  assert.equal(healthFraction({ hp: 2500, max_hp: 10_000 }), 0.25);
  assert.equal(healthFraction({ hp: 2500, max_hp: null }), null);
  assert.equal(healthFraction(null), null);
});

test('a lethal cast is carried through and listed ahead of other casts aimed at you', () => {
  const state = {
    local_identity_source: 'server', local_player_id: '1',
    assist: { casts: [
      { actor_id: '9', skill_id: '10', target_id: '1', started_ms: 1, expires_ms: 5000, duration_ms: 3000, source: 'server-windup', hostile: true },
      { actor_id: '8', skill_id: '11', target_id: '1', started_ms: 1, expires_ms: 9000, duration_ms: 3000, source: 'server-windup', hostile: true, lethal: true },
      { actor_id: '7', skill_id: '12', target_id: '2', started_ms: 1, expires_ms: 2000, duration_ms: 3000, source: 'server-windup', hostile: true, lethal: true },
    ] },
  };
  const casts = bossCasts(state, 100);
  assert.deepEqual(casts.map(cast => [cast.skill_id, cast.aimed, cast.lethal]), [['11', true, true], ['10', true, false], ['12', false, true]]);
});
