import { liveServerActorId, normalizeRecentPersonalTarget, petCollectionOwner, petCollectionProgress } from './model.mjs';
import { normalizePetPins } from './pets.mjs';

const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const npcId = value => Number.isSafeInteger(value) && value >= 100000 && value <= 9999999 ? value : null;
const captureStates = new Set(['capturing', 'starting', 'waiting', 'stopped', 'disconnected', 'error', 'no-game', 'permission-required', 'unavailable', 'unsupported', 'api-unavailable', 'api-version-mismatch', 'operation-not-supported']);

// Explicit local export only. Never serialize a whole state or character build:
// those can contain names, reports, endpoints and unrelated player information.
export function petDiagnosticReport({ version, mode, state = {}, character = {}, pins, now = Date.now() } = {}) {
  const actor = liveServerActorId(state), selected = normalizePetPins(pins);
  const observed = petCollectionProgress(state, character, { now });
  const received = normalizeRecentPersonalTarget(state.recent_personal_target);
  const ownHit = actor && received?.actor_id === actor ? received : null;
  const age = ownHit && count(now) !== null && now >= ownHit.hit_at_ms ? now - ownHit.hit_at_ms : null;
  const current = age !== null && age < 10000 ? ownHit : null;
  const capture = state.capture || {};
  return {
    type: 'luma-pet-diagnostics', schema_version: 1,
    app_version: typeof version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version) ? version : 'unknown',
    mode: ['native', 'demo', 'browser'].includes(mode) ? mode : 'unknown',
    exported_at_ms: count(now),
    identity: { server_confirmed: actor !== null, actor_id: actor, collection_owner: petCollectionOwner(state) },
    capture: { status: captureStates.has(capture.status) ? capture.status : 'unknown',
      packets: count(capture.packets), missed_packets: count(capture.missed_packets),
      game_connections: count(capture.game_connections), stream_gaps: count(state.diagnostics?.stream_gaps) },
    recent_hit: current ? { source: 'server-self-hit', actor_id: current.actor_id,
      target_id: current.target_id, npc_id: npcId(current.target_npc_id), hit_at_ms: current.hit_at_ms, age_ms: age } : null,
    pet_snapshot: { received: observed !== null, inventory_complete: observed?.inventory_complete ?? false,
      continuity: observed?.continuity || 'unknown', observed_at_ms: observed?.observed_at_ms ?? null,
      observed_pet_count: observed?.pets.length ?? 0 },
    tracked_pets: selected.map(id => {
      const row = observed?.pets.find(pet => pet.pet_id === id);
      return { pet_id: id, received: Boolean(row), level: row?.level ?? null,
        progress: row?.progress ?? null, progress_source: row?.progress_source || 'unknown',
        stale: row?.progress_stale ?? false, observed_at_ms: row?.observed_at_ms ?? null,
        session_gained: row?.session_gained ?? null };
    }),
  };
}
