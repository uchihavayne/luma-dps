import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSnapshot, normalizeTeamSnapshot, observedPartyCasts, renderTeam, renderTeamControls } from '../team.mjs';

const NOW = 1790000000000;
const SELF = 'a'.repeat(32), ALLY = 'b'.repeat(32), ROOM = 'c'.repeat(32);
const cooldown = (patch = {}) => ({ skill_id: 14090000, raw_remaining_units: 20000, estimated_remaining_ms: 5000, charges: null, age_ms: 1000, ready_confirmed: false, fresh: true, ...patch });
const peer = (patch = {}) => ({ peer_id: ALLY, display_name: 'Ally', class_name: 'Cleric', is_self: false, received_at_ms: NOW - 200, sequence: 4, capture_live: true, fresh: true, age_ms: 200, cooldowns: [cooldown()], ...patch });
const snapshot = (patch = {}) => ({ sampled_at_ms: NOW, enabled: true, status: 'active', room_id: ROOM, self_peer_id: SELF, expires_at_ms: NOW + 120000, is_host: false, peers: [peer()], last_sync_at_ms: NOW - 100, error: '', ...patch });
const cast = (patch = {}) => ({ actor_id: 8, skill_id: 16090000, target_id: 90, last_observed_at_ms: NOW - 1000, use_count: 2, fresh_for_ms: 120000, fresh: true, ready_confirmed: false, source: 'server-cast', ...patch });
const gameState = (patch = {}) => ({ local_player_id: 7, local_identity_source: 'server', party_member_ids: [7, 8], party_membership_source: 'server', party_identity_roster: { source: 'server', members: [{ actor_id: 7, name: 'Local', class_name: 'Ranger', identity_confirmed: true }, { actor_id: 8, name: 'Healer', class_name: 'Cleric', identity_confirmed: true }] }, players: [], observed_casts: [cast()], ...patch });

test('empty state is local-only and normalization does not expose credentials', () => {
  assert.equal(normalizeTeamSnapshot, teamSnapshot);
  const result = teamSnapshot(undefined, { now: NOW });
  assert.equal(result.enabled, false);
  assert.equal(result.status, 'idle');
  assert.deepEqual(result.peers, []);
  const secret = 'never-render-this-secret';
  const normalized = teamSnapshot(snapshot({ host_token: secret, join_token: secret, peer_token: secret, invite: secret }), { now: NOW });
  assert.equal(JSON.stringify(normalized).includes(secret), false);
  assert.equal(renderTeam(normalized, { now: NOW }).includes(secret), false);
});

test('held team observations age from sample time without subtracting sender age twice', () => {
  const first = teamSnapshot(snapshot(), { now: NOW });
  assert.equal(first.peers[0].cooldowns[0].estimated_remaining_ms, 5000);
  const second = teamSnapshot(first, { now: NOW + 1000 });
  assert.equal(second.peers[0].age_ms, 1200);
  assert.equal(second.peers[0].cooldowns[0].age_ms, 2000);
  assert.equal(second.peers[0].cooldowns[0].estimated_remaining_ms, 4000);
  const third = teamSnapshot(second, { now: NOW + 2000 });
  assert.equal(third.peers[0].cooldowns[0].estimated_remaining_ms, 3000);
});

test('raw counter units never become seconds without a supplied estimate', () => {
  const raw = snapshot({ peers: [peer({ cooldowns: [cooldown({ estimated_remaining_ms: null })] })] });
  const result = teamSnapshot(raw, { now: NOW });
  assert.equal(result.peers[0].cooldowns[0].kind, 'unknown');
  assert.equal(result.peers[0].cooldowns[0].estimated_remaining_ms, null);
  assert.match(renderTeam(result, { now: NOW, locale: 'en' }), /Unknown/);
  assert.doesNotMatch(renderTeam(result, { now: NOW, locale: 'en' }), /~20000/);
});

test('only a fresh explicit raw zero confirms readiness', () => {
  for (const patch of [{ raw_remaining_units: 1, ready_confirmed: true }, { raw_remaining_units: 0, ready_confirmed: false }, { raw_remaining_units: null, ready_confirmed: true }, { raw_remaining_units: 0, ready_confirmed: true, fresh: false }]) {
    const result = teamSnapshot(snapshot({ peers: [peer({ cooldowns: [cooldown(patch)] })] }), { now: NOW });
    assert.equal(result.peers[0].cooldowns[0].ready_confirmed, false);
  }
  const result = teamSnapshot(snapshot({ peers: [peer({ cooldowns: [cooldown({ raw_remaining_units: 0, ready_confirmed: true, estimated_remaining_ms: null })] })] }), { now: NOW });
  assert.equal(result.peers[0].cooldowns[0].kind, 'confirmed');
  assert.match(renderTeam(result, { now: NOW, locale: 'en' }), />Ready</);
});

test('an elapsed estimate is distinct from readiness and displayed as an estimate', () => {
  const value = snapshot({ peers: [peer({ cooldowns: [cooldown({ estimated_remaining_ms: 500, age_ms: 0 })] })] });
  const result = teamSnapshot(value, { now: NOW + 1000 });
  assert.equal(result.peers[0].cooldowns[0].estimated_remaining_ms, 0);
  assert.equal(result.peers[0].cooldowns[0].kind, 'estimated-elapsed');
  assert.equal(result.peers[0].cooldowns[0].ready_confirmed, false);
  assert.match(renderTeam(result, { now: NOW + 1000, locale: 'en' }), /Estimate elapsed/);
});

test('stale, stopped and missing-counter observations cannot retain live numeric state', () => {
  const ready = snapshot({ peers: [peer({ cooldowns: [cooldown({ raw_remaining_units: 0, ready_confirmed: true, charges: 2 })] })] });
  for (const [value, at] of [[ready, NOW + 6001], [snapshot({ peers: [peer({ capture_live: false })] }), NOW]]) {
    const result = teamSnapshot(value, { now: at });
    const row = result.peers[0].cooldowns[0];
    assert.equal(row.fresh, false);
    assert.equal(row.ready_confirmed, false);
    assert.equal(row.raw_remaining_units, null);
    assert.equal(row.estimated_remaining_ms, null);
    assert.equal(row.charges, null);
  }
  const result = teamSnapshot(snapshot({ peers: [peer({ cooldowns: [cooldown({ raw_remaining_units: null, estimated_remaining_ms: null, charges: 2, ready_confirmed: true })] })] }), { now: NOW });
  assert.equal(result.peers[0].cooldowns[0].kind, 'unknown');
});

test('room and peer expiration remove data while future clocks fail closed', () => {
  assert.deepEqual(teamSnapshot(snapshot(), { now: NOW + 20001 }).peers, []);
  const expired = teamSnapshot(snapshot(), { now: NOW + 120000 });
  assert.equal(expired.enabled, false);
  assert.equal(expired.status, 'expired');
  assert.deepEqual(expired.peers, []);
  for (const patch of [{ sampled_at_ms: NOW + 1 }, { last_sync_at_ms: NOW + 1 }, { room_id: 'bad' }, { self_peer_id: null }, { expires_at_ms: null }]) {
    const result = teamSnapshot(snapshot(patch), { now: NOW });
    assert.equal(result.enabled, false);
    assert.deepEqual(result.peers, []);
    assert.notEqual(result.status, 'active');
  }
});

test('names are escaped and class values cannot enter CSS or markup', () => {
  const value = snapshot({ peers: [peer({ display_name: '<img src=x onerror=alert(1)>', class_name: 'url(javascript:bad)' })] });
  const html = renderTeam(value, { now: NOW });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img|javascript:bad/);
  assert.match(html, /Unknown/);
});

test('malformed peers and duplicate skills are filtered and arrays are bounded', () => {
  const many = Array.from({ length: 1000 }, (_, i) => peer({ peer_id: i.toString(16).padStart(32, '0'), cooldowns: Array.from({ length: 1000 }, (_, j) => cooldown({ skill_id: j + 1 })) }));
  const result = teamSnapshot(snapshot({ peers: many }), { now: NOW });
  assert.equal(result.peers.length, 12);
  assert.equal(result.peers[0].cooldowns.length, 64);
  const bad = teamSnapshot(snapshot({ peers: [peer({ peer_id: 'bad' }), peer(), peer(), peer({ peer_id: 'd'.repeat(32), cooldowns: [cooldown(), cooldown(), cooldown({ skill_id: -1 }), cooldown({ skill_id: 3, age_ms: NaN })] })] }), { now: NOW });
  assert.equal(bad.peers.length, 2);
  assert.equal(bad.peers[1].cooldowns.length, 1);
});

test('self marker derives from the local peer id rather than a remote boolean', () => {
  const result = teamSnapshot(snapshot({ peers: [peer({ is_self: true }), peer({ peer_id: SELF, display_name: 'Me', is_self: false })] }), { now: NOW });
  assert.equal(result.peers[0].peer_id, SELF);
  assert.equal(result.peers[0].is_self, true);
  assert.equal(result.peers[1].is_self, false);
});

test('late snapshots and lower peer sequences cannot replace newer observations', () => {
  const previous = teamSnapshot(snapshot(), { now: NOW });
  const delayed = snapshot({ sampled_at_ms: NOW - 1000, last_sync_at_ms: NOW - 1100, peers: [peer({ display_name: 'Old', sequence: 1 })] });
  const accepted = teamSnapshot(delayed, { previous, now: NOW + 1000 });
  assert.equal(accepted.peers[0].display_name, 'Ally');
  assert.equal(accepted.peers[0].sequence, 4);
  assert.equal(accepted.peers[0].cooldowns[0].estimated_remaining_ms, 4000);
  const backwards = teamSnapshot(snapshot({ sampled_at_ms: NOW + 1000, last_sync_at_ms: NOW, peers: [peer({ sequence: 1, display_name: 'Old' })] }), { previous, now: NOW + 1000 });
  assert.equal(backwards.peers[0].sequence, 4);
});

test('create and join stay disabled until explicit consent and native availability', () => {
  const off = renderTeamControls(null, { now: NOW, locale: 'en' });
  assert.match(off, /id="team-consent"[^>]*type="checkbox" required/);
  assert.doesNotMatch(off, /type="checkbox"[^>]* checked/);
  assert.match(off, /data-action="team-create" disabled/);
  assert.match(off, /data-action="team-join" disabled/);
  const allowed = renderTeamControls(null, { now: NOW, consent: true });
  assert.match(allowed, /data-action="team-create">/);
  assert.match(allowed, /data-action="team-join">/);
  for (const options of [{ native: false }, { busy: true }]) {
    const unavailable = renderTeamControls(null, { now: NOW, consent: true, ...options });
    assert.match(unavailable, /data-action="team-create" disabled/);
    assert.match(unavailable, /data-action="team-join" disabled/);
  }
  assert.match(allowed, /name="teamInvite" type="password"/);
});

test('active room controls explain host closure without rendering invitation credentials', () => {
  const code = `LUMA:${ROOM}:${'d'.repeat(64)}`;
  const html = renderTeamControls(snapshot({ is_host: true, invitation: code }), { now: NOW, locale: 'en', invite: code });
  assert.match(html, /data-action="team-copy-invite"/);
  assert.match(html, /data-action="team-leave"/);
  assert.match(html, /Close room for everyone/);
  assert.doesNotMatch(html, /team-join-form/);
  assert.equal(html.includes(code), false);
});

test('native errors are replaced with generic text and cannot expose tokens', () => {
  const privateError = `secret-${'d'.repeat(64)} <script>alert(1)</script>`;
  const result = teamSnapshot(snapshot({ error: privateError, status: 'retrying' }), { now: NOW });
  assert.equal(result.error, 'unavailable');
  const html = renderTeam(result, { now: NOW, locale: 'en' });
  assert.match(html, /team service could not be reached/);
  assert.equal(html.includes(privateError), false);
  assert.doesNotMatch(html, /<script>/);
});

test('observed party uses resolve non-damaging healers through confirmed identity roster', () => {
  const rows = observedPartyCasts(gameState(), NOW);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Healer');
  assert.equal(rows[0].class_name, 'Cleric');
  assert.equal(rows[0].age_ms, 1000);
  assert.equal(rows[0].use_count, 2);
  assert.equal(rows[0].ready_confirmed, false);
  const html = renderTeam(null, { state: gameState(), now: NOW, locale: 'en' });
  assert.match(html, /Healer/);
  assert.match(html, /does not establish cooldown readiness/);
});

test('room participants never become party actors or sources of cast names', () => {
  assert.deepEqual(observedPartyCasts(gameState({ party_membership_source: 'manual' }), NOW), []);
  assert.deepEqual(observedPartyCasts(gameState({ party_identity_roster: { source: 'unknown', members: [] } }), NOW), []);
  assert.deepEqual(observedPartyCasts(gameState({ party_member_ids: [7] }), NOW), []);
  assert.deepEqual(observedPartyCasts(gameState({ party_identity_roster: { source: 'server', members: [{ actor_id: 8, name: 'Spoof', identity_confirmed: false }] } }), NOW), []);
});

test('party use filtering rejects windups, self, stale data, false readiness and future timestamps', () => {
  for (const patch of [{ source: 'server-windup' }, { actor_id: 7 }, { ready_confirmed: true }, { fresh: false }, { last_observed_at_ms: NOW + 1 }, { last_observed_at_ms: NOW - 120001 }, { use_count: 0 }, { skill_id: -1 }]) {
    assert.deepEqual(observedPartyCasts(gameState({ observed_casts: [cast(patch)] }), NOW), []);
  }
  const many = Array.from({ length: 1000 }, (_, i) => cast({ skill_id: i + 1 }));
  assert.equal(observedPartyCasts(gameState({ observed_casts: many }), NOW).length, 24);
});

test('team rendering remains bounded for arbitrary primitive and nested malformed inputs', () => {
  for (const value of [null, true, 42, 'text', [], {}, { peers: [null] }, snapshot({ peers: [null, [], {}, peer({ cooldowns: [null, {}, []] })] })]) {
    assert.doesNotThrow(() => renderTeam(value, { now: NOW, state: value }));
  }
});
