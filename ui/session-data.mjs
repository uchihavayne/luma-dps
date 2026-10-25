// The party's health, the room, this session's tracker, the ticket list, what the player carries and
// the names the player gave to ids the game does not name. Everything is bounded and survives garbage.
import { DEFAULT_TICKETS, refillText, splitTicketName, ticketInfo } from './catalog.mjs';

const ODYLE_TICKET_ID = 60_000_001;
const CLASSES = ['Gladiator', 'Templar', 'Ranger', 'Assassin', 'Spiritmaster', 'Sorcerer', 'Cleric', 'Chanter', 'Brawler'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const whole = (value, maximum = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : null;
const clean = (value, maximum) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum) : '';
// An entity id comes as a number from the engine and as a string once normalized.
const entityId = value => whole(typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : value, 0xffff_ffff);

export function normalizeParty(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).slice(0, 24).map(row => {
    if (!object(row)) return null;
    const id = entityId(row.id), hp = whole(row.hp, 1e12), max = whole(row.hp_max, 1e12), name = clean(row.name, 16);
    return id && name && hp !== null && max && hp <= max ? { id: String(id), name, hp, hp_max: max, is_self: row.is_self === true, observed_at_ms: whole(row.observed_at_ms) ?? 0 } : null;
  }).filter(row => row && !seen.has(row.id) && seen.add(row.id));
}

export const partyFraction = row => row.hp_max > 0 ? Math.max(0, Math.min(1, row.hp / row.hp_max)) : 0;

// The party finder room: who is in it with gear score, combat power and ready state.
export function normalizeRoom(value) {
  if (!object(value)) return null;
  const seen = new Set();
  const members = (Array.isArray(value.members) ? value.members : []).slice(0, 30).map(row => {
    if (!object(row)) return null;
    const id = typeof row.id === 'string' && /^[1-9]\d{0,19}$/.test(row.id) ? row.id : null, name = clean(row.name, 24);
    if (!id || !name) return null;
    return {
      id, name, server: whole(row.server, 65535) ?? 0, class: CLASSES.includes(row.class) ? row.class : null, level: whole(row.level, 200) ?? 0,
      gear_score: whole(row.gear_score, 100_000) ?? 0, combat_power: whole(row.combat_power, 1e11) ?? 0,
      ready: row.ready === true, leader: row.leader === true, is_self: row.is_self === true,
    };
  }).filter(row => row && !seen.has(row.id) && seen.add(row.id));
  return { title: clean(value.title, 64), kind: whole(value.kind, 255) ?? 0, dungeon_id: whole(value.dungeon_id, 0xffff_ffff) ?? 0, observed_at_ms: whole(value.observed_at_ms) ?? 0, members };
}

// "2/3 ready" counts the leader as ready, and the average combat power of the members that have one.
export function roomSummary(room) {
  const members = room?.members ?? [], ready = members.filter(row => row.ready || row.leader).length;
  const powers = members.map(row => row.combat_power).filter(power => power > 0);
  return { total: members.length, ready, average_power: powers.length ? Math.round(powers.reduce((sum, power) => sum + power, 0) / powers.length) : null };
}

const countRows = (value, key, limit) => (Array.isArray(value) ? value : []).slice(0, limit).map(row => {
  const id = object(row) ? whole(row[key], 0xffff_ffff) : null, count = object(row) ? whole(row.count, 1e15) : null;
  return id && count ? { [key]: id, count } : null;
}).filter(Boolean);

export function normalizeTracker(value) {
  const input = object(value) ? value : {};
  const kills = (Array.isArray(input.kills) ? input.kills : []).slice(0, 16).map(row => {
    const model = object(row) ? whole(row.model, 0xffff_ffff) : null, count = object(row) ? whole(row.count, 1e9) : null;
    return model && count ? { model, name: clean(row.name, 60) || null, count } : null;
  }).filter(Boolean);
  return { kills, kills_total: whole(input.kills_total, 1e9) ?? kills.reduce((sum, row) => sum + row.count, 0), gathered: countRows(input.gathered, 'item', 16), looted: countRows(input.looted, 'item', 16) };
}

// The currencies the player carries: item number and count.
export function normalizeCurrencies(value) {
  return countRows(value, 'item', 32).sort((a, b) => a.item - b.item);
}

// Names the player gave to ids the game sends without a name: "ticket:12", "item:531900003" and
// "server:2315".
export function normalizeIdNames(value) {
  const names = {};
  if (!object(value)) return names;
  for (const [key, name] of Object.entries(value).slice(0, 400)) {
    const text = clean(name, 40);
    if (/^(ticket|item|server):[1-9]\d{0,9}$/.test(key) && text && Object.keys(names).length < 200) names[key] = text;
  }
  return names;
}

// The most a ticket can hold, which the game does not send: "ticket:12" to a count.
export function normalizeIdCaps(value) {
  const caps = {};
  if (!object(value)) return caps;
  for (const [key, cap] of Object.entries(value).slice(0, 400)) {
    if (/^ticket:[1-9]\d{0,9}$/.test(key) && Number.isSafeInteger(cap) && cap >= 1 && cap <= 99_999 && Object.keys(caps).length < 200) caps[key] = cap;
  }
  return caps;
}

export const idLabel = (names, kind, id, fallback) => (object(names) && names[`${kind}:${id}`]) || fallback;

// The tickets worth showing, as numbers: the player's own list, or the default one when none was
// chosen. Anything else is refused.
export function normalizeTicketShow(value) {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.filter(id => Number.isSafeInteger(id) && id >= 1 && id <= 0xffff_ffff))].slice(0, 80);
  return ids.length ? ids : null;
}

// The tickets the game listed for the local player, with the name, the most each holds and how it
// refills from the catalog (what the player typed wins). The tickets shown are the chosen ones, or the
// usual ones, even when empty; a ticket the catalog has never heard of is shown when it holds
// something, so a new ticket is never hidden. Odyle is the hero; a ticket that holds hours is a time
// ticket.
export function ticketRows(resources, { names = {}, caps = {}, now = Date.now(), locale = 'tr', shown = null, member = null } = {}) {
  if (!object(resources) || resources.source !== 'server-contents-ticket' || resources.awaiting_identity === true || !Array.isArray(resources.tickets)) return [];
  const tr = locale !== 'en', order = normalizeTicketShow(shown) ?? DEFAULT_TICKETS, wanted = new Set(order);
  return resources.tickets.slice(0, 96).map(row => {
    if (!object(row)) return null;
    const id = whole(row.ticket_id, 0xffff_ffff), count = whole(row.count, 1e7), bonus = whole(row.bonus, 1e7) ?? 0;
    const listed = whole(row.time_left_ms, 1e10) ?? 0, seen = whole(row.observed_at_ms);
    if (!id || count === null) return null;
    const left = listed > 0 && seen !== null ? Math.max(0, listed - Math.max(0, now - seen)) : 0;
    const info = ticketInfo(id), hero = id === ODYLE_TICKET_ID, empty = count + bonus === 0 && left === 0;
    if (!hero && !wanted.has(id) && (info || empty)) return null;
    const split = info ? splitTicketName(info.name) : { category: null, name: '' };
    const typedName = idLabel(names, 'ticket', id, '');
    const catalogCap = info ? (member && info.memberMax ? info.memberMax : info.max) : 0;
    const cap = object(caps) && Number.isSafeInteger(caps[`ticket:${id}`]) ? caps[`ticket:${id}`] : catalogCap > 0 ? catalogCap : null;
    const name = typedName || split.name || `${tr ? 'Bilet' : 'Ticket'} #${id}`;
    return {
      id, name, category: split.category, named: Boolean(typedName || split.name), hero, count, bonus, cap, left_ms: left, rule: refillText(info, member === true, locale),
      kind: info && info.max === 0 || count + bonus === 0 && left > 0 ? 'time' : 'count',
    };
  }).filter(Boolean).sort((a, b) => {
    const place = row => row.hero ? -2 : order.includes(row.id) ? order.indexOf(row.id) : Infinity;
    return place(a) - place(b) || a.id - b.id;
  }).slice(0, 40);
}

export function clockText(milliseconds) {
  const total = Math.ceil(Math.max(0, milliseconds) / 1000), hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// "3h 36m", "7h", "12m": how long a ticket lasts or when it refills, rounded down as the game's
// own timers are.
export function spanText(milliseconds) {
  if (!(milliseconds > 0)) return '0m';
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000), hours = Math.floor(minutes / 60);
  return hours ? `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : minutes ? `${minutes}m` : `${Math.max(1, Math.ceil(milliseconds / 1000))}s`;
}

// 122800 is "122.8K", 1.2 million "1.20M": combat power as the game's players write it.
export function powerText(number) {
  return !Number.isFinite(number) || number <= 0 ? '—' : number >= 1e6 ? `${(number / 1e6).toFixed(2)}M` : number >= 1e3 ? `${(number / 1e3).toFixed(1)}K` : String(Math.round(number));
}

export const groupedNumber = (number, locale = 'tr') => Number.isFinite(number) ? number.toLocaleString(locale === 'en' ? 'en-US' : 'tr-TR') : '—';
