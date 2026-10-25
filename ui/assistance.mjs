import { staggerState } from './telemetry.mjs';

const id = value => value === null || value === undefined ? null : String(value).slice(0, 80);
const time = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const nonnegative = value => time(value) ?? 0;

export function assistanceState(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    retention_limited: value.retention_limited === true,
    stagger: staggerState(value.stagger),
    casts: (Array.isArray(value.casts) ? value.casts : []).slice(0, 64).filter(cast => cast.source === 'server-windup' && time(cast.expires_ms) !== null).map(cast => ({ actor_id: id(cast.actor_id), skill_id: id(cast.skill_id), target_id: id(cast.target_id), started_ms: time(cast.started_ms), expires_ms: time(cast.expires_ms), duration_ms: nonnegative(cast.duration_ms), source: 'server-windup', hostile: cast.hostile === true, lethal: cast.lethal === true })),
    effects: (Array.isArray(value.effects) ? value.effects : []).slice(0, 256).filter(effect => effect.source === 'server-effect').map(effect => ({ recipient_id: id(effect.recipient_id), caster_id: id(effect.caster_id), instance_id: id(effect.instance_id), effect_id: id(effect.effect_id), duration_ms: nonnegative(effect.duration_ms), started_ms: time(effect.started_ms), expires_ms: time(effect.expires_ms), persistent: effect.persistent === true, source: 'server-effect' })),
  };
}

export function assistanceTimeline(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const kinds = ['windup', 'cast', 'effect-applied', 'effect-refreshed', 'effect-removed', 'effect-expired', 'stagger-break'];
  return (Array.isArray(value.timeline) ? value.timeline : []).slice(-1000).filter(event => kinds.includes(event?.kind) && time(event.at_ms) !== null).map(event => ({ kind: event.kind, at_ms: event.at_ms, actor_id: id(event.actor_id), skill_id: id(event.skill_id), target_id: id(event.target_id), instance_id: id(event.instance_id) })).slice(-30).reverse();
}

// Full retained observations for reports and analysis, independent of the short
// live timeline. Never reconstruct HP points from a previous value.
export function encounterAssistance(value = {}) {
  const live = assistanceState(value);
  const kinds = ['windup', 'cast', 'effect-applied', 'effect-refreshed', 'effect-removed', 'effect-expired', 'stagger-break'];
  const health = rows => (Array.isArray(rows) ? rows : []).slice(-512).filter(row => row && id(row.actor_id) !== null && time(row.observed_at_ms) !== null).map(row => ({ actor_id: id(row.actor_id), current_hp: time(row.current_hp), reported_max_hp: time(row.reported_max_hp), observed_peak_hp: time(row.observed_peak_hp), observed_at_ms: row.observed_at_ms }));
  return { ...live, timeline: (Array.isArray(value?.timeline) ? value.timeline : []).slice(-1000).filter(row => kinds.includes(row?.kind) && time(row.at_ms) !== null).map(row => ({ kind: row.kind, at_ms: row.at_ms, actor_id: id(row.actor_id), skill_id: id(row.skill_id), target_id: id(row.target_id), instance_id: id(row.instance_id) })), health: health(value?.health).slice(-256), health_history: health(value?.health_history) };
}

export function ownTargetedWindups(state, now = Date.now()) {
  if (!['server', 'manual', 'name-match'].includes(state?.local_identity_source) || state.local_player_id === null || state.local_player_id === undefined) return [];
  const localId = String(state.local_player_id);
  return assistanceState(state.assist).casts.filter(cast => cast.target_id === localId && cast.actor_id !== localId && cast.expires_ms > now).sort((a, b) => a.expires_ms - b.expires_ms);
}

// Casts by hostile monsters, soonest first with the ones aimed at the local player ahead of the
// rest. Summons, pets and players never count: a friendly windup is not a threat.
export function bossCasts(state, now = Date.now(), limit = 3) {
  const known = ['server', 'manual', 'name-match'].includes(state?.local_identity_source) && state.local_player_id !== null && state.local_player_id !== undefined;
  const local = known ? String(state.local_player_id) : null;
  return assistanceState(state?.assist).casts
    .filter(cast => cast.hostile && cast.expires_ms > now && cast.actor_id !== null)
    .map(cast => ({ ...cast, aimed: local !== null && cast.target_id === local }))
    .sort((a, b) => Number(b.aimed) - Number(a.aimed) || Number(b.lethal) - Number(a.lethal) || a.expires_ms - b.expires_ms)
    .slice(0, limit);
}

export function scopedEffects(state, scope = 'personal', now = Date.now()) {
  const effects = assistanceState(state?.assist).effects.filter(effect => effect.persistent || effect.expires_ms !== null && effect.expires_ms > now);
  if (scope === 'observed') return effects;
  if (scope === 'party') {
    if (!['server', 'manual'].includes(state?.party_membership_source)) return [];
    const members = new Set((state.party_member_ids || []).map(String));
    return effects.filter(effect => members.has(effect.recipient_id));
  }
  if (!['server', 'manual', 'name-match'].includes(state?.local_identity_source) || state.local_player_id === null || state.local_player_id === undefined) return [];
  return effects.filter(effect => effect.recipient_id === String(state.local_player_id));
}
