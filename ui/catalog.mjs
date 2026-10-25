// Names, caps and refill rules for the ids the game sends without them. The data is the reviewed
// snapshot in game-catalog.mjs (docs/reference-data.md); a name the player typed always wins.
import { BUFFS, ITEMS, SERVERS, TICKETS } from './game-catalog.mjs';

// The tickets players keep an eye on: Odyle, the entry counts and keys, then the abyss hours.
export const DEFAULT_TICKETS = Object.freeze([60_000_001, 4, 101, 80_000_001, 1, 8, 3, 9, 13]);

export const ticketInfo = id => Object.hasOwn(TICKETS, id) ? TICKETS[id] : null;
export const itemName = id => Object.hasOwn(ITEMS, id) ? ITEMS[id] : null;
// An effect the game shows: its name, the control it applies (stun, knockdown, ...) and whether it harms.
export function buffInfo(id) {
  if (!Object.hasOwn(BUFFS, id)) return null;
  const [name, control, debuff] = BUFFS[id];
  return { name, control: control || null, debuff: debuff === 1 };
}
export const serverTag = id => Object.hasOwn(SERVERS, id) ? SERVERS[id][1] : null;

const typed = (names, key) => names !== null && typeof names === 'object' && typeof names[key] === 'string' && names[key] ? names[key] : null;

export const itemLabel = (names, id, locale = 'tr') => typed(names, `item:${id}`) ?? itemName(id) ?? `${locale === 'en' ? 'Item' : 'Eşya'} #${id}`;
export const serverLabel = (names, id) => typed(names, `server:${id}`) ?? serverTag(id) ?? String(id);

// "[Daily Dungeon] Entry Count" is a category and a name.
export function splitTicketName(name) {
  const match = /^\[([^\]]+)\]\s*(.*)$/.exec(name);
  return match && match[2] ? { category: match[1], name: match[2] } : { category: null, name };
}

// How a ticket refills, in words: "+15 every 3h", "+3 daily", "+14 weekly".
export function refillText(info, member, locale = 'tr') {
  const rule = info?.refill;
  if (!rule) return '';
  const tr = locale !== 'en', amount = member ? rule.memberAmount : rule.amount;
  if (rule.every === 604_800) return `+${amount} ${tr ? 'haftalık' : 'weekly'}`;
  if (rule.every === 86_400) return `+${amount} ${tr ? 'günlük' : 'daily'}`;
  const hours = rule.every / 3600;
  const span = Number.isInteger(hours) ? `${hours}${tr ? ' sa' : 'h'}` : `${Math.round(rule.every / 60)}${tr ? ' dk' : 'm'}`;
  return `+${amount} ${tr ? 'her' : 'every'} ${span}`;
}
