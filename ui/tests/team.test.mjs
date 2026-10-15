import test from 'node:test';
import assert from 'node:assert/strict';
import { teamSnapshot, normalizeTeamSnapshot, observedPartyCasts, automaticTeamState, renderAutomaticTeam, renderTeam, renderTeamControls } from '../team.mjs';

const NOW = 1790000000000;
const SELF = 'a'.repeat(32), ALLY = 'b'.repeat(32), ROOM = 'c'.repeat(32);
const cooldown = (patch = {}) => ({ skill_id: 14090000, raw_remaining_units: 20000, estimated_remaining_ms: 5000, charges: null, age_ms: 1000, ready_confirmed: false, fresh: true, ...patch });
const peer = (patch = {}) => ({ peer_id: ALLY, display_name: 'Ally', class_name: 'Cleric', is_self: false, received_at_ms: NOW - 200, sequence: 4, capture_live: true, fresh: true, age_ms: 200, cooldowns: [cooldown()], ...patch });
const snapshot = (patch = {}) => ({ sampled_at_ms: NOW, enabled: true, status: 'active', room_id: ROOM, self_peer_id: SELF, expires_at_ms: NOW + 120000, is_host: false, peers: [peer()], last_sync_at_ms: NOW - 100, error: '', ...patch });
const cast = (patch = {}) => ({ actor_id: 8, skill_id: 16090000, target_id: 90, last_observed_at_ms: NOW - 1000, use_count: 2, fresh_for_ms: 120000, fresh: true, ready_confirmed: false, source: 'server-cast', ...patch });
const gameState = (patch = {}) => ({ local_player_id: 7, local_identity_source: 'server', party_member_ids: [7, 8], party_membership_source: 'server', party_identity_roster: { source: 'server', members: [{ actor_id: 7, name: 'Local', class_name: 'Ranger', identity_confirmed: true }, { actor_id: 8, name: 'Healer', class_name: 'Cleric', identity_confirmed: true }] }, players: [], observed_casts: [cast()], ...patch });
const actorCooldown = (patch = {}) => ({ actor_id: 8, skill_id: 16090000, skill_family_id: 16090000, unit: 'milliseconds', source: 'server-cast', observation_kind: 'cast-cooldown', cooldown_ms: 30000, remaining_ms: 29000, expires_at_ms: NOW + 29000, observed_at_ms: NOW - 1000, sampled_at_ms: NOW, charges: null, max_charges: null, recharge_remaining_ms: null, recharge_expires_at_ms: null, charges_observed_at_ms: null, readiness: 'cooling', ready_confirmed: false, available_use_confirmed: false, provisional: false, fresh: true, confirmation_source: null, estimated: true, ...patch });

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

test('raw sharing intent preserves an enabled stop action while clock-invalid snapshots stay untrusted', () => {
  const clockBad = snapshot({ sampled_at_ms: NOW + 1000, invitation: 'do-not-render', peers: [peer({ cooldowns: [cooldown({ raw_remaining_units: 0, ready_confirmed: true })] })] });
  const normalized = teamSnapshot(clockBad, { now: NOW });
  assert.equal(normalized.enabled, false);
  assert.deepEqual(normalized.peers, []);
  const controls = renderTeamControls(normalized, { now: NOW, locale: 'en', relayActive: true });
  assert.match(controls, /Sharing active · refreshing state/);
  assert.match(controls, /data-action="team-leave">Stop sharing/);
  assert.doesNotMatch(controls, /team-join-form|team-create|team-copy-invite|do-not-render/);
  const html = renderTeam(clockBad, { now: NOW, locale: 'en', relayActive: true });
  assert.match(html, /data-action="team-leave">Stop sharing/);
  assert.doesNotMatch(html, /data-team-peer=|>Ready</);
  for (const options of [{ busy: true }, { native: false }]) {
    assert.match(renderTeamControls(normalized, { now: NOW, relayActive: true, ...options }), /data-action="team-leave" disabled/);
  }
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

test('automatic cooldowns use actual actor-bound milliseconds without a relay room', () => {
  const state = gameState({ actor_cooldowns: [actorCooldown()] });
  const view = automaticTeamState(state, { now: NOW + 1000 });
  assert.equal(view.available, true);
  assert.equal(view.source, 'server-actor-cooldown');
  assert.equal(view.status, 'receiving');
  assert.deepEqual(view.members.map(member => member.name), ['Local', 'Healer']);
  const row = view.members[1].cooldowns[0];
  assert.equal(row.cooldown_ms, 30000);
  assert.equal(row.remaining_ms, 28000);
  assert.equal(row.age_ms, 2000);
  assert.equal(row.kind, 'cooling');
  assert.equal(row.ready_confirmed, false);
  const html = renderTeam(null, { state, now: NOW, locale: 'en', consent: false });
  assert.match(html, /Automatic team cooldowns/);
  assert.match(html, /Total cooldown: 30 s/);
  assert.match(html, /~29 s/);
  assert.match(html, /does not need Luma, an invitation or Internet sharing/);
  assert.ok(html.indexOf('class="automatic-team"') < html.indexOf('class="team-optional-relay"'));
  assert.match(html, /<details class="team-optional-relay"><summary>Optional sharing between devices/);
});

test('automatic roster shows a healer before damage and retains different players of the same class', () => {
  const state = gameState({ players: [], party_member_ids: [7, 8, 9], party_identity_roster: { source: 'server', members: [
    { actor_id: 7, name: 'Local', class_name: 'Ranger', identity_confirmed: true },
    { actor_id: 8, name: 'Healer', class_name: 'Cleric', identity_confirmed: true },
    { actor_id: 9, name: 'SecondHealer', class_name: 'Cleric', identity_confirmed: true },
  ] }, actor_cooldowns: [actorCooldown(), actorCooldown({ actor_id: 9, remaining_ms: 19000, expires_at_ms: NOW + 19000 })] });
  const view = automaticTeamState(state, { now: NOW, classFilter: 'cleric' });
  assert.equal(view.total_members, 3);
  assert.equal(view.total_cooldowns, 2);
  assert.deepEqual(view.classes, ['Ranger', 'Cleric']);
  assert.deepEqual(view.members.map(member => member.name), ['Healer', 'SecondHealer']);
  assert.deepEqual(view.members.map(member => member.cooldowns[0].remaining_ms), [29000, 19000]);
  const html = renderAutomaticTeam(state, { now: NOW, locale: 'en', classFilter: 'Cleric' });
  assert.match(html, /value="Cleric" selected/);
  assert.doesNotMatch(html, /data-automatic-actor="7"/);
});

test('automatic actor observations cannot establish identities or game-party membership', () => {
  const data = [actorCooldown(), actorCooldown({ actor_id: 99 })];
  for (const patch of [
    { party_membership_source: 'manual' },
    { party_member_ids: [7] },
    { party_identity_roster: { source: 'unknown', members: [{ actor_id: 8, name: 'Healer', identity_confirmed: true }] } },
    { party_identity_roster: { source: 'server', members: [{ actor_id: 8, name: 'Healer', identity_confirmed: false }] } },
    { party_identity_roster: { source: 'server', members: [{ actor_id: 8, name: '#8', identity_confirmed: true }] } },
  ]) {
    const view = automaticTeamState(gameState({ actor_cooldowns: data, ...patch }), { now: NOW });
    assert.equal(view.total_cooldowns, 0);
    assert.equal(view.members.some(member => member.actor_id === '99'), false);
  }
  const conflicts = automaticTeamState(gameState({ actor_cooldowns: data, party_identity_roster: { source: 'server', members: [
    { actor_id: 8, name: 'Healer', class_name: 'Cleric', identity_confirmed: true },
    { actor_id: 8, name: 'ReusedActor', class_name: 'Ranger', identity_confirmed: true },
  ] } }), { now: NOW });
  assert.equal(conflicts.members.some(member => member.actor_id === '8'), false);
});

test('an automatic class filter resets when its last actor leaves the roster', () => {
  const state = gameState({ party_member_ids: [7], party_identity_roster: { source: 'server', members: [
    { actor_id: 7, name: 'Local', class_name: 'Ranger', identity_confirmed: true },
  ] }, actor_cooldowns: [actorCooldown({ actor_id: 7 })] });
  const view = automaticTeamState(state, { now: NOW, classFilter: 'Cleric' });
  assert.equal(view.class_filter, '');
  assert.deepEqual(view.classes, ['Ranger']);
  assert.deepEqual(view.members.map(member => member.actor_id), ['7']);
  assert.equal(view.total_cooldowns, 1);
  const html = renderAutomaticTeam(state, { now: NOW, locale: 'en', classFilter: 'Cleric' });
  assert.match(html, /data-automatic-actor="7"/);
  assert.doesNotMatch(html, /value="Cleric"/);
  assert.equal(automaticTeamState(state, { now: NOW, classFilter: 'rAnGeR' }).class_filter, 'Ranger');
});

test('confirmed own cooldowns work while solo and manual character bindings do not qualify', () => {
  const state = gameState({ local_player_name: 'Solo', party_member_ids: [], party_membership_source: 'unknown', party_identity_roster: null, actor_cooldowns: [actorCooldown({ actor_id: 7 })] });
  const view = automaticTeamState(state, { now: NOW });
  assert.equal(view.available, true);
  assert.equal(view.members[0].name, 'Solo');
  assert.equal(view.members[0].is_self, true);
  assert.equal(view.known_party, false);
  assert.equal(automaticTeamState({ ...state, local_identity_source: 'manual' }, { now: NOW }).members.length, 0);
});

test('live team identity replaces completed encounter actors and includes a new non-damaging healer', () => {
  const state = gameState({ local_player_name: 'PreviousLocal', players: [
    { id: 7, name: 'PreviousLocal', class_name: 'Ranger', identity_confirmed: true },
    { id: 8, name: 'PreviousHealer', class_name: 'Cleric', identity_confirmed: true },
  ], live_team_identity: {
    local: { actor_id: 17, name: 'CurrentLocal', class_name: 'Templar', identity_source: 'server' },
    party_member_ids: [17, 18], party_membership_source: 'server',
  }, party_identity_roster: { source: 'server', members: [
    { actor_id: 17, name: 'CurrentLocal', class_name: 'Templar', identity_confirmed: true },
    { actor_id: 18, name: 'CurrentHealer', class_name: 'Cleric', identity_confirmed: true },
  ] }, actor_cooldowns: [actorCooldown({ actor_id: 18 }), actorCooldown({ actor_id: 7 })],
  observed_casts: [cast({ actor_id: 18 }), cast({ actor_id: 17 }), cast({ actor_id: 8 })] });
  const view = automaticTeamState(state, { now: NOW });
  assert.deepEqual(view.members.map(member => [member.actor_id, member.name, member.is_self]), [
    ['17', 'CurrentLocal', true], ['18', 'CurrentHealer', false],
  ]);
  assert.equal(view.total_cooldowns, 1);
  assert.equal(view.members[1].class_name, 'Cleric');
  assert.deepEqual(observedPartyCasts(state, NOW).map(row => [row.actor_id, row.name]), [['18', 'CurrentHealer']]);
  assert.doesNotMatch(renderAutomaticTeam(state, { now: NOW, locale: 'en' }), /PreviousLocal|PreviousHealer/);
});

test('an explicit unresolved live identity never falls back to completed encounter self or party', () => {
  for (const local of [null, { actor_id: 7, name: 'Unconfirmed', class_name: 'Ranger', identity_source: 'manual' }]) {
    const state = gameState({ local_player_name: 'PreviousLocal', live_team_identity: {
      local, party_member_ids: [], party_membership_source: 'unresolved',
    }, actor_cooldowns: [actorCooldown({ actor_id: 7 }), actorCooldown()] });
    const view = automaticTeamState(state, { now: NOW });
    assert.deepEqual(view.members, []);
    assert.equal(view.known_party, false);
    assert.deepEqual(observedPartyCasts(state, NOW), []);
  }
});

test('live own name and class resolve without encounter damage while null identity retains legacy compatibility', () => {
  const state = gameState({ players: [], local_player_name: 'HistoricalName', live_team_identity: {
    local: { actor_id: 17, name: 'NewHealer', class_name: 'Cleric', identity_source: 'server' },
    party_member_ids: [], party_membership_source: 'unresolved',
  }, actor_cooldowns: [actorCooldown({ actor_id: 17 })] });
  const member = automaticTeamState(state, { now: NOW }).members[0];
  assert.equal(member.actor_id, '17');
  assert.equal(member.name, 'NewHealer');
  assert.equal(member.class_name, 'Cleric');
  assert.equal(member.cooldowns.length, 1);
  const legacy = gameState({ actor_cooldowns: [actorCooldown()] });
  assert.deepEqual(automaticTeamState({ ...legacy, live_team_identity: null }, { now: NOW }), automaticTeamState(legacy, { now: NOW }));
  assert.deepEqual(observedPartyCasts({ ...legacy, live_team_identity: null }, NOW), observedPartyCasts(legacy, NOW));
});

test('unknown durations remain unknown and never gain a static class cooldown', () => {
  const unknown = actorCooldown({ cooldown_ms: null, remaining_ms: null, expires_at_ms: null, estimated: false });
  const state = gameState({ actor_cooldowns: [unknown] });
  const row = automaticTeamState(state, { now: NOW }).members[1].cooldowns[0];
  assert.equal(row.cooldown_ms, null);
  assert.equal(row.remaining_ms, null);
  assert.equal(row.kind, 'unknown');
  assert.match(renderAutomaticTeam(state, { now: NOW, locale: 'en' }), /Unknown/);
  assert.doesNotMatch(renderAutomaticTeam(state, { now: NOW, locale: 'en' }), /Total cooldown:/);
});

test('only authoritative own counter zero confirms an ordinary cooldown as ready', () => {
  const zero = actorCooldown({ actor_id: 7, remaining_ms: 0, expires_at_ms: NOW, observed_at_ms: NOW, ready_confirmed: true, estimated: false, confirmation_source: 'local-counter-zero' });
  const state = gameState({ actor_cooldowns: [zero] });
  assert.equal(automaticTeamState(state, { now: NOW }).members[0].cooldowns[0].kind, 'confirmed');
  assert.match(renderAutomaticTeam(state, { now: NOW, locale: 'en' }), /Ready · confirmed/);
  for (const patch of [{ actor_id: 8 }, { confirmation_source: null }, { ready_confirmed: false }, { provisional: true }]) {
    const view = automaticTeamState(gameState({ actor_cooldowns: [{ ...zero, ...patch }] }), { now: NOW });
    assert.equal(view.members.flatMap(member => member.cooldowns).some(row => row.ready_confirmed), false);
  }
});

test('countdown expiry stays elapsed and a provisional cast cannot claim readiness', () => {
  const elapsed = actorCooldown({ remaining_ms: 0, expires_at_ms: NOW - 1, observed_at_ms: NOW - 30001 });
  const state = gameState({ actor_cooldowns: [elapsed] });
  const row = automaticTeamState(state, { now: NOW }).members[1].cooldowns[0];
  assert.equal(row.remaining_ms, 0);
  assert.equal(row.kind, 'elapsed');
  assert.equal(row.ready_confirmed, false);
  assert.match(renderAutomaticTeam(state, { now: NOW, locale: 'en' }), /Timer elapsed · awaiting update/);
  assert.doesNotMatch(renderAutomaticTeam(state, { now: NOW, locale: 'en' }), /Ready · confirmed/);
  const provisional = automaticTeamState(gameState({ actor_cooldowns: [actorCooldown({ provisional: true, readiness: 'provisional' })] }), { now: NOW });
  assert.equal(provisional.members[1].cooldowns[0].kind, 'provisional');
});

test('held own zero confirmation expires from observation time without expiring long countdowns', () => {
  const zero = actorCooldown({ actor_id: 7, remaining_ms: 0, expires_at_ms: NOW - 5500,
    observed_at_ms: NOW - 5500, ready_confirmed: true, estimated: false,
    confirmation_source: 'local-counter-zero' });
  const long = actorCooldown({ observed_at_ms: NOW - 90000, cooldown_ms: 100000,
    remaining_ms: 10000, expires_at_ms: NOW + 10000 });
  const state = gameState({ actor_cooldowns: [zero, long] });
  assert.equal(automaticTeamState(state, { now: NOW + 500 }).members[0].cooldowns[0].kind, 'confirmed');
  const expired = automaticTeamState(state, { now: NOW + 501 });
  const own = expired.members[0].cooldowns[0];
  assert.equal(own.age_ms, 6001);
  assert.equal(own.ready_confirmed, false);
  assert.equal(own.confirmation_source, null);
  assert.equal(own.kind, 'elapsed');
  assert.equal(expired.members[1].cooldowns[0].remaining_ms, 9499);
  assert.equal(expired.members[1].cooldowns[0].kind, 'cooling');
  assert.doesNotMatch(renderAutomaticTeam(state, { now: NOW + 501, locale: 'en' }), /Ready · confirmed/);
});

test('observed charges and recharge timers are separate and expiration never increments a count', () => {
  const charges = actorCooldown({ observation_kind: 'cast-charges', cooldown_ms: null, remaining_ms: null, expires_at_ms: null,
    charges: 2, charges_observed_at_ms: NOW - 1000, recharge_remaining_ms: 500, recharge_expires_at_ms: NOW + 500,
    available_use_confirmed: true, readiness: 'available-charge' });
  const state = gameState({ actor_cooldowns: [charges] });
  const row = automaticTeamState(state, { now: NOW + 1000 }).members[1].cooldowns[0];
  assert.equal(row.kind, 'available-charge');
  assert.equal(row.charges, 2);
  assert.equal(row.max_charges, null);
  assert.equal(row.recharge_remaining_ms, 0);
  assert.equal(row.ready_confirmed, false);
  const html = renderAutomaticTeam(state, { now: NOW + 1000, locale: 'en' });
  assert.match(html, /2 observed uses/);
  assert.match(html, /Recharge timer elapsed · count unchanged/);
  assert.doesNotMatch(html, /Ready · confirmed/);
  const ownNotice = { ...charges, actor_id: 7, source: 'server-charge', observation_kind: 'charge-update', confirmation_source: 'charge-notice', ready_confirmed: true };
  assert.equal(automaticTeamState(gameState({ actor_cooldowns: [ownNotice] }), { now: NOW }).members[0].cooldowns[0].kind, 'available-charge');
  const empty = { ...charges, charges: 0, available_use_confirmed: false, readiness: 'charges-empty' };
  assert.equal(automaticTeamState(gameState({ actor_cooldowns: [empty] }), { now: NOW }).members[1].cooldowns[0].kind, 'charges-empty');
});

test('actual cooldowns retain long running timers while held samples, gaps and future times fail closed', () => {
  const old = actorCooldown({ observed_at_ms: NOW - 20000, remaining_ms: 10000, expires_at_ms: NOW + 10000 });
  assert.equal(automaticTeamState(gameState({ actor_cooldowns: [old] }), { now: NOW }).available, true);
  for (const patch of [{ fresh: false }, { sampled_at_ms: NOW - 6001 }, { sampled_at_ms: NOW + 1 }, { observed_at_ms: NOW + 1 },
    { observed_at_ms: NOW - 61000, expires_at_ms: NOW - 31000, remaining_ms: 0 }]) {
    assert.equal(automaticTeamState(gameState({ actor_cooldowns: [actorCooldown(patch)] }), { now: NOW }).available, false);
  }
  for (const patch of [{ status: 'disconnected' }, { capture: { status: 'stopped' } }, { actor_cooldowns: [] }]) {
    const view = automaticTeamState(gameState({ actor_cooldowns: [actorCooldown()], ...patch }), { now: NOW });
    assert.equal(view.available, false);
    assert.equal(view.members[1].cooldowns.length, 0);
  }
});

test('malformed automatic values are rejected and same-actor skill updates use the newer observation', () => {
  for (const patch of [{ actor_id: 0 }, { unit: 'unknown' }, { source: 'estimate' }, { observation_kind: 'windup' },
    { skill_id: NaN }, { cooldown_ms: Infinity }, { remaining_ms: -1 }, { remaining_ms: 30001 },
    { cooldown_ms: undefined }, { expires_at_ms: NOW + 3600001 }, { recharge_remaining_ms: -1 }]) {
    assert.equal(automaticTeamState(gameState({ actor_cooldowns: [actorCooldown(patch)] }), { now: NOW }).available, false);
  }
  const state = gameState({ actor_cooldowns: [actorCooldown(), actorCooldown({ observed_at_ms: NOW, remaining_ms: 20000, expires_at_ms: NOW + 20000 })] });
  const rows = automaticTeamState(state, { now: NOW }).members[1].cooldowns;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].remaining_ms, 20000);
});

test('automatic rendering escapes names and bounds members, cooldowns and compact content', () => {
  const state = gameState({ party_identity_roster: { source: 'server', members: [{ actor_id: 8, name: '<img src=x>', class_name: 'bad; color:red', identity_confirmed: true }] },
    actor_cooldowns: Array.from({ length: 1000 }, (_, index) => actorCooldown({ skill_id: 11000000 + index })) });
  const view = automaticTeamState(state, { now: NOW });
  assert.equal(view.total_cooldowns, 64);
  const html = renderAutomaticTeam(state, { now: NOW, locale: 'en' });
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<img|color:red/);
  assert.match(html, /More skills \(60\)/);
  const compact = renderAutomaticTeam(state, { now: NOW, locale: 'en', compact: true });
  assert.equal((compact.match(/<b>/g) || []).length, 4);
  assert.equal(renderAutomaticTeam(null, { now: NOW, compact: true }), '');
  for (const value of [null, [], false, 4, 'text', { actor_cooldowns: [null, [], {}] }]) {
    assert.doesNotThrow(() => renderAutomaticTeam(value, { now: NOW }));
  }
});

test('automatic input scans the bounded native ledger beyond 512 rows', () => {
  const unrelated = Array.from({ length: 1024 }, () => actorCooldown({ actor_id: 99 }));
  const included = gameState({ actor_cooldowns: [...unrelated.slice(0, 700), actorCooldown()] });
  assert.equal(automaticTeamState(included, { now: NOW }).total_cooldowns, 1);
  const outsideBound = gameState({ actor_cooldowns: [...unrelated, actorCooldown()] });
  assert.equal(automaticTeamState(outsideBound, { now: NOW }).total_cooldowns, 0);
});
