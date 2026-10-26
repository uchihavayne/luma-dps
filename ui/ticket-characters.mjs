// The tickets of the characters you played before. The game sends a character's tickets only while you
// play it, so Luma keeps what it last saw of each one (a few numbers per ticket, in the preferences) and
// shows it when that character is picked in the Tickets window. Odyle is carried forward by the rule that
// refills it; every other ticket is shown as it was last seen.
import { ticketInfo } from './catalog.mjs';
import { resourceStatus } from './resources.mjs';

const ODYLE_TICKET_ID = 60_000_001;
const MAX_CHARACTERS = 12, MAX_TICKETS = 96;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const whole = (value, maximum = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : null;
const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) : '';

// name -> { seen, member, tickets: [[id, count, bonus, left_ms]] }. `member` is when the membership ends
// (a time), false when there is none, null when the game did not say.
export function normalizeTicketCharacters(value) {
  if (!object(value)) return {};
  const rows = Object.entries(value).map(([key, row]) => {
    const name = clean(key), seen = object(row) ? whole(row.seen, 1e14) : null;
    if (!name || !seen || !Array.isArray(row.tickets)) return null;
    const ids = new Set();
    const tickets = row.tickets.slice(0, MAX_TICKETS).map(ticket => {
      if (!Array.isArray(ticket)) return null;
      const id = whole(ticket[0], 0xffff_ffff), count = whole(ticket[1], 1e7), bonus = whole(ticket[2], 1e7) ?? 0, left = whole(ticket[3], 1e10) ?? 0;
      return id && count !== null && !ids.has(id) && ids.add(id) ? [id, count, bonus, left] : null;
    }).filter(Boolean);
    const member = row.member === false ? false : whole(row.member, 4e12) >= 1_500_000_000_000 ? row.member : null;
    return tickets.length ? [name, { seen, member, tickets }] : null;
  }).filter(Boolean).sort((a, b) => b[1].seen - a[1].seen).slice(0, MAX_CHARACTERS);
  return Object.fromEntries(rows);
}

// The character being played and its tickets, when the game has named both and the tickets are that
// character's. Returns the same object when nothing changed, so a caller saves only a real change.
export function rememberCharacter(known, state, now = Date.now()) {
  const local = state?.live_team_identity?.local, resources = state?.resources;
  const name = clean(local?.name);
  if (!name || !Array.isArray(resources?.tickets) || !resourceStatus(resources, now, local?.actor_id).available) return known;
  const tickets = resources.tickets.slice(0, MAX_TICKETS).map(row => [whole(row?.ticket_id, 0xffff_ffff), whole(row?.count, 1e7), whole(row?.bonus, 1e7) ?? 0, whole(row?.time_left_ms, 1e10) ?? 0]).filter(row => row[0] && row[1] !== null);
  if (!tickets.length) return known;
  const membership = resources.membership, expires = whole(membership?.expires_at_ms, 4e12);
  const member = membership?.source !== 'server-benefit-list' ? null : membership.expires_at_ms === null ? false : expires !== null && expires >= 1_500_000_000_000 ? expires : null;
  const seen = Math.min(now, whole(resources.observed_at_ms) ?? now);
  const before = known?.[name];
  if (before && before.member === member && JSON.stringify(before.tickets) === JSON.stringify(tickets)) return known;
  return normalizeTicketCharacters({ ...known, [name]: { seen, member, tickets } });
}

// The characters to pick from: the one being played first, then the others, the latest played first.
export function characterChoices(known, liveName = '') {
  const live = clean(liveName), others = Object.entries(known ?? {}).filter(([name]) => name !== live).sort((a, b) => b[1].seen - a[1].seen).map(([name, row]) => ({ name, live: false, seen: row.seen }));
  return [...(live ? [{ name: live, live: true, seen: null }] : []), ...others];
}

// What the game would have told us for a remembered character, as the Tickets window reads it. Odyle has
// gained its refills since it was seen (a lower bound: the refills happen at fixed times of the day, so
// one more may already have landed), up to what the membership allows; the other tickets are as they were.
export function characterResources(entry, now = Date.now()) {
  if (!object(entry) || !Array.isArray(entry.tickets)) return null;
  const seen = Math.min(now, whole(entry.seen) ?? now);
  const member = typeof entry.member === 'number' ? entry.member > now : entry.member === false ? false : null;
  const rule = ticketInfo(ODYLE_TICKET_ID)?.refill;
  const every = (rule?.every ?? 0) * 1000, step = rule ? (member ? rule.memberAmount : rule.amount) : 0;
  const cap = member === null ? null : member ? 840 : 560;
  const refills = every > 0 && cap !== null ? Math.floor((now - seen) / every) : 0;
  const tickets = entry.tickets.map(([ticket_id, count, bonus, time_left_ms]) => {
    const gained = ticket_id === ODYLE_TICKET_ID && refills > 0 && count < cap ? Math.min(cap - count, refills * step) : 0;
    return { ticket_id, count: count + gained, bonus, time_left_ms, observed_at_ms: now, gained };
  });
  const odyle = tickets.find(row => row.ticket_id === ODYLE_TICKET_ID);
  return {
    resources: {
      source: 'server-contents-ticket', awaiting_identity: false, actor_id: '1', snapshot_complete: true, observed_at_ms: now,
      membership: member === null ? null : { source: 'server-benefit-list', observed_at_ms: now, expires_at_ms: member ? entry.member : null, active: member },
      odyle: odyle ? { ticket_id: ODYLE_TICKET_ID, base: odyle.count, bonus: odyle.bonus, total: odyle.count + odyle.bonus, time_left_ms: 0, observed_at_ms: now } : null,
      tickets: tickets.map(({ gained, ...row }) => row),
    },
    seen, age_ms: Math.max(0, now - seen), projected: Boolean(odyle?.gained), gained: odyle?.gained ?? 0,
  };
}

// "5h ago", "2d ago": how long ago a remembered character was last seen.
export function agoText(milliseconds, locale = 'tr') {
  const tr = locale !== 'en', minutes = Math.max(0, Math.floor(milliseconds / 60_000)), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  const span = days ? `${days}${tr ? ' g' : 'd'}` : hours ? `${hours}${tr ? ' sa' : 'h'}` : `${Math.max(1, minutes)}${tr ? ' dk' : 'm'}`;
  return tr ? `${span} önce` : `${span} ago`;
}
