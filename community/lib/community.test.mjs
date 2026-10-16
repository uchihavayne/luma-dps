import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handleCommunity, LIMITS, canonical, digest, sanitizeRecord } from './community.mjs';

const NOW = Date.UTC(2026, 9, 15, 12), ORIGIN = 'https://luma.test';
function database() {
  const raw = new DatabaseSync(':memory:');
  for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'));
  return { raw, prepare(sql) { const statement = raw.prepare(sql); let values = []; return { bind(...items) { values = items; return this; }, async first() { return statement.get(...values) ?? null; }, async all() { return { results: statement.all(...values) }; }, async run() { return statement.run(...values); } }; } };
}
function report(overrides = {}) {
  return { scope: 'personal', duration_ms: 60000, total_damage: 600000, dps: 10000,
    players: [{ id: 1, name: 'Example Ranger', class_name: 'Ranger', damage: 600000, dps: 10000, skills: [{ id: 31, name: 'Arrow', hits: 10, damage: 600000, crit_hits: 2, min: 50000, max: 80000 }] }],
    targets: [{ name: 'Example Boss', is_boss: true, damage: 600000 }], context: { region: 'EU', server: 'Example', boss: 'Example Boss', difficulty: 'Normal' },
    quality: { source: 'captured', sample_complete: true, identity_confirmed: true, membership_confirmed: false, ranking_eligible: true, classification: 'community' }, record_hash: 'a'.repeat(64), ...overrides };
}
function payload(options = {}) { return { schema_version: 1, record: report(), anonymous: true, rank_opt_in: false, delete_token: 'b'.repeat(64), ...options }; }
function api(db, path, method = 'GET', body, options = {}) {
  const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  return handleCommunity(new Request(`${ORIGIN}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) }), db, { now: NOW, ...options });
}
async function create(db, body = payload(), options) { const response = await api(db, '/v1/shares', 'POST', body, options); return { response, result: await response.json() }; }

const comparison = '/v1/statistics?region=EU&server=Example&boss=Example%20Boss&difficulty=Normal&scope=personal';

test('private viewing uses a separate durable capability hash and bearer header, never query or metadata', async () => {
  const db = database(), view = 'c'.repeat(64), body = payload({ visibility: 'private', view_token: view });
  const { response, result } = await create(db, body);
  assert.equal(response.status, 201); assert.equal(result.visibility, 'private'); assert.equal(result.url.includes('#'), false);
  assert.equal(db.raw.prepare('SELECT view_hash FROM shares').get().view_hash, await digest(view));
  assert.doesNotMatch(JSON.stringify(result), /view_token|view_hash|cccccccc/);
  assert.equal((await api(db, `/v1/shares/${result.id}`)).status, 404);
  assert.equal((await api(db, `/v1/shares/${result.id}?view_token=${view}`)).status, 404);
  assert.equal((await api(db, `/v1/shares/${result.id}`, 'GET', null, { headers: { Authorization: `Bearer ${'d'.repeat(64)}` } })).status, 404);
  const read = await api(db, `/v1/shares/${result.id}`, 'GET', null, { headers: { Authorization: `Bearer ${view}` } });
  assert.equal(read.status, 200); assert.equal(read.headers.get('Cache-Control'), 'no-store'); assert.match(read.headers.get('X-Robots-Tag'), /noindex/);
  assert.doesNotMatch(JSON.stringify(await read.json()), /view_token|view_hash|cccccccc/);
  assert.equal((await api(db, `/v1/shares/${result.id}`, 'DELETE', null, { headers: { Authorization: `Bearer ${view}` } })).status, 403);
  assert.equal((await api(db, `/v1/shares/${result.id}`, 'DELETE', null, { headers: { Authorization: `Bearer ${body.delete_token}` } })).status, 200);
});

test('private retry preserves privacy and altered capabilities/options cannot recover a different report', async () => {
  const db = database(), body = payload({ visibility: 'private', view_token: 'c'.repeat(64) });
  const first = await create(db, body), same = await create(db, body);
  assert.equal(same.response.status, 200); assert.equal(same.result.id, first.result.id);
  assert.equal((await create(db, { ...body, visibility: 'public', view_token: null })).response.status, 409);
  assert.equal((await create(db, { ...body, view_token: 'd'.repeat(64) })).response.status, 409);
  assert.equal((await create(db, { ...body, rank_opt_in: true })).response.status, 400);
  assert.equal((await create(database(), payload({ visibility: 'private', view_token: 'b'.repeat(64) }))).response.status, 400);
  assert.equal((await create(database(), payload({ visibility: 'private' }))).response.status, 400);
});

test('unlisted records are link-readable but cannot enter public rankings or class statistics', async () => {
  const db = database(), { result, response } = await create(db, payload({ visibility: 'unlisted' }));
  assert.equal(response.status, 201); assert.equal((await api(db, `/v1/shares/${result.id}`)).status, 200);
  assert.equal((await create(database(), payload({ visibility: 'unlisted', rank_opt_in: true }))).response.status, 400);
  // Even inconsistent legacy/manual flags cannot bypass the read-side boundary.
  db.raw.prepare('UPDATE shares SET ranked=1').run();
  assert.equal((await (await api(db, '/v1/rankings')).json()).total, 0);
  assert.equal((await (await api(db, comparison)).json()).entries.length, 0);
});

test('additive privacy migration preserves legacy public reports and deletion ownership', async () => {
  const raw = new DatabaseSync(':memory:');
  for (const name of ['0000_nebulous_lockheed.sql', '0001_remarkable_doorman.sql']) raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'));
  raw.prepare('INSERT INTO shares VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('1'.repeat(32), 'a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), '{}', 2, NOW, NOW + 1000, 1, 0, 'personal', 'Player 1', 'Ranger', 'EU', 'Example', 'Boss', 'Normal', 1, 1, 1000);
  for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter(name => name.endsWith('.sql') && !name.startsWith('0000_') && !name.startsWith('0001_')).sort()) raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'));
  const row = raw.prepare('SELECT * FROM shares').get();
  assert.equal(row.visibility, 'public'); assert.equal(row.view_hash, null); assert.equal(row.combat_power, null); assert.equal(row.token_hash, 'a'.repeat(64)); assert.equal(row.id, '1'.repeat(32));
});

test('statistics require comparison context, at least five records and keep missing CP unknown', async () => {
  const db = database();
  const row = await create(db, payload({ rank_opt_in: true })); assert.equal(row.response.status, 201);
  const incomplete = await (await api(db, '/v1/statistics')).json();
  assert.equal(incomplete.status, 'context-required'); assert.deepEqual(incomplete.entries, []);
  const sparse = await (await api(db, comparison)).json();
  assert.equal(sparse.entries[0].count, 1); assert.equal(sparse.entries[0].status, 'insufficient-cohort'); assert.equal(sparse.entries[0].median_dps, null); assert.equal(sparse.entries[0].cp_known_count, 0);
  const rank = await (await api(db, comparison.replace('/statistics', '/rankings'))).json();
  assert.equal(rank.entries[0].percentile, null); assert.equal(rank.entries[0].combat_power, null);
  assert.equal((await api(db, `${comparison}&cp_band=unknown`)).status, 200);
  assert.equal((await api(db, `${comparison}&cp_band=invalid`)).status, 400);
});

test('class summaries and midrank percentiles are record-weighted, class-scoped and CP-filtered', async () => {
  const db = database();
  for (let i = 1; i <= 6; i++) {
    const value = report(); value.total_damage = 60000 * i; value.dps = 1000 * i; value.players[0].damage = value.total_damage; value.players[0].dps = value.dps; value.players[0].skills[0].damage = value.total_damage; value.players[0].skills[0].min = 1000; value.players[0].skills[0].max = 5000; value.targets[0].damage = value.total_damage;
    if (i <= 5) value.combat_power = { current: 356559, highest: 400000, source: 'server-self-at-start' };
    assert.equal((await create(db, payload({ record: value, rank_opt_in: true, delete_token: i.toString(16).padStart(64, '0') }), { now: NOW + i * 61000 })).response.status, 201);
  }
  const stats = await (await api(db, `${comparison}&cp_band=300000-399999`, 'GET', null, { now: NOW + 500000 })).json();
  assert.equal(stats.weighting, 'submitted-records'); const row = stats.entries[0];
  assert.equal(row.count, 5); assert.equal(row.cp_known_count, 5); assert.equal(row.median_dps, 3000); assert.equal(row.p95_dps, 5000); assert.equal(row.minimum_dps, 1000); assert.equal(row.maximum_dps, 5000);
  const rankings = await (await api(db, `${comparison.replace('/statistics', '/rankings')}&cp_band=300000-399999`, 'GET', null, { now: NOW + 500000 })).json();
  assert.equal(rankings.total, 5); assert.equal(rankings.entries[0].percentile, 90); assert.equal(rankings.entries[0].cohort_count, 5); assert.equal(rankings.entries[0].percentile_method, 'record-midrank');
  const unknown = await (await api(db, `${comparison}&cp_band=unknown`, 'GET', null, { now: NOW + 500000 })).json();
  assert.equal(unknown.entries[0].count, 1); assert.equal(unknown.entries[0].median_dps, null);
  assert.equal((await (await api(db, `${comparison}&class_name=cleric`)).json()).entries.length, 0);
  assert.equal((await (await api(db, comparison.replace('Normal', 'Nightmare'))).json()).entries.length, 0);
});

test('database migrations and health are real, unavailable storage fails closed', async () => {
  assert.equal((await api(database(), '/v1/health')).status, 200);
  assert.equal((await api(null, '/v1/health')).status, 503);
});
test('explicit anonymous share, public retrieval, recomputed digest and no capabilities', async () => {
  const db = database(), { response, result } = await create(db);
  assert.equal(response.status, 201); assert.match(result.id, /^[a-f0-9]{32}$/); assert.equal(result.url, `${ORIGIN}/r/${result.id}`);
  assert.equal(result.expires_at_ms, NOW + LIMITS.ttl);
  const read = await api(db, `/v1/shares/${result.id}`), document = await read.json();
  assert.equal(document.record.players[0].name, 'Player 1'); assert.equal(document.record.dps, 10000);
  assert.equal(document.record.record_hash, await digest(canonical(sanitizeRecord(report(), true, false))));
  assert.ok(!JSON.stringify(document).includes('delete_token')); assert.ok(!JSON.stringify(document).includes('token_hash'));
  assert.equal(db.raw.prepare('SELECT token_hash FROM shares').get().token_hash, await digest('b'.repeat(64)));
  assert.equal(read.headers.get('Cache-Control'), 'no-store');
  assert.equal((await (await api(db, '/v1/rankings')).json()).total, 0);
});
test('only own name can be published, other players remain aliased', () => {
  const row = report(); row.scope = 'observed'; row.total_damage *= 2; row.dps *= 2; row.targets[0].damage *= 2;
  row.players.push({ ...structuredClone(row.players[0]), id: 2, name: 'Another Person' });
  const clean = sanitizeRecord(row, false, false);
  assert.equal(clean.players[0].name, 'Example Ranger'); assert.equal(clean.players[1].name, 'Player 2');
});
test('same token and fingerprint retry is idempotent and keeps original capability', async () => {
  const db = database(), first = await create(db), retry = await create(db);
  assert.equal(retry.response.status, 200); assert.equal(retry.result.id, first.result.id);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM shares').get().n, 1);
});
test('rank participation is separate opt-in and filters compare context', async () => {
  const db = database(), { result } = await create(db, payload({ anonymous: false, rank_opt_in: true }));
  const ranks = await (await api(db, '/v1/rankings?region=EU&server=Example&boss=Example%20Boss&class_name=Ranger&difficulty=Normal&scope=personal')).json();
  assert.equal(ranks.total, 1); assert.equal(ranks.entries[0].share_id, result.id); assert.equal(ranks.entries[0].name, 'Example Ranger');
  assert.match(ranks.notice, /not an official/);
  assert.equal((await (await api(db, '/v1/rankings?region=KR')).json()).total, 0);
});
test('ranking rejects imported, incomplete, unconfirmed, short, unknown-class and non-boss records', async () => {
  for (const change of [r => r.quality.source = 'imported', r => r.quality.sample_complete = false, r => r.quality.identity_confirmed = false, r => { r.duration_ms = 1000; r.dps = 600000; r.players[0].dps = 600000; }, r => r.players[0].class_name = 'Unknown', r => r.targets[0].is_boss = false, r => r.context.server = '']) {
    const body = payload({ rank_opt_in: true }); change(body.record);
    assert.equal((await create(database(), body)).response.status, 400);
  }
});
test('server does not trust client eligibility flag', async () => {
  const body = payload({ rank_opt_in: true }); body.record.quality.ranking_eligible = true; body.record.quality.source = 'imported';
  assert.equal((await create(database(), body)).response.status, 400);
});
test('ranking rejects mixed adds, invented boss labels and accepts case-insensitive filters', async () => {
  const db = database(), mixed = payload({ rank_opt_in: true });
  mixed.record.targets = [{ name: 'Example Boss', is_boss: true, damage: 500000 }, { name: 'Add', is_boss: false, damage: 100000 }];
  assert.equal((await create(db, mixed)).response.status, 400);
  const invented = payload({ rank_opt_in: true }); invented.record.context.boss = 'Other';
  assert.equal((await create(db, invented)).response.status, 400);
  await create(db, payload({ rank_opt_in: true }));
  assert.equal((await (await api(db, '/v1/rankings?class_name=ranger&region=eu')).json()).total, 1);
});
test('expired exact retry is replaced even when many older expired rows await bounded cleanup', async () => {
  const db = database(), { result } = await create(db);
  db.raw.prepare('UPDATE shares SET expires_at=?').run(NOW - 1);
  for (let i = 0; i < 25; i++) db.raw.prepare('INSERT INTO shares SELECT ?,token_hash,?,record_hash,record_json,bytes,created_at,?,anonymous,ranked,scope,name,class_name,region,server,boss,difficulty,dps,damage,duration,visibility,view_hash,combat_power FROM shares WHERE id=?').run(i.toString(16).padStart(32, '0'), i.toString(16).padStart(64, '0'), NOW - 1000, result.id);
  const retry = await create(db); assert.equal(retry.response.status, 201); assert.notEqual(retry.result.id, result.id);
});
test('one client cannot drain global submission quota by repeating per-minute rejected attempts', async () => {
  const db = database(), day = Math.floor(NOW / 86400000);
  for (let i = 1; i <= 5; i++) assert.equal((await create(db, payload({ delete_token: i.toString(16).padStart(64, '0') }))).response.status, 201);
  for (let i = 6; i < 15; i++) assert.equal((await create(db, payload({ delete_token: i.toString(16).padStart(64, '0') }))).response.status, 429);
  assert.equal(db.raw.prepare('SELECT count FROM quotas WHERE bucket=?').get(`upload-day:${day}`).count, 5);
});
test('malformed totals, IDs, bounds, nested hidden fields and NaN-like counters rejected', async () => {
  for (const change of [r => r.total_damage++, r => r.dps++, r => r.players[0].skills[0].damage++, r => r.targets[0].damage++, r => r.players[0].id = 999, r => r.raw_packets = 'private', r => r.players[0].audio = 'private', r => r.players[0].skills[0].crit_hits = 99, r => r.duration_ms = -1, r => r.total_damage = Number.MAX_SAFE_INTEGER + 1, r => r.context.server = 'x'.repeat(81), r => r.players[0].name = 'evil\nname']) {
    const body = payload(); change(body.record); assert.equal((await create(database(), body)).response.status, 400);
  }
});
test('revocation requires exact deletion capability and repeated deletion is safe', async () => {
  const db = database(), { result } = await create(db, payload({ rank_opt_in: true })), path = `/v1/shares/${result.id}`;
  assert.equal((await api(db, path, 'DELETE')).status, 401);
  assert.equal((await api(db, path, 'DELETE', null, { headers: { Authorization: `Bearer ${'c'.repeat(64)}` } })).status, 403);
  assert.equal((await api(db, path)).status, 200);
  for (let i = 0; i < 2; i++) assert.equal((await api(db, path, 'DELETE', null, { headers: { Authorization: `Bearer ${'b'.repeat(64)}` } })).status, 200);
  assert.equal((await api(db, path)).status, 404); assert.equal((await (await api(db, '/v1/rankings')).json()).total, 0);
});
test('expired shares leave both public report and ranking', async () => {
  const db = database(), { result } = await create(db, payload({ rank_opt_in: true })), now = NOW + LIMITS.ttl + 1;
  assert.equal((await api(db, `/v1/shares/${result.id}`, 'GET', null, { now })).status, 404);
  assert.equal((await (await api(db, '/v1/rankings', 'GET', null, { now })).json()).total, 0);
});
test('storage budget is enforced by guarded insert without paid overflow', async () => {
  const db = database(); await create(db); db.raw.prepare('UPDATE shares SET bytes=?').run(LIMITS.bytes);
  assert.equal((await create(db, payload({ delete_token: 'c'.repeat(64) }))).response.status, 507);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM shares').get().n, 1);
});
test('free daily submission and ranking quotas stop explicitly', async () => {
  const db = database(), day = Math.floor(NOW / 86400000);
  db.raw.prepare('INSERT INTO quotas VALUES(?,?,?)').run(`upload-day:${day}`, LIMITS.uploads, NOW + 86400000);
  assert.equal((await create(db)).response.status, 429);
  db.raw.prepare('INSERT INTO quotas VALUES(?,?,?)').run(`rank-read:${day}`, LIMITS.rankingReads, NOW + 86400000);
  assert.equal((await api(db, '/v1/rankings')).status, 429);
});
test('cross-site writes, invalid MIME, oversized body and malformed UTF-8 JSON fail before insert', async () => {
  const db = database();
  assert.equal((await create(db, payload(), { headers: { Origin: 'https://evil.test' } })).response.status, 403);
  assert.equal((await create(db, payload(), { headers: { 'Content-Type': 'text/plain' } })).response.status, 415);
  assert.equal((await create(db, payload(), { headers: { 'Content-Length': String(LIMITS.body + 1) } })).response.status, 413);
  const request = new Request(`${ORIGIN}/v1/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([255]) });
  assert.equal((await handleCommunity(request, db)).status, 400);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM shares').get().n, 0);
});
test('SQL filter injection is data, unknown endpoints do not leak SQL failures', async () => {
  const db = database(); await create(db, payload({ rank_opt_in: true }));
  assert.equal((await (await api(db, '/v1/rankings?boss=%27%20OR%201%3D1--')).json()).total, 0);
  assert.equal((await api(db, '/v1/rankings?cursor=-1')).status, 400);
  assert.equal((await api(db, '/v1/shares/not-an-id')).status, 404);
  db.raw.close(); const response = await api(db, '/v1/health'); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('SQL'));
});
