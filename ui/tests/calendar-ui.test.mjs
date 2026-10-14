import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, formatRate, compactNumber } from '../model.mjs';
import { allEvents, nextScheduledEvent, eventReminder } from '../events.mjs';

test('a fresh or migrated installation has a working Rift widget without entered calendar fields', () => {
  for (const input of [{}, { activeEventId: '' }]) {
    const preferences = normalizePreferences(input);
    const events = allEvents(preferences);
    const event = events.find(event => event.id === preferences.activeEventId);
    assert.ok(event); assert.equal(events.filter(event => event.id.startsWith('builtin:')).length, 9);
    assert.equal(preferences.events.length, 0);
    const timing = nextScheduledEvent(event, Date.parse('2026-10-13T05:10:00Z'));
    assert.equal(timing.nextOpening, Date.parse('2026-10-13T06:00:00Z'));
    assert.equal(timing.remainingMs, 50 * 60000);
  }
});

test('Shugo selection and its own reminder work independently of row/header damage display choices', () => {
  const preferences = normalizePreferences({ activeEventId: 'builtin:shugo', summaryMetric: 'damage', rowMetric: 'dps', builtInReminders: { 'builtin:shugo': { enabled: true, leadMinutes: 5 } } });
  const event = allEvents(preferences).find(event => event.id === preferences.activeEventId);
  const now = Date.parse('2026-10-13T05:57:00Z');
  assert.equal(nextScheduledEvent(event, now).nextOpening, Date.parse('2026-10-13T06:00:00Z'));
  assert.equal(eventReminder(event, now).remaining, 3 * 60000);
  assert.equal(compactNumber(12300), '12.3K'); assert.equal(formatRate(12300, 'tr'), '12.3K/sn');
  assert.equal(preferences.damageScope, 'personal'); assert.equal(preferences.summaryMetric, 'damage'); assert.equal(preferences.rowMetric, 'dps');
});
