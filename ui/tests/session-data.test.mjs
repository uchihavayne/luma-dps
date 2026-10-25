import test from 'node:test';
import assert from 'node:assert/strict';
import { clockText, groupedNumber, idLabel, normalizeCurrencies, normalizeIdCaps, normalizeIdNames, normalizeParty, normalizeRoom, normalizeTracker, partyFraction, powerText, roomSummary, spanText, ticketRows } from '../session-data.mjs';
import { normalizePvp } from '../pvp.mjs';
import { normalizePreferences, normalizeState } from '../model.mjs';

test('party rows are bounded, deduplicated and refuse impossible health', () => {
  const rows = normalizeParty([
    { id: 1, name: ' Mira\u0007 ', hp: 5, hp_max: 10, is_self: true }, { id: 1, name: 'Dup', hp: 1, hp_max: 2 },
    { id: 2, name: 'Over', hp: 11, hp_max: 10 }, { id: 3, name: '', hp: 1, hp_max: 2 }, { id: 0, name: 'Zero', hp: 1, hp_max: 2 }, null, 'x', { id: 4, name: 'Nomax', hp: 1, hp_max: 0 },
  ]);
  assert.deepEqual(rows, [{ id: '1', name: 'Mira', hp: 5, hp_max: 10, is_self: true, observed_at_ms: 0 }]);
  assert.equal(partyFraction(rows[0]), 0.5);
  for (const value of [null, undefined, 'x', 7, {}]) assert.deepEqual(normalizeParty(value), []);
  assert.equal(normalizeParty(Array.from({ length: 80 }, (_, index) => ({ id: index + 1, name: `P${index}`, hp: 1, hp_max: 2 }))).length, 24);
  assert.equal(normalizeParty(normalizeParty([{ id: 9, name: 'Again', hp: 1, hp_max: 2 }]))[0].id, '9');
});

test('the tracker keeps real rows only and totals what it was not told', () => {
  const tracker = normalizeTracker({ kills: [{ model: 5, name: ' Boar ', count: 3 }, { model: 0, count: 1 }, { model: 6, count: 0 }, null], gathered: [{ item: 9, count: 2 }, { item: 'x', count: 1 }] });
  assert.deepEqual(tracker, { kills: [{ model: 5, name: 'Boar', count: 3 }], kills_total: 3, gathered: [{ item: 9, count: 2 }], looted: [] });
  for (const value of [null, [], 'x', 7]) assert.deepEqual(normalizeTracker(value), { kills: [], kills_total: 0, gathered: [], looted: [] });
  assert.equal(normalizeTracker(normalizeTracker({ kills: [{ model: 5, count: 3 }] })).kills_total, 3);
});

test('names the player gave are limited to ticket and item ids and bounded', () => {
  const names = normalizeIdNames({ 'ticket:12': ' Daily ', 'item:5': 'Aether\u0007', 'ticket:0': 'No', 'other:1': 'No', 'item:1': '', 'item:x': 'No', 'item:7': 'x'.repeat(100) });
  assert.deepEqual(Object.keys(names), ['ticket:12', 'item:5', 'item:7']);
  assert.equal(names['ticket:12'], 'Daily'); assert.equal(names['item:7'].length, 40);
  for (const value of [null, [], 'x', 7]) assert.deepEqual(normalizeIdNames(value), {});
  assert.equal(Object.keys(normalizeIdNames(Object.fromEntries(Array.from({ length: 900 }, (_, index) => [`item:${index + 1}`, 'n'])))).length, 200);
  assert.equal(idLabel(names, 'ticket', 12, 'fallback'), 'Daily'); assert.equal(idLabel(names, 'ticket', 13, 'fallback'), 'fallback'); assert.equal(idLabel(null, 'item', 1, 'f'), 'f');
  assert.deepEqual(normalizePreferences({ idNames: { 'ticket:12': 'Daily' } }).idNames, { 'ticket:12': 'Daily' });
  assert.deepEqual(normalizePreferences({}).idNames, {});
});

test('the ticket list counts down from when it was observed and drops empty tickets', () => {
  const now = 1_760_000_000_000;
  const rows = ticketRows({ source: 'server-contents-ticket', tickets: [{ ticket_id: 60_000_001, count: 5, bonus: 1, time_left_ms: 10_000, observed_at_ms: now - 4000 }, { ticket_id: 3, count: 0, bonus: 0, time_left_ms: 1000, observed_at_ms: now - 5000 }, { ticket_id: 4, count: 0, bonus: 0, time_left_ms: 0, observed_at_ms: now }] }, { now, locale: 'en' });
  assert.deepEqual(rows.map(row => [row.name, row.count, row.bonus, row.left_ms]), [['Odyle Energy', 5, 1, 6000], ['Nightmare Attempt Count', 0, 0, 0], ['Lower Abyss Access Hours', 0, 0, 0]]);
  assert.equal(rows[1].category, 'Nightmare');
  for (const resources of [null, {}, { source: 'x', tickets: [] }, { source: 'server-contents-ticket', tickets: 'x' }, { source: 'server-contents-ticket', awaiting_identity: true, tickets: [{ ticket_id: 1, count: 1 }] }]) assert.deepEqual(ticketRows(resources, { now }), []);
  assert.equal(clockText(0), '0:00'); assert.equal(clockText(65_000), '1:05'); assert.equal(clockText(25_200_000), '7:00:00');
});

test('assists stay unknown until the engine reports them and the new state fields normalize twice', () => {
  assert.equal(normalizePvp({ kills: 1 }).assists, null);
  assert.equal(normalizePvp({ assists: 5 }).assists, 5);
  assert.equal(normalizePvp({ assists: -1 }).assists, null);
  assert.equal(normalizePvp({ assists: 99_999 }).assists, 255);
  const state = normalizeState({ party: [{ id: 1, name: 'Mira', hp: 1, hp_max: 2 }], tracker: { kills: [{ model: 5, count: 2 }] }, pvp: { assists: 3 } });
  assert.equal(state.party[0].name, 'Mira'); assert.equal(state.tracker.kills_total, 2); assert.equal(state.pvp.assists, 3);
  const again = normalizeState(state);
  assert.deepEqual([again.party, again.tracker, again.pvp.assists], [state.party, state.tracker, 3]);
});

test('the room keeps real members, bounded fields and counts the leader as ready', () => {
  const room = normalizeRoom({ title: ' Fire\u0007 ', kind: 3, dungeon_id: 2_000_031, members: [
    { id: '651614571085448170', name: 'Mira', server: 2315, class: 'Ranger', level: 45, gear_score: 2262, combat_power: 122_800, ready: false, leader: true, is_self: true },
    { id: '651614571085448170', name: 'Dup', combat_power: 1 }, { id: '0', name: 'Zero' }, { id: '5', name: '' }, null,
    { id: '7', name: 'Odd', class: 'Wizard', gear_score: 99_999_999, combat_power: -5, level: 'x', ready: 'yes' },
    { id: '8', name: 'Ready', combat_power: 100_000, ready: true },
  ] });
  assert.equal(room.title, 'Fire'); assert.deepEqual(room.members.map(row => row.name), ['Mira', 'Odd', 'Ready']);
  const odd = room.members[1];
  assert.deepEqual([odd.class, odd.gear_score, odd.combat_power, odd.level, odd.ready], [null, 0, 0, 0, false]);
  assert.deepEqual(roomSummary(room), { total: 3, ready: 2, average_power: 111_400 });
  assert.deepEqual(roomSummary(null), { total: 0, ready: 0, average_power: null });
  for (const value of [null, [], 'x', 7]) assert.equal(normalizeRoom(value), null);
  assert.deepEqual(normalizeRoom(room), room);
  assert.equal(normalizeRoom({ members: Array.from({ length: 80 }, (_, index) => ({ id: String(index + 1), name: `P${index}` })) }).members.length, 30);
});

test('currencies, caps, loot and the number formats', () => {
  assert.deepEqual(normalizeCurrencies([{ item: 930_100_003, count: 5 }, { item: 930_100_001, count: 9 }, { item: 0, count: 1 }, { item: 4, count: 0 }, null]), [{ item: 930_100_001, count: 9 }, { item: 930_100_003, count: 5 }]);
  assert.deepEqual(normalizeCurrencies('x'), []);
  assert.deepEqual(normalizeIdCaps({ 'ticket:12': 14, 'ticket:13': 0, 'ticket:14': 1.5, 'item:1': 5, 'ticket:15': 'x', 'ticket:16': 100_000 }), { 'ticket:12': 14 });
  assert.deepEqual(normalizeIdCaps(null), {});
  assert.deepEqual(normalizePreferences({ idCaps: { 'ticket:12': 14 } }).idCaps, { 'ticket:12': 14 });
  assert.equal(normalizeTracker({ looted: [{ item: 5, count: 3 }, { item: 6, count: 0 }] }).looted.length, 1);
  assert.deepEqual(normalizeIdNames({ 'server:2315': 'KRO', 'server:0': 'No' }), { 'server:2315': 'KRO' });
  assert.equal(powerText(122_800), '122.8K'); assert.equal(powerText(1_234_000), '1.23M'); assert.equal(powerText(0), '—'); assert.equal(powerText(NaN), '—');
  assert.equal(groupedNumber(249_000), '249.000'); assert.equal(groupedNumber(249_000, 'en'), '249,000'); assert.equal(groupedNumber(NaN), '—');
  assert.equal(spanText(12_993_000), '3h 36m'); assert.equal(spanText(25_200_000), '7h'); assert.equal(spanText(120_000), '2m'); assert.equal(spanText(1000), '1s'); assert.equal(spanText(59_000), '59s');
  const rows = ticketRows({ source: 'server-contents-ticket', tickets: [{ ticket_id: 12, count: 14, bonus: 0, time_left_ms: 0, observed_at_ms: 1 }, { ticket_id: 3, count: 0, bonus: 0, time_left_ms: 5000, observed_at_ms: 1_760_000_000_000 }, { ticket_id: 60_000_001, count: 5, bonus: 0, time_left_ms: 0, observed_at_ms: 1 }] }, { now: 1_760_000_000_000, caps: { 'ticket:12': 14 } });
  assert.deepEqual(rows.map(row => [row.id, row.hero, row.kind, row.cap]), [[60_000_001, true, 'count', 560], [3, false, 'time', null]]);
  const chosen = ticketRows({ source: 'server-contents-ticket', tickets: [{ ticket_id: 12, count: 14, bonus: 0, time_left_ms: 0, observed_at_ms: 1 }, { ticket_id: 1, count: 9, bonus: 5, time_left_ms: 0, observed_at_ms: 1 }] }, { now: 1_760_000_000_000, caps: { 'ticket:12': 14 }, shown: [12] });
  assert.deepEqual(chosen.map(row => [row.id, row.cap]), [[12, 14]]);
});
