// The party's health, this session's tracker, the ticket list and the names the player gave to ids
// the game does not name. Everything is bounded and survives garbage.
const ODYLE_TICKET_ID = 60_000_001;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const whole = (value, maximum = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : null;
const clean = (value, maximum) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum) : '';

export function normalizeParty(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).slice(0, 24).map(row => {
    if (!object(row)) return null;
    // The id comes as a number from the engine and as a string once normalized.
    const id = whole(typeof row.id === 'string' && /^[1-9]\d{0,9}$/.test(row.id) ? Number(row.id) : row.id, 0xffff_ffff), hp = whole(row.hp, 1e12), max = whole(row.hp_max, 1e12), name = clean(row.name, 16);
    return id && name && hp !== null && max && hp <= max ? { id: String(id), name, hp, hp_max: max, is_self: row.is_self === true, observed_at_ms: whole(row.observed_at_ms) ?? 0 } : null;
  }).filter(row => row && !seen.has(row.id) && seen.add(row.id));
}

export const partyFraction = row => row.hp_max > 0 ? Math.max(0, Math.min(1, row.hp / row.hp_max)) : 0;

export function normalizeTracker(value) {
  const input = object(value) ? value : {};
  const kills = (Array.isArray(input.kills) ? input.kills : []).slice(0, 16).map(row => {
    const model = object(row) ? whole(row.model, 0xffff_ffff) : null, count = object(row) ? whole(row.count, 1e9) : null;
    return model && count ? { model, name: clean(row.name, 60) || null, count } : null;
  }).filter(Boolean);
  const gathered = (Array.isArray(input.gathered) ? input.gathered : []).slice(0, 16).map(row => {
    const item = object(row) ? whole(row.item, 0xffff_ffff) : null, count = object(row) ? whole(row.count, 1e9) : null;
    return item && count ? { item, count } : null;
  }).filter(Boolean);
  return { kills, kills_total: whole(input.kills_total, 1e9) ?? kills.reduce((sum, row) => sum + row.count, 0), gathered };
}

// Names the player gave to ids the game sends without a name: "ticket:12" and "item:531900003".
export function normalizeIdNames(value) {
  const names = {};
  if (!object(value)) return names;
  for (const [key, name] of Object.entries(value).slice(0, 400)) {
    const text = clean(name, 40);
    if (/^(ticket|item):[1-9]\d{0,9}$/.test(key) && text && Object.keys(names).length < 200) names[key] = text;
  }
  return names;
}

export const idLabel = (names, kind, id, fallback) => (object(names) && names[`${kind}:${id}`]) || fallback;

// The tickets the game listed for the local player, with a recharge countdown. A ticket with
// nothing in it and nothing coming is not worth a row.
export function ticketRows(resources, { names = {}, now = Date.now(), locale = 'tr' } = {}) {
  if (!object(resources) || resources.source !== 'server-contents-ticket' || resources.awaiting_identity === true || !Array.isArray(resources.tickets)) return [];
  const tr = locale !== 'en';
  return resources.tickets.slice(0, 64).map(row => {
    if (!object(row)) return null;
    const id = whole(row.ticket_id, 0xffff_ffff), count = whole(row.count, 1e7), bonus = whole(row.bonus, 1e7) ?? 0;
    const listed = whole(row.time_left_ms, 1e10) ?? 0, seen = whole(row.observed_at_ms);
    if (!id || count === null) return null;
    const left = listed > 0 && seen !== null ? Math.max(0, listed - Math.max(0, now - seen)) : 0;
    if (count + bonus === 0 && left === 0) return null;
    const named = id === ODYLE_TICKET_ID ? 'Odyle' : idLabel(names, 'ticket', id, '');
    return { id, name: named || `${tr ? 'Bilet' : 'Ticket'} #${id}`, named: Boolean(named), count, bonus, left_ms: left };
  }).filter(Boolean).sort((a, b) => Number(b.named) - Number(a.named) || a.id - b.id).slice(0, 14);
}

export function clockText(milliseconds) {
  const total = Math.ceil(Math.max(0, milliseconds) / 1000), hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
}
