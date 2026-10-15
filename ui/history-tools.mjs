import { scopedEncounter } from './scope.mjs';

export const HISTORY_NOTEBOOK_KEY = 'luma.history-notebook.v1';
export const HISTORY_TOOL_LIMITS = Object.freeze({ records: 400, annotations: 200, storageBytes: 512 * 1024, note: 1200, tags: 12, tag: 32, label: 48, query: 160 });
const scopes = ['personal', 'party', 'observed'];
const classes = new Set(['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'spiritmaster', 'cleric', 'chanter']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const metric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const text = (value, length, multiline = false) => typeof value === 'string' ? Array.from(value.normalize('NFKC').replace(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g : /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim()).slice(0, length).join('') : '';
const fold = value => text(value, 1600).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const identityText = value => text(value, 100).toLowerCase();
const id = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : '';
const boundedTime = value => Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000 ? value : 0;
const emptyAnnotation = () => ({ tags: [], note: '', category: '', difficulty: '', favorite: false, updated_at_ms: 0 });
const meaningful = annotation => annotation.tags.length || annotation.note || annotation.category || annotation.difficulty || annotation.favorite;
const copy = annotation => ({ ...annotation, tags: [...annotation.tags] });
const validKey = value => typeof value === 'string' && /^(received|imported|demo):[a-zA-Z0-9_:-]{1,230}$/.test(value);

export function parseHistoryTags(value) {
  const values = typeof value === 'string' ? value.slice(0, 4096).split(/[,;\n]/) : Array.isArray(value) ? value.slice(0, 100) : [];
  const seen = new Set(), tags = [];
  for (const value of values) {
    const tag = text(value, HISTORY_TOOL_LIMITS.tag), key = fold(tag);
    if (!tag || seen.has(key)) continue;
    tags.push(tag); seen.add(key);
    if (tags.length === HISTORY_TOOL_LIMITS.tags) break;
  }
  return tags;
}

export function normalizeHistoryAnnotation(value) {
  const annotation = object(value) ? value : {};
  return { tags: parseHistoryTags(annotation.tags), note: text(annotation.note, HISTORY_TOOL_LIMITS.note, true), category: text(annotation.category, HISTORY_TOOL_LIMITS.label), difficulty: text(annotation.difficulty, HISTORY_TOOL_LIMITS.label), favorite: annotation.favorite === true, updated_at_ms: boundedTime(annotation.updated_at_ms) };
}

function recordSource(record, imported = false) {
  return imported || record?.provenance === 'imported-unverified' || record?.source === 'imported' ? 'imported' : record?.provenance === 'demo' || record?.source === 'demo' ? 'demo' : 'received';
}

// Include capture timing and totals because encounter ids may be reused on a later launch.
export function historyRecordKey(record, { imported = false } = {}) {
  if (!object(record) || !id(record.id)) return null;
  const started = metric(record.started_ms) ?? (typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : NaN);
  const elapsed = metric(record.elapsed_ms), total = metric(record.total_damage);
  if (!Number.isSafeInteger(started) || started <= 0 || elapsed === null || total === null || !Number.isSafeInteger(elapsed) || !Number.isSafeInteger(total)) return null;
  return `${recordSource(record, imported)}:${id(record.id)}:${started}:${elapsed}:${total}`;
}

export function normalizeHistoryNotebook(value) {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.entries)) return { version: 1, entries: [] };
  const entries = new Map();
  for (const row of value.entries.slice(0, HISTORY_TOOL_LIMITS.annotations * 2)) {
    if (!object(row) || !validKey(row.key)) continue;
    const annotation = normalizeHistoryAnnotation(row.annotation);
    if (!meaningful(annotation)) continue;
    if (!entries.has(row.key) || entries.get(row.key).updated_at_ms < annotation.updated_at_ms) entries.set(row.key, annotation);
  }
  return { version: 1, entries: [...entries].map(([key, annotation]) => ({ key, annotation })).sort((a, b) => b.annotation.updated_at_ms - a.annotation.updated_at_ms || a.key.localeCompare(b.key)).slice(0, HISTORY_TOOL_LIMITS.annotations) };
}

// This notebook is local metadata only. It never edits a captured record or export.
export function createHistoryNotebook({ storage, key = HISTORY_NOTEBOOK_KEY, clock = Date.now, onError } = {}) {
  let document = { version: 1, entries: [] }, loadError = null;
  try {
    const raw = storage?.getItem(key);
    if (raw !== null && raw !== undefined) {
      if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > HISTORY_TOOL_LIMITS.storageBytes) throw new Error('History notebook is too large');
      const value = JSON.parse(raw);
      if (!object(value) || value.version !== 1 || !Array.isArray(value.entries)) throw new Error('Unsupported history notebook');
      document = normalizeHistoryNotebook(value);
    }
  } catch (error) { loadError = 'storage-read-failed'; onError?.(loadError, error); }
  function commit(next) {
    const normalized = normalizeHistoryNotebook(next), serialized = JSON.stringify(normalized);
    try {
      if (!storage || typeof storage.setItem !== 'function') throw new Error('Local storage is unavailable');
      if (new TextEncoder().encode(serialized).length > HISTORY_TOOL_LIMITS.storageBytes) throw new Error('History notebook is too large');
      storage.setItem(key, serialized);
      document = normalized; loadError = null;
      return { ok: true };
    } catch (error) { onError?.('storage-write-failed', error); return { ok: false, error: 'storage-write-failed' }; }
  }
  const getKey = value => typeof value === 'string' ? value : historyRecordKey(value);
  return {
    get(value) { const found = document.entries.find(entry => entry.key === getKey(value)); return copy(found?.annotation || emptyAnnotation()); },
    set(value, patch) {
      const recordKey = getKey(value);
      if (!validKey(recordKey) || !object(patch)) return { ok: false, error: 'invalid-annotation' };
      const previous = document.entries.find(entry => entry.key === recordKey)?.annotation || emptyAnnotation();
      const allowed = Object.fromEntries(['tags', 'note', 'category', 'difficulty', 'favorite'].filter(field => Object.hasOwn(patch, field)).map(field => [field, patch[field]]));
      const annotation = normalizeHistoryAnnotation({ ...previous, ...allowed, updated_at_ms: boundedTime(clock()) });
      const next = document.entries.filter(entry => entry.key !== recordKey);
      if (meaningful(annotation)) next.unshift({ key: recordKey, annotation });
      const result = commit({ version: 1, entries: next });
      return result.ok ? { ...result, annotation: copy(annotation) } : result;
    },
    remove(value) {
      const recordKey = getKey(value);
      if (!validKey(recordKey)) return { ok: false, error: 'invalid-annotation' };
      return commit({ version: 1, entries: document.entries.filter(entry => entry.key !== recordKey) });
    },
    snapshot() { return { version: 1, entries: document.entries.map(entry => ({ key: entry.key, annotation: copy(entry.annotation) })) }; },
    get loadError() { return loadError; },
  };
}

function annotationFor(notebook, key) {
  if (!key) return emptyAnnotation();
  if (typeof notebook?.get === 'function') return normalizeHistoryAnnotation(notebook.get(key));
  return normalizeHistoryAnnotation(normalizeHistoryNotebook(notebook).entries.find(entry => entry.key === key)?.annotation);
}

function rows(records, notebook, scope) {
  return (Array.isArray(records) ? records : []).slice(0, HISTORY_TOOL_LIMITS.records).map((value, index) => {
    const wrapper = object(value?.item), record = wrapper ? value.item : value;
    if (!object(record)) return null;
    const source = recordSource(record, wrapper && value.imported === true), key = historyRecordKey(record, { imported: source === 'imported' });
    const annotation = annotationFor(notebook, key), scoped = scopedEncounter({ ...record, players: Array.isArray(record.players) ? record.players.slice(0, 100) : [], targets: Array.isArray(record.targets) ? record.targets.slice(0, 100) : [], personal_targets: Array.isArray(record.personal_targets) ? record.personal_targets.slice(0, 100) : [], party_targets: Array.isArray(record.party_targets) ? record.party_targets.slice(0, 100) : [], party_member_ids: Array.isArray(record.party_member_ids) ? record.party_member_ids.slice(0, 100) : [] }, scope);
    const timestamp = metric(record.started_ms) ?? (typeof record.timestamp === 'string' && Number.isFinite(Date.parse(record.timestamp)) ? Date.parse(record.timestamp) : null);
    return { record, item: record, index, key, source, imported: source === 'imported', annotation, scoped, timestamp };
  }).filter(Boolean);
}

export function queryHistory(records, options = {}, notebook) {
  const scope = scopes.includes(options.scope) ? options.scope : 'personal';
  const terms = fold(text(options.query, HISTORY_TOOL_LIMITS.query)).split(/\s+/).filter(Boolean).slice(0, 12);
  const wantedTags = parseHistoryTags(options.tags).map(fold), category = fold(text(options.category, HISTORY_TOOL_LIMITS.label)), difficulty = fold(text(options.difficulty, HISTORY_TOOL_LIMITS.label));
  const source = ['received', 'imported', 'demo'].includes(options.source) ? options.source : '';
  const sort = ['newest', 'oldest', 'dps', 'damage', 'duration', 'name', 'favorite'].includes(options.sort) ? options.sort : 'newest';
  const start = metric(options.from_ms), end = metric(options.to_ms), minDuration = metric(options.min_duration_ms), maxDuration = metric(options.max_duration_ms);
  const sourceRows = rows(records, notebook, scope);
  const entries = sourceRows.filter(row => {
    const { record, annotation, scoped } = row;
    if (source && row.source !== source || options.favoritesOnly === true && !annotation.favorite || category && fold(annotation.category) !== category || difficulty && fold(annotation.difficulty) !== difficulty) return false;
    if (wantedTags.some(tag => !annotation.tags.some(value => fold(value) === tag))) return false;
    if (start !== null && (row.timestamp === null || row.timestamp < start) || end !== null && (row.timestamp === null || row.timestamp > end)) return false;
    if (minDuration !== null && scoped.elapsed < minDuration || maxDuration !== null && scoped.elapsed > maxDuration) return false;
    const search = [record.name, record.local_player_name, ...(Array.isArray(record.players) ? record.players.slice(0, 100).flatMap(player => [player?.name, player?.class_name]) : []), ...(Array.isArray(record.targets) ? record.targets.slice(0, 100).map(target => target?.name) : []), ...annotation.tags, annotation.note, annotation.category, annotation.difficulty].filter(value => typeof value === 'string').map(fold).join(' ');
    return terms.every(term => search.includes(term));
  });
  const compareMetric = (a, b, field) => {
    const left = a.scoped.known ? metric(a.scoped[field]) : null, right = b.scoped.known ? metric(b.scoped[field]) : null;
    return left === null ? right === null ? 0 : 1 : right === null ? -1 : right - left;
  };
  entries.sort((a, b) => {
    let order = sort === 'name' ? text(a.record.name, 100).localeCompare(text(b.record.name, 100)) : sort === 'dps' ? compareMetric(a, b, 'dps') : sort === 'damage' ? compareMetric(a, b, 'damage') : sort === 'duration' ? compareMetric(a, b, 'elapsed') : sort === 'favorite' ? Number(b.annotation.favorite) - Number(a.annotation.favorite) : 0;
    if (!order) order = sort === 'oldest' ? (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity) : (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity);
    return order || a.index - b.index;
  });
  const facets = field => [...new Set(sourceRows.map(row => row.annotation[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b)).slice(0, HISTORY_TOOL_LIMITS.annotations);
  return { entries, total: sourceRows.length, matched: entries.length, scope, sort, categories: facets('category'), difficulties: facets('difficulty'), tags: [...new Set(sourceRows.flatMap(row => row.annotation.tags))].sort((a, b) => a.localeCompare(b)).slice(0, 200) };
}

function trendCandidate(row) {
  const record = row.record;
  if (!row.key) return { reason: 'record-unidentifiable' };
  if (row.source !== 'received' || record.provenance !== 'received' && record.source !== 'captured') return { reason: 'unverified-source' };
  if (record.sample_complete !== true || record.truncated === true || record.diagnostics?.truncated_encounter === true || (metric(record.stream_gaps ?? record.diagnostics?.stream_gaps) ?? 0) > 0) return { reason: 'incomplete-capture' };
  if (!['server', 'manual', 'name-match'].includes(record.local_identity_source) || !id(record.local_player_id)) return { reason: 'identity-unresolved' };
  const player = (Array.isArray(record.players) ? record.players.slice(0, 100) : []).find(player => String(player.id) === String(record.local_player_id));
  const ownName = text(record.local_player_name || player?.name, 80), className = identityText(player?.class_name);
  if (!player || !ownName || /^#|^player\s+\d+$|^unknown$|^—$|^\?/i.test(ownName) || !classes.has(className)) return { reason: 'character-unresolved' };
  const duration = metric(record.personal_elapsed_ms), damage = metric(record.personal_total_damage), statedDps = metric(record.personal_dps);
  if (record.timing_valid === false || duration === null || duration < 10000 || duration > 21600000 || damage === null || damage > Number.MAX_SAFE_INTEGER || statedDps === null || row.timestamp === null) return { reason: 'timing-unresolved' };
  const dps = damage * 1000 / duration;
  if (Math.abs(dps - statedDps) > Math.max(.01, dps * .005)) return { reason: 'inconsistent-metrics' };
  const targets = (Array.isArray(record.personal_targets) ? record.personal_targets.slice(0, 100) : []).filter(target => (metric(target?.damage) ?? 0) > 0);
  const target = targets[0], boss = text(target?.name, 100);
  if (targets.length !== 1 || target?.is_boss !== true || !boss || /^#|^target\s+#?|^unknown$|^—$|^\?/i.test(boss) || metric(target.damage) !== damage) return { reason: 'boss-unresolved' };
  if (!row.annotation.difficulty) return { reason: 'difficulty-unresolved' };
  const samples = Array.isArray(record.damage_samples) ? record.damage_samples : [];
  const personalSamples = samples.slice(0, 5000).filter(sample => String(sample?.player_id ?? sample?.source) === String(record.local_player_id));
  if (samples.length > 5000 || !personalSamples.length || personalSamples.some(sample => metric(sample.amount) === null) || personalSamples.reduce((sum, sample) => sum + sample.amount, 0) !== damage) return { reason: 'incomplete-samples' };
  const server = id(record.character_build?.server_id);
  const character = `${identityText(ownName)}:${server ? `server-${server}` : `actor-${id(record.local_player_id)}`}`;
  const actorScope = scopes.includes(record.actor_scope) ? record.actor_scope : 'observed';
  const group = JSON.stringify([character, className, identityText(boss), identityText(row.annotation.difficulty), identityText(row.annotation.category), actorScope, 'personal']);
  return { group, point: { key: row.key, id: String(record.id), timestamp: row.timestamp, name: text(record.name, 100), character: ownName, class_name: player.class_name, boss, difficulty: row.annotation.difficulty, category: row.annotation.category, scope: 'personal', dps, damage, duration_ms: duration } };
}

export function historyTrend(records, { selectedKey = '', scope = 'personal', notebook, take = 12 } = {}) {
  const unavailable = (reason, extra = {}) => ({ available: false, comparable: false, reason, points: [], latest: null, previous: null, best: null, median_dps: null, change_percent: null, ...extra });
  if (scope !== 'personal') return unavailable('personal-only');
  const candidates = rows(records, notebook, 'personal').map(row => ({ row, ...trendCandidate(row) }));
  const selected = selectedKey ? candidates.find(candidate => candidate.row.key === selectedKey) : candidates.filter(candidate => candidate.point).sort((a, b) => b.point.timestamp - a.point.timestamp)[0];
  if (!selected) return unavailable(selectedKey ? 'record-missing' : 'no-comparable-records');
  if (!selected.point) return unavailable(selected.reason, { selectedKey: selected.row.key });
  const seen = new Set();
  const points = candidates.filter(candidate => candidate.point && candidate.group === selected.group && candidate.row.key && !seen.has(candidate.row.key) && seen.add(candidate.row.key)).map(candidate => candidate.point).sort((a, b) => a.timestamp - b.timestamp || a.key.localeCompare(b.key)).slice(-Math.min(30, Math.max(2, Number.isInteger(take) ? take : 12)));
  const latest = points.at(-1), previous = points.at(-2) || null, best = points.reduce((current, point) => point.dps > current.dps ? point : current, points[0]);
  const values = points.map(point => point.dps).sort((a, b) => a - b), middle = Math.floor(values.length / 2);
  return { available: true, comparable: points.length >= 2, reason: points.length >= 2 ? 'comparable-personal-records' : 'one-comparable-record', selectedKey: selected.row.key, points, latest, previous, best, median_dps: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2, change_percent: previous && previous.dps > 0 ? (latest.dps - previous.dps) / previous.dps * 100 : null, excluded: candidates.length - points.length };
}
