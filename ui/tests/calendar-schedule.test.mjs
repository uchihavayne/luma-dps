import test from 'node:test';
import assert from 'node:assert/strict';
import { builtInEvents, allEvents, nextScheduledEvent, calendarIcs, eventReminder, normalizePublishedFeeds } from '../events.mjs';
const time = value => Date.parse(value);
const weekly = (zone, weekdays, times, extra = {}) => ({ id: 'test', name: 'Test event', timeZone: zone, recurrence: { kind: 'weekly', weekdays, times, ...extra }, openMinutes: 10, source: { status: 'user', label: 'Test' } });
const custom = () => ({ id: 'custom', name: 'My timer', intervalMinutes: 180, anchor: '2026-10-13T09:00:00+03:00', reminderEnabled: true, reminderLeadMinutes: 10 });
const calendar = entries => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n' + entries.join('\r\n') + '\r\nEND:VCALENDAR\r\n';
const entry = lines => 'BEGIN:VEVENT\r\n' + lines.join('\r\n') + '\r\nEND:VEVENT';
const feed = (id, body) => ({ id, url: 'https://aion2atlas.app/' + id + '.ics', body, fetched_at_ms: time('2026-10-13T12:00:00Z') });
test('nine EU offline clocks require no manual anchors and have no unsolicited reminders', () => {
  const events = builtInEvents({}); assert.equal(events.length, 9); assert.equal(events[0].id, 'builtin:rift'); assert.ok(events.every(event => event.recurrence && event.source.status === 'community' && !event.reminderEnabled)); assert.equal(builtInEvents({ calendarRegion: 'KR' }).length, 0);
});
test('Rift is every three UTC hours with portal access distinct from event duration', () => {
  const rift = builtInEvents()[0], open = nextScheduledEvent(rift, time('2026-10-13T00:05:00Z'));
  assert.equal(open.status, 'open'); assert.equal(open.remainingMs, 300000); assert.equal(open.nextOpening, time('2026-10-13T03:00:00Z'));
  const closed = nextScheduledEvent(rift, time('2026-10-13T00:11:00Z')); assert.equal(closed.status, 'upcoming'); assert.equal(closed.eventActive, true);
  assert.equal(nextScheduledEvent(rift, time('2026-10-26T00:01:00Z')).nextOpening, time('2026-10-26T03:00:00Z'));
});
test('hourly Shugo and invasion roll through UTC midnight', () => {
  const events = builtInEvents(), shugo = events.find(e => e.id === 'builtin:shugo'), invasion = events.find(e => e.id === 'builtin:invasion');
  assert.equal(nextScheduledEvent(shugo, time('2026-10-13T23:59:59Z')).nextOpening, time('2026-10-14T00:00:00Z'));
  assert.equal(nextScheduledEvent(invasion, time('2026-10-13T23:31:00Z')).status, 'open');
  assert.equal(nextScheduledEvent(invasion, time('2026-10-13T23:46:00Z')).nextOpening, time('2026-10-14T00:30:00Z'));
});
test('Berlin siege shifts with DST while global resets stay at 07 UTC', () => {
  const events = builtInEvents(), siege = events.find(e => e.id === 'builtin:artifact-siege'), reset = events.find(e => e.id === 'builtin:daily-reset');
  assert.equal(nextScheduledEvent(siege, time('2026-10-19T10:00:00Z')).nextOpening, time('2026-10-19T19:00:00Z'));
  assert.equal(nextScheduledEvent(siege, time('2026-10-26T10:00:00Z')).nextOpening, time('2026-10-26T20:00:00Z'));
  assert.equal(nextScheduledEvent(reset, time('2026-10-25T06:59:00Z')).nextOpening, time('2026-10-25T07:00:00Z'));
  assert.equal(nextScheduledEvent(events.find(e => e.id === 'builtin:weekly-reset'), time('2026-10-28T07:00:00Z')).nextOpening, time('2026-11-04T07:00:00Z'));
});
test('spring DST gaps are skipped and autumn folds have explicit policy', () => {
  const event = weekly('Europe/Berlin', [0], ['02:30']);
  assert.equal(nextScheduledEvent(event, time('2026-03-29T00:00:00Z')).nextOpening, time('2026-04-05T00:30:00Z'));
  assert.equal(nextScheduledEvent(event, time('2026-10-24T23:00:00Z')).nextOpening, time('2026-10-25T00:30:00Z'));
  assert.equal(nextScheduledEvent(weekly('Europe/Berlin', [0], ['02:30'], { fold: 'later' }), time('2026-10-24T23:00:00Z')).nextOpening, time('2026-10-25T01:30:00Z'));
});
test('future custom anchors and one-minute timers remain valid without expensive expansion', () => {
  assert.equal(nextScheduledEvent({ ...custom(), anchor: '2027-01-01T00:00:00Z' }, time('2026-10-13T00:00:00Z')).nextOpening, time('2027-01-01T00:00:00Z'));
  assert.equal(nextScheduledEvent({ ...custom(), intervalMinutes: 1 }, time(custom().anchor) + 1000).remainingMs, 59000); assert.equal(allEvents({ events: [custom()] }).length, 10);
});
test('reminders are opt-in per event and never mistake portal closure for opening', () => {
  assert.equal(eventReminder(custom(), time('2026-10-13T08:51:00+03:00')).remaining, 540000); assert.equal(eventReminder({ ...custom(), reminderEnabled: false }, time('2026-10-13T08:51:00+03:00')), null);
  const opening = eventReminder({ ...custom(), reminderLeadMinutes: 0 }, time(custom().anchor) + 1000); assert.equal(opening.remaining, 0); assert.match(opening.key, /:opened$/);
  const rift = builtInEvents({ builtInReminders: { 'builtin:rift': { enabled: true, leadMinutes: 5 } } })[0]; assert.equal(eventReminder(rift, time('2026-10-13T00:09:00Z')), null);
});
test('published UTC recurrence overrides only its own stable bundled event', () => {
  const body = calendar([entry(['UID:rift-global@atlas', 'DTSTART:20261007T010000Z', 'DTEND:20261007T011000Z', 'RRULE:FREQ=HOURLY;INTERVAL=3', 'SUMMARY:Aion 2 Spacetime Rift'])]);
  const events = builtInEvents({}, { feeds: [feed('rift', body)] }); assert.equal(events[0].source.provider, 'subscription'); assert.equal(nextScheduledEvent(events[0], time('2026-10-13T00:30:00Z')).nextOpening, time('2026-10-13T01:00:00Z')); assert.equal(events[1].source.provider, 'bundled');
});
test('Kaira records merge under one ID; publisher prose and alarms do not enter app reminders', () => {
  const body = calendar(['01:00', '04:00'].map(clock => entry(['UID:boss-kaira-' + clock, 'DTSTART;TZID=Europe/Paris:20261005T' + clock.replace(':', '') + '00', 'DTEND;TZID=Europe/Paris:20261005T' + clock.slice(0, 2) + '3000', 'RRULE:FREQ=DAILY;INTERVAL=1', 'SUMMARY:Aion 2: Watcher Kaira', 'DESCRIPTION:Do not execute this', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT10M', 'END:VALARM'])));
  const events = normalizePublishedFeeds([feed('bosses-eu', body)]); assert.equal(events.length, 1); assert.equal(events[0].id, 'builtin:kaira'); assert.equal(events[0].reminderEnabled, false); assert.equal(events[0].openMinutes, null);
  assert.equal(nextScheduledEvent(events[0], time('2026-10-26T01:00:00Z')).nextOpening, time('2026-10-26T03:00:00Z'));
});
test('malformed or unsupported published documents fail atomically to offline presets', () => {
  const good = entry(['UID:daily', 'DTSTART:20261005T070000Z', 'RRULE:FREQ=DAILY', 'SUMMARY:Daily reset']), bad = entry(['UID:weekly', 'DTSTART:20261007T070000', 'RRULE:FREQ=YEARLY', 'SUMMARY:Weekly reset']);
  assert.deepEqual(normalizePublishedFeeds([feed('resets', calendar([good, bad]))]), []);
  assert.equal(builtInEvents({}, { feeds: [feed('resets', calendar([good, bad]))] }).find(e => e.id === 'builtin:daily-reset').source.provider, 'bundled'); assert.deepEqual(normalizePublishedFeeds([feed('rift', 'x'.repeat(128 * 1024 + 1))]), []);
});
test('published interval COUNT stops recurrence instead of inventing indefinite openings', () => {
  const body = calendar([entry(['UID:rift', 'DTSTART:20261013T000000Z', 'DTEND:20261013T001000Z', 'RRULE:FREQ=HOURLY;INTERVAL=3;COUNT=2', 'SUMMARY:Spacetime Rift'])]), event = normalizePublishedFeeds([feed('rift', body)])[0];
  assert.equal(nextScheduledEvent(event, time('2026-10-13T03:05:00Z')).status, 'open'); assert.equal(nextScheduledEvent(event, time('2026-10-13T03:11:00Z')), null);
});
test('UNTIL also prevents alerts after a subscription has stopped', () => {
  const body = calendar([entry(['UID:rift', 'DTSTART:20261013T000000Z', 'DTEND:20261013T001000Z', 'RRULE:FREQ=HOURLY;INTERVAL=3;UNTIL=20261013T030000Z', 'SUMMARY:Spacetime Rift'])]);
  const event = { ...normalizePublishedFeeds([feed('rift', body)])[0], reminderEnabled: true, reminderLeadMinutes: 0 };
  assert.equal(nextScheduledEvent(event, time('2026-10-13T06:00:00Z')), null);
  assert.equal(eventReminder(event, time('2026-10-13T06:00:01Z')), null);
});
test('finite UTC ICS preserves DST and bounds export size and horizon', () => {
  const output = calendarIcs([weekly('Europe/Berlin', [1], ['21:00'])], { now: time('2026-10-19T00:00:00Z'), horizonDays: 8 });
  assert.match(output, /DTSTART:20261019T190000Z/); assert.match(output, /DTSTART:20261026T200000Z/); assert.equal(output.includes('RRULE'), false); assert.equal(output.includes('TZID'), false);
  assert.throws(() => calendarIcs([{ ...custom(), intervalMinutes: 1 }], { now: time(custom().anchor), horizonDays: 4 }), /limit/); assert.equal(nextScheduledEvent(weekly('not-a-zone', [1], ['21:00']), time(custom().anchor)), null);
});
test('disabled clocks remain selectable but reminders and calendar export obey disable state', () => {
  const events = builtInEvents({ disabledBuiltInIds: ['builtin:rift'], builtInReminders: { 'builtin:rift': { enabled: true, leadMinutes: 0 } } });
  assert.equal(events[0].enabled, false); assert.ok(nextScheduledEvent(events[0], time('2026-10-13T02:00:00Z'))); assert.equal(eventReminder(events[0], time('2026-10-13T03:00:00Z')), null); assert.throws(() => calendarIcs([events[0]], { now: time('2026-10-13T02:00:00Z') }), /No scheduled/);
});
test('UTF-8 BOM calendars are accepted; invalid zone and inverted rule bounds reject the whole document', () => {
  const good = calendar([entry(['UID:rift', 'DTSTART:20261013T000000Z', 'DTEND:20261013T001000Z', 'RRULE:FREQ=HOURLY;INTERVAL=3', 'SUMMARY:Spacetime Rift'])]);
  assert.equal(normalizePublishedFeeds([feed('rift', '\uFEFF' + good)]).length, 1);
  const wrongZone = calendar([entry(['UID:rift', 'DTSTART;TZID=Unknown/Zone:20261013T000000', 'RRULE:FREQ=DAILY', 'SUMMARY:Spacetime Rift'])]);
  assert.deepEqual(normalizePublishedFeeds([feed('rift', wrongZone)]), []);
  const inverted = calendar([entry(['UID:rift', 'DTSTART:20261013T000000Z', 'RRULE:FREQ=HOURLY;INTERVAL=3;UNTIL=20261012T000000Z', 'SUMMARY:Spacetime Rift'])]);
  assert.deepEqual(normalizePublishedFeeds([feed('rift', inverted)]), []);
});
