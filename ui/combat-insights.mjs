import { skillLabel } from './skill-names.mjs';
// Local analysis of retained observations. A hit is never promoted to a cast,
// and damage while an effect is present is not attributed causal bonus damage.
const LIMITS = Object.freeze({ timeline: 1000, samples: 20000, effects: 256, health: 512, players: 100, skills: 500 });
const integer = (value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
const metric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && /^[\w:-]{1,80}$/u.test(value) ? value : integer(value) !== null ? String(value) : null;
const list = (value, maximum) => Array.isArray(value) ? value.slice(0, maximum) : [];
const text = value => typeof value === 'string' ? value.slice(0, 100).replace(/[\u0000-\u001f]/gu, '') : '';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = values => values.reduce((total, value) => Math.min(Number.MAX_SAFE_INTEGER, total + value), 0);

export function insightWindow(record) {
  if (!object(record) || record.timing_valid === false) return null;
  const start = integer(record.started_ms), elapsed = integer(record.elapsed_ms);
  if (start === null) return null;
  let end = integer(record.ended_ms);
  if (record.ended_ms === null || record.ended_ms === undefined || end === 0 && start > 0) end = elapsed === null ? null : integer(start + elapsed);
  if (end === null || end <= start || end - start > 86400000) return null;
  // Wall-clock bounds include pauses. An unrecorded pause cannot be removed from
  // a retained event timeline just because the aggregate clock was shorter.
  return { start_ms: start, end_ms: end, duration_ms: end - start, clock: 'retained-wall-time', paused_or_clock_difference: elapsed !== null && elapsed !== end - start };
}

function selection(record, { scope = 'personal', actorId = null } = {}) {
  const requested = ['personal', 'party', 'observed'].includes(scope) ? scope : 'personal';
  const storedScope = ['personal', 'party', 'observed'].includes(record?.actor_scope) ? record.actor_scope : 'observed';
  // A report already narrowed to a scope cannot be widened by a different menu.
  if (storedScope !== 'observed' && requested !== storedScope && requested !== 'observed') return { known: false, scope: requested, reason: 'scope-unavailable', members: new Set() };
  let members = null;
  if (requested === 'personal' || storedScope === 'personal') {
    const own = identifier(record?.local_player_id);
    if (own === null || !['server', 'manual', 'name-match', 'name'].includes(record?.local_identity_source)) return { known: false, scope: requested, reason: 'identity-unresolved', members: new Set() };
    members = new Set([own]);
  } else if (requested === 'party' || storedScope === 'party') {
    if (!['server', 'manual'].includes(record?.party_membership_source)) return { known: false, scope: requested, reason: 'party-unresolved', members: new Set() };
    members = new Set(list(record.party_member_ids, LIMITS.players).map(identifier).filter(value => value !== null));
  }
  if (actorId !== null && actorId !== undefined) {
    const actor = identifier(actorId);
    if (actor === null || members && !members.has(actor)) return { known: false, scope: requested, reason: 'actor-outside-scope', members: new Set() };
    members = new Set([actor]);
  }
  return { known: true, scope: storedScope !== 'observed' ? storedScope : requested, reason: null, members };
}

function actors(record) {
  const result = new Map();
  for (const player of list(record?.players, LIMITS.players)) {
    const actor = identifier(player?.id);
    if (actor === null) continue;
    const skills = new Map();
    for (const skill of list(player.skills, LIMITS.skills)) {
      const skillId = identifier(skill?.id);
      if (skillId !== null) skills.set(skillId, text(skill.name) || skillLabel(skillId));
    }
    result.set(actor, { name: text(player.name) || `#${actor}`, skills });
  }
  return result;
}

function observedData(record, options) {
  const window = insightWindow(record), selected = selection(record, options), names = actors(record);
  const rawTimeline = Array.isArray(record?.assist?.timeline) ? record.assist.timeline : [];
  const rawSamples = Array.isArray(record?.damage_samples) ? record.damage_samples : [];
  const result = { window, selected, names, casts: [], hits: [], timeline: [], partial: record?.sample_complete !== true || record?.assist?.retention_limited === true || record?.truncated === true || record?.diagnostics?.truncated_encounter === true || (metric(record?.stream_gaps ?? record?.diagnostics?.stream_gaps) ?? 0) > 0 || rawTimeline.length > LIMITS.timeline || rawSamples.length > LIMITS.samples, imported: record?.source === 'imported' || record?.provenance === 'imported-unverified' };
  if (!window || !selected.known) return result;
  const inWindow = time => time !== null && time >= window.start_ms && time <= window.end_ms;
  const included = actor => actor !== null && (!selected.members || selected.members.has(actor));
  const seen = new Set();
  for (const event of rawTimeline.slice(-LIMITS.timeline)) {
    if (!object(event)) { result.partial = true; continue; }
    const at = integer(event.at_ms), actor = identifier(event.actor_id), target = identifier(event.target_id), skill = identifier(event.skill_id), instance = identifier(event.instance_id);
    if (at === null || at > window.end_ms) continue;
    const row = { kind: event.kind, at_ms: at, actor_id: actor, target_id: target, skill_id: skill, instance_id: instance };
    result.timeline.push(row);
    if (!inWindow(at) || event.kind !== 'cast' || !included(actor) || skill === null) continue;
    const key = `${at}:${actor}:${skill}:${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.casts.push({ ...row, elapsed_ms: at - window.start_ms, actor_name: names.get(actor)?.name || `#${actor}`, skill_name: names.get(actor)?.skills.get(skill) || skillLabel(skill) });
  }
  for (const sample of rawSamples.slice(0, LIMITS.samples)) {
    if (!object(sample)) { result.partial = true; continue; }
    const at = integer(sample.timestamp_ms), amount = metric(sample.amount), actor = identifier(sample.player_id ?? sample.source), skill = identifier(sample.skill);
    if (!inWindow(at) || !included(actor)) continue;
    if (amount === null || skill === null || sample.metric && sample.metric !== 'damage') { result.partial = true; continue; }
    result.hits.push({ at_ms: at, amount, actor_id: actor, skill_id: skill, source_id: identifier(sample.source), target_id: identifier(sample.target), tick: sample.tick === true });
  }
  result.casts.sort((a, b) => a.at_ms - b.at_ms || a.actor_id.localeCompare(b.actor_id));
  result.hits.sort((a, b) => a.at_ms - b.at_ms);
  result.timeline.sort((a, b) => a.at_ms - b.at_ms);
  return result;
}

function activity(rows, window, width) {
  if (!window || !rows.length) return 0;
  let end = window.start_ms, total = 0;
  for (const row of rows) {
    const until = Math.min(window.end_ms, row.at_ms + width);
    total += Math.max(0, until - Math.max(end, row.at_ms));
    end = Math.max(end, until);
  }
  return total;
}

const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function encounterInsights(record, options = {}) {
  const data = observedData(record, options), { window, selected, names } = data;
  const width = integer(options.activityWindowMs, 250, 10000) ?? 3000;
  const empty = { available: false, reason: !window ? 'timing-unavailable' : selected.reason, window, scope: selected.scope, partial: data.partial, imported: data.imported, activity_window_ms: width, rotation: [], skills: [], players: [], cast_count: 0, casts_per_minute: null, damage_event_count: 0, tick_event_count: 0, observed_damage: null, cast_activity_ms: null, hit_activity_ms: null, modeled_active_dps: null };
  if (!window || !selected.known) return empty;
  const bySkill = new Map();
  const skillRow = (actor, skill) => {
    const key = `${actor}:${skill}`;
    if (!bySkill.has(key)) bySkill.set(key, { actor_id: actor, actor_name: names.get(actor)?.name || `#${actor}`, skill_id: skill, skill_name: names.get(actor)?.skills.get(skill) || skillLabel(skill), cast_count: 0, damage_event_count: 0, tick_event_count: 0, observed_damage: 0, cast_times_ms: [], hit_times_ms: [] });
    return bySkill.get(key);
  };
  for (const cast of data.casts) { const row = skillRow(cast.actor_id, cast.skill_id); row.cast_count++; row.cast_times_ms.push(cast.at_ms); }
  for (const hit of data.hits) { const row = skillRow(hit.actor_id, hit.skill_id); row.damage_event_count++; row.tick_event_count += Number(hit.tick); row.observed_damage = Math.min(Number.MAX_SAFE_INTEGER, row.observed_damage + hit.amount); row.hit_times_ms.push(hit.at_ms); }
  const skills = [...bySkill.values()].map(row => {
    const gaps = row.cast_times_ms.slice(1).map((at, index) => at - row.cast_times_ms[index]);
    const active = activity(row.hit_times_ms.map(at_ms => ({ at_ms })), window, width);
    return { ...row, cast_interval_median_ms: median(gaps), cast_activity_ms: activity(row.cast_times_ms.map(at_ms => ({ at_ms })), window, width), hit_activity_ms: active, modeled_active_dps: !data.partial && active > 0 ? row.observed_damage * 1000 / active : null };
  }).sort((a, b) => b.observed_damage - a.observed_damage || b.cast_count - a.cast_count || a.skill_id.localeCompare(b.skill_id));
  let previousByActor = new Map();
  const rotation = data.casts.map(cast => { const previous = previousByActor.get(cast.actor_id); previousByActor.set(cast.actor_id, cast.at_ms); return { ...cast, previous_cast_gap_ms: previous === undefined ? null : cast.at_ms - previous }; });
  const hitActivity = activity(data.hits, window, width), amount = sum(data.hits.map(hit => hit.amount));
  const playerIds = new Set([...data.casts, ...data.hits].map(row => row.actor_id));
  const players = [...playerIds].slice(0, LIMITS.players).map(actor => {
    const casts = data.casts.filter(row => row.actor_id === actor), hits = data.hits.filter(row => row.actor_id === actor), active = activity(hits, window, width), damage = sum(hits.map(row => row.amount));
    return { actor_id: actor, actor_name: names.get(actor)?.name || `#${actor}`, cast_count: casts.length, damage_event_count: hits.length, tick_event_count: hits.filter(row => row.tick).length, observed_damage: hits.length ? damage : null, cast_activity_ms: casts.length ? activity(casts, window, width) : null, hit_activity_ms: hits.length ? active : null, modeled_active_dps: !data.partial && active > 0 ? damage * 1000 / active : null };
  });
  return { ...empty, available: data.casts.length > 0 || data.hits.length > 0, reason: data.casts.length || data.hits.length ? null : 'observations-unavailable', rotation, skills, players, cast_count: data.casts.length, casts_per_minute: data.casts.length ? data.casts.length * 60000 / window.duration_ms : null, damage_event_count: data.hits.length, tick_event_count: data.hits.filter(hit => hit.tick).length, observed_damage: data.hits.length ? amount : null, cast_activity_ms: data.casts.length ? activity(data.casts, window, width) : null, hit_activity_ms: data.hits.length ? hitActivity : null, modeled_active_dps: !data.partial && hitActivity > 0 ? amount * 1000 / hitActivity : null };
}

function mergeIntervals(intervals) {
  const merged = [];
  for (const interval of intervals.sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms)) {
    const last = merged.at(-1);
    if (last && interval.start_ms <= last.end_ms) last.end_ms = Math.max(last.end_ms, interval.end_ms);
    else merged.push({ ...interval });
  }
  return merged;
}

export function effectAttribution(record, options = {}) {
  const data = observedData(record, options), { window, selected, names } = data;
  const result = { available: false, window, scope: selected.scope, partial: data.partial, imported: data.imported, rows: [], unresolved_intervals: 0, attribution: 'observed-overlap', additive: false, causal_bonus_damage: null, rdps: null };
  if (!window || !selected.known) return { ...result, reason: !window ? 'timing-unavailable' : selected.reason };
  const included = actor => actor !== null && (!selected.members || selected.members.has(actor));
  const intervals = [], opened = new Map();
  const push = (row, end) => {
    if (row.family === null || row.actor === null || !included(row.recipient)) return;
    const start = Math.max(window.start_ms, row.start), finish = Math.min(window.end_ms, end);
    if (finish > start) intervals.push({ caster_id: row.actor, recipient_id: row.recipient, effect_family_id: row.family, effect_id: row.effect_id ?? null, instance_id: row.instance, start_ms: start, end_ms: finish });
  };
  // Timeline effect IDs are the observed family (wire effect ID divided by 10),
  // while active-effect snapshots retain the full ID. Keep that distinction.
  for (const event of data.timeline) {
    if (!event.kind.startsWith('effect-') || event.instance_id === null || event.target_id === null) continue;
    const key = `${event.target_id}:${event.instance_id}`, previous = opened.get(key);
    if (['effect-applied', 'effect-refreshed'].includes(event.kind)) {
      if (previous && (previous.family !== event.skill_id || previous.actor !== event.actor_id)) { push(previous, event.at_ms); opened.delete(key); }
      if (!opened.has(key) && event.skill_id !== null && event.actor_id !== null) opened.set(key, { actor: event.actor_id, recipient: event.target_id, family: event.skill_id, instance: event.instance_id, start: event.at_ms });
    } else if (['effect-removed', 'effect-expired'].includes(event.kind)) {
      if (previous) { push(previous, event.at_ms); opened.delete(key); }
      else result.unresolved_intervals++;
    }
  }
  const rawEffects = Array.isArray(record?.assist?.effects) ? record.assist.effects : [];
  if (rawEffects.length > LIMITS.effects) result.partial = true;
  for (const effect of rawEffects.slice(0, LIMITS.effects)) {
    if (!object(effect) || effect.source !== 'server-effect') continue;
    const recipient = identifier(effect.recipient_id), actor = identifier(effect.caster_id), instance = identifier(effect.instance_id), fullId = integer(typeof effect.effect_id === 'string' && /^[1-9]\d{0,9}$/.test(effect.effect_id) ? Number(effect.effect_id) : effect.effect_id, 1, 0xffffffff), start = integer(effect.started_ms), expires = integer(effect.expires_ms);
    if (recipient === null || actor === null || instance === null || fullId === null || start === null || !included(recipient) || start > window.end_ms) continue;
    const key = `${recipient}:${instance}`, previous = opened.get(key), family = String(Math.floor(fullId / 10));
    if (effect.persistent !== true && (expires === null || expires < start)) { result.unresolved_intervals++; continue; }
    const end = effect.persistent === true ? window.end_ms : Math.min(window.end_ms, expires);
    // A current snapshot proves its retained start/deadline; its family may not
    // match a preceding instance after an unobserved reuse, so never join those.
    const earliest = previous && previous.family === family && previous.actor === actor ? Math.min(start, previous.start) : start;
    push({ actor, recipient, instance, family, effect_id: fullId, start: earliest }, end);
    if (previous) opened.delete(key);
  }
  // An application with neither a removal/deadline nor an active snapshot does
  // not justify assuming that an effect lasted until the encounter ended.
  result.unresolved_intervals += [...opened.values()].filter(row => included(row.recipient)).length;
  result.partial ||= result.unresolved_intervals > 0;
  const groups = new Map();
  for (const row of intervals) {
    const key = `${row.caster_id}:${row.recipient_id}:${row.effect_family_id}`;
    if (!groups.has(key)) groups.set(key, { caster_id: row.caster_id, caster_name: names.get(row.caster_id)?.name || `#${row.caster_id}`, recipient_id: row.recipient_id, recipient_name: names.get(row.recipient_id)?.name || `#${row.recipient_id}`, effect_family_id: row.effect_family_id, effect_ids: new Set(), intervals: [] });
    const group = groups.get(key); if (row.effect_id !== null) group.effect_ids.add(row.effect_id); group.intervals.push({ start_ms: row.start_ms, end_ms: row.end_ms });
  }
  for (const row of groups.values()) {
    // Ownership credit is not proof that a buff on the owner also affects its
    // summon. Match the actual wire attacker, rather than credited player ID.
    const merged = mergeIntervals(row.intervals), matches = data.hits.filter(hit => hit.source_id === row.recipient_id && merged.some(interval => hit.at_ms >= interval.start_ms && hit.at_ms < interval.end_ms)), bySkill = new Map();
    for (const hit of matches) {
      if (!bySkill.has(hit.skill_id)) bySkill.set(hit.skill_id, { skill_id: hit.skill_id, skill_name: names.get(hit.actor_id)?.skills.get(hit.skill_id) || skillLabel(hit.skill_id), damage_event_count: 0, tick_event_count: 0, observed_damage: 0 });
      const skill = bySkill.get(hit.skill_id); skill.damage_event_count++; skill.tick_event_count += Number(hit.tick); skill.observed_damage = Math.min(Number.MAX_SAFE_INTEGER, skill.observed_damage + hit.amount);
    }
    result.rows.push({ ...row, effect_ids: [...row.effect_ids], intervals: merged, observed_uptime_ms: sum(merged.map(interval => interval.end_ms - interval.start_ms)), uptime_fraction: sum(merged.map(interval => interval.end_ms - interval.start_ms)) / window.duration_ms, damage_event_count: matches.length, observed_damage: sum(matches.map(hit => hit.amount)), skills: [...bySkill.values()].sort((a, b) => b.observed_damage - a.observed_damage) });
  }
  result.rows.sort((a, b) => b.observed_damage - a.observed_damage || b.observed_uptime_ms - a.observed_uptime_ms);
  result.available = result.rows.length > 0;
  return { ...result, reason: result.available ? null : 'effect-intervals-unavailable' };
}

export function bossProjection(record, { targetId = null, now = Date.now(), windowMs = 15000, freshnessMs = 5000 } = {}) {
  const clock = integer(now), span = integer(windowMs, 3000, 60000) ?? 15000, freshness = integer(freshnessMs, 250, 5000) ?? 5000;
  const targets = list(record?.targets, 100).filter(target => target?.is_boss === true && identifier(target.id) !== null);
  const target = targetId === null ? targets.length === 1 ? targets[0] : null : targets.find(row => identifier(row.id) === identifier(targetId));
  const result = { available: false, reason: 'target-unavailable', target_id: identifier(target?.id), target_name: text(target?.name), sample_count: 0, observed_span_ms: 0, remaining_ms: null, range_ms: null, hp_per_second: null, current_hp: null, projected_at_ms: clock, method: 'observed-hp-trend', confidence: null, berserk_ms: null, partial: record?.assist?.retention_limited === true || record?.truncated === true || (metric(record?.stream_gaps ?? record?.diagnostics?.stream_gaps) ?? 0) > 0, imported: record?.source === 'imported' || record?.provenance === 'imported-unverified' };
  if (!target || clock === null || record?.timing_valid === false) return result;
  if (record?.paused === true || result.partial) return { ...result, reason: record?.paused === true ? 'paused' : 'capture-incomplete' };
  const raw = Array.isArray(record?.assist?.health_history) ? record.assist.health_history : [];
  if (raw.length > LIMITS.health) return { ...result, reason: 'retention-limited', partial: true };
  const window = insightWindow(record), candidates = [];
  for (const input of raw) {
    if (!object(input) || identifier(input.actor_id) !== result.target_id) continue;
    const at = integer(input.observed_at_ms), current = integer(input.current_hp), maximum = input.reported_max_hp === null || input.reported_max_hp === undefined ? null : integer(input.reported_max_hp, 1);
    if (at === null || current === null || at > clock || at < clock - span || window && (at < window.start_ms || at > window.end_ms) || maximum !== null && current > maximum || input.source !== undefined && input.source !== 'server' && input.source !== 'server-health') continue;
    candidates.push({ at_ms: at, hp: current, maximum });
  }
  candidates.sort((a, b) => a.at_ms - b.at_ms);
  const samples = [];
  for (const sample of candidates) {
    if (samples.at(-1)?.at_ms === sample.at_ms) {
      if (samples.at(-1).hp !== sample.hp) return { ...result, reason: 'conflicting-health' };
      continue;
    }
    samples.push(sample);
  }
  const first = samples[0], last = samples.at(-1);
  if (!last) return { ...result, reason: 'health-history-unavailable' };
  const shared = { ...result, sample_count: samples.length, current_hp: last.hp, observed_span_ms: last.at_ms - first.at_ms };
  if (clock - last.at_ms > freshness) return { ...shared, reason: 'stale' };
  if (last.hp === 0) return { ...shared, available: true, reason: 'received-zero-hp', remaining_ms: 0, range_ms: [0, 0], hp_per_second: null };
  if (samples.length < 4 || shared.observed_span_ms < 3000) return { ...shared, reason: 'insufficient-trend' };
  const maximums = new Set(samples.map(sample => sample.maximum).filter(value => value !== null));
  if (maximums.size > 1) return { ...shared, reason: 'maximum-changed' };
  const segments = [];
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1], sample = samples[index], elapsed = sample.at_ms - previous.at_ms;
    if (elapsed > 5000) return { ...shared, reason: 'observation-gap' };
    if (sample.hp > previous.hp) return { ...shared, reason: 'healing-or-reset' };
    segments.push((previous.hp - sample.hp) * 1000 / elapsed);
  }
  if (first.hp <= last.hp || segments.filter(value => value > 0).length < 3) return { ...shared, reason: 'insufficient-damage-trend' };
  // Use measured endpoints for the central slope. The displayed range is a
  // recent-rate envelope, not a statistical confidence interval or kill promise.
  const rate = (first.hp - last.hp) * 1000 / shared.observed_span_ms, positive = segments.filter(value => value > 0).sort((a, b) => a - b);
  const lowRate = positive[0], highRate = positive.at(-1);
  if (!(rate > 0) || highRate / lowRate > 4 || segments.includes(0)) return { ...shared, reason: 'unstable-trend' };
  const remaining = last.hp * 1000 / rate, low = last.hp * 1000 / highRate, high = last.hp * 1000 / lowRate;
  if (![remaining, low, high].every(value => Number.isFinite(value) && value >= 0 && value <= 3600000)) return { ...shared, reason: 'projection-out-of-range' };
  return { ...shared, available: true, reason: null, remaining_ms: Math.round(remaining), range_ms: [Math.round(low), Math.round(high)], hp_per_second: rate };
}

const labels = {
  en: { title: 'Rotation and activity', casts: 'Received casts', damage: 'Observed damage', active: 'Hit-window DPS', window: 'wall-time window', rule: 'Activity uses the union of a stated window after each retained hit. Hit-window DPS is a local model; ticks are damage events, never casts.', partial: 'Partial observations: activity DPS is unavailable.', no: 'No supported observations in this scope.', missingCasts: 'Cast packets are unavailable; hits do not establish a rotation.', rotation: 'Received cast sequence', skills: 'Skill observations', cast: 'Casts', hits: 'Damage events', ticks: 'Ticks', overlap: 'Effect overlap by skill', overlapHelp: 'Damage observed while a received effect interval overlaps the attacker. Effects are not classified as buffs/debuffs; these amounts are non-additive and do not measure causal bonus damage or rDPS.', interval: 'Observed interval', projection: 'Boss HP trend', projectionHelp: 'Projection uses fresh, falling received HP. The range reflects recent rates and can change; it is not a berserk timer.', unavailable: 'Waiting for a sufficient fresh HP trend', receivedZero: 'Received HP: 0', estimated: 'Projected remaining', range: 'Recent-rate range', sample: 'samples', unverified: 'Imported · unverified' },
  tr: { title: 'Rotasyon ve etkinlik', casts: 'Alınan kullanımlar', damage: 'Gözlenen hasar', active: 'Vuruş penceresi DPS', window: 'gerçek zaman aralığı', rule: 'Etkinlik, kaydedilen her vuruştan sonraki belirtilen pencerenin birleşimidir. Vuruş penceresi DPS yerel bir modeldir; tick, yetenek kullanımı sayılmaz.', partial: 'Gözlemler eksik: etkinlik DPS hesaplanmıyor.', no: 'Bu kapsamda desteklenen gözlem yok.', missingCasts: 'Kullanım paketleri yok; vuruşlardan rotasyon çıkarılmaz.', rotation: 'Alınan kullanım sırası', skills: 'Yetenek gözlemleri', cast: 'Kullanım', hits: 'Hasar olayı', ticks: 'Tick', overlap: 'Yeteneklere göre etki örtüşmesi', overlapHelp: 'Saldırganın alınan etki aralığına denk gelen hasarıdır. Etkiler buff/debuff diye sınıflandırılmaz; tutarlar toplanamaz ve nedensel ek hasar veya rDPS değildir.', interval: 'Gözlenen aralık', projection: 'Boss HP eğilimi', projectionHelp: 'Tahmin, güncel ve düşen alınan HP’ye dayanır. Aralık son hızları gösterir ve değişebilir; öfke zamanlayıcısı değildir.', unavailable: 'Yeterli ve güncel HP eğilimi bekleniyor', receivedZero: 'Alınan HP: 0', estimated: 'Tahmini kalan', range: 'Son hızlara göre aralık', sample: 'örnek', unverified: 'İçe aktarılmış · doğrulanmamış' },
};
const localeLabels = locale => labels[locale === 'en' ? 'en' : 'tr'];
const number = (value, locale, digits = 1) => value === null || value === undefined ? '—' : new Intl.NumberFormat(locale === 'en' ? 'en' : 'tr', { maximumFractionDigits: digits }).format(value);
const seconds = (value, locale) => value === null ? '—' : `${number(value / 1000, locale)} s`;

export function renderCombatInsights(record, options = {}) {
  const value = encounterInsights(record, options), l = localeLabels(options.locale), n = value => number(value, options.locale);
  const header = `<div class="record-top"><h3>${l.title}</h3>${value.imported ? `<span class="tag">${l.unverified}</span>` : ''}</div>`;
  if (!value.available) return `<section class="combat-insights">${header}<p class="help">${l.no}</p></section>`;
  const rotation = value.rotation.slice(-80);
  const rows = value.skills.slice(0, 50);
  return `<section class="combat-insights">${header}<p class="help">${seconds(value.window.duration_ms, options.locale)} ${l.window} · ${seconds(value.activity_window_ms, options.locale)} ${options.locale === 'en' ? 'activity window' : 'etkinlik penceresi'}</p><div class="analysis-metrics"><div><span>${l.casts}</span><strong>${value.cast_count || '—'}</strong></div><div><span>${l.damage}</span><strong>${n(value.observed_damage)}</strong></div><div><span>${l.active}</span><strong>${n(value.modeled_active_dps)}</strong></div></div><p class="help">${l.rule}</p>${value.partial ? `<p class="quality-warning">${l.partial}</p>` : ''}<details data-state-key="rotation-casts"><summary>${l.rotation} (${value.cast_count})</summary>${rotation.length ? `<div class="table-wrap"><table><thead><tr><th>s</th><th>${options.locale === 'en' ? 'Player' : 'Oyuncu'}</th><th>${options.locale === 'en' ? 'Skill' : 'Yetenek'}</th></tr></thead><tbody>${rotation.map(row => `<tr><td>${n(row.elapsed_ms / 1000)}</td><td>${esc(row.actor_name)}</td><td>${esc(row.skill_name)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="help">${l.missingCasts}</p>`}</details><details data-state-key="rotation-skills"><summary>${l.skills}</summary><div class="table-wrap"><table><thead><tr><th>${options.locale === 'en' ? 'Skill' : 'Yetenek'}</th><th>${l.cast}</th><th>${l.hits}</th><th>${l.ticks}</th><th>${l.active}</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.skill_name)}<small>${esc(row.actor_name)}</small></td><td>${row.cast_count || '—'}</td><td>${n(row.damage_event_count)}</td><td>${n(row.tick_event_count)}</td><td>${n(row.modeled_active_dps)}</td></tr>`).join('')}</tbody></table></div></details></section>`;
}

export function renderEffectAttribution(record, options = {}) {
  const value = effectAttribution(record, options), l = localeLabels(options.locale), n = value => number(value, options.locale);
  return `<section class="effect-attribution"><h3>${l.overlap}</h3><p class="help">${l.overlapHelp}</p>${value.available ? value.rows.slice(0, 40).map(row => `<details data-state-key="effect-${esc(row.recipient_id)}-${esc(row.effect_family_id)}"><summary>#${esc(row.effect_family_id)} · ${esc(row.recipient_name)} · ${n(row.observed_damage)}</summary><p class="help">${esc(row.caster_name)} → ${esc(row.recipient_name)} · ${l.interval}: ${seconds(row.observed_uptime_ms, options.locale)}</p><div class="table-wrap"><table><thead><tr><th>${options.locale === 'en' ? 'Skill' : 'Yetenek'}</th><th>${l.hits}</th><th>${l.damage}</th></tr></thead><tbody>${row.skills.slice(0, 30).map(skill => `<tr><td>${esc(skill.skill_name)}</td><td>${n(skill.damage_event_count)}</td><td>${n(skill.observed_damage)}</td></tr>`).join('')}</tbody></table></div></details>`).join('') : `<p class="help">${l.no}</p>`}${value.partial ? `<p class="quality-warning">${options.locale === 'en' ? 'Intervals or damage observations are incomplete.' : 'Etki aralıkları veya hasar gözlemleri eksik.'}</p>` : ''}</section>`;
}

export function renderBossProjection(record, options = {}) {
  const value = bossProjection(record, options), l = localeLabels(options.locale);
  return `<section class="boss-projection"><div class="record-top"><h3>${l.projection}${value.target_name ? ` · ${esc(value.target_name)}` : ''}</h3>${value.imported ? `<span class="tag">${l.unverified}</span>` : ''}</div>${value.available ? `<div class="analysis-metrics"><div><span>${l.estimated}</span><strong>${value.remaining_ms === 0 ? l.receivedZero : seconds(value.remaining_ms, options.locale)}</strong></div><div><span>${l.range}</span><strong>${seconds(value.range_ms[0], options.locale)} – ${seconds(value.range_ms[1], options.locale)}</strong></div></div>` : `<p class="help">${l.unavailable}</p>`}<p class="help">${l.projectionHelp} · ${value.sample_count} ${l.sample}</p></section>`;
}
