// Runs require received instance identity. Time adjacency alone only produces a
// local session grouping and never verifies a dungeon, completion or clear.
import { scopedEncounter } from './scope.mjs';
import { insightWindow } from './combat-insights.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, low = 0, high = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= low && value <= high ? value : null;
const id = value => typeof value === 'string' && /^[\w:-]{1,80}$/u.test(value) ? value : integer(value) !== null ? String(value) : null;
const text = value => typeof value === 'string' ? value.slice(0, 100).replace(/[\u0000-\u001f]/gu, '') : '';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const add = (a, b) => Math.min(Number.MAX_SAFE_INTEGER, a + b);

export function runContext(record) {
  const context = object(record?.context) ? record.context : null;
  if (!context || !['server', 'server-zone'].includes(context.source)) return null;
  const map = id(context.map_id), instance = id(context.instance_id), session = id(context.session_id);
  if (map === null && instance === null) return null;
  // An instance ID without a session discriminator can be reused after login.
  // Its observed label can still be shown, but it cannot establish a full run.
  const kind = context.source === 'server' && context.instance_kind === 'dungeon' && instance !== null && session !== null ? 'dungeon' : 'map-session';
  return { source: 'server', kind, map_id: map, instance_id: instance, session_id: session, name: text(context.instance_name || context.map_name), difficulty: text(context.difficulty), grouping_key: `${session ?? '?'}:${map ?? '?'}:${instance ?? '?'}:${kind}` };
}

function origin(record) {
  return record?.source === 'imported' || record?.provenance === 'imported-unverified' ? 'imported' : record?.source === 'demo' || record?.provenance === 'demo' ? 'demo' : record?.source === 'captured' || record?.provenance === 'received' ? 'captured' : 'unknown';
}

function character(record) {
  if (!['server', 'manual', 'name-match', 'name'].includes(record?.local_identity_source)) return null;
  const name = text(record.local_player_name || record.players?.find(player => id(player?.id) === id(record.local_player_id))?.name);
  const server = id(record.character_build?.server_id);
  return name ? `${server ?? '?'}:${name.normalize('NFKC').toLocaleLowerCase('en')}` : null;
}

function mergedDuration(intervals) {
  let total = 0, end = -1;
  for (const window of intervals.sort((a, b) => a.start_ms - b.start_ms)) {
    total += Math.max(0, window.end_ms - Math.max(window.start_ms, end));
    end = Math.max(end, window.end_ms);
  }
  return total;
}

export function groupEncounterRuns(records, { scope = 'personal', gapMs = 600000 } = {}) {
  const gap = integer(gapMs, 0, 3600000) ?? 600000, selectedScope = ['personal', 'party', 'observed'].includes(scope) ? scope : 'personal';
  const raw = Array.isArray(records) ? records : [], rows = raw.slice(0, 200).filter(object).map((record, index) => ({ record, index, window: insightWindow(record), context: runContext(record), source: origin(record), character: character(record) }));
  rows.sort((a, b) => (a.window?.start_ms ?? Infinity) - (b.window?.start_ms ?? Infinity) || a.index - b.index);
  const groups = [];
  for (const row of rows) {
    const last = groups.at(-1), isolated = !row.window || row.source === 'imported' || row.source === 'unknown' || row.character === null;
    const contextKey = row.context?.grouping_key ?? 'unknown-context';
    const sameSession = !isolated && last && !last.isolated && last.source === row.source && last.character_key === row.character && last.context_key === contextKey && row.window.start_ms <= last.ended_ms + gap;
    let group = last;
    if (!sameSession) {
      group = { id: `session:${row.index}:${id(row.record.id) ?? '?'}`, kind: row.source === 'imported' ? 'imported-encounter' : row.context?.kind ?? 'session', source: row.source, context: row.context, context_key: contextKey, character_key: row.character, isolated, started_ms: row.window?.start_ms ?? null, ended_ms: row.window?.end_ms ?? null, records: [], encounter_count: 0, boss_encounter_count: 0, unique_boss_names: [], partial: false, damage: 0, dps: null, combat_ms: 0, wall_ms: null, idle_ms: null, scope: selectedScope, scope_known: true, completion: 'unknown', verified_dungeon: row.source === 'captured' && row.context?.kind === 'dungeon' };
      groups.push(group);
    }
    const scoped = scopedEncounter(row.record, selectedScope), amount = typeof scoped.damage === 'number' && Number.isFinite(scoped.damage) && scoped.damage >= 0 ? scoped.damage : null;
    group.records.push({ index: row.index, id: id(row.record.id), name: text(row.record.name), started_ms: row.window?.start_ms ?? null, ended_ms: row.window?.end_ms ?? null, scoped_damage: scoped.known ? amount : null });
    group.encounter_count++;
    const bosses = (Array.isArray(row.record.targets) ? row.record.targets : []).slice(0, 100).filter(target => target?.is_boss === true);
    if (bosses.length) group.boss_encounter_count++;
    for (const target of bosses) {
      const name = text(target.name) || `#${id(target.id) ?? '?'}`;
      if (!group.unique_boss_names.includes(name) && group.unique_boss_names.length < 100) group.unique_boss_names.push(name);
    }
    if (!scoped.known || amount === null) { group.scope_known = false; group.damage = null; }
    else if (group.damage !== null) group.damage = add(group.damage, amount);
    if (row.window) { group.started_ms = Math.min(group.started_ms ?? row.window.start_ms, row.window.start_ms); group.ended_ms = Math.max(group.ended_ms ?? row.window.end_ms, row.window.end_ms); }
    group.partial ||= row.record.sample_complete !== true || row.record.truncated === true || (row.record.stream_gaps ?? row.record.diagnostics?.stream_gaps ?? 0) > 0 || row.record.timing_valid === false || !row.window || raw.length > 200 || row.source !== 'captured';
  }
  for (const group of groups) {
    const windows = group.records.filter(record => record.started_ms !== null && record.ended_ms !== null).map(record => ({ start_ms: record.started_ms, end_ms: record.ended_ms }));
    group.combat_ms = mergedDuration(windows);
    group.wall_ms = group.started_ms !== null && group.ended_ms !== null ? group.ended_ms - group.started_ms : null;
    group.idle_ms = group.wall_ms === null ? null : Math.max(0, group.wall_ms - group.combat_ms);
    // Per-session damage / union of retained combat windows is explicitly this
    // session metric; the sum of encounter DPS would have no useful unit.
    group.dps = group.scope_known && group.damage !== null && group.combat_ms > 0 ? group.damage * 1000 / group.combat_ms : null;
    delete group.context_key; delete group.character_key; delete group.isolated;
  }
  return { groups: groups.reverse(), scope: selectedScope, gap_ms: gap, limited: raw.length > 200, record_count: rows.length, grouping: 'received-instance-or-local-time-session' };
}

export function renderRunHistory(records, options = {}) {
  const value = groupEncounterRuns(records, options), en = options.locale === 'en';
  const number = value => value === null ? '—' : new Intl.NumberFormat(en ? 'en' : 'tr', { maximumFractionDigits: 1 }).format(value);
  const seconds = value => value === null ? '—' : `${number(value / 1000)} s`;
  const title = en ? 'Runs and local sessions' : 'Koşular ve yerel oturumlar';
  const help = en ? `Received instance identity establishes a dungeon group. Otherwise, adjacent fights are local sessions (gap ≤ ${number(value.gap_ms / 60000)} min), not verified dungeon clears. Imported fights stay separate.` : `Alınan zindan oturum kimliği varsa zindan grubu kullanılır. Aksi halde yakın karşılaşmalar yerel oturumdur (ara ≤ ${number(value.gap_ms / 60000)} dk); tamamlanmış zindan doğrulanmaz. İçe aktarılanlar ayrı kalır.`;
  return `<section class="run-history"><h3>${title}</h3><p class="help">${help}</p>${value.groups.length ? value.groups.slice(0, 40).map(group => {
    const kind = group.kind === 'dungeon' && group.verified_dungeon ? en ? 'Received dungeon instance' : 'Alınan zindan oturumu' : group.kind === 'imported-encounter' ? en ? 'Imported · unverified' : 'İçe aktarılmış · doğrulanmamış' : group.kind === 'map-session' ? en ? 'Observed map session' : 'Gözlenen harita oturumu' : en ? 'Local session' : 'Yerel oturum';
    return `<details class="record-card" data-state-key="run-${esc(group.id)}"><summary>${esc(group.context?.name || kind)} · ${group.encounter_count} ${en ? 'fights' : 'karşılaşma'}</summary><p class="help">${kind}${group.source === 'demo' ? ' · Demo' : ''} · ${en ? 'Combat windows' : 'Karşılaşma aralıkları'}: ${seconds(group.combat_ms)} · ${en ? 'Between fights' : 'Karşılaşmalar arası'}: ${seconds(group.idle_ms)}</p><div class="analysis-metrics"><div><span>${en ? 'Scoped damage' : 'Kapsam hasarı'}</span><strong>${number(group.damage)}</strong></div><div><span>${en ? 'Combat-window DPS' : 'Karşılaşma aralığı DPS'}</span><strong>${number(group.dps)}</strong></div></div>${group.unique_boss_names.length ? `<p class="help">${group.unique_boss_names.map(esc).join(' · ')}</p>` : ''}${group.partial ? `<p class="quality-warning">${en ? 'Partial or unverified records are included.' : 'Eksik veya doğrulanmamış kayıtlar içerir.'}</p>` : ''}</details>`;
  }).join('') : `<p class="help">${en ? 'No saved encounters.' : 'Kaydedilmiş karşılaşma yok.'}</p>`}</section>`;
}
