import test from 'node:test';
import assert from 'node:assert/strict';
import { assistanceState, assistanceTimeline, ownTargetedWindups, scopedEffects } from '../assistance.mjs';
import { normalizeState } from '../model.mjs';

const state = () => ({ local_player_id: 4, local_identity_source: 'server', assist: {
  casts: [{ actor_id: 10, target_id: 4, skill_id: 50, started_ms: 1000, expires_ms: 5000, duration_ms: 4000, source: 'server-windup' }, { actor_id: 10, target_id: 7, skill_id: 51, expires_ms: 6000, source: 'server-windup' }],
  effects: [{ recipient_id: 4, caster_id: 7, instance_id: 1, effect_id: 10, expires_ms: 5000, source: 'server-effect' }, { recipient_id: 7, caster_id: 7, instance_id: 2, effect_id: 11, expires_ms: null, persistent: true, source: 'server-effect' }],
} });

test('own target windup warning requires confirmed local identity and ignores unrelated and expired targets', () => {
  assert.equal(ownTargetedWindups(state(), 3000).length, 1);
  assert.equal(ownTargetedWindups(state(), 5000).length, 0);
  assert.equal(ownTargetedWindups({ ...state(), local_identity_source: 'unresolved' }, 3000).length, 0);
});

test('effect scope excludes nearby recipients unless explicitly observed or known roster members', () => {
  assert.equal(scopedEffects(state(), 'personal', 3000).length, 1);
  assert.equal(scopedEffects(state(), 'observed', 3000).length, 2);
  assert.equal(scopedEffects(state(), 'party', 3000).length, 0);
  assert.equal(scopedEffects({ ...state(), party_member_ids: [7], party_membership_source: 'manual' }, 'party', 3000)[0].recipient_id, '7');
});

test('server-source observations are bounded and do not create static buff identities or duration guesses', () => {
  const value = assistanceState({ casts: [{ source: 'manual', expires_ms: 10000 }], effects: [{ source: 'guessed', persistent: true }] });
  assert.deepEqual(value.casts, []); assert.deepEqual(value.effects, []);
  const normalized = normalizeState(state());
  assert.equal(normalized.assist.effects[1].expires_ms, null); assert.equal(normalized.assist.effects[1].persistent, true);
  assert.equal(scopedEffects(normalized, 'observed', 9000).length, 1);
});

test('on-demand timeline shows only known received event kinds and bounds the visible recent sequence', () => {
  const events = Array.from({ length: 50 }, (_, i) => ({ kind: 'windup', at_ms: 1000 + i, actor_id: 2, target_id: 4 }));
  events.push({ kind: 'invented-boss-mechanic', at_ms: 9999 });
  const timeline = assistanceTimeline({ timeline: events });
  assert.equal(timeline.length, 30); assert.equal(timeline[0].at_ms, 1049); assert.equal(timeline[0].actor_id, '2');
});

import { bossCasts } from '../assistance.mjs';

test('boss casts list only hostile monsters, aimed-at-you first, then soonest, at most three', () => {
  const now = 1000;
  const cast = (actor, target, expires, hostile = true) => ({ actor_id: actor, skill_id: 5, target_id: target, started_ms: 0, expires_ms: expires, duration_ms: 3000, source: 'server-windup', hostile });
  const state = { local_identity_source: 'server', local_player_id: 1, assist: { casts: [cast(9, 2, 3000), cast(10, 1, 9000), cast(11, 5, 2500), cast(12, 5, 2000, false), cast(13, 5, 500), cast(14, 5, 8000), cast(15, 5, 7000)] } };
  const casts = bossCasts(state, now);
  assert.deepEqual(casts.map(item => [item.actor_id, item.aimed]), [['10', true], ['11', false], ['9', false]]);
  assert.equal(bossCasts(state, now, 5).length, 5); // the friendly one and the expired one never count
  assert.ok(bossCasts(state, now, 5).every(item => item.hostile && item.expires_ms > now));
  // Without a resolved local player nothing is aimed at you.
  assert.ok(bossCasts({ ...state, local_identity_source: 'unresolved' }, now).every(item => item.aimed === false));
  assert.deepEqual(bossCasts({}, now), []);
});

test('the boss cast setting defaults on and survives normalization', async () => {
  const { normalizePreferences } = await import('../model.mjs');
  assert.equal(normalizePreferences().alerts.bossCasts, true);
  assert.equal(normalizePreferences({ alerts: { bossCasts: false } }).alerts.bossCasts, false);
  assert.equal(normalizePreferences({ alerts: { bossCasts: 'no' } }).alerts.bossCasts, true);
});
