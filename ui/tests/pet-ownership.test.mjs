import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, liveServerActorId, petCollectionOwner, petCollectionEpoch, acceptsPetCollectionSnapshot, petCollectionProgress } from '../model.mjs';
import { characterSnapshot } from '../character.mjs';
import { stalePetProgress } from '../telemetry.mjs';
import { PET_CATALOG } from '../pet-catalog.mjs';
import { normalizePetCatalog, petPlan, petMetadataTransition, renderPetTracker, trackedPets } from '../pets.mjs';

const owner = (generation = 3, actor_id = 7) => ({ actor_id, source: 'server-self', generation });
const state = () => normalizeState({ local_player_id: 7, local_identity_source: 'server', character_revision: 1,
  live_team_identity: { local: { actor_id: 7, identity_source: 'server' } }, pet_collection_owner: owner(), capture: { status: 'capturing' } });
const snapshot = () => ({ pet_collection_owner: owner(), pet_progress: { actor_id: 7, source: 'server-self', observed_at_ms: 1000,
  pets: [{ pet_id: 1002, level: 1, progress: 12, progress_source: 'server-absolute', observed_at_ms: 1000 }] } });
const transition = (previous, current) => petMetadataTransition(previous, current, {
  previousActorId: petCollectionOwner(previous)?.actor_id ?? null, currentActorId: petCollectionOwner(current)?.actor_id ?? null,
});

test('same-character death retains collection owner while live combat identity and hit pinning remain unavailable', () => {
  const previous = state();
  const dead = normalizeState({ ...previous, character_revision: 2, live_team_identity: { local: null } });
  assert.equal(liveServerActorId(dead), null);
  assert.deepEqual(petCollectionOwner(dead), { actor_id: '7', source: 'server-self', generation: 3 });
  assert.equal(petCollectionEpoch(previous), petCollectionEpoch(dead));
  assert.deepEqual(transition(previous, dead), { fetch: true, clear: false });
  assert.equal(acceptsPetCollectionSnapshot(dead, snapshot()), true);
  const received = characterSnapshot(snapshot());
  assert.deepEqual(received.pet_collection_owner, petCollectionOwner(previous));
  const stale = petCollectionProgress(dead, received, { now: 2000 });
  const plan = petPlan(stale, normalizePetCatalog(PET_CATALOG), { now: 2000, localPlayerId: petCollectionOwner(dead).actor_id, pins: [1002] });
  const row = trackedPets(plan, [1002], { now: 2000 })[0];
  assert.equal(row.progress, 12); assert.equal(row.remaining, 88); assert.equal(row.percent, 48); assert.equal(row.stale, true);
  assert.equal(row.etaMs, null);
  assert.match(renderPetTracker([row]), /Son alınan/);
});

test('every dead view stays last-known even after a fresh matching getter, and only live matching self can restore an intact baseline', () => {
  const previous = state(), dead = normalizeState({ ...previous, live_team_identity: { local: null } });
  const current = snapshot();
  Object.assign(current.pet_progress.pets[0], { session_gained: 6, session_baseline_gained: 0, session_started_at_ms: 0, session_gain_events: 3, last_gain_at_ms: 1000 });
  const received = characterSnapshot(current);
  for (const now of [2000, 3000]) {
    const observed = petCollectionProgress(dead, received, { now });
    assert.equal(observed.continuity, 'last-known');
    assert.equal(observed.pets[0].progress, 12); assert.equal(observed.pets[0].progress_stale, true);
    assert.equal(observed.pets[0].session_gained, 0);
    assert.equal(observed.pets[0].observed_at_ms, 1000);
    assert.equal(observed.pets[0].last_gain_at_ms, null);
  }
  assert.equal(received.pet_progress.pets[0].progress_stale, false);
  const resumed = petCollectionProgress(previous, received, { now: 3000 });
  assert.equal(resumed.pets[0].progress_stale, false); assert.equal(resumed.pets[0].session_gained, 6);
  const gap = characterSnapshot({ ...received, pet_progress: stalePetProgress(received.pet_progress, { now: 2000, reason: 'capture-gap' }) });
  assert.equal(petCollectionProgress(previous, gap, { now: 3000 }).pets[0].progress_stale, true);
  assert.equal(petCollectionProgress(previous, gap, { now: 3000 }).pets[0].session_gained, 0);
});

test('an unavailable capture retains pet counters but cannot keep fresh farming estimates or recent-gain suggestions', () => {
  const live = state(), received = characterSnapshot(snapshot());
  Object.assign(received.pet_progress, { observed_at_ms: 60000 });
  Object.assign(received.pet_progress.pets[0], { observed_at_ms: 60000, session_gained: 6, session_baseline_gained: 0,
    session_started_at_ms: 0, session_gain_events: 3, last_gain_at_ms: 59000 });
  const catalog = normalizePetCatalog(PET_CATALOG), now = 60000;
  const active = petCollectionProgress(live, received, { now });
  assert.equal(active.pets[0].progress_stale, false);
  assert.equal(petPlan(active, catalog, { now, localPlayerId: '7' }).rows.find(row => row.id === 1002).soulsPerMinute, 6);
  for (const status of ['disconnected', 'stopped', 'error', 'starting', 'waiting', 'no-game', 'permission-required', 'unavailable', 'disabled', '']) {
    const inactive = normalizeState({ ...live, capture: { status } });
    const progress = petCollectionProgress(inactive, received, { now });
    assert.equal(progress.continuity, 'last-known');
    assert.equal(progress.pets[0].progress, 12); assert.equal(progress.pets[0].observed_at_ms, 60000);
    const plan = petPlan(progress, catalog, { now, localPlayerId: '7' });
    assert.equal(plan.rows.find(row => row.id === 1002).etaMs, null);
    assert.deepEqual(trackedPets(plan, [], { now }), []);
  }
  assert.equal(petCollectionProgress(live, received, { now }).pets[0].progress_stale, false);
});

test('a backwards UI clock preserves the verified counter as last-known before the next engine event arrives', () => {
  const received = characterSnapshot(snapshot());
  const progress = petCollectionProgress(state(), received, { now: 500 });
  assert.equal(progress.continuity, 'last-known'); assert.equal(progress.pets[0].observed_at_ms, 1000);
  const plan = petPlan(progress, normalizePetCatalog(PET_CATALOG), { now: 500, localPlayerId: '7' });
  const row = plan.rows.find(row => row.id === 1002);
  assert.equal(row.progress, 12); assert.equal(row.percent, 48); assert.equal(row.stale, true); assert.equal(row.etaMs, null);
});

test('new owner generation clears same-ID collection caches and rejects late snapshots from the previous character session', async () => {
  const previous = state(), old = snapshot();
  const current = normalizeState({ ...previous, pet_collection_owner: owner(4) });
  assert.notEqual(petCollectionEpoch(current), petCollectionEpoch(previous));
  assert.deepEqual(transition(previous, current), { fetch: true, clear: true });
  assert.equal(acceptsPetCollectionSnapshot(current, old), false);
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const requestEpoch = petCollectionEpoch(previous);
  const applied = pending.then(result => requestEpoch === petCollectionEpoch(current) && acceptsPetCollectionSnapshot(current, result));
  finish(old); assert.equal(await applied, false);
  assert.equal(acceptsPetCollectionSnapshot(current, { ...old, pet_collection_owner: owner(4) }), true);
  const gone = normalizeState({ ...current, pet_collection_owner: null });
  assert.deepEqual(transition(current, gone), { fetch: true, clear: true });
  assert.equal(acceptsPetCollectionSnapshot(gone, old), false);
});

test('collection ownership never falls back to live, manual, completed or cached pet identities', () => {
  for (const value of [
    { local_player_id: 7, local_identity_source: 'server' },
    { local_player_id: 7, local_identity_source: 'manual' },
    { live_team_identity: { local: { actor_id: 7, identity_source: 'server' } } },
    { pet_progress: snapshot().pet_progress },
  ]) {
    assert.equal(petCollectionOwner(value), null); assert.equal(petCollectionEpoch(value), 'none');
    assert.equal(acceptsPetCollectionSnapshot(value, snapshot()), false);
  }
  for (const invalid of [null, {}, [], { ...owner(), source: 'manual' }, { ...owner(), source: 'imported' },
    { ...owner(), actor_id: 0 }, { ...owner(), generation: -1 }, { ...owner(), generation: '3' }, { ...owner(), generation: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal(petCollectionOwner({ pet_collection_owner: invalid }), null);
  }
  assert.equal(acceptsPetCollectionSnapshot(state(), { ...snapshot(), pet_collection_owner: owner(3, 8) }), false);
  assert.equal(acceptsPetCollectionSnapshot(state(), { pet_progress: snapshot().pet_progress }), false);
  assert.equal(acceptsPetCollectionSnapshot(state(), { ...snapshot(), pet_progress: { ...snapshot().pet_progress, actor_id: 8 } }), false);
  assert.equal(acceptsPetCollectionSnapshot(state(), { ...snapshot(), pet_progress: { ...snapshot().pet_progress, source: 'imported' } }), false);
  assert.equal(petCollectionProgress(state(), { ...snapshot(), pet_collection_owner: owner(4) }), null);
  assert.equal(petCollectionProgress({}, snapshot()), null);
  const normalized = state();
  assert.deepEqual(normalizeState(normalized).pet_collection_owner, normalized.pet_collection_owner);
});
