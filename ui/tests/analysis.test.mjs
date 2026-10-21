import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingState, validateTrainingDuration, damageCurve, curvePath, historyProgress, takenCoverage } from '../analysis.mjs';
import { normalizeEncounter, normalizeState } from '../model.mjs';

const record = () => ({ started_ms: 100000, elapsed_ms: 10000, sample_complete: true, local_player_id: 1, local_identity_source: 'manual', damage_samples: [
  { timestamp_ms: 100000, source: 1, player_id: 1, amount: 100 },
  { timestamp_ms: 102000, source: 3, player_id: 1, amount: 200 },
  { timestamp_ms: 104000, source: 2, player_id: 2, amount: 800 },
  { timestamp_ms: 107000, source: 1, player_id: 1, amount: 300 },
] });

test('training state preserves exact native time and incomplete capture without inventing live training', () => {
  const state = normalizeState({ training: { status: 'running', duration_ms: 60000, remaining_ms: 20000, total_damage: 4500, dps: 112.5, local_player_id: 8, capture_incomplete: true } });
  assert.equal(state.training.remaining_ms, 20000); assert.equal(state.training.capture_incomplete, true);
  assert.equal(trainingState().status, 'idle'); assert.equal(trainingState({ status: 'pretend', remaining_ms: -3 }).remaining_ms, 0);
});

test('custom training durations accept whole seconds from 10 through 300 and preserve all existing presets', () => {
  for (const seconds of [10, 11, 30, 45, 59, 60, 90, 120, 180, 299, 300]) {
    assert.equal(validateTrainingDuration(seconds), seconds * 1000);
    assert.equal(validateTrainingDuration(String(seconds)), seconds * 1000);
  }
  assert.equal(validateTrainingDuration(' 45 '), 45000);
});

test('custom training duration validation refuses partial, exponential, fractional, nonnumeric and out-of-range drafts', () => {
  for (const value of ['', ' ', '1', '9', '301', '1000', '-10', '10.5', '10.0', '1e2', '0x64', '+60', '60 seconds', 0, 9, 301, 10.5, NaN, Infinity, null, undefined, true, {}, []]) assert.equal(validateTrainingDuration(value), null, String(value));
  assert.equal(validateTrainingDuration(60_000), null);
});

test('personal curve includes credited summon damage but excludes strangers, with measured zero buckets', () => {
  const curve = damageCurve(record());
  assert.equal(curve.complete, true); assert.equal(curve.totalDamage, 600); assert.equal(curve.points.length, 10);
  assert.equal(curve.points[0].dps, 100); assert.equal(curve.points[1].dps, 0); assert.equal(curve.points[2].dps, 200);
  assert.equal(curve.points[4].dps, 0); assert.equal(curve.bestBurst, 300);
});

test('curve bucket duration changes burst measurement and counts only observed hit activity union', () => {
  const curve = damageCurve(record(), { intervalMs: 5000 });
  assert.equal(curve.points.length, 2); assert.equal(curve.points[0].dps, 60);
  assert.equal(curve.activityMs, 8000); // [0,5] and [7,10], overlapping windows count once.
  assert.equal(curve.bestBurst, 60);
});

test('party curve requires explicit membership while observed scope consciously includes all actors', () => {
  assert.equal(damageCurve(record(), { scope: 'party' }).available, false);
  const party = damageCurve({ ...record(), party_membership_source: 'manual', party_member_ids: [2] }, { scope: 'party' });
  assert.equal(party.totalDamage, 800);
  assert.equal(damageCurve(record(), { scope: 'observed' }).totalDamage, 1400);
});

test('partial sampling never yields a claimed complete burst or activity and bounded imports disclose truncation', () => {
  const curve = damageCurve({ ...record(), sample_complete: false });
  assert.equal(curve.complete, false); assert.equal(curve.bestBurst, null); assert.equal(curve.activityMs, null);
  const normalized = normalizeEncounter({ ...record(), total_damage: 1400, damage_samples: Array(20001).fill(record().damage_samples[0]) });
  assert.equal(normalized.damage_samples.length, 20000); assert.equal(normalized.sample_complete, false);
});

test('empty, malformed, unknown identity or overlong records cannot synthesize a curve', () => {
  assert.equal(damageCurve(null).available, false);
  assert.equal(damageCurve({ ...record(), local_identity_source: 'unresolved' }).available, false);
  assert.equal(damageCurve({ ...record(), elapsed_ms: 2000000 }, { scope: 'observed' }).available, false);
  const path = curvePath([{ dps: NaN }, { dps: -10 }, { dps: 30 }]);
  assert.equal(path.includes('NaN'), false); assert.equal(path.includes('Infinity'), false);
});

test('history progress excludes unresolved personal identity instead of charting nearby totals', () => {
  const records = [{ id: 1, local_player_id: 4, local_identity_source: 'server', personal_dps: 150, dps: 900 }, { id: 2, personal_dps: null, dps: 700 }];
  assert.deepEqual(historyProgress(records).map(value => value.dps), [150]);
  assert.deepEqual(historyProgress(records, { scope: 'observed' }).map(value => value.dps), [700, 900]);
});

test('personal and party history trends report the same scope clock as their DPS', () => {
  const rows = [{ id: 1, local_player_id: 4, local_identity_source: 'server', personal_dps: 150, personal_elapsed_ms: 4000, party_membership_source: 'server', party_dps: 250, party_elapsed_ms: 6000, dps: 900, elapsed_ms: 12000 }];
  assert.equal(historyProgress(rows)[0].elapsed_ms, 4000);
  assert.equal(historyProgress(rows, { scope: 'party' })[0].elapsed_ms, 6000);
  assert.equal(historyProgress(rows, { scope: 'observed' })[0].elapsed_ms, 12000);
  assert.deepEqual(historyProgress([{ ...rows[0], timing_valid: false }]), []);
});

test('personal chart begins at the first own hit and keeps late hits across a paused wall-clock span', () => {
  const curve = damageCurve({ ...record(), elapsed_ms: 6000, ended_ms: 110000, damage_samples: [{ timestamp_ms: 100000, player_id: 2, amount: 900 }, { timestamp_ms: 102000, player_id: 1, amount: 100 }, { timestamp_ms: 109000, player_id: 1, amount: 200 }] });
  assert.equal(curve.started_ms, 102000); assert.equal(curve.elapsed_ms, 8000);
  assert.equal(curve.totalDamage, 300); assert.equal(curve.points[7].damage, 200);
});

test('taken zero with missing or false coverage stays partial and unresolved player-targeted amounts remain separate', () => {
  const state = normalizeState({ personal_damage_taken: 0, personal_damage_taken_complete: false, unclassified_player_target_amount: 750, unclassified_player_target_events: 3, players: [{ id: 1, damage_taken: 0, unclassified_player_target_amount: 750 }] });
  assert.equal(takenCoverage(state, true).kind, 'partial'); assert.equal(takenCoverage(state, true).unclassifiedAmount, 750);
  assert.equal(takenCoverage(state.players[0]).kind, 'partial'); assert.equal(state.players[0].healing, null);
  assert.equal(takenCoverage({ damage_taken: 0, damage_taken_complete: true }).kind, 'complete');
  assert.equal(takenCoverage({ damage_taken: null, damage_taken_complete: true }).kind, 'unknown');
});

const timelineRecord = (overrides = {}) => ({
  started_ms: 100000, ended_ms: 106000, elapsed_ms: 6000, local_player_id: 1, local_identity_source: 'server',
  party_membership_source: 'server', party_member_ids: [1, 2], damage_samples: [],
  timeline: { interval_ms: 2000, started_ms: 100000, total: [300, 0, 450], complete: true,
    players: [{ id: '1', damage: [100, 0, 400] }, { id: '2', damage: [150, 0, 50] }, { id: '3', damage: [50, 0, 0] }] },
  ...overrides,
});

test('a record without raw samples still draws its chart from the stored timeline', () => {
  const personal = damageCurve(timelineRecord(), { scope: 'personal' });
  assert.equal(personal.available, true);
  assert.equal(personal.summary, true);
  assert.deepEqual(personal.points.map(point => point.damage), [100, 0, 400]);
  assert.deepEqual(personal.points.map(point => point.at_ms), [0, 2000, 4000]);
  assert.equal(personal.points[2].dps, 200);
  assert.equal(personal.totalDamage, 500);
  assert.equal(personal.interval_ms, 2000);
  assert.equal(personal.bestBurst, null);

  assert.deepEqual(damageCurve(timelineRecord(), { scope: 'party' }).points.map(point => point.damage), [250, 0, 450]);
  assert.deepEqual(damageCurve(timelineRecord(), { scope: 'observed' }).points.map(point => point.damage), [300, 0, 450]);
});

test('the stored timeline respects unknown identity and an empty timeline', () => {
  assert.equal(damageCurve(timelineRecord({ local_identity_source: 'unresolved' }), { scope: 'personal' }).available, false);
  assert.equal(damageCurve(timelineRecord({ party_membership_source: 'unresolved' }), { scope: 'party' }).available, false);
  assert.equal(damageCurve(timelineRecord({ timeline: undefined }), { scope: 'observed' }).available, false);
  assert.equal(damageCurve(timelineRecord({ timeline: { interval_ms: 0, started_ms: 0, total: [], players: [], complete: false } }), { scope: 'observed' }).available, false);
  // A personal chart for a character that dealt no damage is a flat line, not an error.
  const flat = damageCurve(timelineRecord({ local_player_id: 9 }), { scope: 'personal' });
  assert.equal(flat.available, true);
  assert.equal(flat.totalDamage, 0);
});

test('raw samples take precedence over the stored timeline', () => {
  const sampled = timelineRecord({ sample_complete: true, damage_samples: [{ timestamp_ms: 100500, amount: 77, player_id: 1, source: 1 }] });
  const curve = damageCurve(sampled, { scope: 'personal' });
  assert.equal(curve.summary, undefined);
  assert.equal(curve.totalDamage, 77);
});

test('encounters keep a validated timeline through normalization', () => {
  const kept = normalizeEncounter({ total_damage: 10, started_ms: 100000, timeline: timelineRecord().timeline });
  assert.deepEqual(kept.timeline.total, [300, 0, 450]);
  assert.equal(kept.timeline.players.length, 3);
  assert.equal(kept.timeline.complete, true);
  const bad = [null, 'x', {}, { interval_ms: 500, started_ms: 1, total: [1] }, { interval_ms: 1000, started_ms: 1, total: [1, -2] },
    { interval_ms: 1000, started_ms: 1, total: [1, 2], players: [{ id: '1', damage: [1] }] }];
  for (const timeline of bad.slice(0, 5)) assert.equal(normalizeEncounter({ total_damage: 10, timeline }).timeline.total.length, 0);
  // A player series of the wrong length is dropped without discarding the rest.
  assert.equal(normalizeEncounter({ total_damage: 10, timeline: bad[5] }).timeline.players.length, 0);
  assert.equal(normalizeEncounter({ total_damage: 10, timeline: bad[5] }).timeline.total.length, 2);
});
