import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, normalizeState } from '../model.mjs';
import { renderPanel } from '../overlay-panels.mjs';
import { ticketRows } from '../session-data.mjs';
import { resourceStatus } from '../resources.mjs';
import { agoText, characterChoices, characterResources, normalizeTicketCharacters, rememberCharacter } from '../ticket-characters.mjs';

const NOW = 1_800_000_000_000, HOUR = 3_600_000;
const live = (name, patch = {}, tickets = [{ ticket_id: 60_000_001, count: 105, bonus: 60 }, { ticket_id: 1, count: 9, bonus: 5 }, { ticket_id: 3, count: 0, bonus: 0, time_left_ms: 12_993_000 }]) => normalizeState({
  local_player_id: 7, local_identity_source: 'server', live_team_identity: { local: { actor_id: 7, name, class_name: 'Ranger', identity_source: 'server' }, party_member_ids: [], party_membership_source: 'unresolved' },
  resources: { source: 'server-contents-ticket', actor_id: 7, awaiting_identity: false, observed_at_ms: NOW - 1000,
    membership: { source: 'server-benefit-list', observed_at_ms: NOW - 1000, expires_at_ms: NOW + 86_400_000, active: true },
    odyle: { ticket_id: 60_000_001, base: 105, bonus: 60, total: 165, time_left_ms: 0, observed_at_ms: NOW - 1000 },
    tickets: tickets.map(row => ({ time_left_ms: 0, observed_at_ms: NOW - 1000, ...row })), ...patch },
});

test('the characters you played are remembered with their tickets, and only when the tickets are theirs', () => {
  const first = rememberCharacter({}, live('Mira'), NOW);
  assert.deepEqual(Object.keys(first), ['Mira']);
  assert.deepEqual(first.Mira.tickets, [[60_000_001, 105, 60, 0], [1, 9, 5, 0], [3, 0, 0, 12_993_000]]);
  assert.equal(first.Mira.member, NOW + 86_400_000);
  // Nothing new: the same object comes back, so nothing is saved.
  assert.equal(rememberCharacter(first, live('Mira'), NOW + 5000), first);
  // A change is a new object; a second character is kept beside the first.
  const changed = rememberCharacter(first, live('Mira', {}, [{ ticket_id: 60_000_001, count: 120, bonus: 60 }]), NOW + 9000);
  assert.notEqual(changed, first); assert.equal(changed.Mira.tickets[0][1], 120);
  const both = rememberCharacter(changed, live('Nox'), NOW + 20_000);
  assert.deepEqual(Object.keys(both).sort(), ['Mira', 'Nox']);
  // Tickets that are not the local character's (the identity says another actor), or no name: nothing is kept.
  assert.equal(rememberCharacter(first, normalizeState({ ...live('Other'), resources: { ...live('Other').resources, actor_id: 99 } }), NOW), first);
  assert.equal(rememberCharacter(first, normalizeState({ resources: live('Mira').resources }), NOW), first);
  assert.equal(rememberCharacter(first, normalizeState({}), NOW), first);
  // Without a membership record the membership is unknown, and a record without an end says there is none.
  assert.equal(rememberCharacter({}, live('Mira', { membership: null }), NOW).Mira.member, null);
  assert.equal(rememberCharacter({}, live('Mira', { membership: { source: 'server-benefit-list', observed_at_ms: NOW - 1000, expires_at_ms: null, active: false } }), NOW).Mira.member, false);
});

test('what was kept survives garbage and stays small', () => {
  assert.deepEqual(normalizeTicketCharacters(null), {}); assert.deepEqual(normalizeTicketCharacters([1]), {}); assert.deepEqual(normalizeTicketCharacters('x'), {});
  const messy = normalizeTicketCharacters({
    Good: { seen: NOW, member: false, tickets: [[1, 5, 2, 0], [1, 9, 9, 9], [0, 1, 0, 0], ['x', 1], [2, -1, 0, 0], [3, 4]] },
    '': { seen: NOW, tickets: [[1, 1, 0, 0]] }, NoSeen: { tickets: [[1, 1, 0, 0]] }, NoTickets: { seen: NOW, tickets: [] }, Bad: 5,
    Late: { seen: NOW, member: 5, tickets: [[1, 1, 0, 0]] },
  });
  assert.deepEqual(Object.keys(messy).sort(), ['Good', 'Late']);
  assert.deepEqual(messy.Good.tickets, [[1, 5, 2, 0], [3, 4, 0, 0]]); assert.equal(messy.Late.member, null);
  const many = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`C${index}`, { seen: NOW + index, member: false, tickets: [[1, index, 0, 0]] }]));
  const kept = Object.keys(normalizeTicketCharacters(many));
  assert.equal(kept.length, 12); assert.equal(kept[0], 'C29', 'the latest played are the ones kept');
  const prefs = normalizePreferences({ ticketCharacters: many, ticketCharacter: ` ${'x'.repeat(40)}\u0000` });
  assert.equal(Object.keys(prefs.ticketCharacters).length, 12); assert.equal(prefs.ticketCharacter.length, 24);
  assert.deepEqual(normalizePreferences({}).ticketCharacters, {}); assert.equal(normalizePreferences({}).ticketCharacter, '');
  assert.deepEqual(normalizePreferences({ ticketCharacters: prefs.ticketCharacters }).ticketCharacters, prefs.ticketCharacters, 'normalizing twice changes nothing');
});

test('a remembered character gains the Odyle its refills gave, within what its membership allows', () => {
  const entry = { seen: NOW - 7 * HOUR, member: NOW + 86_400_000, tickets: [[60_000_001, 450, 10, 0], [1, 9, 5, 0], [3, 0, 0, 12_993_000]] };
  const kept = characterResources(entry, NOW);
  // Seven hours is two refills of 15.
  assert.equal(kept.gained, 30); assert.equal(kept.projected, true); assert.equal(kept.age_ms, 7 * HOUR);
  const rows = ticketRows(kept.resources, { now: NOW, member: true });
  assert.equal(rows.find(row => row.hero).count, 480); assert.equal(rows.find(row => row.hero).bonus, 10);
  assert.equal(resourceStatus(kept.resources, NOW).base_capacity, 840);
  // The other tickets are as they were seen, and the hours do not run down while the character is away.
  assert.equal(rows.find(row => row.id === 1).count, 9);
  assert.equal(rows.find(row => row.id === 3).left_ms, 12_993_000);
  // Never past the cap: a plain player stops at 560, a member at 840.
  assert.equal(characterResources({ ...entry, member: false, tickets: [[60_000_001, 555, 0, 0]] }, NOW).resources.tickets[0].count, 560);
  assert.equal(characterResources({ ...entry, tickets: [[60_000_001, 835, 0, 0]] }, NOW).resources.tickets[0].count, 840);
  // A balance already over the cap (bonus energy) is left alone; no refill is guessed without a membership record.
  assert.equal(characterResources({ ...entry, member: false, tickets: [[60_000_001, 600, 0, 0]] }, NOW).gained, 0);
  assert.equal(characterResources({ ...entry, member: null }, NOW).gained, 0);
  // A membership that ended since it was seen caps at the plain limit.
  assert.equal(characterResources({ ...entry, member: NOW - HOUR, tickets: [[60_000_001, 555, 0, 0]] }, NOW).resources.tickets[0].count, 560);
  // Less than one refill since: as seen, and not marked as an estimate.
  const fresh = characterResources({ ...entry, seen: NOW - 2 * HOUR }, NOW);
  assert.equal(fresh.projected, false); assert.equal(fresh.resources.tickets[0].count, 450);
  assert.equal(characterResources(null, NOW), null); assert.equal(characterResources({ tickets: 5 }, NOW), null);
});

test('the choices put the character being played first and the others by when they were played', () => {
  const known = normalizeTicketCharacters({ Old: { seen: NOW - 9 * HOUR, member: false, tickets: [[1, 1, 0, 0]] }, Mid: { seen: NOW - 3 * HOUR, member: false, tickets: [[1, 1, 0, 0]] }, Mira: { seen: NOW - HOUR, member: false, tickets: [[1, 1, 0, 0]] } });
  assert.deepEqual(characterChoices(known, 'Mira').map(choice => [choice.name, choice.live]), [['Mira', true], ['Mid', false], ['Old', false]]);
  assert.deepEqual(characterChoices(known, '').map(choice => choice.name), ['Mira', 'Mid', 'Old']);
  assert.deepEqual(characterChoices({}, 'Mira'), [{ name: 'Mira', live: true, seen: null }]);
  assert.equal(agoText(5 * HOUR, 'en'), '5h ago'); assert.equal(agoText(30 * HOUR, 'tr'), '1 g önce'); assert.equal(agoText(10_000, 'en'), '1m ago');
});

test('the Tickets window picks a character with a chip, and says whose tickets these are when locked', () => {
  const known = normalizeTicketCharacters({ Nox: { seen: NOW - 7 * HOUR, member: NOW + 86_400_000, tickets: [[60_000_001, 450, 0, 0], [1, 3, 0, 0], [3, 0, 0, 7 * HOUR]] } });
  const state = live('Mira');
  const open = renderPanel('tickets', { state, now: NOW, locale: 'en', tickets: { known, selected: '', unlocked: true } });
  assert.match(open, /class="char" data-char="" aria-pressed="true"[^>]*>Mira<\/button><button type="button" class="char" data-char="Nox" aria-pressed="false"/);
  assert.match(open, /<b>105<\/b>/, 'the character being played is shown by default');
  assert.doesNotMatch(open, /class="seen"/);
  const other = renderPanel('tickets', { state, now: NOW, locale: 'en', tickets: { known, selected: 'Nox', unlocked: true } });
  assert.match(other, /data-char="Nox" aria-pressed="true"/); assert.match(other, /data-char="" aria-pressed="false"/);
  assert.match(other, /<b>~480<\/b>/); assert.match(other, /Last seen 7h ago · Odyle estimated \(\+30\)/);
  assert.match(other, /class="tile time"[^>]*><span class="icon"><img[^>]*><\/span><b>7h<\/b>/);
  assert.doesNotMatch(other, /<b>105<\/b>/);
  // Locked, no chips can be pressed, so the window only names the character it shows.
  const locked = renderPanel('tickets', { state, now: NOW, locale: 'en', tickets: { known, selected: 'Nox', unlocked: false } });
  assert.doesNotMatch(locked, /<button/); assert.match(locked, /Nox · Last seen 7h ago/);
  assert.doesNotMatch(renderPanel('tickets', { state, now: NOW, locale: 'en', tickets: { known, selected: '', unlocked: false } }), /class="seen"|<button/);
  // A name that is not remembered (or is the one being played) falls back to the live tickets; one character has no chips.
  assert.match(renderPanel('tickets', { state, now: NOW, locale: 'en', tickets: { known, selected: 'Gone', unlocked: true } }), /<b>105<\/b>/);
  assert.doesNotMatch(renderPanel('tickets', { state, now: NOW, locale: 'en', tickets: { known: {}, selected: '', unlocked: true } }), /<button/);
  // Before the game has sent this character's tickets the chips are still there, so another can be read.
  const waiting = renderPanel('tickets', { state: normalizeState({ live_team_identity: { local: { actor_id: 7, name: 'Mira', identity_source: 'server' } } }), now: NOW, locale: 'en', tickets: { known, selected: '', unlocked: true } });
  assert.match(waiting, /data-char="Nox"/); assert.match(waiting, /No ticket data/);
  // Names that came from the game are never markup.
  const hostile = normalizeTicketCharacters({ '<img src=x>': { seen: NOW, member: false, tickets: [[1, 1, 0, 0]] } });
  assert.doesNotMatch(renderPanel('tickets', { state, now: NOW, locale: 'en', tickets: { known: hostile, selected: '', unlocked: true } }), /<img src=x>/);
});

test('the Tickets window lays its tiles out in columns that follow its width', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../overlay.css', import.meta.url), 'utf8'), source = await readFile(new URL('../overlay-window.mjs', import.meta.url), 'utf8');
  assert.match(css, /\.board-body > \.tiles \{ grid-template-columns: repeat\(auto-fill, minmax\(128px, 1fr\)\);/);
  assert.match(css, /@container \(min-width: 600px\) \{ \.board-body \{ grid-template-columns: minmax\(200px, 270px\) minmax\(0, 1fr\);/, 'a wide window puts the card beside the tiles');
  assert.doesNotMatch(css, /\.time-row|\.times \{/, 'hours are tiles like the others, not a second stack');
  assert.match(source, /const NARROWEST = \{ tickets: 150 \}/, 'a narrow window gets one column and not a layout wider than itself');
});
