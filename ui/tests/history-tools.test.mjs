import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_TOOL_LIMITS, HISTORY_NOTEBOOK_KEY, parseHistoryTags, normalizeHistoryAnnotation, historyRecordKey, normalizeHistoryNotebook, createHistoryNotebook, queryHistory, historyTrend } from '../history-tools.mjs';

function storage(initial = null) {
  let value = initial;
  return { getItem(key) { assert.equal(key, HISTORY_NOTEBOOK_KEY); return value; }, setItem(key, next) { assert.equal(key, HISTORY_NOTEBOOK_KEY); value = next; }, get value() { return value; } };
}
function record(id = 1, overrides = {}) {
  return {
    id: String(id), name: 'Abyss Warden', started_ms: 1_800_000_000_000 + id * 100000,
    ended_ms: 1_800_000_000_000 + id * 100000 + 20000, elapsed_ms: 20000,
    total_damage: 600000, dps: 30000, actor_scope: 'observed', source: 'captured', provenance: 'received',
    sample_complete: true, timing_valid: true, local_player_id: '10', local_player_name: 'center', local_identity_source: 'server',
    personal_total_damage: 200000, personal_dps: 10000, personal_elapsed_ms: 20000,
    players: [{ id: '10', name: 'center', class_name: 'Ranger', damage: 200000, dps: 10000 }, { id: '11', name: 'Friend', class_name: 'Cleric', damage: 400000, dps: 20000 }],
    personal_targets: [{ id: '99', name: 'Abyss Warden', is_boss: true, damage: 200000 }],
    targets: [{ id: '99', name: 'Abyss Warden', is_boss: true, damage: 600000 }],
    damage_samples: [{ player_id: '10', amount: 200000, timestamp_ms: 1_800_000_000_000 + id * 100000 }, { player_id: '11', amount: 400000, timestamp_ms: 1_800_000_000_000 + id * 100000 }],
    character_build: { server_id: '4701' }, ...overrides,
  };
}
function notebookFor(records, metadata = { difficulty: 'Nightmare', category: 'Dungeon' }) {
  const notebook = createHistoryNotebook({ storage: storage(), clock: () => 100 });
  for (const item of records) assert.equal(notebook.set(item, metadata).ok, true);
  return notebook;
}

test('annotation text stays plain text, strips control and bidi characters, bounds Unicode characters and deduplicates tags', () => {
  const annotation = normalizeHistoryAnnotation({ tags: ['Best', 'best', 'Élite', 'elite', 123, '', '😀'.repeat(50)], note: '  <script>\u0000https://local.invalid\u202e\ntext</script>  ', category: 'Dungeon\nOne', difficulty: 'Hard', favorite: 1, extra: '<img>' });
  assert.deepEqual(annotation.tags, ['Best', 'Élite', '😀'.repeat(32)]);
  assert.equal(annotation.note, '<script>https://local.invalid\ntext</script>');
  assert.equal(annotation.category, 'DungeonOne'); assert.equal(annotation.favorite, false);
  assert.equal(Object.hasOwn(annotation, 'extra'), false);
  assert.equal(Array.from(normalizeHistoryAnnotation({ note: '😀'.repeat(1300) }).note).length, 1200);
});

test('comma, semicolon and line-separated tags are bounded and no regular expression is executed from user text', () => {
  assert.deepEqual(parseHistoryTags('Farm, farm; Burst\nBoss'), ['Farm', 'Burst', 'Boss']);
  assert.equal(parseHistoryTags(Array.from({ length: 1000 }, (_, i) => `tag${i}`)).length, 12);
  assert.deepEqual(parseHistoryTags({ tags: 'anything' }), []);
});

test('record annotation keys separate imported, demo, captured and reused encounter ids', () => {
  const first = record(1), reused = { ...first, started_ms: first.started_ms + 1 };
  assert.notEqual(historyRecordKey(first), historyRecordKey(reused));
  assert.notEqual(historyRecordKey(first), historyRecordKey(first, { imported: true }));
  assert.notEqual(historyRecordKey(first), historyRecordKey({ ...first, provenance: 'demo' }));
  assert.equal(historyRecordKey({ ...first, timestamp: '2026-10-15T12:00:00Z', started_ms: undefined }).startsWith('received:1:'), true);
  for (const value of [null, {}, { ...first, id: '<script>' }, { ...first, started_ms: 0 }, { ...first, elapsed_ms: Infinity }, { ...first, total_damage: null }]) assert.equal(historyRecordKey(value), null);
});

test('notebook persists independently of encounters and roundtrips only the annotation schema', () => {
  const disk = storage(), input = record(), before = JSON.stringify(input);
  const notebook = createHistoryNotebook({ storage: disk, clock: () => 1234 });
  const result = notebook.set(input, { tags: 'Farm,Best', note: 'New bow', difficulty: 'Nightmare', category: 'Dungeon', favorite: true, source: 'pretend', record: input });
  assert.equal(result.ok, true); assert.equal(notebook.get(input).updated_at_ms, 1234);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(createHistoryNotebook({ storage: disk }).get(input), result.annotation);
  assert.equal(disk.value.includes('damage_samples'), false); assert.equal(disk.value.includes('New bow'), true);
  assert.equal(disk.value.includes('pretend'), false); assert.equal(disk.value.includes('center'), false);
});

test('notebook get, set and snapshot results never leak mutable references', () => {
  const notebook = notebookFor([record()]);
  const saved = notebook.set(record(), { tags: ['Farm'] }); saved.annotation.tags.push('mutated');
  const read = notebook.get(record()); read.tags.push('mutated');
  const snapshot = notebook.snapshot(); snapshot.entries[0].annotation.tags.push('mutated');
  assert.deepEqual(notebook.get(record()).tags, ['Farm']);
});

test('updating a field retains other annotations, empty annotations remove records, and remove persists', () => {
  const disk = storage(), notebook = createHistoryNotebook({ storage: disk });
  notebook.set(record(), { note: 'first', tags: ['Boss'], favorite: true });
  notebook.set(record(), { note: 'second' });
  assert.deepEqual(notebook.get(record()).tags, ['Boss']); assert.equal(notebook.get(record()).favorite, true);
  notebook.set(record(), { note: '', tags: [], favorite: false });
  assert.equal(notebook.snapshot().entries.length, 0);
  notebook.set(record(), { favorite: true }); assert.equal(notebook.remove(record()).ok, true);
  assert.equal(JSON.parse(disk.value).entries.length, 0);
});

test('corrupt, oversized and future-version notebook data fail without crashing or inventing annotations', () => {
  for (const raw of ['{broken', JSON.stringify({ version: 2, entries: [] }), ' '.repeat(HISTORY_TOOL_LIMITS.storageBytes + 1)]) {
    const errors = [], notebook = createHistoryNotebook({ storage: storage(raw), onError: error => errors.push(error) });
    assert.equal(notebook.loadError, 'storage-read-failed'); assert.equal(notebook.snapshot().entries.length, 0); assert.deepEqual(errors, ['storage-read-failed']);
  }
});

test('storage errors never report a save or replace confirmed in-memory data', () => {
  let fail = false, raw = null;
  const notebook = createHistoryNotebook({ storage: { getItem: () => raw, setItem(_key, value) { if (fail) throw new Error('Quota'); raw = value; } } });
  assert.equal(notebook.set(record(), { note: 'confirmed' }).ok, true);
  fail = true;
  assert.deepEqual(notebook.set(record(), { note: 'not saved' }), { ok: false, error: 'storage-write-failed' });
  assert.equal(notebook.get(record()).note, 'confirmed');
  assert.equal(notebook.remove(record()).ok, false); assert.equal(notebook.get(record()).note, 'confirmed');
  assert.equal(createHistoryNotebook().set(record(), { note: 'no storage' }).ok, false);
});

test('invalid keys and annotation payloads cannot become storage property names', () => {
  const notebook = createHistoryNotebook({ storage: storage() });
  for (const key of ['__proto__', 'constructor', 'received:<script>', '', null]) assert.equal(notebook.set(key, { note: 'x' }).ok, false);
  assert.equal(notebook.set(record(), []).ok, false); assert.equal(notebook.remove('__proto__').ok, false);
  assert.deepEqual(normalizeHistoryNotebook({ version: 1, entries: [{ key: '__proto__', annotation: { note: 'x' } }] }).entries, []);
});

test('notebook retains at most 200 newest annotations and deduplicates a key by confirmed update time', () => {
  const entries = Array.from({ length: 250 }, (_, i) => ({ key: historyRecordKey(record(i + 1)), annotation: { note: String(i), updated_at_ms: i } }));
  entries.push({ ...entries[200], annotation: { note: 'latest', updated_at_ms: 999 } });
  const document = normalizeHistoryNotebook({ version: 1, entries });
  assert.equal(document.entries.length, 200); assert.equal(document.entries[0].annotation.note, 'latest');
  assert.equal(document.entries.at(-1).annotation.updated_at_ms, 50);
});

test('search matches all literal terms across player, boss and local annotations without changing original order', () => {
  const records = [record(1), record(2, { name: 'Training Scarecrow', targets: [{ name: 'Training Scarecrow' }] })], before = records.map(row => row.id);
  const notebook = notebookFor(records); notebook.set(records[0], { tags: ['Farm'], note: 'New enchanted bow' });
  const result = queryHistory(records, { query: 'ranger FARM enchanted' }, notebook);
  assert.equal(result.matched, 1); assert.equal(result.entries[0].record, records[0]); assert.equal(result.entries[0].index, 0);
  assert.deepEqual(records.map(row => row.id), before);
  assert.equal(queryHistory(records, { query: '.*' }, notebook).matched, 0);
  assert.equal(queryHistory(records, { query: 'WARDEN' }, notebook).matched, 1);
});

test('filtering wrapped histories keeps original replay indices and source-separated metadata', () => {
  const first = record(1), imported = record(2, { provenance: 'imported-unverified' });
  const notebook = notebookFor([first]);
  notebook.set(historyRecordKey(imported, { imported: true }), { tags: ['Imported'], difficulty: 'Hard' });
  const result = queryHistory([{ item: first, imported: false }, { item: imported, imported: true }], { source: 'imported' }, notebook);
  assert.equal(result.entries[0].index, 1); assert.equal(result.entries[0].imported, true); assert.deepEqual(result.entries[0].annotation.tags, ['Imported']);
});

test('tag, category, difficulty, favorite and inclusive time/duration filters compose', () => {
  const records = [record(1), record(2), record(3)], notebook = notebookFor(records);
  notebook.set(records[1], { tags: ['Farm', 'Burst'], favorite: true });
  const result = queryHistory(records, { tags: ['farm', 'burst'], category: 'dungeon', difficulty: 'nightmare', favoritesOnly: true, from_ms: records[1].started_ms, to_ms: records[1].started_ms, min_duration_ms: 20000, max_duration_ms: 20000 }, notebook);
  assert.deepEqual(result.entries.map(row => row.record.id), ['2']);
  assert.equal(queryHistory(records, { tags: ['missing'] }, notebook).matched, 0);
  assert.equal(queryHistory(records, { max_duration_ms: 19999 }, notebook).matched, 0);
  assert.deepEqual(result.categories, ['Dungeon']); assert.deepEqual(result.difficulties, ['Nightmare']); assert.deepEqual(result.tags, ['Burst', 'Farm']);
});

test('personal DPS sorting uses personal values and keeps unresolved or invalid timing after measured records', () => {
  const records = [record(1, { personal_dps: 800, dps: 90000 }), record(2, { personal_dps: 1800, dps: 100 }), record(3, { local_identity_source: 'unresolved', personal_dps: 99999 }), record(4, { timing_valid: false, personal_dps: 88888 })];
  assert.deepEqual(queryHistory(records, { sort: 'dps' }).entries.map(row => row.record.id), ['2', '1', '4', '3']);
  assert.deepEqual(queryHistory(records, { sort: 'dps', scope: 'observed' }).entries.map(row => row.record.id), ['1', '3', '2', '4']);
});

test('newest, oldest, duration, name and favorite ordering are deterministic', () => {
  const records = [record(1, { name: 'Beta', personal_elapsed_ms: 30000 }), record(2, { name: 'Alpha' }), record(3, { name: 'Gamma' })], notebook = notebookFor(records);
  notebook.set(records[0], { favorite: true });
  assert.deepEqual(queryHistory(records, {}, notebook).entries.map(row => row.record.id), ['3', '2', '1']);
  assert.deepEqual(queryHistory(records, { sort: 'oldest' }, notebook).entries.map(row => row.record.id), ['1', '2', '3']);
  assert.equal(queryHistory(records, { sort: 'duration' }, notebook).entries[0].record.id, '1');
  assert.equal(queryHistory(records, { sort: 'name' }, notebook).entries[0].record.id, '2');
  assert.equal(queryHistory(records, { sort: 'favorite' }, notebook).entries[0].record.id, '1');
});

test('malformed history arrays are bounded, tolerate unknown records, and cannot crash a scope query', () => {
  assert.equal(queryHistory(null).total, 0);
  const malformed = record(1, { party_member_ids: {}, players: {}, targets: null, personal_targets: null });
  assert.doesNotThrow(() => queryHistory([null, [], 'bad', malformed], { scope: 'party' }));
  assert.equal(queryHistory(Array.from({ length: 1000 }, (_, i) => record(i + 1))).total, 400);
});

test('local note searches still work behind a full nearby roster and unknown clock records sort last', () => {
  const crowded = record(1, { players: Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `A-player-name-with-many-characters-${i}`, class_name: 'Ranger' })) }), notebook = notebookFor([crowded]);
  notebook.set(crowded, { note: 'RareBowAcquired' });
  assert.equal(queryHistory([crowded], { query: 'RareBowAcquired' }, notebook).matched, 1);
  const unknownClock = record(2, { started_ms: undefined, timestamp: 'broken' });
  assert.equal(queryHistory([unknownClock, crowded], { sort: 'oldest' }).entries.at(-1).record.id, '2');
});

test('personal history trend reports measured DPS, median, best, and latest change within one boss/difficulty/class/character group', () => {
  const records = [record(1), record(2, { personal_dps: 12000, personal_total_damage: 240000, personal_targets: [{ name: 'Abyss Warden', is_boss: true, damage: 240000 }], damage_samples: [{ player_id: '10', amount: 240000 }] }), record(3, { personal_dps: 11000, personal_total_damage: 220000, personal_targets: [{ name: 'Abyss Warden', is_boss: true, damage: 220000 }], damage_samples: [{ player_id: '10', amount: 220000 }] })];
  const notebook = notebookFor(records), before = JSON.stringify(records), trend = historyTrend(records, { notebook });
  assert.equal(trend.available, true); assert.equal(trend.comparable, true); assert.deepEqual(trend.points.map(point => point.id), ['1', '2', '3']);
  assert.equal(trend.best.id, '2'); assert.equal(trend.latest.id, '3'); assert.equal(trend.previous.id, '2'); assert.equal(trend.median_dps, 11000);
  assert.ok(Math.abs(trend.change_percent + 8.3333333333) < .000001); assert.equal(JSON.stringify(records), before);
});

test('trend never mixes a nearby roster total or party DPS into personal progress', () => {
  const first = record(1, { party_dps: 70000, party_membership_source: 'server' }), notebook = notebookFor([first]);
  const trend = historyTrend([first], { notebook });
  assert.equal(trend.points[0].dps, 10000); assert.equal(trend.comparable, false); assert.equal(trend.change_percent, null);
  for (const scope of ['party', 'observed']) assert.equal(historyTrend([first], { notebook, scope }).reason, 'personal-only');
});

test('trend excludes imported and demo records and does not silently replace an explicitly selected ineligible record', () => {
  const good = record(1), imported = record(2, { source: 'imported', provenance: 'imported-unverified' }), demo = record(3, { provenance: 'demo' }), records = [good, imported, demo], notebook = notebookFor(records);
  assert.deepEqual(historyTrend(records, { notebook }).points.map(point => point.id), ['1']);
  assert.equal(historyTrend(records, { notebook, selectedKey: historyRecordKey(imported) }).reason, 'unverified-source');
  assert.equal(historyTrend(records, { notebook, selectedKey: 'received:missing' }).reason, 'record-missing');
});

test('incomplete capture, known gaps, sample mismatch, unresolved identity, invalid clocks and inconsistent metrics block comparisons', () => {
  const cases = [
    [{ sample_complete: false }, 'incomplete-capture'], [{ sample_complete: undefined }, 'incomplete-capture'], [{ truncated: true }, 'incomplete-capture'], [{ stream_gaps: 1 }, 'incomplete-capture'], [{ diagnostics: { stream_gaps: 1 } }, 'incomplete-capture'],
    [{ local_identity_source: 'unresolved' }, 'identity-unresolved'], [{ local_player_name: '#10' }, 'character-unresolved'], [{ players: [{ id: '10', name: 'center', class_name: 'Unknown' }] }, 'character-unresolved'],
    [{ timing_valid: false }, 'timing-unresolved'], [{ personal_elapsed_ms: 0 }, 'timing-unresolved'], [{ personal_elapsed_ms: 9999 }, 'timing-unresolved'], [{ personal_dps: Infinity }, 'timing-unresolved'], [{ personal_dps: 90000 }, 'inconsistent-metrics'],
    [{ damage_samples: [] }, 'incomplete-samples'], [{ damage_samples: [{ player_id: '10', amount: 199999 }] }, 'incomplete-samples'], [{ damage_samples: [{ player_id: '10', amount: NaN }] }, 'incomplete-samples'],
  ];
  for (const [patch, reason] of cases) {
    const input = record(1, patch), notebook = notebookFor([input]);
    assert.equal(historyTrend([input], { selectedKey: historyRecordKey(input), notebook }).reason, reason, JSON.stringify(patch));
  }
});

test('a single named boss and explicit difficulty are required; trash and adds cannot masquerade as the same boss result', () => {
  const variants = [
    { personal_targets: [] }, { personal_targets: [{ name: 'Scarecrow', is_boss: false, damage: 200000 }] },
    { personal_targets: [{ name: '#99', is_boss: true, damage: 200000 }] },
    { personal_targets: [{ name: 'Abyss Warden', is_boss: true, damage: 150000 }, { name: 'Add', is_boss: false, damage: 50000 }] },
    { personal_targets: [{ name: 'Abyss Warden', is_boss: true, damage: 190000 }] },
  ];
  for (const patch of variants) {
    const input = record(1, patch), notebook = notebookFor([input]);
    assert.equal(historyTrend([input], { selectedKey: historyRecordKey(input), notebook }).reason, 'boss-unresolved');
  }
  const input = record();
  assert.equal(historyTrend([input], { selectedKey: historyRecordKey(input) }).reason, 'difficulty-unresolved');
});

test('boss, class, character, server, export scope, category and difficulty split comparison groups', () => {
  const base = record(1), variants = [
    record(2, { personal_targets: [{ name: 'Other Boss', is_boss: true, damage: 200000 }] }),
    record(3, { players: [{ id: '10', name: 'center', class_name: 'Cleric' }] }),
    record(4, { local_player_name: 'OtherCharacter' }),
    record(5, { character_build: { server_id: '9999' } }),
    record(6, { actor_scope: 'personal' }), record(7), record(8),
  ], records = [base, ...variants], notebook = notebookFor(records);
  notebook.set(variants[5], { category: 'Raid' }); notebook.set(variants[6], { difficulty: 'Normal' });
  assert.deepEqual(historyTrend(records, { selectedKey: historyRecordKey(base), notebook }).points.map(point => point.id), ['1']);
});

test('unknown server falls back to the same actor id rather than comparing two players with the same visible name', () => {
  const first = record(1, { character_build: null }), second = record(2, { character_build: null, local_player_id: '20', players: [{ id: '20', name: 'center', class_name: 'Ranger' }], damage_samples: [{ player_id: '20', amount: 200000 }] }), records = [first, second], notebook = notebookFor(records);
  assert.deepEqual(historyTrend(records, { notebook, selectedKey: historyRecordKey(first) }).points.map(point => point.id), ['1']);
});

test('known server and character identity survives changed actor ids, with no duplicate imported or captured entries', () => {
  const first = record(1), second = record(2, { local_player_id: '20', players: [{ id: '20', name: 'center', class_name: 'Ranger' }], damage_samples: [{ player_id: '20', amount: 200000 }] }), records = [second, first, first], notebook = notebookFor(records);
  assert.deepEqual(historyTrend(records, { notebook }).points.map(point => point.id), ['1', '2']);
});

test('trend bounds visible results and does not invent a percentage from a zero previous DPS', () => {
  const records = Array.from({ length: 40 }, (_, i) => record(i + 1)), notebook = notebookFor(records);
  assert.equal(historyTrend(records, { notebook, take: 1000 }).points.length, 30);
  assert.equal(historyTrend(records, { notebook, take: 1 }).points.length, 2);
  assert.equal(historyTrend(records, { notebook, take: NaN }).points.length, 12);
  assert.equal(historyTrend([]).reason, 'no-comparable-records');
});
