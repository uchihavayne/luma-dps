import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handleRooms, sanitizeTeamUpdate, ROOM_LIMITS } from './rooms.mjs';
import { digest } from './community.mjs';
const NOW = Date.UTC(2026, 9, 15, 18), ORIGIN = 'https://luma.test';
const JOIN = 'a'.repeat(64), HOST = 'b'.repeat(64), PEER = 'c'.repeat(64);
function database() {
  const raw = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) raw.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  return { raw, prepare(sql) { const statement = raw.prepare(sql); let args = []; return { bind(...values) { args = values; return this; }, async first() { return statement.get(...args) ?? null; }, async all() { return { results: statement.all(...args) }; }, async run() { return statement.run(...args); } }; } };
}
function api(db, path, method = 'POST', value, auth, at = NOW, extraHeaders = {}) {
  return handleRooms(new Request(ORIGIN + path, { method, headers: { ...(value ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...extraHeaders }, ...(value ? { body: JSON.stringify(value) } : {}) }), db, { now: at });
}
async function create(db, at = NOW, host = HOST, invite = JOIN) { const response = await api(db, '/v1/rooms', 'POST', { host_token: host, join_token: invite, ttl_minutes: 120 }, undefined, at); return { response, ...(await response.json()) }; }
async function join(db, room, peer = PEER, at = NOW, invite = JOIN) { const response = await api(db, `/v1/rooms/${room}/join`, 'POST', { peer_token: peer, display_name: 'Example Ranger', class_name: 'Ranger' }, invite, at); return { response, ...(await response.json()) }; }
const cd = () => ({ skill_id: 12345, raw_remaining_units: 12000, estimated_remaining_ms: 5000, charges: null, age_ms: 1000, ready_confirmed: false });
const update = (sequence = 1) => ({ sequence, display_name: 'Example Ranger', class_name: 'Ranger', capture_live: true, cooldowns: [cd()] });
const sync = (db, room, value = update(), at = NOW, peer = PEER) => api(db, `/v1/rooms/${room}/sync`, 'POST', value, peer, at);

test('room create and join retries are idempotent; capabilities are only hashes', async () => {
  const db = database(), first = await create(db), retry = await create(db);
  assert.equal(first.response.status, 201); assert.equal(retry.response.status, 200); assert.equal(first.room_id, retry.room_id);
  const p = await join(db, first.room_id), again = await join(db, first.room_id);
  assert.equal(p.response.status, 201); assert.equal(again.peer_id, p.peer_id);
  const room = db.raw.prepare('SELECT * FROM team_rooms').get(), peer = db.raw.prepare('SELECT * FROM team_peers').get();
  assert.equal(room.host_hash, await digest(HOST)); assert.equal(room.join_hash, await digest(JOIN)); assert.equal(peer.token_hash, await digest(PEER));
  const response = await (await sync(db, first.room_id)).json();
  assert.ok(!JSON.stringify(response).includes('token')); assert.ok(!JSON.stringify(response).includes(JOIN));
  assert.equal(response.peers.length, 1); assert.equal(response.peers[0].display_name, 'Example Ranger');
});
test('no public room listing; absent, wrong and cross-room capabilities are rejected', async () => {
  const db = database(), room = await create(db); await join(db, room.room_id);
  assert.equal((await api(db, '/v1/rooms', 'GET')).status, 404);
  assert.equal((await api(db, `/v1/rooms/${room.room_id}/sync`, 'POST', update())).status, 403);
  assert.equal((await sync(db, room.room_id, update(), NOW, JOIN)).status, 403);
  assert.equal((await join(db, room.room_id, 'd'.repeat(64), NOW, HOST)).response.status, 403);
  const other = await create(db, NOW, 'e'.repeat(64), 'f'.repeat(64));
  assert.equal((await sync(db, other.room_id)).status, 403);
});
test('server advances age once and keeps original estimated counter; stale values cannot look ready', async () => {
  const db = database(), room = await create(db); await join(db, room.room_id);
  const zero = update(); zero.cooldowns.push({ ...cd(), skill_id: 55, raw_remaining_units: 0, estimated_remaining_ms: null, age_ms: 100, ready_confirmed: true });
  await sync(db, room.room_id, zero);
  const other = 'd'.repeat(64); await join(db, room.room_id, other, NOW + 4000);
  const read = await (await sync(db, room.room_id, update(), NOW + 4000, other)).json();
  const peer = read.peers.find(value => value.peer_id !== read.peers.find(value => value.received_at_ms === NOW + 4000).peer_id);
  assert.equal(peer.cooldowns[0].age_ms, 5000); assert.equal(peer.cooldowns[0].estimated_remaining_ms, 5000); assert.equal(peer.cooldowns[1].ready_confirmed, true);
  const later = await (await sync(db, room.room_id, update(2), NOW + 8000, other)).json();
  assert.equal(later.peers.find(value => value.received_at_ms === NOW).cooldowns[1].ready_confirmed, false);
  assert.equal(later.peers.find(value => value.received_at_ms === NOW).cooldowns[0].estimated_remaining_ms, null);
});
test('capture loss and old observations clear readiness, estimates and charges', () => {
  const input = update(); input.capture_live = false; input.cooldowns = [{ ...cd(), raw_remaining_units: 0, charges: 2, ready_confirmed: true }];
  const row = sanitizeTeamUpdate(input).cooldowns[0]; assert.equal(row.ready_confirmed, false); assert.equal(row.charges, null); assert.equal(row.estimated_remaining_ms, null);
  input.capture_live = true; input.cooldowns[0].age_ms = 6001; assert.equal(sanitizeTeamUpdate(input).cooldowns[0].ready_confirmed, false);
});
test('sequence replay and excessive polling fail before consuming shared sync quota', async () => {
  const db = database(), room = await create(db); await join(db, room.room_id); assert.equal((await sync(db, room.room_id)).status, 200);
  assert.equal((await sync(db, room.room_id)).status, 409); assert.equal((await sync(db, room.room_id, update(2), NOW + 1000)).status, 429);
  assert.equal(db.raw.prepare("SELECT count FROM quotas WHERE bucket LIKE 'team-sync:%'").get().count, 1);
  assert.equal((await sync(db, room.room_id, update(2), NOW + 5000)).status, 200);
});
test('capabilities cannot delete other participants; host close removes all peers', async () => {
  const db = database(), room = await create(db), a = await join(db, room.room_id), b = await join(db, room.room_id, 'd'.repeat(64));
  assert.equal((await api(db, `/v1/rooms/${room.room_id}/peers/${b.peer_id}`, 'DELETE', undefined, PEER)).status, 403);
  assert.equal((await api(db, `/v1/rooms/${room.room_id}`, 'DELETE', undefined, JOIN)).status, 403);
  assert.equal((await api(db, `/v1/rooms/${room.room_id}/peers/${a.peer_id}`, 'DELETE', undefined, PEER)).status, 204);
  assert.equal((await sync(db, room.room_id)).status, 403);
  assert.equal((await api(db, `/v1/rooms/${room.room_id}`, 'DELETE', undefined, HOST)).status, 204);
  assert.equal(db.raw.prepare('SELECT count(*) n FROM team_peers').get().n, 0);
  assert.equal((await sync(db, room.room_id, update(), NOW, 'd'.repeat(64))).status, 404);
});
test('room and silent participant expiry are bounded and no stale peer is returned', async () => {
  const db = database(), room = await create(db); await join(db, room.room_id);
  await sync(db, room.room_id); const other = 'd'.repeat(64); await join(db, room.room_id, other, NOW + 21000);
  const read = await (await sync(db, room.room_id, update(), NOW + 21000, other)).json(); assert.equal(read.peers.length, 1);
  assert.equal((await sync(db, room.room_id, update(2), NOW + ROOM_LIMITS.ttl)).status, 404);
});
test('twelve participants maximum and abandoned slots can be reused', async () => {
  const db = database(), room = await create(db);
  for (let i = 1; i <= 12; i++) assert.equal((await join(db, room.room_id, i.toString(16).padStart(64, '0'))).response.status, 201);
  assert.equal((await join(db, room.room_id, 'd'.repeat(64))).response.status, 409);
  assert.equal((await join(db, room.room_id, 'd'.repeat(64), NOW + 21000)).response.status, 201);
});
test('malformed, oversized, unknown or contradictory updates fail without storing them', async () => {
  const db = database(), room = await create(db); await join(db, room.room_id);
  for (const mutate of [x => x.raw_packets = 'x', x => x.sequence = -1, x => x.display_name = '', x => x.display_name = 'x\u202e', x => x.cooldowns = Array(65).fill(cd()), x => x.cooldowns.push(cd()), x => x.cooldowns[0].ready_confirmed = true, x => x.cooldowns[0].age_ms = -1, x => x.cooldowns[0].estimated_remaining_ms = 4000000]) {
    const value = update(); mutate(value); assert.equal((await sync(db, room.room_id, value)).status, 400);
  }
  assert.equal((await api(db, `/v1/rooms/${room.room_id}/sync`, 'POST', update(), PEER, NOW, { 'Content-Length': '40000' })).status, 413);
  assert.equal(db.raw.prepare('SELECT sequence FROM team_peers').get().sequence, 0);
});
test('cross-origin team requests fail and service failures remain generic', async () => {
  const db = database(); assert.equal((await api(db, '/v1/rooms', 'POST', {}, undefined, NOW, { Origin: 'https://other.test' })).status, 403);
  const response = await api(null, '/v1/rooms', 'POST', {}); assert.equal(response.status, 503); assert.match((await response.json()).error, /Local measurement/);
});
test('global free limit is explicit and local data is never persisted as a report', async () => {
  const db = database(), room = await create(db); await join(db, room.room_id);
  const bucket = `team-sync:${Math.floor(NOW / 86400000)}`; db.raw.prepare('INSERT INTO quotas VALUES(?,?,?)').run(bucket, ROOM_LIMITS.syncs, NOW + 86400000);
  assert.equal((await sync(db, room.room_id)).status, 429); assert.equal(db.raw.prepare('SELECT count(*) n FROM shares').get().n, 0);
});

test('closing a room while join is in flight cannot create an orphan participant', async () => {
  const db = database(), selected = await create(db);
  let resume, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const release = new Promise(resolve => { resume = resolve; });
  const wrapped = { ...db, prepare(sql) { const statement = db.prepare(sql); if (!sql.startsWith('INSERT INTO team_peers')) return statement;
    return { bind(...args) { statement.bind(...args); return this; }, async first() { entered(); await release; return statement.first(); } }; } };
  const joining = join(wrapped, selected.room_id); await waiting;
  assert.equal((await api(db, `/v1/rooms/${selected.room_id}`, 'DELETE', undefined, HOST)).status, 204);
  resume(); assert.equal((await joining).response.status, 404);
  assert.equal(db.raw.prepare('SELECT count(*) n FROM team_peers').get().n, 0);
});
