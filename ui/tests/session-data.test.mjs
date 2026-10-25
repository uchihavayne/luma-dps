import test from 'node:test';
import assert from 'node:assert/strict';
import { clockText, idLabel, normalizeIdNames, normalizeParty, normalizeTracker, partyFraction, ticketRows } from '../session-data.mjs';
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
  assert.deepEqual(tracker, { kills: [{ model: 5, name: 'Boar', count: 3 }], kills_total: 3, gathered: [{ item: 9, count: 2 }] });
  for (const value of [null, [], 'x', 7]) assert.deepEqual(normalizeTracker(value), { kills: [], kills_total: 0, gathered: [] });
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
  assert.deepEqual(rows.map(row => [row.name, row.count, row.bonus, row.left_ms]), [['Odyle', 5, 1, 6000]]);
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
