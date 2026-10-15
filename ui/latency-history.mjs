const SOURCE = 'windows-tcp-estats';
export const LATENCY_HISTORY_LIMIT = 600;
const MAX_RTT = 120000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, low = 0, high = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= low && value <= high ? value : null;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function encounterWindow(record) {
  if (!object(record)) return null;
  const start = integer(record.started_ms);
  if (start === null) return null;
  let end = integer(record.ended_ms);
  if (record.ended_ms === undefined || record.ended_ms === null || record.ended_ms === 0 && start > 0) {
    const elapsed = integer(record.elapsed_ms);
    end = elapsed === null ? null : integer(start + elapsed);
  }
  return end !== null && end >= start ? { start, end } : null;
}

function emptySnapshot(window) {
  return { source: SOURCE, samples: [], sample_count: 0, window_ms: window ? window.end - window.start : 0, observed_span_ms: 0, partial: true, truncated: false, minimum_ms: null, maximum_ms: null, average_ms: null, median_ms: null, p95_ms: null };
}

/**
 * Rebuild an allowlisted snapshot from retained observations. Imported summary
 * fields are not evidence and never participate in the resulting statistics.
 * Relative, anonymized record times are supported, including timestamp zero.
 */
export function normalizeLatencyHistory(value, record = {}, { now = Date.now() } = {}) {
  const window = encounterWindow(record), clock = integer(now);
  if (!object(value) || value.source !== SOURCE || !window || clock === null || !Array.isArray(value.samples)) return null;
  const result = emptySnapshot(window), raw = value.samples.slice(-LATENCY_HISTORY_LIMIT), candidates = [];
  let rejected = false;
  for (const input of raw) {
    if (!object(input)) { rejected = true; continue; }
    const timestamp = integer(input.observed_at_ms), rtt = integer(input.rtt_ms, 0, MAX_RTT), connections = integer(input.measured_connections, 1, 128);
    const latest = input.latest_rtt_ms === undefined || input.latest_rtt_ms === null ? null : integer(input.latest_rtt_ms, 0, MAX_RTT);
    const variation = input.variation_ms === undefined || input.variation_ms === null ? null : integer(input.variation_ms, 0, MAX_RTT);
    if (timestamp === null || timestamp < window.start || timestamp > window.end || timestamp > clock || rtt === null || connections === null
      || input.latest_rtt_ms !== undefined && input.latest_rtt_ms !== null && latest === null
      || input.variation_ms !== undefined && input.variation_ms !== null && variation === null) { rejected = true; continue; }
    candidates.push({ observed_at_ms: timestamp, rtt_ms: rtt, latest_rtt_ms: latest, variation_ms: variation, measured_connections: connections });
  }
  candidates.sort((a, b) => a.observed_at_ms - b.observed_at_ms);
  for (const sample of candidates) {
    const previous = result.samples.at(-1);
    // Native collection retains at most one observation per second. Repeated
    // held counters or dense imported duplicates cannot overweight a statistic.
    if (previous && sample.observed_at_ms - previous.observed_at_ms < 1000) { rejected = true; continue; }
    result.samples.push(sample);
  }
  result.sample_count = result.samples.length;
  result.truncated = value.truncated === true || value.samples.length > LATENCY_HISTORY_LIMIT;
  const first = result.samples[0], last = result.samples.at(-1);
  if (!first || !last) return { ...result, partial: true };
  result.observed_span_ms = last.observed_at_ms - first.observed_at_ms;
  result.partial = value.partial === true || result.truncated || rejected
    || first.observed_at_ms - window.start > 5000 || window.end - last.observed_at_ms > 5000
    || result.sample_count === 1 && result.window_ms > 5000
    || result.samples.some((sample, index) => index > 0 && sample.observed_at_ms - result.samples[index - 1].observed_at_ms > 10000);
  const values = result.samples.map(sample => sample.rtt_ms).sort((a, b) => a - b), middle = Math.floor(values.length / 2);
  result.minimum_ms = values[0]; result.maximum_ms = values.at(-1);
  result.average_ms = values.reduce((sum, value) => sum + value, 0) / values.length;
  result.median_ms = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  result.p95_ms = values[Math.max(0, Math.ceil(values.length * .95) - 1)];
  return result;
}

function scopedWindow(record, scope, general) {
  if (!general || !['personal', 'party'].includes(scope)) return null;
  if (scope === 'personal') {
    if (!['server', 'manual', 'name-match'].includes(record.local_identity_source) || record.local_player_id === null || record.local_player_id === undefined || String(record.local_player_id) === '') return null;
  } else if (!['server', 'manual'].includes(record.party_membership_source)) return null;
  const start = integer(record[`${scope}_started_ms`]), elapsed = integer(record[`${scope}_elapsed_ms`], 1);
  if (start === null || elapsed === null || record.timing_valid === false || record.paused === true || integer(record.paused_ms, 1) !== null) return null;
  const end = integer(start + elapsed);
  if (end === null || start < general.start || end > general.end) return null;
  const actors = scope === 'personal' ? new Set([String(record.local_player_id)]) : new Set((Array.isArray(record.party_member_ids) ? record.party_member_ids : []).slice(0, 100).map(String));
  const samples = Array.isArray(record.damage_samples) ? record.damage_samples : [];
  if (samples.length > 5000 || samples.some(sample => actors.has(String(sample?.player_id ?? sample?.source)) && integer(sample?.timestamp_ms) !== null && (sample.timestamp_ms < start || sample.timestamp_ms > end))) return null;
  return { start, end };
}

export function latencyHistory(record, { scope = 'observed', now = Date.now() } = {}) {
  const requested = ['personal', 'party', 'observed'].includes(scope) ? scope : 'observed';
  const general = encounterWindow(record), base = normalizeLatencyHistory(record?.network_latency, record, { now });
  const unavailable = { ...emptySnapshot(general), source: null, available: false, requested_scope: requested, scope: 'observed', scope_trimmed: false, started_ms: general?.start ?? null, ended_ms: general?.end ?? null };
  if (!base || !general) return unavailable;
  const selected = scopedWindow(record, requested, general);
  if (!selected) return { ...base, available: base.sample_count > 0, requested_scope: requested, scope: 'observed', scope_trimmed: false, started_ms: general.start, ended_ms: general.end };
  const samples = base.samples.filter(sample => sample.observed_at_ms >= selected.start && sample.observed_at_ms <= selected.end);
  const trimmed = normalizeLatencyHistory({ ...base, samples }, { started_ms: selected.start, ended_ms: selected.end }, { now });
  return { ...trimmed, available: trimmed.sample_count > 0, requested_scope: requested, scope: requested, scope_trimmed: selected.start !== general.start || selected.end !== general.end, started_ms: selected.start, ended_ms: selected.end };
}

function curve(samples, start, end) {
  const width = 480, height = 100, inset = 6, scale = Math.max(1, ...samples.map(sample => sample.rtt_ms));
  const point = sample => ({ x: end > start ? inset + (sample.observed_at_ms - start) / (end - start) * (width - inset * 2) : width / 2, y: height - inset - sample.rtt_ms / scale * (height - inset * 2) });
  const path = samples.map((sample, index) => { const position = point(sample), previous = samples[index - 1]; return `${index && sample.observed_at_ms - previous.observed_at_ms <= 10000 ? 'L' : 'M'}${position.x.toFixed(2)},${position.y.toFixed(2)}`; }).join(' ');
  const dots = samples.length === 1 ? (() => { const position = point(samples[0]); return `<circle cx="${position.x.toFixed(2)}" cy="${position.y.toFixed(2)}" r="3" fill="var(--accent)"/>`; })() : '';
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Windows TCP RTT" style="display:block;width:100%;height:100px;overflow:visible"><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${dots}</svg>`;
}

export function renderLatencyHistory(record, { locale = 'tr', scope = 'observed', now = Date.now() } = {}) {
  const value = latencyHistory(record, { scope, now }), en = locale === 'en', language = en ? 'en-US' : 'tr-TR';
  const labels = en ? { title: 'Encounter connection RTT', average: 'Average', minimum: 'Minimum', maximum: 'Maximum', empty: 'This record has no valid RTT observations.', help: 'Passive Windows TCP RTT for the game connection set during this interval.', partial: 'Observations cover only part of the interval.', truncated: 'The sample retention limit was reached; this is not a complete history.', personal: 'Time window of the personal measurement', party: 'Time window of the party measurement', observed: 'Encounter time window', samples: 'samples', window: 'window', span: 'observed span', seconds: 's' }
    : { title: 'Karşılaşma bağlantı RTT’si', average: 'Ortalama', minimum: 'En az', maximum: 'En çok', empty: 'Bu kayıtta geçerli RTT örneği yok.', help: 'Bu zaman aralığındaki oyun bağlantıları için Windows TCP RTT ölçümü.', partial: 'Örnekler zaman aralığının yalnız bir bölümünü kapsıyor.', truncated: 'Örnek saklama sınırına ulaşıldı; tam geçmiş gösterilmiyor.', personal: 'Kişisel ölçümün zaman aralığı', party: 'Parti ölçümünün zaman aralığı', observed: 'Karşılaşmanın zaman aralığı', samples: 'örnek', window: 'pencere', span: 'gözlenen aralık', seconds: 'sn' };
  const number = input => Number(input).toLocaleString(language, { maximumFractionDigits: 1 });
  const intro = `<section class="latency-history"><div class="record-top"><h3 class="section-title">${escapeHtml(labels.title)}</h3><span class="tag">Windows TCP RTT</span></div><p class="help">${escapeHtml(labels.help)}</p>`;
  if (!value.available) return `${intro}<p class="help">${escapeHtml(labels.empty)}</p></section>`;
  const cards = [[labels.average, value.average_ms], [labels.minimum, value.minimum_ms], [labels.maximum, value.maximum_ms], ['P95', value.p95_ms]].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(number(value))} ms</strong></div>`).join('');
  return `${intro}<p class="help">${escapeHtml(labels[value.scope])} · ${value.sample_count} ${escapeHtml(labels.samples)} · ${escapeHtml(number(value.window_ms / 1000))} ${escapeHtml(labels.seconds)} ${escapeHtml(labels.window)} · ${escapeHtml(number(value.observed_span_ms / 1000))} ${escapeHtml(labels.seconds)} ${escapeHtml(labels.span)}</p><div class="analysis-metrics">${cards}</div><div class="record-card">${curve(value.samples, value.started_ms, value.ended_ms)}</div>${value.partial || value.truncated ? `<p class="quality-warning" role="status">${escapeHtml([value.partial ? labels.partial : '', value.truncated ? labels.truncated : ''].filter(Boolean).join(' '))}</p>` : ''}</section>`;
}
