const metric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const id = value => value === null || value === undefined ? '' : String(value);

export function validateTrainingDuration(value) {
  const seconds = typeof value === 'string' && /^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : typeof value === 'number' ? value : NaN;
  return Number.isInteger(seconds) && seconds >= 10 && seconds <= 300 ? seconds * 1000 : null;
}

export function trainingState(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const duration = metric(value.duration_ms) ?? 0;
  return { status: ['idle', 'armed', 'running', 'complete', 'cancelled'].includes(value.status) ? value.status : 'idle', duration_ms: duration, remaining_ms: Math.min(duration, metric(value.remaining_ms) ?? duration), total_damage: metric(value.total_damage) ?? 0, dps: metric(value.dps) ?? 0, started_ms: metric(value.started_ms), local_player_id: value.local_player_id === null || value.local_player_id === undefined ? null : id(value.local_player_id), target_id: value.target_id === null || value.target_id === undefined ? null : id(value.target_id), capture_incomplete: value.capture_incomplete === true };
}

const noCurve = () => ({ available: false, complete: false, points: [], bestBurst: null, activityMs: null, totalDamage: null });

/** A chart from the compact per-interval series kept after the raw hit samples were dropped. */
function timelineCurve(record, scope) {
  const timeline = record?.timeline;
  if (!timeline?.total?.length || !(timeline.interval_ms >= 1000)) return noCurve();
  let series = timeline.total;
  if (scope === 'personal') {
    if (!['server', 'manual', 'name-match'].includes(record.local_identity_source) || record.local_player_id === null || record.local_player_id === undefined) return noCurve();
    series = timeline.players.find(player => player.id === id(record.local_player_id))?.damage ?? timeline.total.map(() => 0);
  } else if (scope === 'party') {
    if (!['server', 'manual'].includes(record.party_membership_source)) return noCurve();
    const members = new Set((record.party_member_ids || []).map(id));
    series = timeline.total.map((_, index) => timeline.players.filter(player => members.has(player.id)).reduce((sum, player) => sum + player.damage[index], 0));
  }
  const interval = timeline.interval_ms;
  const points = series.map((damage, index) => ({ at_ms: index * interval, damage, dps: damage * 1000 / interval }));
  return { available: true, complete: false, summary: true, dataComplete: timeline.complete === true, points, bestBurst: null, activityMs: null,
    totalDamage: series.reduce((sum, value) => sum + value, 0), interval_ms: interval, started_ms: timeline.started_ms, elapsed_ms: metric(record.elapsed_ms) ?? points.length * interval };
}

export function damageCurve(record, { scope = 'personal', intervalMs = 1000 } = {}) {
  const raw = Array.isArray(record?.damage_samples) ? record.damage_samples : [];
  let started = metric(record?.started_ms);
  let elapsed = metric(record?.elapsed_ms) ?? 0;
  const interval = [1000, 5000, 10000].includes(intervalMs) ? intervalMs : 1000;
  if (started === null || elapsed <= 0) return noCurve();
  if (raw.length === 0) return timelineCurve(record, scope);
  let members = null;
  if (scope === 'personal') {
    if (!['server', 'manual', 'name-match'].includes(record.local_identity_source) || record.local_player_id === null || record.local_player_id === undefined) return { available: false, complete: false, points: [], bestBurst: null, activityMs: null, totalDamage: null };
    members = new Set([id(record.local_player_id)]);
  } else if (scope === 'party') {
    if (!['server', 'manual'].includes(record.party_membership_source)) return { available: false, complete: false, points: [], bestBurst: null, activityMs: null, totalDamage: null };
    members = new Set((record.party_member_ids || []).map(id));
  }
  const observedEnd = metric(record?.ended_ms) !== null && record.ended_ms > started ? record.ended_ms : started + elapsed;
  const samples = raw.slice(0, 20000).filter(sample => {
    const time = metric(sample?.timestamp_ms), amount = metric(sample?.amount);
    return time !== null && amount !== null && time >= started && time <= observedEnd && (!members || members.has(id(sample.player_id ?? sample.source)));
  }).sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  if (members && samples.length) started = samples[0].timestamp_ms;
  // The damage clock stops at the last hit: the quiet time that closes an encounter is not part of the curve.
  elapsed = Math.max(1, (samples.length ? Math.min(observedEnd, samples.at(-1).timestamp_ms + 1) : observedEnd) - started);
  const bucketCount = Math.min(1200, Math.ceil(elapsed / interval));
  if (Math.ceil(elapsed / interval) > 1200) return { available: false, complete: false, points: [], bestBurst: null, activityMs: null, totalDamage: null };
  const points = Array.from({ length: bucketCount }, (_, index) => ({ at_ms: index * interval, damage: 0, dps: 0 }));
  for (const sample of samples) {
    const bucket = Math.min(bucketCount - 1, Math.floor((sample.timestamp_ms - started) / interval));
    points[bucket].damage += sample.amount;
  }
  // A bucket is at least the engine's one-second minimum, so a hit in the last millisecond is not a spike.
  for (const point of points) point.dps = point.damage * 1000 / Math.min(interval, Math.max(1000, elapsed - point.at_ms));
  const complete = record.sample_complete === true && raw.length <= 20000;
  // This activity measure is an explicit 3 s union of observed hit windows, not cast time.
  let activity = 0, activeEnd = started;
  for (const sample of samples) {
    const end = Math.min(observedEnd, sample.timestamp_ms + 3000);
    activity += Math.max(0, end - Math.max(sample.timestamp_ms, activeEnd));
    activeEnd = Math.max(activeEnd, end);
  }
  const total = samples.reduce((sum, sample) => sum + sample.amount, 0);
  return { available: true, complete, points, bestBurst: complete ? Math.max(0, ...points.map(point => point.dps)) : null, activityMs: complete ? activity : null, totalDamage: total, interval_ms: interval, started_ms: started, elapsed_ms: elapsed };
}

export function curvePath(points, width = 480, height = 140) {
  const values = points.map(point => metric(point.dps) ?? 0);
  const max = Math.max(...values, 1);
  const count = Math.max(values.length - 1, 1);
  return values.map((value, index) => `${index ? 'L' : 'M'}${(index / count * width).toFixed(2)},${(height - value / max * (height - 10)).toFixed(2)}`).join(' ');
}

export function historyProgress(records, { scope = 'personal' } = {}) {
  const result = [];
  for (const record of records || []) {
    if (record.timing_valid === false) continue;
    const own = scope === 'personal';
    const sourceKnown = own ? ['server', 'manual', 'name-match'].includes(record.local_identity_source) && record.local_player_id !== null : scope === 'party' ? ['server', 'manual'].includes(record.party_membership_source) : true;
    const dps = metric(own ? record.personal_dps : scope === 'party' ? record.party_dps : record.dps);
    const elapsed = metric(own ? record.personal_elapsed_ms : scope === 'party' ? record.party_elapsed_ms : record.elapsed_ms) ?? metric(record.elapsed_ms) ?? 0;
    if (sourceKnown && dps !== null) result.push({ id: id(record.id), name: String(record.name || record.targets?.[0]?.name || ''), dps, elapsed_ms: elapsed, timestamp: String(record.timestamp || '') });
  }
  return result.slice(0, 30).reverse();
}

export function takenCoverage(record = {}, personal = false) {
  const amount = metric(personal ? record.personal_damage_taken : record.damage_taken);
  const complete = personal ? record.personal_damage_taken_complete : record.damage_taken_complete;
  return { kind: amount === null ? 'unknown' : complete === true ? 'complete' : 'partial', unclassifiedAmount: metric(record.unclassified_player_target_amount), unclassifiedEvents: metric(record.unclassified_player_target_events) };
}
