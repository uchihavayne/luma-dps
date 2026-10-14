import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingState, damageCurve, curvePath, historyProgress, takenCoverage } from '../analysis.mjs';
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
  const normalized = normalizeEncounter({ ...record(), total_damage: 1400, damage_samples: Array(5001).fill(record().damage_samples[0]) });
  assert.equal(normalized.damage_samples.length, 5000); assert.equal(normalized.sample_complete, false);
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
