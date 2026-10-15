import { digest } from './community.mjs';

export const ROOM_LIMITS = Object.freeze({ peers: 12, cooldowns: 64, body: 32768, ttl: 7200000, peerTtl: 20000, fresh: 6000, syncs: 20000, rooms: 20 });
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
const HEX = /^[a-f0-9]{64}$/, ID = '[a-f0-9]{32}';
const CLASSES = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter', 'Unknown'];
class RoomError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (message, status = 400) => { throw new RoomError(status, message); };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: HEADERS });
const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed) { if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('Unsupported team fields.'); }
function integer(value, min = 0, max = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(value) || value < min || value > max) fail('Invalid team counter.'); return value; }
function nullable(value, max) { return value === null ? null : integer(value, 0, max); }
function token(value) { if (typeof value !== 'string' || !HEX.test(value)) fail('Invalid team capability.'); return value; }
function name(value) { if (typeof value !== 'string' || !value.trim() || [...value].length > 80 || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value)) fail('A resolved character name is required.'); return value.trim(); }
function className(value) { if (!CLASSES.includes(value)) fail('Invalid class.'); return value; }
function boolean(value) { if (typeof value !== 'boolean') fail('Invalid team flag.'); return value; }
function bearer(request) { const value = request.headers.get('Authorization') || ''; if (!/^Bearer [a-f0-9]{64}$/.test(value)) fail('A team capability is required.', 403); return value.slice(7); }
async function body(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) fail('Send application/json.', 415);
  const declared = request.headers.get('Content-Length');
  if (declared && (!/^\d+$/.test(declared) || +declared > ROOM_LIMITS.body)) fail('Team update exceeds 32 KiB.', 413);
  if (!request.body) fail('Missing team update.');
  const reader = request.body.getReader(), parts = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > ROOM_LIMITS.body) { await reader.cancel(); fail('Team update exceeds 32 KiB.', 413); } parts.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('Invalid team JSON.'); }
}
async function quota(db, bucket, limit, expiry) {
  const row = await db.prepare('INSERT INTO quotas(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(bucket, expiry, limit).first();
  if (!row) fail('The free team service is at capacity. Local measurement continues.', 429);
}
export function sanitizeTeamUpdate(input) {
  keys(input, ['sequence', 'display_name', 'class_name', 'capture_live', 'cooldowns']);
  const result = { sequence: integer(input.sequence, 1), display_name: name(input.display_name), class_name: className(input.class_name), capture_live: boolean(input.capture_live), cooldowns: [] };
  if (!Array.isArray(input.cooldowns) || input.cooldowns.length > ROOM_LIMITS.cooldowns) fail('Too many team cooldowns.');
  const seen = new Set();
  for (const value of input.cooldowns) {
    keys(value, ['skill_id', 'raw_remaining_units', 'estimated_remaining_ms', 'charges', 'age_ms', 'ready_confirmed']);
    const row = { skill_id: integer(value.skill_id, 1, 0xffffffff), raw_remaining_units: nullable(value.raw_remaining_units, 0xffffffff), estimated_remaining_ms: nullable(value.estimated_remaining_ms, 3600000), charges: nullable(value.charges, 100), age_ms: integer(value.age_ms, 0, 86400000), ready_confirmed: boolean(value.ready_confirmed) };
    if (seen.has(row.skill_id)) fail('Duplicate team skill.'); seen.add(row.skill_id);
    if (row.ready_confirmed && row.raw_remaining_units !== 0) fail('Readiness requires a received zero counter.');
    if (!result.capture_live || row.age_ms > ROOM_LIMITS.fresh) { row.ready_confirmed = false; row.estimated_remaining_ms = null; row.charges = null; }
    result.cooldowns.push(row);
  }
  return result;
}
async function room(db, id, now) { const row = await db.prepare('SELECT * FROM team_rooms WHERE id=? AND expires_at>?').bind(id, now).first(); if (!row) fail('Team room expired or closed.', 404); return row; }
async function peers(db, id, now) {
  const rows = (await db.prepare('SELECT id,display_name,class_name,received_at,sequence,capture_live,payload FROM team_peers WHERE room_id=? AND received_at>? ORDER BY id LIMIT 12').bind(id, now - ROOM_LIMITS.peerTtl).all()).results;
  return rows.map(row => {
    const elapsed = Math.max(0, now - row.received_at);
    return { peer_id: row.id, display_name: row.display_name, class_name: row.class_name, received_at_ms: row.received_at, sequence: row.sequence, capture_live: !!row.capture_live,
      cooldowns: JSON.parse(row.payload).map(value => { const age = value.age_ms + elapsed, fresh = row.capture_live && age <= ROOM_LIMITS.fresh; return { ...value, age_ms: age, ready_confirmed: !!fresh && value.ready_confirmed && value.raw_remaining_units === 0, estimated_remaining_ms: fresh ? value.estimated_remaining_ms : null, charges: fresh ? value.charges : null }; }) };
  });
}

// No public room listing or report/ranking linkage. Capabilities are stored only as hashes.
export async function handleRooms(request, db, options = {}) {
  const url = new URL(request.url), path = url.pathname, now = options.now ?? Date.now(), day = Math.floor(now / 86400000);
  try {
    if (!db) fail('Team storage is unavailable. Local measurement continues.', 503);
    const origin = request.headers.get('Origin'); if (origin && origin !== url.origin) fail('Cross-site team requests are not permitted.', 403);
    if (request.method === 'POST' && path === '/v1/rooms') {
      const input = await body(request); keys(input, ['join_token', 'host_token', 'ttl_minutes']);
      const joinHash = await digest(token(input.join_token)), hostHash = await digest(token(input.host_token));
      if (joinHash === hostHash) fail('Host and invite capabilities must differ.');
      integer(input.ttl_minutes, 5, 120);
      const existing = await db.prepare('SELECT id,expires_at FROM team_rooms WHERE host_hash=? AND join_hash=? AND expires_at>?').bind(hostHash, joinHash, now).first();
      if (existing) return json({ room_id: existing.id, expires_at_ms: existing.expires_at });
      const ip = await digest(request.headers.get('CF-Connecting-IP') || 'unavailable');
      await quota(db, `team-create-ip:${day}:${ip}`, 20, (day + 1) * 86400000);
      await quota(db, `team-create:${day}`, 100, (day + 1) * 86400000);
      await db.prepare('DELETE FROM team_peers WHERE NOT EXISTS (SELECT 1 FROM team_rooms WHERE team_rooms.id=team_peers.room_id AND expires_at>?)').bind(now).run();
      await db.prepare('DELETE FROM team_rooms WHERE expires_at<=?').bind(now).run();
      const id = randomId(), expires = now + input.ttl_minutes * 60000;
      const inserted = await db.prepare('INSERT INTO team_rooms(id,join_hash,host_hash,created_at,expires_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM team_rooms)<? RETURNING id').bind(id, joinHash, hostHash, now, expires, ROOM_LIMITS.rooms).first();
      if (!inserted) fail('All free team rooms are currently occupied.', 429);
      return json({ room_id: id, expires_at_ms: expires }, 201);
    }
    const match = path.match(new RegExp(`^/v1/rooms/(${ID})(?:/(join|sync|peers/(${ID})))?$`));
    if (!match) fail('Unknown team route.', 404);
    const [, id, action, peerId] = match, selected = await room(db, id, now), hash = await digest(bearer(request));
    if (request.method === 'DELETE' && !action) {
      if (hash !== selected.host_hash) fail('Invalid host capability.', 403);
      await db.prepare('DELETE FROM team_rooms WHERE id=?').bind(id).run();
      await db.prepare('DELETE FROM team_peers WHERE room_id=?').bind(id).run();
      return new Response(null, { status: 204, headers: HEADERS });
    }
    if (request.method === 'POST' && action === 'join') {
      if (hash !== selected.join_hash) fail('Invalid invite capability.', 403);
      const input = await body(request); keys(input, ['peer_token', 'display_name', 'class_name']);
      const peerHash = await digest(token(input.peer_token)), display = name(input.display_name), cls = className(input.class_name);
      if (peerHash === selected.join_hash || peerHash === selected.host_hash) fail('Participant capability must differ from invite and host.');
      const existing = await db.prepare('SELECT id FROM team_peers WHERE room_id=? AND token_hash=?').bind(id, peerHash).first();
      if (existing) return json({ peer_id: existing.id, expires_at_ms: selected.expires_at });
      await quota(db, `team-join:${day}`, 1000, (day + 1) * 86400000);
      await db.prepare('DELETE FROM team_peers WHERE room_id=? AND received_at<=?').bind(id, now - ROOM_LIMITS.peerTtl).run();
      const peer = randomId();
      const inserted = await db.prepare("INSERT INTO team_peers(id,room_id,token_hash,display_name,class_name,received_at,sequence,capture_live,payload) SELECT ?,?,?,?,?,?,0,0,'[]' WHERE (SELECT count(*) FROM team_peers WHERE room_id=?)<? AND EXISTS (SELECT 1 FROM team_rooms WHERE id=? AND expires_at>?) RETURNING id").bind(peer, id, peerHash, display, cls, now, id, ROOM_LIMITS.peers, id, now).first();
      if (!inserted) { await room(db, id, now); fail('This room already has 12 participants.', 409); }
      return json({ peer_id: peer, expires_at_ms: selected.expires_at }, 201);
    }
    const participant = await db.prepare('SELECT * FROM team_peers WHERE room_id=? AND token_hash=?').bind(id, hash).first();
    if (!participant) fail('Invalid participant capability.', 403);
    if (request.method === 'DELETE' && peerId) {
      if (peerId !== participant.id) fail('Cannot remove another participant.', 403);
      await db.prepare('DELETE FROM team_peers WHERE id=? AND room_id=?').bind(peerId, id).run();
      return new Response(null, { status: 204, headers: HEADERS });
    }
    if (request.method === 'POST' && action === 'sync') {
      const input = sanitizeTeamUpdate(await body(request));
      if (input.sequence <= participant.sequence) fail('A newer team sequence is required.', 409);
      if (participant.sequence > 0 && now - participant.received_at < 3000) fail('Team updates are limited to one every three seconds.', 429);
      await quota(db, `team-sync:${day}`, ROOM_LIMITS.syncs, (day + 1) * 86400000);
      const updated = await db.prepare('UPDATE team_peers SET display_name=?,class_name=?,received_at=?,sequence=?,capture_live=?,payload=? WHERE id=? AND room_id=? AND sequence<? RETURNING id').bind(input.display_name, input.class_name, now, input.sequence, +input.capture_live, JSON.stringify(input.cooldowns), participant.id, id, input.sequence).first();
      if (!updated) fail('A newer team sequence is required.', 409);
      return json({ server_time_ms: now, expires_at_ms: selected.expires_at, peers: await peers(db, id, now) });
    }
    fail('Unsupported team operation.', 405);
  } catch (error) { return json({ error: error instanceof RoomError ? error.message : 'Team service could not complete the request. Local measurement continues.' }, error instanceof RoomError ? error.status : 500); }
}
