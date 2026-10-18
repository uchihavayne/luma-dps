const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
const identifier = value => integer(value, 1, 0xffffffff) !== null ? String(value) : typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 0xffffffff ? value : null;
const text = (value, limit = 80) => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').slice(0, limit) : '';

export function networkLatency(value, now = Date.now()) {
  value = object(value);
  const source = value.source === 'windows-tcp-estats' ? value.source : 'unknown';
  const sampled = integer(value.sampled_at_ms), observed = integer(value.observed_at_ms);
  const measured = integer(value.measured_connections, 0, 128) ?? 0;
  const connections = integer(value.game_connections, 0, 128) ?? 0;
  const freshFor = Math.min(integer(value.fresh_for_ms, 1) ?? 5000, 5000);
  const rtt = integer(value.rtt_ms, 0, 120000);
  const fresh = value.status === 'ready' && source !== 'unknown' && value.selection === 'worst-active-game-tcp' && rtt !== null && measured > 0 && measured <= connections && sampled !== null && observed !== null && sampled >= observed && now >= sampled && now - observed <= freshFor;
  const status = fresh ? 'ready' : value.status === 'ready' ? 'stale' : ['waiting', 'collecting', 'stale', 'unavailable', 'stopped'].includes(value.status) ? value.status : 'unavailable';
  return { status, source, selection: 'worst-active-game-tcp', fresh, rtt_ms: fresh ? rtt : null,
    latest_rtt_ms: fresh ? integer(value.latest_rtt_ms, 0, 120000) : null,
    variation_ms: fresh ? integer(value.variation_ms, 0, 120000) : null,
    sampled_at_ms: sampled, observed_at_ms: observed, fresh_for_ms: freshFor,
    measured_connections: fresh ? measured : 0, game_connections: connections, error_code: text(value.error_code) };
}

export function latencyPresentation(value, { now = Date.now(), locale = 'tr' } = {}) {
  const state = networkLatency(value, now), tr = locale !== 'en';
  const labels = tr ? { waiting: 'Oyun bağlantısı bekleniyor', collecting: 'RTT örneği bekleniyor', stale: 'Yeni RTT örneği yok', unavailable: 'RTT alınamadı', stopped: 'RTT ölçümü kapalı' } : { waiting: 'Waiting for game connection', collecting: 'Waiting for RTT sample', stale: 'No recent RTT sample', unavailable: 'RTT unavailable', stopped: 'RTT monitoring stopped' };
  return { ...state, label: state.fresh ? `${state.rtt_ms} ms` : '— ms',
    detail: `${tr ? 'Windows TCP gidiş-dönüş süresi · en yavaş etkin oyun bağlantısı' : 'Windows TCP round-trip time · slowest active game connection'} · ${state.fresh ? `${state.measured_connections}/${state.game_connections}` : labels[state.status]}${state.error_code ? ` · ${state.error_code}` : ''}` };
}

export function petProgress(value, { localPlayerId } = {}) {
  value = object(value);
  const actor = identifier(value.actor_id);
  if (!actor || value.source !== 'server-self' || localPlayerId !== undefined && actor !== identifier(localPlayerId)) return null;
  const seen = new Set(), pets = [];
  for (const input of (Array.isArray(value.pets) ? value.pets : []).slice(0, 2000)) {
    const row = object(input), pet = integer(row.pet_id, 1000, 99999);
    if (pet === null || seen.has(pet)) continue;
    seen.add(pet);
    const progress = ['server-absolute', 'server-delta'].includes(row.progress_source) ? integer(row.progress) : null;
    pets.push({ pet_id: pet, level: integer(row.level, 0, 3), progress,
      progress_source: progress === null ? 'unknown' : row.progress_source,
      required_progress: null, session_gained: integer(row.session_gained) ?? 0,
      session_started_at_ms: integer(row.session_started_at_ms), session_baseline_gained: integer(row.session_baseline_gained) ?? 0,
      session_gain_events: integer(row.session_gain_events) ?? 0, last_gain_at_ms: integer(row.last_gain_at_ms),
      observed_at_ms: integer(row.observed_at_ms) });
  }
  const active = integer(value.active_pet_id, 1000, 99999);
  return { actor_id: actor, source: 'server-self', observed_at_ms: integer(value.observed_at_ms),
    active_pet_id: value.active_pet_known === true && pets.some(pet => pet.pet_id === active) ? active : null,
    active_pet_known: value.active_pet_known === true,
    inventory_complete: value.inventory_complete === true && seen.size === value.pets?.length,
    pets: pets.sort((a, b) => a.pet_id - b.pet_id) };
}

export function cooldownObservation(value, { localPlayerId, now = Date.now() } = {}) {
  value = object(value);
  const actor = identifier(value.actor_id), source = value.source === 'local-server' ? 'local-server' : 'unknown';
  const validActor = actor !== null && (localPlayerId === undefined || actor === identifier(localPlayerId));
  const observed = integer(value.observed_at_ms), raw = integer(value.raw_remaining_units, 0, 0xffffffff);
  const fresh = validActor && source === 'local-server' && value.unit === 'server-counter' && value.fresh === true && observed !== null && now >= observed && now - observed <= 6000;
  const rate = value.estimated_rate_units_per_ms;
  const estimated = fresh && raw !== null && typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && integer(value.rate_samples, 3) !== null && ['estimated-cooling', 'estimated-elapsed'].includes(value.readiness);
  const remaining = estimated ? Math.min(3600000, Math.max(0, raw / rate - (now - observed))) : null;
  const confirmed = fresh && raw === 0 && value.readiness === 'server-ready' && value.ready_confirmed === true;
  const chargeTime = integer(value.charges_observed_at_ms);
  const chargesFresh = validActor && source === 'local-server' && chargeTime !== null && now >= chargeTime && now - chargeTime <= 6000;
  return { actor_id: actor, scope: validActor && source === 'local-server' ? 'self' : 'unknown',
    kind: confirmed ? 'confirmed' : remaining === null ? 'unknown' : remaining > 0 ? 'countdown' : 'elapsed', remaining,
    estimated: estimated === true, raw_units: fresh ? raw : null, fresh,
    charges: chargesFresh ? integer(value.charges, 0, 100) : null, max_charges: null,
    observed_at_ms: observed, charges_observed_at_ms: integer(value.charges_observed_at_ms), source };
}

export function staggerState(rows, now = Date.now()) {
  const seen = new Set(), result = [];
  for (const input of (Array.isArray(rows) ? rows : []).slice(0, 64)) {
    const row = object(input), actor = identifier(row.actor_id), current = integer(row.current, 0, 1000000), maximum = integer(row.maximum, 1, 1000000), observed = integer(row.observed_at_ms);
    if (!actor || seen.has(actor) || row.source !== 'server' || current === null || maximum !== null && current > maximum || row.broken === true && current !== 0 || row.broken !== true && maximum === null || observed === null) continue;
    seen.add(actor);
    const freshFor = Math.min(integer(row.fresh_for_ms, 1) ?? 5000, 5000);
    result.push({ actor_id: actor, current, maximum, broken: row.broken === true, observed_at_ms: observed, fresh_for_ms: freshFor,
      fresh: row.fresh === true && now >= observed && now - observed <= freshFor, source: 'server' });
  }
  return result;
}

export function staggerPresentation(rows, { now = Date.now(), locale = 'tr' } = {}) {
  return staggerState(rows, now).filter(row => row.fresh).map(row => ({ ...row,
    percent: row.maximum === null ? null : row.current / row.maximum * 100,
    label: row.broken ? locale === 'en' ? 'Stagger broken' : 'Denge kırıldı' : `${row.current} / ${row.maximum}` }));
}
