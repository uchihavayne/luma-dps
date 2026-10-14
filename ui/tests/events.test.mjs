import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_DRAFTS, eventReminder, exportEventCalendar } from '../events.mjs';
import { normalizePreferences } from '../model.mjs';

const event = () => ({ id: 'user-event', name: 'My timer', intervalMinutes: 180, anchor: '2026-10-13T09:00:00+03:00', reminderEnabled: true, reminderLeadMinutes: 10 });

test('drafts contain no official anchor and unknown event intervals stay unfilled', () => {
  assert.deepEqual(EVENT_DRAFTS.filter(draft => draft.intervalMinutes === null).map(draft => draft.name), ['Shugo Festival', 'Dimensional Invasion', 'Artifact Siege']);
  assert.equal(EVENT_DRAFTS.some(draft => 'anchor' in draft), false);
});

test('each reminder obeys its enabled state and own lead without needing to be the selected header timer', () => {
  const now = Date.parse('2026-10-13T08:51:00+03:00');
  assert.equal(eventReminder(event(), now).remaining, 9 * 60000);
  assert.equal(eventReminder({ ...event(), reminderEnabled: false }, now), null);
  assert.equal(eventReminder({ ...event(), reminderLeadMinutes: 2 }, now), null);
  assert.equal(eventReminder({ ...event(), anchor: '' }, now), null);
  assert.equal(eventReminder({ ...event(), reminderLeadMinutes: 0 }, Date.parse(event().anchor) + 1000).remaining, 0);
});

test('calendar exports a finite UTC occurrence set and explicitly identifies the user source', () => {
  const calendar = exportEventCalendar(event(), { now: Date.parse('2026-10-13T05:55:00Z'), horizonDays: 1, locale: 'en' });
  assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 8);
  assert.ok(calendar.includes('DTSTART:20261013T060000Z\r\n'));
  assert.ok(calendar.includes('TRIGGER:-PT10M')); assert.ok(calendar.replace(/\r\n /g, '').includes('User-entered schedule'));
  assert.equal(calendar.includes('RRULE'), false); assert.equal(calendar.includes('TZID'), false);
  assert.equal(calendar.includes('DTEND'), false); // Event duration is not supplied by the player.
});

test('calendar text escapes delimiter/newline injection and folds by UTF-8 bytes without splitting Unicode', () => {
  const name = 'Şugo, festival; \\ evening\r\nBEGIN:VALARM';
  const calendar = exportEventCalendar({ ...event(), name }, { now: Date.parse('2026-10-13T05:55:00Z'), horizonDays: 1 });
  assert.ok(calendar.includes('Şugo\\, festival\\; \\\\ evening\\nBEGIN:VALARM'));
  for (const line of calendar.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal((calendar.match(/\r\nBEGIN:VALARM/g) || []).length, 8);
  const unicode = exportEventCalendar({ ...event(), name: '世'.repeat(80) }, { now: Date.parse('2026-10-13T05:55:00Z'), horizonDays: 1 });
  assert.equal(unicode.includes('\ufffd'), false);
  assert.ok(unicode.includes('\r\n '));
});

test('disabled reminders omit alarms; invalid and excessive schedules are rejected rather than silently truncated', () => {
  const calendar = exportEventCalendar({ ...event(), reminderEnabled: false }, { now: Date.parse('2026-10-13T05:55:00Z'), horizonDays: 1 });
  assert.equal(calendar.includes('VALARM'), false);
  assert.throws(() => exportEventCalendar(event(), { horizonDays: 61 }));
  assert.throws(() => exportEventCalendar({ ...event(), anchor: 'bad' }));
  assert.throws(() => exportEventCalendar({ ...event(), intervalMinutes: 1 }, { now: Date.parse(event().anchor), horizonDays: 4 }));
  assert.equal((exportEventCalendar({ ...event(), anchor: '2026-12-01T00:00:00Z' }, { now: Date.parse('2026-12-01T00:00:00Z'), horizonDays: 1 }).match(/BEGIN:VEVENT/g) || []).length, 8);
});

test('per-event reminder settings survive preference storage while imported themes omit schedules', () => {
  const prefs = normalizePreferences({ events: [{ ...event(), reminderEnabled: false, reminderLeadMinutes: 17 }] });
  assert.equal(prefs.events[0].reminderEnabled, false); assert.equal(prefs.events[0].reminderLeadMinutes, 17);
});
