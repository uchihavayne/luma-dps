const DAY = 86400000, MINUTE = 60000;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAYS = Object.freeze({ SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 });
const CHECKED = '2026-10-13';
const ATLAS = 'https://aion2atlas.app/';
const formatters = new Map(), occurrenceCache = new Map();
export const REGIONS = Object.freeze([{ id: 'EU', name: 'Europe' }]);
export const EVENT_DRAFTS = Object.freeze([{ name: 'Spacetime Rift', intervalMinutes: 180 }, { name: 'Shugo Festival', intervalMinutes: null }, { name: 'Dimensional Invasion', intervalMinutes: null }, { name: 'Artifact Siege', intervalMinutes: null }]);
const bounded = (value, low, high, fallback) => Number.isFinite(Number(value)) ? Math.max(low, Math.min(high, Number(value))) : fallback;
const clean = (value, maximum = 96) => typeof value === 'string' ? value.slice(0, maximum).replace(/[\u0000-\u001f]/g, '') : '';
const utc = (parts) => Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0);
const dayKey = parts => String(parts.year) + '-' + String(parts.month) + '-' + String(parts.day);

function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    if (formatters.size >= 32) formatters.clear();
    formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  }
  return formatters.get(timeZone);
}
function partsAt(instant, timeZone) {
  const parts = {};
  for (const part of formatter(timeZone).formatToParts(instant)) if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) parts[part.type] = Number(part.value);
  return parts;
}
function validZone(value) {
  const zone = clean(value || 'UTC', 80);
  try { formatter(zone).format(0); return zone; } catch { return null; }
}
function localInstants(parts, timeZone, fold = 'earlier') {
  const wall = utc(parts), offsets = new Set();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const sample = wall + delta * 3600000;
    offsets.add(utc(partsAt(sample, timeZone)) - sample);
  }
  const candidates = [];
  for (const offset of offsets) {
    const instant = wall - offset, found = partsAt(instant, timeZone);
    if (['year', 'month', 'day', 'hour', 'minute'].every(key => found[key] === (parts[key] || 0))) candidates.push(instant);
  }
  const unique = [...new Set(candidates)].sort((a, b) => a - b);
  if (fold === 'both') return unique;
  return unique.length ? [fold === 'later' ? unique[unique.length - 1] : unique[0]] : [];
}
function validTime(value) { return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
function source(value = {}) {
  let url = '';
  try { const parsed = new URL(value.url); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) url = parsed.href; } catch {}
  return { url, label: clean(value.label || 'Community schedule', 80), status: ['official', 'community', 'user', 'unverified'].includes(value.status) ? value.status : 'unverified', checkedAt: clean(value.checkedAt, 40), publishedAt: clean(value.publishedAt, 40), provider: clean(value.provider, 40) };
}
function normalizeRule(input = {}, timeZone, depth = 0) {
  if (!input || typeof input !== 'object' || depth > 2) return null;
  if (input.kind === 'interval') {
    const anchorUtcMs = Number(input.anchorUtcMs), intervalMinutes = Number(input.intervalMinutes);
    if (!Number.isFinite(anchorUtcMs) || !Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 10080) return null;
    const count = input.count == null ? null : Number(input.count);
    if (count !== null && (!Number.isInteger(count) || count < 1 || count > 4096)) return null;
    return { kind: 'interval', anchorUtcMs, intervalMinutes, count, untilMs: Number.isFinite(input.untilMs) ? input.untilMs : null };
  }
  if (input.kind === 'weekly') {
    if (!Array.isArray(input.times) || !input.times.length || input.times.length > 48 || input.times.some(time => !validTime(time))) return null;
    if (input.weekdays !== undefined && !Array.isArray(input.weekdays)) return null;
    const weekdays = [...new Set(input.weekdays || ALL_DAYS)].sort((a, b) => a - b);
    if (!weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) return null;
    if (input.intervalWeeks !== undefined && input.intervalWeeks !== 1) return null;
    return { kind: 'weekly', weekdays, times: [...new Set(input.times)].sort(), notBeforeMs: Number.isFinite(input.notBeforeMs) ? input.notBeforeMs : null, untilMs: Number.isFinite(input.untilMs) ? input.untilMs : null, fold: ['earlier', 'later', 'both'].includes(input.fold) ? input.fold : 'earlier' };
  }
  if (input.kind === 'union' && Array.isArray(input.rules) && input.rules.length > 0 && input.rules.length <= 64) {
    const rules = input.rules.map(rule => normalizeRule(rule, timeZone, depth + 1));
    return rules.every(Boolean) ? { kind: 'union', rules } : null;
  }
  return null;
}
function normalizeEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const timeZone = validZone(value.timeZone), recurrence = timeZone && normalizeRule(value.recurrence, timeZone);
  if (!recurrence || !clean(value.id, 80) || !clean(value.name)) return null;
  const openMinutes = value.openMinutes === null || value.openMinutes === undefined ? null : bounded(value.openMinutes, 0, 1440, null);
  return { id: clean(value.id, 80), name: String(value.name).slice(0, 96).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''), region: clean(value.region || 'EU', 12), timeZone, recurrence, openMinutes, durationMinutes: value.durationMinutes == null ? null : bounded(value.durationMinutes, 0, 1440, null), source: source(value.source), enabled: value.enabled !== false, reminderEnabled: value.reminderEnabled === true, reminderLeadMinutes: bounded(value.reminderLeadMinutes, 0, 60, 5), custom: value.custom === true };
}

const clock = (weekdays, times) => ({ kind: 'weekly', weekdays, times });
const hourly = minute => clock(ALL_DAYS, Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0')));
const bundled = [
  { id: 'builtin:rift', name: 'Spacetime Rift', timeZone: 'UTC', recurrence: { kind: 'interval', anchorUtcMs: Date.UTC(2026, 9, 7), intervalMinutes: 180 }, openMinutes: 10, durationMinutes: 60, url: ATLAS + 'rift.ics' },
  { id: 'builtin:shugo', name: 'Shugo Festival', timeZone: 'UTC', recurrence: hourly(0), openMinutes: 10, url: 'https://shugo.gg/timers' },
  { id: 'builtin:invasion', name: 'Dimensional Invasion', timeZone: 'UTC', recurrence: hourly(30), openMinutes: 15, url: 'https://shugo.gg/timers' },
  { id: 'builtin:artifact-siege', name: 'Artifact Siege', timeZone: 'Europe/Berlin', recurrence: clock([1, 4, 6], ['21:00']), openMinutes: 30, url: ATLAS + 'calendar/bosses-eu.ics' },
  { id: 'builtin:siege-bosses', name: 'Siege Bosses', timeZone: 'Europe/Berlin', recurrence: clock([1, 4, 6], ['21:30']), openMinutes: null, durationMinutes: 30, url: ATLAS + 'calendar/bosses-eu.ics' },
  { id: 'builtin:nahma', name: 'Guardian Lord Nahma', timeZone: 'Europe/Berlin', recurrence: clock([5, 0], ['21:00']), openMinutes: null, durationMinutes: 30, url: 'https://aion2tierlist.com/world-boss-timer/' },
  { id: 'builtin:kaira', name: 'Watcher Kaira', timeZone: 'Europe/Berlin', recurrence: clock(ALL_DAYS, ['01:00', '04:00', '07:00', '10:00', '13:00', '16:00', '19:00', '22:00']), openMinutes: null, durationMinutes: 30, url: ATLAS + 'calendar/bosses-eu.ics' },
  { id: 'builtin:daily-reset', name: 'Daily reset', timeZone: 'UTC', recurrence: clock(ALL_DAYS, ['07:00']), openMinutes: 0, url: ATLAS + 'resets.ics' },
  { id: 'builtin:weekly-reset', name: 'Weekly reset', timeZone: 'UTC', recurrence: clock([3], ['07:00']), openMinutes: 0, url: ATLAS + 'resets.ics' },
];
function defaults() {
  return bundled.map(event => normalizeEvent({ ...event, region: 'EU', source: { url: event.url, label: 'Community schedule', status: 'community', checkedAt: CHECKED, publishedAt: event.id === 'builtin:rift' ? '2026-10-07' : event.url.startsWith(ATLAS) ? '2026-10-12' : event.url.includes('shugo.gg') ? '2026-10-09' : '', provider: 'bundled' } }));
}

function ruleOccurrences(rule, zone, start, end) {
  if (rule.kind === 'union') return [...new Set(rule.rules.flatMap(part => ruleOccurrences(part, zone, start, end)))].sort((a, b) => a - b);
  if (rule.kind === 'interval') {
    const period = rule.intervalMinutes * MINUTE, first = Math.max(0, Math.ceil((start - rule.anchorUtcMs) / period));
    const results = [];
    for (let index = first; ; index++) {
      if (rule.count !== null && index >= rule.count) break;
      const at = rule.anchorUtcMs + index * period;
      if (at >= end || rule.untilMs !== null && at > rule.untilMs) break;
      if (results.length >= 4096) throw new Error('Calendar occurrence limit exceeded');
      results.push(at);
    }
    return results;
  }
  const first = partsAt(start, zone), last = partsAt(end, zone), from = Date.UTC(first.year, first.month - 1, first.day) - DAY, through = Date.UTC(last.year, last.month - 1, last.day) + DAY;
  if ((through - from) / DAY > 100) throw new Error('Calendar horizon limit exceeded');
  const results = [];
  for (let day = from; day <= through; day += DAY) {
    const date = new Date(day);
    if (!rule.weekdays.includes(date.getUTCDay())) continue;
    for (const time of rule.times) {
      const [hour, minute] = time.split(':').map(Number);
      const parts = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour, minute };
      for (const instant of localInstants(parts, zone, rule.fold)) if (instant >= start && instant < end && (rule.notBeforeMs === null || instant >= rule.notBeforeMs) && (rule.untilMs === null || instant <= rule.untilMs)) results.push(instant);
    }
  }
  return [...new Set(results)].sort((a, b) => a - b);
}
function nearOccurrences(event, now) {
  const localDate = partsAt(now, event.timeZone);
  const key = event.timeZone + '|' + dayKey(localDate) + '|' + JSON.stringify(event.recurrence);
  if (!occurrenceCache.has(key)) {
    if (occurrenceCache.size >= 128) occurrenceCache.clear();
    const approximate = Date.UTC(localDate.year, localDate.month - 1, localDate.day);
    occurrenceCache.set(key, ruleOccurrences(event.recurrence, event.timeZone, approximate - 2 * DAY, approximate + 10 * DAY));
  }
  return occurrenceCache.get(key);
}
function legacyEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const rawAnchor = value.anchor;
  // Existing custom timers used the user's own local input. New server presets
  // never enter this compatibility path or use an implicit device timezone.
  const anchor = typeof rawAnchor === 'number' ? rawAnchor : Date.parse(rawAnchor);
  return normalizeEvent({ id: value.id, name: value.name, region: 'custom', timeZone: 'UTC', recurrence: { kind: 'interval', anchorUtcMs: anchor, intervalMinutes: Number(value.intervalMinutes) }, openMinutes: value.openMinutes ?? null, source: { status: 'user', label: 'User-entered schedule', checkedAt: '' }, custom: true, reminderEnabled: value.reminderEnabled === true, reminderLeadMinutes: value.reminderLeadMinutes ?? 5 });
}
export function nextScheduledEvent(input, now = Date.now()) {
  const event = input?.recurrence ? normalizeEvent(input) : legacyEvent(input);
  if (!event || !Number.isFinite(now)) return null;
  let occurrences;
  try {
    if (event.recurrence.kind === 'interval') {
      const rule = event.recurrence, period = rule.intervalMinutes * MINUTE, rawIndex = Math.floor((now - rule.anchorUtcMs) / period), previousIndex = Math.min(rawIndex, rule.count === null ? Infinity : rule.count - 1, rule.untilMs === null ? Infinity : Math.floor((rule.untilMs - rule.anchorUtcMs) / period)), nextIndex = Math.max(0, rawIndex + 1);
      const accepts = index => index >= 0 && (rule.count === null || index < rule.count) && (rule.untilMs === null || rule.anchorUtcMs + index * period <= rule.untilMs);
      occurrences = [previousIndex, nextIndex].filter(accepts).map(index => rule.anchorUtcMs + index * period);
    } else occurrences = nearOccurrences(event, now);
  } catch { return null; }
  const previous = occurrences.filter(at => at <= now).at(-1) ?? null;
  const nextOpening = occurrences.find(at => at > now) ?? null;
  const closesAt = previous === null || !event.openMinutes ? null : previous + event.openMinutes * MINUTE;
  const isOpen = closesAt !== null && now < closesAt;
  const eventClosesAt = previous === null || !event.durationMinutes ? null : previous + event.durationMinutes * MINUTE;
  if (nextOpening === null && !isOpen) return null;
  const remainingMs = Math.max(0, isOpen ? closesAt - now : nextOpening - now);
  return { nextOpening, remainingMs, status: isOpen ? 'open' : 'upcoming', opensAt: isOpen ? previous : nextOpening, closesAt: isOpen ? closesAt : nextOpening === null || !event.openMinutes ? null : nextOpening + event.openMinutes * MINUTE, eventActive: eventClosesAt !== null && now < eventClosesAt, eventClosesAt, timeZone: event.timeZone, next: nextOpening, remaining: remainingMs };
}

export function eventReminder(input, now = Date.now()) {
  if (input?.reminderEnabled !== true || input?.enabled === false || !Number.isFinite(now)) return null;
  const event = input.recurrence ? normalizeEvent(input) : legacyEvent(input);
  if (!event) return null;
  const timing = nextScheduledEvent(event, now);
  let previous = null;
  if (event.recurrence.kind === 'interval') {
    const rule = event.recurrence, period = rule.intervalMinutes * MINUTE, index = Math.floor((now - rule.anchorUtcMs) / period);
    if (index >= 0 && (rule.count === null || index < rule.count) && (rule.untilMs === null || rule.anchorUtcMs + index * period <= rule.untilMs)) previous = rule.anchorUtcMs + index * period;
  } else {
    try { previous = nearOccurrences(event, now).filter(at => at <= now).at(-1) ?? null; } catch { return null; }
  }
  const leadMinutes = event.reminderLeadMinutes;
  if (previous !== null && now - previous < 5000) return { key: event.id + ':' + previous + ':opened', next: previous, remaining: 0, leadMinutes };
  if (!timing || timing.nextOpening === null) return null;
  const remaining = timing.nextOpening - now;
  return remaining <= leadMinutes * MINUTE ? { key: event.id + ':' + timing.nextOpening + ':upcoming', next: timing.nextOpening, remaining, leadMinutes } : null;
}

function icsDate(value, zone) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!match) throw new Error('Unsupported calendar date');
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6]) };
  if (parts.year < 1970 || parts.year > 2100 || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31 || parts.hour > 23 || parts.minute > 59 || parts.second !== 0) throw new Error('Invalid calendar date');
  const reference = new Date(utc(parts));
  if (reference.getUTCFullYear() !== parts.year || reference.getUTCMonth() + 1 !== parts.month || reference.getUTCDate() !== parts.day) throw new Error('Invalid calendar date');
  const timeZone = match[7] ? 'UTC' : zone ? validZone(zone) : null;
  if (!timeZone) throw new Error('Calendar timezone missing');
  const instants = timeZone === 'UTC' ? [utc(parts)] : localInstants(parts, timeZone);
  if (!instants.length) throw new Error('Calendar start falls in a timezone gap');
  return { instant: instants[0], parts, timeZone };
}
function calendarRows(body) {
  if (typeof body !== 'string' || new TextEncoder().encode(body).length > 128 * 1024) throw new Error('Calendar document limit exceeded');
  const lines = body.replace(/^\uFEFF/, '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/).filter(Boolean), stack = [], rows = [];
  let current = null;
  for (const line of lines) {
    if (line.length > 4096) throw new Error('Calendar line limit exceeded');
    if (line.startsWith('BEGIN:')) {
      const component = line.slice(6);
      if (stack.length > 8) throw new Error('Calendar nesting limit exceeded');
      if (component === 'VEVENT') { if (current || stack.at(-1) !== 'VCALENDAR') throw new Error('Invalid event nesting'); current = new Map(); }
      stack.push(component); continue;
    }
    if (line.startsWith('END:')) {
      const component = line.slice(4);
      if (stack.pop() !== component) throw new Error('Invalid calendar nesting');
      if (component === 'VEVENT') { rows.push(current); current = null; if (rows.length > 64) throw new Error('Calendar event limit exceeded'); }
      continue;
    }
    if (stack.at(-1) !== 'VEVENT' || !current) continue;
    const colon = line.indexOf(':'); if (colon < 1) throw new Error('Invalid calendar property');
    const header = line.slice(0, colon).split(';'), name = header[0].toUpperCase();
    if (!['DTSTART', 'DTEND', 'RRULE', 'SUMMARY', 'UID', 'DTSTAMP'].includes(name)) continue;
    if (current.has(name)) throw new Error('Duplicate calendar property');
    const parameters = new Map();
    for (const parameter of header.slice(1)) { const equals = parameter.indexOf('='); if (equals < 1) throw new Error('Invalid calendar parameter'); parameters.set(parameter.slice(0, equals).toUpperCase(), parameter.slice(equals + 1).replace(/^"|"$/g, '')); }
    current.set(name, { value: line.slice(colon + 1), parameters });
  }
  if (stack.length || current || !body.includes('BEGIN:VCALENDAR') || !body.includes('END:VCALENDAR') || !rows.length) throw new Error('Invalid calendar document');
  return rows;
}
function publishedId(feedId, row) {
  const title = row.get('SUMMARY')?.value.toLowerCase() || '', uid = row.get('UID')?.value.toLowerCase() || '';
  if (feedId === 'rift' && /rift/.test(title + uid)) return 'builtin:rift';
  if (feedId === 'resets' && /weekly/.test(title + uid)) return 'builtin:weekly-reset';
  if (feedId === 'resets' && /daily/.test(title + uid)) return 'builtin:daily-reset';
  if (feedId === 'bosses-eu') {
    if (/siege bosses|executors/.test(title + uid)) return 'builtin:siege-bosses';
    if (/artifact/.test(title + uid)) return 'builtin:artifact-siege';
    if (/watcher kaira|boss-kaira/.test(title + uid)) return 'builtin:kaira';
  }
  throw new Error('Unrecognized published event');
}
function publishedRule(row) {
  const startProperty = row.get('DTSTART'); if (!startProperty) throw new Error('Calendar start missing');
  const start = icsDate(startProperty.value, startProperty.parameters.get('TZID'));
  const ruleText = row.get('RRULE')?.value; if (!ruleText) throw new Error('Calendar recurrence missing');
  const fields = new Map();
  for (const pair of ruleText.split(';')) { const equals = pair.indexOf('='); if (equals < 1 || fields.has(pair.slice(0, equals))) throw new Error('Invalid recurrence'); fields.set(pair.slice(0, equals), pair.slice(equals + 1)); }
  if ([...fields.keys()].some(key => !['FREQ', 'INTERVAL', 'BYDAY', 'UNTIL', 'COUNT', 'WKST'].includes(key)) || fields.has('WKST') && fields.get('WKST') !== 'MO') throw new Error('Unsupported recurrence');
  const frequency = fields.get('FREQ'), interval = fields.has('INTERVAL') ? Number(fields.get('INTERVAL')) : 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 168) throw new Error('Invalid recurrence interval');
  const untilMs = fields.has('UNTIL') ? icsDate(fields.get('UNTIL'), start.timeZone).instant : null;
  if (untilMs !== null && untilMs < start.instant) throw new Error('Calendar ends before its first opening');
  let recurrence;
  if (frequency === 'HOURLY' && start.timeZone === 'UTC' && !fields.has('BYDAY')) recurrence = { kind: 'interval', anchorUtcMs: start.instant, intervalMinutes: interval * 60, count: fields.has('COUNT') ? Number(fields.get('COUNT')) : null, untilMs };
  else if ((frequency === 'DAILY' || frequency === 'WEEKLY') && interval === 1 && !fields.has('COUNT')) {
    const weekdays = frequency === 'DAILY' ? ALL_DAYS : fields.has('BYDAY') ? fields.get('BYDAY').split(',').map(day => DAYS[day]) : [new Date(utc(start.parts)).getUTCDay()];
    recurrence = { kind: 'weekly', weekdays, times: [String(start.parts.hour).padStart(2, '0') + ':' + String(start.parts.minute).padStart(2, '0')], notBeforeMs: start.instant, untilMs };
  } else throw new Error('Unsupported recurrence');
  const endProperty = row.get('DTEND');
  const end = endProperty ? icsDate(endProperty.value, endProperty.parameters.get('TZID') || start.timeZone).instant : start.instant;
  const duration = (end - start.instant) / MINUTE;
  if (duration < 0 || duration > 1440) throw new Error('Invalid calendar duration');
  return { recurrence, timeZone: start.timeZone, duration };
}
export function normalizePublishedFeeds(input) {
  const feeds = Array.isArray(input) ? input : input?.feeds;
  if (!Array.isArray(feeds) || feeds.length > 8) return [];
  const output = [];
  for (const feed of feeds) {
    try {
      if (!['rift', 'resets', 'bosses-eu'].includes(feed?.id)) continue;
      const rows = calendarRows(feed.body), grouped = new Map(), base = new Map(defaults().map(event => [event.id, event]));
      for (const row of rows) {
        const id = publishedId(feed.id, row), rule = publishedRule(row), original = base.get(id);
        const current = grouped.get(id);
        if (current && current.timeZone !== rule.timeZone) throw new Error('Conflicting calendar timezone');
        const publishedDate = /^(\d{4})(\d{2})(\d{2})/.exec(row.get('DTSTAMP')?.value || '');
        if (!current) grouped.set(id, { ...original, recurrence: { kind: 'union', rules: [] }, timeZone: rule.timeZone, openMinutes: ['builtin:rift', 'builtin:artifact-siege'].includes(id) ? rule.duration : original.openMinutes, source: { ...original.source, url: clean(feed.url, 500), label: 'Published community calendar', provider: 'subscription', checkedAt: Number.isFinite(feed.fetched_at_ms) ? new Date(feed.fetched_at_ms).toISOString() : '', publishedAt: publishedDate ? publishedDate.slice(1).join('-') : '', status: 'community' } });
        grouped.get(id).recurrence.rules.push(rule.recurrence);
      }
      const normalized = [...grouped.values()].map(normalizeEvent);
      if (normalized.some(event => !event)) throw new Error('Invalid calendar event');
      output.push(...normalized);
    } catch { /* An unsupported document cannot partially replace its bundled events. */ }
  }
  return output;
}
export function builtInEvents(preferences = {}, remoteData = null) {
  if (preferences.calendarRegion && preferences.calendarRegion !== 'EU') return [];
  const overrides = new Map(normalizePublishedFeeds(remoteData).map(event => [event.id, event]));
  return defaults().map(original => {
    const event = overrides.get(original.id) || original;
    const user = preferences.builtInOverrides?.[event.id], reminder = preferences.builtInReminders?.[event.id];
    const updated = user && typeof user === 'object' ? normalizeEvent({ ...event, ...user, id: event.id, source: { ...event.source, status: 'user', label: 'Custom override' } }) : event;
    return { ...(updated || event), enabled: !(Array.isArray(preferences.disabledBuiltInIds) && preferences.disabledBuiltInIds.includes(event.id)), reminderEnabled: reminder?.enabled === true, reminderLeadMinutes: bounded(reminder?.leadMinutes, 0, 60, 5) };
  });
}
export function allEvents(preferences = {}, remoteData = null) {
  const custom = (Array.isArray(preferences.events) ? preferences.events : []).slice(0, 64).map(event => event.recurrence ? normalizeEvent({ ...event, custom: true, source: { ...event.source, status: 'user' } }) : legacyEvent(event)).filter(Boolean);
  return [...builtInEvents(preferences, remoteData), ...custom];
}

function icsText(value) { return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '').replaceAll(',', '\\,').replaceAll(';', '\\;'); }
function icsStamp(value) { return new Date(value).toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z'); }
function foldLine(line) {
  const lines = []; let current = '', bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75) { lines.push(current); current = ' '; bytes = 1; }
    current += character; bytes += size;
  }
  lines.push(current); return lines.join('\r\n');
}
export function calendarIcs(inputs, { now = Date.now(), horizonDays = 30, locale = 'tr' } = {}) {
  if (!Array.isArray(inputs) || inputs.length > 128 || !Number.isFinite(now)) throw new Error('Invalid calendar export');
  if (!Number.isInteger(Number(horizonDays)) || Number(horizonDays) < 1 || Number(horizonDays) > 60) throw new Error('Calendar horizon limit exceeded');
  const horizon = bounded(horizonDays, 1, 60, 30), end = now + horizon * DAY, stamp = icsStamp(now), lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Luma DPS//Local event calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  let total = 0;
  for (const input of inputs) {
    const event = input?.recurrence ? normalizeEvent(input) : legacyEvent(input);
    if (!event || !event.enabled) continue;
    for (const at of ruleOccurrences(event.recurrence, event.timeZone, now, end)) {
      if (++total > 4096) throw new Error('Calendar occurrence limit exceeded');
      const description = (locale === 'en' ? 'Schedule reference; availability is not confirmed. Source: ' : 'Takvim referansı; erişim doğrulanmaz. Kaynak: ') + event.source.label + ' (' + event.source.status + '). ' + event.source.url;
      lines.push('BEGIN:VEVENT', 'UID:' + icsText(event.id + '-' + at + '@luma.local'), 'DTSTAMP:' + stamp, 'DTSTART:' + icsStamp(at));
      if (event.openMinutes > 0) lines.push('DTEND:' + icsStamp(at + event.openMinutes * MINUTE));
      lines.push('SUMMARY:' + icsText(event.name), 'DESCRIPTION:' + icsText(description), 'X-LUMA-SOURCE-STATUS:' + event.source.status, 'X-LUMA-TIMEZONE:' + icsText(event.timeZone));
      if (event.reminderEnabled) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT' + event.reminderLeadMinutes + 'M', 'DESCRIPTION:' + icsText(event.name), 'END:VALARM');
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  if (total === 0) throw new Error('No scheduled opening in the selected horizon');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
export function exportEventCalendar(event, options = {}) { return calendarIcs([event], options); }
