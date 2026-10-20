import { compactNumber, formatRate } from './model.mjs';

const text = (value, size) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, size) : '';
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function recordObservation(value) {
  if (!value || !['hit', 'boss-dps'].includes(value.metric)) return null;
  const name = text(value.name, 80), server = integer(value.server_id), amount = integer(value.amount), at = integer(value.at_ms), elapsed = integer(value.elapsed_ms);
  if (!name || /^#|^unknown$/i.test(name) || server < 1000 || server >= 3000 || !amount || !at || at > 8640000000000000) return null;
  if (value.metric === 'boss-dps' && (!(elapsed >= 10000 && elapsed <= 21600000) || !integer(value.map_id) || !integer(value.target_npc_id) || !integer(value.boss_max_hp))) return null;
  return { name, server_id: server, class_name: text(value.class_name, 32), actor_id: integer(value.actor_id), is_local: value.is_local === true,
    metric: value.metric, amount, at_ms: at, elapsed_ms: value.metric === 'boss-dps' ? elapsed : null,
    skill_id: integer(value.skill_id), critical: value.critical === true, tick: value.tick === true,
    target_name: text(value.target_name, 100), target_npc_id: integer(value.target_npc_id), map_id: integer(value.map_id), boss_max_hp: integer(value.boss_max_hp) };
}

export function recordValue(row) { return row.metric === 'boss-dps' ? row.amount * 1000 / row.elapsed_ms : row.amount; }
export function recordKey(row) { return JSON.stringify([row.name, row.server_id, row.class_name, row.metric, ...(row.metric === 'hit' ? [] : [row.target_npc_id, row.map_id, row.boss_max_hp])]); }

export function recordSnapshot(value = {}) {
  const records = (Array.isArray(value.records) ? value.records : []).slice(0, 512).map(row => {
    const best = recordObservation(row?.best), previous = recordObservation(row?.previous);
    return best ? { best, previous: previous && recordKey(best) === recordKey(previous) && recordValue(best) > recordValue(previous) ? previous : null } : null;
  }).filter(Boolean);
  const keys = new Set();
  return { revision: integer(value.revision) ?? 0, records: records.filter(row => !keys.has(recordKey(row.best)) && keys.add(recordKey(row.best))), storage_error: text(value.storage_error, 200) };
}

export function recordStatus(value = {}) {
  return { revision: integer(value.revision) ?? 0, count: integer(value.count) ?? 0, storage_error: text(value.storage_error, 200),
    notices: (Array.isArray(value.notices) ? value.notices : []).slice(0, 8).map(row => {
      const best = recordObservation(row?.best), previous = recordObservation(row?.previous), sequence = integer(row?.sequence);
      return best && previous && sequence && recordKey(best) === recordKey(previous) && recordValue(best) > recordValue(previous) ? { best, previous, sequence } : null;
    }).filter(Boolean) };
}

// One quiet card at a time. Updates never extend its lifetime; startup records
// and disabled/hidden modules cannot replay stale notifications later.
export function createRecordNotifier() {
  let seen = 0, current = null, until = 0, next = 0;
  return {
    update(status, { now = Date.now(), mode = 'party', visible = true } = {}) {
      const incoming = recordStatus(status).notices;
      const candidates = incoming.filter(row => row.sequence > seen && row.best.at_ms <= now && now - row.best.at_ms <= 6000
        && (mode === 'party' || mode === 'self' && row.best.is_local)).sort((a, b) => Number(b.best.is_local) - Number(a.best.is_local) || b.sequence - a.sequence);
      seen = Math.max(seen, ...incoming.map(row => row.sequence));
      if (!visible || mode === 'off') { current = null; return null; }
      if (now >= until) current = null;
      if (current) {
        const newer = candidates.find(row => recordKey(row.best) === recordKey(current.best));
        if (newer) current = { ...newer, previous: current.previous };
      } else if (candidates.length && now >= next) {
        current = candidates[0]; until = now + 4200; next = now + 6500;
      }
      return current;
    },
    dismiss() { current = null; },
  };
}

export function recordPresentation(notice, { locale = 'tr', hideNames = false, precision = 2 } = {}) {
  const tr = locale === 'tr', row = notice.best, previous = notice.previous;
  const amount = value => value.metric === 'boss-dps' ? formatRate(recordValue(value), locale, precision) : compactNumber(value.amount, locale, precision);
  return { title: tr ? 'Yeni kişisel rekor' : 'New personal best',
    name: hideNames ? row.is_local ? (tr ? 'Sen' : 'You') : (tr ? 'Takım arkadaşı' : 'Party member') : row.name,
    label: row.metric === 'boss-dps' ? (tr ? 'Boss DPS · tamamlanan deneme' : 'Boss DPS · finished encounter') : (tr ? 'En yüksek tek vuruş' : 'Highest single hit'),
    value: amount(row), previous: previous ? amount(previous) : '—',
    gain: previous ? `+${((recordValue(row) / recordValue(previous) - 1) * 100).toFixed(1)}%` : '',
    detail: row.metric === 'boss-dps' ? row.target_name || (tr ? 'Boss' : 'Boss') : [row.critical ? (tr ? 'Kritik' : 'Critical') : '', row.tick ? (tr ? 'Periyodik vuruş' : 'Periodic tick') : '', row.target_name].filter(Boolean).join(' · ') };
}

export function renderRecords(snapshot, { locale = 'tr', hideNames = false, precision = 2, metric = 'all', query = '' } = {}) {
  const tr = locale === 'tr', data = recordSnapshot(snapshot), q = query.trim().toLocaleLowerCase(locale);
  const rows = data.records.filter(row => (metric === 'all' || row.best.metric === metric) && (!q || `${hideNames ? '' : row.best.name} ${row.best.class_name} ${row.best.target_name}`.toLocaleLowerCase(locale).includes(q))).sort((a, b) => b.best.at_ms - a.best.at_ms);
  return `<section class="personal-records"><h3>${tr ? 'Kişisel rekorlar' : 'Personal bests'}</h3><p class="help">${tr ? 'Kendi ve takımının rekorları otomatik kaydedilir; bu bilgisayarda saklanır.' : 'Your records and confirmed party members’ records are saved automatically on this computer.'}</p>
    <div class="field-grid"><label class="field"><span>${tr ? 'Rekor türü' : 'Record type'}</span><select name="recordMetric">${[['all', tr ? 'Tümü' : 'All'], ['hit', tr ? 'Tek vuruş' : 'Single hit'], ['boss-dps', 'Boss DPS']].map(([id, label]) => `<option value="${id}" ${metric === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field"><span>${tr ? 'Karakter veya boss ara' : 'Find character or boss'}</span><input name="recordQuery" value="${esc(query)}" maxlength="100" type="search"></label></div>
    ${data.storage_error ? `<p class="notice-error">${tr ? 'Rekor dosyası kaydedilemedi veya okunamadı. Bu oturumdaki kayıtlar bellekte tutuluyor.' : 'The record file could not be saved or read. Current-session records remain in memory.'}</p>` : ''}
    <details class="appearance-details"><summary>${tr ? 'Nasıl karşılaştırılır?' : 'How are records compared?'}</summary><p class="help">${tr ? 'İlk skor başlangıçtır; yalnız daha yüksek değer rekor sayılır. Boss DPS yalnız tamamlanan, eksiksiz alınan en az 10 saniyelik tek boss denemelerini karşılaştırır. Karakter, sınıf, sunucu, harita, boss kimliği ve bildirilen azami can aynı olmalı. Zorluk veya öldürme doğrulaması sayılmaz.' : 'The first score is the baseline; only a higher value beats it. Boss DPS compares finished, fully captured single-boss encounters of at least 10 seconds. Character, class, server, map, boss ID and reported maximum HP must match. This does not verify difficulty or a kill.'}</p></details>
    <div class="record-grid">${rows.map(row => { const view = recordPresentation(row, { locale, hideNames, precision }); return `<article class="personal-record"><div class="personal-record-top"><strong>${esc(view.name)}</strong><span class="tag">${esc(row.best.class_name)}</span></div><span class="personal-record-label">${esc(view.label)}</span><b class="personal-record-value">${esc(view.value)}</b><small>${row.previous ? `${esc(view.previous)} → ${esc(view.value)} <span>${esc(view.gain)}</span>` : tr ? 'İlk kayıt' : 'First record'}</small><p>${esc(view.detail)}</p><time datetime="${new Date(row.best.at_ms).toISOString()}">${esc(new Date(row.best.at_ms).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-GB'))}</time></article>`; }).join('') || `<p class="empty">${tr ? 'Henüz uygun rekor yok. İsim ve sunucu oyundan alındığında gerçek vuruşlar otomatik kaydedilir.' : 'No eligible records yet. Received hits are saved automatically once the game supplies name and server.'}</p>`}</div></section>`;
}
