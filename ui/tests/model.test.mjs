import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, liveServerActorId, normalizePreferences, importTheme, exportTheme, validBackground, recurringEvent, manualOdyle, normalizeState, sortedPlayers, playerShare, clockTime, importHistory, cooldownStatus, resizeStep, compactHeaderHeight, acceptsCalendarSnapshot, acceptsStateSnapshot } from '../model.mjs';
import { DISPLAY_MODULES, displayModulePreset, petOnlyDisplay, visibleAnalysisSections, visibleSettingsSections } from '../model.mjs';
import { ANALYSIS_SECTIONS, SETTINGS_SECTIONS } from '../navigation.mjs';
import { recentPetTarget, normalizeRecentPersonalTarget } from '../model.mjs';

const petTargetState = (overrides = {}) => ({
  local_player_id: '7', local_player_name: 'Center', local_identity_source: 'server',
  live_team_identity: { local: { actor_id: 7, name: 'Center', identity_source: 'server' } },
  focused_target_id: '960', focused_target_observed_at_ms: 1000,
  live_target: { id: '960', name: 'Krall Armed Soldier', own_participant: { id: '7', damage: 100 }, own_last_hit_ms: 1000 },
  targets: [], diagnostics: { stream_gaps: 0 }, capture: { status: 'capturing', missed_packets: 0 }, ...overrides,
});

test('one-click target pinning keeps an observed own kill for ten seconds without renewing the hit time', () => {
  const live = petTargetState(), first = recentPetTarget(null, live, 1000);
  assert.equal(first.target.name, 'Krall Armed Soldier'); assert.equal(first.at, 1000);
  const completed = { ...live, focused_target_id: null, focused_target_observed_at_ms: null, live_target: null, encounter_active: false };
  const dead = recentPetTarget(first, completed, 5000);
  assert.deepEqual(dead, first);
  assert.equal(recentPetTarget(dead, completed, 10999).target.id, '960');
  assert.equal(recentPetTarget(dead, completed, 11000).target, null);
  assert.equal(recentPetTarget(null, completed, 5000).target, null);
  assert.equal(recentPetTarget(first, completed, 999).target, null);
});

test('new own targets replace pin suggestions, while stranger/manual identities and historical reports cannot supply them', () => {
  const first = recentPetTarget(null, petTargetState(), 1000);
  const next = petTargetState({ focused_target_id: '961', focused_target_observed_at_ms: 2000,
    live_target: { id: '961', name: 'Unrelated target', own_participant: { id: '7', damage: 1 } } });
  assert.equal(recentPetTarget(first, next, 2000).target.name, 'Unrelated target');
  assert.equal(recentPetTarget(first, { ...next, live_target: null }, 2000).target, null);
  assert.equal(recentPetTarget(null, petTargetState({ live_team_identity: { local: null } }), 1000), null);
  assert.equal(recentPetTarget(null, petTargetState({ local_identity_source: 'manual' }), 1000).target, null);
  assert.equal(recentPetTarget(null, petTargetState({ live_target: { id: '960', name: 'Krall Armed Soldier', own_participant: { id: '8', damage: 1 } } }), 1000).target, null);
  assert.equal(recentPetTarget(null, petTargetState({ focused_target_observed_at_ms: 2000 }), 1000).target, null);
});

test('capture discontinuity and character changes clear target pinning and never revive an earlier focus snapshot', () => {
  const first = recentPetTarget(null, petTargetState(), 1000);
  for (const patch of [{ capture: { status: 'capturing', missed_packets: 1 } }, { diagnostics: { stream_gaps: 1 } },
    { local_player_name: 'Other', live_team_identity: { local: { actor_id: 7, name: 'Other', identity_source: 'server' } } },
    { capture: { status: 'disconnected', missed_packets: 0 } }, { capture: { status: 'waiting', missed_packets: 0 } }]) {
    const changed = petTargetState(patch), cleared = recentPetTarget(first, changed, 2000);
    assert.equal(cleared.target, null);
    assert.equal(recentPetTarget(cleared, { ...changed, capture: { ...changed.capture, status: 'capturing' } }, 3000).target, null);
    const fresh = { ...changed, focused_target_observed_at_ms: 3500, capture: { ...changed.capture, status: 'capturing' } };
    assert.equal(recentPetTarget(cleared, fresh, 3500).target.id, '960');
  }
  assert.equal(recentPetTarget(first, petTargetState({ live_team_identity: { local: { actor_id: 8, name: 'Other', identity_source: 'server' } } }), 2000).target, null);
});

test('an actual one-shot self-hit DTO supplies a pet target after death without an earlier rendered focus', () => {
  const hit = { actor_id: 7, target_id: 960, target_name: 'Krall Armed Soldier', hit_at_ms: 1000, source: 'server-self-hit' };
  const dead = normalizeState(petTargetState({ focused_target_id: null, focused_target_observed_at_ms: null, live_target: null, encounter_active: false, recent_personal_target: hit }));
  assert.deepEqual(dead.recent_personal_target, { ...hit, actor_id: '7', target_id: '960' });
  const first = recentPetTarget(null, dead, 1500);
  assert.equal(first.target.name, 'Krall Armed Soldier'); assert.equal(first.at, 1000);
  assert.equal(recentPetTarget(first, dead, 10999).at, 1000);
  assert.equal(recentPetTarget(first, dead, 11000).target, null);
  const unnamed = { ...dead, recent_personal_target: { ...hit, target_id: 961, target_name: null, hit_at_ms: 2000 } };
  assert.deepEqual(recentPetTarget(first, unnamed, 2500).target, { id: '961', name: '' });
  assert.equal(recentPetTarget(first, { ...dead, recent_personal_target: null }, 1500).target, null);
  const gap = { ...dead, diagnostics: { stream_gaps: 1 } }, invalidated = recentPetTarget(first, gap, 1500);
  assert.equal(invalidated.target, null);
  assert.equal(recentPetTarget(invalidated, gap, 2000).target, null);
});

test('received-hit normalization never turns arbitrary IDs, sources, actors or future clocks into target pin suggestions', () => {
  const hit = { actor_id: 7, target_id: 960, target_name: 'Krall Armed Soldier', hit_at_ms: 1000, source: 'server-self-hit' };
  for (const patch of [{ actor_id: 0 }, { actor_id: 'manual' }, { target_id: 0 }, { target_id: 0x100000000 }, { hit_at_ms: -1 }, { hit_at_ms: Number.MAX_SAFE_INTEGER }, { source: 'manual' }]) assert.equal(normalizeRecentPersonalTarget({ ...hit, ...patch }), null);
  assert.equal(normalizeRecentPersonalTarget({ ...hit, target_name: 'Krall\nArmed Soldier' }).target_name, null);
  for (const patch of [{ actor_id: 8 }, { hit_at_ms: 2000 }]) {
    const value = petTargetState({ focused_target_id: null, focused_target_observed_at_ms: null, live_target: null, recent_personal_target: { ...hit, ...patch } });
    assert.equal(recentPetTarget(null, value, 1500).target, null);
  }
});

test('display modules persist a recoverable pet-only view independently of capture and listening settings', () => {
  const before = normalizePreferences({ cubeAutoListen: true, showCubeLocator: true, petPins: [1002], damageScope: 'party', compactStrip: true });
  const pets = normalizePreferences({ ...before, displayModules: displayModulePreset('pets') });
  assert.equal(petOnlyDisplay(pets), true);
  assert.deepEqual(visibleAnalysisSections(ANALYSIS_SECTIONS, pets), ['pets']);
  assert.deepEqual(visibleSettingsSections(SETTINGS_SECTIONS, pets), ['appearance', 'character', 'controls', 'about']);
  for (const key of ['cubeAutoListen', 'showCubeLocator', 'petPins', 'damageScope', 'compactStrip']) assert.deepEqual(pets[key], before[key]);
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(pets))), pets);
  const restored = normalizePreferences({ ...pets, displayModules: displayModulePreset('all') });
  assert.equal(petOnlyDisplay(restored), false);
  assert.deepEqual(visibleAnalysisSections(ANALYSIS_SECTIONS, restored), ANALYSIS_SECTIONS);
  assert.deepEqual(visibleSettingsSections(SETTINGS_SECTIONS, restored), SETTINGS_SECTIONS);
});

test('module choices reject unknown keys and keep at least one useful panel with permanent settings recovery', () => {
  const empty = normalizePreferences({ displayModules: Object.fromEntries(DISPLAY_MODULES.map(name => [name, false])) });
  assert.equal(petOnlyDisplay(empty), true);
  assert.deepEqual(Object.keys(empty.displayModules), DISPLAY_MODULES);
  assert.deepEqual(normalizePreferences({ displayModules: { dps: false, injected: true } }).displayModules, { dps: false, pets: true, cube: true, events: true, odyle: true, team: true });
  const cube = normalizePreferences({ displayModules: { ...displayModulePreset('pets'), pets: false, cube: true } });
  assert.deepEqual(visibleAnalysisSections(ANALYSIS_SECTIONS, cube), []);
  assert.deepEqual(visibleSettingsSections(SETTINGS_SECTIONS, cube), ['appearance', 'controls', 'hiddenCube', 'about']);
  assert.deepEqual(normalizePreferences({ displayModules: [] }).displayModules, displayModulePreset('all'));
});

test('preferences clamp controls and reject executable or unrecognized appearance values', () => {
  const prefs = normalizePreferences({ theme: 'unknown', font: 'url(evil)', textScale: 4, opacity: -2, customColors: { text: 'red; background:url(evil)', accent: '#AAFF44' }, background: 'data:image/svg+xml;base64,PHN2Zz4=', bossIds: [42, 42, '57', -2, 1.4] });
  assert.equal(prefs.theme, 'graphite'); assert.equal(prefs.font, 'system');
  assert.equal(prefs.textScale, 2); assert.equal(prefs.opacity, 0);
  assert.equal(prefs.customColors.accent, '#aaff44'); assert.equal(prefs.customColors.text, THEMES.custom.text);
  assert.equal(prefs.background, ''); assert.deepEqual(prefs.bossIds, []);
});

test('all fourteen themes exist, including readable light and custom options', () => {
  assert.equal(Object.keys(THEMES).length, 14);
  assert.equal(THEMES.white.bg, '#f7f7f2'); assert.ok(THEMES.custom.accent);
});

test('live actor cooldowns and all 200 saved encounters survive IPC normalization', () => {
  const actor = { actor_id: 9, skill_id: 11010000, unit: 'milliseconds', source: 'server-cast', cooldown_ms: 81100 };
  const state = normalizeState({ actor_cooldowns: [actor], history: Array.from({ length: 205 }, (_, id) => ({ id, total_damage: id, elapsed_ms: 1000 })) });
  assert.deepEqual(state.actor_cooldowns, [actor]);
  assert.equal(state.history.length, 200);
  assert.deepEqual(normalizePreferences({ bossIds: [9] }).bossIds, []);
  assert.equal(normalizePreferences({ showTeamCooldowns: false }).showTeamCooldowns, false);
});

test('encounter RTT uses retained observations instead of supplied aggregate claims', () => {
  const state = normalizeState({ history: [{ total_damage: 100, started_ms: 1000, ended_ms: 2000, elapsed_ms: 1000,
    network_latency: { source: 'windows-tcp-estats', average_ms: 99999, samples: [{ observed_at_ms: 1000, rtt_ms: 0, measured_connections: 1 }, { observed_at_ms: 2000, rtt_ms: 100, measured_connections: 1 }] } }] });
  assert.equal(state.history[0].network_latency.average_ms, 50);
  assert.equal(state.history[0].network_latency.minimum_ms, 0);
});

test('theme round trip preserves independent target font but excludes personal records', () => {
  const restored = importTheme(exportTheme({ theme: 'white', font: 'mono', targetFont: 'georgia', targetFontSize: 23, textScale: 1.1, equipment: [{ name: 'Private set' }], events: [{ id: 'x', name: 'Private timer', anchor: '2026-10-13T00:00:00Z', intervalMinutes: 180 }] }));
  assert.equal(restored.targetFont, 'georgia'); assert.equal(restored.font, 'mono'); assert.equal(restored.theme, 'white');
  assert.equal(restored.targetFontSize, 23);
  assert.ok(!('events' in restored)); assert.ok(!('equipment' in restored));
  assert.throws(() => importTheme('{"type":"other","version":1,"theme":{}}'));
  assert.throws(() => importTheme('{"type":"luma-theme","version":1,"theme":{"background":"https://remote/image.png"}}'));
});

test('target name size persists independently and stays inside its own 8–28 px bounds', () => {
  assert.equal(normalizePreferences({ targetFontSize: 1, textScale: 1.2 }).targetFontSize, 8);
  assert.equal(normalizePreferences({ targetFontSize: 99, textScale: 0.85 }).targetFontSize, 28);
  assert.equal(normalizePreferences({ targetFontSize: '18' }).targetFontSize, 18);
  assert.equal(normalizePreferences({ targetFontSize: 'invalid' }).targetFontSize, 15);
});

test('a visible recurring timer expands the header without changing the selected target size', () => {
  const preferences = normalizePreferences({ targetFontSize: 17 });
  assert.equal(compactHeaderHeight(preferences.targetFontSize, true), 35);
  assert.equal(preferences.targetFontSize, 17);
  assert.equal(compactHeaderHeight(28, true), 46);
  assert.equal(compactHeaderHeight(8, true), 32);
  assert.equal(compactHeaderHeight(28, false), 32);
});

test('observed cooldown expiry does not imply confirmed readiness', () => {
  const at = Date.now(), row = { actor_id: 7, source: 'local-server', unit: 'server-counter', fresh: true, observed_at_ms: at, charges_observed_at_ms: at, raw_remaining_units: 0, readiness: 'estimated-elapsed' };
  assert.equal(cooldownStatus(row).kind, 'unknown');
  assert.equal(cooldownStatus({ ...row, readiness: 'server-ready', ready_confirmed: true }).kind, 'confirmed');
  assert.equal(cooldownStatus({ remaining_ms: 5000, ready_confirmed: true }).kind, 'unknown');
  assert.equal(cooldownStatus({ ...row, charges: -3 }).charges, null);
  assert.equal(cooldownStatus({ ...row, charges: 2 }).charges, 2);
});

test('keyboard resize uses 10 px, Shift uses 20 px, other keys produce no native resize', () => {
  assert.deepEqual(resizeStep('ArrowLeft'), { dx: -10, dy: 0 });
  assert.deepEqual(resizeStep('ArrowDown', true), { dx: 0, dy: 20 });
  assert.equal(resizeStep('Enter'), null);
});

test('bounded raster validation rejects remote, vector, oversized and malformed inputs', () => {
  assert.equal(validBackground('data:image/png;base64,YQ=='), 'data:image/png;base64,YQ==');
  assert.equal(validBackground('data:image/png;base64,YQ==" onerror="x'), '');
  assert.equal(validBackground(`data:image/png;base64,${'A'.repeat(1400000)}`), '');
  assert.equal(validBackground('https://example.com/photo.png'), '');
});

test('recurring timer uses only its user-entered anchor, including a future anchor', () => {
  const event = { anchor: '2026-10-13T09:00:00Z', intervalMinutes: 180 };
  const before = recurringEvent(event, Date.parse('2026-10-13T08:59:00Z'));
  assert.equal(before.remaining, 60000); assert.equal(before.next, Date.parse(event.anchor));
  const at = recurringEvent(event, Date.parse(event.anchor));
  assert.equal(at.next, Date.parse('2026-10-13T12:00:00Z'));
  const later = recurringEvent(event, Date.parse('2026-10-14T10:30:00Z'));
  assert.equal(later.next, Date.parse('2026-10-14T12:00:00Z'));
  assert.equal(later.remaining, 90 * 60000);
  assert.equal(recurringEvent({ anchor: 'invalid', intervalMinutes: 180 }), null);
});

test('turning off an event chip remains off after preference normalization', () => {
  const p = normalizePreferences({ calendarVersion: 1, events: [{ id: 'x', name: 'My Rift', intervalMinutes: 180, anchor: '2026-10-13T09:00:00Z' }], activeEventId: '' });
  assert.equal(p.activeEventId, '');
  assert.equal(normalizePreferences(p).activeEventId, '');
});

test('manual Odyle estimate obeys the entered cycle and cap, with no default game rule', () => {
  const plan = { current: 3, max: 8, refill: 2, intervalMinutes: 60, anchor: '2026-10-13T09:00:00Z' };
  assert.equal(manualOdyle(plan, Date.parse('2026-10-13T08:00:00Z')), 3);
  assert.equal(manualOdyle(plan, Date.parse('2026-10-13T11:00:00Z')), 7);
  assert.equal(manualOdyle(plan, Date.parse('2026-10-13T12:00:00Z')), 8);
  assert.equal(manualOdyle({ ...plan, intervalMinutes: 0 }, Date.parse('2026-10-14T12:00:00Z')), 3);
  assert.equal(manualOdyle({}), 0);
});

test('numeric engine identifiers, percentage share and capture details survive normalization', () => {
  const state = normalizeState({ status: 'waiting_for_traffic', players: [{ id: 991, name: '<Name>', class_name: 'Gladiator', damage: 750, dps: 75, share: 75, skills: [{ id: 342, hits: 4, damage: 300 }] }], targets: [{ id: 77, name: 'Target', damage: 1000, is_boss: true }], capture: { detail: 'Elevation required', packets: 4 } });
  assert.equal(state.players[0].id, '991'); assert.equal(state.players[0].skills[0].name, 'Skill #342');
  assert.equal(state.players[0].share, 75); assert.equal(state.targets[0].id, '77'); assert.equal(state.capture.detail, 'Elevation required');
});

test('disconnected state remains empty rather than supplying synthetic statistics', () => {
  const state = normalizeState(undefined);
  assert.equal(state.status, 'disconnected'); assert.equal(state.dps, 0); assert.equal(state.total_damage, 0);
  assert.deepEqual(state.players, []); assert.deepEqual(state.cooldowns, []);
});

test('invalid and negative metrics cannot produce negative widths or NaN labels', () => {
  const state = normalizeState({ dps: Infinity, elapsed_ms: -99, total_damage: 'not a number', players: [{ id: 1, damage: -22, dps: -3 }] });
  assert.equal(state.dps, 0); assert.equal(state.elapsed_ms, 0); assert.equal(state.total_damage, 0);
  assert.equal(playerShare(state.players[0], 0), 0);
  assert.equal(playerShare({ damage: 200 }, 100), 1);
  assert.equal(clockTime(NaN), '00:00'); assert.equal(clockTime(3661000), '01:01:01');
});

test('ranking is deterministic and does not mutate received player order', () => {
  const players = [{ name: 'Z', dps: 80, damage: 900 }, { name: 'A', dps: 80, damage: 1000 }];
  assert.equal(sortedPlayers(players)[0].name, 'A'); assert.equal(sortedPlayers(players, 'damage')[0].name, 'A');
  assert.equal(players[0].name, 'Z');
});

test('history imports validate their envelope and retain Rust timestamps and skill details', () => {
  const value = { type: 'luma-history', version: 1, encounters: [{ id: 7, started_ms: 1791882000000, elapsed_ms: 5000, total_damage: 120, dps: 24, targets: [{ id: 8, name: 'Recorded target', damage: 120 }], players: [{ id: 1, name: 'Player', skills: [{ id: 50, damage: 120 }] }] }] };
  const records = importHistory(JSON.stringify(value));
  assert.equal(records[0].id, '7'); assert.equal(records[0].name, 'Recorded target');
  assert.equal(records[0].timestamp, new Date(value.encounters[0].started_ms).toISOString());
  assert.equal(records[0].players[0].skills[0].damage, 120);
  assert.throws(() => importHistory('{"type":"luma-history","version":1,"encounters":[{}]}'));
  assert.throws(() => importHistory(JSON.stringify({ ...value, encounters: Array(31).fill(value.encounters[0]) })));
});

test('live taken and healing counters preserve measured zero while unsupported or missing values stay unknown', () => {
  const state = normalizeState({ personal_damage_taken: 3200, personal_damage_taken_per_second: 160, personal_healing: null, personal_hps: null, players: [{ id: 4, damage: 0, damage_taken: 3200, damage_taken_per_second: 160, healing: null, hps: null }] });
  assert.equal(state.personal_damage_taken, 3200); assert.equal(state.personal_damage_taken_per_second, 160);
  assert.equal(state.personal_hps, null); assert.equal(state.players[0].healing, null);
  assert.equal(normalizeState({ players: [{ id: 4, damage_taken: 0 }] }).players[0].damage_taken, 0);
  assert.equal(normalizeState().personal_damage_taken, null);
  const records = importHistory(JSON.stringify({ type: 'luma-history', version: 1, encounters: [{ total_damage: 0, started_ms: Number.MAX_SAFE_INTEGER }] }));
  assert.equal(records[0].timestamp, '');
});

test('automatic calendar migration enables Rift once while preserving new Off choice and existing custom timers', () => {
  assert.equal(normalizePreferences().activeEventId, 'builtin:rift');
  assert.equal(normalizePreferences({ activeEventId: '' }).activeEventId, 'builtin:rift');
  assert.equal(normalizePreferences({ calendarVersion: 1, activeEventId: '' }).activeEventId, '');
  const custom = normalizePreferences({ events: [{ id: 'mine', name: 'Mine', anchor: '2026-10-13T00:00:00Z' }], activeEventId: 'mine' });
  assert.equal(custom.activeEventId, 'mine'); assert.equal(custom.calendarRegion, 'EU'); assert.equal(custom.calendarVersion, 1);
  assert.deepEqual(normalizePreferences({ builtInReminders: { 'builtin:rift': { enabled: true, leadMinutes: 100 }, 'invalid:html': { enabled: true } } }).builtInReminders, { 'builtin:rift': { enabled: true, leadMinutes: 60 } });
});

test('a delayed calendar getter cannot replace a newer pushed update or redraw unchanged revisions', () => {
  const current = { revision: 8, feeds: [{ id: 'rift', body: 'latest' }] };
  assert.equal(acceptsCalendarSnapshot(current, { revision: 7, feeds: [] }), false);
  assert.equal(acceptsCalendarSnapshot(current, { ...current }), false);
  assert.equal(acceptsCalendarSnapshot(current, { revision: 9, feeds: [] }), true);
  assert.equal(acceptsCalendarSnapshot(null, current), true);
  assert.equal(acceptsCalendarSnapshot(current, null), false);
});

test('a delayed state read cannot rewind newer live totals while a newer reset remains valid', () => {
  let state = normalizeState({ state_revision: 8, total_damage: 20000, elapsed_ms: 2000, dps: 10000 });
  const outdated = { state_revision: 7, total_damage: 10000, elapsed_ms: 1000, dps: 10000 };
  assert.equal(acceptsStateSnapshot(state, outdated), false);
  assert.equal(acceptsStateSnapshot(state, { ...state }), false);
  assert.equal(acceptsStateSnapshot(state, { total_damage: 0 }), false);
  const reset = { state_revision: 9, total_damage: 0, elapsed_ms: 0, dps: 0 };
  assert.equal(acceptsStateSnapshot(state, reset), true);
  state = normalizeState(reset);
  assert.equal(state.total_damage, 0); assert.equal(state.state_revision, 9);
  assert.equal(normalizeState(state).state_revision, 9);
  assert.equal(acceptsStateSnapshot({}, { status: 'demo' }), true);
  assert.equal(acceptsStateSnapshot(state, null), false);
});


test('live resource and raw cooldown ownership never reuse completed encounter identity', () => {
  const prior = { local_player_id: 7, local_identity_source: 'server' };
  assert.equal(liveServerActorId(prior), '7');
  assert.equal(liveServerActorId({ ...prior, live_team_identity: { local: null } }), null);
  assert.equal(liveServerActorId({ ...prior, live_team_identity: { local: { actor_id: 9, identity_source: 'server' } } }), '9');
  assert.equal(liveServerActorId({ ...prior, live_team_identity: { local: { actor_id: 9, identity_source: 'manual' } } }), null);
});
