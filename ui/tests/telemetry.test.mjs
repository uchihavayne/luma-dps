import test from 'node:test';
import assert from 'node:assert/strict';
import { networkLatency, latencyPresentation, petProgress, stalePetProgress, cooldownObservation, staggerState, staggerPresentation } from '../telemetry.mjs';
import { characterSnapshot } from '../character.mjs';

const latency = () => ({ status: 'ready', source: 'windows-tcp-estats', selection: 'worst-active-game-tcp', rtt_ms: 83, latest_rtt_ms: 90, variation_ms: 4, observed_at_ms: 1000, sampled_at_ms: 2000, fresh_for_ms: 5000, measured_connections: 1, game_connections: 2 });
const pets = () => ({ actor_id: 7, source: 'server-self', observed_at_ms: 2000, active_pet_id: 1042, active_pet_known: true, inventory_complete: true, pets: [{ pet_id: 1042, level: 2, progress: 32, progress_source: 'server-absolute', required_progress: 75, session_gained: 2, observed_at_ms: 2000 }] });
const stagger = () => [{ actor_id: 10, current: 750, maximum: 1200, observed_at_ms: 1000, fresh_for_ms: 5000, fresh: true, source: 'server' }];

test('passive RTT shows only recent advancing OS samples and clears every numeric value when stale', () => {
  const fresh = networkLatency(latency(), 3000);
  assert.equal(fresh.rtt_ms, 83); assert.equal(fresh.latest_rtt_ms, 90); assert.equal(fresh.fresh, true);
  const stale = networkLatency(latency(), 6001);
  assert.equal(stale.status, 'stale'); assert.equal(stale.rtt_ms, null); assert.equal(stale.latest_rtt_ms, null); assert.equal(stale.variation_ms, null);
  assert.equal(latencyPresentation(latency(), { now: 3000, locale: 'en' }).label, '83 ms');
  assert.match(latencyPresentation(latency(), { now: 3000 }).detail, /Windows TCP/);
});

test('RTT rejects invented sources, invalid counts, future samples and values outside the native contract', () => {
  for (const patch of [{ source: 'guessed' }, { selection: 'fastest' }, { measured_connections: 0 }, { measured_connections: 3 }, { sampled_at_ms: 4000 }, { rtt_ms: -1 }, { rtt_ms: 120001 }, { observed_at_ms: 4000 }]) {
    assert.equal(networkLatency({ ...latency(), ...patch }, 3000).rtt_ms, null);
  }
  assert.equal(networkLatency({ ...latency(), rtt_ms: 0 }, 3000).rtt_ms, 0);
  assert.equal(networkLatency({ ...latency(), fresh_for_ms: 999999 }, 6001).rtt_ms, null);
  assert.equal(networkLatency(null, 3000).rtt_ms, null);
});

test('self pet progress preserves actual values while refusing unverified soul thresholds', () => {
  const value = petProgress(pets(), { localPlayerId: '7' });
  assert.equal(value.actor_id, '7'); assert.equal(value.active_pet_id, 1042);
  assert.equal(value.pets[0].progress, 32); assert.equal(value.pets[0].session_gained, 2);
  assert.equal(value.pets[0].required_progress, null);
  assert.equal(petProgress(value, { localPlayerId: 7 }).pets[0].progress, 32);
});

test('pet state cannot transfer to a stranger or be claimed by a typed/manual identity', () => {
  assert.equal(petProgress(pets(), { localPlayerId: 8 }), null);
  assert.equal(petProgress(pets(), { localPlayerId: null }), null);
  assert.equal(petProgress({ ...pets(), source: 'server-self-unbound' }), null);
  assert.equal(petProgress({ ...pets(), actor_id: null }), null);
  assert.equal(petProgress({ ...pets(), actor_id: '<script>' }), null);
});

test('pet lists deduplicate and preserve unknown progress rather than displaying zero', () => {
  const input = pets();
  input.pets.push({ ...input.pets[0], progress: 999 });
  input.pets.push({ pet_id: 1204, level: 7, progress: 33, progress_source: 'guessed', session_gained: -4 });
  const value = petProgress(input);
  assert.equal(value.pets.length, 2); assert.equal(value.pets[0].progress, 32);
  assert.equal(value.pets[1].level, null); assert.equal(value.pets[1].progress, null);
  assert.equal(value.pets[1].session_gained, 0); assert.equal(value.inventory_complete, false);
  assert.equal(petProgress({ ...pets(), active_pet_id: 9999 }).active_pet_id, null);
});

test('received registration level zero survives native and character snapshot normalization without filling missing levels', () => {
  const input = pets();
  input.pets = [
    { pet_id: 1002, level: 0, progress: 3, progress_source: 'server-absolute', observed_at_ms: 2000 },
    { pet_id: 1003, progress: 1, progress_source: 'server-delta', observed_at_ms: 2000 },
    { pet_id: 1004, level: null, progress: 0, progress_source: 'server-absolute', observed_at_ms: 2000 },
  ];
  const first = petProgress(input, { localPlayerId: 7 });
  assert.equal(first.pets[0].level, 0); assert.equal(first.pets[0].progress, 3);
  assert.equal(first.pets[1].level, null); assert.equal(first.pets[2].level, null);
  assert.deepEqual(petProgress(first, { localPlayerId: '7' }), first);
  assert.deepEqual(petProgress(characterSnapshot({ pet_progress: input }).pet_progress, { localPlayerId: '7' }), first);
});

test('an explicit received level-reset zero survives snapshot normalization without accepting invented reset progress', () => {
  const input = pets();
  input.pets = [{ pet_id: 1042, level: 2, progress: 0, progress_source: 'server-level-reset', progress_stale: false, observed_at_ms: 2000 }];
  const value = characterSnapshot({ pet_progress: input }).pet_progress;
  assert.equal(value.pets[0].level, 2); assert.equal(value.pets[0].progress, 0);
  assert.equal(value.pets[0].progress_source, 'server-level-reset');
  assert.deepEqual(petProgress(value, { localPlayerId: '7' }), value);
  for (const patch of [{ progress: 3 }, { level: null }, { level: undefined }]) {
    const malformed = petProgress({ ...input, pets: [{ ...input.pets[0], ...patch }] });
    assert.equal(malformed.pets[0].progress, null);
    assert.equal(malformed.pets[0].progress_source, 'unknown');
  }
});

test('interrupted pet snapshots retain last received counters with stale ownership and no farming rate', () => {
  const original = pets();
  Object.assign(original.pets[0], { session_started_at_ms: 100, session_baseline_gained: 0, session_gain_events: 3, last_gain_at_ms: 1900 });
  const stale = stalePetProgress(original, { reason: 'capture-gap', now: 3000 });
  assert.equal(stale.continuity, 'last-known'); assert.equal(stale.stale_at_ms, 3000);
  assert.equal(stale.stale_reason, 'capture-gap'); assert.equal(stale.pets[0].progress, 32);
  assert.equal(stale.pets[0].level, 2); assert.equal(stale.pets[0].progress_stale, true);
  assert.equal(stale.pets[0].session_gained, 0); assert.equal(stale.pets[0].session_started_at_ms, null);
  assert.equal(stale.pets[0].session_gain_events, 0); assert.equal(stale.pets[0].last_gain_at_ms, null);
  assert.deepEqual(characterSnapshot({ pet_progress: stale }).pet_progress, stale);
  assert.equal(stalePetProgress(stale, { now: 5000 }).stale_at_ms, 3000);
  assert.equal(petProgress(stale, { localPlayerId: 8 }), null);
  assert.equal(petProgress(stale, { localPlayerId: null }), null);
  assert.equal(stalePetProgress(null), null);
  const fresh = petProgress(original);
  assert.equal(fresh.continuity, 'live'); assert.equal(fresh.pets[0].progress_stale, false);
});

test('cooldown expiry differs from server-confirmed ready and keeps unknown charges unknown', () => {
  const input = { actor_id: 7, source: 'local-server', unit: 'server-counter', raw_remaining_units: 9600, estimated_rate_units_per_ms: 2.4, rate_samples: 3, observed_at_ms: 3000, fresh: true, charges: 1, charges_observed_at_ms: 3000, readiness: 'estimated-cooling' };
  assert.equal(cooldownObservation(input, { localPlayerId: 7, now: 3500 }).remaining, 3500);
  assert.equal(cooldownObservation(input, { localPlayerId: 7, now: 7000 }).kind, 'elapsed');
  assert.equal(cooldownObservation({ ...input, raw_remaining_units: 0, readiness: 'server-ready', ready_confirmed: true }, { now: 7000 }).kind, 'confirmed');
  assert.equal(cooldownObservation({ source: 'server', remaining_ms: 0 }).kind, 'unknown');
  assert.equal(cooldownObservation({ remaining_ms: null, charges: null }).kind, 'unknown');
  assert.equal(cooldownObservation(input).max_charges, null);
});

test('cooldown actor mismatch and clock reversal cannot display another player readiness', () => {
  const value = { actor_id: 7, source: 'local-server', unit: 'server-counter', raw_remaining_units: 9600, estimated_rate_units_per_ms: 2.4, rate_samples: 3, observed_at_ms: 3000, fresh: true, charges: 1, charges_observed_at_ms: 3000, readiness: 'estimated-cooling' };
  const mismatch = cooldownObservation(value, { localPlayerId: 8, now: 3500 });
  assert.equal(mismatch.kind, 'unknown'); assert.equal(mismatch.charges, null);
  assert.equal(cooldownObservation(value, { now: 2999 }).remaining, null);
  assert.equal(cooldownObservation({ ...value, charges: 101 }).charges, null);
});

test('raw cooldown units are never milliseconds, stale ready and changed calibration are unknown', () => {
  const value = { actor_id: 7, source: 'local-server', unit: 'server-counter', raw_remaining_units: 24000, observed_at_ms: 3000, fresh: true, readiness: 'unknown' };
  assert.equal(cooldownObservation(value, { now: 3500 }).remaining, null);
  assert.equal(cooldownObservation(value, { now: 3500 }).raw_units, 24000);
  assert.equal(cooldownObservation({ ...value, readiness: 'server-ready', raw_remaining_units: 0, ready_confirmed: true }, { now: 9001 }).kind, 'unknown');
  assert.equal(cooldownObservation({ ...value, readiness: 'estimated-cooling', estimated_rate_units_per_ms: 2.4, rate_samples: 2 }, { now: 3500 }).remaining, null);
});

test('fresh received stagger yields a bounded bar, then disappears without assuming break duration', () => {
  const value = staggerPresentation(stagger(), { now: 2000 });
  assert.equal(value.length, 1); assert.equal(value[0].percent, 62.5); assert.equal(value[0].label, '750 / 1200');
  assert.equal(staggerPresentation(stagger(), { now: 6001 }).length, 0);
  assert.equal(staggerPresentation([{ ...stagger()[0], broken: true, current: 0, maximum: null }], { now: 2000, locale: 'en' })[0].label, 'Stagger broken');
  assert.equal(staggerPresentation([{ ...stagger()[0], fresh: false }], { now: 2000 }).length, 0);
});

test('stagger normalization rejects over-max bars, unknown sources, duplicate actors and future clocks', () => {
  assert.equal(staggerState([{ ...stagger()[0], current: 1201 }], 2000).length, 0);
  assert.equal(staggerState([{ ...stagger()[0], source: 'predicted' }], 2000).length, 0);
  assert.equal(staggerState([{ ...stagger()[0], maximum: null }], 2000).length, 0);
  assert.equal(staggerState([...stagger(), ...stagger()], 2000).length, 1);
  assert.equal(staggerPresentation(stagger(), { now: 999 }).length, 0);
  assert.equal(staggerState(null, 2000).length, 0);
});
