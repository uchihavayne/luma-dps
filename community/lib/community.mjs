export const LIMITS = Object.freeze({ body: 1024 * 1024, records: 5000, bytes: 100 * 1024 * 1024, ttl: 30 * 86400000, uploads: 100, rankingReads: 600 });
const HEX = /^[a-f0-9]{64}$/;
const NOTICE = 'Community submissions, not an official or game-verified world ranking. Context is supplied by the uploader. Only opted-in personal boss encounters are listed. Reports expire after 30 days.';
const SCOPES = ['personal', 'party', 'observed'];
export const VISIBILITIES = Object.freeze(['public', 'unlisted', 'private']);
export const COHORT_MINIMUM = 5;
export const CP_BANDS = Object.freeze({ unknown: null, '0-99999': [0, 99999], '100000-199999': [100000, 199999], '200000-299999': [200000, 299999], '300000-399999': [300000, 399999], '400000-499999': [400000, 499999], '500000-599999': [500000, 599999], '600000-699999': [600000, 699999], '700000-799999': [700000, 799999], '800000-899999': [800000, 899999], '900000+': [900000, 100000000] });
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const reject = (message, status = 400) => { throw new ApiError(status, message); };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: HEADERS });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) reject('Unsupported report fields. Update Luma and try again.');
  return value;
}
function text(value, max = 80) {
  if (typeof value !== 'string' || [...value].length > max || /[\u0000-\u001f\u007f]/.test(value)) reject('Invalid report text.');
  return value.trim();
}
function number(value, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) reject('Invalid report counter.');
  return value;
}
function bool(value) { if (typeof value !== 'boolean') reject('Invalid report flag.'); return value; }
function array(value, max) { if (!Array.isArray(value) || value.length > max) reject('Report exceeds its row limit.'); return value; }
function sum(values) { return number(values.reduce((a, b) => a + b, 0)); }
function rate(value, damage, duration) {
  const expected = damage * 1000 / duration;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || Math.abs(value - expected) > Math.max(0.01, expected * 0.000001)) reject('DPS does not match damage and duration.');
  return expected;
}

export function sanitizeRecord(input, anonymous, rankOptIn) {
  keys(input, ['scope', 'duration_ms', 'total_damage', 'dps', 'players', 'targets', 'context', 'quality', 'record_hash', 'combat_power']);
  if (!SCOPES.includes(input.scope)) reject('Choose a supported player scope.');
  const duration = number(input.duration_ms, 86400000), damage = number(input.total_damage);
  if (duration < 1000 || !damage) reject('An encounter needs damage and at least one second.');
  const players = array(input.players, 100).map((row, index) => {
    keys(row, ['id', 'name', 'class_name', 'damage', 'dps', 'skills']);
    if (row.id !== index + 1) reject('Player identifiers must be document-local ordinals.');
    const playerDamage = number(row.damage); let name = text(row.name);
    if (anonymous || index > 0 || !name || /^#\d+$/.test(name)) name = `Player ${index + 1}`;
    const skills = array(row.skills, 500).map(skill => {
      keys(skill, ['id', 'name', 'hits', 'damage', 'crit_hits', 'min', 'max']);
      const entry = { id: number(skill.id, 4294967295), name: text(skill.name, 100), hits: number(skill.hits), damage: number(skill.damage), crit_hits: number(skill.crit_hits), min: number(skill.min), max: number(skill.max) };
      if (entry.crit_hits > entry.hits || entry.min > entry.max || entry.max > entry.damage || (!entry.hits && entry.damage)) reject('Inconsistent skill counters.');
      return entry;
    });
    if (new Set(skills.map(row => row.id)).size !== skills.length || sum(skills.map(row => row.damage)) !== playerDamage) reject('Skill totals do not match player damage.');
    return { id: index + 1, name, class_name: text(row.class_name), damage: playerDamage, dps: rate(row.dps, playerDamage, duration), skills };
  });
  if (!players.length || (input.scope === 'personal' && players.length !== 1) || sum(players.map(row => row.damage)) !== damage) reject('Player totals do not match encounter damage.');
  const targets = array(input.targets, 100).map(row => {
    keys(row, ['name', 'is_boss', 'damage']);
    return { name: text(row.name) || 'Unknown target', is_boss: bool(row.is_boss), damage: number(row.damage) };
  });
  if (!targets.length || sum(targets.map(row => row.damage)) !== damage) reject('Target totals do not match encounter damage.');
  keys(input.context, ['region', 'server', 'boss', 'difficulty']);
  const context = Object.fromEntries(['region', 'server', 'boss', 'difficulty'].map(key => [key, text(input.context[key])]));
  keys(input.quality, ['source', 'sample_complete', 'identity_confirmed', 'membership_confirmed', 'ranking_eligible', 'classification']);
  const q = input.quality;
  if (!['captured', 'imported'].includes(q.source) || q.classification !== 'community') reject('Unsupported report source.');
  const quality = { source: q.source, sample_complete: bool(q.sample_complete), identity_confirmed: bool(q.identity_confirmed), membership_confirmed: bool(q.membership_confirmed), ranking_eligible: false, classification: 'community' };
  bool(q.ranking_eligible);
  quality.ranking_eligible = input.scope === 'personal' && q.source === 'captured' && quality.sample_complete && quality.identity_confirmed && duration >= 10000 && Object.values(context).every(Boolean) && targets.length === 1 && targets[0].is_boss && !/^(?:target|unknown)[ #]*\d*$/i.test(targets[0].name) && targets[0].name.toLowerCase() === context.boss.toLowerCase() && !!players[0].class_name && players[0].class_name.toLowerCase() !== 'unknown';
  if (rankOptIn && !quality.ranking_eligible) reject('Ranking requires a complete, identified personal boss encounter lasting at least 10 seconds, a known class and all comparison filters.');
  if (!HEX.test(input.record_hash)) reject('Missing report fingerprint.');
  let combatPower;
  if (input.combat_power !== undefined && input.combat_power !== null) {
    keys(input.combat_power, ['current', 'highest', 'source']);
    if (input.scope !== 'personal' || q.source !== 'captured' || !quality.identity_confirmed || input.combat_power.source !== 'server-self-at-start') reject('Combat power needs an observed own-character encounter-start snapshot.');
    combatPower = { current: number(input.combat_power.current, 100000000), highest: number(input.combat_power.highest, 100000000), source: 'server-self-at-start' };
    if (!combatPower.current || !combatPower.highest) reject('Invalid combat power.');
  }
  return { scope: input.scope, duration_ms: duration, total_damage: damage, dps: rate(input.dps, damage, duration), players, targets, context, quality, ...(combatPower ? { combat_power: combatPower } : {}) };
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
async function quota(db, bucket, limit, expiresAt) {
  const result = await db.prepare('INSERT INTO quotas(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(bucket, expiresAt, limit).first();
  if (!result) reject('The free service limit has been reached. Try again later; local reports still work.', 429);
}
function shareMetadata(row, origin) {
  return { id: row.id, url: `${origin}/r/${row.id}`, created_at_ms: row.created_at, expires_at_ms: row.expires_at, scope: row.scope, anonymous: !!row.anonymous, rank_opt_in: !!row.ranked, visibility: VISIBILITIES.includes(row.visibility) ? row.visibility : 'public', record_hash: row.record_hash, validation: 'community' };
}

function equalDigest(a, b) {
  if (!HEX.test(a || '') || !HEX.test(b || '')) return false;
  let difference = 0; for (let index = 0; index < 64; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function comparisonQuery(url, now) {
  const where = ["ranked=1", "visibility='public'", 'expires_at>?'], params = [now], filters = {};
  for (const key of ['region', 'server', 'boss', 'class_name', 'difficulty', 'scope']) {
    const value = text(url.searchParams.get(key) || ''); filters[key] = value;
    if (value) { if (key === 'scope' && !SCOPES.includes(value)) reject('Unsupported ranking scope.'); where.push(`${key}=? COLLATE NOCASE`); params.push(value); }
  }
  const band = text(url.searchParams.get('cp_band') || '');
  if (band && !Object.hasOwn(CP_BANDS, band)) reject('Unsupported combat-power band.');
  if (band === 'unknown') where.push('combat_power IS NULL');
  else if (band) { where.push('combat_power BETWEEN ? AND ?'); params.push(...CP_BANDS[band]); }
  return { clause: where.join(' AND '), params, filters: { ...filters, cp_band: band }, comparable: ['region', 'server', 'boss', 'difficulty'].every(key => !!filters[key]) && (!filters.scope || filters.scope === 'personal') };
}

function cohortStats(values) {
  const sorted = values.slice().sort((a, b) => a - b), count = sorted.length;
  if (count < COHORT_MINIMUM) return { count, status: 'insufficient-cohort', minimum_dps: null, maximum_dps: null, median_dps: null, p95_dps: null };
  const middle = Math.floor(count / 2);
  return { count, status: 'available', minimum_dps: sorted[0], maximum_dps: sorted.at(-1), median_dps: count % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, p95_dps: sorted[Math.max(0, Math.ceil(count * .95) - 1)] };
}

async function comparisonCohorts(db, query) {
  if (!query.comparable) return [];
  const rows = (await db.prepare(`SELECT class_name,dps,combat_power FROM shares WHERE ${query.clause} ORDER BY class_name,dps LIMIT ?`).bind(...query.params, LIMITS.records).all()).results;
  const classes = new Map();
  for (const row of rows) {
    const key = row.class_name.toLowerCase();
    if (!classes.has(key)) classes.set(key, { class_name: row.class_name, values: [], cp_known_count: 0 });
    const group = classes.get(key); group.values.push(row.dps); group.cp_known_count += Number(row.combat_power !== null);
  }
  return [...classes.values()];
}
async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) reject('Send application/json.', 415);
  const declared = request.headers.get('Content-Length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > LIMITS.body)) reject('The report exceeds the 1 MB limit.', 413);
  if (!request.body) reject('Missing report.');
  const reader = request.body.getReader(); let size = 0; const chunks = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > LIMITS.body) { await reader.cancel(); reject('The report exceeds the 1 MB limit.', 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const value of chunks) { bytes.set(value, offset); offset += value.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { reject('The report is not valid UTF-8 JSON.'); }
}

export async function handleCommunity(request, db, options = {}) {
  const url = new URL(request.url), now = options.now ?? Date.now(), day = Math.floor(now / 86400000), origin = options.origin || url.origin;
  try {
    if (!db) reject('Community storage is not available. Local reports still work.', 503);
    if (request.method === 'GET' && url.pathname === '/v1/health') {
      await db.prepare('SELECT id FROM shares LIMIT 1').first();
      return json({ status: 'ok', schema_version: 2, retention_days: 30, free: true });
    }
    if (['POST', 'DELETE'].includes(request.method)) {
      const browserOrigin = request.headers.get('Origin');
      if (browserOrigin && browserOrigin !== url.origin) reject('Cross-site writes are not permitted.', 403);
    }
    if (request.method === 'POST' && url.pathname === '/v1/shares') {
      const body = keys(await readBody(request), ['schema_version', 'record', 'anonymous', 'rank_opt_in', 'delete_token', 'visibility', 'view_token']);
      if (body.schema_version !== 1 || !HEX.test(body.delete_token)) reject('Unsupported report or deletion key.');
      const visibility = body.visibility ?? 'public';
      if (!VISIBILITIES.includes(visibility)) reject('Choose a supported report visibility.');
      if (visibility === 'private' ? !HEX.test(body.view_token || '') || body.view_token === body.delete_token : body.view_token !== undefined && body.view_token !== null && body.view_token !== '') reject('Private reports need a separate viewing capability.');
      const anonymous = bool(body.anonymous), rankOptIn = bool(body.rank_opt_in), record = sanitizeRecord(body.record, anonymous, rankOptIn);
      if (rankOptIn && visibility !== 'public') reject('Only explicitly public reports can enter rankings.');
      const tokenHash = await digest(body.delete_token), viewHash = visibility === 'private' ? await digest(body.view_token) : null, clientHash = body.record.record_hash;
      const existing = await db.prepare('SELECT * FROM shares WHERE token_hash=? AND client_hash=? AND expires_at>?').bind(tokenHash, clientHash, now).first();
      if (existing) {
        if ((existing.visibility || 'public') !== visibility || !!existing.ranked !== rankOptIn || !!existing.anonymous !== anonymous || visibility === 'private' && !equalDigest(existing.view_hash, viewHash)) reject('Revoke the existing report before changing its visibility or sharing options.', 409);
        return json(shareMetadata(existing, origin));
      }
      const identity = await digest(`${day}:${request.headers.get('cf-connecting-ip') || 'local'}`);
      await quota(db, `upload-minute:${Math.floor(now / 60000)}:${identity}`, 5, now + 120000);
      await quota(db, `upload-ip:${day}:${identity}`, 20, (day + 1) * 86400000);
      await quota(db, `upload-day:${day}`, LIMITS.uploads, (day + 1) * 86400000);
      await db.prepare('DELETE FROM shares WHERE token_hash=? AND client_hash=? AND expires_at<=?').bind(tokenHash, clientHash, now).run();
      await db.prepare('DELETE FROM shares WHERE id IN (SELECT id FROM shares WHERE expires_at<=? ORDER BY expires_at LIMIT 20)').bind(now).run();
      await db.prepare('DELETE FROM quotas WHERE bucket IN (SELECT bucket FROM quotas WHERE expires_at<=? LIMIT 50)').bind(now).run();
      const hash = await digest(canonical(record)), serialized = JSON.stringify({ ...record, record_hash: hash }), bytes = new TextEncoder().encode(serialized).length;
      const id = randomId(), expires = now + LIMITS.ttl, player = record.players[0], c = record.context;
      const values = [id, tokenHash, clientHash, hash, serialized, bytes, now, expires, +anonymous, +rankOptIn, record.scope, player.name, player.class_name, c.region, c.server, c.boss, c.difficulty, record.dps, record.total_damage, record.duration_ms, visibility, viewHash, record.combat_power?.current ?? null];
      const inserted = await db.prepare('INSERT INTO shares(id,token_hash,client_hash,record_hash,record_json,bytes,created_at,expires_at,anonymous,ranked,scope,name,class_name,region,server,boss,difficulty,dps,damage,duration,visibility,view_hash,combat_power) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM shares)<? AND (SELECT COALESCE(SUM(bytes),0) FROM shares)+?<=? ON CONFLICT(token_hash,client_hash) DO NOTHING RETURNING id').bind(...values, LIMITS.records, bytes, LIMITS.bytes).first();
      if (!inserted) {
        const retry = await db.prepare('SELECT * FROM shares WHERE token_hash=? AND client_hash=? AND expires_at>?').bind(tokenHash, clientHash, now).first();
        if (retry && (retry.visibility || 'public') === visibility && !!retry.ranked === rankOptIn && !!retry.anonymous === anonymous && (visibility !== 'private' || equalDigest(retry.view_hash, viewHash))) return json(shareMetadata(retry, origin));
        if (retry) reject('An existing report has different sharing options.', 409);
        reject('Free community storage is full. Existing links and local exports remain available.', 507);
      }
      return json({ id, url: `${origin}/r/${id}`, created_at_ms: now, expires_at_ms: expires, scope: record.scope, anonymous, rank_opt_in: rankOptIn, visibility, record_hash: hash, validation: 'community' }, 201);
    }
    const shareMatch = /^\/v1\/shares\/([a-f0-9]{32})$/.exec(url.pathname);
    if (shareMatch && request.method === 'GET') {
      await quota(db, `report-read:${day}`, 2000, (day + 1) * 86400000);
      const row = await db.prepare('SELECT * FROM shares WHERE id=? AND expires_at>?').bind(shareMatch[1], now).first();
      if (!row) reject('This report was removed, expired or never shared.', 404);
      if (row.visibility === 'private') {
        const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') || '')?.[1];
        if (!token || !equalDigest(await digest(token), row.view_hash)) reject('This report was removed, expired or needs its private viewing link.', 404);
      }
      return json({ ...shareMetadata(row, origin), record: JSON.parse(row.record_json), notice: NOTICE });
    }
    if (shareMatch && request.method === 'DELETE') {
      const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') || '')?.[1];
      if (!token) reject('A deletion key is required.', 401);
      const tokenHash = await digest(token), row = await db.prepare('SELECT token_hash FROM shares WHERE id=?').bind(shareMatch[1]).first();
      if (row) {
        let difference = 0; for (let i = 0; i < 64; i++) difference |= tokenHash.charCodeAt(i) ^ row.token_hash.charCodeAt(i);
        if (difference) reject('This deletion key does not own the report.', 403);
        await db.prepare('DELETE FROM shares WHERE id=? AND token_hash=?').bind(shareMatch[1], tokenHash).run();
      }
      return json({ deleted: true, id: shareMatch[1] });
    }
    if (['/v1/rankings', '/v1/statistics'].includes(url.pathname) && request.method === 'GET') {
      await quota(db, `rank-read:${day}`, LIMITS.rankingReads, (day + 1) * 86400000);
      const query = comparisonQuery(url, now), { clause, params } = query, cohorts = await comparisonCohorts(db, query);
      if (url.pathname === '/v1/statistics') return json({ source: 'community-upload', weighting: 'submitted-records', status: query.comparable ? 'available' : 'context-required', filters: query.filters, cohort_minimum: COHORT_MINIMUM, entries: cohorts.map(row => ({ class_name: row.class_name, cp_known_count: row.cp_known_count, ...cohortStats(row.values) })), notice: `${NOTICE} Statistics count submitted encounters, not unique players. At least ${COHORT_MINIMUM} comparable records per class are required.`, updated_at_ms: now });
      const limitText = url.searchParams.get('limit') || '25', cursorText = url.searchParams.get('cursor') || '0';
      if (!/^\d{1,2}$/.test(limitText) || !/^\d{1,4}$/.test(cursorText)) reject('Invalid ranking page.');
      const limit = Math.min(50, Math.max(1, Number(limitText))), offset = Math.min(5000, Number(cursorText));
      const rows = await db.prepare(`SELECT id,name,class_name,dps,damage,duration,region,server,boss,difficulty,scope,combat_power FROM shares WHERE ${clause} ORDER BY dps DESC,id ASC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all();
      const total = (await db.prepare(`SELECT COUNT(*) AS count FROM shares WHERE ${clause}`).bind(...params).first())?.count || 0;
      return json({ entries: rows.results.map((row, index) => {
        const cohort = cohorts.find(group => group.class_name.toLowerCase() === row.class_name.toLowerCase()), count = cohort?.values.length ?? 0;
        const percentile = count >= COHORT_MINIMUM ? (cohort.values.filter(value => value < row.dps).length + cohort.values.filter(value => value === row.dps).length * .5) / count * 100 : null;
        return { rank: offset + index + 1, share_id: row.id, url: `${origin}/r/${row.id}`, name: row.name, class_name: row.class_name, dps: row.dps, total_damage: row.damage, duration_ms: row.duration, region: row.region, server: row.server, boss: row.boss, difficulty: row.difficulty, scope: row.scope, combat_power: row.combat_power, percentile, cohort_count: count, percentile_method: percentile === null ? null : 'record-midrank', validation: 'community' };
      }), total, next_cursor: offset + limit < total ? String(offset + limit) : null, notice: NOTICE, updated_at_ms: now, source: 'community-upload' });
    }
    return json({ error: 'Unknown community endpoint.' }, 404);
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    return json({ error: 'Community service is temporarily unavailable. Local reports still work.' }, 503);
  }
}
