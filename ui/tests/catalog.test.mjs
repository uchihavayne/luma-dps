import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TICKETS, itemLabel, itemName, refillText, serverLabel, serverTag, splitTicketName, ticketInfo } from '../catalog.mjs';
import { ITEMS, SERVERS, TICKETS } from '../game-catalog.mjs';
import { normalizePreferences } from '../model.mjs';
import { normalizeTicketShow } from '../session-data.mjs';

test('the catalog holds the tickets, items and servers the packets leave unnamed', () => {
  assert.ok(Object.keys(TICKETS).length >= 60 && Object.keys(ITEMS).length >= 9000 && Object.keys(SERVERS).length >= 200);
  for (const [id, row] of Object.entries(TICKETS)) {
    assert.ok(Number(id) > 0 && row.name && row.name.length <= 120 && Number.isInteger(row.max) && row.max >= 0, id);
    if (row.refill) assert.ok(row.refill.every > 0 && row.refill.amount > 0 && ['daily-reset', 'weekly-reset'].includes(row.refill.from), id);
  }
  for (const [id, name] of Object.entries(ITEMS)) assert.ok(Number(id) > 0 && typeof name === 'string' && name && !/[\u0000-\u001f]/.test(name), id);
  for (const [id, [name, tag]] of Object.entries(SERVERS)) assert.ok(Number(id) > 0 && name && tag && tag.length <= 8 && !/[\u0000-\u001f]/.test(tag), id);
  // Facts the player's own game shows.
  assert.deepEqual([ticketInfo(60_000_001).name, ticketInfo(60_000_001).max, ticketInfo(60_000_001).memberMax], ['Odyle Energy', 560, 840]);
  assert.equal(ticketInfo(3).name, 'Lower Abyss Access Hours'); assert.equal(ticketInfo(3).max, 0);
  assert.equal(ticketInfo(1).memberMax, 21);
  assert.deepEqual([serverTag(2315), serverTag(2316)], ['ZEM', 'KRO']);
  assert.equal(itemName(930_100_003), 'Abyss Points');
  for (const id of DEFAULT_TICKETS) assert.ok(ticketInfo(id), `the usual ticket ${id} is in the catalog`);
});

test('a name the player typed beats the catalog, and an unknown id stays a number', () => {
  assert.equal(itemLabel({ 'item:930100003': 'Mine' }, 930_100_003), 'Mine');
  assert.equal(itemLabel({}, 930_100_003), 'Abyss Points');
  assert.equal(itemLabel(null, 4), 'Eşya #4'); assert.equal(itemLabel(null, 4, 'en'), 'Item #4');
  assert.equal(serverLabel({ 'server:2315': 'Home' }, 2315), 'Home'); assert.equal(serverLabel({}, 2315), 'ZEM'); assert.equal(serverLabel({}, 9), '9');
  assert.equal(ticketInfo(0), null); assert.equal(ticketInfo(-1), null); assert.equal(itemName('constructor'), null); assert.equal(serverTag('__proto__'), null);
});

test('ticket names split into category and name, and refill rules read as words', () => {
  assert.deepEqual(splitTicketName('[Daily Dungeon] Unknown Fissure Entry Count'), { category: 'Daily Dungeon', name: 'Unknown Fissure Entry Count' });
  assert.deepEqual(splitTicketName('Odyle Energy'), { category: null, name: 'Odyle Energy' });
  assert.deepEqual(splitTicketName('[Only]'), { category: null, name: '[Only]' });
  assert.equal(refillText(ticketInfo(60_000_001), false), '+15 her 3 sa');
  assert.equal(refillText(ticketInfo(60_000_001), false, 'en'), '+15 every 3h');
  assert.equal(refillText({ refill: { every: 86_400, amount: 3, memberAmount: 5 } }, true, 'en'), '+5 daily');
  assert.equal(refillText({ refill: { every: 604_800, amount: 14, memberAmount: 14 } }, false), '+14 haftalık');
  assert.equal(refillText({ refill: { every: 5400, amount: 1, memberAmount: 1 } }, false, 'en'), '+1 every 90m');
  assert.equal(refillText(ticketInfo(3), false), ''); assert.equal(refillText(null, false), '');
});

test('the chosen tickets are numbers, unique and bounded, and anything else means the usual list', () => {
  assert.deepEqual(normalizeTicketShow([4, 4, 101, 'x', -1, 1.5, 0]), [4, 101]);
  for (const value of [null, undefined, 'x', 7, {}, [], ['a']]) assert.equal(normalizeTicketShow(value), null);
  assert.equal(normalizeTicketShow(Array.from({ length: 200 }, (_, index) => index + 1)).length, 80);
  assert.deepEqual(normalizePreferences({ ticketShow: [4, 1] }).ticketShow, [4, 1]);
  assert.equal(normalizePreferences({}).ticketShow, null);
  assert.deepEqual(normalizePreferences(normalizePreferences({ ticketShow: [4, 1] })).ticketShow, [4, 1]);
});
