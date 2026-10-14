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
