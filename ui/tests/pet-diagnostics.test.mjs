import test from 'node:test';
import assert from 'node:assert/strict';
import { petDiagnosticReport } from '../pet-diagnostics.mjs';

const fixture = () => ({ version: '0.20.2', mode: 'native', now: 2000, pins: [1010],
  state: { local_player_id: 7, local_identity_source: 'server', local_player_name: 'PRIVATE-NAME', pet_collection_owner: { actor_id: 7, source: 'server-self', generation: 2 },
    recent_personal_target: { actor_id: 7, target_id: 900, target_npc_id: 2400617, target_name: 'PRIVATE-TARGET', hit_at_ms: 1000, source: 'server-self-hit' },
    capture: { status: 'capturing', packets: 500, missed_packets: 0, game_connections: 1, endpoint: 'PRIVATE-ENDPOINT' },
    diagnostics: { stream_gaps: 0 }, token: 'PRIVATE-SECRET', history: [{ notes: 'PRIVATE-HISTORY' }] },
  character: { pet_collection_owner: { actor_id: 7, source: 'server-self', generation: 2 }, pet_progress: { actor_id: 7, source: 'server-self', inventory_complete: true, observed_at_ms: 1500,
    pets: [{ pet_id: 1010, level: 2, progress: 0, progress_source: 'server-level-reset', observed_at_ms: 1500 }] },
    inspected: [{ name: 'PRIVATE-INSPECTION' }], own: { name: 'PRIVATE-BUILD' } } });

test('explicit pet diagnostics expose received target templates and tier resets without private state', () => {
  const report = petDiagnosticReport(fixture());
  assert.equal(report.type, 'luma-pet-diagnostics');
  assert.equal(report.mode, 'native');
  assert.equal(report.recent_hit.npc_id, 2400617);
  assert.deepEqual(report.tracked_pets[0], { pet_id: 1010, received: true, level: 2, progress: 0,
    progress_source: 'server-level-reset', stale: false, observed_at_ms: 1500, session_gained: 0 });
  assert.equal(JSON.stringify(report).includes('PRIVATE-'), false);
});

test('diagnostics reject foreign or manual ownership, expire hit data and bound tracked rows', () => {
  const value = fixture();
  value.pins = Array.from({ length: 100 }, (_, i) => 1000 + i);
  value.state.local_identity_source = 'manual';
  value.state.pet_collection_owner = null;
  let report = petDiagnosticReport(value);
  assert.equal(report.identity.server_confirmed, false);
  assert.equal(report.recent_hit, null);
  assert.equal(report.pet_snapshot.received, false);
  assert.equal(report.tracked_pets.length, 12);
  assert.ok(report.tracked_pets.every(row => !row.received && row.progress === null));
  value.state.local_identity_source = 'server';
  value.state.pet_collection_owner = fixture().state.pet_collection_owner;
  value.character.pet_progress.actor_id = 8;
  value.state.recent_personal_target.actor_id = 8;
  report = petDiagnosticReport(value);
  assert.equal(report.recent_hit, null);
  assert.equal(report.pet_snapshot.received, false);
  const expired = fixture(); expired.now = 11000;
  assert.equal(petDiagnosticReport(expired).recent_hit, null);
});

test('dead self diagnostics retain same-generation collection counters as last-known while live hit data stays unavailable', () => {
  const value = fixture();
  value.state.live_team_identity = { local: null };
  const report = petDiagnosticReport(value);
  assert.equal(report.identity.server_confirmed, false); assert.equal(report.identity.actor_id, null);
  assert.deepEqual(report.identity.collection_owner, { actor_id: '7', source: 'server-self', generation: 2 });
  assert.equal(report.recent_hit, null);
  assert.equal(report.pet_snapshot.received, true); assert.equal(report.pet_snapshot.continuity, 'last-known');
  assert.equal(report.tracked_pets[0].progress, 0); assert.equal(report.tracked_pets[0].level, 2);
  assert.equal(report.tracked_pets[0].stale, true); assert.equal(report.tracked_pets[0].observed_at_ms, 1500);
  assert.equal(JSON.stringify(report).includes('PRIVATE-'), false);
  value.state.pet_collection_owner.generation = 3;
  assert.equal(petDiagnosticReport(value).pet_snapshot.received, false);
  value.state.pet_collection_owner = null;
  assert.equal(petDiagnosticReport(value).pet_snapshot.received, false);
});
