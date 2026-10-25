import { skillLabel } from './skill-names.mjs';
import { skillRows } from './skills.mjs';
import { skillBoard } from './skill-board.mjs';
import { PANELS, PANEL_TITLES } from './overlay-panels.mjs';
import { deathRecap } from './pvp.mjs';
import { frenzyLabel, healthFraction, normalizeCombatDetection } from './combat.mjs';
import { normalizeIdCaps, normalizeIdNames, normalizeTicketShow } from './session-data.mjs';
import { DEFAULT_TICKETS, itemName, serverTag, splitTicketName, ticketInfo } from './catalog.mjs';
import { controlLabel, controlLoss, ownEffects } from './control.mjs';
import { cubeIconPath, iconImg, skillIconPath } from './icons.mjs';
import { TEMPLATE_LABELS, templatePlan } from './templates.mjs';
import { bossLog } from './boss-log.mjs';
import { spatialFrame, renderRadar } from './spatial.mjs';
import { classIcon } from './class-icons.mjs';
import { GAME_REFERENCE_NOTICE } from './reference-notices.mjs';
import { HUD_PANELS, hudPanelVisible, hudPanelChange, previewFrame, mainRoster, capRoster, rosterFit, unnamedSourcesNotice } from './hud.mjs';
import { replayTimeline, replayFrame, replayClock, renderReplayFrame } from './replay.mjs';
import { THEMES, FONTS, LAYOUTS, displayPlayerName, displayTargetName, rosterEligible, liveServerActorId, normalizePreferences, withSystemLocale, normalizeState, normalizeEncounter, sortedPlayers, playerShare, compactNumber, formatRate, playerMetricLabel, clockTime, recurringEvent, manualOdyle, exportTheme, importTheme, classColor, cooldownStatus, resizeStep, compactHeaderHeight, connectionStatus, numericPreferenceEdit, acceptsCalendarSnapshot, acceptsStateSnapshot } from './model.mjs';
import { scopedEncounter, meterScopes, ownPlayer, skillSummary, sortedSkills } from './scope.mjs';
import { playerBarColor } from './model.mjs';
import { DISPLAY_MODULES, displayModulePreset, petOnlyDisplay, visibleAnalysisSections, visibleSettingsSections, recentPetTarget, petTargetStatus, petCollectionOwner, petCollectionEpoch, acceptsPetCollectionSnapshot, petCollectionProgress } from './model.mjs';
import { importEncounterCollection, exportEncounterCsv, exportEncounterHtml, exportEncounterJson } from './reports.mjs';
import { createRecordNotifier, recordSnapshot, recordPresentation, renderRecords } from './records.mjs';
import { trainingState, validateTrainingDuration, damageCurve, curvePath, historyProgress, takenCoverage } from './analysis.mjs';
import { assistanceState, assistanceTimeline, bossCasts, scopedEffects } from './assistance.mjs';
import { characterSnapshot, renderCharacterCollections, fieldBossSnapshot, fieldBossTimers, metadataEpoch, characterSnapshotReader } from './character.mjs';
import { decodeGameReport, comparePersonalReport, GAME_REPORT_MAX_BYTES } from './game-reports.mjs';
import * as scheduling from './events.mjs';
import { DEMO_STATE, DEMO_PARTY_STATE } from './demo.mjs';
import { createPreferenceCommitter } from './persistence.mjs';
import { setText, setAttribute, reconcileKeyedRows, isDrawerDragStart, delegatedControl, visibleInputRegions } from './dom.mjs';
import { createHistoryCache, clearImportedHistory } from './history.mjs';
import { createHistoryNotebook, historyRecordKey, queryHistory, historyTrend, parseHistoryTags } from './history-tools.mjs';
import { SETTINGS_SECTIONS, ANALYSIS_SECTIONS, ANALYSIS_GROUPS, settingsSection, nextTab, modalControls, focusBoundary, shouldApplyPollFailure, captureFormDraft, restoreFormDraft, createPanelSynchronizer } from './navigation.mjs';
import { normalizeCubeState, acceptsCubeSnapshot, cubePresentation, cubeDockVisible, cubeReferenceBase64, CUBE_REFERENCE_MAX_BYTES } from './cube.mjs';
import { communityLabels, communityUrl, communityShareLink, communityFilters, communityShareOptions, communitySummary, createCommunityController, renderCommunity } from './community.mjs';
import { latencyPresentation, petProgress, stalePetProgress, cooldownObservation, staggerPresentation } from './telemetry.mjs';
import { resourceStatus } from './resources.mjs';
import { teamSnapshot, renderTeam, automaticTeamState, renderAutomaticTeam } from './team.mjs';
import { renderCombatInsights, renderEffectAttribution, renderBossProjection } from './combat-insights.mjs';
import { renderRunHistory } from './run-history.mjs';
import { HOTKEY_ACTIONS, renderHotkeys, renderUpdates, updatePresentation, updatePrompt } from './runtime-tools.mjs';
import { renderLatencyHistory } from './latency-history.mjs';
import { overlayRect, overlayGesture, fullscreenLayout, isFullscreenDashboard } from './overlay.mjs';
import { worldTargetPresentation, targetVital, targetSummary, targetBoardChoices, targetHeaderTarget } from './bosses.mjs';
import { combatMeasurement } from './measurement.mjs';
import { targetDemoState, rosterDemoState } from './target-demo.mjs';
import { PET_CATALOG, PET_DATA_NOTICE } from './pet-catalog.mjs';
import { petDiagnosticReport } from './pet-diagnostics.mjs';
import { normalizeCaptureDiagnostics, captureDiagnosticText, renderCaptureDiagnostics, PACKET_MONITOR_EXPORTS } from './capture-diagnostics.mjs';
import { normalizePetCatalog, petPlan, defaultPetFilters, petAdvances, filteredPets, trackedPets, renderPetTracker, renderPetGuide, petLabels, petReferenceUrl, petMetadataTransition, petGuideFilterAction, petTargetMatches, petPinTransition, refreshPetGuidePanel, PET_PIN_LIMIT } from './pets.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const native = Boolean(window.__TAURI__?.core?.invoke);
const demo = !native && new URLSearchParams(location.search).get('demo') === '1';
const sampleFrame = demo ? previewFrame(new URLSearchParams(location.search).get('frame')) : null;
if (sampleFrame) {
  document.body.classList.add('preview-frame');
  for (const [key, value] of Object.entries(sampleFrame)) document.documentElement.style.setProperty(`--preview-${key}`, `${value}px`);
}
const spatialDemo = demo && new URLSearchParams(location.search).get('spatialDemo') === '1';
const targetDemo = demo && new URLSearchParams(location.search).get('targetDemo') === '1';
const targetPetDemoMode = demo ? new URLSearchParams(location.search).get('targetPetDemo') : '';
const targetPetDemo = ['1', 'multi', 'oneshot', 'npc-id', 'unmapped'].includes(targetPetDemoMode);
const invoke = (command, args) => window.__TAURI__.core.invoke(command, args);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const uid = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let prefs = normalizePreferences();
try { prefs = normalizePreferences(JSON.parse(localStorage.getItem('luma-independent-preferences') || '{}')); } catch {}
let state = normalizeState(demo ? new URLSearchParams(location.search).get('partyDemo') === '1' ? DEMO_PARTY_STATE : DEMO_STATE : {});
if (spatialDemo) {
  const now = Date.now(), own = 7;
  const point = (actor_id, x, y, at_ms) => ({ actor_id, generation: 0, x, y, z: 100, at_ms, map_id: 5, epoch: 1, present: true, source: 'server-position' });
  state = normalizeState({ ...state, local_player_id: own, local_identity_source: 'server', players: state.players.map(p => p.is_local ? { ...p, id: own } : p), spatial: { map_id: 5, epoch: 1, sampled_at_ms: now,
    actors: [{ actor_id: own, name: 'Archer', kind: 'player' }, { actor_id: 999, name: 'Manduri Fighter', kind: 'npc' }],
    positions: [point(own, 1000, 2000, now), point(999, 3500, 4000, now)],
    track: [point(own, 1000, 2000, now - 10000), point(999, 3500, 4000, now - 10000), point(own, 1800, 2200, now - 9000), point(own, 2500, 2300, now - 8000)] } });
}
let drawer = '', tab = 'overview', selectedPlayer = '', restoreFocus = null, skillSort = 'damage', reportFormat = 'html', reportAnonymize = false;
let toolsOpen = false, toolsLocale = '', toolsExpanded = false;
// Luma starts locked: the meter is drawn bare, with no window around it. Alt+E unlocks it for editing.
let mainInteractive = null;
let overlayLocked = window.__TAURI__?.core?.invoke ? true : new URLSearchParams(location.search).get('bare') === '1';
let rosterFitFrame = 0, rosterFitSignature = '', rosterMinimum = null, fitRequested = 0, rosterContext = '';
let skillsFromTargetBoard = false;
let renderedTargetBoard = null, selectedBoardPlayerDetail = null;
let deferredRosterRefresh = false;
let selectedBoardTargetId = null;
let automaticTargetFocus = null;
const recordNotifier = createRecordNotifier();
let recordData = recordSnapshot(), recordsPending = false, recordsRetryAt = 0, recordMetric = 'all', recordQuery = '';
let toastTimeout, lastEventCycle = '', lastGoalReached = false;
let refreshPending = false;
let receivedStateCount = 0;
let cooldownFingerprint = '';
let teamState = teamSnapshot(), roomIntent = false, teamClassFilter = '', teamBusy = false, teamPolling = false, teamConsent = false, teamInviteDraft = '', teamInviteCopy = '', teamRequestEpoch = 0;
let drawerContentFingerprint = '', drawerTabsFingerprint = '';
let settingsTab = 'appearance';
const settingsPanels = new Map(), dirtySettingsForms = new Set();
let trainingDuration = 60000, trainingDurationDraft = '60', trainingTargetId = '', curveInterval = 1000, curveRecord = null, curvePending = false;
let historyClearPending = false;
let warnedWindup = '';
let assistTimeline = [], assistPending = false;
const petCatalog = normalizePetCatalog(PET_CATALOG);
let petFilters = { query: '', faction: 'all', genus: 'all', status: 'all', sort: 'name', page: 0 }, petSelectedId = null, petFiltersTouched = false;
let petPinObservation = null, petDiagnosticsOpen = false, petDiagnosticPending = false, petDrawerRefreshPending = false;
let characterData = characterSnapshot(), characterPending = false, selectedBuild = 'own', worldData = fieldBossSnapshot(), worldPending = false;
let gameReport = null, gameCompareRecord = null, gameComparePending = false;
let appVersion = demo ? 'Demo' : '';
let captureDiagnostics = null, captureDiagnosticRequest = null, captureDiagnosticFingerprint = '', captureDiagnosticActionPending = false;
const captureDiagnosticDemo = demo && new URLSearchParams(location.search).get('captureDiagnosticsDemo') === 'missing-api';
if (captureDiagnosticDemo) captureDiagnostics = normalizeCaptureDiagnostics({
  type: 'luma-capture-diagnostics', schema_version: 1, app_version: '0.23.0', mode: 'demo',
  compatibility: { schema_version: 1, diagnostic_only: true, capture_started: false,
    os: { status: 'ready', label: 'Windows 10', major: 10, minor: 0, build: 19045, ubr: null, architecture: 'x86_64', process_architecture: 'x86_64', version_source: 'RtlGetVersion', error_code: null },
    packet_monitor: { status: 'api-unavailable', system32_only: true, load_status: 'loaded', load_error_code: null, exports_present: PACKET_MONITOR_EXPORTS.slice(0, 8), exports_missing: PACKET_MONITOR_EXPORTS.slice(8) } },
  capture: { status: 'api-unavailable', error_code: 'win32:127', operation: 'GetProcAddress', elevated: true },
});
const recordsDemo = demo && new URLSearchParams(location.search).get('recordsDemo') === '1';
if (recordsDemo) {
  const at = Date.now(), base = { name: 'Liora', server_id: 1001, class_name: 'Ranger', actor_id: 7, is_local: true, metric: 'hit', amount: 10000, at_ms: at - 1000, skill_id: 14090000, critical: true, tick: false, target_name: 'Judge Urahum', target_npc_id: 1201, map_id: 15, boss_max_hp: 5220000, elapsed_ms: null };
  const best = { ...base, amount: 13000, at_ms: at };
  const boss = { ...base, metric: 'boss-dps', skill_id: null, amount: 908000, elapsed_ms: 60000 };
  recordData = recordSnapshot({ revision: 3, records: [{ best, previous: base }, { best: { ...best, name: 'Arien', is_local: false, amount: 12000, class_name: 'Cleric' }, previous: { ...base, name: 'Arien', is_local: false, class_name: 'Cleric' } }, { best: boss, previous: { ...boss, amount: 770000 } }] });
  state = normalizeState({ ...state, personal_bests: { revision: 3, count: 3, notices: [{ sequence: 1, best, previous: base }] } });
}
const remindedEventCycles = new Set();
let calendarHorizonDays = 7;
let obsState = { running: false }, obsPending = false, obsScope = prefs.damageScope, obsHideNames = true, obsLanEnabled = false, obsPort = '';
let hotkeyState = { bindings: [], errors: [] }, hotkeyPending = false, updateState = {}, updatePending = false;
let fullscreenPending = false, overlayRegionFrame = 0, overlayRegionFingerprint = '', overlayRegionFailures = 0, hudGesture = null;
let scheduleSnapshot = null, scheduleDataRevision = 0, schedulePending = false, scheduledCacheKey = '', scheduledCache = [], scheduleTimingSecond = -1;
const scheduleTimings = new Map();
let cubeState = normalizeCubeState(), cubePending = false, cubePollPending = false, cubeReadError = '', cubeReceivedCount = 0, cubeAutoListenIntent = null;
let communityDraft = { recordId: '', scope: 'personal', anonymous: true, rank_opt_in: false, visibility: 'public', consent: false, context: { region: 'EU', server: '', boss: '', difficulty: '' } };
let communityRankingDraft = communityFilters({ region: 'EU' }), communityRevokeId = '', communityOpened = false, communityCurrentRecord = null, communitySummaryText = '';
const historyFilterDefaults = () => ({ query: '', scope: 'personal', source: '', category: '', difficulty: '', tags: '', sort: 'newest', favoritesOnly: false, from: '', to: '' });
let historyFilters = historyFilterDefaults(), historyFilterDraft = historyFilterDefaults(), historyEditKey = '', historyEditDraft = null, historyTrendKey = '', historyNotebookError = '';
const cubeDemo = demo && new URLSearchParams(location.search).get('cubeDemo') === '1';
const telemetryDemo = demo && new URLSearchParams(location.search).get('telemetryDemo') === '1';
if (telemetryDemo) {
  const at = Date.now();
  state = normalizeState({ ...state, local_player_id: 7, local_identity_source: 'server', pet_collection_owner: { actor_id: 7, source: 'server-self', generation: 0 },
    players: state.players.map(player => ({ ...player, id: player.is_local ? 7 : player.id })),
    targets: state.targets.map((target, index) => ({ ...target, id: index === 0 ? 10 : target.id })),
    assist: { stagger: [{ actor_id: 10, maximum: 1200, current: 750, broken: false, observed_at_ms: at, fresh_for_ms: 5000, fresh: true, source: 'server' }] },
    cooldowns: [{ actor_id: 7, skill_id: 14090000, source: 'local-server', unit: 'server-counter', raw_remaining_units: 0, observed_at_ms: at, fresh: true, readiness: 'server-ready', ready_confirmed: true, charges: null }, { actor_id: 7, skill_id: 14080000, source: 'local-server', unit: 'server-counter', raw_remaining_units: 24000, observed_at_ms: at, fresh: true, readiness: 'estimated-cooling', estimated_rate_units_per_ms: 2.4, rate_samples: 3 }],
    resources: { actor_id: 7, awaiting_identity: false, source: 'server-contents-ticket', snapshot_complete: true, odyle: { ticket_id: 60000001, base: 420, bonus: 80, total: 500, time_left_ms: 0, observed_at_ms: at }, membership: { source: 'server-benefit-list', observed_at_ms: at, expires_at_ms: at + 86400000 } },
    party_membership_source: 'server', party_member_ids: ['7', '9'], actor_cooldowns: [{ actor_id: 9, skill_id: 11010000, source: 'server-cast', unit: 'milliseconds', fresh: true, observation_kind: 'cast-cooldown', cooldown_ms: 81100, remaining_ms: 78100, expires_at_ms: at + 78100, observed_at_ms: at - 3000, sampled_at_ms: at, charges: null, recharge_remaining_ms: null, recharge_expires_at_ms: null, charges_observed_at_ms: null, readiness: 'cooling', ready_confirmed: false }],
    party_identity_roster: { source: 'server', members: [{ actor_id: 9, name: 'Liora', class_name: 'Cleric', identity_confirmed: true }] }, observed_casts: [{ actor_id: 9, skill_id: 11010000, source: 'server-cast', last_observed_at_ms: at - 3000, use_count: 3, fresh: true, ready_confirmed: false }],
    capture: { status: 'capturing', game_connections: 2, network_latency: { status: 'ready', source: 'windows-tcp-estats', selection: 'worst-active-game-tcp', rtt_ms: 83, latest_rtt_ms: 87, variation_ms: 2, observed_at_ms: at, sampled_at_ms: at, fresh_for_ms: 5000, measured_connections: 1, game_connections: 2 } },
  });
  characterData = characterSnapshot({ pet_collection_owner: state.pet_collection_owner, own: { actor_id: 7, name: state.local_player_name, source: 'server-self', observed_at_ms: at },
    pet_progress: { actor_id: 7, source: 'server-self', observed_at_ms: at, active_pet_id: 1042, active_pet_known: true, inventory_complete: true,
      pets: [{ pet_id: 1042, level: 2, progress: 34, progress_source: 'server-delta', session_gained: 2, observed_at_ms: at }, { pet_id: 1124, level: 3, progress: null, progress_source: 'unknown', session_gained: 0, observed_at_ms: at }] },
  });
}
if (targetDemo) state = normalizeState(targetDemoState(state));
let filteredTargetDemoSource = null;
const targetBoardDemo = demo ? new URLSearchParams(location.search).get('targetBoardDemo') : null;
if (targetDemo && ['filtered', 'shared', 'shared-no-own'].includes(targetBoardDemo)) {
  filteredTargetDemoSource = state;
  const target = { ...state.targets[0], is_boss: false, ...(targetBoardDemo === 'shared-no-own' ? { own_participant: null, own_rank: null } : {}) };
  state = normalizeState({ ...state, encounter_started_ms: state.targets[0].started_ms, targets: [], live_target: null, focused_target_id: null, focused_target_observed_at_ms: null,
    all_targets_summary: { total_damage: state.total_damage, dps: state.dps, elapsed_ms: state.elapsed_ms, personal_total_damage: state.personal_total_damage, personal_dps: state.personal_dps, personal_elapsed_ms: state.elapsed_ms, party_total_damage: target.party_total_damage, party_dps: target.party_dps, party_elapsed_ms: target.elapsed_ms },
    encounter_active: true, capture: { ...state.capture, status: 'capturing' }, observed_targets: [target], players: [], personal_targets: [], party_targets: [], elapsed_ms: 0, personal_elapsed_ms: 0, party_elapsed_ms: 0,
    total_damage: 0, dps: 0, personal_total_damage: 0, personal_dps: 0, party_total_damage: 0, party_dps: 0 });
  prefs = normalizePreferences({ ...prefs, mode: 'boss', autoTargetRoster: targetBoardDemo !== 'filtered', displayModules: { ...prefs.displayModules, dps: true } });
}
if (targetDemo && targetBoardDemo === 'solo') {
  const target = { ...state.targets[0], is_boss: false, participants: [state.targets[0].own_participant], participant_count: 1, own_rank: 1, damage: state.targets[0].own_participant.damage, party_total_damage: state.targets[0].own_participant.damage, party_dps: state.targets[0].own_participant.dps };
  state = normalizeState({ ...state, targets: [], live_target: target, total_damage: 0, dps: 0, personal_total_damage: 0, personal_dps: 0, players: [], personal_targets: [], encounter_active: true, encounter_started_ms: target.started_ms, capture: { ...state.capture, status: 'capturing' } });
  prefs = normalizePreferences({ ...prefs, mode: 'boss', autoTargetRoster: true, displayModules: { ...prefs.displayModules, dps: true } });
}
if (telemetryDemo && new URLSearchParams(location.search).get('petDemo') === '1') {
  const at = Date.now();
  characterData = characterSnapshot({ ...characterData, pet_progress: { actor_id: 7, source: 'server-self', observed_at_ms: at, active_pet_id: 1002, active_pet_known: true, inventory_complete: true,
    pets: [{ pet_id: 1002, level: 1, progress: 12, progress_source: 'server-delta', session_gained: 12, session_baseline_gained: 0, session_started_at_ms: at - 60000, session_gain_events: 6, last_gain_at_ms: at - 1000, observed_at_ms: at }, { pet_id: 1003, level: 2, progress: 40, progress_source: 'server-absolute', session_gained: 4, session_baseline_gained: 0, session_started_at_ms: at - 60000, session_gain_events: 4, last_gain_at_ms: at - 2000, observed_at_ms: at }, { pet_id: 1004, level: 3, progress: null, session_gained: 0, observed_at_ms: at }] } });
  prefs = normalizePreferences({ ...prefs, petPins: [1002, 1003] });
  const tierDemo = new URLSearchParams(location.search).get('petTierDemo');
  if (['reset', 'gain'].includes(tierDemo)) {
    characterData = characterSnapshot({ ...characterData, pet_progress: { actor_id: 7, source: 'server-self', observed_at_ms: at, active_pet_id: 1010, active_pet_known: true, inventory_complete: true,
      pets: [{ pet_id: 1010, level: 2, progress: tierDemo === 'reset' ? 0 : 3, progress_source: tierDemo === 'reset' ? 'server-level-reset' : 'server-delta', session_gained: tierDemo === 'reset' ? 0 : 3, observed_at_ms: at }] } });
    prefs = normalizePreferences({ ...prefs, petPins: [1010] });
  }
  const baselineDemo = new URLSearchParams(location.search).get('petBaselineDemo');
  if (['gains', 'cache'].includes(baselineDemo)) {
    const restored = baselineDemo === 'cache';
    characterData = characterSnapshot({ ...characterData, pet_progress: { actor_id: 7, source: 'server-self', observed_at_ms: at, inventory_complete: false,
      continuity: restored ? 'last-known' : 'live', stale_reason: restored ? 'previous-session' : null, stale_at_ms: restored ? at : null,
      pets: [{ pet_id: 1002, level: restored ? 1 : null, progress: restored ? 12 : null, progress_source: restored ? 'server-absolute' : 'unknown',
        progress_stale: restored, session_gained: 7, last_gain_at_ms: at - 1000, observed_at_ms: restored ? at - 3600000 : at }] } });
    prefs = normalizePreferences({ ...prefs, petPins: [1002] });
  }
  if (new URLSearchParams(location.search).get('petStaleDemo') === '1') characterData = characterSnapshot({ ...characterData, pet_progress: stalePetProgress(characterData.pet_progress, { localPlayerId: liveServerActorId(state), now: at, reason: 'demo-capture-gap' }) });
}
if (telemetryDemo && new URLSearchParams(location.search).get('relayDemo') === '1') {
  const at = Date.now();
  roomIntent = true; teamState = teamSnapshot({ enabled: true, status: 'active', room_id: 'a'.repeat(32), self_peer_id: 'b'.repeat(32), is_host: true, sampled_at_ms: at, last_sync_at_ms: at, expires_at_ms: at + 7200000,
    peers: [{ peer_id: 'b'.repeat(32), display_name: state.local_player_name || 'Aeryn', class_name: 'Ranger', sequence: 1, received_at_ms: at, age_ms: 0, fresh: true, capture_live: true, cooldowns: [{ skill_id: 14090000, raw_remaining_units: 0, estimated_remaining_ms: null, charges: null, age_ms: 0, ready_confirmed: true, fresh: true }] },
      { peer_id: 'c'.repeat(32), display_name: 'Liora', class_name: 'Cleric', sequence: 1, received_at_ms: at, age_ms: 0, fresh: true, capture_live: true, cooldowns: [{ skill_id: 11010000, raw_remaining_units: 24000, estimated_remaining_ms: 10000, charges: null, age_ms: 0, ready_confirmed: false, fresh: true }] }] });
}
if (telemetryDemo && targetPetDemo) {
  const at = Date.now(), own = state.players.find(player => player.id === '7') || { id: '7', name: state.local_player_name, damage: 100 };
  const target = { id: '960', name: targetPetDemoMode === 'multi' ? 'Eternal Moss Crab' : 'Krall Armed Soldier', damage: 100, is_boss: false, own_participant: { ...own, id: '7', damage: 100 }, own_last_hit_ms: at, last_hit_ms: at, elapsed_ms: 1000, capture_complete: true };
  const idOnly = ['npc-id', 'unmapped'].includes(targetPetDemoMode), oneShot = idOnly || targetPetDemoMode === 'oneshot';
  state = normalizeState({ ...state, focused_target_id: oneShot ? null : target.id, focused_target_observed_at_ms: oneShot ? null : at,
    live_target: oneShot ? null : target, targets: oneShot ? [] : [target],
    recent_personal_target: { actor_id: 7, target_id: 960, target_name: idOnly ? null : target.name, target_npc_id: idOnly ? targetPetDemoMode === 'npc-id' ? 2400617 : 9999999 : null, hit_at_ms: at, source: 'server-self-hit' } });
}
if (cubeDemo) cubeState = normalizeCubeState({ revision: 1, enabled: true, status: 'detected', source: 'game', reference: { name: 'Hidden Cube', seconds: 8 }, score: .94, direction: 'left', direction_confidence: .85, pan: -.5, steer_degrees: -30, bearing_ambiguous: true, snr_db: 18.2, signal_strength: .7, strength_db: -27.5, trend: 'approaching', last_detection_ms: Date.now(), audio_channels: 2, sample_rate: 48000, network: { cubes: 2, distance_m: 72, vertical_m: 8, direction_deg: 30, fix_age_s: 5, opening: false, look: 'gold', bearing_deg: 45, live: false, age_s: 125, taken: false } });
const rosterDemoCount = demo ? Number(new URLSearchParams(location.search).get('rosterDemo')) : 0;
if ([5, 6, 12].includes(rosterDemoCount)) {
  state = normalizeState(rosterDemoState(state, rosterDemoCount));
  prefs = normalizePreferences({ ...prefs, autoTargetRoster: false, rosterScope: 'observed' });
}
if (demo && new URLSearchParams(location.search).get('identityDemo') === 'unknown') {
  state = normalizeState({ ...state, local_player_id: null, local_player_name: '', local_identity_source: 'unresolved',
    personal_total_damage: null, personal_dps: null, personal_elapsed_ms: null, personal_targets: [],
    players: state.players.map(player => ({ ...player, is_local: false })) });
}

const words = {
  tr: {
    settings: 'Ayarlar', close: 'Kapat', target: 'HEDEF', groupDps: 'GRUP DPS', totalDamage: 'TOPLAM HASAR', player: 'OYUNCU', damage: 'HASAR', all: 'Tümü', boss: 'Boss', both: 'İkisi', allCaption: 'Tüm hedefler', bossCaption: 'Boss hedefleri', bothCaption: 'Oyuncular: tüm hedefler', sort: 'Sıralama', pause: 'Duraklat', resume: 'Devam et', reset: 'Sıfırla', lock: 'Kilitle', unlock: 'Kilidi aç', resize: 'Pencereyi yeniden boyutlandır', analysis: 'Analiz', disconnected: 'Bağlantı yok', connected: 'Bağlı', waiting: 'Bekleniyor', demo: 'DEMO', paused: 'Duraklatıldı', emptyTitle: 'Karşılaşma bekleniyor', emptyHelp: 'Alınan hasar olayları burada görünür.', disconnectedHelp: 'Canlı veri bağlı değil. Henüz hasar kaydı yok.', demoNotice: 'DEMO · Sabit örnek veriler. Canlı oyun verisi değildir.', browserNotice: 'Tarayıcı önizlemesi · Canlı yakalama için masaüstü uygulaması gerekir.', nativeOnly: 'Bu kontrol masaüstü uygulamasında kullanılabilir.', failed: 'İşlem tamamlanamadı', saved: 'Kaydedildi', appearance: 'Görünüm', language: 'Dil / Language', theme: 'Tema', font: 'Arayüz yazı tipi', targetFont: 'Hedef yazı tipi', size: 'Oyuncu listesi yazı boyutu', opacity: 'Arka plan opaklığı', customColors: 'Özel renkler', background: 'Arka plan', panel: 'Panel', text: 'Metin', accent: 'Vurgu', rasterHelp: 'Yerel PNG, JPEG veya WebP. En çok 1 MB ve 2048 × 2048 piksel. Görsel cihazda saklanır.', removeBackground: 'Görseli kaldır', importTheme: 'Tema içe aktar', exportTheme: 'Tema dışa aktar', themeHelp: 'Tema dosyası yalnızca görünüm ayarlarını içerir.', events: 'Etkinlik saati', eventHelp: 'Kendi tekrar eden saatinizi kaydedin. Bir oyun takvimi veya resmi Rift saati içermez; başlangıç saatini siz girersiniz.', eventName: 'Etkinlik adı', interval: 'Tekrar aralığı (dakika)', anchor: 'İlk / bilinen başlangıç (yerel saat)', saveEvent: 'Etkinliği kaydet', riftPreset: '3 saatlik Rift taslağı', activeEvent: 'Üstte gösterilen saat', none: 'Kapalı', delete: 'Sil', next: 'Sonraki', localTime: 'yerel saat', every: 'Her', minutes: 'dk', invalidEvent: 'Bir ad, geçerli başlangıç ve 1–10080 dakika girin.', support: 'Luma’yı destekle ↗', supportHelp: 'Luma DPS · bağımsız arayüz', radar: 'Radar', playback: 'Replay', overview: 'Özet', skills: 'Yetenekler', history: 'Geçmiş', planner: 'Planlayıcı', alerts: 'Uyarılar', selectPlayer: 'Oyuncu seç', noPlayers: 'Henüz oyuncu verisi yok.', sourceActual: 'ALINAN VERİ', sourceManual: 'ELLE GİRİLEN', sourceDemo: 'DEMO VERİSİ', share: 'Hasar payı', duration: 'Süre', crit: 'Kritik', hits: 'Vuruş', minMax: 'En az / en çok', noSkills: 'Bu oyuncu için alınan yetenek verisi yok.', historyHelp: 'Alınan karşılaşmalar ve içe aktardığınız yerel kayıtlar. JSON dışa aktarımı ücretsizdir.', noHistory: 'Kaydedilmiş karşılaşma yok.', exportCurrent: 'Şimdiki kaydı dışa aktar', exportAll: 'Tüm geçmişi dışa aktar', importHistory: 'Geçmiş içe aktar', imported: 'İÇE AKTARILAN', historyImported: 'Geçmiş içe aktarıldı', invalidFile: 'Dosya okunamadı veya geçerli değil.', equipment: 'Ekipman notları', manualHelp: 'Bu alanlar elle girilen kişisel notlar ve tahminlerdir. Oyundan ekipman, Odyle veya yetenek bekleme süresi okumaz.', equipmentName: 'Ekipman / set adı', note: 'Not', add: 'Ekle', noEquipment: 'Henüz ekipman notu yok.', cooldowns: 'Bekleme süreleri', cooldownName: 'Yetenek / hatırlatıcı', seconds: 'Süre (saniye)', ready: 'Hazır', start: 'Başlat', actualCooldowns: 'Alınan bekleme süreleri', noActualCooldowns: 'Canlı bekleme süresi verisi alınmadı.', odyle: 'Odyle hesabı', balance: 'Girilen miktar', cap: 'Üst sınır (0 = yok)', refill: 'Döngü başına eklenen', refillInterval: 'Döngü (dakika; 0 = kapalı)', savePlan: 'Planı kaydet', estimate: 'Elle girilen değerlerle tahmin', estimateHelp: 'Oyunun kuralı değildir. Miktar, döngü ve başlangıç sizin varsayımlarınızdır.', dpsGoal: 'Grup DPS hedefi (0 = kapalı)', eventLead: 'Etkinlik uyarısı öncesi (dakika)', sound: 'Uyarı sesi', soundHelp: 'Ses, bu oturumda bir kontrolü tıkladıktan sonra çalışır.', goalReached: 'DPS hedefi aşıldı', goalWaiting: 'DPS hedefi bekleniyor', noGoal: 'DPS hedefi kapalı', eventSoon: 'Kaydedilen etkinlik yaklaşıyor', noAlert: 'Şu anda bir uyarı yok.', alertHelp: 'DPS uyarısı alınan grup DPS değerini kullanır. Etkinlik uyarısı kendi kaydettiğiniz saati kullanır.', invalidPlanner: 'Bir ad ve geçerli pozitif süre girin.', invalidEquipment: 'Ekipman adı girin.', missingHistory: 'Dışa aktarılacak veri yok.', exported: 'JSON dosyası hazır', nativeExport: 'Karşılaşma dışa aktarıldı', resetDone: 'Karşılaşma sıfırlandı', bossTotal: 'Boss hasarı', playersCount: 'oyuncu', noTime: 'Başlangıç belirtilmedi', clearImported: 'İçe aktarılanları temizle', clearConfirm: 'İçe aktarılan yerel geçmiş temizlendi', windowClose: 'Pencereyi kapat', enabled: 'Açık', fileLarge: 'Dosya boyutu sınırı aşıldı.', invalidRaster: 'PNG, JPEG veya WebP; en çok 1 MB / 2048 × 2048.', dateUnknown: 'Tarih belirtilmedi', manualTimerHelp: 'Başlat düğmesi cihaz saatinden bir sayaç başlatır.', replay: 'Kayıttan ayrıntı', snapshot: 'KAYIT', aboutHelp: 'Canlı istatistikler yalnızca masaüstü yakalama motorunun sağladığı olaylardan gelir.',
  },
  en: {
    settings: 'Settings', close: 'Close', target: 'TARGET', groupDps: 'GROUP DPS', totalDamage: 'TOTAL DAMAGE', player: 'PLAYER', damage: 'DAMAGE', all: 'All', boss: 'Boss', both: 'Both', allCaption: 'All targets', bossCaption: 'Boss targets', bothCaption: 'Players: all targets', sort: 'Sort', pause: 'Pause', resume: 'Resume', reset: 'Reset', lock: 'Lock', unlock: 'Unlock', resize: 'Resize window', analysis: 'Analysis', disconnected: 'Disconnected', connected: 'Connected', waiting: 'Waiting', demo: 'DEMO', paused: 'Paused', emptyTitle: 'Waiting for an encounter', emptyHelp: 'Received damage events will appear here.', disconnectedHelp: 'No live data connection. No damage recorded yet.', demoNotice: 'DEMO · Fixed sample data. These are not live game statistics.', browserNotice: 'Browser preview · Live capture requires the desktop app.', nativeOnly: 'This control is available in the desktop app.', failed: 'The action could not be completed', saved: 'Saved', appearance: 'Appearance', language: 'Language / Dil', theme: 'Theme', font: 'Interface font', targetFont: 'Target font', size: 'Player list text size', opacity: 'Background opacity', customColors: 'Custom colors', background: 'Background', panel: 'Panel', text: 'Text', accent: 'Accent', rasterHelp: 'Local PNG, JPEG or WebP. Maximum 1 MB and 2048 × 2048 pixels. The image stays on this device.', removeBackground: 'Remove image', importTheme: 'Import theme', exportTheme: 'Export theme', themeHelp: 'Theme files contain appearance settings only.', events: 'Event timer', eventHelp: 'Save your own recurring timer. No game calendar or official Rift time is included; you enter the anchor time.', eventName: 'Event name', interval: 'Repeat interval (minutes)', anchor: 'First / known start (local time)', saveEvent: 'Save event', riftPreset: '3-hour Rift draft', activeEvent: 'Timer shown in header', none: 'Off', delete: 'Delete', next: 'Next', localTime: 'local time', every: 'Every', minutes: 'min', invalidEvent: 'Enter a name, valid anchor and 1–10080 minutes.', support: 'Support Luma ↗', supportHelp: 'Luma DPS · independent interface', radar: 'Radar', playback: 'Replay', overview: 'Overview', skills: 'Skills', history: 'History', planner: 'Planner', alerts: 'Alerts', selectPlayer: 'Select player', noPlayers: 'No player data yet.', sourceActual: 'RECEIVED DATA', sourceManual: 'MANUAL', sourceDemo: 'DEMO DATA', share: 'Damage share', duration: 'Duration', crit: 'Critical', hits: 'Hits', minMax: 'Min / max', noSkills: 'No received skill data for this player.', historyHelp: 'Received encounters and locally imported records. JSON exports are free.', noHistory: 'No saved encounters.', exportCurrent: 'Export current encounter', exportAll: 'Export all history', importHistory: 'Import history', imported: 'IMPORTED', historyImported: 'History imported', invalidFile: 'The file could not be read or is invalid.', equipment: 'Equipment notes', manualHelp: 'These are manually entered personal notes and estimates. They do not read equipment, Odyle or skill cooldowns from the game.', equipmentName: 'Equipment / set name', note: 'Note', add: 'Add', noEquipment: 'No equipment notes yet.', cooldowns: 'Cooldowns', cooldownName: 'Skill / reminder', seconds: 'Duration (seconds)', ready: 'Ready', start: 'Start', actualCooldowns: 'Received cooldowns', noActualCooldowns: 'No live cooldown data received.', odyle: 'Odyle calculation', balance: 'Entered balance', cap: 'Cap (0 = none)', refill: 'Added per cycle', refillInterval: 'Cycle (minutes; 0 = off)', savePlan: 'Save plan', estimate: 'Estimate from your entered values', estimateHelp: 'This is not a game rule. The balance, cycle and anchor are your assumptions.', dpsGoal: 'Group DPS goal (0 = off)', eventLead: 'Event alert lead (minutes)', sound: 'Alert sound', soundHelp: 'Sound works after you click a control in this session.', goalReached: 'DPS goal reached', goalWaiting: 'Waiting for DPS goal', noGoal: 'DPS goal is off', eventSoon: 'Your saved event is approaching', noAlert: 'No alert at the moment.', alertHelp: 'DPS alerts use the received group DPS. Event alerts use your own saved timer.', invalidPlanner: 'Enter a name and valid positive duration.', invalidEquipment: 'Enter an equipment name.', missingHistory: 'No data to export.', exported: 'JSON file ready', nativeExport: 'Encounter exported', resetDone: 'Encounter reset', bossTotal: 'Boss damage', playersCount: 'players', noTime: 'No anchor entered', clearImported: 'Clear imported records', clearConfirm: 'Imported local history cleared', windowClose: 'Close window', enabled: 'On', fileLarge: 'File size limit exceeded.', invalidRaster: 'PNG, JPEG or WebP; maximum 1 MB / 2048 × 2048.', dateUnknown: 'Date not provided', manualTimerHelp: 'Start uses this device’s clock to begin a countdown.', replay: 'Record details', snapshot: 'RECORD', aboutHelp: 'Live statistics only come from events supplied by the desktop capture engine.',
  },
};
Object.assign(words.tr, { controls: 'Kontroller', rotation: 'Rotasyon', healing: 'İyileştirme', runs: 'Oturumlar' });
Object.assign(words.en, { controls: 'Controls', rotation: 'Rotation', healing: 'Healing', runs: 'Sessions' });
const t = key => words[prefs.locale][key] || key;
Object.assign(words.tr, { team: 'Takım', autoOdyle: 'Otomatik Odyle', odyleWaiting: 'Odyle verisi bekleniyor. Luma açıkken karaktere yeniden giriş yapmak ilk enerji listesini almayı sağlar.', odyleRegular: 'Normal enerji', odyleBonus: 'Bonus enerji', odyleTotal: 'Kullanılabilir toplam', odyleCapacity: 'Normal enerji sınırı üyelik durumundan türetilir; bonus enerji ayrı tutulur.', observedTime: 'Son alınan', counterLearning: 'Sayaç alındı · süre birimi öğreniliyor', estimatedCooldown: 'Tahmini', ownCooldownHelp: 'Sunucunun kendi karakterin için gönderdiği sayaçlar. Süre, tutarlı örneklerden öğrenilir; ~ ile gösterilir. Yalnız yeni alınan sıfır hazır bilgisini doğrular.' });
Object.assign(words.en, { team: 'Team', autoOdyle: 'Automatic Odyle', odyleWaiting: 'Waiting for Odyle data. Logging into a character with Luma open captures the initial energy list.', odyleRegular: 'Regular energy', odyleBonus: 'Bonus energy', odyleTotal: 'Available total', odyleCapacity: 'Regular energy capacity is derived from membership state; bonus energy is separate.', observedTime: 'Last observed', counterLearning: 'Counter received · learning time unit', estimatedCooldown: 'Estimated', ownCooldownHelp: 'Server counters for your own character. Time is learned from consistent samples and marked ~. Only a newly received zero confirms readiness.' });
Object.assign(words.tr, { petProgress: 'Pet ilerlemesi', petHelp: 'Karakterine ait alınan pet seviyesi, ilerleme ve bu oturumdaki kazanımlar. Bilinmeyen adlar kimlikleriyle görünür; gerekli ruh sayısı tahmin edilmez.', noPetProgress: 'Pet verisi henüz alınmadı. Luma açıkken karakterine giriş yaptığında veya pet ilerlemesi geldiğinde görünür.', petActive: 'Çağrılan', petGained: 'Bu oturumda alınan', petAbsolute: 'Alınan ilerleme', petUnknown: 'İlerleme alınmadı', petPrevious: 'Önceki', petNext: 'Sonraki', petPartial: 'Yalnızca alınan pet kayıtları gösteriliyor; tam envanter değil.', stagger: 'Boss dengesi', noStagger: 'Güncel denge verisi alınmadı.', staggerHelp: 'Sunucudan alınan denge çubuğu ve kırılma durumu. Yeni veri gelmezse 5 saniye sonra gösterge kaldırılır; kırılma süresi tahmin edilmez.', eventStagger: 'Denge kırıldı' });
Object.assign(words.en, { petProgress: 'Pet progress', petHelp: 'Received pet levels, progress and gains from this session for your character. Unknown names use IDs; required soul counts are not guessed.', noPetProgress: 'No pet data received yet. It appears after login with Luma open or when pet progress arrives.', petActive: 'Summoned', petGained: 'Received this session', petAbsolute: 'Observed progress', petUnknown: 'Progress unavailable', petPrevious: 'Previous', petNext: 'Next', petPartial: 'Only observed pet records are shown, not a complete inventory.', stagger: 'Boss stagger', noStagger: 'No fresh stagger observation.', staggerHelp: 'Server-reported stagger bar and break state. The display clears after 5 seconds without new data; no break duration is predicted.', eventStagger: 'Stagger broken' });
Object.assign(words.tr, { pets: 'Pet rehberi' }); Object.assign(words.en, { pets: 'Pet guide' });
Object.assign(words.tr, { community: communityLabels.tr.community, copyEncounterText: 'Karşılaşma metnini kopyala' });
Object.assign(words.en, { community: communityLabels.en.community, copyEncounterText: 'Copy encounter text' });
Object.assign(words.tr, { hiddenCube: 'Hidden Cube', cubeTitle: 'Hidden Cube ses bulucu', cubeIntro: 'Oyunun çıkış sesindeki Küp örneğini yerel olarak eşleştirir. AION2 sesi arka planda otomatik dinlenir. Eşleşince pusula DPS listesinin yanında belirir; mikrofon kullanılmaz ve canlı ses kaydedilmez.', cubeStart: 'Dinlemeyi başlat', cubeStop: 'Dinlemeyi durdur', cubeBusy: 'Hazırlanıyor…', cubeSource: 'Dinlenecek ses', cubeGame: 'Yalnızca AION2', cubeSystem: 'Bu cihazın ses çıkışı', cubeGameHelp: 'AION2 sesini diğer uygulamalardan ayırır. Oyun açıldığında dinleme başlar. Kulaklık veya stereo çıkış ile sol/sağ gösterilebilir.', cubeSystemHelp: 'Sistem çıkışı seçildi: diğer uygulamalar ve Luma uyarıları da duyulur. Desteklenmeyen oyun ses yakalamasında bu seçeneği kendin kullanabilirsin.', cubeThreshold: 'Eşleşme eşiği', cubeThresholdHelp: 'Düşük eşik sessiz örnekleri daha kolay kabul eder, yanlış eşleşmeleri de artırabilir. Yüksek eşik daha seçicidir. Dinlemeyi durdurup değiştir.', cubeIndicator: 'Küçük barda Küp göstergesini göster', cubeSimilarity: 'Ses benzerliği', cubeSimilarityHelp: 'Yüzde, örnekle benzerlik puanıdır; kesinlik veya olasılık değildir.', cubeDirection: 'Stereo yön', cubeStrength: 'Eşleşen sinyal', cubeTrend: 'Sinyal değişimi', cubeLimit: 'Ses üzerinden kesin metre, harita konumu ve ön/arka hesaplanamaz. Stereo sol/sağ ve sinyal değişimi gösterilir; kamerayı döndürerek yönü karşılaştır.', cubeRelative: 'Sinyal güçlenmesi yalnızca göreli bir ipucudur. Oyun ses seviyesi, çevre sesleri ve kameranın yönü de değeri değiştirir.', cubeReference: 'Ses örneği', cubeBuiltin: 'Yerleşik Hidden Cube örneği', cubeImport: 'Kendi ses örneğini seç', cubeImportHelp: 'M4A veya WAV · en çok 8 MB ve 30 saniye. Örnek bu cihazda saklanır; internete gönderilmez. İçeriği yalnızca Küp sesi olan temiz bir kayıt kullan.', cubeReset: 'Yerleşik örneğe dön', cubeImported: 'Küp ses örneği kaydedildi', cubeImportInvalid: 'Ses örneği okunamadı. Desteklenen, en çok 8 MB bir ses dosyası seç.', cubePreview: 'Tarayıcı örneği · Canlı ses dinlenmiyor.', cubeAudioFormat: 'Ses biçimi', cubeUnknownFormat: 'Ses çıkışı bekleniyor', cubeNoDirection: 'Sol/sağ için stereo ses gerekir.', cubeReadFailed: 'Ses bulucunun durumu okunamadı', cubeActiveControls: 'Ses kaynağını veya örneği değiştirmek için önce dinlemeyi durdur.' });
Object.assign(words.en, { hiddenCube: 'Hidden Cube', cubeTitle: 'Hidden Cube sound locator', cubeIntro: 'Locally matches the Cube reference against game output. AION2 audio is monitored automatically in the background. A matching sound opens the compass beside the DPS list; no microphone is used and live audio is not saved.', cubeStart: 'Start listening', cubeStop: 'Stop listening', cubeBusy: 'Preparing…', cubeSource: 'Audio source', cubeGame: 'AION2 only', cubeSystem: 'This device’s audio output', cubeGameHelp: 'Separates AION2 audio from other apps. Listening begins when the game opens. Headphones or stereo output can provide left/right cues.', cubeSystemHelp: 'System output is selected: other apps and Luma alerts are included. Choose this explicitly if game-only audio capture is unavailable.', cubeThreshold: 'Match threshold', cubeThresholdHelp: 'A lower threshold can accept quieter samples and more false matches. A higher threshold is more selective. Stop listening before changing it.', cubeIndicator: 'Show Cube indicator in the compact bar', cubeSimilarity: 'Sound similarity', cubeSimilarityHelp: 'The percentage is a reference similarity score, not certainty or probability.', cubeDirection: 'Stereo direction', cubeStrength: 'Matched signal', cubeTrend: 'Signal change', cubeLimit: 'Audio cannot provide exact metres, map position or front/back. Stereo left/right and signal changes are shown; turn the camera to compare directions.', cubeRelative: 'A stronger signal is only a relative cue. Game volume, other sounds and camera direction also affect it.', cubeReference: 'Sound reference', cubeBuiltin: 'Built-in Hidden Cube reference', cubeImport: 'Choose your sound reference', cubeImportHelp: 'M4A or WAV · up to 8 MB and 30 seconds. The reference stays on this device and is never uploaded. Use a clean recording containing only the Cube sound.', cubeReset: 'Restore built-in reference', cubeImported: 'Cube reference saved', cubeImportInvalid: 'The audio reference could not be read. Choose a supported audio file up to 8 MB.', cubePreview: 'Browser sample · No live audio is being captured.', cubeAudioFormat: 'Audio format', cubeUnknownFormat: 'Waiting for audio output', cubeNoDirection: 'Left/right requires stereo audio.', cubeReadFailed: 'The sound locator state could not be read', cubeActiveControls: 'Stop listening before changing the source or reference.' });
Object.assign(words.tr, { settingsSections: 'Ayar bölümleri', analysisSections: 'Analiz bölümleri', groupCombat: 'Savaş', groupRecords: 'Kayıtlar', groupWorld: 'Takım ve dünya', groupMore: 'Diğer', bossLog: 'Boss kayıtları', combatSettings: 'Savaş', about: 'Hakkında', autoSaveHelp: 'Görünüm değişiklikleri otomatik kaydedilir.', keyboardHelp: 'Bölümler arasında ← → ile geç. Esc ile kapat.', panelResizeFailed: 'Pencere boyutu değiştirilemedi. Ayarlarını kullanmaya devam edebilirsin.', bossAdvanced: 'Hedef kimlikleri', bossSettingsHelp: 'Boss olarak işaretlediğin hedefler Boss filtresinde görünür. Liste, bu oturumda görülen hedefleri içerir.' });
Object.assign(words.en, { settingsSections: 'Settings sections', analysisSections: 'Analysis sections', groupCombat: 'Combat', groupRecords: 'Records', groupWorld: 'Team & world', groupMore: 'More', bossLog: 'Boss log', combatSettings: 'Combat', about: 'About', autoSaveHelp: 'Appearance changes are saved automatically.', keyboardHelp: 'Use ← → between sections. Esc closes the panel.', panelResizeFailed: 'The window could not resize. You can continue using your settings.', bossAdvanced: 'Target IDs', bossSettingsHelp: 'Targets you mark as bosses appear in the Boss filter. This list contains targets observed in this session.' });
Object.assign(words.tr, { historyStorageWarning: 'Geçmiş dosyası eksiksiz kaydedilemedi.', historyReadFailed: 'Geçmiş okunamadı. Daha önce yüklenen kayıtlar korunuyor.', historyRetry: 'Yeniden dene', timingUnavailable: 'Süre kaydı yok; DPS hesaplanamaz.' });
Object.assign(words.en, { historyStorageWarning: 'The history file could not be saved completely.', historyReadFailed: 'History could not be read. Previously loaded records are preserved.', historyRetry: 'Retry', timingUnavailable: 'No recorded duration; DPS is unavailable.' });
Object.assign(words.tr, { cubeGameHelp: 'AION2 sesini diğer uygulamalardan ayırır. Windows 11 veya Windows build 20348+ gerekir; eski Windows sürümlerinde cihazın ses çıkışını kendin seçebilirsin. Stereo çıkış sol/sağ ipucu verir.' });
Object.assign(words.en, { cubeGameHelp: 'Separates AION2 audio from other apps. Requires Windows 11 or build 20348+; on older Windows versions, choose system output explicitly. Stereo output provides left/right cues.' });
Object.assign(words.tr, { typography: 'Yazı ve okunabilirlik', appearanceExtras: 'Özel renkler, görsel ve tema dosyası' });
Object.assign(words.en, { typography: 'Text and readability', appearanceExtras: 'Custom colours, image and theme file' });
Object.assign(words.tr, { bossSettings: 'Boss hedefleri', bossHelp: 'Boss hedeflerini elle seçersiniz. Bu seçim resmi bir ağ boss işareti değildir. Tümü modu bütün hedefleri içerir.', saveBoss: 'Boss seçimini kaydet', noTargets: 'Henüz alınan hedef yok.' });
Object.assign(words.en, { bossSettings: 'Boss targets', bossHelp: 'You mark boss targets manually. This selection is not an official network boss flag. All mode includes every target.', saveBoss: 'Save boss selection', noTargets: 'No received targets yet.' });
Object.assign(words.tr, { targetFontSize: 'Hedef adı boyutu (px)', resizeHelp: 'Ok tuşları: 10 px · Shift + ok: 20 px', timerElapsed: 'Sayaç doldu', readyConfirmed: 'Hazır · sunucu onaylı', serverObserved: 'SUNUCUDAN GÖZLENEN', charges: 'Yükler' });
Object.assign(words.en, { targetFontSize: 'Target name size (px)', resizeHelp: 'Arrow keys: 10 px · Shift + arrow: 20 px', timerElapsed: 'Timer elapsed', readyConfirmed: 'Ready · server confirmed', serverObserved: 'SERVER OBSERVATION', charges: 'Charges' });
Object.assign(words.tr, { dragPanel: 'Bu başlıktan tutup pencereyi taşıyın.' });
Object.assign(words.en, { dragPanel: 'Drag this header to move the window.' });
Object.assign(words.tr, { personal: 'Kişisel', party: 'Grup', observed: 'Gözlenen', personalDps: 'KİŞİSEL DPS', personalDamage: 'KİŞİSEL HASAR', partyDps: 'GRUP DPS', partyDamage: 'GRUP HASARI', observedDps: 'GÖZLENEN DPS', observedDamage: 'GÖZLENEN HASAR', scope: 'Ölçüm kapsamı', character: 'Karakterim', characterName: 'Karakter adı', characterId: 'Bu oturumdaki karakterin', characterHelp: 'Adın otomatik gelmediyse aşağıda kendi satırını seçip adını yaz. Seçim yalnızca bu oturum için geçerlidir; yeniden girişte doğrula.', nameOnlyHelp: 'Yalnızca ad kaydedersen alınan oyuncu adı tam ve tekil eşleştiğinde kullanılır. Hasar miktarından karakterin tahmin edilmez.', chooseCharacter: 'Karakterini seç', characterUnknown: 'Kendi satırın henüz belirlenmedi. Karakterim bölümünden seç; yakındaki oyuncular kişisel hasarına eklenmez.', partyUnknown: 'Grup üyeleri belirlenmedi. Karakterim bölümünden grup listeni seç; yakındaki oyuncular otomatik grup sayılmaz.', partyHelp: 'Üyelik bilgisi alınmadığında gruptaki oyuncuları kendin seçebilirsin. Bu elle seçilen listedir.', manualParty: 'Grubum · elle seç', saveCharacter: 'Karakteri kaydet', clearCharacter: 'Seçimi temizle', saveParty: 'Grubu kaydet', autoDetect: 'Otomatik / henüz bilinmiyor', me: 'BEN', profileSource: 'Kimlik', layout: 'Hazır tasarımlar', layoutHelp: 'Renk paletinden bağımsız beş Luma tasarımı. Yazı, sıklık ve satır bilgilerini ayrıca değiştirebilirsin.', density: 'Liste sıklığı', comfortable: 'Rahat', compact: 'Sık', showClass: 'Sınıf bilgisini göster', showShares: 'Hasar yüzdesini göster', rowMetric: 'Satırda gösterilen', rowBoth: 'DPS ve hasar', rowDps: 'Yalnızca DPS', rowDamage: 'Yalnızca hasar', allObserved: 'Tüm gözlenen oyuncular', averageHit: 'Ortalama vuruş', skillSort: 'Yetenek sıralaması', skillDamage: 'Hasar', skillHits: 'Vuruş', skillCrit: 'Kritik oranı', encounterObserved: 'Karşılaşmada gözlenen', selectedScope: 'Seçili kapsam', personalWaiting: 'Kişisel hasar bekleniyor', partyWaiting: 'Grup hasarı bekleniyor', identityManual: 'Elle seçildi', identityServer: 'Sunucudan alındı', rosterManual: 'Elle seçilen grup', rosterServer: 'Sunucudan alınan grup', statsReceived: 'Bu istatistikler alınan olayları kapsar.' });
Object.assign(words.en, { personal: 'Personal', party: 'Group', observed: 'Observed', personalDps: 'PERSONAL DPS', personalDamage: 'PERSONAL DAMAGE', partyDps: 'GROUP DPS', partyDamage: 'GROUP DAMAGE', observedDps: 'OBSERVED DPS', observedDamage: 'OBSERVED DAMAGE', scope: 'Measurement scope', character: 'My character', characterName: 'Character name', characterId: 'Your character in this session', characterHelp: 'If your name has not arrived automatically, select your own row below and enter your name. This selection applies to this session; verify it after reconnecting.', nameOnlyHelp: 'With only a saved name, an exact unique received player name can match it. Damage amounts never identify your character.', chooseCharacter: 'Choose your character', characterUnknown: 'Your own row is not identified yet. Choose your character in My character; nearby players never enter your personal damage.', partyUnknown: 'Group members are not identified. Select your group in My character; nearby players are not automatically group members.', partyHelp: 'When membership is unavailable, you can explicitly select your group members. This is a manually chosen roster.', manualParty: 'My group · manual selection', saveCharacter: 'Save character', clearCharacter: 'Clear selection', saveParty: 'Save group', autoDetect: 'Automatic / not yet known', me: 'ME', profileSource: 'Identity', layout: 'Layout presets', layoutHelp: 'Five Luma designs independent of your color palette. Adjust fonts, density and row information separately.', density: 'List density', comfortable: 'Comfortable', compact: 'Compact', showClass: 'Show class information', showShares: 'Show damage percentages', rowMetric: 'Information in each row', rowBoth: 'DPS and damage', rowDps: 'DPS only', rowDamage: 'Damage only', allObserved: 'All observed players', averageHit: 'Average hit', skillSort: 'Skill sorting', skillDamage: 'Damage', skillHits: 'Hits', skillCrit: 'Critical rate', encounterObserved: 'Observed in this encounter', selectedScope: 'Selected scope', personalWaiting: 'Waiting for personal damage', partyWaiting: 'Waiting for group damage', identityManual: 'Manually selected', identityServer: 'Received from server', rosterManual: 'Manually chosen group', rosterServer: 'Received group', statsReceived: 'These statistics cover received events.' });
Object.assign(words.tr, { dpsGoal: 'Seçili kapsamda DPS hedefi (0 = kapalı)', alertHelp: 'DPS uyarısı seçili Kişisel / Grup / Gözlenen kapsamını kullanır. Etkinlik uyarısı kaydettiğin saati kullanır.' });
Object.assign(words.en, { dpsGoal: 'DPS goal for selected scope (0 = off)', alertHelp: 'DPS alerts use your selected Personal / Group / Observed scope. Event alerts use your saved timer.' });
Object.assign(words.tr, { reportFormat: 'Rapor biçimi', anonymize: 'Oyuncu adlarını gizle', reportHelp: 'Rapor seçili Kişisel / Grup / Gözlenen kapsamını kullanır. HTML, internetsiz açılabilen ve yazdırılabilen ayrıntılı rapordur.', reportSaved: 'Rapor kaydedildi', reportScope: 'Rapor kapsamı' });
Object.assign(words.en, { reportFormat: 'Report format', anonymize: 'Hide player names', reportHelp: 'Reports use the selected Personal / Group / Observed scope. HTML is a detailed offline report you can open and print.', reportSaved: 'Report saved', reportScope: 'Report scope' });
Object.assign(words.tr, { training: 'Antrenman', trainingTitle: 'Süreli kişisel antrenman', trainingHelp: 'Hazırladıktan sonra senin ilk doğrudan vuruşun sayacı başlatır. Seçilen süre bittiğinde antrenman sonucu donar; yakındaki oyuncular bu sonuca eklenmez.', trainingNeedIdentity: 'Başlamadan önce ◎ ile karakterini belirle.', trainingIdle: 'Başlamaya hazır', trainingArmed: 'İlk kişisel vuruşun bekleniyor', trainingRunning: 'Ölçüm devam ediyor', trainingComplete: 'Antrenman tamamlandı', trainingCancelled: 'Antrenman iptal edildi', armTraining: 'Antrenmanı hazırla', cancelTraining: 'İptal et', remaining: 'Kalan süre', curves: 'Grafikler', refreshCurve: 'Güncel kaydı al', curveHelp: 'Grafik, kaydedilen hasar olaylarından çizilir. Seçili kapsamı kullanır; 1 / 5 / 10 saniyelik kovalar farklı patlama aralıklarıdır.', noCurve: 'Bu kayıt için tam hasar zaman çizelgesi yok.', curveSummary: 'Bu kaydın ham vuruşları artık saklanmıyor; çizelge, kayıt sırasında tutulan saniyelik hasar toplamından çiziliyor.', curvePartial: 'Bu kayıt sınırlı veya eksik örnekler içeriyor. Patlama ve etkinlik oranı hesaplanmadı.', bestBurst: 'En yüksek kova DPS', activity: 'Vuruş etkinliği', activityHelp: 'Her alınan vuruştan sonraki 3 saniyelik pencerelerin birleşimi. Yetenek kullanma süresi veya buff süresi değildir.', recentProgress: 'Son karşılaşmalar', progressHelp: 'Kayıtların DPS değerleri. Farklı hedef veya süreler doğrudan aynı performansı ölçmez.', front: 'Önden', back: 'Arkadan', perfect: 'Perfect', double: 'Çift vuruş', parry: 'Parry', smite: 'Smite', quality: 'Alınan vuruş ayrıntıları' });
Object.assign(words.en, { training: 'Training', trainingTitle: 'Timed personal training', trainingHelp: 'After arming, your first direct hit starts the timer. Your training result freezes when the chosen duration ends; nearby actors are excluded.', trainingNeedIdentity: 'Use ◎ to identify your character before starting.', trainingIdle: 'Ready to start', trainingArmed: 'Waiting for your first direct hit', trainingRunning: 'Measurement in progress', trainingComplete: 'Training complete', trainingCancelled: 'Training cancelled', armTraining: 'Arm training', cancelTraining: 'Cancel', remaining: 'Time remaining', curves: 'Charts', refreshCurve: 'Read current record', curveHelp: 'This chart uses recorded damage events and your selected scope. 1 / 5 / 10 second buckets measure different burst windows.', noCurve: 'No complete damage timeline is available for this record.', curveSummary: 'This record\u2019s raw hits are no longer stored; the chart is drawn from the per-interval damage totals kept when it was recorded.', curvePartial: 'This record has limited or incomplete samples. Burst and activity rates were not calculated.', bestBurst: 'Highest bucket DPS', activity: 'Hit activity', activityHelp: 'The union of 3 second windows after each received hit. This is not cast time or buff duration.', recentProgress: 'Recent encounters', progressHelp: 'DPS values from recorded encounters. Different targets or durations do not directly measure the same performance.', front: 'Front', back: 'Back', perfect: 'Perfect', double: 'Double hit', parry: 'Parry', smite: 'Smite', quality: 'Received hit details' });
Object.assign(words.tr, { direction1: 'Yön alanı 1', direction2: 'Yön alanı 2' });
Object.assign(words.en, { direction1: 'Direction field 1', direction2: 'Direction field 2' });
Object.assign(words.tr, { effects: 'Etkiler', windups: 'Alınan hazırlık süreleri', effectHelp: 'Sunucudan alınan etki örnekleri. Bilinmeyen etki ve yetenek adları kimlikleriyle gösterilir. Sayaç, alınan süreyi izler; hasarın geleceği anı veya etkinin güç çarpanını tahmin etmez.', noEffects: 'Seçili kapsamda alınan etkin etki yok.', noWindups: 'Şu an alınan hazırlık olayı yok.', targeted: 'Hedef alınıyorsun', incomingWarnings: 'Kendi karakterine yönelen hazırlık uyarıları', persistent: 'Süresiz / bitiş bildirilmedi', recipient: 'Alıcı', caster: 'Kaynak', serverObserved: 'SUNUCUDAN GÖZLENEN' });
Object.assign(words.en, { effects: 'Effects', windups: 'Received windup timers', effectHelp: 'Effect instances received from the server. Unknown effect and skill names use their IDs. Timers follow received durations; they do not predict damage arrival or effect multipliers.', noEffects: 'No received active effects in the selected scope.', noWindups: 'No received windup is active.', targeted: 'You are being targeted', incomingWarnings: 'Warn about windups targeting your own character', persistent: 'Persistent / no end received', recipient: 'Recipient', caster: 'Source', serverObserved: 'SERVER OBSERVATION' });
Object.assign(words.tr, { trainingIncomplete: 'Bu antrenmanda yakalama kaybı bildirildi. Hasar sonucu eksik olabilir.', importedUnverified: 'İÇE AKTARILAN · DOĞRULANMAMIŞ' });
Object.assign(words.en, { trainingIncomplete: 'Capture loss was reported during this training. Damage may be incomplete.', importedUnverified: 'IMPORTED · UNVERIFIED' });
Object.assign(words.tr, { identityNameMatch: 'Adla eşleşti', unknownImport: 'Bu raporda ölçülmüş hasar toplamı yok. HTML raporu görüntülenebilir; bilinmeyen sonuç karşılaşma geçmişine eklenemez.' });
Object.assign(words.en, { identityNameMatch: 'Matched by name', unknownImport: 'This report has no measured damage total. You can view its HTML report; an unknown result cannot be added to measured encounter history.' });
Object.assign(words.tr, { numberPrecision: 'Kısa sayılarda ondalık basamak', receivedHp: 'Sunucudan alınan HP', maxUnknown: 'En yüksek HP alınmadı' });
Object.assign(words.en, { numberPrecision: 'Decimals in compact numbers', receivedHp: 'Server-reported HP', maxUnknown: 'Maximum HP not received' });
Object.assign(words.tr, { effectTimeline: 'Alınan olay sırası', refreshEffects: 'Olay sırasını yenile', noEffectTimeline: 'Henüz alınan olay sırası yok.', effectLimited: 'Etki kaydında saklama sınırına ulaşıldı. Görünen liste tam geçmiş değildir.', eventWindup: 'Hazırlık', eventCast: 'Yetenek kullanımı', eventApplied: 'Etki eklendi', eventRefreshed: 'Etki yenilendi', eventRemoved: 'Etki kaldırıldı', eventExpired: 'Alınan etki süresi doldu' });
Object.assign(words.en, { effectTimeline: 'Received event sequence', refreshEffects: 'Refresh event sequence', noEffectTimeline: 'No event sequence has been received.', effectLimited: 'The effect retention limit was reached. The visible list is not the complete history.', eventWindup: 'Windup', eventCast: 'Skill use', eventApplied: 'Effect applied', eventRefreshed: 'Effect refreshed', eventRemoved: 'Effect removed', eventExpired: 'Received effect duration elapsed' });
Object.assign(words.tr, { trainingTarget: 'Antrenman hedefi', anyTrainingTarget: 'Kendi vurduğun tüm hedefler' });
Object.assign(words.en, { trainingTarget: 'Training target', anyTrainingTarget: 'All targets you hit' });
Object.assign(words.tr, { customTrainingDuration: 'Özel süre (saniye)', trainingDurationHelp: '10–300 saniye; tam sayı gir.', invalidTrainingDuration: '10 ile 300 arasında tam sayı gir.' });
Object.assign(words.en, { customTrainingDuration: 'Custom duration (seconds)', trainingDurationHelp: '10–300 seconds; enter a whole number.', invalidTrainingDuration: 'Enter a whole number from 10 to 300.' });
Object.assign(words.tr, { curveHelp: 'Grafik, kaydedilen hasar olaylarından çizilir. Seçili kapsamın ilk vuruşundan başlar; gerçek zaman aralıkları duraklamaları da içerir. 1 / 5 / 10 saniyelik kovalar farklı patlama aralıklarıdır.' });
Object.assign(words.en, { curveHelp: 'This chart uses recorded damage events, starting from the first hit in the selected scope. Wall-clock intervals include pauses. 1 / 5 / 10 second buckets measure different burst windows.' });
Object.assign(words.tr, { build: 'Karakter', receivedBuild: 'Alınan karakter bilgisi', buildHelp: 'Oyun bağlantısından alınan ekipman, yetenek seviyeleri ve Daevanion seçimleri. Bilinmeyen öğe adları kimlikleriyle gösterilir. Elle yazdığın notlar Planlayıcı’da kalır.', refreshBuild: 'Karakter verisini yenile', ownBuild: 'Kendi karakter verin', unboundBuild: 'Oyuncuya bağlanmamış veri', inspectedBuild: 'İncelenen karakter', noBuild: 'Henüz karakter yapılandırma verisi alınmadı. Uygulama açıkken karakterine giriş yapabilir veya oyun içinde karakter incelemesini açabilirsin.', observedEquipment: 'Alınan ekipman', noObservedEquipment: 'Bu karakter için ekipman verisi alınmadı.', slot: 'Yuva', enchant: 'Güçlendirme', stones: 'Taşlar', stats: 'Alınan özellikler', skillBonuses: 'Yetenek bonusları', godstone: 'Godstone', level: 'Seviye', baseLevel: 'Temel seviye', daevanion: 'Daevanion', nodes: 'Seçili düğümler', noBoards: 'Daevanion seçimi alınmadı.', snapshotTime: 'Son alındığı saat', partialBuild: 'Bu bölümde alınan kayıt tam liste olarak bildirilmedi.', worldBosses: 'Dünya bossları', worldHelp: 'Harita bağlantısından alınan boss yuvaları ve sunucunun bildirdiği saatler. Harita/boss adları çözülmediğinde kimlikleri görünür. Sabit bir doğma takvimi tahmin edilmez.', refreshWorld: 'Harita saatlerini yenile', noWorld: 'Henüz harita boss durumu alınmadı. İlgili haritada sunucu güncellemesi gerektiğinde burada görünür.', bossAlive: 'Canlı · sunucudan alındı', bossAwaiting: 'Saat doldu · sunucu güncellemesi bekleniyor', bossUnknown: 'Doğma saati alınmadı', map: 'Harita', bossSlot: 'Boss yuvası', useTimer: 'Üst bardaki saat yap', timerSelected: 'Üst barda seçili', observedAt: 'Son durum' });
Object.assign(words.en, { build: 'Character', receivedBuild: 'Received character build', buildHelp: 'Equipment, skill levels and Daevanion choices received through the game connection. Unknown item names use their IDs. Your manual notes stay in Planner.', refreshBuild: 'Refresh character data', ownBuild: 'Your character data', unboundBuild: 'Data not bound to an actor', inspectedBuild: 'Inspected character', noBuild: 'No character build data has been received. Log into your character with Luma open or open an in-game character inspection.', observedEquipment: 'Received equipment', noObservedEquipment: 'No equipment data received for this character.', slot: 'Slot', enchant: 'Enchantment', stones: 'Stones', stats: 'Received stats', skillBonuses: 'Skill bonuses', godstone: 'Godstone', level: 'Level', baseLevel: 'Base level', daevanion: 'Daevanion', nodes: 'Chosen nodes', noBoards: 'No Daevanion choices received.', snapshotTime: 'Last received', partialBuild: 'This section was not reported as a complete list.', worldBosses: 'World bosses', worldHelp: 'Boss slots and server-reported times from map data. Unknown map/boss names use their IDs. No fixed respawn schedule is guessed.', refreshWorld: 'Refresh map timers', noWorld: 'No map boss state has been received yet. It appears when the server supplies the relevant map update.', bossAlive: 'Alive · received from server', bossAwaiting: 'Timer elapsed · awaiting server update', bossUnknown: 'Respawn time not received', map: 'Map', bossSlot: 'Boss slot', useTimer: 'Show timer in header', timerSelected: 'Selected in header', observedAt: 'Last observation' });
Object.assign(words.tr, { bossChipAlive: 'Canlı', bossChipAwaiting: 'Saat doldu', bossChipUnknown: 'Saat bilinmiyor' });
Object.assign(words.en, { bossChipAlive: 'Alive', bossChipAwaiting: 'Awaiting', bossChipUnknown: 'Time unknown' });
Object.assign(words.tr, { gameReport: 'Oyun raporu', gameReportHelp: 'Oyun içinde kaydettiğin Combat Analyzer dosyasını seç. Dosya cihazında okunur; yalnızca hasar, iyileştirme, alınan hasar, süre ve yetenek istatistikleri görüntülenir.', chooseGameReport: 'Combat Analyzer dosyası · en çok 4 MB', noGameReport: 'Henüz oyun raporu seçilmedi.', gameReportInvalid: 'Bu dosya desteklenen Combat Analyzer raporu değil veya boyutu 4 MB sınırını aşıyor.', gameReportSource: 'OYUN RAPORU', gameHealing: 'Rapordaki iyileştirme', gameTaken: 'Raporda alınan hasar', gameHps: 'Rapordaki HPS', personalComparison: 'Kişisel ölçüm karşılaştırması', refreshComparison: 'Güncel kişisel kayıtla karşılaştır', matchingWindow: 'Süre, başlangıç saati ve hedef eşleşti', differentWindow: 'Ölçüm pencereleri eşleşmedi. Farkı doğruluk hatası olarak yorumlama; iki kaydı aynı başlangıç/bitiş ve hedefle karşılaştır.', comparisonNoIdentity: 'Luma kaydında kendi karakterin belirlenmedi. ◎ ile karakterini seçip aynı denemeyi kaydet.', comparisonTarget: 'Hedef filtresi eşleşmesi doğrulanmadı.', comparisonIncomplete: 'Luma kaydında tam yakalama doğrulanmadı. Bu karşılaştırma kesin doğrulama değildir.', reportSkillMismatch: 'Rapordaki yetenek toplamı, raporun genel hasar toplamından farklı.', difference: 'Hasar farkı · Luma − oyun', gameDuration: 'Oyun raporu süresi', accuracy: 'İsabet', hardHit: 'Hard hit', block: 'Blok', miss: 'Iska', immune: 'Bağışıklık', ironWall: 'Iron wall', restoration: 'Restoration', additional: 'Ek vuruş', reportClock: 'Oyunun kaydettiği yerel saat' });
Object.assign(words.en, { gameReport: 'Game report', gameReportHelp: 'Choose a Combat Analyzer file saved in the game. It is read on this device; only damage, healing, damage taken, duration and skill statistics are displayed.', chooseGameReport: 'Combat Analyzer file · maximum 4 MB', noGameReport: 'No game report selected yet.', gameReportInvalid: 'This file is not a supported Combat Analyzer report or exceeds the 4 MB limit.', gameReportSource: 'GAME REPORT', gameHealing: 'Reported healing', gameTaken: 'Reported damage taken', gameHps: 'Reported HPS', personalComparison: 'Personal measurement comparison', refreshComparison: 'Compare with current personal record', matchingWindow: 'Duration, start clock and target matched', differentWindow: 'The measurement windows differ. Do not interpret the difference as an accuracy error; compare records with the same start/end and target.', comparisonNoIdentity: 'Your character is unresolved in this Luma record. Use ◎ to identify your character and record the same trial.', comparisonTarget: 'Target-filter match was not confirmed.', comparisonIncomplete: 'Complete capture was not confirmed for the Luma record. This comparison is not conclusive validation.', reportSkillMismatch: 'The report skill total differs from its overall damage total.', difference: 'Damage difference · Luma − game', gameDuration: 'Game report duration', accuracy: 'Accuracy', hardHit: 'Hard hit', block: 'Block', miss: 'Miss', immune: 'Immune', ironWall: 'Iron wall', restoration: 'Restoration', additional: 'Additional hit', reportClock: 'Local clock saved by the game' });
Object.assign(words.tr, { eventDrafts: 'Etkinlik taslakları', eventDraftHelp: 'Taslak yalnızca adı doldurur. Festival, istila ve kuşatma için tekrar aralığını ve tüm taslaklar için başlangıcı sen girersin. Günlük/haftalık aralıklar kişisel plan içindir; resmi sıfırlanma saati değildir.', eventReminder: 'Bu etkinlik için hatırlat', eventLeadPerEvent: 'Kaç dakika önce? (0 = saatinde)', exportCalendar: 'Seçili saati takvime aktar · ICS', calendarHorizon: 'Takvime aktarılacak gün sayısı', calendarHelp: 'ICS yalnızca üst barda seçili, elle kaydettiğin etkinliği içerir. UTC saatleriyle sınırlı bir tarih aralığı hazırlanır; resmi oyun takvimi değildir.', calendarFailed: 'Takvim hazırlanamadı. Aralıkta en az bir etkinlik ve en çok 1000 tekrar olmalı; daha kısa tarih aralığı seçebilirsin.', calendarSaved: 'Takvim dosyası hazır', eventNow: 'Kaydettiğin etkinlik saati geldi', userSchedule: 'KİŞİSEL TAKVİM' });
Object.assign(words.en, { eventDrafts: 'Event drafts', eventDraftHelp: 'A draft only fills its name. Enter the repeat interval for festival, invasion and siege, and the anchor for every draft. Daily/weekly intervals are personal planning templates, not official reset times.', eventReminder: 'Remind me about this event', eventLeadPerEvent: 'Minutes beforehand (0 = at its time)', exportCalendar: 'Export selected timer · ICS', calendarHorizon: 'Days to export into the calendar', calendarHelp: 'ICS contains only your manually saved event selected in the header. It uses UTC times for a finite horizon; it is not an official game calendar.', calendarFailed: 'The calendar could not be prepared. Its horizon needs at least one event and at most 1000 occurrences; you can select a shorter horizon.', calendarSaved: 'Calendar file ready', eventNow: 'Your saved event time has arrived', userSchedule: 'PERSONAL SCHEDULE' });
Object.assign(words.tr, { streaming: 'OBS yayın görünümü', obsHelp: 'Yalnızca aynı bilgisayardaki OBS için. Başlatınca OBS → Kaynaklar → Tarayıcı alanına aşağıdaki adresi ekle. Uygulama her açılışta kapalı başlar; hesap veya ücret gerekmez.', obsScope: 'Yayında gösterilen kapsam', obsHideNames: 'Oyuncu adlarını gizle', obsStart: 'Yayın görünümünü başlat', obsStop: 'Yayın görünümünü durdur', obsRunning: 'Aynı bilgisayarda açık', obsStopped: 'Kapalı', obsUrl: 'OBS Tarayıcı kaynağı adresi', copy: 'Kopyala', copied: 'Kopyalandı', selectToCopy: 'Adres seçildi; Ctrl+C ile kopyalayabilirsin.', obsPrivateHelp: 'Adres bu bilgisayara özeldir ve her başlatmada değişir. Durdurduğunda eski adres çalışmaz.', obsLiveScope: 'Aktif yayının kapsamı' });
Object.assign(words.en, { streaming: 'OBS stream overlay', obsHelp: 'For OBS on this same computer. After starting, add the address below as OBS → Sources → Browser. It starts off on every app launch; no account or payment is needed.', obsScope: 'Scope shown on stream', obsHideNames: 'Hide player names', obsStart: 'Start stream overlay', obsStop: 'Stop stream overlay', obsRunning: 'Running on this computer', obsStopped: 'Off', obsUrl: 'OBS Browser Source URL', copy: 'Copy', copied: 'Copied', selectToCopy: 'The address is selected; use Ctrl+C to copy it.', obsPrivateHelp: 'This address is local to this computer and changes on every start. It stops working when you stop the overlay.', obsLiveScope: 'Active stream scope' });
Object.assign(words.tr, { personalTaken: 'KİŞİSEL ALINAN HASAR', personalTakenRate: 'ALINAN HASAR / S', liveTaken: 'Alınan hasar', liveTakenRate: 'Alınan hasar / s', personalHealing: 'KİŞİSEL İYİLEŞTİRME', personalHps: 'KİŞİSEL HPS', liveHealing: 'İyileştirme', unknownReceived: '—, bu kayıtta doğrulanmış değer alınmadığını gösterir. Alınan hasar, karakterinin gövdesine gelen olayları kapsar.' });
Object.assign(words.en, { personalTaken: 'PERSONAL DAMAGE TAKEN', personalTakenRate: 'DAMAGE TAKEN / S', liveTaken: 'Damage taken', liveTakenRate: 'Damage taken / s', personalHealing: 'PERSONAL HEALING', personalHps: 'PERSONAL HPS', liveHealing: 'Healing', unknownReceived: '— means no validated value was received in this record. Damage taken covers events targeting your character’s body.' });
Object.assign(words.tr, { partial: 'Kısmi', takenPartialHelp: 'Alınan hasar yalnız doğrulanmış NPC kaynaklı vuruşları içerir. Oyuncu hedefli olaylarda PvP/iyileştirme ayrımı doğrulanamadığında bu miktarlar eklenmez.', unclassifiedEncounter: 'Karşılaşmada sınıflandırılmadan bırakılan oyuncu hedefli miktar', unclassifiedPlayer: 'Bu oyuncuyu hedef alan sınıflandırılmamış miktar' });
Object.assign(words.en, { partial: 'Partial', takenPartialHelp: 'Damage taken includes validated NPC-source hits only. Player-targeted amounts are excluded when their PvP/healing classification is unresolved.', unclassifiedEncounter: 'Unclassified player-targeted amount in this encounter', unclassifiedPlayer: 'Unclassified amount targeting this player' });
Object.assign(words.tr, { calendar: 'Etkinlik takvimi', calendarIntro: 'Hazır EU takviminden istediğin etkinliği üst barda gösterebilirsin. Saatler cihazının yerel saatinde görünür.', sourceCommunity: 'Topluluk', sourceOfficial: 'Resmî', sourcePersonal: 'Kişisel', showInHeader: 'Üst barda göster', shownInHeader: 'Barda seçili', calendarOpen: 'Açık', calendarCloses: 'Kapanış', calendarNext: 'Sonraki açılış', calendarReady: 'Hazır takvim', calendarRefresh: 'Takvimi yenile', calendarRefreshing: 'Takvim yenileniyor', calendarSource: 'Takvim bilgisi', calendarLastUpdate: 'Son güncelleme', customCalendar: 'Kendi etkinliğini ekle', customCalendarHelp: 'İstersen farklı bir etkinlik için kişisel saat ekleyebilirsin.', noCalendar: 'Takvim hazırlanıyor.', reminderShort: 'Hatırlat', reminderBefore: 'dk önce', calendarHelp: 'Üst barda seçtiğin etkinliği, seçilen tarih aralığı için takvim dosyası olarak kaydet.' });
Object.assign(words.en, { calendar: 'Event calendar', calendarIntro: 'Choose an event from the ready EU calendar to show in the header. Times appear in your device’s local clock.', sourceCommunity: 'Community', sourceOfficial: 'Official', sourcePersonal: 'Personal', showInHeader: 'Show in header', shownInHeader: 'Selected in header', calendarOpen: 'Open', calendarCloses: 'Closes', calendarNext: 'Next opening', calendarReady: 'Ready calendar', calendarRefresh: 'Refresh calendar', calendarRefreshing: 'Refreshing calendar', calendarSource: 'Calendar information', calendarLastUpdate: 'Last update', customCalendar: 'Add your own event', customCalendarHelp: 'You can also save a personal schedule for a different event.', noCalendar: 'Preparing calendar.', reminderShort: 'Remind me', reminderBefore: 'min before', calendarHelp: 'Save the event selected in your header as a calendar file for your chosen horizon.' });
Object.assign(words.tr, { summaryMetric: 'Üst özet göstergesi', summaryDps: 'Saniyelik hasar (DPS)', summaryDamage: 'Toplam hasar', summaryBoth: 'İkisini göster', rowMetric: 'Oyuncu satırında gösterilen', rowDps: 'Saniyelik hasar (DPS)', rowDamage: 'Toplam hasar', rowBoth: 'Saniyelik ve toplam hasar' });
Object.assign(words.en, { summaryMetric: 'Header summary metric', summaryDps: 'Damage per second (DPS)', summaryDamage: 'Total damage', summaryBoth: 'Show both', rowMetric: 'Player row metric', rowDps: 'Damage per second (DPS)', rowDamage: 'Total damage', rowBoth: 'DPS and total damage' });
Object.assign(words.tr, { rateCaption: 'SANİYELİK DPS', totalCaption: 'TOPLAM HASAR', rowBoth: 'Toplam hasar ve DPS (K/sn)' });
Object.assign(words.en, { rateCaption: 'DAMAGE / SECOND', totalCaption: 'TOTAL DAMAGE', rowBoth: 'Total damage and DPS (K/s)' });
Object.assign(words.tr, { cubeCompass: 'Ses pusulası', cubeOpen: 'Hidden Cube ses pusulasını aç', cubeDps: 'DPS görünümüne dön', cubeExpand: 'Ayrıntılı pusula', cubeCompact: 'Küçük pusula', cubeAudioSettings: 'Küp ses ayarları', cubeHide: 'Pusula göstergesini gizle', cubeHideListening: 'Pusula göstergesini gizle · dinleme sürer', cubeStereoAmbiguity: 'Ses pusulası · ön/arka belirsiz', cubeTurn: 'Kamerayı döndürerek karşılaştır', cubeRelativeStrength: 'Göreli sinyal', cubeSnr: 'Sinyal / gürültü', cubeLeft: 'SOL', cubeRight: 'SAĞ', cubeIndicator: 'Küp algılanınca DPS yanında pusulayı göster', cubeShow: 'Pusulayı göster', cubeSize: 'Pusula düzeni', cubeCompactLabel: 'Küçük', cubeFullLabel: 'Ayrıntılı' });
Object.assign(words.en, { cubeCompass: 'Audio compass', cubeOpen: 'Open Hidden Cube audio compass', cubeDps: 'Return to DPS view', cubeExpand: 'Detailed compass', cubeCompact: 'Compact compass', cubeAudioSettings: 'Cube audio settings', cubeHide: 'Hide compass indicator', cubeHideListening: 'Hide compass indicator · listening continues', cubeStereoAmbiguity: 'Audio compass · front/back ambiguous', cubeTurn: 'Turn the camera to compare', cubeRelativeStrength: 'Relative signal', cubeSnr: 'Signal / noise', cubeLeft: 'LEFT', cubeRight: 'RIGHT', cubeIndicator: 'Show a compass beside DPS when a Cube is detected', cubeShow: 'Show compass', cubeSize: 'Compass layout', cubeCompactLabel: 'Compact', cubeFullLabel: 'Detailed' });
Object.assign(words.tr, { bossCastsLabel: 'Yaklaşan boss büyülerini göster (sana yönelmese de)' });
Object.assign(words.en, { bossCastsLabel: 'Show the monster casts about to land (even when not aimed at you)' });
Object.assign(words.tr, {
  lethal: 'ÖLÜMCÜL', combatSave: 'Kaydet', ownHealthLabel: 'Kendi canımı göster (HP)', combatDetection: 'Savaş algılama', combatSource: 'Karşılaşma neye göre biter',
  combatHits: 'Vuruşlar (son vuruştan sonra sessizlik)', combatGame: 'Oyunun savaş durumu', combatSeconds: 'Bekleme süresi (5–300 sn)',
  combatLive: 'Oyunun şu anki bildirimi', combatUnknown: 'henüz bilgi gelmedi', combatIn: 'savaştasın', combatOut: 'savaşta değilsin',
  combatHelp: 'Vuruşlar: son vuruştan sonra seçilen süre sessizlik olursa karşılaşma biter. Oyun: oyun seni savaşta saydığı sürece karşılaşma açık kalır (boss fazlarında bölünmez); süre, savaştan çıktıktan sonraki bekleme. DPS süresi iki durumda da ilk vuruştan son vuruşa ölçülür. Oyun hiçbir bildirim göndermediyse vuruşlara dönülür.',
  lethalHelp: 'ÖLÜMCÜL yalnızca gördüğümüz veriye dayanır: o büyü sana, şu anki canından fazla bir hasar vurmuştu.',
});
Object.assign(words.en, {
  lethal: 'LETHAL', combatSave: 'Save', ownHealthLabel: 'Show my health (HP)', combatDetection: 'Combat detection', combatSource: 'What ends an encounter',
  combatHits: 'Hits (quiet after the last hit)', combatGame: "The game's combat state", combatSeconds: 'Wait (5–300 s)',
  combatLive: 'What the game says now', combatUnknown: 'nothing received yet', combatIn: 'you are in combat', combatOut: 'you are out of combat',
  combatHelp: "Hits: the encounter ends after the chosen quiet time. Game: it stays open while the game counts you in combat (boss phases do not split it); the time is the wait after you leave combat. DPS is timed from the first hit to the last either way. If the game sends no notice, hits are used.",
  lethalHelp: 'LETHAL rests only on what has been seen: that spell once hit you for more than the health you have now.',
});
Object.assign(words.tr, { cubeWalkRelative: 'Yürüdüğün yöne göre' });
Object.assign(words.en, { cubeWalkRelative: 'Relative to your walking direction' });
Object.assign(words.tr, { cubeAutoListen: 'Küp sesini arka planda otomatik dinle', cubeAutoHelp: 'Luma açıkken yalnızca AION2 sesi dinlenir. Küp sesi eşleştiğinde pusula DPS listesinin yanında açılır. İstersen dinlemeyi kapatabilirsin.', cubeCueLeft: 'Sola dön', cubeCueRight: 'Sağa dön', cubeCueBalanced: 'Stereo dengeli', cubeCueUnknown: 'Dönerek ara' });
Object.assign(words.en, { cubeAutoListen: 'Automatically listen for Cube audio in the background', cubeAutoHelp: 'Only AION2 audio is monitored while Luma is open. A matching Cube sound opens the compass beside the DPS list. You can turn listening off.', cubeCueLeft: 'Turn left', cubeCueRight: 'Turn right', cubeCueBalanced: 'Stereo balanced', cubeCueUnknown: 'Turn to locate' });
Object.assign(words.tr, { cubeQuiet: 'Oyun sesi çok düşük; oyunu öne getir ve ses çıkışını kontrol et.', cubeQuietSystem: 'Ses çıkışı çok düşük; çalan sesi ve çıkış cihazını kontrol et.', cubeInput: 'Seçilen ses kaynağının düzeyi', cubeDiagnostics: 'Ses tanılama', cubeFrames: 'Alınan ses kareleri', cubeUncertain: 'Zaman damgası belirsiz paketler', cubeGaps: 'Akış kesintileri' });
Object.assign(words.en, { cubeQuiet: 'Game audio is very quiet; bring the game forward and check its audio output.', cubeQuietSystem: 'Output audio is very quiet; check the playing audio and output device.', cubeInput: 'Selected audio source level', cubeDiagnostics: 'Audio diagnostics', cubeFrames: 'Received audio frames', cubeUncertain: 'Packets with uncertain timestamps', cubeGaps: 'Stream discontinuities' });
Object.assign(words.tr, { cubeThresholdHelp: 'Düşük eşik daha fazla adayı kabul eder; yanlış eşleşmeler artabilir. Yüksek eşik daha seçicidir. Dinlemeyi durdurup değiştir.' });
Object.assign(words.en, { cubeThresholdHelp: 'A lower threshold accepts more candidates and can increase false matches. A higher threshold is more selective. Stop listening before changing it.' });
Object.assign(words.tr, { rosterScope: 'Oyuncu listesi', rosterPersonal: 'Yalnız ben', rosterParty: 'Takım', rosterObserved: 'Yakındakiler', summaryScope: 'Üst özet ve rapor kapsamı', rowColorMode: 'DPS çubuğu renkleri', colorPerformance: 'DPS oranına göre', colorClass: 'Sınıfa göre', colorAccent: 'Tema rengi', shortPersonal: 'BEN', shortParty: 'TAKIM', shortObserved: 'YAKIN', partyFallback: 'Takım kadrosu henüz alınmadı · yakındaki oyuncular gösteriliyor.' });
Object.assign(words.en, { rosterScope: 'Player list', rosterPersonal: 'Only me', rosterParty: 'Party', rosterObserved: 'Nearby', summaryScope: 'Header summary and report scope', rowColorMode: 'DPS bar colors', colorPerformance: 'By relative DPS', colorClass: 'By class', colorAccent: 'Theme accent', shortPersonal: 'ME', shortParty: 'PARTY', shortObserved: 'NEARBY', partyFallback: 'Party roster has not arrived yet · showing nearby players.' });
const num = n => compactNumber(n, prefs.locale, prefs.numberPrecision);
const rate = n => formatRate(n, prefs.locale, prefs.numberPrecision);
const fullNumber = n => new Intl.NumberFormat(prefs.locale === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 }).format(n);
const dateText = value => { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleString(prefs.locale === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : t('dateUnknown'); };
const toLocalInput = value => { if (!value) return ''; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
function scheduledEvents() {
  const key = JSON.stringify([prefs.calendarRegion, prefs.builtInReminders, prefs.events, scheduleDataRevision]);
  if (key !== scheduledCacheKey) { scheduledCacheKey = key; scheduledCache = typeof scheduling.allEvents === 'function' ? scheduling.allEvents(prefs, scheduleSnapshot) : prefs.events; scheduleTimingSecond = -1; }
  return scheduledCache;
}
function scheduleTiming(event, now = Date.now()) {
  const second = Math.floor(now / 1000);
  if (second !== scheduleTimingSecond) { scheduleTimingSecond = second; scheduleTimings.clear(); }
  if (!scheduleTimings.has(event.id)) { const timing = typeof scheduling.nextScheduledEvent === 'function' ? scheduling.nextScheduledEvent(event, now) : recurringEvent(event, now); scheduleTimings.set(event.id, timing ? { ...timing, remainingMs: timing.remainingMs ?? timing.remaining, nextOpening: timing.nextOpening ?? timing.next, status: timing.status || 'upcoming' } : null); }
  return scheduleTimings.get(event.id);
}
const eventReminder = (event, now = Date.now()) => typeof scheduling.eventReminder === 'function' ? scheduling.eventReminder(event, now) : null;
const activeEvent = () => scheduledEvents().find(event => event.id === prefs.activeEventId);
const chosenBossTimer = () => fieldBossTimers(worldData).find(timer => timer.key === prefs.activeEventId);
let snapshot = null;
const analysisState = () => snapshot || state;
const retainedRecord = () => snapshot || curveRecord;
let radarFilter = 'all', playbackRecord = null, playbackChoices = [], playbackAwaitCurrent = false;
const playback = replayClock();
const radarPetMatches = target => petTargetMatches(target, petCatalog);
function liveRadarFrame() { return spatialFrame(state.spatial, { selfId: liveServerActorId(state), partyIds: state.party_member_ids, filter: radarFilter, petMatches: radarPetMatches }); }
function radarContent() {
  const tr = prefs.locale === 'tr';
  return `${demo ? source(t('sourceDemo')) : ''}<h3 class="section-title">Radar</h3><p class="help">${tr ? 'Oyundan alınan konumlar · metre cinsinden yatay uzaklık. +X / +Y dünya eksenleridir; yön oku veya harita kuzeyi olarak kalibre edilmemiştir. Soluk noktalar son görülen konumdur.' : 'Received positions · horizontal distance in metres. +X / +Y are fixed world axes, not calibrated camera heading or geographic north. Faded markers are last seen positions.'}</p><div class="spatial-toolbar"><label>${tr ? 'Aralık' : 'Range'} <select name="radarRange">${[20, 50, 100, 200].map(n => `<option ${prefs.radarRange === n ? 'selected' : ''}>${n}</option>`).join('')}</select> m</label><label>${tr ? 'Göster' : 'Show'} <select name="radarFilter">${[['all', tr ? 'Tümü' : 'All'], ['party', tr ? 'Takım' : 'Party'], ['npc', tr ? 'Yaratıklar' : 'Creatures'], ['pets', tr ? 'Pet kaynakları' : 'Pet sources']].map(([key, label]) => `<option value="${key}" ${radarFilter === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div id="radar-live">${radarMarkup()}</div><p class="help">${tr ? 'Yalnız bağlantında konumu alınan kaynaklar görünür. Pet eşleştirmeleri doğrulanmış NPC kimliği veya tam yaratık adını kullanır.' : 'Only sources with positions received by your connection are shown. Pet matches use verified NPC IDs or exact creature names.'}</p>`;
}
function radarMarkup() { return `<div class="spatial-layout">${renderRadar(liveRadarFrame(), { locale: prefs.locale, range: prefs.radarRange, hideNames: prefs.hidePlayerNames, pinnedIds: prefs.petPins })}</div>`; }
function renderLiveRadar() {
  const visible = prefs.displayModules.dps || prefs.displayModules.pets;
  $('#radar-chip').hidden = !visible;
  setAttribute($('#radar-chip'), 'aria-expanded', String(prefs.radarOpen));
  $('#radar-dock').hidden = !visible || !prefs.radarOpen;
  if (visible && prefs.radarOpen) {
    const dock = $('#radar-dock');
    if (!dock.querySelector('[data-radar-view]')) dock.innerHTML = `<div class="radar-dock-head"><strong data-radar-title></strong><button type="button" class="text-button" data-action="radar-details"></button></div><div data-radar-view></div>`;
    setText(dock.querySelector('[data-radar-title]'), `Radar · ${prefs.radarRange} m`);
    setText(dock.querySelector('[data-action=radar-details]'), prefs.locale === 'tr' ? 'Ayrıntılar ↗' : 'Details ↗');
    const view = dock.querySelector('[data-radar-view]'), html = renderRadar(liveRadarFrame(), { locale: prefs.locale, range: prefs.radarRange, hideNames: prefs.hidePlayerNames, pinnedIds: prefs.petPins, compact: true });
    if (view._markup !== html) { view.innerHTML = html; view._markup = html; }
  }
  const host = $('#radar-live');
  if (drawer === 'analysis' && tab === 'radar' && host && !host.contains(document.activeElement) && !host.querySelector('button:hover')) { const html = radarMarkup(); if (host._markup !== html) { host.innerHTML = html; host._markup = html; } }
}
function replayContent() {
  const tr = prefs.locale === 'tr';
  playbackRecord ||= snapshot || curveRecord;
  playbackChoices = [...(playbackRecord ? [{ key: 'selected', record: playbackRecord }] : []), ...allHistory().map(row => ({ key: historyRecordKey(row.item, { imported: row.imported }), record: row.item }))];
  const timeline = replayTimeline(playbackRecord || {}, prefs.damageScope);
  return `${demo ? source(t('sourceDemo')) : ''}<h3 class="section-title">Replay</h3><div class="field"><label for="replay-record">${tr ? 'Karşılaşma kaydı' : 'Encounter record'}</label><select id="replay-record" name="replayRecord">${playbackChoices.map(row => `<option value="${esc(row.key)}">${esc(row.record.name)} · ${esc(row.record.timestamp ? new Date(row.record.timestamp).toLocaleString(prefs.locale) : '')}</option>`).join('')}</select></div><div class="replay-controls"><button type="button" class="action-button" data-action="replay-toggle" ${timeline.duration ? '' : 'disabled'}>${tr ? 'Oynat' : 'Play'}</button><input name="replaySeek" type="range" min="0" max="${timeline.duration}" step="100" value="${playback.offset}" aria-label="${tr ? 'Kayıt zamanı' : 'Replay time'}"><output id="replay-time"></output><label>${tr ? 'Hız' : 'Speed'} <select name="replaySpeed">${[.5, 1, 2, 4].map(n => `<option value="${n}" ${playback.speed === n ? 'selected' : ''}>${n}×</option>`).join('')}</select></label><button type="button" class="text-button" data-action="replay-current">${tr ? 'Şimdiki kaydı al' : 'Load current record'}</button></div><div id="replay-stage">${renderReplayFrame(replayFrame(playbackRecord || {}, timeline, playback.offset), timeline, { locale: prefs.locale, hideNames: prefs.hidePlayerNames, range: prefs.radarRange })}</div>`;
}
function updatePlayback() {
  if (drawer !== 'analysis' || tab !== 'playback') return;
  const timeline = replayTimeline(playbackRecord || {}, prefs.damageScope), offset = playback.tick(performance.now(), timeline.duration);
  const stage = $('#replay-stage'); if (!stage) return;
  const html = renderReplayFrame(replayFrame(playbackRecord || {}, timeline, offset), timeline, { locale: prefs.locale, hideNames: prefs.hidePlayerNames, range: prefs.radarRange });
  if (stage._markup !== html) { stage.innerHTML = html; stage._markup = html; }
  const slider = $('[name=replaySeek]'); if (slider && slider !== document.activeElement) slider.value = offset;
  setText($('#replay-time'), `${clockTime(offset)} / ${clockTime(timeline.duration)}`);
  setText($('[data-action=replay-toggle]'), prefs.locale === 'tr' ? playback.playing ? 'Duraklat' : 'Oynat' : playback.playing ? 'Pause' : 'Play');
}
const insightOptions = () => ({ locale: prefs.locale, scope: prefs.damageScope, actorId: selectedPlayer || null });
const sourceLabel = () => snapshot ? t('snapshot') : demo ? t('sourceDemo') : t('sourceActual');

function toast(message, error = false) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').classList.toggle('error', error);
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, error ? 6500 : 2800);
}

async function action(command, args, demoAction) {
  if (native) {
    try { return await invoke(command, args); }
    catch (error) { toast(`${t('failed')}: ${String(error).slice(0, 160)}`, true); throw error; }
  }
  if (demo && demoAction) return demoAction();
  toast(t('nativeOnly'));
  return null;
}

function applyAppearance() {
  const colors = prefs.theme === 'custom' ? prefs.customColors : THEMES[prefs.theme];
  const channels = colors.bg.slice(1).match(/.{2}/g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const lightSurface = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .3;
  document.documentElement.dataset.surface = lightSurface ? 'light' : 'dark';
  for (const key of ['bg', 'panel', 'text', 'accent']) document.documentElement.style.setProperty(`--${key}`, colors[key]);
  document.documentElement.style.setProperty('--body-font', FONTS[prefs.font]);
  document.documentElement.style.setProperty('--target-font', FONTS[prefs.targetFont]);
  document.documentElement.style.setProperty('--target-size', `${prefs.targetFontSize}px`);
  document.documentElement.style.setProperty('--scale', prefs.textScale);
  document.documentElement.style.setProperty('--opacity', prefs.opacity);
  document.documentElement.style.setProperty('--background', prefs.background ? `url("${prefs.background}")` : 'none');
  document.documentElement.style.colorScheme = lightSurface ? 'light' : 'dark';
  document.documentElement.lang = prefs.locale;
  $('#meter').dataset.layout = prefs.layout;
  $('#meter').dataset.theme = prefs.theme;
  $('#meter').dataset.density = prefs.density;
  $('#meter').dataset.rowMetric = prefs.rowMetric;
  $('#meter').dataset.summaryMetric = prefs.summaryMetric;
  $('#meter').classList.toggle('compact-strip', prefs.compactStrip && prefs.displayModules.dps && !drawer && !toolsOpen && !isFullscreenDashboard(prefs));
  $('#compact-button').disabled = isFullscreenDashboard(prefs) || !prefs.displayModules.dps;
  $('#meter').classList.toggle('pet-only', petOnlyDisplay(prefs));
  $('#meter').classList.toggle('no-dps', !prefs.displayModules.dps);
  for (const name of DISPLAY_MODULES) $('#meter').dataset[`module${name[0].toUpperCase()}${name.slice(1)}`] = String(prefs.displayModules[name]);
  $('#meter').dataset.showClass = String(prefs.showClass);
  $('#meter').dataset.detailRows = String(prefs.hudDetailRows);
  $('#meter').dataset.largeType = String(prefs.textScale > 1.25);
  for (const name of HUD_PANELS) $('#meter').dataset[`hud${name[0].toUpperCase()}${name.slice(1)}`] = String(hudPanelVisible(prefs, name));
  $('#meter').dataset.clean = String(prefs.cleanLook);
  $('#meter').dataset.look = prefs.cleanLook && overlayLocked && !drawer && !toolsOpen ? 'bare' : 'frame';
  syncMainInteractive();
  $('#drag-region').style.cursor = prefs.locked || isFullscreenDashboard(prefs) ? 'default' : 'grab';
  syncOverlayGeometry();
  scheduleRosterFit();
}

function syncOverlayGeometry() {
  const dashboard = isFullscreenDashboard(prefs);
  if (document.body.classList.contains('fullscreen-overlay') !== prefs.fullscreenOverlay || document.body.classList.contains('fullscreen-dashboard') !== dashboard) { overlayRegionFingerprint = ''; overlayRegionFailures = 0; }
  if (!prefs.fullscreenOverlay) overlayRegionFingerprint = '';
  if ((!prefs.fullscreenOverlay || dashboard) && hudGesture) { try { hudGesture.target.releasePointerCapture(hudGesture.pointerId); } catch {} hudGesture = null; }
  document.body.classList.toggle('fullscreen-overlay', prefs.fullscreenOverlay);
  document.body.classList.toggle('fullscreen-dashboard', dashboard);
  document.body.classList.toggle('fullscreen-hud', prefs.fullscreenOverlay && !dashboard);
  if (prefs.fullscreenOverlay) {
    const rect = overlayRect(prefs, { width: innerWidth, height: innerHeight }, { panelOpen: Boolean(drawer) || toolsExpanded });
    for (const [key, value] of Object.entries(rect)) document.documentElement.style.setProperty(`--hud-${key}`, `${value}px`);
  }
  scheduleOverlayRegions();
}

function scheduleOverlayRegions() {
  const needed = () => prefs.fullscreenOverlay || prefs.locked && prefs.clickThroughWhenLocked;
  if (!native || !needed() || overlayRegionFrame) return;
  overlayRegionFrame = requestAnimationFrame(() => {
    overlayRegionFrame = 0;
    if (!needed()) { overlayRegionFingerprint = ''; return; }
    const rect = $('#meter').getBoundingClientRect();
    const regions = !prefs.fullscreenOverlay ? [] : hudGesture ? [{ x: 0, y: 0, width: innerWidth, height: innerHeight }] : [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
    const interactiveRegions = visibleInputRegions($('#meter'), { width: innerWidth, height: innerHeight });
    const fingerprint = JSON.stringify([regions, interactiveRegions, prefs.locked, prefs.clickThroughWhenLocked, Boolean(drawer)]);
    if (fingerprint === overlayRegionFingerprint) return;
    overlayRegionFingerprint = fingerprint;
    invoke('set_overlay_hit_regions', { regions, interactiveRegions }).then(() => { overlayRegionFailures = 0; }).catch(() => {
      overlayRegionFingerprint = '';
      if (!needed()) return;
      if (++overlayRegionFailures < 3) setTimeout(scheduleOverlayRegions, 100);
      else if (prefs.fullscreenOverlay) { toast(prefs.locale === 'tr' ? 'Panel etkileşimi hazırlanamadı; pencere görünümüne dönülüyor.' : 'HUD input could not initialize; returning to window mode.', true); toggleFullscreenOverlay(false); }
      else { toast(prefs.locale === 'tr' ? 'Düğme etkileşimi hazırlanamadı; tıklamaları oyuna geçirme kapatıldı.' : 'Control input could not initialize; click-through was disabled.', true); savePreferences({ clickThroughWhenLocked: false }); }
    });
  });
}

async function toggleFullscreenOverlay(enabled = !prefs.fullscreenOverlay, layout = enabled ? 'dashboard' : fullscreenLayout(prefs)) {
  if (fullscreenPending) return;
  fullscreenPending = true;
  try {
    if (native) await preferenceCommitter.run(async () => {
      const confirmed = normalizePreferences(await invoke('set_fullscreen_overlay', { enabled, layout }));
      prefs = normalizePreferences({ ...prefs, fullscreenOverlay: confirmed.fullscreenOverlay, fullscreenLayout: confirmed.fullscreenLayout });
      preferenceCommitter.confirm(prefs); storeLocalPreferences(prefs);
      overlayRegionFailures = 0; overlayRegionFingerprint = ''; applyAppearance(); renderMeter();
    });
    else savePreferences({ fullscreenOverlay: enabled, fullscreenLayout: layout });
  } catch (error) { toast(String(error).slice(0, 200), true); }
  finally { fullscreenPending = false; if (drawer === 'settings') refreshDrawer('fullscreenOverlay'); }
}

function startHudGesture(event, resize = false) {
  if (!prefs.fullscreenOverlay || isFullscreenDashboard(prefs) || event.button !== 0 || event.isPrimary === false || prefs.locked && !drawer) return false;
  event.preventDefault();
  const rect = overlayRect(prefs, { width: innerWidth, height: innerHeight }, { panelOpen: Boolean(drawer) });
  hudGesture = { pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, rect, preferences: { ...prefs }, resize, target: event.currentTarget, patch: {} };
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  overlayRegionFingerprint = ''; scheduleOverlayRegions(); return true;
}

document.addEventListener('pointermove', event => {
  if (!hudGesture || event.pointerId !== hudGesture.pointerId) return;
  hudGesture.patch = overlayGesture(hudGesture, { x: event.clientX, y: event.clientY }, { width: innerWidth, height: innerHeight }, { resize: hudGesture.resize, panelOpen: Boolean(drawer) });
  prefs = normalizePreferences({ ...prefs, ...hudGesture.patch }); syncOverlayGeometry();
});
const finishHudGesture = event => {
  if (!hudGesture || event.pointerId !== hudGesture.pointerId) return;
  const gesture = hudGesture; hudGesture = null;
  try { gesture.target.releasePointerCapture(event.pointerId); } catch {}
  overlayRegionFingerprint = ''; savePreferences(gesture.patch); scheduleOverlayRegions();
};
document.addEventListener('pointerup', finishHudGesture);
document.addEventListener('pointercancel', finishHudGesture);

function storeLocalPreferences(value) {
  try { localStorage.setItem('luma-independent-preferences', JSON.stringify(value)); }
  catch { toast(t('failed'), true); }
}

const protectCubeIntent = value => cubeAutoListenIntent === null ? value : { ...value, cubeAutoListen: cubeAutoListenIntent };
const preferenceCommitter = native ? createPreferenceCommitter(prefs, {
  write: value => invoke('set_preferences', { preferences: protectCubeIntent(value) }),
  onConfirmed: value => {
    const owned = { ...Object.fromEntries(['fullscreenOverlay', 'locked'].filter(key => typeof value[key] === 'boolean').map(key => [key, value[key]])), fullscreenLayout: fullscreenLayout(value) };
    if (Object.entries(owned).some(([key, flag]) => prefs[key] !== flag)) {
      prefs = normalizePreferences({ ...prefs, ...owned }); applyAppearance(); renderMeter();
      if (drawer === 'settings' && settingsTab === 'controls') refreshDrawer(document.activeElement?.name);
    }
    storeLocalPreferences(protectCubeIntent({ ...value, fullscreenOverlay: prefs.fullscreenOverlay, fullscreenLayout: prefs.fullscreenLayout, locked: prefs.locked }));
  },
  onRejected: (error, rollback) => {
    if (rollback) {
      const focusName = document.activeElement?.name;
      prefs = normalizePreferences(protectCubeIntent({ ...rollback, fullscreenOverlay: prefs.fullscreenOverlay, fullscreenLayout: prefs.fullscreenLayout, locked: prefs.locked })); applyAppearance(); renderMeter();
      if (drawer) refreshDrawer(focusName);
    }
    toast(`${t('failed')}: ${String(error).slice(0, 100)}`, true);
  },
}) : null;
const initialPreferences = native ? preferenceCommitter.load(async () => normalizePreferences(withSystemLocale(await invoke('get_preferences')))) : null;

function savePreferences(patch = {}) {
  prefs = normalizePreferences({ ...prefs, ...patch });
  applyAppearance();
  if (native) preferenceCommitter.save(prefs);
  else storeLocalPreferences(prefs);
  renderMeter();
}

function localizeControls() {
  $('#tools-button').title = prefs.locale === 'tr' ? 'Araçlar ve görünüm' : 'Tools and appearance';
  setAttribute($('#tools-button'), 'aria-label', $('#tools-button').title);
  setText($('#column-rate'), 'DPS'); setText($('#column-damage'), prefs.locale === 'tr' ? 'Toplam' : 'Damage');
  $('#modules-button').title = prefs.locale === 'tr' ? 'Görünür modülleri seç · Tüm görünüme dön' : 'Choose visible modules · Restore full view';
  $('#modules-button').setAttribute('aria-label', $('#modules-button').title);
  $('#modules-button').setAttribute('aria-pressed', String(!Object.values(prefs.displayModules).every(Boolean)));
  $('#fullscreen-button').title = prefs.locale === 'tr' ? (prefs.fullscreenOverlay ? 'Pencere görünümüne dön' : 'Tam ekran paneli') : (prefs.fullscreenOverlay ? 'Return to window' : 'Fullscreen dashboard'); $('#fullscreen-button').setAttribute('aria-label', $('#fullscreen-button').title); $('#fullscreen-button').setAttribute('aria-pressed', String(prefs.fullscreenOverlay));
  $('#compact-button').title = prefs.locale === 'tr' ? 'Kompakt görünümü değiştir' : 'Toggle compact view'; $('#compact-button').setAttribute('aria-label', $('#compact-button').title); $('#compact-button').setAttribute('aria-pressed', String(prefs.compactStrip));
  $('#target-label').textContent = t('target'); $('#dps-label').textContent = t(`${prefs.damageScope}Dps`); $('#damage-label').textContent = t(`${prefs.damageScope}Damage`); $('#player-label').textContent = t('player'); $('#heading-total').textContent = prefs.rowMetric === 'both' ? `${t('totalCaption')} · DPS` : prefs.rowMetric === 'dps' ? t('rateCaption') : t('totalCaption');
  if (prefs.layout === 'cupertino' && prefs.damageScope === 'personal') { setText($('#dps-label'), prefs.locale === 'tr' ? 'SENİN DPS’İN' : 'YOUR DPS'); setText($('#damage-label'), prefs.locale === 'tr' ? 'TOPLAM HASARIN' : 'YOUR DAMAGE'); }
  $('#scope-label').textContent = t('rosterScope'); $('#damage-scope').value = prefs.rosterScope;
  for (const option of $('#damage-scope').options) option.textContent = option.value === 'target' ? (prefs.locale === 'tr' ? 'Hedef · 10' : 'Target · 10') : t({personal:'rosterPersonal', party:'rosterParty', observed:'rosterObserved'}[option.value]);
  const own = ownPlayer(state);
  $('#identity-name').textContent = state.local_player_name || (own ? displayPlayerName(own, prefs.locale) : '') || prefs.characterName || t('character');
  $('#identity-button').classList.toggle('identified', ['server', 'manual', 'name-match'].includes(state.local_identity_source));
  $('#identity-button').title = `${t('character')}: ${state.local_player_name || own?.name || prefs.characterName || t('autoDetect')}`;
  $('#identity-button').setAttribute('aria-label', t('chooseCharacter'));
  $('#training-button').title = t('trainingTitle'); $('#training-button').setAttribute('aria-label', t('trainingTitle'));
  $('#training-button').classList.toggle('active-timer', ['armed', 'running'].includes(trainingState(state.training).status));
  for (const [id, key] of [['settings-button', 'settings'], ['close-drawer', 'close'], ['reset-button', 'reset'], ['resize-button', 'resize'], ['close-window', 'windowClose']]) { $( `#${id}`).setAttribute('aria-label', t(key)); $( `#${id}`).title = t(key); }
  $('#close-window').disabled = !native;
  $('#sort-label').textContent = t('sort'); $('#sort option[value=damage]').textContent = `${t('damage')} ↓`;
  $('#analysis-button').textContent = `${!prefs.displayModules.dps && prefs.displayModules.pets ? t('pets') : t('analysis')} ↗`;
  $('#analysis-button').hidden = !visibleAnalysisSections(ANALYSIS_SECTIONS, prefs).length;
  for (const button of $$('#target-modes button')) { button.textContent = t(button.dataset.mode); button.setAttribute('aria-pressed', String(button.dataset.mode === prefs.mode)); }
  $('#sort').value = prefs.sort;
  const pauseLabel = t(state.paused ? 'resume' : 'pause');
  $('#pause-button').textContent = state.paused ? '▷' : 'Ⅱ'; $('#pause-button').setAttribute('aria-label', pauseLabel); $('#pause-button').title = pauseLabel;
  $('#pause-button').setAttribute('aria-pressed', String(state.paused));
  $('#pause-button').disabled = !native && !demo; $('#reset-button').disabled = !native && !demo;
  const lockLabel = t(prefs.locked ? 'unlock' : 'lock'); $('#lock-button').textContent = prefs.locked ? '◆' : '◇'; $('#lock-button').setAttribute('aria-label', lockLabel); $('#lock-button').title = lockLabel; $('#lock-button').setAttribute('aria-pressed', String(prefs.locked));
  $('#resize-button').disabled = prefs.locked;
  $('#resize-button').title = `${t('resize')} · ${t('resizeHelp')}`;
  $('#resize-button').setAttribute('aria-description', t('resizeHelp'));
}

function toolsMenuContent() {
  const tr = prefs.locale === 'tr', pair = (trText, enText) => tr ? trText : enText;
  const item = (action, label) => `<button type="button" data-tools-action="${action}">${label}</button>`;
  return `<div class="tools-menu-heading"><strong>${pair('Araçlar ve görünüm', 'Tools and appearance')}</strong><button type="button" class="icon-button" data-tools-action="close" aria-label="${t('close')}">×</button></div>
    <div class="tools-quick">${item('settings', t('settings'))}${item('fullscreen', pair('Tam ekran', 'Fullscreen'))}${item('compact', pair('Kompakt', 'Compact'))}${item('lock', pair('Kilit', 'Lock'))}</div>
    <div class="tools-menu-scroll">
    <section id="tools-status" class="tools-status" role="status" hidden></section>
    <h3>${pair('Paneller', 'Panels')}</h3>
    <div class="tools-links">${item('pets', pair('Pet rehberi', 'Pet guide'))}${item('radar-details', 'Radar')}${item('playback', 'Replay')}${item('team', pair('Takım cooldown’ları', 'Team cooldowns'))}${item('calendar', pair('Etkinlikler', 'Events'))}${item('cube', pair('Küp sesi', 'Cube audio'))}${item('character', pair('Karakterim', 'My character'))}${item('history', pair('Geçmiş', 'History'))}${item('records', pair('Rekorlar', 'Personal bests'))}${item('community', pair('Sıralama ve paylaşım', 'Rankings and sharing'))}</div>
    <h3>${pair('Ayrı pencereler', 'Separate windows')}</h3><button type="button" class="text-button" data-overlay-controls>${pair('Pencere kontrolleri · Alt+E', 'Overlay controls · Alt+E')}</button>
    <div class="tools-toggles">${PANELS.filter(name => !['controls', 'damage'].includes(name)).map(name => [name, pair(...PANEL_TITLES[name])]).map(([name, label]) => `<label><input type="checkbox" data-overlay-panel="${name}"><span>${label}</span></label>`).join('')}</div>
    <p class="help">${pair('Her pencere ayrı açılır, sürüklenir ve boyutlanır; yerini hatırlar. Yalnızca okur, ayar değiştirmez.', 'Each window opens, moves and resizes on its own and remembers its place. It only reads and never changes a setting.')}</p>
    <div class="tools-links tools-templates">${Object.entries(TEMPLATE_LABELS).map(([name, [trLabel, enLabel]]) => item(`template-${name}`, `${pair('Düzen', 'Layout')}: ${pair(trLabel, enLabel)}`)).join('')}</div>
    <h3>${pair('Ana ekranda göster', 'Show in the meter')}</h3>
    <div class="tools-toggles">${[['dps', pair('DPS listesi', 'DPS roster')], ['pets', pair('Pet takibi', 'Pet tracker')], ['radar', 'Radar'], ['events', pair('Etkinlik saati', 'Event timer')], ['team', pair('Takım kısayolu', 'Team shortcut')], ['odyle', 'Odyle']].map(([name, label]) => `<label><input type="checkbox" data-hud-panel="${name}"><span>${label}</span></label>`).join('')}</div>
    <details class="tools-filters"><summary>${pair('Liste ve görünüm seçenekleri', 'Roster and display options')}</summary>
      <label class="field"><span>${pair('Hedefler', 'Targets')}</span><select data-tools-field="mode"><option value="all">${t('all')}</option><option value="boss">${t('boss')}</option><option value="both">${t('both')}</option></select></label>
      <label class="field"><span>${t('sort')}</span><select data-tools-field="sort"><option value="dps">DPS ↓</option><option value="damage">${t('damage')} ↓</option><option value="name">A–Z</option></select></label>
      <label class="field"><span>${pair('Hedef / İlk 10', 'Target / Top 10')}</span><select data-tools-field="target"></select></label>
      <label class="field"><span>${t('summaryScope')}</span><select data-tools-field="damageScope">${['personal', 'party', 'observed'].map(value => `<option value="${value}">${t(value)}</option>`).join('')}</select></label>
      <label class="check-field"><input type="checkbox" data-tools-field="showTargetName">${pair('Hedef adını göster', 'Show target name')}</label>
      <label class="check-field"><input type="checkbox" data-tools-field="showTargetHealth">${pair('Hedef canını göster', 'Show target health')}</label>
      <label class="check-field"><input type="checkbox" data-tools-field="hudDetailRows">${pair('Satır ayrıntıları · sınıf, yüzde ve cooldown', 'Row details · class, share and cooldown')}</label>
    </details>
    <div class="tools-links tools-more">${item('training', t('trainingTitle'))}${item('diagnostics', pair('Durum ve tanı', 'Status and diagnostics'))}<button type="button" class="tools-support" data-tools-action="support">☕ Buy me a coffee</button></div>
    </div>`;
}

function renderToolsMenu() {
  if (!toolsOpen) return;
  const host = $('#tools-menu');
  if (toolsLocale !== prefs.locale || !host.childElementCount) { host.innerHTML = toolsMenuContent(); toolsLocale = prefs.locale; }
  setAttribute(host, 'aria-label', $('#tools-button').title);
  const status = $('#tools-status'), notice = $('#notice');
  status.hidden = notice.hidden;
  setText(status, notice.title || notice.textContent);
  setAttribute(host.querySelector('[data-tools-action="lock"]'), 'aria-pressed', String(prefs.locked));
  setAttribute(host.querySelector('[data-tools-action="compact"]'), 'aria-pressed', String(prefs.compactStrip));
  for (const input of host.querySelectorAll('[data-overlay-panel]')) { input.checked = overlayOpen.has(input.dataset.overlayPanel); input.disabled = !native; if (!native) input.title = prefs.locale === 'tr' ? 'Yalnızca masaüstü uygulamasında' : 'Desktop app only'; }
  for (const input of host.querySelectorAll('[data-hud-panel]')) {
    const name = input.dataset.hudPanel;
    input.checked = name === 'dps' ? prefs.displayModules.dps : name === 'radar' ? prefs.radarOpen : hudPanelVisible(prefs, name) && (name !== 'pets' || prefs.showPetTracker);
  }
  for (const input of host.querySelectorAll('[data-tools-field]')) {
    const name = input.dataset.toolsField;
    if (name === 'target') { const select = $('#target-board-select'); if (input._options !== select.innerHTML && document.activeElement !== input) { input.innerHTML = select.innerHTML; input._options = select.innerHTML; } if (document.activeElement !== input) input.value = select.value; }
    else if (input.type === 'checkbox') input.checked = prefs[name] === true;
    else if (document.activeElement !== input) input.value = prefs[name];
    if (name === 'sort') input.disabled = $('#sort').disabled;
  }
  scheduleOverlayRegions();
}

function closeTools({ focus = true } = {}) {
  if (!toolsOpen) return;
  toolsOpen = false; $('#tools-menu').hidden = true; setAttribute($('#tools-button'), 'aria-expanded', 'false');
  if (focus) $('#tools-button').focus({ preventScroll: true });
  let transition;
  if (toolsExpanded) { toolsExpanded = false; applyAppearance(); transition = syncNativePanel(false); }
  scheduleOverlayRegions();
  return transition;
}

// Which detached windows are open, asked of the desktop whenever the tools menu opens.
const overlayOpen = new Set();
async function readOverlays(list) {
  try { list ??= native ? await invoke('list_overlays') : []; } catch { list = []; }
  overlayOpen.clear(); for (const panel of Array.isArray(list) ? list : []) overlayOpen.add(String(panel));
  renderToolsMenu();
}
async function toggleOverlay(panel, open) {
  try { await readOverlays(await action('set_overlay', { panel, open })); } catch { await readOverlays(); }
}

// A layout opens the windows a kind of play needs and closes the others.
async function applyTemplate(name) {
  if (!native) { toast(t('nativeOnly')); return; }
  try {
    for (const { panel, open } of templatePlan(name)) if (open !== overlayOpen.has(panel)) await invoke('set_overlay', { panel, open });
    await readOverlays();
    toast(t('saved'));
  } catch (error) { toast(`${t('failed')}: ${String(error).slice(0, 120)}`, true); }
}

function openTools() {
  if (toolsOpen) { closeTools(); return; }
  toolsOpen = true; $('#tools-menu').hidden = false; setAttribute($('#tools-button'), 'aria-expanded', 'true');
  if (prefs.compactStrip && prefs.displayModules.dps) { toolsExpanded = true; applyAppearance(); syncNativePanel(true); }
  renderToolsMenu(); $('#tools-menu [data-tools-action]')?.focus({ preventScroll: true });
  readOverlays();
}

function openToolPanel(section) {
  const module = { pets: 'pets', radar: 'pets', team: 'team', calendar: 'events', cube: 'cube', playback: 'dps', history: 'dps', records: 'dps', community: 'dps' }[section];
  if (module && !prefs.displayModules[module]) savePreferences({ displayModules: { ...prefs.displayModules, [module]: true } });
  snapshot = null;
  if (section === 'pets') openPetGuide();
  else if (section === 'character') openDrawer('character');
  else if (section === 'calendar' || section === 'cube') openDrawer('settings', section === 'cube' ? 'hiddenCube' : 'calendar');
  else openDrawer('analysis', section);
}

function renderLatency() {
  const chip = $('#latency-chip');
  if (!chip) return;
  chip.hidden = (!native && !telemetryDemo) || !(state.capture.game_connections > 0);
  const value = telemetryDemo ? { ...state.capture.network_latency, status: 'ready', observed_at_ms: Date.now(), sampled_at_ms: Date.now() } : state.capture.network_latency;
  const view = latencyPresentation(state.capture.status === 'capturing' ? value : { status: 'unavailable' }, { locale: prefs.locale });
  setText(chip, view.label);
  chip.title = view.detail;
  chip.dataset.fresh = String(view.fresh);
  chip.setAttribute('aria-label', `TCP RTT · ${view.label} · ${view.detail}`);
}

function renderTargetVitals(target, vital) {
  const tr = prefs.locale === 'tr', box = $('#target-vitals'), track = $('#target-hp-track');
  const visible = prefs.showTargetHealth && Boolean(target);
  box.hidden = !visible; $('#meter').classList.toggle('has-target-vitals', visible);
  if (!visible) return;
  box.dataset.status = vital.status; box.dataset.maximumKnown = String(vital.percent !== null);
  const value = vital.current === null ? (tr ? 'Can bilgisi bekleniyor' : 'Waiting for HP') : `${num(vital.current)}${vital.max > 0 ? ` / ${num(vital.max)}` : ''}`;
  const suffix = vital.status === 'stale' ? (tr ? ' · son alınan' : ' · last received') : vital.status === 'unknown' && vital.current !== null ? (tr ? ' · güncelliği bilinmiyor' : ' · freshness unknown') : vital.status === 'dead' ? (tr ? ' · yenildi' : ' · defeated') : '';
  setText($('#target-hp'), `${value}${suffix}`);
  setText($('#target-hp-percent'), vital.percent !== null ? `${Number(vital.percent.toFixed(1))}%` : '—');
  box.title = `${displayTargetName(target, prefs.locale)} · ${vital.current === null ? value : fullNumber(vital.current)}${vital.max > 0 ? ` / ${fullNumber(vital.max)}` : ` · ${t('maxUnknown')}`}${vital.observedAtMs ? ` · ${dateText(vital.observedAtMs)}` : ''}`;
  track.hidden = false; track.setAttribute('aria-label', tr ? 'Hedef canı' : 'Target HP');
  track.setAttribute('aria-valuetext', $('#target-hp').textContent);
  if (vital.percent !== null) track.setAttribute('aria-valuenow', vital.percent.toFixed(2)); else track.removeAttribute('aria-valuenow');
  track.querySelector('b').style.width = `${vital.percent ?? 100}%`;
}

Object.assign(words.tr, { records: 'Rekorlar' });
Object.assign(words.en, { records: 'Personal bests' });

function renderRecordNotice() {
  const notice = recordNotifier.update(state.personal_bests, { now: Date.now(), mode: prefs.recordNotifications, visible: prefs.displayModules.dps && !prefs.compactStrip && !drawer });
  const host = $('#record-notice'); host.hidden = !notice;
  if (!notice) return;
  const view = recordPresentation(notice, { locale: prefs.locale, hideNames: prefs.hidePlayerNames, precision: prefs.numberPrecision });
  for (const [id, value] of Object.entries({ title: view.title, name: view.name, label: view.label, value: view.value, gain: `${view.previous} → ${view.gain}` })) setText($(`#record-notice-${id}`), value);
  $('#dismiss-record').setAttribute('aria-label', prefs.locale === 'tr' ? 'Rekor bildirimini kapat' : 'Dismiss record notice');
  host.title = [view.label, view.detail].filter(Boolean).join(' · ');
}

async function readRecords() {
  if (!native || recordsPending || Date.now() < recordsRetryAt) return;
  recordsPending = true; recordsRetryAt = Date.now() + 1000;
  try {
    const value = recordSnapshot(await invoke('get_personal_bests'));
    if (value.revision >= recordData.revision) recordData = value;
  } catch { recordsRetryAt = Date.now() + 5000; recordData = { ...recordData, storage_error: 'read-unavailable' }; }
  finally { recordsPending = false; if (drawer === 'analysis' && tab === 'records') refreshDrawer(); }
}
function recordsContent() {
  return renderRecords(recordData, { locale: prefs.locale, hideNames: prefs.hidePlayerNames, precision: prefs.numberPrecision, metric: recordMetric, query: recordQuery });
}

function renderMeter() {
  renderRecordNotice();
  if (telemetryDemo) state.actor_cooldowns = state.actor_cooldowns.map(row => ({ ...row, sampled_at_ms: Date.now() }));
  localizeControls();
  const status = connectionStatus(state, { native, demo, locale: prefs.locale });
  const connection = $('#connection');
  for (const tone of ['demo', 'live', 'error', 'warning']) connection.classList.toggle(tone, status.tone === tone);
  connection.dataset.status = status.kind;
  setText(connection.querySelector('span'), status.label);
  connection.title = `${status.message}\n${status.detail}`;
  renderLatency();
  const scopes = meterScopes(state, prefs);
  const targetView = worldTargetPresentation(state, { now: demo && targetDemo ? state.focused_target_observed_at_ms ?? state.observed_targets[0]?.last_hit_ms ?? Date.now() : Date.now(), autoBossRoster: prefs.autoTargetRoster, damageScope: prefs.damageScope, selectedTargetId: selectedBoardTargetId, previousFocus: automaticTargetFocus });
  automaticTargetFocus = targetView.focusMemory || null;
  const board = targetView.roster;
  renderedTargetBoard = board;
  const targetScoped = Boolean(board || prefs.autoTargetRoster && targetView.target?.damage > 0 && targetView.target.elapsed_ms !== null);
  const targetMetrics = targetScoped ? targetSummary(targetView.target, state, prefs.damageScope) : null;
  const measurement = combatMeasurement(state, prefs, { summary: scopes.summary, boardSummary: targetMetrics, board: targetScoped });
  renderTargetBoardControls(measurement);
  const selectedSummary = targetScoped ? { ...scopes.summary, known: targetMetrics.known, damage: targetMetrics.totalDamage, dps: targetMetrics.dps, elapsed: targetMetrics.elapsedMs, targets: [targetView.target] } : scopes.summary;
  const scoped = measurement.suppressSummary ? { ...selectedSummary, known: false } : selectedSummary;
  const boardPlayers = board ? [...board.rows] : [];
  if (board?.own && board.ownRank > 10 && !boardPlayers.some(player => player.id === board.own.id)) boardPlayers.push({ ...board.own, rank: board.ownRank, beyondTopTen: true });
  const ownSummary = targetScoped ? targetSummary(targetView.target, state, 'personal') : null;
  const solo = !board && targetScoped && ownSummary?.evidence === 'received-own' ? targetView.target.own_participant : null;
  const roster = board ? { known: true, players: boardPlayers, damage: board.totalDamage, dps: board.dps, elapsed: board.elapsedMs, ranked: true } : solo ? { known: true, players: [{ ...solo, is_local: true }], damage: targetView.target.damage, dps: targetView.target.damage / Math.max(targetView.target.elapsed_ms / 1000, 1), elapsed: targetView.target.elapsed_ms } : scopes.roster;
  const targetOption = $('#damage-scope option[value=target]');
  targetOption.hidden = !targetScoped; targetOption.disabled = targetOption.hidden;
  targetOption.textContent = board ? (prefs.locale === 'tr' ? 'Hedef · 10' : 'Target · 10') : prefs.locale === 'tr' ? 'Seçili hedef' : 'Selected target';
  if (targetScoped) $('#damage-scope').value = 'target';
  $('#sort').disabled = Boolean(board); $('#sort').title = board ? (prefs.locale === 'tr' ? 'Bu hedefe verilen hasara göre ilk 10' : 'Top ten by damage to this target') : t('sort');
  $('#target-roster-strip').hidden = !targetScoped;
  if (targetScoped) {
    setText($('#target-roster-label'), board ? `${board.kind === 'boss' ? 'Boss' : prefs.locale === 'tr' ? 'Ortak hedef' : 'Shared target'} · ${prefs.locale === 'tr' ? 'Gözlenen İlk 10' : 'Observed Top 10'}` : prefs.locale === 'tr' ? 'Hedef DPS' : 'Target DPS');
    setText($('#target-roster-coverage'), board ? `${board.participantCount ?? board.rows.length} ${prefs.locale === 'tr' ? 'oyuncu · alınan veri' : 'players · received data'}${board.complete ? '' : prefs.locale === 'tr' ? ' · kısmi' : ' · partial'}` : prefs.locale === 'tr' ? 'Alınan katkı' : 'Received contribution');
    $('#target-roster-strip').title = prefs.locale === 'tr' ? 'Seçili hedefe bağlantında alınan katkılar. Dünya bosslarında diğer oyuncuların doğrudan vuruşları gönderilmeyebilir; eksiksiz sunucu sıralaması değildir.' : 'Received contributions to the selected target. World bosses may not broadcast other players’ direct hits; this is not a complete server ranking.';
    renderTargetDpsPanel(targetView);
  }
  for (const [scope, original] of Object.entries(scopes.summaries)) {
    const observed = targetScoped ? targetSummary(targetView.target, state, scope) : null;
    const summary = observed ? { known: observed.known, dps: observed.dps, damage: observed.totalDamage } : original;
    const summaryKnown = summary.known && !(measurement.kind === 'boss-filter' && !summary.damage) && observed?.evidence !== 'no-observed-contribution';
    const node = $(`[data-summary-scope="${scope}"]`);
    if (!node) continue;
    setText(node.querySelector('small'), t({personal:'shortPersonal', party:'shortParty', observed:'shortObserved'}[scope]));
    setText(node.querySelector('strong'), summaryKnown ? rate(summary.dps) : '—');
    node.title = `${targetScoped ? `${displayTargetName(targetView.target, prefs.locale)} · ` : ''}${t(`${scope}Dps`)}: ${summaryKnown ? rate(summary.dps) : measurementMessage(measurement, targetView) || t(scope === 'party' ? 'partyUnknown' : 'characterUnknown')} · ${t('totalCaption')}: ${summaryKnown ? num(summary.damage) : '—'}`;
  }
  const targets = prefs.mode === 'boss' ? scoped.targets.filter(target => target.is_boss) : scoped.targets;
  const topTarget = targetHeaderTarget(state, targetView.target, targets);
  $('#target-name').textContent = topTarget ? displayTargetName(topTarget, prefs.locale) : '—'; $('#target-name').title = topTarget ? displayTargetName(topTarget, prefs.locale) : '';
  $('#target-name').hidden = !prefs.showTargetName;
  renderTargetVitals(topTarget, targetView.target ? targetView.vital : targetVital(topTarget, Date.now()));
  $('#combat-time').textContent = clockTime(scoped.elapsed); $('#dps-value').textContent = scoped.known ? rate(scoped.dps) : '—'; $('#dps-value').title = scoped.known && scoped.dps !== null ? `${fullNumber(scoped.dps)}/${prefs.locale === 'tr' ? 'sn' : 's'}` : measurementMessage(measurement, targetView) || t('chooseCharacter');
  $('#combat-time').title = prefs.locale === 'tr' ? `${targetScoped ? 'Seçili hedefin ortak süresi' : 'Seçili kapsamın savaş süresi'} · ${fullNumber(scoped.elapsed / 1000)} sn` : `${targetScoped ? 'Selected target’s common duration' : 'Selected scope’s combat duration'} · ${fullNumber(scoped.elapsed / 1000)} s`;
  $('#damage-value').textContent = scoped.known ? num(scoped.damage) : '—'; $('#damage-value').title = scoped.known ? fullNumber(scoped.damage) : measurementMessage(measurement, targetView) || t('chooseCharacter');
  if (targetScoped && prefs.layout !== 'cupertino') { setText($('#dps-label'), `${t(`${prefs.damageScope}Dps`)} · ${prefs.locale === 'tr' ? 'HEDEF' : 'TARGET'}`); setText($('#damage-label'), `${t(`${prefs.damageScope}Damage`)} · ${prefs.locale === 'tr' ? 'HEDEF' : 'TARGET'}`); }
  for (const selector of ['#dps-value', '#damage-value']) $(selector).parentElement.style.setProperty('--metric-length', Math.max(4, $(selector).textContent.length));
  $('#mode-caption').textContent = targetScoped ? (prefs.locale === 'tr' ? 'Seçili hedef' : 'Selected target') : t(prefs.mode === 'both' ? 'bothCaption' : prefs.mode === 'boss' ? 'bossCaption' : 'allCaption');
  $('#boss-summary').hidden = targetScoped || prefs.mode !== 'both'; $('#boss-summary').textContent = `${t('bossTotal')} ${num(scoped.targets.filter(target => target.is_boss).reduce((sum, target) => sum + target.damage, 0))}`;
  const notice = $('#notice'); notice.hidden = false;
  for (const tone of ['demo', 'error', 'warning']) notice.classList.toggle(tone, status.tone === tone);
  const scopeMessage = !prefs.displayModules.dps ? '' : measurementMessage(measurement, targetView) || (board ? '' : scopes.fallback ? t('partyFallback') : !roster.known ? t(prefs.rosterScope === 'party' ? 'partyUnknown' : 'characterUnknown') : '');
  setText(notice, scopes.fallback ? `${scopeMessage} ${status.message}` : scopeMessage && ['traffic', 'combat', 'combat_active', 'demo', 'paused'].includes(status.kind) ? scopeMessage : status.message);
  notice.title = `${scopeMessage ? `${scopeMessage}\n` : ''}${status.message}\n${status.detail}`;
  $('#damage-scope').title = targetScoped ? $('#target-roster-strip').title : scopes.fallback ? t('partyFallback') : t('rosterScope');
  $('#players').setAttribute('aria-label', targetScoped ? $('#target-roster-label').textContent : t(scopes.fallback ? 'rosterObserved' : { personal: 'rosterPersonal', party: 'rosterParty', observed: 'rosterObserved' }[prefs.rosterScope]));
  if (roster.players.length && !scopeMessage && ['traffic', 'combat', 'combat_active'].includes(status.kind)) notice.hidden = true;
  if (prefs.displayModules.dps && state.diagnostics.ambiguous_periodic_events > 0) { notice.hidden = false; notice.classList.add('warning'); setText(notice, `${prefs.locale === 'tr' ? 'Ölçüm kısmi: belirsiz NPC tetikleyicileri hasara katılmadı' : 'Partial measurement: ambiguous NPC procs excluded from damage'} · ${fullNumber(state.diagnostics.ambiguous_periodic_events)}`); }
  const canDiagnose = native && !notice.hidden && status.tone === 'error';
  notice.dataset.diagnostics = String(canDiagnose);
  notice.setAttribute('role', canDiagnose ? 'button' : 'status'); notice.tabIndex = canDiagnose ? 0 : -1;
  if (canDiagnose) setText(notice, `${notice.textContent} · ${prefs.locale === 'tr' ? 'Tanı ↗' : 'Diagnostics ↗'}`);
  if (!canDiagnose && prefs.displayModules.dps && measurement.kind === 'boss-filter') {
    notice.hidden = false; notice.classList.add('warning');
    setText(notice, measurementMessage(measurement, targetView));
  }
  const compactStatus = $('#compact-status');
  compactStatus.hidden = notice.hidden;
  setText(compactStatus, status.kind === 'demo' ? 'DEMO' : '!');
  compactStatus.dataset.tone = status.tone;
  compactStatus.title = notice.title = [...new Set([notice.textContent, status.message, status.detail].filter(Boolean))].join('\n');
  setAttribute(compactStatus, 'aria-label', `${prefs.locale === 'tr' ? 'Ölçüm durumu' : 'Measurement status'}: ${notice.textContent}`);
  setText($('#compact-summary-label'), prefs.locale === 'tr' ? {personal:'Sen', party:'Takım', observed:'Yakın'}[prefs.damageScope] : {personal:'You', party:'Party', observed:'Nearby'}[prefs.damageScope]);
  setText($('#compact-summary-rate'), $('#dps-value').textContent);
  setText($('#compact-summary-damage'), $('#damage-value').textContent);
  $('#compact-summary').title = `${$('#dps-label').textContent}: ${$('#dps-value').textContent} · ${$('#damage-label').textContent}: ${$('#damage-value').textContent}`;
  const rosterCaption = targetScoped ? (prefs.locale === 'tr' ? 'Hedef' : 'Target') : prefs.rosterScope === 'personal' ? (prefs.locale === 'tr' ? 'Sen' : 'You') : prefs.rosterScope === 'party' && !scopes.fallback ? (prefs.locale === 'tr' ? 'Takım' : 'Party') : (prefs.locale === 'tr' ? 'Yakın' : 'Nearby');
  setText($('#clear-roster-summary'), `${rosterCaption} ${roster.known ? rate(roster.dps) : '—'}`);
  $('#clear-roster-summary').title = targetScoped ? $('#target-roster-strip').title : $('#damage-scope').title;
  $('#meter').dataset.targetScoped = String(targetScoped);
  renderToolsMenu();
  renderPlayers(status, roster);
  const actualList = $('#actual-cooldowns'), nextCooldownFingerprint = JSON.stringify([prefs.locale, state.cooldowns.map(row => [row.actor_id, row.skill_id, row.raw_remaining_units, row.observed_at_ms, row.readiness, row.estimated_rate_units_per_ms, row.charges, row.charges_observed_at_ms])]);
  if (actualList && nextCooldownFingerprint !== cooldownFingerprint) actualList.innerHTML = actualCooldownCards();
  cooldownFingerprint = nextCooldownFingerprint;
  tickTimers();
  if (drawer === 'analysis' && ['overview', 'skills'].includes(tab) && !snapshot && !$('#drawer-content').contains(document.activeElement)) refreshDrawer();
  if (drawer === 'character' && !$('#drawer-content').contains(document.activeElement)) refreshDrawer();
  if (drawer === 'analysis' && tab === 'training') updateTrainingLive();
  renderLatency();
  renderCombatWarning();
  renderSkillBoard();
  renderPvp();
  renderCombatChips();
  alignColumnHeadings();
  renderCubeLive();
  renderLiveTools();
  updateTeamLive();
  if (drawer === 'analysis' && tab === 'effects') renderEffectLists();
}

function measurementMessage(measurement, targetView) {
  const tr = prefs.locale === 'tr';
  const messages = tr ? {
    'boss-filter': `${state.encounter_active ? 'Hasar alındı' : 'Karşılaşma kaydı var'}; Boss filtresi bu hedefi gizliyor. Tümü’ne geç veya hedef seç.`,
    'identity-pending': 'Karakter kimliği bekleniyor; gözlenen hasar kişisel toplamına eklenmez.',
    'party-pending': 'Grup üyeleri henüz doğrulanmadı; yakındaki oyuncular grup sayılmaz.',
    'contribution-pending': 'Bu kapsamın hasar verisi henüz alınmadı.',
    'contribution-missing': 'Bu hedefte kişisel katkın henüz alınmadı; gözlenen ilk 10 gösteriliyor.',
    'decoding-pending': 'Oyun paketleri geliyor; çözülen savaş çerçevesi henüz yok.',
    'damage-pending': 'Veri çözülüyor; desteklenen bir hasar olayı henüz alınmadı.',
    'outgoing-pending': 'Bu karşılaşmada doğrulanmış giden PvE hasarı henüz yok.',
  } : {
    'boss-filter': `${state.encounter_active ? 'Damage received' : 'Encounter data retained'}; the Boss filter hides this target. Switch to All or select a target.`,
    'identity-pending': 'Waiting for character identity; nearby damage is excluded from your personal total.',
    'party-pending': 'Party membership is unconfirmed; nearby players are not treated as your party.',
    'contribution-pending': 'Damage for this scope has not been received yet.',
    'contribution-missing': 'Your contribution to this target has not been received; showing the observed Top 10.',
    'decoding-pending': 'Game packets received; no decoded combat frames yet.',
    'damage-pending': 'Data is decoding; no supported damage event received yet.',
    'outgoing-pending': 'No confirmed outgoing PvE damage in this encounter yet.',
  };
  if (messages[measurement.kind]) return messages[measurement.kind];
  if (!targetView.roster && targetView.observedCandidateCount > 1) return tr ? 'Birden fazla ortak savaş alınıyor. İlk 10 için hedef seç.' : 'Several shared fights are being received. Choose a target for Top 10.';
  return '';
}

function renderTargetDpsPanel(view) {
  const tr = prefs.locale === 'tr', own = targetSummary(view.target, state, 'personal'), observed = targetSummary(view.target, state, 'observed');
  const ownKnown = own?.known && own.evidence !== 'no-observed-contribution';
  setText($('#target-total-caption'), tr ? 'HEDEF DPS' : 'TARGET DPS');
  setText($('#target-total-rate'), observed?.known ? rate(observed.dps) : '—');
  setText($('#target-total-damage'), observed?.known ? `${num(observed.totalDamage)} ${tr ? 'hasar' : 'damage'}` : '—');
  setText($('#target-personal-caption'), tr ? 'KİŞİSEL DPS' : 'PERSONAL DPS');
  setText($('#target-personal-rate'), ownKnown ? rate(own.dps) : '—');
  setText($('#target-personal-rank'), view.roster?.ownRank ? `${tr ? 'Sıran' : 'Your rank'} ${view.roster.ownRank} / ${view.roster.participantCount ?? '—'}` : ownKnown ? `${num(own.totalDamage)} ${tr ? 'hasar' : 'damage'}` : own?.evidence === 'no-observed-contribution' ? (tr ? 'Katkın alınmadı' : 'Contribution not received') : (tr ? 'Kimlik / katkı bekleniyor' : 'Identity / contribution pending'));
  $('#target-dps-panel').dataset.source = view.focusSource;
  $('#target-dps-panel').title = tr ? `Yalnız seçili hedef · ortak ${clockTime(observed?.elapsedMs ?? 0)} süre. ${view.focusSource === 'observed-shared-target' ? 'Yakında alınan tek ortak savaş; kişisel hedef veya boss sınıfı doğrulanmadı.' : 'Hedefin kendi hasarı ve katkı sıralaması.'}` : `Selected target only · common ${clockTime(observed?.elapsedMs ?? 0)} duration. ${view.focusSource === 'observed-shared-target' ? 'Single received shared fight; personal targeting and boss classification are unconfirmed.' : 'This target’s received damage and contributor ranks.'}`;
}

function renderTargetBoardControls(measurement = {}) {
  const tr = prefs.locale === 'tr', select = $('#target-board-select'), choices = targetBoardChoices(state);
  $('#target-board-controls').hidden = !choices.length && !selectedBoardTargetId && measurement.kind !== 'boss-filter';
  $('#show-all-targets').hidden = measurement.kind !== 'boss-filter';
  setText($('#show-all-targets'), tr ? 'Tümü’ne geç' : 'Show All');
  const value = selectedBoardTargetId ? `target:${selectedBoardTargetId}` : prefs.autoTargetRoster ? 'auto' : 'off';
  setText($('#target-board-caption'), tr ? 'Hedef · İlk 10' : 'Target · Top 10');
  setText($('#dps-view-button'), tr ? 'DPS’i aç' : 'Show DPS'); $('#dps-view-button').hidden = prefs.displayModules.dps;
  $('#dps-view-button').title = tr ? 'Pet takibini koruyarak DPS görünümünü aç' : 'Show DPS while keeping pet tracking';
  const options = `<option value="auto">${tr ? 'Otomatik · hedef / ortak savaş' : 'Auto · target / shared fight'}</option><option value="off">${tr ? 'Kapalı · oyuncu listesi' : 'Off · player roster'}</option>${choices.map((target, index) => `<option value="target:${esc(target.id)}">${esc(displayTargetName(target, prefs.locale))} · ${target.participant_count} ${tr ? 'kişi' : 'players'}${!target.name || /^#|^Target\s|^NPC\s/iu.test(target.name) ? ` · ${index + 1}` : ''}</option>`).join('')}${selectedBoardTargetId && !choices.some(target => String(target.id) === selectedBoardTargetId) ? `<option value="${esc(value)}">${tr ? 'Hedef verisi bekleniyor' : 'Waiting for target data'}</option>` : ''}`;
  if (select._options !== options && document.activeElement !== select) { select.innerHTML = options; select._options = options; }
  if (document.activeElement !== select) select.value = value;
  select.title = tr ? 'Aynı hedefe verilen gözlenen hasar. Parti gerekmez. Her hedefin kendi süresi kullanılır.' : 'Observed damage to one target. No party required. Each target uses its own duration.';
}

function renderPlayers(status, scoped) {
  const main = mainRoster(scoped.players.filter(rosterEligible), state, { scope: scoped.scope || prefs.rosterScope, ranked: scoped.ranked });
  scoped = { ...scoped, players: main.players };
  const container = $('#players');
  const context = `${state.encounter_started_ms ?? ''}:${prefs.rosterScope}:${Boolean(scoped.ranked)}:${selectedBoardTargetId ?? 'auto'}`;
  if (context !== rosterContext) { $('.roster-list').scrollTop = 0; rosterContext = context; }
  container.dataset.unclassified = String(main.unclassifiedCount);
  const unnamed = unnamedSourcesNotice(main.unclassifiedCount, main.unclassifiedDamage, prefs.locale, num), unnamedHost = $('#roster-unnamed');
  unnamedHost.hidden = !unnamed;
  if (unnamed) { setText(unnamedHost, unnamed.text); unnamedHost.title = unnamed.title; }
  container.title = main.unclassifiedCount ? (prefs.locale === 'tr' ? `${main.unclassifiedCount} oyuncu kimliği doğrulanmamış kaynak ana listeden ayrıldı. Alınan hasar Analiz’de korunur.` : `${main.unclassifiedCount} sources without player identity are kept in Analysis, outside the player roster.`) : '';
  const cooldownMembers = new Map(automaticTeamState(state).members.map(member => [member.actor_id, member]));
  if (!scoped.players.length) {
    deferredRosterRefresh = reconcileKeyedRows(container, [status], {
      key: () => 'empty',
      create: () => { const row = document.createElement('div'); row.className = 'empty'; row.innerHTML = '<span class="empty-symbol" aria-hidden="true">◈</span><strong></strong><span class="empty-help"></span>'; return row; },
      update: row => { setText(row.querySelector('strong'), t(!scoped.known ? 'chooseCharacter' : prefs.rosterScope === 'personal' ? 'personalWaiting' : prefs.rosterScope === 'party' ? 'partyWaiting' : 'emptyTitle')); setText(row.querySelector('.empty-help'), !scoped.known ? t(prefs.rosterScope === 'party' ? 'partyUnknown' : 'characterUnknown') : status.message); },
    }) === false;
    scheduleRosterFit(); return;
  }
  const maxDps = Math.max(...scoped.players.map(player => player.dps), 1), minimumDps = Math.min(...scoped.players.map(player => player.dps));
  const occurrences = new Map();
  // At a world boss the list is the ten who did the most per second (and you), not everyone who swung once.
  const capped = capRoster(scoped.ranked ? scoped.players : sortedPlayers(scoped.players, prefs.sort), { limit: prefs.rosterLimit, isOwn: player => player.is_local === true || player.id === state.local_player_id });
  const more = $('#roster-more');
  more.hidden = capped.hidden === 0;
  if (capped.hidden) setText(more, prefs.locale === 'tr' ? `+${capped.hidden} oyuncu daha · en çok DPS yapan ${prefs.rosterLimit} kişi gösteriliyor` : `+${capped.hidden} more players · showing the ${prefs.rosterLimit} with the most DPS`);
  const players = capped.rows.map(player => {
    const base = player.id || `${player.name}:${player.class_name}`;
    const occurrence = occurrences.get(base) || 0; occurrences.set(base, occurrence + 1);
    return { player, key: `player:${base}:${occurrence}` };
  });
  deferredRosterRefresh = reconcileKeyedRows(container, players, {
    key: item => item.key,
    create: () => {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'player';
      row.innerHTML = '<span class="player-bar" aria-hidden="true"></span><span class="rank"></span><span class="player-main"><span class="player-name-line"><span class="player-class-icon" aria-hidden="true"></span><span class="player-name"></span><span class="own-tag"></span></span><span class="player-class"><i class="class-dot" aria-hidden="true"></i><span class="player-class-name"></span></span><span class="player-cooldown"></span></span><span class="player-stats"><span class="player-numbers"><span class="player-damage"></span><span class="player-dps"></span></span><span class="player-share"></span></span>';
      return row;
    },
    update: (row, { player }, index) => {
      const color = classColor(player.class_name), share = String(Math.min(1, player.dps / maxDps));
      const barColor = playerBarColor(player, maxDps, prefs.rowColorMode, (prefs.theme === 'custom' ? prefs.customColors : THEMES[prefs.theme]).accent, minimumDps);
      if (row.style.getPropertyValue('--bar-color') !== barColor) row.style.setProperty('--bar-color', barColor);
      if (row.style.getPropertyValue('--class-color') !== color) row.style.setProperty('--class-color', color);
      if (row.style.getPropertyValue('--share') !== share) row.style.setProperty('--share', share);
      setAttribute(row, 'data-player', player.id);
      setAttribute(row, 'aria-disabled', String(player.pending_actor === true || player.pending_combat === true));
      row.dataset.targetScoped = String(Boolean(scoped.ranked));
      const own = player.is_local || player.id === state.local_player_id;
      row.classList.toggle('is-own', own); row.querySelector('.own-tag').hidden = !own; setText(row.querySelector('.own-tag'), t('me'));
      const classLabel = /^unknown$/i.test(player.class_name) || player.class_name === '—' ? (prefs.locale === 'tr' ? 'Sınıf bekleniyor' : 'Class pending') : player.class_name;
      const pendingName = player.identity_pending === true || player.identity_confirmed !== true && /^#\d+$/u.test(player.name);
      const visibleName = prefs.hidePlayerNames && !own ? `${classLabel} · ${index + 1}` : displayPlayerName(player, prefs.locale);
      const icon = row.querySelector('.player-class-icon'), symbol = classIcon(player.class_name);
      if (icon._symbol !== symbol) { icon.innerHTML = symbol; icon._symbol = symbol; }
      icon.title = classLabel;
      row.classList.toggle('identity-pending', pendingName); row.classList.toggle('beyond-top-ten', player.beyondTopTen === true || own && capped.hidden > 0 && capped.ranks.get(player) > prefs.rosterLimit);
      row.querySelector('.player-name').title = prefs.hidePlayerNames && !own ? visibleName : pendingName ? (prefs.locale === 'tr' ? 'Oyuncu adı kaydı bekleniyor; alındığında otomatik güncellenir.' : 'Waiting for a player-name record; updates automatically when received.') : player.name;
      setAttribute(row, 'aria-label', player.pending_combat ? `${visibleName}, ${classLabel}, ${prefs.locale === 'tr' ? 'Savaş verisi bekleniyor; DPS henüz alınmadı.' : 'Waiting for combat data; DPS not received yet.'}` : `${visibleName}, ${classLabel}, ${playerMetricLabel(player, prefs.rowMetric, prefs.locale, prefs.numberPrecision)}, ${t('analysis')}`);
      setText(row.querySelector('.rank'), scoped.ranked ? player.rank : own && capped.hidden && capped.ranks.get(player) > prefs.rosterLimit ? capped.ranks.get(player) : index + 1); setText(row.querySelector('.player-name'), visibleName);
      setText(row.querySelector('.player-class-name'), classLabel);
      const member = cooldownMembers.get(String(player.id)), cooling = member?.cooldowns.find(value => value.remaining_ms > 0 || value.recharge_remaining_ms > 0);
      const cooldownNode = row.querySelector('.player-cooldown'); cooldownNode.hidden = !prefs.displayModules.team || !prefs.showTeamCooldowns || !member?.cooldowns.length;
      setText(cooldownNode, cooling ? `CD · ${Math.ceil((cooling.remaining_ms || cooling.recharge_remaining_ms) / 1000)} ${prefs.locale === 'tr' ? 'sn' : 's'}` : member?.cooldowns.some(value => value.ready_confirmed) ? `CD · ${t('readyConfirmed')}` : 'CD · …');
      cooldownNode.title = member?.cooldowns.map(value => `${skillLabel(value.skill_id)} · ${value.remaining_ms === null ? '—' : `${Math.ceil(value.remaining_ms / 1000)} s`}`).join('\n') || '';
      setText(row.querySelector('.player-dps'), prefs.rowMetric === 'both' && prefs.layout !== 'cupertino' ? ` (${rate(player.dps)})` : rate(player.dps)); row.querySelector('.player-dps').title = `${t('rateCaption')}: ${fullNumber(player.dps)}/${prefs.locale === 'tr' ? 'sn' : 's'}`;
      setText(row.querySelector('.player-damage'), player.damage === null ? '—' : num(player.damage)); row.querySelector('.player-damage').title = `${t('totalCaption')}: ${player.damage === null ? '—' : fullNumber(player.damage)}`;
      const shareNode = row.querySelector('.player-share'); shareNode.hidden = !prefs.showShares;
      setText(shareNode, `${(playerShare(player, scoped.damage) * 100).toFixed(1)}%`);
    },
  }) === false;
  scheduleRosterFit();
}

function scheduleRosterFit() {
  if (rosterFitFrame) return;
  rosterFitFrame = requestAnimationFrame(() => {
    rosterFitFrame = 0;
    const meter = $('#meter'), list = $('.roster-list'), players = $('#players');
    const active = prefs.layout === 'cupertino' && prefs.displayModules.dps && !prefs.compactStrip && !isFullscreenDashboard(prefs) && !drawer;
    const otherHeight = [...list.children].filter(element => element !== players).reduce((sum, element) => {
      const rect = element.getBoundingClientRect(), css = getComputedStyle(element);
      return sum + (rect.height ? rect.height + (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0) : 0);
    }, 0);
    const available = Math.max(0, list.clientHeight - otherHeight);
    const fit = rosterFit({ count: active ? players.querySelectorAll('.player').length : 0, height: available, width: list.clientWidth,
      scale: prefs.textScale, density: prefs.density, both: prefs.rowMetric === 'both', details: prefs.hudDetailRows });
    const signature = JSON.stringify(fit);
    if (signature !== rosterFitSignature) {
      rosterFitSignature = signature; meter.dataset.fitRoster = String(fit.enabled); meter.dataset.fitDetails = String(fit.details === true); meter.dataset.fitSingle = String(fit.suppressDamage === true);
      if (fit.enabled) for (const [key, value] of Object.entries({ height: fit.rowHeight, gap: fit.gap, font: fit.font, icon: fit.icon, rate: fit.rateWidth, damage: fit.damageWidth })) meter.style.setProperty(`--fit-${key}`, `${value}px`);
    }
    if (fit.enabled && fit.fits) list.scrollTop = 0;
    if (drawer || prefs.fullscreenOverlay || prefs.compactStrip) { rosterMinimum = null; fitRequested = 0; return; }
    const minimum = fit.enabled ? Math.max(200, Math.min(800, Math.ceil(meter.getBoundingClientRect().height - available + fit.minimum + 1))) : 200;
    if (demo && sampleFrame) meter.style.minHeight = `${minimum}px`;
    if (native && minimum !== rosterMinimum) {
      rosterMinimum = minimum;
      invoke('set_roster_min_height', { height: minimum }).catch(() => { rosterMinimum = null; });
    }
    // The card is as tall as what it holds, so no invisible window is left over the game.
    if (native && active) {
      const natural = Math.ceil(meter.getBoundingClientRect().height - list.clientHeight + otherHeight + players.offsetHeight + 6);
      if (Math.abs(natural - fitRequested) > 6) { fitRequested = natural; invoke('fit_main_height', { height: natural }).catch(() => { fitRequested = 0; }); }
    }
    scheduleOverlayRegions();
  });
}

function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t('exported'));
}

async function readFile(file, maxBytes = 2 * 1024 * 1024) {
  if (!file) return '';
  if (file.size > maxBytes) throw new Error(t('fileLarge'));
  return file.text();
}

async function validateRasterDimensions(data) {
  if (!data) return;
  await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => image.width > 2048 || image.height > 2048 || !image.width || !image.height ? reject(new Error(t('invalidRaster'))) : resolve(); image.onerror = () => reject(new Error(t('invalidRaster'))); image.src = data; });
}

const field = (name, label, type = 'text', value = '', extra = '') => `<label class="field"><span>${t(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const SUPPORT_URL = 'https://buymeacoffee.com/12hrsofficp';
// Luma is free: a card with the way to buy its maker a coffee (the shell opens only this one address).
const supportCard = () => `<div class="support-card"><div><strong>☕ Buy me a coffee</strong><span>${prefs.locale === 'tr' ? 'Luma ücretsiz. Beğendiysen geliştiriciye bir kahve ısmarlayabilirsin.' : 'Luma is free. If you like it, you can buy its maker a coffee.'}</span></div><button type="button" class="support-button" data-action="support">☕ Buy me a coffee ↗</button></div>`;
const button = (actionName, label, extra = '', secondary = false) => `<button type="button" class="action-button${secondary ? ' secondary' : ''}" data-action="${actionName}" ${extra}>${t(label)}</button>`;
const source = label => `<span class="tag">${label || sourceLabel()}</span>`;
const empty = key => `<p class="help">${t(key)}</p>`;
const fontOptions = current => Object.keys(FONTS).map(key => `<option value="${key}" ${key === current ? 'selected' : ''}>${{system:'System',segoe:'Segoe UI',arial:'Arial',georgia:'Georgia',mono:'Consolas'}[key]}</option>`).join('');

function reportToolbar(all = false) {
  return `<div class="report-tools"><label class="field"><span>${t('reportFormat')}</span><select name="reportFormat"><option value="html" ${reportFormat === 'html' ? 'selected' : ''}>HTML</option><option value="csv" ${reportFormat === 'csv' ? 'selected' : ''}>CSV</option><option value="json" ${reportFormat === 'json' ? 'selected' : ''}>JSON</option></select></label><label class="check-field"><input name="reportAnonymize" type="checkbox" ${reportAnonymize ? 'checked' : ''}>${t('anonymize')}</label></div><p class="help">${t('reportScope')}: ${t(prefs.damageScope)} · ${t('reportHelp')}</p><div class="button-row">${button('export-current', 'exportCurrent')}${all ? button('export-history', 'exportAll', '', true) + button('import-history', 'importHistory', '', true) : ''}</div>`;
}

async function exportReport(records) {
  if (!records.length) { toast(t('missingHistory')); return; }
  try {
    const options = { scope: prefs.damageScope, anonymize: reportAnonymize, locale: prefs.locale };
    const content = ({ html: exportEncounterHtml, csv: exportEncounterCsv, json: exportEncounterJson }[reportFormat])(records, options);
    if (native) { const path = await action('export_document', { format: reportFormat, content }); toast(`${t('reportSaved')}: ${path}`); }
    else download(`luma-report.${reportFormat}`, content, { html: 'text/html', csv: 'text/csv', json: 'application/json' }[reportFormat]);
  } catch (error) { toast(error.message || t('invalidFile'), true); }
}

function appearanceSettingsContent() {
  return `<p class="settings-hint">${t('autoSaveHelp')}</p><label class="field"><span>${t('language')}</span><select name="locale"><option value="tr" ${prefs.locale === 'tr' ? 'selected' : ''}>Türkçe</option><option value="en" ${prefs.locale === 'en' ? 'selected' : ''}>English</option></select></label>
    <div class="field-grid"><label class="field"><span>${t('summaryScope')}</span><select name="damageScope">${['personal', 'party', 'observed'].map(value => `<option value="${value}" ${prefs.damageScope === value ? 'selected' : ''}>${t(value)}</option>`).join('')}</select></label><label class="field"><span>${t('rowColorMode')}</span><select name="rowColorMode">${['performance', 'class', 'accent'].map(value => `<option value="${value}" ${prefs.rowColorMode === value ? 'selected' : ''}>${t({performance:'colorPerformance', class:'colorClass', accent:'colorAccent'}[value])}</option>`).join('')}</select></label></div>
    <label class="field"><span>${t('summaryMetric')}</span><select name="summaryMetric">${['dps', 'damage', 'both'].map(value => `<option value="${value}" ${prefs.summaryMetric === value ? 'selected' : ''}>${t({ dps: 'summaryDps', damage: 'summaryDamage', both: 'summaryBoth' }[value])}</option>`).join('')}</select></label><div class="field-grid"><label class="field"><span>${t('density')}</span><select name="density"><option value="comfortable" ${prefs.density === 'comfortable' ? 'selected' : ''}>${t('comfortable')}</option><option value="compact" ${prefs.density === 'compact' ? 'selected' : ''}>${t('compact')}</option></select></label><label class="field"><span>${t('rowMetric')}</span><select name="rowMetric">${['both', 'dps', 'damage'].map(value => `<option value="${value}" ${prefs.rowMetric === value ? 'selected' : ''}>${t({ both: 'rowBoth', dps: 'rowDps', damage: 'rowDamage' }[value])}</option>`).join('')}</select></label></div><div class="button-row"><label class="check-field"><input name="showClass" type="checkbox" ${prefs.showClass ? 'checked' : ''}>${t('showClass')}</label><label class="check-field"><input name="showShares" type="checkbox" ${prefs.showShares ? 'checked' : ''}>${t('showShares')}</label><label class="check-field"><input name="showTeamCooldowns" type="checkbox" ${prefs.showTeamCooldowns ? 'checked' : ''}>${prefs.locale === 'tr' ? 'Satırda cooldown göster' : 'Show cooldown in rows'}</label></div>
    <div class="button-row"><label class="check-field"><input name="showTargetName" type="checkbox" ${prefs.showTargetName ? 'checked' : ''}>${prefs.locale === 'tr' ? 'Hedef adını göster' : 'Show target name'}</label><label class="check-field"><input name="showTargetHealth" type="checkbox" ${prefs.showTargetHealth ? 'checked' : ''}>${prefs.locale === 'tr' ? 'Hedef canını göster' : 'Show target health'}</label></div>
    <h3 class="section-title">${t('theme')}</h3><div class="theme-grid" role="group" aria-label="${t('theme')}">${Object.entries(THEMES).map(([id, theme]) => `<button class="theme-swatch" data-theme="${id}" style="--swatch-bg:${theme.bg};--swatch-text:${theme.text};--swatch-accent:${theme.accent}" aria-pressed="${prefs.theme === id}"><i aria-hidden="true"></i>${theme.name}</button>`).join('')}</div>
    <div class="field-grid">${field('textScale', 'size', 'range', prefs.textScale, 'min="0.85" max="2" step="0.05"')}${field('opacity', 'opacity', 'range', prefs.opacity, 'min="0" max="1" step="0.05"')}</div>
    <details class="appearance-details"><summary>${t('layout')} · ${esc(LAYOUTS[prefs.layout]?.name || '')}</summary><div class="layout-grid">${Object.entries(LAYOUTS).map(([id, layout]) => `<button class="layout-card" data-layout="${id}" aria-pressed="${prefs.layout === id}"><span class="layout-preview preview-${id}" aria-hidden="true"><i></i><b></b><em></em><em></em><em></em></span><strong>${layout.name}</strong><span>${esc(layout.description[prefs.locale])}</span></button>`).join('')}</div><p class="help">${t('layoutHelp')}</p></details>
    <details class="appearance-details"><summary>${t('typography')}</summary>
    <div class="field-grid"><label class="field"><span>${t('font')}</span><select name="font">${fontOptions(prefs.font)}</select></label><label class="field"><span>${t('targetFont')}</span><select name="targetFont">${fontOptions(prefs.targetFont)}</select></label></div>
    <div class="field-grid">${field('targetFontSize', 'targetFontSize', 'number', prefs.targetFontSize, 'min="8" max="28" step="1"')}${field('numberPrecision', 'numberPrecision', 'number', prefs.numberPrecision, 'min="0" max="3" step="1"')}</div></details>
    <details class="appearance-details"><summary>${prefs.locale === 'tr' ? 'Görünür modüller' : 'Visible modules'}</summary>${moduleSettingsContent()}</details>
    <details class="appearance-details"><summary>${t('appearanceExtras')}</summary><h3 class="section-title">${t('customColors')}</h3><div class="color-grid">${['bg', 'panel', 'text', 'accent'].map(key => field(`color-${key}`, key === 'bg' ? 'background' : key, 'color', prefs.customColors[key])).join('')}</div>
    <label class="field"><span>${t('background')}</span><input name="backgroundFile" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="help">${t('rasterHelp')}</p><div class="button-row">${button('remove-background', 'removeBackground', '', true)}</div>
    <div class="button-row">${button('export-theme', 'exportTheme')}${button('import-theme', 'importTheme', '', true)}</div><input id="theme-file" class="sr-only" type="file" accept=".json,application/json" tabindex="-1"><p class="help">${t('themeHelp')}</p><details><summary>${prefs.locale === 'tr' ? 'Görsel ve veri bildirimleri' : 'Artwork and data notices'}</summary><pre class="reference-notice">${esc(GAME_REFERENCE_NOTICE)}</pre></details></details>`;
}

function moduleSettingsContent() {
  const tr = prefs.locale === 'tr';
  const labels = tr ? { dps: 'DPS ve savaş analizi', pets: 'Pet rehberi ve takibi', cube: 'Hidden Cube pusulası', events: 'Etkinlik ve boss saatleri', odyle: 'Odyle', team: 'Takım cooldown’ları' } : { dps: 'DPS & combat analysis', pets: 'Pet guide & tracking', cube: 'Hidden Cube compass', events: 'Event & boss timers', odyle: 'Odyle', team: 'Team cooldowns' };
  return `<section class="module-settings" aria-labelledby="module-settings-title"><div class="record-top"><h3 id="module-settings-title" class="section-title">${tr ? 'Görünür modüller' : 'Visible modules'}</h3><span class="tag">${tr ? 'Kişisel görünüm' : 'Your view'}</span></div><p class="help">${tr ? 'Yalnız ilgilendiğin araçları göster. Başlıktaki modüller düğmesiyle her zaman geri dönebilirsin. Bu seçimler kayıt ve ses dinleme ayarlarını değiştirmez.' : 'Show the tools you use. The modules button in the header always lets you restore them. Display choices do not change capture or audio listening settings.'}</p><div class="button-row"><button type="button" class="action-button" data-action="modules-pets" aria-pressed="${petOnlyDisplay(prefs)}">${tr ? 'Yalnız pet' : 'Pets only'}</button><button type="button" class="action-button secondary" data-action="modules-all" aria-pressed="${Object.values(prefs.displayModules).every(Boolean)}">${tr ? 'Tüm modüller' : 'All modules'}</button></div><div class="module-options">${DISPLAY_MODULES.map(name => `<label class="check-field"><input type="checkbox" name="displayModule" value="${name}" ${prefs.displayModules[name] ? 'checked' : ''}>${labels[name]}</label>`).join('')}</div></section>`;
}

// Names, caps and refill rules come from the game catalog. What is left to the player: choosing
// which tickets to show, and naming an id the catalog has never heard of.
function namesSettingsContent() {
  const tr = prefs.locale === 'tr', ids = new Map(), member = resourceStatus(state.resources, Date.now()).membership_active;
  const observed = Array.isArray(state.resources?.tickets) ? state.resources.tickets.slice(0, 96).filter(row => Number.isSafeInteger(row?.ticket_id) && row.ticket_id !== 60000001) : [];
  const chosen = new Set(prefs.ticketShow ?? DEFAULT_TICKETS);
  const choices = observed.filter(row => ticketInfo(row.ticket_id)).map(row => {
    const info = ticketInfo(row.ticket_id), split = splitTicketName(info.name), cap = member && info.memberMax ? info.memberMax : info.max;
    return `<label class="check-field"><input type="checkbox" name="show:${row.ticket_id}" ${chosen.has(row.ticket_id) ? 'checked' : ''}>${esc(split.name)}${split.category ? ` <small>· ${esc(split.category)}</small>` : ''}${cap ? ` <small>/${cap}</small>` : ''}</label>`;
  });
  const note = (key, caption) => { if (!ids.has(key)) ids.set(key, caption); };
  const caption = key => { const [kind, id] = key.split(':'); return kind === 'ticket' ? `${tr ? 'Bilet' : 'Ticket'} #${id}` : kind === 'server' ? `${tr ? 'Sunucu' : 'Server'} ${id}` : `${tr ? 'Eşya' : 'Item'} #${id}`; };
  const unknown = key => { const [kind, id] = key.split(':'), number = Number(id); return kind === 'ticket' ? !ticketInfo(number) : kind === 'item' ? itemName(number) === null : serverTag(number) === null; };
  for (const row of observed) if (!ticketInfo(row.ticket_id)) note(`ticket:${row.ticket_id}`, caption(`ticket:${row.ticket_id}`));
  for (const row of [...state.currencies, ...state.tracker.looted, ...state.tracker.gathered]) if (unknown(`item:${row.item}`)) note(`item:${row.item}`, caption(`item:${row.item}`));
  for (const row of state.room?.members ?? []) if (row.server && unknown(`server:${row.server}`)) note(`server:${row.server}`, caption(`server:${row.server}`));
  for (const key of Object.keys(prefs.idNames)) note(key, caption(key));
  const field = ([key, text]) => {
    const name = `<label class="field"><span>${esc(text)}</span><input name="${esc(key)}" type="text" maxlength="40" value="${esc(prefs.idNames[key] || '')}"></label>`;
    return key.startsWith('ticket:') ? `<div class="field-grid">${name}<label class="field"><span>${tr ? 'En çok tutar' : 'Holds at most'}</span><input name="cap:${esc(key)}" type="number" min="1" max="99999" value="${prefs.idCaps[key] || ''}"></label></div>` : name;
  };
  return `<h3 class="section-title">${tr ? 'Gösterilecek biletler' : 'Tickets to show'}</h3><p class="help">${tr ? 'Adlar, üst sınırlar ve dolum kuralları oyun kataloğundan gelir. Biletler penceresinde hangi biletlerin görüneceğini seç; Odyle her zaman görünür. Hiçbiri seçili değilse varsayılan liste gösterilir.' : 'Names, caps and refill rules come from the game catalog. Choose which tickets the Tickets window shows; Odyle is always shown. With none chosen the usual list is shown.'}</p>${choices.length ? `<form id="tickets-form">${choices.join('')}<button type="submit" class="action-button">${tr ? 'Kaydet' : 'Save'}</button></form>` : `<p class="help">${tr ? 'Henüz bilet listesi gelmedi.' : 'No ticket list yet.'}</p>`}`
    + (ids.size ? `<h3 class="section-title">${tr ? 'Katalogda olmayan numaralar' : 'Numbers the catalog does not know'}</h3><p class="help">${tr ? 'Bunlara kendin ad verebilirsin (bilet için en çok tutacağı sayıyı da).' : 'You can name these yourself (and say how many a ticket holds).'}</p><form id="names-form">${[...ids].slice(0, 80).map(field).join('')}<button type="submit" class="action-button">${tr ? 'Kaydet' : 'Save'}</button></form>` : '');
}

function combatSettingsContent() {
  return `<label class="field"><span>${prefs.locale === 'tr' ? 'Kişisel rekor bildirimleri' : 'Personal best notices'}</span><select name="recordNotifications">${[['party', prefs.locale === 'tr' ? 'Ben ve takımım' : 'Me and my party'], ['self', prefs.locale === 'tr' ? 'Yalnız ben' : 'Only me'], ['off', prefs.locale === 'tr' ? 'Kapalı' : 'Off']].map(([id, label]) => `<option value="${id}" ${prefs.recordNotifications === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><p class="help">${prefs.locale === 'tr' ? 'Rekorlar otomatik kaydedilir. Sessiz bildirim 4 saniye görünür; ayrıntıları Analiz → Rekorlar’da bulabilirsin.' : 'Records are saved automatically. The silent notice lasts 4 seconds; details are in Analysis → Personal bests.'}</p><label class="check-field"><input type="checkbox" name="autoTargetRoster" ${prefs.autoTargetRoster ? 'checked' : ''}>${prefs.locale === 'tr' ? 'Vurduğum hedefin İlk 10 listesini otomatik göster' : 'Automatically show the target’s Top 10 contributors'}</label><p class="help">${prefs.locale === 'tr' ? 'Partide olman gerekmez. Liste yalnız o hedefe verilen, bağlantında alınan hasarı kapsar.' : 'No party is required. Only damage received on your connection to that target is included.'}</p><h3 class="section-title">${t('combatDetection')}</h3><p class="help">${t('combatHelp')}</p><form id="combat-form"><label class="field"><span>${t('combatSource')}</span><select name="source"><option value="hits" ${prefs.combatDetection.source === 'hits' ? 'selected' : ''}>${t('combatHits')}</option><option value="game" ${prefs.combatDetection.source === 'game' ? 'selected' : ''}>${t('combatGame')}</option></select></label>${field('seconds', 'combatSeconds', 'number', prefs.combatDetection.seconds, 'min="5" max="300"')}<p class="help">${t('combatLive')}: ${state.combat.game_in_combat === null ? t('combatUnknown') : state.combat.game_in_combat ? t('combatIn') : t('combatOut')}</p><button type="submit" class="action-button">${t('combatSave')}</button></form><label class="check-field"><input type="checkbox" name="ownHealth" ${prefs.alerts.ownHealth ? 'checked' : ''}>${t('ownHealthLabel')}</label><p class="help">${t('lethalHelp')}</p>${namesSettingsContent()}<h3 class="section-title">${t('bossSettings')}</h3><p class="help">${t('bossSettingsHelp')}</p><form id="boss-form">${state.targets.length ? state.targets.map(target => `<label class="check-field boss-choice"><input name="bossId" type="checkbox" value="${esc(target.id)}" ${target.is_boss ? 'checked' : ''}><span title="#${esc(target.id)}">${esc(target.name)}</span></label>`).join('') : empty('noTargets')}<button class="action-button" type="submit" ${state.targets.length ? '' : 'disabled'}>${t('saveBoss')}</button></form><div class="button-row">${button('open-alerts', 'alerts', '', true)}${button('open-training', 'training', '', true)}</div>`;
}

function captureDiagnosticsContent() {
  return `<div id="capture-diagnostics">${renderCaptureDiagnostics(captureDiagnostics, { locale: prefs.locale, native, busy: Boolean(captureDiagnosticRequest) || captureDiagnosticActionPending, mode: captureDiagnosticDemo ? 'demo' : native ? 'native' : 'browser' })}</div>`;
}

function refreshCaptureDiagnosticsPanel() {
  const host = $('#capture-diagnostics');
  if (!host) return;
  const content = renderCaptureDiagnostics(captureDiagnostics, { locale: prefs.locale, native, busy: Boolean(captureDiagnosticRequest) || captureDiagnosticActionPending, mode: captureDiagnosticDemo ? 'demo' : native ? 'native' : 'browser' });
  if (host.innerHTML !== content) host.innerHTML = content;
  scheduleOverlayRegions();
}

async function readCaptureDiagnostics() {
  if (!native) return captureDiagnostics;
  if (captureDiagnosticRequest) return captureDiagnosticRequest;
  captureDiagnosticRequest = Promise.resolve().then(() => invoke('get_capture_diagnostics'))
    .then(value => { captureDiagnostics = normalizeCaptureDiagnostics(value, { mode: 'native' }); return captureDiagnostics; })
    .catch(() => { captureDiagnostics = null; return null; })
    .finally(() => { captureDiagnosticRequest = null; refreshCaptureDiagnosticsPanel(); });
  refreshCaptureDiagnosticsPanel();
  return captureDiagnosticRequest;
}

async function captureDiagnosticAction(actionName) {
  if (captureDiagnosticActionPending) return;
  captureDiagnosticActionPending = true; refreshCaptureDiagnosticsPanel();
  try { await performCaptureDiagnosticAction(actionName); }
  finally {
    const fallback = $('#capture-diagnostics textarea');
    captureDiagnosticActionPending = false; refreshCaptureDiagnosticsPanel();
    if (fallback && $('#capture-diagnostics')) { $('#capture-diagnostics').append(fallback); fallback.focus(); fallback.select(); scheduleOverlayRegions(); }
    else $(`#capture-diagnostics button[data-action="${actionName}"]`)?.focus();
  }
}

async function performCaptureDiagnosticAction(actionName) {
  if (actionName === 'refresh-capture-diagnostics') {
    const result = await readCaptureDiagnostics();
    if (!result && native) toast(t('failed'), true);
    return;
  }
  const report = native ? await readCaptureDiagnostics() : captureDiagnostics;
  const content = captureDiagnosticText(report, { locale: prefs.locale, mode: captureDiagnosticDemo ? 'demo' : native ? 'native' : 'browser' });
  if (!content) { toast(t('failed'), true); return; }
  if (actionName === 'copy-capture-diagnostics') {
    try { await navigator.clipboard.writeText(content); toast(t('copied')); }
    catch {
      const host = $('#capture-diagnostics');
      if (!host) { toast(t('failed'), true); return; }
      let field = host.querySelector('textarea');
      if (!field) { field = document.createElement('textarea'); field.className = 'diagnostic-copy'; field.readOnly = true; field.setAttribute('aria-label', prefs.locale === 'tr' ? 'Kopyalanacak tanı' : 'Diagnostics to copy'); host.append(field); }
      field.value = content; field.focus(); field.select();
      toast(prefs.locale === 'tr' ? 'Tanı seçildi; Ctrl+C ile kopyala.' : 'Diagnostics selected; press Ctrl+C to copy.'); scheduleOverlayRegions();
    }
  } else {
    try { if (native) await invoke('export_document', { format: 'json', content }); else download('luma-capture-diagnostics-demo.json', content, 'application/json'); toast(t('exported')); }
    catch { toast(t('failed'), true); }
  }
}

function captureSaveContent(tr) {
  return `<h3 class="section-title">${tr ? 'Veri kaydı' : 'Data capture'}</h3><p class="help">${tr ? 'Son 2 dakikanın ham oyun verisini bu bilgisayara kaydeder; yeni bir özelliği gerçek veriyle geliştirmek için kullanılır. İçinde oyuncu adları ve sohbet bulunabilir. Kendin paylaşmadıkça hiçbir yere gönderilmez; en yeni 5 kayıt tutulur.' : 'Saves the last 2 minutes of raw game data on this computer so a feature can be built from real traffic. It may contain player names and chat. It is never sent anywhere unless you share it; the newest 5 captures are kept.'}</p><div class="field-grid"><label class="field"><span>${tr ? 'Ne oldu? (kısa not)' : 'What happened? (short note)'}</span><input name="captureLabel" type="text" maxlength="32" placeholder="${tr ? 'pvp, hasat, boss-buyu…' : 'pvp, gathering, boss-cast…'}" ${native ? '' : 'disabled'}></label></div><div class="button-row"><button type="button" class="action-button" data-action="save-capture" ${native ? '' : 'disabled'}>${tr ? 'Son 2 dakikayı kaydet' : 'Save the last 2 minutes'}</button></div><p class="help" id="capture-saved" aria-live="polite"></p>`;
}

// Look and feel of the separate windows: how big they are, how often they redraw, whether they
// settle on a grid once let go. Every window reads these on its own.
function overlayOptionsContent(tr) {
  const scales = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6], rates = [250, 500, 1000];
  return `<h3 class="section-title">${tr ? 'Oyuncu listesi' : 'Player list'}</h3><label class="field"><span>${tr ? 'Listede en çok kaç kişi görünsün (kalabalıkta en çok DPS yapanlar, bir de sen). İstediğin sayıyı yaz: 1, 3, 10…; 0 = herkes' : 'How many players to list at most (the ones with the most DPS in a crowd, and you). Type any number: 1, 3, 10…; 0 = everyone'}</span><input type="number" name="rosterLimit" min="0" max="50" step="1" value="${prefs.rosterLimit}" inputmode="numeric"></label>`
    + `<h3 class="section-title">${tr ? 'Ayrı pencereler' : 'Separate windows'}</h3><label class="field"><span>${tr ? 'Pencere ölçeği' : 'Window scale'}</span><select name="overlayScale">${scales.map(value => `<option value="${value}" ${Math.abs(prefs.overlayScale - value) < 0.03 ? 'selected' : ''}>${Math.round(value * 100)}%</option>`).join('')}</select></label><label class="field"><span>${tr ? 'Yenileme hızı' : 'Update rate'}</span><select name="overlayRate">${rates.map(value => `<option value="${value}" ${prefs.overlayRate === value ? 'selected' : ''}>${value} ms</option>`).join('')}</select></label><label class="check-field"><input type="checkbox" name="overlaySnap" ${prefs.overlaySnap ? 'checked' : ''}>${tr ? 'Bırakınca pencereleri ızgaraya oturt' : 'Snap windows to a grid when let go'}</label>`;
}

function controlsContent() {
  const tr = prefs.locale === 'tr';
  const options = [['fullscreenOverlay', tr ? 'Tam ekran görünümünü aç' : 'Enable fullscreen view'], ['onlyAboveGame', tr ? 'Yalnız AION2 ve Luma öndeyken üstte tut' : 'Keep on top only above AION2 and Luma'], ['clickThroughWhenLocked', tr ? 'Kilitliyken tıklamaları oyuna geçir' : 'Pass clicks through while locked'], ['fadeWhenIdle', tr ? 'Savaş dışında görünümü soldur' : 'Fade outside combat'], ['hidePlayerNames', tr ? 'Ana listede diğer oyuncuların adlarını gizle' : 'Hide other player names in the main roster'], ['showSkillBoard', tr ? 'Yeteneklerimi ana pencerede göster (hasar tablosu)' : 'Show my skills in the main window (damage table)'], ['cleanLook', tr ? 'Temiz görünüm: düğmeler yalnızca üzerine gelince, uyarı kartları gizli' : 'Clean look: buttons only on hover, notice cards hidden'], ['compactStrip', tr ? 'Pencere ve HUD için tek satır kompakt görünüm' : 'One-line compact view for the window and HUD']];
  return `${captureDiagnosticsContent()}<h3 class="section-title">${tr ? 'Pencere davranışı' : 'Window behavior'}</h3><label class="field"><span>${tr ? 'Tam ekran düzeni' : 'Fullscreen layout'}</span><select name="fullscreenLayout"><option value="dashboard" ${fullscreenLayout(prefs) === 'dashboard' ? 'selected' : ''}>${tr ? 'Ekranı dolduran panel' : 'Full-screen dashboard'}</option><option value="hud" ${fullscreenLayout(prefs) === 'hud' ? 'selected' : ''}>${tr ? 'Saydam ekran üzerinde küçük HUD' : 'Small HUD on a transparent screen'}</option></select></label>${options.map(([name, label]) => `<label class="check-field"><input type="checkbox" name="${name}" ${prefs[name] ? 'checked' : ''}>${label}</label>`).join('')}${overlayOptionsContent(tr)}<p class="help">${tr ? 'Tıklamaları geçirmek için kilit açma kısayolu çalışır durumda olmalı. Ayarlar açıldığında pencere tekrar tıklanabilir olur.' : 'Click-through requires a working unlock shortcut. Opening settings restores interaction.'}</p><p class="help">${tr ? 'Tam ekran seçeneği ekranı dolduran paneli açar. Küçük HUD seçeneğinde panelin dışındaki tıklamalar oyuna gider; başlıktan sürükleyip köşeden boyutlandırabilirsin. F11 veya Ctrl+Alt+Shift+F5 ile pencereye dön.' : 'The fullscreen option opens the dashboard. With the small HUD, clicks outside the panel reach the game; drag its header or resize its corner. F11 or Ctrl+Alt+Shift+F5 returns to window mode.'}</p><details class="appearance-details"><summary>${tr ? 'Kısayollar' : 'Shortcuts'}</summary>${renderHotkeys(hotkeyState, { locale: prefs.locale, native, busy: hotkeyPending })}</details>${captureSaveContent(tr)}`;
}

async function readRuntimeState() {
  if (!native) return;
  const results = await Promise.allSettled([invoke('get_hotkey_state'), invoke('get_update_state')]);
  if (results[0].status === 'fulfilled') hotkeyState = results[0].value;
  if (results[1].status === 'fulfilled') { updateState = results[1].value; renderUpdatePrompt(); }
  if (drawer === 'settings' && ['controls', 'about'].includes(settingsTab) && !$('#drawer-content').contains(document.activeElement)) refreshDrawer();
}

async function saveHotkeys(form) {
  if (!native || hotkeyPending) return;
  const values = new FormData(form), bindings = HOTKEY_ACTIONS.map(action => ({ action, shortcut: String(values.get(`shortcut-${action}`) || ''), enabled: values.get(`enabled-${action}`) === 'on' }));
  hotkeyPending = true;
  try { await preferenceCommitter.run(async () => { hotkeyState = await invoke('set_hotkeys', { bindings }); prefs = normalizePreferences({ ...prefs, hotkeys: hotkeyState.bindings }); preferenceCommitter.confirm(prefs); storeLocalPreferences(prefs); }); dirtySettingsForms.delete('hotkey-form'); toast(t('saved')); }
  catch (error) { toast(String(error).slice(0, 180), true); }
  finally { hotkeyPending = false; if (drawer === 'settings') refreshDrawer(); }
}

async function runUpdate(actionName) {
  if (!native || updatePending) return;
  updatePending = true;
  try { const command = { 'check-update': 'check_updates', 'download-update': 'download_update', 'install-update': 'install_update' }[actionName]; updateState = await invoke(command); }
  catch (error) { updateState = { ...updateState, status: 'error', error: String(error).slice(0, 320) }; }
  finally { updatePending = false; if (drawer === 'settings') refreshDrawer(); renderUpdatePrompt(); }
}

// A new version asks first: download it? Then install it and restart? "Later" keeps quiet about that
// version and step for a day.
const UPDATE_SNOOZE_KEY = 'luma.updateSnooze', DAY_MS = 86_400_000;
function updateSnoozed(prompt) {
  try { const saved = JSON.parse(localStorage.getItem(UPDATE_SNOOZE_KEY) || 'null'); return Boolean(saved) && saved.version === prompt.version && saved.stage === prompt.stage && Date.now() < saved.until; } catch { return false; }
}
function renderUpdatePrompt() {
  const host = $('#update-prompt');
  let prompt = native ? updatePrompt(updateState, { locale: prefs.locale }) : null;
  if (prompt && updateSnoozed(prompt)) prompt = null;
  host.hidden = !prompt;
  if (prompt && host._html !== prompt.html) { host.innerHTML = prompt.html; host._html = prompt.html; host.dataset.stage = prompt.stage; }
  syncMainInteractive();
}
$('#update-prompt').addEventListener('click', event => {
  const action = event.target.closest('[data-update-prompt]')?.dataset.updatePrompt;
  if (action === 'update-download') runUpdate('download-update');
  else if (action === 'update-install') runUpdate('install-update');
  else if (action === 'update-later') {
    const prompt = updatePrompt(updateState, { locale: prefs.locale });
    if (prompt) { try { localStorage.setItem(UPDATE_SNOOZE_KEY, JSON.stringify({ version: prompt.version, stage: prompt.stage, until: Date.now() + DAY_MS })); } catch {} }
    renderUpdatePrompt();
  }
});
// The meter stays open for days: ask the release feed again every six hours (unless that is switched off).
setInterval(() => { if (native && prefs.autoCheckUpdates && !updatePending && ['idle', 'current', 'error'].includes(updatePresentation(updateState).status)) runUpdate('check-update'); }, 6 * 3_600_000);

function rotationContent() {
  return `${source()}${playerPicker()}<div class="button-row">${button('refresh-insights', 'refreshCurve', curvePending || snapshot ? 'disabled' : '', true)}</div>${renderCombatInsights(retainedRecord(), insightOptions())}${renderEffectAttribution(retainedRecord(), insightOptions())}${renderBossProjection(retainedRecord(), { locale: prefs.locale, now: snapshot?.ended_ms || Date.now() })}`;
}

function healingContent() {
  const tr = prefs.locale === 'tr', record = retainedRecord(), scoped = scopedEncounter(record || {}, prefs.damageScope);
  const players = scoped.known ? scoped.players.filter(player => player.healing !== null && player.healing !== undefined) : [];
  return `${source()}<h3 class="section-title">${tr ? 'Alınan iyileştirme ve HPS' : 'Received healing and HPS'}</h3><p class="help">${tr ? 'Yalnız açıkça iyileştirme olarak işaretlenen alınan paketler. Desteklenmeyen iyileştirme türleri toplamda yer almaz; hasar ve DPS ayrı hesaplanır.' : 'Only received packets explicitly identified as healing. Unsupported healing types are absent; damage and DPS are calculated separately.'}</p><div class="button-row">${button('refresh-insights', 'refreshCurve', curvePending || snapshot ? 'disabled' : '', true)}</div>${record?.healing_sample_complete === false ? `<p class="quality-warning">${tr ? 'İyileştirme örnekleri eksik.' : 'Healing samples are incomplete.'}</p>` : ''}${players.length ? players.map(player => `<article class="record-card"><div class="record-top"><strong>${esc(player.name)}</strong><span>${num(player.healing)} · ${rate(player.hps)} HPS</span></div>${(player.healing_skills || []).map(skill => `<div class="healing-skill"><span>${esc(skill.name)}</span><strong>${num(skill.damage)}</strong><small>${fullNumber(skill.hits)} ${tr ? 'olay' : 'events'}</small></div>`).join('')}</article>`).join('') : `<p class="status-card">${tr ? 'Bu kapsamda açıkça işaretlenmiş iyileştirme henüz alınmadı.' : 'No explicitly identified healing received in this scope.'}</p>`}`;
}

function runsContent() {
  return renderRunHistory(allHistory().map(row => row.item), { locale: prefs.locale, scope: prefs.damageScope });
}

function settingsContent(section = settingsTab) {
  return ({ appearance: appearanceSettingsContent, character: characterContent, calendar: eventContent, combatSettings: combatSettingsContent, streaming: obsContent, controls: controlsContent, hiddenCube: cubeContent, about: () => `<div class="about-card"><strong>LUMA <span>DPS</span></strong>${appVersion ? `<span class="tag">${esc(appVersion)}</span>` : ''}</div><p class="help">${t('aboutHelp')}</p><p class="help">${t('keyboardHelp')}</p>${supportCard()}<label class="check-field"><input type="checkbox" name="autoCheckUpdates" ${prefs.autoCheckUpdates ? 'checked' : ''}>${prefs.locale === 'tr' ? 'Açılışta güncellemeleri kontrol et' : 'Check for updates on launch'}</label>${renderUpdates(updateState, { locale: prefs.locale, native, busy: updatePending })}` }[settingsSection(section)])();
}

function cubeCompassMarkup() {
  const svg = $('#cube-compass .cube-compass-svg').outerHTML.replace(/\s+id="[^"]*"/g, '');
  return `<div class="cube-compass cube-settings-compass" data-cube-compass role="img" aria-label="${t('cubeCompass')}">${svg}<span class="cube-compass-left">${t('cubeLeft')}</span><span class="cube-compass-right">${t('cubeRight')}</span></div>`;
}

// The Hidden Cube settings are the marker's. The sound locator and its compass are no longer part of the
// app; their old controls stay out of sight (hidden, not drawn) only so nothing that updates them breaks.
function cubeContent() {
  const tr = prefs.locale === 'tr';
  return `<h3 class="section-title">Hidden Cube</h3><p class="help">${tr ? 'Küp yakınlaşınca oyunun kendi küp resmi, yönü, uzaklığı ve süresiyle ekranda belirir; pencere değildir, tıklamaları oyuna geçirir. Oyunun gönderdiği küp bildirimlerinden okunur, ses dinlenmez.' : 'When a Cube is near, the game\'s own cube picture appears on the screen with its direction, distance and age. It is not a window: clicks go through to the game. It is read from the Cube notices the game sends; no sound is listened to.'}</p>
    <label class="check-field"><input name="showCubeLocator" type="checkbox" ${prefs.showCubeLocator ? 'checked' : ''}>${tr ? 'Hidden Cube işaretini göster' : 'Show the Hidden Cube marker'}</label>
    <label class="check-field"><input name="cubeNeedKeys" type="checkbox" ${prefs.cubeNeedKeys ? 'checked' : ''}>${tr ? 'Yalnızca elimde Hidden Cube anahtarı varken göster' : 'Only show it while I hold a Hidden Cube key'}</label>
    <div class="button-row"><button type="button" class="action-button" data-action="cube-marker-edit" ${!native ? 'disabled' : ''}>${tr ? 'Küp işaretinin yerini ayarla (Alt+E)' : 'Place the Cube marker (Alt+E)'}</button></div><div hidden>${cubeLegacyContent()}</div>`;
}

function cubeLegacyContent() {
  const disabled = !native || cubePending || cubeState.enabled;
  const source = cubeState.enabled ? cubeState.source : prefs.cubeSource;
  return `<h3 class="section-title">${t('cubeTitle')}</h3><p class="help">${t('cubeIntro')}</p>${!native ? `<p class="settings-hint">${t('cubePreview')}</p>` : ''}
    <div class="cube-locator" id="cube-locator"><div class="cube-status-line"><span id="cube-status-dot" class="cube-status-dot" aria-hidden="true"></span><strong id="cube-status-label"></strong><span id="cube-source-label" class="tag"></span></div>
    <div id="cube-direction-display" class="cube-direction-display" data-direction="unknown">${cubeCompassMarkup()}<div><strong id="cube-direction-label">—</strong><span>${t('cubeStereoAmbiguity')}</span><span id="cube-trend-label">—</span></div></div>
    <div class="cube-readings"><div><span>${t('cubeSimilarity')}</span><strong id="cube-similarity">—</strong></div><div><span>${t('cubeRelativeStrength')}</span><strong id="cube-relative-strength">—</strong></div><div><span>${t('cubeStrength')}</span><strong id="cube-strength">—</strong></div><div><span>${t('cubeSnr')}</span><strong id="cube-snr">—</strong></div></div><p class="help cube-network" id="cube-network-line"></p><p class="help cube-detail" id="cube-detail" hidden></p></div>
    <label class="check-field"><input name="cubeAutoListen" type="checkbox" ${prefs.cubeAutoListen ? 'checked' : ''} ${!native || cubePending ? 'disabled' : ''}>${t('cubeAutoListen')}</label><p class="help">${t('cubeAutoHelp')}</p>
    <div class="button-row"><button type="button" id="cube-toggle" class="action-button" data-action="toggle-cube" ${!native || cubePending ? 'disabled' : ''}>${t(cubePending ? 'cubeBusy' : cubeState.enabled ? 'cubeStop' : 'cubeStart')}</button></div>
    <label class="field"><span>${t('cubeSize')}</span><select name="cubeNavigatorSize"><option value="compact" ${prefs.cubeNavigatorSize === 'compact' ? 'selected' : ''}>${t('cubeCompactLabel')}</option><option value="full" ${prefs.cubeNavigatorSize === 'full' ? 'selected' : ''}>${t('cubeFullLabel')}</option></select></label>
    <div class="field-grid"><label class="field"><span>${t('cubeSource')}</span><select name="cubeSource" ${disabled ? 'disabled' : ''}><option value="game" ${source === 'game' ? 'selected' : ''}>${t('cubeGame')}</option><option value="system" ${source === 'system' ? 'selected' : ''}>${t('cubeSystem')}</option></select></label><label class="field cube-threshold"><span>${t('cubeThreshold')} <output id="cube-threshold-value">${Math.round(prefs.cubeThreshold * 100)}%</output></span><input name="cubeThreshold" type="range" min="0.6" max="0.97" step="0.01" value="${prefs.cubeThreshold}" ${disabled ? 'disabled' : ''} aria-describedby="cube-threshold-help"></label></div>
    <p class="help" id="cube-source-help">${t(source === 'system' ? 'cubeSystemHelp' : 'cubeGameHelp')}</p><p class="help" id="cube-threshold-help">${t('cubeThresholdHelp')} ${t('cubeSimilarityHelp')}</p><label class="check-field"><input name="showCubeLocator" type="checkbox" ${prefs.showCubeLocator ? 'checked' : ''}>${t('cubeIndicator')}</label>
    <label class="check-field"><input name="cubeNeedKeys" type="checkbox" ${prefs.cubeNeedKeys ? 'checked' : ''}>${prefs.locale === 'tr' ? 'Yalnızca elimde Hidden Cube anahtarı varken göster' : 'Only show it while I hold a Hidden Cube key'}</label>
    <p class="help">${prefs.locale === 'tr' ? 'Küp yakınlaşınca oyunun kendi küp resmi, yönü, uzaklığı ve süresiyle ekranda belirir; pencere değildir, tıklamaları oyuna geçirir. Yerini buradan ayarlarsın.' : 'When a Cube is near, the game\'s own cube picture appears on the screen with its direction, distance and age. It is not a window: clicks go through to the game. Place it from here.'}</p>
    <div class="button-row"><button type="button" class="action-button" data-action="cube-marker-edit" ${!native ? 'disabled' : ''}>${prefs.locale === 'tr' ? 'Küp işaretinin yerini ayarla' : 'Place the Cube marker'}</button></div>
    <details class="appearance-details"><summary>${prefs.locale === 'tr' ? 'Ses örneği, tanı ve sınırlar' : 'Reference sound, diagnostics and limits'}</summary>
    <div class="cube-limits"><p>${t('cubeLimit')}</p><p>${t('cubeRelative')}</p></div>
    <details class="cube-diagnostics"><summary>${t('cubeDiagnostics')}</summary><div><span>${t('cubeInput')}</span><strong id="cube-input-level">—</strong></div><div><span>${t('cubeFrames')}</span><strong id="cube-input-frames">0</strong></div><div><span>${t('cubeUncertain')}</span><strong id="cube-uncertain-packets">0</strong></div><div><span>${t('cubeGaps')}</span><strong id="cube-stream-gaps">0</strong></div></details>
    <h3 class="section-title">${t('cubeReference')}</h3><div class="cube-reference-line"><strong id="cube-reference-name">${esc(cubeState.reference.name || t('cubeBuiltin'))}</strong><span id="cube-reference-duration">${cubeState.reference.seconds > 0 ? `${cubeState.reference.seconds.toFixed(1)} s` : ''}</span></div><label class="field"><span>${t('cubeImport')}</span><input name="cubeReferenceFile" type="file" accept=".m4a,.wav,audio/mp4,audio/wav,audio/x-wav" ${disabled ? 'disabled' : ''}></label><p class="help">${t('cubeImportHelp')}</p><div class="button-row">${button('reset-cube-reference', 'cubeReset', disabled ? 'disabled' : '', true)}</div><p class="help" id="cube-format-label">${t('cubeUnknownFormat')}</p></details>`;
}

function renderCubeLive() {
  const view = cubePresentation(cubeState, { now: cubeDemo ? cubeState.last_detection_ms : Date.now(), locale: prefs.locale, live: native, readError: cubeReadError });
  // The sound compass beside the list is gone: the Hidden Cube is the marker drawn on the screen.
  const navigatorVisible = false;
  $('#meter').dataset.cubeDock = String(navigatorVisible);
  $('#meter').dataset.cubeSize = prefs.cubeNavigatorSize;
  $('#cube-navigator').hidden = !navigatorVisible;
  $('#cube-entry').hidden = true;
  $('#cube-navigator').dataset.status = view.status;
  $('#cube-entry').dataset.listening = String(cubeState.enabled);
  $('#cube-entry').dataset.status = view.status;
  $('#cube-entry').title = `${t('cubeAudioSettings')} · ${view.label}${view.quietInput ? ` · ${t(cubeState.source === 'system' ? 'cubeQuietSystem' : 'cubeQuiet')}` : ''}`; $('#cube-entry').setAttribute('aria-label', $('#cube-entry').title);
  $('#cube-nav-size').title = t(prefs.cubeNavigatorSize === 'full' ? 'cubeCompact' : 'cubeExpand');
  $('#cube-nav-size').setAttribute('aria-label', $('#cube-nav-size').title);
  $('#cube-nav-size').setAttribute('aria-pressed', String(prefs.cubeNavigatorSize === 'full'));
  $('#cube-navigator').setAttribute('aria-label', `Hidden Cube · ${t('cubeCompass')}`);
  setText($('#cube-nav-source'), view.sourceLabel);
  $('#cube-nav-source').hidden = native;
  const net = view.network;
  // The game's own position data outranks stereo balance once the walking direction is known.
  setText($('#cube-nav-direction'), net.side ? `${net.side[0].toUpperCase()}${net.side.slice(1)}` : view.matched ? t({ left: 'cubeCueLeft', right: 'cubeCueRight', center: 'cubeCueBalanced', unknown: 'cubeCueUnknown' }[view.direction]) : net.near ? `${net.nearLabel} · ${net.distance}` : view.label);
  $('#cube-nav-network').hidden = !net.near; $('#cube-nav-network').title = net.summary; $('#cube-nav-kind').dataset.look = net.look || ''; { const art = $('#cube-nav-art'); const path = net.near && net.look ? cubeIconPath(net.look) : null; if (art.getAttribute('src') !== path) { if (path) art.src = path; else art.removeAttribute('src'); } } $('#cube-nav-kind').dataset.taken = String(net.taken); setText($('#cube-nav-kind-name'), net.kind); setText($('#cube-nav-network-distance'), net.distance); setText($('#cube-nav-network-detail'), net.detail);
  setText($('#cube-nav-guidance'), net.side ? t('cubeWalkRelative') : view.sensitive && view.direction === 'unknown' ? (prefs.locale === 'tr' ? 'Zayıf sinyal · yön dinleniyor' : 'Faint signal · checking direction') : t('cubeStereoAmbiguity'));
  setText($('#cube-nav-trend'), view.matched ? view.trendLabel : net.near ? '' : t('cubeTurn'));
  setText($('#cube-nav-similarity'), view.similarity); setText($('#cube-nav-strength'), view.relativeStrength);
  setText($('#cube-nav-similarity-label'), t('cubeSimilarity')); setText($('#cube-nav-strength-label'), t('cubeRelativeStrength'));
  const quietMessage = view.quietInput ? t(cubeState.source === 'system' ? 'cubeQuietSystem' : 'cubeQuiet') : '';
  const detailText = quietMessage || view.detail;
  $('#cube-navigator').title = `${view.label} · ${view.directionLabel} · ${t('cubeStereoAmbiguity')} · ${t('cubeSimilarity')}: ${view.similarity} · ${t('cubeRelativeStrength')}: ${view.relativeStrength}`;
  $('#cube-nav-guidance').title = t('cubeTurn');
  for (const compass of $$('[data-cube-compass]')) {
    // Walking direction is the compass's top; a Cube announced by the game outranks stereo balance.
    const steer = net.angle ?? view.steerDegrees;
    compass.dataset.known = String(steer !== null); compass.dataset.status = view.status;
    compass.dataset.ambiguous = String(view.rearDegrees !== null);
    compass.style.setProperty('--cube-steer', `${steer ?? 0}deg`);
    compass.style.setProperty('--cube-rear', `${view.rearDegrees ?? 180}deg`);
    compass.style.setProperty('--cube-signal', `${(view.signalStrength ?? 0) * 100}`);
    setAttribute(compass, 'aria-label', `${t('cubeCompass')} · ${view.label}${view.matched ? ` · ${view.directionLabel}` : ''} · ${t('cubeStereoAmbiguity')}`);
    setText(compass.querySelector('.cube-compass-left'), t('cubeLeft')); setText(compass.querySelector('.cube-compass-right'), t('cubeRight'));
  }
  const panel = $('#cube-locator'); if (!panel) return;
  panel.dataset.status = view.status; setText($('#cube-network-line'), net.label);
  setText($('#cube-status-label'), view.label); setText($('#cube-source-label'), view.sourceLabel);
  const direction = $('#cube-direction-display'); direction.dataset.direction = view.direction; direction.dataset.matched = String(view.matched);
  setText($('#cube-direction-label'), view.directionLabel); setText($('#cube-trend-label'), view.trendLabel);
  setText($('#cube-similarity'), view.similarity); setText($('#cube-strength'), view.strength);
  setText($('#cube-relative-strength'), view.relativeStrength); setText($('#cube-snr'), view.snr);
  const detail = $('#cube-detail'); detail.hidden = !detailText; setText(detail, detailText);
  const toggle = $('#cube-toggle'); toggle.disabled = !native || cubePending; setText(toggle, t(cubePending ? 'cubeBusy' : cubeState.enabled ? 'cubeStop' : 'cubeStart'));
  const automatic = $('[name=cubeAutoListen]'); if (automatic) { automatic.checked = prefs.cubeAutoListen; automatic.disabled = !native || cubePending; }
  const sourceControl = $('[name=cubeSource]'); if (sourceControl && cubeState.enabled) sourceControl.value = cubeState.source;
  setText($('#cube-source-help'), t((cubeState.enabled ? cubeState.source : prefs.cubeSource) === 'system' ? 'cubeSystemHelp' : 'cubeGameHelp'));
  for (const control of $$('[name=cubeSource],[name=cubeThreshold],[name=cubeReferenceFile],[data-action=reset-cube-reference]')) control.disabled = !native || cubePending || cubeState.enabled;
  setText($('#cube-reference-name'), cubeState.reference.name || t('cubeBuiltin')); setText($('#cube-reference-duration'), cubeState.reference.seconds > 0 ? `${cubeState.reference.seconds.toFixed(1)} s` : '');
  setText($('#cube-format-label'), cubeState.sample_rate ? `${t('cubeAudioFormat')}: ${cubeState.sample_rate.toLocaleString(prefs.locale)} Hz · ${cubeState.audio_channels} ${cubeState.audio_channels === 1 ? 'mono' : 'ch'}${cubeState.audio_channels === 1 ? ` · ${t('cubeNoDirection')}` : ''}` : t('cubeUnknownFormat'));
  setText($('#cube-input-level'), cubeState.enabled && cubeState.input_level_db !== null ? `${cubeState.input_level_db.toFixed(1)} dBFS` : '—');
  setText($('#cube-input-frames'), cubeState.received_audio_frames.toLocaleString(prefs.locale));
  setText($('#cube-uncertain-packets'), cubeState.timestamp_uncertain_packets.toLocaleString(prefs.locale));
  setText($('#cube-stream-gaps'), cubeState.stream_discontinuities.toLocaleString(prefs.locale));
}

async function toggleCubeListening() {
  await setCubeListening(!cubeState.enabled, { source: prefs.cubeSource });
}

async function setCubeListening(enabled, { source = 'game' } = {}) {
  if (!native || cubePending) return;
  cubePending = true;
  cubeAutoListenIntent = enabled;
  prefs = normalizePreferences({ ...prefs, cubeAutoListen: enabled });
  applyAppearance(); renderMeter();
  try {
    await preferenceCommitter.run(async () => {
      let commandError = null;
      try {
        const value = await invoke(enabled ? 'start_cube_locator' : 'stop_cube_locator', enabled ? { source, threshold: prefs.cubeThreshold } : {});
        applyCubeSnapshot(value);
      } catch (error) { commandError = error; }
      // A failed stop may only mean the setting could not be saved. The native
      // stop still runs, and its in-memory preference is authoritative here.
      try {
        const actual = normalizePreferences(withSystemLocale(await invoke('get_preferences')));
        cubeAutoListenIntent = actual.cubeAutoListen;
        prefs = normalizePreferences({ ...prefs, cubeAutoListen: actual.cubeAutoListen });
      } catch (error) {
        if (!enabled) { cubeAutoListenIntent = false; prefs = normalizePreferences({ ...prefs, cubeAutoListen: false }); }
        commandError ||= error;
      }
      try { applyCubeSnapshot(await invoke('get_cube_state')); }
      catch (error) { cubeReadError = `${t('cubeReadFailed')}: ${String(error).replace(/[\u0000-\u001f]/g, '').slice(0, 180)}`; commandError ||= error; }
      if (commandError) toast(`${t('failed')}: ${String(commandError).slice(0, 160)}`, true);
    });
    storeLocalPreferences(protectCubeIntent(prefs));
  } catch (error) { toast(`${t('failed')}: ${String(error).slice(0, 160)}`, true); }
  finally { cubePending = false; renderMeter(); }
}

function applyCubeSnapshot(value) {
  if (!acceptsCubeSnapshot(cubeState, value)) return false;
  cubeState = normalizeCubeState(value); cubeReceivedCount++; cubeReadError = ''; renderCubeLive(); return true;
}

async function readCubeState() {
  if (!native || cubePollPending) return;
  const received = cubeReceivedCount; cubePollPending = true;
  try {
    const value = await invoke('get_cube_state');
    if (Number.isSafeInteger(value?.revision) && (cubeState.revision === null || value.revision >= cubeState.revision)) { cubeReadError = ''; applyCubeSnapshot(value); renderCubeLive(); }
  } catch (error) { if (received === cubeReceivedCount) { cubeReadError = `${t('cubeReadFailed')}: ${String(error).replace(/[\u0000-\u001f]/g, '').slice(0, 180)}`; renderCubeLive(); } }
  finally { cubePollPending = false; }
}

async function cubeCommand(command, args, successMessage = '') {
  if (!native) { toast(t('nativeOnly')); return; }
  if (cubePending) return;
  cubePending = true; renderCubeLive();
  let invoked = false;
  try { const payload = typeof args === 'function' ? await args() : args; invoked = true; const value = await action(command, payload); applyCubeSnapshot(value); await readCubeState(); if (successMessage) toast(t(successMessage)); return value; }
  catch (error) { if (!invoked) toast(t(command === 'import_cube_reference' ? 'cubeImportInvalid' : 'failed'), true); }
  finally { cubePending = false; renderCubeLive(); }
}

function characterContent() {
  const currentId = state.local_player_id || '';
  const players = sortedPlayers(state.players.filter(rosterEligible), 'name');
  const identityLabel = state.local_identity_source === 'server' ? t('identityServer') : state.local_identity_source === 'manual' ? t('identityManual') : state.local_identity_source === 'name-match' ? t('identityNameMatch') : t('autoDetect');
  return `<h3 class="section-title">${t('character')} ${source(identityLabel)}</h3><p class="help">${t('characterHelp')}</p><form id="character-form"><label class="field"><span>${t('characterId')}</span><select name="localPlayerId"><option value="">${t('autoDetect')}</option>${players.map(player => `<option value="${esc(player.id)}" ${player.id === currentId ? 'selected' : ''}>${esc(player.name)} · ${esc(player.class_name)} · #${esc(player.id)}</option>`).join('')}</select></label>${field('characterName', 'characterName', 'text', state.local_player_name || prefs.characterName, 'maxlength="64" autocomplete="off"')}<p class="help">${t('nameOnlyHelp')}</p><div class="button-row"><button class="action-button" type="submit">${t('saveCharacter')}</button>${button('clear-character', 'clearCharacter', '', true)}</div></form><hr class="divider"><h3 class="section-title">${t('manualParty')}</h3><p class="help">${t('partyHelp')}</p><form id="party-form"><div class="profile-roster">${players.length ? players.map(player => `<label class="check-field"><input name="partyMember" type="checkbox" value="${esc(player.id)}" ${state.party_member_ids.includes(player.id) || player.in_party ? 'checked' : ''}><span>${esc(player.name)}<small>${esc(player.class_name)} · #${esc(player.id)}</small></span></label>`).join('') : empty('noPlayers')}</div><button class="action-button" type="submit" ${players.length ? '' : 'disabled'}>${t('saveParty')}</button></form>`;
}

function eventContent() {
  const events = scheduledEvents();
  const builtins = events.filter(event => event.id.startsWith('builtin:')).map(event => ({ event, timing: scheduleTiming(event) })).sort((a, b) => (a.timing?.status === 'open' ? 0 : a.timing?.nextOpening || Infinity) - (b.timing?.status === 'open' ? 0 : b.timing?.nextOpening || Infinity));
  const sourceText = event => t(event.source?.status === 'official' ? 'sourceOfficial' : event.source?.status === 'user' ? 'sourcePersonal' : 'sourceCommunity');
  const localClock = milliseconds => { const date = new Date(milliseconds); return Number.isFinite(date.getTime()) ? date.toLocaleString(prefs.locale === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; };
  return `<h3 class="section-title" id="event-settings">${t('calendar')} <span class="tag">EU</span></h3><p class="help">${t('calendarIntro')}</p>
    <label class="field"><span>${t('activeEvent')}</span><select name="activeEventId"><option value="">${t('none')}</option>${events.map(event => `<option value="${esc(event.id)}" ${event.id === prefs.activeEventId ? 'selected' : ''}>${esc(event.name)}</option>`).join('')}${fieldBossTimers(worldData).map(timer => `<option value="${esc(timer.key)}" ${timer.key === prefs.activeEventId ? 'selected' : ''}>${t('map')} #${esc(timer.map_id)} · ${t('bossSlot')} #${esc(timer.slot_id)}</option>`).join('')}</select></label>
    <div class="schedule-list">${builtins.length ? builtins.map(({ event, timing }) => `<div class="schedule-card" data-schedule-card="${esc(event.id)}"><div class="schedule-top"><strong>${esc(event.name)}</strong><time data-scheduled-time="${esc(event.id)}">${timing?.status === 'open' ? t('calendarOpen') : timing ? clockTime(timing.remainingMs, true) : '—'}</time></div><div class="schedule-meta"><span data-scheduled-next="${esc(event.id)}">${t(timing?.status === 'open' ? 'calendarCloses' : 'calendarNext')}: ${timing ? localClock(timing.status === 'open' ? timing.closesAt : timing.nextOpening) : '—'}</span><span class="tag schedule-source" title="${esc([event.source?.label, event.source?.checkedAt].filter(Boolean).join(' · '))}">${sourceText(event)}</span></div><div class="schedule-actions"><button type="button" class="action-button secondary" data-action="select-calendar-event" data-id="${esc(event.id)}" aria-pressed="${prefs.activeEventId === event.id}">${t(prefs.activeEventId === event.id ? 'shownInHeader' : 'showInHeader')}</button><label class="check-field"><input name="builtInReminderEnabled" data-event-id="${esc(event.id)}" type="checkbox" ${event.reminderEnabled ? 'checked' : ''}>${t('reminderShort')}</label><label class="schedule-lead"><input name="builtInReminderLead" data-event-id="${esc(event.id)}" type="number" value="${event.reminderLeadMinutes ?? 5}" min="0" max="60" step="1" ${event.reminderEnabled ? '' : 'disabled'} aria-label="${t('eventLeadPerEvent')}"><span>${t('reminderBefore')}</span></label></div></div>`).join('') : empty('noCalendar')}</div>
    <details class="calendar-source-details"><summary>${t('calendarSource')}</summary><p class="help">${t('sourceCommunity')} · ${scheduleSnapshot?.last_success_ms ? `${t('calendarLastUpdate')}: ${dateText(scheduleSnapshot.last_success_ms)}` : t('calendarReady')}</p><div class="button-row">${button('refresh-calendar', schedulePending || scheduleSnapshot?.status === 'checking' ? 'calendarRefreshing' : 'calendarRefresh', !native || schedulePending ? 'disabled' : '', true)}${button('open-world', 'worldBosses', '', true)}</div></details>
    <details class="custom-calendar"><summary>${t('customCalendar')}</summary><p class="help">${t('customCalendarHelp')}</p>${prefs.events.map(event => { const timing = scheduleTiming(event); return `<div class="record-card"><div class="record-top"><strong>${esc(event.name)}</strong>${button('delete-event', 'delete', `data-id="${esc(event.id)}"`, true)}</div><div class="record-meta">${t('next')}: ${timing ? localClock(timing.nextOpening) : '—'}</div><div class="event-reminder-row"><label class="check-field"><input name="eventReminderEnabled" data-event-id="${esc(event.id)}" type="checkbox" ${event.reminderEnabled ? 'checked' : ''}>${t('eventReminder')}</label><label class="field"><span>${t('eventLeadPerEvent')}</span><input name="eventReminderLead" data-event-id="${esc(event.id)}" type="number" value="${event.reminderLeadMinutes}" min="0" max="60" step="1"></label></div></div>`; }).join('')}
    <form id="event-form">${field('eventName', 'eventName', 'text', '', 'maxlength="64" required')}${field('intervalMinutes', 'interval', 'number', 180, 'min="1" max="10080" step="1" required')}${field('anchor', 'anchor', 'datetime-local', '', 'required')}<div class="event-reminder-row"><label class="check-field"><input name="reminderEnabled" type="checkbox" checked>${t('eventReminder')}</label>${field('reminderLeadMinutes', 'eventLeadPerEvent', 'number', 5, 'min="0" max="60" step="1"')}</div><div class="button-row"><button class="action-button" type="submit">${t('saveEvent')}</button></div></form></details>
    <hr class="divider"><label class="field"><span>${t('calendarHorizon')}</span><select name="calendarHorizonDays">${[1, 7, 14, 30].map(days => `<option value="${days}" ${calendarHorizonDays === days ? 'selected' : ''}>${days}</option>`).join('')}</select></label><p class="help">${t('calendarHelp')}</p><div class="button-row">${button('export-calendar', 'exportCalendar', activeEvent() ? '' : 'disabled', true)}</div>`;
}

async function readEventSchedule(refresh = false) {
  if (!native || schedulePending) return;
  schedulePending = true;
  try { applyScheduleSnapshot(await invoke(refresh ? 'refresh_event_schedule' : 'get_event_schedule')); }
  catch {}
  finally { schedulePending = false; if (drawer === 'settings' && !$('#drawer-content').contains(document.activeElement)) refreshDrawer(); }
}

function applyScheduleSnapshot(value) {
  if (!acceptsCalendarSnapshot(scheduleSnapshot, value)) return;
  scheduleSnapshot = value; scheduleDataRevision++; tickTimers();
  if (drawer === 'settings' && !$('#drawer-content').contains(document.activeElement)) refreshDrawer();
}

function syncCalendarSelection() {
  const picker = $('[name=activeEventId]'); if (picker) picker.value = prefs.activeEventId;
  for (const button of $$('[data-action=select-calendar-event]')) { const selected = button.dataset.id === prefs.activeEventId; button.setAttribute('aria-pressed', String(selected)); setText(button, t(selected ? 'shownInHeader' : 'showInHeader')); }
}
function obsContent() {
  const tr = prefs.locale === 'tr', disabled = obsState.running || !native || obsPending;
  const addresses = obsState.lan_enabled ? (obsState.lan_urls || []).slice(0, 8) : [obsState.url];
  return `<h3 class="section-title">${t('streaming')} ${source(t(obsState.running ? 'obsRunning' : 'obsStopped'))}</h3><p class="help">${tr ? 'OBS Tarayıcı kaynağı için yerel yayın. İkinci bilgisayar için yerel ağ seçeneğini aç; her başlatmada yeni erişim anahtarı oluşur.' : 'Local OBS Browser Source. Enable LAN for a second computer; each start creates a new access key.'}</p><div class="field-grid"><label class="field"><span>${t('obsScope')}</span><select name="obsScope" ${disabled ? 'disabled' : ''}>${['personal', 'party', 'observed'].map(scope => `<option value="${scope}" ${obsScope === scope ? 'selected' : ''}>${t(scope)}</option>`).join('')}</select></label><label class="check-field"><input name="obsHideNames" type="checkbox" ${obsHideNames ? 'checked' : ''} ${disabled ? 'disabled' : ''}>${t('obsHideNames')}</label><label class="check-field"><input name="obsLanEnabled" type="checkbox" ${obsLanEnabled ? 'checked' : ''} ${disabled ? 'disabled' : ''}>${tr ? 'Yerel ağdaki ikinci bilgisayar' : 'Second computer on LAN'}</label><label class="field"><span>${tr ? 'Port (boş: otomatik)' : 'Port (blank: automatic)'}</span><input type="number" name="obsPort" min="1024" max="65535" value="${esc(obsPort)}" ${disabled ? 'disabled' : ''}></label></div>${obsState.running ? `<p class="help">${t('obsLiveScope')}: ${t(obsState.scope || obsScope)}</p>${addresses.map((url, index) => `<label class="field"><span>${t('obsUrl')}${addresses.length > 1 ? ` ${index + 1}` : ''}</span><input ${index === 0 ? 'id="obs-url"' : ''} type="text" value="${esc(url || '')}" readonly spellcheck="false"></label>`).join('')}<div class="button-row">${button('copy-obs-url', 'copy', !addresses[0] ? 'disabled' : '', true)}${button('stop-obs', 'obsStop', obsPending ? 'disabled' : '', true)}</div><p class="help">${tr ? 'Bağlantıyı bilen yerel ağ kullanıcıları seçilen ölçümü görebilir. Windows güvenlik duvarı izni gerekebilir. Durdurunca bağlantı iptal olur.' : 'LAN users with this link can view the selected data. Windows Firewall permission may be required. Stopping revokes the link.'}</p>` : `<div class="button-row">${button('start-obs', 'obsStart', !native || obsPending ? 'disabled' : '')}</div>`}`;
}

async function readObsState() {
  if (!native || obsPending) return;
  obsPending = true;
  try { const result = await action('get_obs_state'); obsState = result?.running === true ? result : { running: false }; if (obsState.running) { obsScope = ['personal', 'party', 'observed'].includes(obsState.scope) ? obsState.scope : 'personal'; obsHideNames = obsState.hide_names !== false; obsLanEnabled = obsState.lan_enabled === true; obsPort = obsState.port || ''; } }
  catch {}
  finally { obsPending = false; if (drawer === 'settings' && !$('#drawer-content').contains(document.activeElement)) refreshDrawer(); }
}

async function setObsRunning(running) {
  if (!native || obsPending) return;
  obsPending = true;
  try { const result = await action(running ? 'start_obs' : 'stop_obs', running ? { scope: obsScope, hide_names: obsHideNames, lan_enabled: obsLanEnabled, port: obsPort === '' ? null : Number(obsPort) } : {}); obsState = result?.running === true ? result : { running: false }; }
  catch {}
  finally { obsPending = false; if (drawer === 'settings') refreshDrawer(); }
}

function playerPicker() {
  const players = [...analysisState().players];
  if (!snapshot && skillsFromTargetBoard && selectedBoardPlayerDetail && !players.some(player => player.id === selectedBoardPlayerDetail.id)) players.unshift(selectedBoardPlayerDetail);
  if (!players.some(player => player.id === selectedPlayer)) selectedPlayer = ownPlayer(analysisState())?.id || scopedEncounter(analysisState(), prefs.damageScope).players[0]?.id || '';
  return players.length ? `<label class="field"><span>${t('selectPlayer')}</span><select name="selectedPlayer"><option value="" ${selectedPlayer ? '' : 'selected'}>${t('selectPlayer')}</option>${sortedPlayers(players, 'dps').map(player => `<option value="${esc(player.id)}" ${player.id === selectedPlayer ? 'selected' : ''}>${esc(player.name)} · ${esc(player.class_name)}</option>`).join('')}</select></label>` : empty('noPlayers');
}

function analysisPlayer() { const s = analysisState(), player = scopedEncounter(s, prefs.damageScope).players.find(player => player.id === selectedPlayer) || s.players.find(player => player.id === selectedPlayer) || (!snapshot && skillsFromTargetBoard && selectedBoardPlayerDetail?.id === selectedPlayer ? selectedBoardPlayerDetail : null); return player && s.timing_valid === false ? { ...player, dps: null } : player; }

function receivedPersonalStats(s) {
  const coverage = takenCoverage(s, true);
  return `<div class="analysis-metrics"><div><span>${t('personalTaken')}${coverage.kind === 'partial' ? ` · ${t('partial')}` : ''}</span><strong>${reportMetric(s.personal_damage_taken)}</strong></div><div><span>${t('personalTakenRate')}</span><strong>${rate(s.personal_damage_taken_per_second)}</strong></div><div><span>${t('personalHealing')}</span><strong>${reportMetric(s.personal_healing)}</strong></div><div><span>${t('personalHps')}</span><strong>${rate(s.personal_hps)}</strong></div></div><p class="help">${t('unknownReceived')}${coverage.kind === 'partial' ? ` ${t('takenPartialHelp')}` : ''}</p>${coverage.unclassifiedAmount > 0 ? `<p class="quality-warning">${t('unclassifiedEncounter')}: ${num(coverage.unclassifiedAmount)}${coverage.unclassifiedEvents === null ? '' : ` · ${fullNumber(coverage.unclassifiedEvents)} ${t('hits').toLowerCase()}`}</p>` : ''}`;
}

function receivedPlayerStats(p) {
  const coverage = takenCoverage(p);
  return `<div class="analysis-metrics received-metrics"><div><span>${t('liveTaken')}${coverage.kind === 'partial' ? ` · ${t('partial')}` : ''}</span><strong>${reportMetric(p.damage_taken)}</strong></div><div><span>${t('liveTakenRate')}</span><strong>${rate(p.damage_taken_per_second)}</strong></div><div><span>${t('liveHealing')}</span><strong>${reportMetric(p.healing)}</strong></div><div><span>HPS</span><strong>${rate(p.hps)}</strong></div></div>${coverage.kind === 'partial' ? `<p class="help">${t('takenPartialHelp')}</p>` : ''}${coverage.unclassifiedAmount > 0 ? `<p class="quality-warning">${t('unclassifiedPlayer')}: ${num(coverage.unclassifiedAmount)}</p>` : ''}`;
}

function overviewContent() {
  const s = analysisState();
  const scoped = scopedEncounter(s, prefs.damageScope), self = scopedEncounter(s, 'personal');
  return `${source()}<p class="help">${t('selectedScope')}: ${t(prefs.damageScope)} · ${t('statsReceived')}</p><div class="analysis-metrics"><div><span>${t(`${prefs.damageScope}Dps`)}</span><strong>${scoped.known ? rate(scoped.dps) : '—'}</strong></div><div><span>${t(`${prefs.damageScope}Damage`)}</span><strong>${scoped.known ? num(scoped.damage) : '—'}</strong></div><div><span>${t('duration')}</span><strong>${clockTime(scoped.elapsed)}</strong></div><div><span>${t('player')}</span><strong>${scoped.players.length}</strong></div></div><div class="comparison-strip"><div><span>${t('personalDamage')}</span><strong>${self.known ? num(self.damage) : '—'}</strong></div><div><span>${t('encounterObserved')}</span><strong>${num(s.total_damage)}</strong></div></div>${receivedPersonalStats(s)}${s.network_latency ? renderLatencyHistory(s, { locale: prefs.locale, scope: prefs.damageScope }) : ''}${playerPicker()}${(() => { const p = analysisPlayer(); if (!p) return ''; const summary = skillSummary(p); return `<div class="record-card"><strong class="class-colour" style="--class-color:${classColor(p.class_name)}">${esc(p.name)}</strong><div class="record-meta">${esc(p.class_name)} · #${esc(p.id)}</div><div class="analysis-metrics"><div><span>DPS</span><strong>${rate(p.dps)}</strong></div><div><span>${t('damage')}</span><strong>${num(p.damage)}</strong></div><div><span>${t('hits')}</span><strong>${fullNumber(summary.hits)}</strong></div><div><span>${t('crit')}</span><strong>${summary.criticalRate.toFixed(1)}%</strong></div></div>${receivedPlayerStats(p)}</div>`; })()}${reportToolbar()}<div class="button-row">${button('open-community-section', 'community', '', true)}${button('copy-community-summary', 'copyEncounterText', '', true)}</div>`;
}

function skillsContent() {
  const context = skillsFromTargetBoard && !snapshot ? `<p class="status-card">${prefs.locale === 'tr' ? 'İlk 10 listesi yalnız seçili hedefi kapsar. Buradaki yetenek ayrıntıları seçili karşılaşmanın tüm hedeflerine aittir; alınmayan ayrıntılar gösterilmez.' : 'The Top 10 board covers the selected target. Skill details here cover all targets in the selected encounter; unavailable details are not shown.'}</p>` : '';
  const picker = context + playerPicker(), p = analysisPlayer();
  if (!p) return `${source()}${picker}`;
  if (p.board_summary_only) return `${source()}${picker}<div class="analysis-metrics"><div><span>${t('damage')}</span><strong>${num(p.damage)}</strong></div><div><span>DPS · ${prefs.locale === 'tr' ? 'HEDEF' : 'TARGET'}</span><strong>${rate(p.dps)}</strong></div></div><p class="status-card">${prefs.locale === 'tr' ? 'Seçili hedefin katkısı alındı. Bu filtrede oyuncunun yetenek ayrıntıları bulunmuyor; ayrıntılı analiz için Tümü görünümünü kullan.' : 'Contribution to this target was received. This filter has no skill details for the player; use All for detailed analysis.'}</p>`;
  const skills = sortedSkills(p.skills, skillSort), summary = skillSummary(p);
  const sum = skills.reduce((total, skill) => total + skill.damage, 0);
  return `${source()}${picker}<div class="analysis-metrics"><div><span>${t('damage')}</span><strong>${num(p.damage)}</strong></div><div><span>DPS</span><strong>${rate(p.dps)}</strong></div><div><span>${t('averageHit')}</span><strong>${num(summary.average)}</strong></div><div><span>${t('crit')}</span><strong>${summary.criticalRate.toFixed(1)}%</strong></div></div>${receivedPlayerStats(p)}<label class="field"><span>${t('skillSort')}</span><select name="skillSort">${['damage', 'hits', 'crit'].map(value => `<option value="${value}" ${value === skillSort ? 'selected' : ''}>${t({damage: 'skillDamage', hits: 'skillHits', crit: 'skillCrit'}[value])}</option>`).join('')}</select></label>${skills.length ? skills.map(skill => `<div class="skill-row"><div class="skill-top"><span>${esc(skill.name)}</span><strong>${num(skill.damage)} · ${sum ? (skill.damage / sum * 100).toFixed(1) : '0.0'}%</strong></div><div class="skill-track" style="--skill-share:${sum ? skill.damage / sum * 100 : 0}%"><i></i></div><div class="skill-detail">${t('hits')}: ${fullNumber(skill.hits)} · ${t('crit')}: ${skill.hits ? Math.min(100, skill.crit_hits / skill.hits * 100).toFixed(1) : '0.0'}%<br>${t('averageHit')}: ${num(skill.hits ? skill.damage / skill.hits : 0)} · ${t('minMax')}: ${num(skill.min)} / ${num(skill.max)}${skillQuality(skill)}</div></div>`).join('') : empty('noSkills')}`;
}

function skillQuality(skill) {
  const labels = { direction_1_hits: 'direction1', direction_2_hits: 'direction2', perfect_hits: 'perfect', double_hits: 'double', parry_hits: 'parry' };
  const known = Object.entries(labels).filter(([key]) => skill[key] !== null);
  return known.length ? `<div class="quality-tags" aria-label="${t('quality')}">${known.map(([key, label]) => `<span>${t(label)} <b>${fullNumber(skill[key])}</b>${skill.quality_hits > 0 ? ` <small>${Math.min(100, skill[key] / skill.quality_hits * 100).toFixed(1)}%</small>` : ''}</span>`).join('')}</div>` : '';
}

function trainingContent() {
  const current = trainingState(state.training), known = scopedEncounter(state).known;
  const status = t({ idle: 'trainingIdle', armed: 'trainingArmed', running: 'trainingRunning', complete: 'trainingComplete', cancelled: 'trainingCancelled' }[current.status]);
  const active = ['armed', 'running'].includes(current.status), validDuration = validateTrainingDuration(trainingDurationDraft);
  return `${source()}<h3 class="section-title">${t('trainingTitle')}</h3><p class="help">${t('trainingHelp')}</p><p id="training-quality" class="quality-warning" ${current.capture_incomplete ? '' : 'hidden'}>${t('trainingIncomplete')}</p>${known ? '' : `<div class="status-card">${t('trainingNeedIdentity')}</div>`}
    <label class="field"><span>${t('trainingTarget')}</span><select name="trainingTargetId" ${active ? 'disabled' : ''}><option value="">${t('anyTrainingTarget')}</option>${state.targets.map(target => `<option value="${esc(target.id)}" ${target.id === trainingTargetId ? 'selected' : ''}>${esc(target.name)} · #${esc(target.id)}</option>`).join('')}</select></label>
    <div class="training-options" role="group" aria-label="${t('duration')}">${[60000, 120000, 180000, 300000].map(duration => `<button class="action-button${validDuration === duration ? '' : ' secondary'}" data-training-duration="${duration}" aria-pressed="${validDuration === duration}" ${active ? 'disabled' : ''}>${duration / 1000} s</button>`).join('')}</div>
    <label class="field"><span>${t('customTrainingDuration')}</span><input name="trainingSeconds" type="number" min="10" max="300" step="1" inputmode="numeric" value="${esc(trainingDurationDraft)}" aria-describedby="training-duration-help training-duration-error" aria-invalid="${validDuration === null}" ${active ? 'disabled' : ''}></label><p id="training-duration-help" class="help">${t('trainingDurationHelp')}</p><p id="training-duration-error" class="quality-warning" ${validDuration === null ? '' : 'hidden'}>${t('invalidTrainingDuration')}</p>
    <div class="training-status ${current.status}"><span id="training-state-label">${esc(status)}</span><strong id="training-remaining">${clockTime(current.status === 'idle' ? trainingDuration : current.remaining_ms)}</strong><div class="training-track"><i style="--training-progress:${current.duration_ms > 0 ? Math.min(100, (1 - current.remaining_ms / current.duration_ms) * 100) : 0}%"></i></div></div><div class="analysis-metrics"><div><span>${t('personalDamage')}</span><strong id="training-damage">${num(current.total_damage)}</strong></div><div><span>${t('personalDps')}</span><strong id="training-dps">${rate(current.dps)}</strong></div></div><div class="button-row">${button('arm-training', 'armTraining', !known || !native || active || validDuration === null ? 'disabled' : '')}${button('cancel-training', 'cancelTraining', !native || !active ? 'disabled' : '', true)}</div>`;
}

function updateTrainingLive() {
  const current = trainingState(state.training), active = ['armed', 'running'].includes(current.status);
  const validDuration = validateTrainingDuration(trainingDurationDraft), durationInput = $('[name=trainingSeconds]');
  setText($('#training-state-label'), t({ idle: 'trainingIdle', armed: 'trainingArmed', running: 'trainingRunning', complete: 'trainingComplete', cancelled: 'trainingCancelled' }[current.status]));
  setText($('#training-remaining'), clockTime(current.status === 'idle' ? trainingDuration : current.remaining_ms));
  setText($('#training-damage'), num(current.total_damage)); setText($('#training-dps'), rate(current.dps));
  $('#training-quality').hidden = !current.capture_incomplete;
  $('.training-track i').style.setProperty('--training-progress', `${current.duration_ms > 0 ? Math.min(100, (1 - current.remaining_ms / current.duration_ms) * 100) : 0}%`);
  for (const control of $$('[data-training-duration]')) { control.disabled = active; control.classList.toggle('secondary', Number(control.dataset.trainingDuration) !== validDuration); control.setAttribute('aria-pressed', String(Number(control.dataset.trainingDuration) === validDuration)); }
  durationInput.disabled = active; durationInput.setAttribute('aria-invalid', String(validDuration === null));
  durationInput.setCustomValidity(validDuration === null ? t('invalidTrainingDuration') : '');
  $('#training-duration-error').hidden = validDuration !== null;
  const targetSelect = $('[name=trainingTargetId]'), previousTarget = [...targetSelect.options].find(option => option.value === trainingTargetId)?.textContent;
  const targets = [{ id: '', name: t('anyTrainingTarget') }, ...state.targets.map(target => ({ id: target.id, name: `${target.name} · #${target.id}` }))];
  if (trainingTargetId && !targets.some(target => target.id === trainingTargetId)) targets.push({ id: trainingTargetId, name: previousTarget || `Target #${trainingTargetId}` });
  reconcileKeyedRows(targetSelect, targets, { key: target => target.id, create: () => document.createElement('option'), update: (option, target) => { option.value = target.id; setText(option, target.name); } });
  targetSelect.value = trainingTargetId; targetSelect.disabled = active;
  $('[data-action=arm-training]').disabled = !native || !scopedEncounter(state).known || active || validDuration === null;
  $('[data-action=cancel-training]').disabled = !native || !active;
}

async function readCurveRecord() {
  if (curvePending || snapshot) return;
  curvePending = true;
  try { if (native) curveRecord = normalizeEncounter(await action('get_current_encounter')); else if (demo) { const now = Date.now(), own = state.local_player_id || state.players[0]?.id; curveRecord = normalizeEncounter(spatialDemo ? { ...state, name: 'Demo encounter', source: 'demo', started_ms: now - 10000, ended_ms: now, elapsed_ms: 10000, sample_complete: true, damage_samples: Array.from({ length: 21 }, (_, i) => ({ timestamp_ms: now - 10000 + i * 500, player_id: own, source: own, target: 999, skill: 14090000, amount: 1200 + i * 100, metric: 'damage' })) } : DEMO_STATE); } }
  catch {}
  finally { curvePending = false; if (drawer === 'analysis' && tab === 'playback' && (playbackAwaitCurrent || !playbackRecord)) { playbackRecord = curveRecord; playbackAwaitCurrent = false; refreshDrawer(); } if (drawer === 'analysis' && ['curves', 'rotation', 'healing', 'overview', 'effects'].includes(tab)) refreshDrawer(); }
}

function curvesContent() {
  const record = snapshot || curveRecord;
  const curve = damageCurve(record, { scope: prefs.damageScope, intervalMs: curveInterval });
  const path = curve.available ? curvePath(curve.points) : '';
  const peak = curve.available ? Math.max(0, ...curve.points.map(point => point.dps)) : 0;
  const progress = historyProgress(allHistory().map(value => value.item), { scope: prefs.damageScope });
  const max = Math.max(1, ...progress.map(point => point.dps));
  return `${source()}${renderLatencyHistory(record, { locale: prefs.locale, scope: prefs.damageScope })}<p class="help">${t('curveHelp')}</p><div class="button-row">${snapshot ? '' : button('refresh-curve', 'refreshCurve', curvePending ? 'disabled' : '')}${curve.summary ? '' : [1000, 5000, 10000].map(interval => `<button class="action-button${curveInterval === interval ? '' : ' secondary'}" data-curve-interval="${interval}" aria-pressed="${curveInterval === interval}">${interval / 1000} s</button>`).join('')}</div>${curve.available ? `<div class="curve-frame"><svg class="damage-curve" viewBox="0 0 480 140" role="img" aria-label="${t('damage')} · DPS"><path class="curve-grid" d="M0,35H480 M0,70H480 M0,105H480"></path><path class="curve-fill" d="${path} L480,140 L0,140 Z"></path><path class="curve-line" d="${path}"></path></svg><div class="curve-axis"><span>00:00</span><span>↑ ${rate(peak)}</span><span>${clockTime(curve.elapsed_ms)}</span></div></div>${curve.complete ? `<div class="analysis-metrics"><div><span>${t('bestBurst')} · ${curveInterval / 1000} s</span><strong>${rate(curve.bestBurst)}</strong></div><div><span>${t('activity')}</span><strong>${record.elapsed_ms ? Math.min(100, curve.activityMs / record.elapsed_ms * 100).toFixed(1) : '0.0'}%</strong></div></div><p class="help">${t('activityHelp')}</p>` : `<p class="quality-warning">${curve.summary ? t('curveSummary') + (curve.dataComplete ? '' : ' ' + t('curvePartial')) : t('curvePartial')}</p>`}` : `<p class="status-card">${t('noCurve')}</p>`}<h3 class="section-title">${t('recentProgress')}</h3><p class="help">${t('progressHelp')}</p>${progress.length ? progress.map(point => `<div class="progress-row"><div><span>${esc(point.name)}</span><strong>${rate(point.dps)} DPS</strong></div><i style="--progress-share:${point.dps / max * 100}%"></i><small>${dateText(point.timestamp)} · ${clockTime(point.elapsed_ms)}</small></div>`).join('') : empty('noHistory')}`;
}

const actorName = id => state.players.find(player => player.id === String(id))?.name || state.targets.find(target => target.id === String(id))?.name || `#${id || '?'}`;
function effectsContent() {
  const labels = { 'stagger-break': 'eventStagger', windup: 'eventWindup', cast: 'eventCast', 'effect-applied': 'eventApplied', 'effect-refreshed': 'eventRefreshed', 'effect-removed': 'eventRemoved', 'effect-expired': 'eventExpired' };
  return `${source(t('serverObserved'))}${renderEffectAttribution(retainedRecord(), insightOptions())}<p class="help">${t('effectHelp')}</p>${state.assist.retention_limited ? `<p class="quality-warning">${t('effectLimited')}</p>` : ''}<h3 class="section-title">${t('stagger')}</h3><p class="help">${t('staggerHelp')}</p><div id="stagger-list"></div><h3 class="section-title">${t('windups')}</h3><div id="windup-list"></div><h3 class="section-title">${t('effects')} · ${t(prefs.damageScope)}</h3><div id="effect-list"></div><h3 class="section-title">${t('effectTimeline')}</h3><div class="button-row">${button('refresh-effects', 'refreshEffects', assistPending || !native ? 'disabled' : '', true)}</div>${assistTimeline.length ? assistTimeline.map(event => `<div class="timeline-row"><time>${new Date(event.at_ms).toLocaleTimeString(prefs.locale === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span>${t(labels[event.kind])}</span><small>${esc(actorName(event.actor_id))} → ${esc(actorName(event.target_id))}${event.skill_id ? ` · ${skillLabel(esc(event.skill_id))}` : ''}${event.instance_id ? ` · #${esc(event.instance_id)}` : ''}</small></div>`).join('') : empty('noEffectTimeline')}`;
}

async function readAssistTimeline() {
  if (assistPending || !native) return;
  assistPending = true;
  try { assistTimeline = assistanceTimeline(await action('get_assistance_state')); }
  catch {}
  finally { assistPending = false; if (drawer === 'analysis' && tab === 'effects') refreshDrawer(); }
}

function renderStaggerList(rows, now) {
  const container = $('#stagger-list');
  if (!container) return;
  const observations = staggerPresentation(telemetryDemo ? rows.map(row => ({ ...row, fresh: true, observed_at_ms: now })) : rows, { now, locale: prefs.locale });
  reconcileKeyedRows(container, observations.length ? observations : [{ empty: true }], {
    key: row => row.empty ? 'empty' : row.actor_id,
    create: row => {
      const element = document.createElement('div'); element.className = 'record-card stagger-card';
      element.innerHTML = row.empty ? '<p class="help"></p>' : '<div class="record-top"><strong></strong><span></span></div><progress max="100"></progress><div class="record-meta"></div>';
      return element;
    },
    update: (element, row) => {
      if (row.empty) { setText(element.querySelector('p'), t('noStagger')); return; }
      setText(element.querySelector('strong'), actorName(row.actor_id));
      setText(element.querySelector('.record-top span'), row.label);
      const bar = element.querySelector('progress'); bar.hidden = row.percent === null || row.broken;
      bar.value = row.percent ?? 0;
      bar.setAttribute('aria-label', `${actorName(row.actor_id)} · ${t('stagger')} · ${row.label}`);
      element.classList.toggle('broken', row.broken);
      setText(element.querySelector('.record-meta'), `${t('observedAt')}: ${dateText(row.observed_at_ms)}`);
    },
  });
}

function renderEffectLists() {
  if (!$('#effect-list')) return;
  const assist = assistanceState(state.assist), now = Date.now();
  const effects = scopedEffects(state, prefs.damageScope, now);
  const casts = assist.casts.filter(cast => cast.expires_ms > now);
  renderStaggerList(assist.stagger, now);
  reconcileKeyedRows($('#windup-list'), casts.length ? casts : [{ empty: true }], {
    key: cast => cast.empty ? 'empty' : `${cast.actor_id}:${cast.skill_id}:${cast.started_ms}`,
    create: cast => { const row = document.createElement('div'); row.className = 'record-card'; row.innerHTML = cast.empty ? '<p class="help"></p>' : '<div class="record-top"><strong></strong><time class="effect-time"></time></div><div class="record-meta"></div>'; return row; },
    update: (row, cast) => { if (cast.empty) { setText(row.querySelector('p'), t('noWindups')); return; } setText(row.querySelector('strong'), `${actorName(cast.actor_id)} · ${skillLabel(cast.skill_id || '?')}`); setText(row.querySelector('time'), `${Math.max(0, cast.expires_ms - now) / 1000 < 10 ? ((cast.expires_ms - now) / 1000).toFixed(1) : Math.ceil((cast.expires_ms - now) / 1000)} s`); setText(row.querySelector('.record-meta'), `${t('recipient')}: ${actorName(cast.target_id)}`); },
  });
  reconcileKeyedRows($('#effect-list'), effects.length ? effects : [{ empty: true }], {
    key: effect => effect.empty ? 'empty' : `${effect.recipient_id}:${effect.instance_id}`,
    create: effect => { const row = document.createElement('div'); row.className = 'record-card'; row.innerHTML = effect.empty ? '<p class="help"></p>' : '<div class="record-top"><strong></strong><time class="effect-time"></time></div><div class="record-meta"></div>'; return row; },
    update: (row, effect) => { if (effect.empty) { setText(row.querySelector('p'), t('noEffects')); return; } setText(row.querySelector('strong'), `Effect #${effect.effect_id || '?'}`); setText(row.querySelector('time'), effect.persistent ? '∞' : clockTime(effect.expires_ms - now)); row.querySelector('time').title = effect.persistent ? t('persistent') : ''; setText(row.querySelector('.record-meta'), `${t('recipient')}: ${actorName(effect.recipient_id)} · ${t('caster')}: ${actorName(effect.caster_id)}`); },
  });
}

// Your skills live in the window itself, like the skill overlay of the other meters: icon, name,
// rate, share and total, there by themselves once your own damage is received, in PvE and PvP alike.
// The window's minimum height follows the board, so no row is ever cut off.
let skillBoardSignature = '';
function renderSkillBoard() {
  const host = $('#skill-board'), collapsed = prefs.skillBoardCollapsed;
  const own = prefs.showSkillBoard && prefs.displayModules.dps && !prefs.compactStrip && !isFullscreenDashboard(prefs) ? ownPlayer(state) : null;
  const view = own ? skillBoard({ player: own, elapsedMs: state.personal_elapsed_ms || state.elapsed_ms, locale: prefs.locale, collapsed, label: skillLabel, rate, num }) : null;
  host.hidden = !view;
  $('#compact-summary').setAttribute('aria-expanded', String(!collapsed));
  if (view && host._html !== view.html) { host.dataset.collapsed = String(collapsed); host.innerHTML = view.html; host._html = view.html; }
  const signature = view ? `${collapsed}:${view.rows}:${view.more > 0}` : 'hidden';
  if (signature !== skillBoardSignature) { skillBoardSignature = signature; scheduleRosterFit(); }
}
document.addEventListener('click', event => { if (native && event.target.closest('[data-overlay-controls]')) invoke('overlay_controls', { open: true }).catch(() => {}); });
// While the meter is bare it has nothing to click, so the shell lets every click through it to the game;
// it takes clicks back for its card, a question to answer or a drawer.
function syncMainInteractive() {
  if (!native) return;
  const wanted = $('#meter').dataset.look !== 'bare' || !$('#update-prompt').hidden;
  if (wanted !== mainInteractive) { mainInteractive = wanted; invoke('main_interactive', { interactive: wanted }).catch(() => { mainInteractive = null; }); }
}
const toggleSkillBoard = () => savePreferences({ skillBoardCollapsed: !prefs.skillBoardCollapsed });
$('#compact-summary').addEventListener('click', toggleSkillBoard);
$('#compact-summary').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleSkillBoard(); } });
$('#skill-board').addEventListener('click', event => {
  const action = event.target.closest('[data-skill-board]')?.dataset.skillBoard;
  if (action === 'toggle') toggleSkillBoard();
  else if (action === 'all') { const own = ownPlayer(state); if (own) selectedPlayer = own.id; snapshot = null; openDrawer('analysis', 'skills'); }
});

// PvP: your kills and deaths this session (the game's death notices), opened from the chip beside
// the other tools, and opened by itself with the recap when you die.
let pvpPopoverOpen = false, pvpSeenDeath = 0, pvpAutoCloseAt = 0;
function setPvpPopover(open) {
  pvpPopoverOpen = open;
  $('#pvp-chip').setAttribute('aria-expanded', String(open));
  pvpAutoCloseAt = 0;
  renderPvp();
}
function renderPvp() {
  const pvp = state.pvp, tr = prefs.locale === 'tr', chip = $('#pvp-chip'), host = $('#pvp-popover');
  const death = pvp.last_death?.at_ms || 0;
  if (death && death !== pvpSeenDeath) {
    // A new death: show the recap for twenty seconds unless something else is open.
    const first = pvpSeenDeath === 0 && !pvp.deaths;
    pvpSeenDeath = death;
    if (!first && !drawer && !toolsOpen) { pvpPopoverOpen = true; pvpAutoCloseAt = Date.now() + 20000; $('#pvp-chip').setAttribute('aria-expanded', 'true'); }
  }
  if (pvpPopoverOpen && pvpAutoCloseAt && Date.now() > pvpAutoCloseAt) { pvpPopoverOpen = false; pvpAutoCloseAt = 0; chip.setAttribute('aria-expanded', 'false'); }
  const active = pvp.kills + pvp.deaths > 0;
  chip.hidden = !active && !pvpPopoverOpen;
  setText(chip, `PvP ${pvp.kills}/${pvp.deaths}`);
  chip.title = tr ? `${pvp.kills} öldürme · ${pvp.deaths} ölüm (bu oturum)` : `${pvp.kills} kills · ${pvp.deaths} deaths (this session)`;
  host.hidden = !pvpPopoverOpen;
  if (!pvpPopoverOpen) return;
  const recap = deathRecap(pvp.last_death, { locale: prefs.locale, label: id => skillLabel(id) });
  const stat = (value, label, title = '') => `<div${title ? ` title="${esc(title)}"` : ''}><b>${value}</b><small>${label}</small></div>`;
  const rows = recap ? recap.skills.map(row => `<div class="skill-row" style="--share:${row.share.toFixed(3)}"><span class="skill-name" title="${esc(row.name)}">${esc(row.name)}</span><span class="skill-rate">${row.hits}×</span><span class="skill-share">${(row.share * 100).toFixed(0)}%</span><span class="skill-total">${esc(num(row.damage))}</span></div>`).join('') : '';
  const html = `<div class="skill-head"><strong>PvP</strong><span>${tr ? 'bu oturum' : 'this session'}</span><button type="button" class="icon-button" data-pvp-popover="close" aria-label="${tr ? 'Kapat' : 'Close'}">×</button></div>
    <div class="pvp-grid">${stat(pvp.kills, tr ? 'ÖLDÜRME' : 'KILLS')}${stat(pvp.deaths, tr ? 'ÖLÜM' : 'DEATHS')}${stat(pvp.assists ?? '—', tr ? 'ASİST' : 'ASSISTS', pvp.assists === null ? (tr ? 'Asist, oyunun skor bildirimi ve parti listesindeki karakter kimliğin gelince görünür.' : 'Assists appear once the game score arrives and your character is in a party list.') : '')}${stat(`+${num(pvp.points)}`, tr ? 'ABYSS PUANI' : 'ABYSS PTS', `${tr ? 'Oyuncu öldürmenin ödülü olarak gelen Abyss Puanı; canavar kesmekten gelen sayılmaz.' : 'Abyss Points that came as the reward for beating players; points from monsters are not counted.'}\n${pvp.gains.length ? pvp.gains.map(gain => `+${gain.delta} (${tr ? 'sebep' : 'reason'} ${gain.reason}${gain.counted ? `, ${tr ? 'sayıldı' : 'counted'}` : ''})`).join(' · ') : (tr ? 'Henüz Abyss Puanı artışı yok.' : 'No Abyss Points rise yet.')}`)}</div>
    ${recap ? `<div class="pvp-recap"><strong>${esc(recap.kind)}</strong><span>${esc(recap.line)}</span><small>${tr ? 'Son 10 sn alınan hasar' : 'Damage taken in the last 10 s'}: ${esc(num(recap.taken))}</small></div>${rows}` : `<p class="help">${tr ? 'Henüz bir oyuncuyla savaşmadın.' : 'No player fought yet.'}</p>`}`;
  if (host._html !== html) { host.innerHTML = html; host._html = html; }
}
$('#pvp-chip').addEventListener('click', () => setPvpPopover(!pvpPopoverOpen));
$('#pvp-popover').addEventListener('click', event => { if (event.target.closest('[data-pvp-popover=close]')) setPvpPopover(false); });

// Boss frenzy countdown and your own health, as chips beside the other tools. The frenzy time comes
// from the game on the server's clock and is shown only once that clock is known.
// The headings DPS, total and share sit exactly over the columns of the rows below them, whatever the
// layout (the row's own numbers are measured; the headings are placed under them).
const headingColumns = [['#column-rate', '.player-dps'], ['#column-damage', '.player-damage'], ['#column-share', '.player-share']];
let headingKey = '';
function alignColumnHeadings() {
  const head = $('.clear-column-headings'), row = $('#players .player');
  if (!head || !row || getComputedStyle(head).display === 'none' || getComputedStyle(head).display.includes('flex') && getComputedStyle(head).flexDirection === 'column') { if (headingKey) { headingKey = ''; for (const [id] of headingColumns) { const label = $(id); label.style.cssText = ''; label.hidden = false; } head?.style.removeProperty('height'); } return; }
  const box = head.getBoundingClientRect(), placed = [];
  for (const [id, selector] of headingColumns) {
    const cell = row.querySelector(selector), label = $(id), at = cell && cell.offsetParent !== null ? cell.getBoundingClientRect() : null;
    placed.push([label, at && at.width > 0 ? `display:block;position:absolute;top:0;right:${Math.round((box.right - at.right) * 10) / 10}px;width:${Math.round(at.width * 10) / 10}px;text-align:right` : 'display:none']);
  }
  const key = placed.map(([, style]) => style).join('|') + box.right;
  if (key === headingKey) return;
  headingKey = key;
  head.style.height = `${Math.max(11, Math.ceil(parseFloat(getComputedStyle(head).fontSize) * 1.3))}px`;
  head.style.position = 'relative';
  for (const [label, style] of placed) label.style.cssText = style;
}

// A resized meter re-lays its rows at once; the headings follow in the same frame.
new ResizeObserver(() => { headingKey = ''; alignColumnHeadings(); }).observe($('#meter'));

let warnedControl = '';
function renderCombatChips() {
  const tr = prefs.locale === 'tr', now = Date.now();
  const loss = controlLoss(ownEffects(state, now)), alertChip = $('#control-chip');
  alertChip.hidden = !loss;
  if (loss) {
    setText(alertChip, `${tr ? 'KONTROL KAYBI' : 'CONTROL LOST'} · ${controlLabel(loss.control, prefs.locale)}${loss.remaining_ms === null ? '' : ` ${(loss.remaining_ms / 1000).toFixed(1)} ${tr ? 'sn' : 's'}`}`);
    const key = `${loss.id}:${loss.control}`;
    if (key !== warnedControl) { warnedControl = key; beep(); }
  } else warnedControl = '';
  const frenzy = frenzyLabel(state.frenzy, { locale: prefs.locale, now }), chip = $('#frenzy-chip');
  chip.hidden = !frenzy;
  if (frenzy) {
    setText(chip, frenzy.text); chip.dataset.urgent = String(frenzy.urgent);
    chip.title = `${tr ? 'Boss öfkesi' : 'Boss frenzy'}${state.frenzy.target_name ? ` · ${state.frenzy.target_name}` : ''}\n${tr ? 'Oyunun bildirdiği süre' : 'Time reported by the game'}`;
  }
  const health = prefs.alerts.ownHealth ? state.own_health : null, hp = $('#hp-chip');
  hp.hidden = !health;
  if (health) {
    const fraction = healthFraction(health);
    setText(hp, `HP ${num(health.hp)}${fraction === null ? '' : ` · ${Math.round(fraction * 100)}%`}`);
    hp.dataset.low = String(fraction !== null && fraction < 0.3);
    hp.title = `${tr ? 'Canın' : 'Your health'}: ${fullNumber(health.hp)}${health.max_hp ? ` / ${fullNumber(health.max_hp)}` : ''}`;
  }
}

function renderCombatWarning() {
  const now = Date.now();
  // A cast aimed at you warns (and beeps) as before; the other monster casts about to land are
  // shown without the warning colour when that is switched on.
  const casts = bossCasts(state, now).filter(cast => cast.aimed ? prefs.alerts.incomingWarnings : prefs.alerts.bossCasts);
  const cast = casts[0], warning = $('#combat-warning'); warning.hidden = !cast;
  if (!cast) return;
  const label = item => `${item.lethal ? `${t('lethal')} · ` : ''}${item.aimed ? `${t('targeted')} · ` : ''}${actorName(item.actor_id)} · ${skillLabel(item.skill_id || '?')}`;
  warning.dataset.aimed = String(cast.aimed); warning.dataset.lethal = String(Boolean(cast.lethal));
  setText($('#combat-warning-text'), `${label(cast)}${casts.length > 1 ? ` +${casts.length - 1}` : ''}`);
  setText($('#combat-warning-time'), `${Math.max(0, (cast.expires_ms - now) / 1000).toFixed(1)} s`);
  warning.title = `${casts.map(item => `${label(item)} · ${(Math.max(0, item.expires_ms - now) / 1000).toFixed(1)} s`).join('\n')}\n${t('serverObserved')}`;
  if (cast.aimed) {
    const key = `${cast.actor_id}:${cast.skill_id}:${cast.started_ms}`;
    if (key !== warnedWindup) { warnedWindup = key; beep(); }
  }
}

function characterDataEpoch() { return `${state.local_player_id ?? ''}:${petCollectionEpoch(state)}`; }

const requestCharacterSnapshot = characterSnapshotReader({
  epoch: characterDataEpoch,
  revision: () => metadataEpoch(state, 'character'),
  read: () => invoke('get_character_state'),
  accept: result => {
    if (acceptsPetCollectionSnapshot(state, result)) characterData = characterSnapshot(result);
    else if (!petCollectionOwner(state) && !petCollectionOwner(result)) characterData = characterSnapshot({ ...result, pet_progress: null });
  },
  failed: () => markPetSnapshotStale('snapshot-unavailable'),
  settled: () => {
    characterPending = false; renderPetTracking();
    if (drawer === 'analysis' && tab === 'pets') refreshPetsDrawer();
    else if (drawer === 'analysis' && tab === 'build') refreshDrawer();
  },
});
function readCharacterData() {
  if (!native) return Promise.resolve();
  characterPending = true;
  return requestCharacterSnapshot();
}

function markPetSnapshotStale(reason) {
  const owned = petCollectionProgress(state, characterData);
  characterData = characterSnapshot({ ...characterData, pet_progress: stalePetProgress(owned, { reason }) });
}

function currentPetPlan() { return { ...petPlan(petCollectionProgress(state, characterData), petCatalog, { localPlayerId: petCollectionOwner(state)?.actor_id ?? null, goal: prefs.petGoal, pins: prefs.petPins }), storageError: characterData.pet_storage_error }; }

function currentTargetPets() {
  const now = targetPetDemo && telemetryDemo ? state.recent_personal_target?.hit_at_ms : Date.now();
  petPinObservation = recentPetTarget(petPinObservation, state, now);
  return { target: petPinObservation?.target || null, matches: petTargetMatches(petPinObservation?.target, petCatalog) };
}

function renderTargetPetPin() {
  const host = $('#target-pet-pin'), tr = prefs.locale === 'tr', value = currentTargetPets();
  // Keep the visible choice connected between press and click, even if the
  // combat suggestion expires or changes during that press.
  if (host.querySelector('button:active')) return;
  const status = petTargetStatus(state, petPinObservation, value.matches), labels = targetPetStatusLabels(status);
  host.dataset.status = status;
  host.hidden = !hudPanelVisible(prefs, 'pets') || status === 'waiting-personal-hit' || status === 'self-identity-pending' && state.capture?.status !== 'capturing';
  if (host.hidden) return;
  const full = prefs.petPins.length >= PET_PIN_LIMIT, limit = petLabels(prefs.locale).limit;
  const receivedName = value.target?.name && !/^(?:#\d+|Target\s+#?\d+)$/iu.test(value.target.name) ? value.target.name : '';
  const title = status === 'matched' ? receivedName || value.matches[0].monster : labels.title;
  const caption = status !== 'matched' ? labels.detail : receivedName ? tr ? 'Pet kaynağı · alınan NPC ile rehber eşleşmesi' : 'Pet source · received NPC matches the guide' : tr ? 'Rehber adı · alınan NPC kimliğiyle eşleşti' : 'Reference name · matched by received NPC ID';
  const html = `<div class="target-pet-pin-heading"><span aria-hidden="true">⌖</span><div><strong>${esc(title)}</strong><small>${esc(caption)}</small></div><button type="button" class="text-button" data-pet-diagnostics>${tr ? 'Durum' : 'Status'}</button></div><div class="target-pet-pin-actions">${value.matches.map(pet => {
    const pinned = prefs.petPins.includes(pet.id), disabled = full && !pinned, label = tr ? pinned ? 'Sabitlemeyi kaldır' : 'Peti sabitle' : pinned ? 'Unpin pet' : 'Pin pet';
    return `<button type="button" class="target-pet-pin-button" data-target-pet-pin="${pet.id}" aria-pressed="${pinned}" aria-label="${esc(`${label} · ${pet.name}${disabled ? ` · ${limit}` : ''}`)}" title="${esc(disabled ? limit : `${label} · ${pet.name}`)}" ${disabled ? 'disabled' : ''}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 2 6 6-3 1-3 5-2-2-5 5-1-1 5-5-2-2 5-3z"/></svg><span class="target-pet-pin-name">${esc(pet.name)}</span><small>${tr ? pinned ? 'Sabitlendi' : 'Sabitle' : pinned ? 'Pinned' : 'Pin'}</small></button>`;
  }).join('')}</div>${full && value.matches.some(pet => !prefs.petPins.includes(pet.id)) ? `<p class="target-pet-pin-hint">${esc(limit)}. ${tr ? 'Yenisi için takip listesinden bir peti kaldır.' : 'Unpin a tracked pet to add another.'}</p>` : ''}`;
  if (host._content !== html) {
    const focused = host.contains(document.activeElement) ? document.activeElement.dataset.targetPetPin : null;
    host.innerHTML = html; host._content = html;
    if (focused) host.querySelector(`[data-target-pet-pin="${focused}"]`)?.focus({ preventScroll: true });
  }
}

function targetPetStatusLabels(status) {
  const tr = prefs.locale === 'tr';
  return ({
    matched: { title: tr ? 'Pet eşleşmesi alındı' : 'Pet match received', detail: tr ? 'Alınan NPC bilgisi rehberle eşleşti.' : 'Received NPC metadata matches the guide.' },
    'self-identity-pending': { title: tr ? 'Karakter kimliği bekleniyor' : 'Waiting for self identity', detail: tr ? 'Pet hedefini kendine ait vuruşla bağlamak için oyundan karakter kimliğin gerekli.' : 'Game self identity is required to associate pet targets with your own hits.' },
    'npc-metadata-pending': { title: tr ? 'Hedefin tür bilgisi bekleniyor' : 'Waiting for target metadata', detail: tr ? 'Mobun adı veya NPC türü henüz alınmadı; pet kaynağı olduğu tahmin edilmiyor.' : 'The mob name or NPC type has not arrived; no pet-source guess is made.' },
    'catalog-no-match': { title: tr ? 'Bu hedef için rehber eşleşmesi yok' : 'No guide match for this target', detail: tr ? 'Katalogda bu NPC için doğrulanmış pet bağlantısı yok. Bu, pet ruhu veremediği anlamına gelmez.' : 'The catalog has no verified pet link for this NPC. This does not establish that it cannot drop souls.' },
    'waiting-personal-hit': { title: tr ? 'Kendi hedef vuruşun bekleniyor' : 'Waiting for your target hit', detail: tr ? 'Yakındaki oyuncuların hedefleri senin pet hedefin sayılmaz.' : 'Nearby players’ targets do not become your pet target.' },
  })[status];
}

function petDiagnosticsContent() {
  const value = currentTargetPets(), labels = targetPetStatusLabels(petTargetStatus(state, petPinObservation, value.matches)), tr = prefs.locale === 'tr';
  return `<details class="pet-target-diagnostics" data-state-key="pet-diagnostics" ${petDiagnosticsOpen ? 'open' : ''}><summary>${tr ? 'Pet algılama durumu' : 'Pet detection status'}</summary><p class="help"><strong>${esc(labels.title)}</strong><br>${esc(labels.detail)}</p><p class="help">${tr ? 'Tanı dosyası son alınan hedef kimliğini ve sabitlenen petlerin sayaçlarını içerir. Ham paket, adres, karakter adı veya ses içermez; yalnız bu cihaza kaydedilir.' : 'The diagnostic file contains the last received target IDs and pinned pet counters. It excludes raw packets, addresses, character names and audio; it is saved only on this device.'}</p><button type="button" class="action-button secondary" data-action="save-pet-diagnostics" ${petDiagnosticPending ? 'disabled' : ''}>${tr ? 'Pet tanısını kaydet' : 'Save pet diagnostic'}</button></details>`;
}

function petsContent() {
  const plan = currentPetPlan();
  // Once counters arrive, open on the pets that still need souls unless the user already chose a view.
  if (!petFiltersTouched && plan.observedCount > 0) { petFiltersTouched = true; petFilters = { ...petFilters, ...defaultPetFilters(plan), page: 0 }; }
  petFilters.page = filteredPets(plan, { ...petFilters, pins: prefs.petPins }).page;
  return `${demo ? source(t('sourceDemo')) : ''}${renderPetGuide(plan, petCatalog, { locale: prefs.locale, filters: petFilters, pins: prefs.petPins, goal: prefs.petGoal, show: prefs.showPetTracker, automatic: prefs.petAutoTrack, selectedId: petSelectedId })}${petDiagnosticsContent()}<details class="pet-data-notice"><summary>${prefs.locale === 'tr' ? 'Pet verileri ve lisans bildirimi' : 'Pet data and license notice'}</summary><p>MetaBot.GG · ${esc(petCatalog.verified_at)} · ${esc(PET_CATALOG.source_client_build)}</p><pre>${esc(PET_DATA_NOTICE)}</pre></details>`;
}

function refreshPetsDrawer() {
  if (drawer !== 'analysis' || tab !== 'pets') { petDrawerRefreshPending = false; return; }
  petDrawerRefreshPending = !refreshPetGuidePanel($('#drawer-content'), () => refreshDrawer());
}

// Level memory per character, so switching characters never reads as a level-up.
let petLevelMemory = { owner: '', levels: null };
function notifyPetAdvances(plan) {
  const owner = String(petCollectionOwner(state)?.actor_id ?? '');
  const { notices, levels } = petAdvances(owner && petLevelMemory.owner === owner ? petLevelMemory.levels : null, plan);
  petLevelMemory = { owner, levels };
  if (!notices.length) return;
  const tr = prefs.locale === 'tr';
  toast(notices.map(notice => `${notice.name || `#${notice.id}`} · ${notice.complete ? (tr ? 'Lv.3 tamamlandı' : 'Lv.3 complete') : `Lv.${notice.to}`}`).join(' · '));
  beep();
}

function renderPetTracking() {
  if ($('#pet-tracker').querySelector('button:active')) return;
  const plan = currentPetPlan(), rows = trackedPets(plan, prefs.petPins, { automatic: prefs.petAutoTrack });
  notifyPetAdvances(plan);
  const host = $('#pet-tracker');
  const emptyPanelRequested = prefs.layout === 'cupertino' || !prefs.displayModules.dps;
  host.hidden = !hudPanelVisible(prefs, 'pets') || !prefs.showPetTracker || !rows.length && !emptyPanelRequested;
  if (!host.hidden) {
    const html = rows.length ? renderPetTracker(rows, { locale: prefs.locale, collapsed: prefs.petTrackerCollapsed, compact: prefs.displayModules.dps && $('#meter').classList.contains('short-frame') && !isFullscreenDashboard(prefs) }) : `<div class="pet-panel-empty"><strong>${prefs.locale === 'tr' ? 'Pet takibi' : 'Pet tracker'}</strong><span>${prefs.locale === 'tr' ? 'Takip etmek istediğin petleri rehberden sabitle.' : 'Pin the pets you want to track from the guide.'}</span><button type="button" class="text-button" data-pet-action="guide">${t('pets')} ↗</button></div>`;
    if (host._content !== html) { const scroll = host.querySelector('.pet-tracker-rows')?.scrollTop || 0; host.innerHTML = html; host._content = html; const list = host.querySelector('.pet-tracker-rows'); if (list) list.scrollTop = scroll; }
  }
  const chip = $('#pet-chip'); chip.hidden = !prefs.displayModules.pets;
  setText(chip, `${t('pets')}${prefs.petPins.length ? ` · ${prefs.petPins.length}` : ''}`);
  chip.title = petLabels(prefs.locale).title;
  renderModuleHome(plan, rows);
  scheduleOverlayRegions();
}

function renderModuleHome(plan, tracked) {
  const host = $('#module-home'), tr = prefs.locale === 'tr', modules = prefs.displayModules;
  host.hidden = modules.dps || prefs.radarOpen && !hudPanelVisible(prefs, 'pets');
  if (host.hidden) return;
  const title = modules.pets ? tr ? 'Pet takibi' : 'Pet tracking' : tr ? 'Araçların' : 'Your tools';
  const description = modules.pets ? tracked.length ? `${tracked.length} ${tr ? 'pet takipte' : 'pets tracked'} · ${plan.observedCount} ${tr ? 'pet verisi alındı' : 'received pets'}` : tr ? 'Rehberden pet sabitle. Alınan ruh ve seviye ilerlemesi burada görünür.' : 'Pin pets from the guide. Received souls and level progress appear here.' : tr ? 'Seçtiğin araçlar burada görünür. Görünüm ayarlarından değiştirebilirsin.' : 'Your selected tools appear here. Change them in Appearance settings.';
  const html = `<div class="module-home-top"><strong>${title}</strong><button type="button" data-module-action="all" class="text-button">${tr ? 'Tümünü göster' : 'Show all'}</button></div><p>${description}</p>${modules.pets ? `<button type="button" data-module-action="pets" class="action-button">${tr ? 'Pet rehberini aç' : 'Open pet guide'} ↗</button>` : ''}`;
  if (host._content !== html) { host.innerHTML = html; host._content = html; }
}

function openPetGuide(id = null) {
  petSelectedId = Number.isSafeInteger(id) ? id : null;
  if (petSelectedId !== null) { const row = currentPetPlan().rows.find(row => row.id === petSelectedId); petFiltersTouched = true; petFilters = { ...petFilters, query: row?.name || String(petSelectedId), faction: 'all', genus: 'all', status: 'all', page: 0 }; }
  openDrawer('analysis', 'pets');
}

function togglePetPin(id) {
  const plan = currentPetPlan(), change = petPinTransition(prefs, id, plan);
  if (change.status === 'invalid') { toast(prefs.locale === 'tr' ? 'Bu pet sabitlenemedi; rehberi yenileyip tekrar seç.' : 'This pet could not be pinned; refresh the guide and select it again.', true); return; }
  const restorePin = document.activeElement?.dataset.action === 'pet-pin';
  if (change.patch) savePreferences({ ...change.patch, ...(change.status === 'added' ? hudPanelChange(prefs, 'pets', true) : {}) });
  if (change.status === 'limit') toast(petLabels(prefs.locale).limit);
  else if (change.status === 'added') {
    const name = plan.rows.find(row => row.id === id)?.name || t('pets');
    toast(`${name} · ${prefs.locale === 'tr' ? 'Sabitlendi' : 'Pinned'}`);
    requestAnimationFrame(() => $(`#pet-tracker [data-pet-action="open"][data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }));
  }
  if (drawer === 'analysis' && tab === 'pets') { refreshPetsDrawer(); if (restorePin) $(`#drawer-content [data-action="pet-pin"][data-id="${id}"]`)?.focus({ preventScroll: true }); }
}

function petProgressContent(input) {
  const observed = petCollectionProgress(state, input);
  return `<h3 class="section-title">${t('petProgress')}</h3><p class="help">${observed ? `${observed.pets.length} ${petLabels(prefs.locale).registered}` : t('noPetProgress')}</p><button class="action-button" data-action="open-pet-guide">${t('pets')} ↗</button>`;
}

function buildContent() {
  const data = snapshot ? characterSnapshot({ own: snapshot.character_build }) : characterData;
  const choices = [{ id: 'own', name: t('ownBuild'), value: data.own }, { id: 'unbound', name: t('unboundBuild'), value: data.unbound_own }, ...data.inspected.map((value, index) => ({ id: `inspected-${index}`, name: `${t('inspectedBuild')}: ${value.name || '?'}`, value }))].filter(choice => choice.value);
  if (!choices.some(choice => choice.id === selectedBuild)) selectedBuild = choices[0]?.id || 'own';
  const current = choices.find(choice => choice.id === selectedBuild)?.value;
  const header = `${source(snapshot ? t('snapshot') : t('serverObserved'))}<p class="help">${t('buildHelp')}</p><div class="button-row">${button('refresh-build', 'refreshBuild', characterPending || !native || snapshot ? 'disabled' : '', true)}</div>`;
  const pets = snapshot ? '' : `<div id="automatic-odyle">${odyleContent()}</div>` + petProgressContent(data);
  if (!current) return header + pets + empty('noBuild');
  return `${header}${pets}${renderCharacterCollections(current, { locale: prefs.locale })}<label class="field"><span>${t('receivedBuild')}</span><select name="selectedBuild">${choices.map(choice => `<option value="${esc(choice.id)}" ${selectedBuild === choice.id ? 'selected' : ''}>${esc(choice.name)}</option>`).join('')}</select></label><div class="status-card"><strong>${esc(current.name || (selectedBuild === 'unbound' ? t('unboundBuild') : state.local_player_name || t('ownBuild')))}</strong><div class="record-meta">${t('snapshotTime')}: ${dateText(current.observed_at_ms)}${current.actor_id ? ` · #${esc(current.actor_id)}` : ''}${current.server_id ? ` · Server #${esc(current.server_id)}` : ''}${current.level !== null && current.level !== undefined ? ` · ${t('level')}: ${current.level}` : ''}${current.gear_score !== null && current.gear_score !== undefined ? ` · Gear: ${current.gear_score}` : ''}</div></div><h3 class="section-title">${t('observedEquipment')}</h3>${current.equipment.length && !current.equipment_complete ? `<p class="help">${t('partialBuild')}</p>` : ''}${current.equipment.length ? current.equipment.map(item => `<div class="record-card"><div class="record-top"><strong>Item #${esc(item.item_id || '?')}</strong><span class="tag">${item.slot === null ? `#${item.entry_index ?? '?'}` : `${t('slot')} ${item.slot}`}</span></div><div class="record-meta">${item.enchant === null ? '' : `${t('enchant')}: +${item.enchant}`}${item.godstone_id ? ` · ${t('godstone')} #${esc(item.godstone_id)}` : ''}${item.stones ? `<br>${t('stones')}: ${item.stones.map(stone => `#${esc(stone.stat_id || '?')} · ${stone.tier ?? '?'}`).join(' / ') || '—'}` : ''}${item.stats ? `<br>${t('stats')}: ${item.stats.map(stat => `#${esc(stat.stat_id || '?')}: ${stat.value ?? '?'}`).join(' · ') || '—'}` : ''}${item.skill_bonuses ? `<br>${t('skillBonuses')}: ${item.skill_bonuses.map(skill => `#${esc(skill.skill_id || '?')} +${skill.levels ?? '?'}`).join(' · ') || '—'}` : ''}</div></div>`).join('') : empty('noObservedEquipment')}<h3 class="section-title">${t('skills')}</h3>${current.skills.length && !current.skills_complete ? `<p class="help">${t('partialBuild')}</p>` : ''}${current.skills.length ? `<div class="build-skills">${current.skills.map(skill => `<div><span>${skillLabel(esc(skill.skill_id || '?'))}</span><strong>${t('level')} ${skill.level ?? '?'}</strong><small>${t('baseLevel')}: ${skill.base_level ?? '?'}</small></div>`).join('')}</div>` : empty('noSkills')}<h3 class="section-title">${t('daevanion')}</h3>${current.boards.length ? current.boards.map(board => `<div class="record-card"><strong>Board #${esc(board.board_id || '?')}</strong><div class="record-meta">${t('nodes')}: ${board.node_ids.map(id => `#${esc(id)}`).join(', ') || '—'}</div></div>`).join('') : empty('noBoards')}`;
}

async function readWorldData() {
  if (worldPending || !native) return;
  const epoch = metadataEpoch(state, 'world');
  worldPending = true;
  try { const result = fieldBossSnapshot(await action('get_field_bosses')); if (epoch === metadataEpoch(state, 'world') && state.field_boss_available) worldData = result; }
  catch {}
  finally { worldPending = false; tickTimers(); if (drawer === 'analysis' && tab === 'worldBosses') refreshDrawer(); if (epoch !== metadataEpoch(state, 'world') && state.field_boss_available && (prefs.activeEventId.startsWith('boss:') || drawer === 'analysis' && tab === 'worldBosses')) readWorldData(); }
}

function worldContent() {
  const timers = fieldBossTimers(worldData);
  return `${source(t('serverObserved'))}<p class="help">${t('worldHelp')}</p><div class="button-row">${button('refresh-world', 'refreshWorld', worldPending || !native ? 'disabled' : '', true)}</div>${timers.length ? timers.map(timer => `<div class="record-card"><div class="record-top"><strong>${t('map')} #${esc(timer.map_id)} · ${t('bossSlot')} #${esc(timer.slot_id)}</strong><time class="field-boss-countdown" data-boss-timer="${esc(timer.key)}"></time></div><div class="record-meta">${t('observedAt')}: ${dateText(timer.observed_at_ms)}${timer.position ? `<br>${timer.position.map(value => Number(value.toFixed(1))).join(' · ')}` : ''}</div><div class="button-row">${button('select-boss-timer', timer.key === prefs.activeEventId ? 'timerSelected' : 'useTimer', `data-id="${esc(timer.key)}"`, true)}</div></div>`).join('') : empty('noWorld')}`;
}

const reportMetric = value => value === null ? '—' : num(value);
function gameCounters(counters = {}) {
  const names = { TotalCount: 'hits', AccuracyCount: 'accuracy', CriticalCount: 'crit', PerfectCount: 'perfect', HardHitCount: 'hardHit', FrontAttackCount: 'front', BackAttackCount: 'back', AdditionalHitCount: 'additional', BlockCount: 'block', MissCount: 'miss', ImmuneCount: 'immune', IronWallCount: 'ironWall', RestorationCount: 'restoration' };
  return `<div class="quality-tags">${Object.entries(names).filter(([key]) => counters[key] !== null && counters[key] !== undefined).map(([key, label]) => `<span>${t(label)} <b>${fullNumber(counters[key])}</b></span>`).join('')}</div>`;
}

async function readComparisonRecord() {
  if (gameComparePending || !gameReport) return;
  gameComparePending = true;
  try { gameCompareRecord = snapshot || (native ? await action('get_current_encounter') : demo ? DEMO_STATE : null); }
  catch {}
  finally { gameComparePending = false; if (drawer === 'analysis' && tab === 'gameReport') refreshDrawer(); }
}

function gameReportContent() {
  const intro = `<p class="help">${t('gameReportHelp')}</p><label class="field"><span>${t('chooseGameReport')}</span><input name="gameReportFile" type="file"></label>`;
  if (!gameReport) return intro + empty('noGameReport');
  const comparison = gameCompareRecord ? comparePersonalReport(gameReport, gameCompareRecord) : { available: false, comparable: false, reason: 'identity-unresolved' };
  const comparisonMessage = t(comparison.comparable ? 'matchingWindow' : comparison.reason === 'identity-unresolved' ? 'comparisonNoIdentity' : comparison.reason === 'different-window' ? 'differentWindow' : comparison.reason === 'target-not-confirmed' ? 'comparisonTarget' : 'comparisonIncomplete');
  const total = gameReport.total_damage;
  return `${intro}${source(t('gameReportSource'))}<h3 class="section-title">${esc(gameReport.target_name || t('allCaption'))}</h3><div class="analysis-metrics"><div><span>${t('damage')}</span><strong>${num(total)}</strong></div><div><span>DPS</span><strong>${rate(gameReport.dps)}</strong></div><div><span>${t('gameDuration')}</span><strong>${clockTime(gameReport.duration_ms)}</strong></div><div><span>${t('gameHealing')}</span><strong>${reportMetric(gameReport.total_healing)}</strong></div><div><span>${t('gameTaken')}</span><strong>${reportMetric(gameReport.damage_taken)}</strong></div><div><span>${t('gameHps')}</span><strong>${gameReport.total_healing !== null && gameReport.duration_ms > 0 && gameReport.timing_present !== false ? rate(gameReport.total_healing * 1000 / gameReport.duration_ms) : '—'}</strong></div></div><p class="help">${t('reportClock')}: ${esc(gameReport.started_local.replace('T', ' '))} → ${esc(gameReport.ended_local.replace('T', ' '))}</p>${gameCounters(gameReport.counters)}${gameReport.skill_totals_match ? '' : `<p class="quality-warning">${t('reportSkillMismatch')}</p>`}<h3 class="section-title">${t('personalComparison')}</h3><div class="button-row">${button('refresh-comparison', 'refreshComparison', gameComparePending ? 'disabled' : '', true)}</div><p class="${comparison.comparable ? 'status-card' : 'quality-warning'}">${comparisonMessage}</p>${comparison.available ? `<div class="analysis-metrics"><div><span>Luma · ${t('personalDamage')}</span><strong>${num(comparison.luma_damage)}</strong></div><div><span>${t('gameReport')} · ${t('damage')}</span><strong>${num(comparison.game_damage)}</strong></div></div><div class="status-card">${t('difference')}: <strong>${comparison.difference >= 0 ? '+' : '−'}${num(Math.abs(comparison.difference))}</strong>${comparison.difference_percent === null ? '' : ` (${comparison.difference_percent >= 0 ? '+' : ''}${comparison.difference_percent.toFixed(2)}%)`}</div>` : ''}<h3 class="section-title">${t('skills')}</h3>${gameReport.skills.map(skill => `<div class="skill-row"><div class="skill-top"><span>${skillLabel(skill.id)}</span><strong>${num(skill.damage)} · ${total > 0 ? (skill.damage / total * 100).toFixed(1) : '0.0'}%</strong></div><div class="skill-track" style="--skill-share:${total > 0 ? Math.min(100, skill.damage / total * 100) : 0}%"><i></i></div>${gameCounters(skill.counters)}</div>`).join('')}`;
}

let historyNotebookStorage;
try { historyNotebookStorage = localStorage; } catch { historyNotebookError = 'storage-read-failed'; }
const historyNotebook = createHistoryNotebook({ storage: historyNotebookStorage, onError: error => { historyNotebookError = error; } });
const historyCache = native ? createHistoryCache({
  read: () => invoke('get_history'),
  normalizeRecord: normalizeEncounter,
  onChanged: () => { if (drawer === 'analysis' && tab === 'history') refreshHistoryDrawer(); if (drawer === 'analysis' && (tab === 'runs' || tab === 'bossLog')) refreshDrawer(); if (drawer === 'analysis' && tab === 'community') refreshCommunityDrawer(); },
  onRejected: () => { if (drawer === 'analysis' && tab === 'history') refreshHistoryDrawer(); },
}) : null;
// Tabs that read saved encounters; every other view skips the (very large) history transfer.
const HISTORY_TABS = new Set(['bossLog', 'history', 'runs', 'community', 'curves', 'rotation', 'healing', 'overview', 'effects', 'playback']);
const allHistory = () => [...(native ? historyCache.history : state.history).map(item => ({ item, imported: false })), ...prefs.importedHistory.map(item => ({ item, imported: true }))];
const communityController = createCommunityController({
  readState: () => native ? invoke('get_community_state') : Promise.resolve({ configured: false, shares: [] }),
  readStatistics: filters => native ? invoke('get_community_statistics', { filters }) : Promise.resolve({ cohorts: [] }),
  readRankings: filters => native ? invoke('get_community_rankings', { filters }) : Promise.resolve({ entries: [], total: 0 }),
  publish: (recordId, options) => invoke('create_community_share', { recordId, options }),
  revoke: id => invoke('revoke_community_share', { id }),
  onChanged: refreshCommunityDrawer,
});

function refreshCommunityDrawer() {
  if (drawer !== 'analysis' || tab !== 'community') return;
  const active = document.activeElement, name = $('#drawer-content').contains(active) ? active.name : '', caret = active?.selectionStart;
  refreshDrawer(name);
  if (name && Number.isInteger(caret)) { const field = $(`#drawer-content [name="${name}"]`); try { field?.setSelectionRange(caret, caret); } catch {} }
}

function communityContent() {
  return renderCommunity({ view: communityController.view, locale: prefs.locale, records: (native ? historyCache.history : state.history).filter(record => record.provenance !== 'imported-unverified'), currentRecord: communityCurrentRecord, draft: communityDraft, rankingDraft: communityRankingDraft, demo, native, revokeId: communityRevokeId, summaryText: communitySummaryText });
}

async function readCommunity() {
  if (communityController.view.readingState) return;
  communityOpened = true;
  await Promise.allSettled([communityController.refreshState(), native ? invoke('get_current_encounter').then(record => { communityCurrentRecord = record; refreshCommunityDrawer(); }) : Promise.resolve()]);
  if (communityController.view.state.configured) await communityController.refreshRankings(communityRankingDraft);
}

function captureCommunityForm(form) {
  if (form?.id === 'community-share-form') {
    const values = Object.fromEntries(new FormData(form));
    const options = communityShareOptions({ scope: values.communityScope, visibility: values.communityVisibility, anonymous: values.communityAnonymous === 'on', rank_opt_in: values.communityRankOptIn === 'on', context: Object.fromEntries(['region', 'server', 'boss', 'difficulty'].map(key => [key, values[`community${key[0].toUpperCase()}${key.slice(1)}`]])) });
    communityDraft = { recordId: String(values.communityRecordId || ''), ...options, consent: values.communityConsent === 'on' };
  }
  if (form?.id === 'community-rankings-form') {
    const values = Object.fromEntries(new FormData(form));
    communityRankingDraft = communityFilters({ class_name: values.rankingClass, cp_band: values.rankingCpBand, scope: values.rankingScope, ...Object.fromEntries(['region', 'server', 'boss', 'difficulty'].map(key => [key, values[`ranking${key[0].toUpperCase()}${key.slice(1)}`]])) });
  }
}

async function openCommunityUrl(url, visibility = 'public') {
  const safe = visibility === 'private' ? communityShareLink(url, visibility) : communityUrl(url); if (!safe) return;
  if (native) { try { await action('open_community_url', { url: safe }); } catch {} }
  else if (!demo) window.open(safe, '_blank', 'noopener,noreferrer');
}

const historyWords = {
  tr: { go: 'Ara', filters: 'Filtreler', transfer: 'Dışa / içe aktar', search: 'Geçmişte ara', searchHelp: 'Oyuncu, boss, sınıf, etiket veya not', scope: 'Ölçüm kapsamı', any: 'Tümü', source: 'Kayıt kaynağı', category: 'Kategori', difficulty: 'Zorluk', tags: 'Etiketler', tagsHelp: 'Virgülle ayır: farm, yeni ekipman', from: 'İlk tarih', to: 'Son tarih', sort: 'Sıralama', newest: 'En yeni', oldest: 'En eski', dps: 'En yüksek DPS', damage: 'En yüksek hasar', duration: 'En uzun karşılaşma', favorite: 'Favoriler önce', favoritesOnly: 'Yalnız favoriler', apply: 'Filtreleri uygula', reset: 'Temizle', matched: 'kayıt gösteriliyor', noMatches: 'Bu filtrelere uyan kayıt yok.', annotate: 'Not ve etiket', save: 'Kaydet', cancel: 'Kapat', note: 'Kişisel not', localHelp: 'Notlar, etiketler ve favoriler yalnız bu cihazda saklanır. Oyun kaydı ve paylaşılmış rapor değişmez.', saveFailed: 'Yerel not kaydedilemedi. Yazdıkların bu formda duruyor; cihaz depolamasını kontrol edip tekrar dene.', readFailed: 'Yerel notlar okunamadı. Kayıtlar kullanılabilir; önceki notlar yüklenemedi.', keyMissing: 'Bu kayıtta güvenilir tarih veya kimlik yok; yerel not eklenemiyor.', saved: 'Yerel not kaydedildi', favoriteAdd: 'Favorilere ekle', favoriteRemove: 'Favorilerden çıkar', compare: 'Gelişimi karşılaştır', trend: 'Kişisel boss gelişimi', trendHelp: 'Aynı karakter, sınıf, boss, zorluk ve kategorideki tam yerel kayıtları karşılaştırır. Grup hasarı kişisel DPS yerine geçmez.', trendEmpty: 'Karşılaştırmak için tam bir boss kaydına zorluk ekle ve “Gelişimi karşılaştır”ı seç.', trendPersonal: 'Gelişim karşılaştırması için ölçüm kapsamını Kişisel seç.', trendOne: 'Aynı koşullarda ikinci tam kayıt geldiğinde değişim gösterilir.', trendIncomplete: 'Bu kayıt tam karşılaştırma koşullarını sağlamıyor; kimlik, tek boss, süre ve hasar örnekleri doğrulanmalı.', trendDifficulty: 'Bu kayda zorluk ekleyip kaydet; aynı zorluktaki denemeler birlikte karşılaştırılır.', best: 'En iyi', median: 'Ortanca', previousChange: 'Önceki denemeye göre', noChange: 'İkinci kayıt bekleniyor', noteFor: 'Yerel not', dateError: 'Son tarih, ilk tarihten önce olamaz.', captured: 'Alınan kayıtlar', imported: 'İçe aktarılan', demo: 'Demo', recordMissing: 'Kayıt artık geçmişte bulunmuyor.', activeFilter: 'Uygulanan filtreler', trendSelected: 'Karşılaştırmada seçili' },
  en: { go: 'Search', filters: 'Filters', transfer: 'Export / import', search: 'Search history', searchHelp: 'Player, boss, class, tag or note', scope: 'Measurement scope', any: 'All', source: 'Record source', category: 'Category', difficulty: 'Difficulty', tags: 'Tags', tagsHelp: 'Separate with commas: farm, new gear', from: 'From date', to: 'Through date', sort: 'Sort', newest: 'Newest', oldest: 'Oldest', dps: 'Highest DPS', damage: 'Highest damage', duration: 'Longest encounter', favorite: 'Favorites first', favoritesOnly: 'Favorites only', apply: 'Apply filters', reset: 'Clear', matched: 'records shown', noMatches: 'No records match these filters.', annotate: 'Note and tags', save: 'Save', cancel: 'Close', note: 'Personal note', localHelp: 'Notes, tags and favorites stay on this device. They do not change the captured record or shared report.', saveFailed: 'The local note could not be saved. Your draft remains in this form; check device storage and retry.', readFailed: 'Local notes could not be read. Encounter records are available; previous notes did not load.', keyMissing: 'This record has no reliable date or identity; a local note cannot be attached.', saved: 'Local note saved', favoriteAdd: 'Add to favorites', favoriteRemove: 'Remove from favorites', compare: 'Compare progress', trend: 'Personal boss progress', trendHelp: 'Compares complete local records for the same character, class, boss, difficulty and category. Group damage is not substituted for personal DPS.', trendEmpty: 'Add a difficulty to a complete boss record, then choose “Compare progress”.', trendPersonal: 'Select Personal measurement scope to compare progress.', trendOne: 'A second complete record under the same conditions will show the change.', trendIncomplete: 'This record does not meet comparison requirements; identity, one boss, timing and damage samples must be confirmed.', trendDifficulty: 'Save a difficulty for this record to compare attempts at the same difficulty.', best: 'Best', median: 'Median', previousChange: 'From previous attempt', noChange: 'Waiting for a second record', noteFor: 'Local note', dateError: 'The end date cannot precede the start date.', captured: 'Received records', imported: 'Imported', demo: 'Demo', recordMissing: 'This record is no longer in history.', activeFilter: 'Applied filters', trendSelected: 'Selected for comparison' },
};
const historyLabel = key => historyWords[prefs.locale === 'tr' ? 'tr' : 'en'][key] || key;

function captureHistoryForm(form) {
  if (!form) return;
  const values = Object.fromEntries(new FormData(form));
  if (form.id === 'history-filter-form') historyFilterDraft = { ...historyFilterDraft, ...values, favoritesOnly: values.favoritesOnly === 'on' };
  if (form.id === 'history-note-form' && values.historyKey === historyEditKey) historyEditDraft = { tags: values.historyTags || '', note: values.historyNote || '', category: values.historyCategory || '', difficulty: values.historyDifficulty || '' };
}

function refreshHistoryDrawer() {
  if (drawer !== 'analysis' || tab !== 'history') return;
  captureHistoryForm($('#history-filter-form')); captureHistoryForm($('#history-note-form'));
  const active = document.activeElement, focusedForm = active?.form?.id, name = active?.name;
  let start = null, end = null;
  try { start = active?.selectionStart; end = active?.selectionEnd; } catch {}
  refreshDrawer();
  const form = focusedForm && document.getElementById(focusedForm), replacement = name && form?.elements.namedItem(name);
  if (replacement?.focus) { replacement.focus({ preventScroll: true }); if (Number.isInteger(start)) { try { replacement.setSelectionRange(start, end); } catch {} } }
}

function historyOptions(values) {
  const start = values.from ? new Date(`${values.from}T00:00:00`).getTime() : null;
  const end = values.to ? new Date(`${values.to}T23:59:59.999`).getTime() : null;
  return { ...values, from_ms: Number.isFinite(start) ? start : null, to_ms: Number.isFinite(end) ? end : null };
}

function historyTrendContent(records) {
  const trend = historyTrend(records, { selectedKey: historyTrendKey, scope: historyFilters.scope, notebook: historyNotebook });
  if (!trend.available) return '';
  const maximum = Math.max(...trend.points.map(point => point.dps), 1), latest = trend.latest;
  const delta = trend.change_percent === null ? historyLabel('noChange') : `${trend.change_percent >= 0 ? '+' : ''}${trend.change_percent.toFixed(1)}%`;
  return `<section class="history-trend"><h3>${historyLabel('trend')}</h3><p class="history-trend-context">${esc(latest.character)} · ${esc(latest.class_name)} · ${esc(latest.boss)} · ${esc(latest.difficulty)}${latest.category ? ` · ${esc(latest.category)}` : ''}</p><div class="history-trend-bars" role="img" aria-label="${esc(trend.points.map(point => `${dateText(point.timestamp)}: ${rate(point.dps)}`).join('; '))}">${trend.points.map((point, index) => `<span style="--history-level:${Math.max(2, point.dps / maximum * 100).toFixed(2)}%" title="${esc(`${dateText(point.timestamp)} · ${rate(point.dps)}`)}"><i></i><small>${index + 1}</small></span>`).join('')}</div><div class="analysis-metrics history-trend-metrics"><div><span>${historyLabel('best')}</span><strong>${rate(trend.best.dps)}</strong></div><div><span>${historyLabel('median')}</span><strong>${rate(trend.median_dps)}</strong></div><div><span>${historyLabel('previousChange')}</span><strong>${esc(delta)}</strong></div></div><p class="help">${historyLabel(trend.comparable ? 'trendHelp' : 'trendOne')}</p></section>`;
}

function historyNoteContent(records) {
  if (!historyEditKey) return '';
  const wrapped = records.find(value => historyRecordKey(value.item, { imported: value.imported }) === historyEditKey);
  if (!wrapped) return `<div class="quality-warning"><p>${historyLabel('recordMissing')}</p><button type="button" class="action-button secondary" data-action="history-close-note">${historyLabel('cancel')}</button></div>`;
  const value = historyEditDraft || historyNotebook.get(historyEditKey);
  return `<form id="history-note-form" class="history-note-form"><div class="record-top"><h3>${historyLabel('noteFor')} · ${esc(wrapped.item.name)}</h3><button type="button" class="action-button secondary" data-action="history-close-note">${historyLabel('cancel')}</button></div><input type="hidden" name="historyKey" value="${esc(historyEditKey)}"><div class="field-grid"><label class="field"><span>${historyLabel('category')}</span><input name="historyCategory" maxlength="48" value="${esc(value.category)}"></label><label class="field"><span>${historyLabel('difficulty')}</span><input name="historyDifficulty" maxlength="48" value="${esc(value.difficulty)}" placeholder="Normal / Hard / Nightmare"></label></div><label class="field"><span>${historyLabel('tags')}</span><input name="historyTags" maxlength="4096" value="${esc(Array.isArray(value.tags) ? value.tags.join(', ') : value.tags)}" placeholder="${esc(historyLabel('tagsHelp'))}"></label><label class="field"><span>${historyLabel('note')}</span><textarea name="historyNote" maxlength="1200" rows="3">${esc(value.note)}</textarea></label><p class="help">${historyLabel('localHelp')}</p><button type="submit" class="action-button">${historyLabel('save')}</button></form>`;
}

function bossLogContent() {
  const tr = prefs.locale === 'tr';
  const log = bossLog(allHistory().map(({ item }, index) => ({ item, index })), { scope: prefs.damageScope, locale: prefs.locale });
  const when = ms => ms ? dateText(ms) : '—';
  const fightRow = fight => `<div class="boss-fight"><span class="when">${when(fight.startedAt)} · ${clockTime(fight.elapsedMs)}${fight.imported ? ` · ${t('importedUnverified')}` : ''}</span><strong>${fight.dps === null ? '—' : rate(fight.dps)}</strong><small>${fight.damage === null ? '—' : num(fight.damage)}</small><div class="boss-actions"><button type="button" class="action-button secondary" data-action="view-history" data-index="${fight.index}" data-tab="skills">${tr ? 'Skiller' : 'Skills'}</button><button type="button" class="action-button secondary" data-action="view-history" data-index="${fight.index}" data-tab="curves" ${fight.chart ? '' : 'disabled'}>${tr ? 'Çizelge' : 'Chart'}</button>${fight.complete ? '' : `<span class="tag">${tr ? 'kısmi' : 'partial'}</span>`}</div></div>`;
  const card = (boss, openFirst) => `<details class="history-more boss-card" data-state-key="boss:${esc(boss.name)}"${openFirst ? ' open' : ''}><summary><strong>${esc(boss.name)}</strong><span class="boss-sum">${boss.count} ${tr ? 'savaş' : 'fights'} · ${tr ? 'en iyi' : 'best'} ${boss.bestDps === null ? '—' : `${rate(boss.bestDps)} DPS`} · ${when(boss.lastAt)}</span></summary><div class="boss-fights">${boss.fights.slice(0, 25).map(fightRow).join('')}${boss.count > 25 ? `<p class="help">+${boss.count - 25}</p>` : ''}</div></details>`;
  return `<section class="boss-log"><p class="help">${tr ? 'Bir boss ile yaptığın her savaş burada boss adına göre gruplanır. Rakamlar seçili kapsama göre hesaplanır; “Skiller” oyuncu ve skill bazında hasarı, “Çizelge” zamana göre hasarı açar.' : 'Every fight you had with a boss is grouped here by boss name. Figures follow the selected scope; “Skills” opens damage per player and skill, “Chart” opens damage over time.'}</p>${log.length ? log.map((boss, index) => card(boss, index === 0)).join('') : `<p class="status-card">${tr ? 'Henüz boss kaydı yok. Bir boss ile savaştığında burada listelenir.' : 'No boss fights recorded yet. They appear here after you fight a boss.'}</p>`}</section>`;
}

function historyContent() {
  const records = allHistory(), result = queryHistory(records, historyOptions(historyFilters), historyNotebook), draft = historyFilterDraft;
  const hasImported = records.some(({ item, imported }) => imported || item.provenance === 'imported-unverified' || item.source === 'imported');
  const activeFilters = ['source', 'category', 'difficulty', 'tags', 'from', 'to'].filter(name => draft[name]).length + (draft.favoritesOnly ? 1 : 0);
  const select = (name, label, value, options) => `<label class="field"><span>${historyLabel(label)}</span><select name="${name}">${options.map(([key, text]) => `<option value="${esc(key)}" ${value === key ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
  const filter = `<form id="history-filter-form" class="history-filter-form"><div class="history-bar"><label class="field history-search"><span class="sr-only">${historyLabel('search')}</span><input type="search" name="query" maxlength="160" value="${esc(draft.query)}" placeholder="${esc(historyLabel('searchHelp'))}"></label><button type="submit" class="action-button">${historyLabel('go')}</button></div><details class="history-more" data-state-key="history-filters"><summary>${historyLabel('filters')}${activeFilters ? ` · ${activeFilters}` : ''}</summary><div class="field-grid">${select('scope', 'scope', draft.scope, ['personal', 'party', 'observed'].map(value => [value, t(value)]))}${select('sort', 'sort', draft.sort, ['newest', 'oldest', 'dps', 'damage', 'duration', 'favorite'].map(value => [value, historyLabel(value)]))}${select('source', 'source', draft.source, [['', historyLabel('any')], ['received', historyLabel('captured')], ['imported', historyLabel('imported')], ['demo', historyLabel('demo')]])}${select('category', 'category', draft.category, [['', historyLabel('any')], ...[...new Set([...result.categories, draft.category].filter(Boolean))].map(value => [value, value])])}${select('difficulty', 'difficulty', draft.difficulty, [['', historyLabel('any')], ...[...new Set([...result.difficulties, draft.difficulty].filter(Boolean))].map(value => [value, value])])}<label class="field"><span>${historyLabel('tags')}</span><input name="tags" maxlength="4096" value="${esc(draft.tags)}" placeholder="${esc(historyLabel('tagsHelp'))}"></label><label class="field"><span>${historyLabel('from')}</span><input type="date" name="from" value="${esc(draft.from)}"></label><label class="field"><span>${historyLabel('to')}</span><input type="date" name="to" value="${esc(draft.to)}"></label></div><label class="check-field"><input type="checkbox" name="favoritesOnly" ${draft.favoritesOnly ? 'checked' : ''}>${historyLabel('favoritesOnly')}</label><div class="button-row"><button type="button" class="action-button secondary" data-action="history-reset-filters">${historyLabel('reset')}</button></div></details></form>`;
  const cards = result.entries.map(({ item, imported, source: recordSource, index, key, annotation, scoped }) => `<article class="record-card history-record${annotation.favorite ? ' is-favorite' : ''}"><div class="record-top"><strong>${annotation.favorite ? '<span class="history-star" aria-hidden="true">★</span> ' : ''}${esc(item.name)}</strong>${source(imported ? t('importedUnverified') : recordSource === 'demo' || demo ? t('sourceDemo') : t('sourceActual'))}</div><div class="record-meta">${esc(dateText(item.timestamp || item.started_ms))} · ${clockTime(scoped.elapsed)} · ${t(historyFilters.scope)}<br>${scoped.known ? rate(scoped.dps) : '—'} DPS · ${scoped.known ? num(scoped.damage) : '—'} ${t('damage').toLowerCase()}${item.timing_valid === false ? `<br>${t('timingUnavailable')}` : ''}</div>${annotation.category || annotation.difficulty || annotation.tags.length ? `<div class="history-labels">${[annotation.category, annotation.difficulty, ...annotation.tags].filter(Boolean).map(value => `<span class="tag">${esc(value)}</span>`).join('')}</div>` : ''}${annotation.note ? `<p class="history-note-preview">${esc(Array.from(annotation.note).slice(0, 180).join(''))}${Array.from(annotation.note).length > 180 ? '…' : ''}</p>` : ''}<div class="button-row">${button('view-history', 'replay', `data-index="${index}"`, true)}<button type="button" class="action-button secondary history-favorite" data-action="history-favorite" data-key="${esc(key || '')}" aria-pressed="${annotation.favorite}" title="${esc(historyLabel(annotation.favorite ? 'favoriteRemove' : 'favoriteAdd'))}" ${key ? '' : 'disabled'}>${annotation.favorite ? '★' : '☆'}<span class="sr-only"> ${historyLabel(annotation.favorite ? 'favoriteRemove' : 'favoriteAdd')}</span></button><button type="button" class="action-button secondary" data-action="history-edit-note" data-key="${esc(key || '')}" ${key ? '' : 'disabled'}>${historyLabel('annotate')}</button><button type="button" class="action-button secondary" data-action="history-compare" data-key="${esc(key || '')}" aria-pressed="${key === historyTrendKey}" ${key ? '' : 'disabled'}>${historyLabel(key === historyTrendKey ? 'trendSelected' : 'compare')}</button></div>${key ? '' : `<p class="help">${historyLabel('keyMissing')}</p>`}</article>`).join('');
  return `<section class="history-page">${historyCache?.failed ? `<div class="status-card history-error"><p>${t('historyReadFailed')}</p>${button('retry-history', 'historyRetry', '', true)}</div>` : ''}${historyNotebookError ? `<p class="quality-warning" role="status">${historyLabel(historyNotebookError === 'storage-read-failed' ? 'readFailed' : 'saveFailed')}</p>` : ''}${state.history_storage_error ? `<p class="quality-warning" role="status">${t('historyStorageWarning')} <small>${esc(state.history_storage_error)}</small></p>` : ''}${filter}<p class="history-result-count" aria-live="polite">${result.matched} / ${result.total} ${historyLabel('matched')} · ${t(historyFilters.scope)}</p>${historyTrendContent(records)}${historyNoteContent(records)}<div class="history-records">${records.length ? cards || `<p class="help">${historyLabel('noMatches')}</p>` : historyCache?.failed ? '' : empty('noHistory')}</div><details class="history-more history-transfer" data-state-key="history-transfer"><summary>${historyLabel('transfer')}</summary><p class="help">${t('historyHelp')}</p>${reportToolbar(true)}${hasImported ? `<div class="button-row">${button('clear-imported', 'clearImported', historyClearPending ? 'disabled' : '', true)}</div>` : ''}</details><input id="history-file" class="sr-only" type="file" accept=".json,application/json" tabindex="-1"></section>`;
}

function plannerContent() {
  return `<div id="automatic-odyle">${odyleContent()}</div><hr class="divider">${source(t('sourceManual'))}<p class="help">${t('manualHelp')}</p><h3 class="section-title">${t('equipment')}</h3>${prefs.equipment.length ? prefs.equipment.map(item => `<div class="record-card"><div class="record-top"><strong>${esc(item.name)}</strong>${button('delete-equipment', 'delete', `data-id="${esc(item.id)}"`, true)}</div><div class="record-meta">${esc(item.note)}</div></div>`).join('') : empty('noEquipment')}
    <form id="equipment-form">${field('equipmentName', 'equipmentName', 'text', '', 'maxlength="64" required')}<label class="field"><span>${t('note')}</span><textarea name="note" maxlength="200"></textarea></label><button class="action-button" type="submit">${t('add')}</button></form><hr class="divider">
    <h3 class="section-title">${t('cooldowns')} ${source(t('sourceManual'))}</h3><p class="help">${t('manualTimerHelp')}</p>${prefs.manualCooldowns.map(item => `<div class="record-card"><div class="record-top"><strong>${esc(item.name)}</strong><span class="manual-countdown" data-cooldown="${esc(item.id)}"></span></div><div class="record-meta">${item.seconds} s</div><div class="button-row">${button('start-cooldown', 'start', `data-id="${esc(item.id)}"`)}${button('delete-cooldown', 'delete', `data-id="${esc(item.id)}"`, true)}</div></div>`).join('')}
    <form id="cooldown-form">${field('cooldownName', 'cooldownName', 'text', '', 'maxlength="64" required')}${field('seconds', 'seconds', 'number', 60, 'min="1" max="86400" required')}<button class="action-button" type="submit">${t('add')}</button></form>
    <h3 class="section-title">${t('actualCooldowns')}</h3><div id="actual-cooldowns">${actualCooldownCards()}</div><hr class="divider">
    <h3 class="section-title">${t('odyle')} ${source(t('sourceManual'))}</h3><div class="status-card"><span>${t('estimate')}</span><br><strong id="odyle-estimate">${fullNumber(manualOdyle(prefs.odyle))}</strong></div><p class="help">${t('estimateHelp')}</p><form id="odyle-form"><div class="field-grid">${field('current', 'balance', 'number', prefs.odyle.current, 'min="0" max="1000000"')}${field('max', 'cap', 'number', prefs.odyle.max, 'min="0" max="1000000"')}${field('refill', 'refill', 'number', prefs.odyle.refill, 'min="0" max="1000000"')}${field('intervalMinutes', 'refillInterval', 'number', prefs.odyle.intervalMinutes, 'min="0" max="10080"')}</div>${field('anchor', 'anchor', 'datetime-local', toLocalInput(prefs.odyle.anchor))}<button class="action-button" type="submit">${t('savePlan')}</button></form>`;
}

function alertsContent() {
  return `<p class="help">${t('alertHelp')}</p><form id="alerts-form">${field('dpsGoal', 'dpsGoal', 'number', prefs.alerts.dpsGoal, 'min="0" max="1000000000000"')}${field('eventLeadMinutes', 'eventLead', 'number', prefs.alerts.eventLeadMinutes, 'min="0" max="60"')}<label class="check-field"><input name="incomingWarnings" type="checkbox" ${prefs.alerts.incomingWarnings ? 'checked' : ''}>${t('incomingWarnings')}</label><label class="check-field"><input name="bossCasts" type="checkbox" ${prefs.alerts.bossCasts ? 'checked' : ''}>${t('bossCastsLabel')}</label><label class="check-field"><input name="sound" type="checkbox" ${prefs.alerts.sound ? 'checked' : ''}>${t('sound')}</label><p class="help">${t('soundHelp')}</p><button type="submit" class="action-button">${t('savePlan')}</button></form><hr class="divider"><div id="alert-status" class="status-card"></div>`;
}

function actualCooldownText(value) {
  if (value?.unit === 'milliseconds') {
    const row = automaticTeamState({ ...state, actor_cooldowns: [value] }).members.flatMap(member => member.cooldowns).find(row => row.skill_id === value.skill_id && String(row.actor_id) === String(value.actor_id));
    if (!row) return '—';
    const label = row.ready_confirmed ? t('readyConfirmed') : row.available_use_confirmed ? t('charges') : row.remaining_ms === 0 ? t('timerElapsed') : row.remaining_ms === null ? '—' : `${row.provisional ? '~' : ''}${clockTime(row.remaining_ms)}`;
    return `${label}${row.charges === null ? '' : ` · ${t('charges')}: ${row.charges}`}${row.recharge_remaining_ms > 0 ? ` · ${prefs.locale === 'tr' ? 'Dolum' : 'Recharge'}: ${clockTime(row.recharge_remaining_ms)}` : ''}`;
  }
  const cooldown = cooldownObservation(value, { localPlayerId: liveServerActorId(state) });
  const label = cooldown.kind === 'confirmed' ? t('readyConfirmed') : cooldown.kind === 'elapsed' ? t('timerElapsed') : cooldown.kind === 'countdown' ? `~${clockTime(cooldown.remaining)} · ${t('estimatedCooldown')}` : cooldown.raw_units !== null ? t('counterLearning') : '—';
  return `${label}${cooldown.charges === null ? '' : ` · ${t('charges')}: ${cooldown.charges}`}`;
}

function actualCooldownCards() {
  return state.cooldowns.length ? state.cooldowns.map((value, index) => `<div class="record-card">${esc(value?.name || skillLabel(value?.skill_id ?? '?'))} ${source(t('serverObserved'))}<div class="record-meta actual-cooldown" data-actual-cooldown-index="${index}">${esc(actualCooldownText(value))}</div></div>`).join('') : empty('noActualCooldowns');
}

function automaticOdyle() { return resourceStatus(state.resources, Date.now(), liveServerActorId(state)); }

function odyleContent() {
  const value = automaticOdyle();
  return `<h3 class="section-title">${t('autoOdyle')} ${source(demo ? t('sourceDemo') : t('serverObserved'))}</h3>${value.available ? `<div class="odyle-card"><div><span>${t('odyleRegular')}</span><strong>${fullNumber(value.base)} <small>/ ${value.base_capacity ?? '—'}</small></strong></div><div><span>${t('odyleBonus')}</span><strong>+${fullNumber(value.bonus)}</strong></div><div class="odyle-total"><span>${t('odyleTotal')}</span><strong>${fullNumber(value.total)}</strong></div></div><p class="help">${t('observedTime')}: ${esc(dateText(value.observed_at_ms))}${value.base_capacity === null ? '' : `<br>${t('odyleCapacity')}`}</p>` : `<p class="help">${t('odyleWaiting')}</p>`}`;
}

function renderLiveTools() {
  const value = automaticOdyle(), team = automaticTeamState(state), strip = $('#live-tools');
  strip.hidden = false;
  $('#odyle-chip').hidden = !prefs.displayModules.odyle || !value.available && !(prefs.layout === 'cupertino' && hudPanelVisible(prefs, 'odyle'));
  setText($('#odyle-chip'), `Odyle ${value.available ? fullNumber(value.total) : prefs.locale === 'tr' ? '· veri bekleniyor' : '· waiting for data'}`);
  $('#odyle-chip').title = `${t('odyleRegular')}: ${value.base ?? '—'} / ${value.base_capacity ?? '—'} · ${t('odyleBonus')}: ${value.bonus ?? '—'}`;
  $('#team-chip').hidden = !prefs.displayModules.team || !team.total_members && !roomIntent && !(prefs.layout === 'cupertino' && hudPanelVisible(prefs, 'team'));
  setText($('#team-chip'), roomIntent ? `${prefs.locale === 'tr' ? 'Paylaşım açık' : 'Sharing active'}${team.total_cooldowns ? ` · ${team.total_cooldowns} CD` : ''}` : team.total_cooldowns ? `${t('team')} · ${team.total_cooldowns} CD` : `${t('team')} · ${team.total_members}`);
  $('#team-chip').title = `${prefs.locale === 'tr' ? 'Oyundan otomatik takım cooldown takibi' : 'Automatic team cooldowns from game data'}${roomIntent ? prefs.locale === 'tr' ? ' · Cihazlar arası paylaşım açık' : ' · Cross-device sharing active' : ''}`;
  if (!team.total_members && !roomIntent) setText($('#team-chip'), prefs.locale === 'tr' ? 'Takım · veri bekleniyor' : 'Team · waiting for data');
  const liveOdyle = $('#automatic-odyle');
  const fingerprint = JSON.stringify([prefs.locale, value.available, value.actor_id, value.base, value.bonus, value.base_capacity, value.observed_at_ms]);
  if (liveOdyle && liveOdyle.dataset.fingerprint !== fingerprint) { liveOdyle.innerHTML = odyleContent(); liveOdyle.dataset.fingerprint = fingerprint; }
  renderPetTracking();
  renderLiveRadar();
  strip.hidden = ![...strip.querySelectorAll('button')].some(button => !button.hidden);
}

function teamContent() {
  return `<div id="team-live">${renderTeam(teamState, teamOptions())}</div><div id="team-copy-host"></div><details class="team-raw-counters"><summary>${t('actualCooldowns')} · ${prefs.locale === 'tr' ? 'ham sayaçlar' : 'raw counters'}</summary><p class="help">${t('ownCooldownHelp')}</p><div id="actual-cooldowns">${actualCooldownCards()}</div></details>`;
}

function teamOptions() { return { locale: prefs.locale, state, native, busy: teamBusy, consent: teamConsent, classFilter: teamClassFilter, relayActive: roomIntent }; }

function showInviteFallback() {
  const host = $('#team-copy-host'); if (!host || !teamInviteCopy) return;
  let field = host.querySelector('textarea');
  if (!field) { field = document.createElement('textarea'); field.readOnly = true; field.className = 'team-copy-field'; field.setAttribute('aria-label', 'Luma invite'); host.append(field); }
  field.value = teamInviteCopy; field.focus(); field.select();
}

function updateTeamLive() {
  const host = $('#team-live'); if (!host) return;
  const active = host.contains(document.activeElement) ? document.activeElement : null;
  const form = $('#team-join-form');
  if (form) { teamInviteDraft = form.elements.teamInvite?.value || teamInviteDraft; teamConsent = form.elements.teamConsent?.checked === true; }
  // Preserve the join form while typing. Active-room observations still expire
  // while a copy/leave button or a details summary holds keyboard focus.
  if (active?.closest('#team-join-form') && !teamBusy) {
    const automatic = host.querySelector('.automatic-team');
    const html = renderAutomaticTeam(state, teamOptions());
    if (automatic && automatic.dataset.html !== html) { automatic.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild.innerHTML; automatic.dataset.html = html; }
    host.dataset.html = ''; return;
  }
  const focusedAction = active?.dataset.action;
  const focusedName = active?.name;
  const focusedPeer = active?.closest('[data-team-peer]')?.dataset.teamPeer;
  const detailKey = node => `${node.className}:${node.closest('[data-team-peer]')?.dataset.teamPeer || node.closest('[data-automatic-actor]')?.dataset.automaticActor || ''}`;
  const focusedDetail = active?.closest('summary')?.parentElement;
  const focusedDetailKey = focusedDetail ? detailKey(focusedDetail) : null;
  const expanded = new Map([...host.querySelectorAll('details')].map(node => [detailKey(node), node.open]));
  const html = renderTeam(teamState, teamOptions());
  if (host.dataset.html === html) return;
  host.innerHTML = html; host.dataset.html = html;
  if ($('#team-invite')) $('#team-invite').value = teamInviteDraft;
  for (const detail of host.querySelectorAll('details')) if (expanded.has(detailKey(detail))) detail.open = expanded.get(detailKey(detail));
  if ($('#team-join-form')) $('#team-join-form').elements.teamConsent.checked = teamConsent;
  if (focusedAction) [...host.querySelectorAll('[data-action]')].find(node => node.dataset.action === focusedAction)?.focus({ preventScroll: true });
  else if (focusedName) [...host.querySelectorAll('[name]')].find(node => node.name === focusedName)?.focus({ preventScroll: true });
  else if (focusedPeer) [...host.querySelectorAll('[data-team-peer]')].find(node => node.dataset.teamPeer === focusedPeer)?.querySelector('summary')?.focus({ preventScroll: true });
  else if (focusedDetailKey !== null) [...host.querySelectorAll('details')].find(node => detailKey(node) === focusedDetailKey)?.querySelector('summary')?.focus({ preventScroll: true });
}

async function readTeamState() {
  if (!native || teamPolling || teamBusy) return;
  const epoch = teamRequestEpoch; teamPolling = true;
  try { const value = await invoke('get_team_state'); if (epoch === teamRequestEpoch) { roomIntent = value?.enabled === true; teamState = teamSnapshot(value, { previous: teamState }); } }
  catch { if (epoch === teamRequestEpoch && roomIntent) teamState = { ...teamState, status: 'error', error: 'unavailable' }; }
  finally { teamPolling = false; renderLiveTools(); updateTeamLive(); }
}

async function teamAction(command) {
  if (!native || teamBusy || command !== 'leave_team_room' && !teamConsent) return;
  teamRequestEpoch++; teamBusy = true; teamInviteCopy = ''; $('#team-copy-host')?.replaceChildren(); updateTeamLive();
  try {
    const value = await invoke(command, command === 'join_team_room' ? { invite: teamInviteDraft } : undefined);
    roomIntent = value?.enabled === true; teamState = teamSnapshot(value); teamInviteDraft = ''; teamConsent = false;
  } catch {
    if (command === 'leave_team_room') {
      try { const value = await invoke('get_team_state'); roomIntent = value?.enabled === true; teamState = teamSnapshot(value); } catch {}
      toast(prefs.locale === 'tr' ? 'Yerel paylaşım durdu. Sunucudaki kapanış doğrulanamadı; oda en geç süresi dolunca kapanır.' : 'Local sharing stopped. Remote closure could not be confirmed; the room expires automatically.', true);
    } else toast(t('failed'), true);
  }
  finally { teamBusy = false; if (drawer === 'analysis' && tab === 'team') refreshDrawer(); renderLiveTools(); }
}

function renderDrawerContent() {
  if (!drawer) return;
  if (tab !== 'playback') playback.pause();
  const analysisSections = visibleAnalysisSections(ANALYSIS_SECTIONS, prefs), settingsSections = visibleSettingsSections(SETTINGS_SECTIONS, prefs);
  if (drawer === 'analysis' && !analysisSections.includes(tab)) tab = analysisSections[0] || 'pets';
  if (drawer === 'settings' && !settingsSections.includes(settingsTab)) settingsTab = 'appearance';
  $('#drawer-title').textContent = t(drawer === 'settings' ? 'settings' : drawer === 'character' ? 'character' : 'analysis');
  $('.drawer-header').title = native ? t('dragPanel') : '';
  $('#drawer-tabs').hidden = drawer === 'character';
  $('#drawer-tabs').setAttribute('aria-label', t(drawer === 'settings' ? 'settingsSections' : 'analysisSections'));
  let shownSections = drawer === 'settings' ? settingsSections : analysisSections;
  const groupsNav = $('#drawer-groups');
  if (drawer === 'analysis') {
    const groups = ANALYSIS_GROUPS.map(group => ({ ...group, sections: group.sections.filter(name => analysisSections.includes(name)) })).filter(group => group.sections.length);
    const current = groups.find(group => group.sections.includes(tab));
    if (current) shownSections = current.sections;
    const markup = groups.length > 1 ? groups.map(group => `<button type="button" data-group="${group.id}" aria-pressed="${group === current}">${t(group.id)}</button>`).join('') : '';
    if (groupsNav._markup !== markup) { groupsNav.innerHTML = markup; groupsNav._markup = markup; }
    groupsNav.hidden = !markup;
  } else groupsNav.hidden = true;
  if (drawer !== 'character') {
    const active = drawer === 'settings' ? settingsTab : tab;
    const tabs = shownSections.map(name => `<button type="button" id="drawer-tab-${drawer}-${name}" role="tab" data-tab="${name}" aria-controls="${drawer === 'settings' ? `drawer-panel-settings-${name}` : 'drawer-content'}" aria-selected="${active === name}" tabindex="${active === name ? 0 : -1}">${t(name)}</button>`).join('');
    if (drawerTabsFingerprint !== tabs) { $('#drawer-tabs').innerHTML = tabs; drawerTabsFingerprint = tabs; }
  }
  const contentHost = $('#drawer-content');
  if (drawer === 'settings') {
    contentHost.removeAttribute('role'); contentHost.removeAttribute('aria-labelledby');
    if (!settingsPanels.size) {
      for (const name of SETTINGS_SECTIONS) {
        const node = document.createElement('section'); node.className = 'settings-panel'; node.hidden = name !== settingsTab;
        node.id = `drawer-panel-settings-${name}`; node.setAttribute('role', 'tabpanel');
        node.setAttribute('aria-labelledby', `drawer-tab-settings-${name}`);
        settingsPanels.set(name, { node, fingerprint: '', scroll: 0 }); contentHost.append(node);
      }
    }
    const panel = settingsPanels.get(settingsTab);
    for (const [name, value] of settingsPanels) value.node.hidden = name !== settingsTab;
    const content = settingsContent();
    if (panel.fingerprint !== content) {
      const drafts = [...panel.node.querySelectorAll('form')].filter(form => dirtySettingsForms.has(form.id)).map(form => ({ id: form.id, values: captureFormDraft(form) }));
      const details = [...panel.node.querySelectorAll('details')].map(detail => detail.open);
      panel.node.innerHTML = content; panel.fingerprint = content;
      for (const draft of drafts) { const form = panel.node.querySelector(`#${draft.id}`); if (form) restoreFormDraft(form, draft.values); }
      [...panel.node.querySelectorAll('details')].forEach((detail, index) => { if (details[index] !== undefined) detail.open = details[index]; });
    }
    tickTimers(); return;
  }
  contentHost.setAttribute('role', drawer === 'analysis' ? 'tabpanel' : 'region');
  contentHost.setAttribute('aria-labelledby', drawer === 'analysis' ? `drawer-tab-analysis-${tab}` : 'drawer-title');
  const content = drawer === 'character' ? characterContent() : ({ bossLog: bossLogContent, overview: overviewContent, rotation: rotationContent, healing: healingContent, runs: runsContent, skills: skillsContent, training: trainingContent, records: recordsContent, radar: radarContent, playback: replayContent, curves: curvesContent, effects: effectsContent, team: teamContent, pets: petsContent, build: buildContent, worldBosses: worldContent, gameReport: gameReportContent, history: historyContent, community: communityContent, planner: plannerContent, alerts: alertsContent }[tab])();
  if (drawerContentFingerprint !== content) { const details = new Map([...contentHost.querySelectorAll('details[data-state-key]')].map(node => [node.dataset.stateKey, node.open])); const activeName = contentHost.contains(document.activeElement) ? document.activeElement.name : ''; contentHost.innerHTML = content; for (const node of contentHost.querySelectorAll('details[data-state-key]')) if (details.has(node.dataset.stateKey)) node.open = details.get(node.dataset.stateKey); if (activeName) contentHost.querySelector(`[name="${activeName}"]`)?.focus({ preventScroll: true }); drawerContentFingerprint = content; }
  tickTimers();
  if (drawer === 'analysis' && tab === 'effects') renderEffectLists();
}

const syncNativePanel = native ? createPanelSynchronizer(open => invoke('set_panel_open', { open }), () => toast(t('panelResizeFailed'), true)) : () => Promise.resolve();

function selectDrawerTab(name) {
  if (drawer === 'settings') {
    const previous = settingsPanels.get(settingsTab);
    if (previous) previous.scroll = $('#drawer-content').scrollTop;
    settingsTab = settingsSection(name); renderDrawerContent();
    $('#drawer-content').scrollTop = settingsPanels.get(settingsTab)?.scroll || 0;
    if (settingsTab === 'hiddenCube') readCubeState();
    if (['controls', 'about'].includes(settingsTab)) readRuntimeState();
  } else if (drawer === 'analysis' && visibleAnalysisSections(ANALYSIS_SECTIONS, prefs).includes(name)) {
    if (['training', 'effects', 'pets', 'radar'].includes(name)) snapshot = null;
    if (name === 'playback') { playbackAwaitCurrent = !snapshot; playbackRecord = snapshot || null; playback.pause(); playback.seek(0, 0); }
    tab = name; $('#drawer-content').scrollTop = 0; renderDrawerContent();
    if (name === 'history' || name === 'bossLog') historyCache?.retry();
    if (name === 'community') { historyCache?.retry(); if (!communityOpened) readCommunity(); }
    if (name === 'team') readTeamState();
    if (['curves', 'rotation', 'healing', 'overview', 'effects', 'playback'].includes(name)) { historyCache?.retry(); readCurveRecord(); }
    if (name === 'runs') historyCache?.retry();
    if (name === 'records') readRecords();
    if (name === 'effects') readAssistTimeline();
    if (['build', 'pets'].includes(name)) readCharacterData();
    if (name === 'worldBosses') readWorldData();
  } else return;
  const selected = $(`#drawer-tabs [data-tab="${name}"]`); selected?.focus({ preventScroll: true });
  if (selected) requestAnimationFrame(() => {
    if (!selected.isConnected) return;
    const nav = $('#drawer-tabs'), edge = nav.getBoundingClientRect(), target = selected.getBoundingClientRect();
    if (target.left < edge.left) nav.scrollLeft += target.left - edge.left;
    else if (target.right > edge.right) nav.scrollLeft += target.right - edge.right;
  });
}

function openDrawer(kind, requestedTab = 'overview') {
  if (toolsOpen) { closeTools(); }
  if (pvpPopoverOpen) setPvpPopover(false);
  if (kind === 'analysis') { const allowed = visibleAnalysisSections(ANALYSIS_SECTIONS, prefs); if (!allowed.length) { kind = 'settings'; requestedTab = 'appearance'; } else if (!allowed.includes(requestedTab)) requestedTab = allowed[0]; }
  if (!drawer) restoreFocus = document.activeElement;
  drawer = kind; tab = requestedTab;
  if (kind === 'analysis' && requestedTab === 'playback') { playbackAwaitCurrent = !snapshot; playbackRecord = snapshot || null; playback.pause(); playback.seek(0, 0); }
  if (kind === 'settings') settingsTab = settingsSection(requestedTab);
  settingsPanels.clear(); dirtySettingsForms.clear(); $('#drawer-content').replaceChildren(); $('#drawer-content').scrollTop = 0;
  drawerContentFingerprint = ''; drawerTabsFingerprint = '';
  $('#meter').classList.remove('compact-strip');
  $('#drawer').hidden = false; $('#drawer-backdrop').hidden = false;
  // Make the underlying frame inert while retaining the modal as its sibling.
  for (const element of [...$('#meter').children]) if (!['drawer', 'drawer-backdrop', 'toast'].includes(element.id)) element.inert = true;
  renderDrawerContent();
  if (kind === 'analysis' && (requestedTab === 'history' || requestedTab === 'bossLog')) historyCache?.retry();
  if (kind === 'analysis' && requestedTab === 'team') readTeamState();
  if (kind === 'analysis' && requestedTab === 'community') { historyCache?.retry(); if (!communityOpened) readCommunity(); }
  if (kind === 'analysis' && ['curves', 'rotation', 'healing', 'overview', 'effects', 'playback'].includes(requestedTab)) { historyCache?.retry(); readCurveRecord(); }
  if (kind === 'analysis' && requestedTab === 'runs') historyCache?.retry();
  if (kind === 'analysis' && requestedTab === 'records') readRecords();
  if (kind === 'analysis' && requestedTab === 'effects') readAssistTimeline();
  if (kind === 'analysis' && ['build', 'pets'].includes(requestedTab)) { if (requestedTab === 'pets') snapshot = null; readCharacterData(); }
  if (kind === 'analysis' && requestedTab === 'worldBosses') readWorldData();
  if (kind === 'settings') { readRuntimeState(); readObsState(); readEventSchedule(); if (settingsTab === 'hiddenCube') readCubeState(); }
  $('#close-drawer').focus();
  syncOverlayGeometry(); syncNativePanel(true);
}

function closeDrawer() {
  playback.pause();
  if (!drawer) return;
  drawer = ''; snapshot = null; skillsFromTargetBoard = false; selectedBoardPlayerDetail = null; teamInviteCopy = ''; teamInviteDraft = ''; teamConsent = false;
  $('#drawer').hidden = true; $('#drawer-backdrop').hidden = true;
  for (const element of [...$('#meter').children]) element.inert = false;
  if (restoreFocus?.isConnected && restoreFocus.getClientRects().length && !restoreFocus.disabled) restoreFocus.focus(); else $('#analysis-button').focus();
  syncNativePanel(false); applyAppearance();
}

function refreshDrawer(focusName) {
  const scroll = $('#drawer-content').scrollTop;
  renderDrawerContent(); $('#drawer-content').scrollTop = scroll;
  if (focusName) $(`#drawer-content [name="${focusName}"]`)?.focus();
}

let audioContext;
function enableAudio() {
  if (!prefs.alerts.sound) return;
  try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume(); } catch {}
}
function beep() {
  if (!prefs.alerts.sound || !audioContext || audioContext.state !== 'running') return;
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(720, audioContext.currentTime);
  gain.gain.setValueAtTime(0.03, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.22);
  oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + 0.22);
}

function tickTimers() {
  renderRecordNotice();
  renderTargetPetPin();
  scheduleOverlayRegions();
  $('#meter').classList.toggle('idle-fade', prefs.fadeWhenIdle && !drawer && !state.encounter_active && !['combat', 'combat_active'].includes(state.status));
  if (telemetryDemo) state.actor_cooldowns = state.actor_cooldowns.map(row => ({ ...row, sampled_at_ms: Date.now() }));
  const event = activeEvent(), bossTimer = chosenBossTimer(), scheduled = event ? scheduleTiming(event) : null, timing = scheduled ? { next: scheduled.nextOpening, remaining: scheduled.remainingMs } : bossTimer?.status === 'countdown' ? { next: bossTimer.server_time_ms, remaining: bossTimer.remaining } : null;
  const timerName = event?.name || (bossTimer ? `${t('map')} #${bossTimer.map_id} · #${bossTimer.slot_id}` : '');
  $('#event-chip').hidden = !timing && !bossTimer;
  document.documentElement.style.setProperty('--header-row', `${compactHeaderHeight(prefs.targetFontSize, Boolean(timing || bossTimer))}px`);
  const selectedReminder = event ? eventReminder(event) : null;
  if (timing) { $('#event-name').textContent = timerName; $('#event-time').textContent = scheduled?.status === 'open' ? `${t('calendarOpen')} ${clockTime(timing.remaining)}` : clockTime(timing.remaining, true); $('#event-chip').title = `${t(scheduled?.status === 'open' ? 'calendarCloses' : 'calendarNext')}: ${dateText(scheduled?.status === 'open' ? scheduled.closesAt : timing.next)} (${t('localTime')})`; $('#event-chip').classList.toggle('soon', scheduled?.status === 'open' || (event ? Boolean(selectedReminder) : timing.remaining <= prefs.alerts.eventLeadMinutes * 60000)); }
  else if (bossTimer) { $('#event-name').textContent = timerName; $('#event-time').textContent = t({ alive: 'bossChipAlive', awaiting: 'bossChipAwaiting', unknown: 'bossChipUnknown' }[bossTimer.status]); $('#event-chip').title = t({ alive: 'bossAlive', awaiting: 'bossAwaiting', unknown: 'bossUnknown' }[bossTimer.status]); $('#event-chip').classList.remove('soon'); }
  const soon = event ? Boolean(selectedReminder) : timing && timing.remaining <= prefs.alerts.eventLeadMinutes * 60000;
  const cycle = soon && bossTimer ? `${bossTimer.key}-${timing.next}` : '';
  if (cycle && cycle !== lastEventCycle) { beep(); lastEventCycle = cycle; }
  const newlyDue = scheduledEvents().map(event => ({ event, reminder: eventReminder(event) })).filter(value => value.reminder && !remindedEventCycles.has(value.reminder.key));
  if (newlyDue.length) { for (const value of newlyDue) remindedEventCycles.add(value.reminder.key); while (remindedEventCycles.size > 200) remindedEventCycles.delete(remindedEventCycles.values().next().value); beep(); toast(`${t(newlyDue.every(value => value.reminder.remaining === 0) ? 'eventNow' : 'eventSoon')}: ${newlyDue.map(value => value.event.name).join(' · ')}`); }
  const scoped = scopedEncounter(state, prefs.damageScope);
  const goalReached = scoped.known && prefs.alerts.dpsGoal > 0 && scoped.dps >= prefs.alerts.dpsGoal && !state.paused;
  if (goalReached && !lastGoalReached) beep(); lastGoalReached = goalReached;
  for (const element of $$('.manual-countdown')) { const item = prefs.manualCooldowns.find(item => item.id === element.dataset.cooldown); if (item) element.textContent = !item.startedAt ? '—' : Math.max(0, item.startedAt + item.seconds * 1000 - Date.now()) <= 0 ? t('timerElapsed') : clockTime(item.startedAt + item.seconds * 1000 - Date.now()); }
  for (const element of $$('.actual-cooldown')) element.textContent = actualCooldownText(state.cooldowns[Number(element.dataset.actualCooldownIndex)]);
  if ($('#odyle-estimate')) $('#odyle-estimate').textContent = fullNumber(manualOdyle(prefs.odyle));
  if ($('#alert-status')) $('#alert-status').textContent = `${t(prefs.alerts.dpsGoal > 0 ? goalReached ? 'goalReached' : 'goalWaiting' : 'noGoal')}${soon ? ` · ${t('eventSoon')}: ${timerName}` : ''}`;
  for (const element of $$('.field-boss-countdown')) { const timer = fieldBossTimers(worldData).find(timer => timer.key === element.dataset.bossTimer); if (timer) setText(element, timer.status === 'countdown' ? clockTime(timer.remaining, true) : t({ alive: 'bossAlive', awaiting: 'bossAwaiting', unknown: 'bossUnknown' }[timer.status])); }
  for (const element of $$('[data-scheduled-time]')) { const event = scheduledEvents().find(event => event.id === element.dataset.scheduledTime), timing = event ? scheduleTiming(event) : null; setText(element, timing?.status === 'open' ? `${t('calendarOpen')} ${clockTime(timing.remainingMs)}` : timing ? clockTime(timing.remainingMs, true) : '—'); const next = element.closest('.schedule-card')?.querySelector('[data-scheduled-next]'); if (next) setText(next, `${t(timing?.status === 'open' ? 'calendarCloses' : 'calendarNext')}: ${timing ? dateText(timing.status === 'open' ? timing.closesAt : timing.nextOpening) : '—'}`); }
  renderLatency();
  renderCombatWarning();
  renderSkillBoard();
  renderPvp();
  renderCombatChips();
  alignColumnHeadings();
  renderCubeLive();
  renderLiveTools();
  updateTeamLive();
  if (drawer === 'analysis' && tab === 'effects') renderEffectLists();
}

$('#fullscreen-button').addEventListener('click', () => toggleFullscreenOverlay());
$('#tools-button').addEventListener('click', openTools);
$('#tools-menu').addEventListener('click', async event => {
  const control = delegatedControl(event, event.currentTarget, '[data-tools-action]');
  if (!control) return;
  const actionName = control.dataset.toolsAction;
  await closeTools();
  const existing = { settings: 'settings-button', training: 'training-button', fullscreen: 'fullscreen-button', compact: 'compact-button', lock: 'lock-button', diagnostics: 'modules-button' }[actionName];
  if (actionName === 'close') return;
  if (actionName === 'support') { if (native) action('open_url', { url: SUPPORT_URL }).catch(() => {}); else window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer'); return; }
  if (actionName.startsWith('template-')) { applyTemplate(actionName.slice('template-'.length)); return; }
  if (actionName === 'diagnostics') { openDrawer('settings', 'controls'); readCaptureDiagnostics(); return; }
  if (existing) { $(`#${existing}`).click(); return; }
  openToolPanel(actionName === 'radar-details' ? 'radar' : actionName);
});
$('#tools-menu').addEventListener('change', event => {
  const input = event.target, panel = input.dataset.hudPanel, field = input.dataset.toolsField;
  if (input.dataset.overlayPanel) { toggleOverlay(input.dataset.overlayPanel, input.checked); return; }
  if (panel === 'dps') savePreferences({ displayModules: { ...prefs.displayModules, dps: input.checked } });
  else if (panel === 'radar') savePreferences({ radarOpen: input.checked, ...(input.checked && !prefs.displayModules.dps && !prefs.displayModules.pets ? { displayModules: { ...prefs.displayModules, pets: true } } : {}) });
  else if (HUD_PANELS.includes(panel)) savePreferences({ ...(prefs.layout !== 'cupertino' ? { displayModules: { ...prefs.displayModules, [panel]: input.checked } } : hudPanelChange(prefs, panel, input.checked)), ...(panel === 'pets' && !prefs.displayModules.dps && !input.checked ? { displayModules: { ...prefs.displayModules, pets: false } } : {}), ...(panel === 'pets' && input.checked ? { showPetTracker: true } : {}) });
  else if (field === 'mode') chooseTargetMode(input.value);
  else if (field === 'target') { $('#target-board-select').value = input.value; $('#target-board-select').dispatchEvent(new Event('change')); }
  else if (['sort', 'damageScope'].includes(field)) savePreferences({ [field]: input.value });
  else if (['hudDetailRows', 'showTargetName', 'showTargetHealth'].includes(field)) savePreferences({ [field]: input.checked });
});
document.addEventListener('pointerdown', event => {
  if (toolsOpen && !event.target.closest('#tools-menu,#tools-button')) closeTools({ focus: false });
}, { capture: true });
$('#compact-button').addEventListener('click', () => savePreferences({ compactStrip: !prefs.compactStrip }));
$('#settings-button').addEventListener('click', () => openDrawer('settings'));
$('#odyle-chip').addEventListener('click', () => openDrawer('analysis', 'build'));
$('#team-chip').addEventListener('click', () => openDrawer('analysis', 'team'));
$('#pet-chip').addEventListener('click', () => openPetGuide());
$('#pet-tracker').addEventListener('click', event => {
  const control = delegatedControl(event, event.currentTarget, 'button[data-pet-action]'); if (!control) return;
  if (control.dataset.petAction === 'guide') openPetGuide();
  if (control.dataset.petAction === 'open') openPetGuide(Number(control.dataset.id));
  if (control.dataset.petAction === 'unpin') togglePetPin(Number(control.dataset.id));
  if (control.dataset.petAction === 'pin') togglePetPin(Number(control.dataset.id));
  if (control.dataset.petAction === 'collapse') savePreferences({ petTrackerCollapsed: !prefs.petTrackerCollapsed });
});
$('#target-pet-pin').addEventListener('click', event => {
  if (delegatedControl(event, event.currentTarget, 'button[data-pet-diagnostics]')) { petDiagnosticsOpen = true; openPetGuide(); $('#drawer-content .pet-target-diagnostics')?.scrollIntoView({ block: 'nearest' }); return; }
  const control = delegatedControl(event, event.currentTarget, 'button[data-target-pet-pin]');
  if (!control || control.disabled || !prefs.displayModules.pets) return;
  const id = Number(control.dataset.targetPetPin);
  // Pinning selects a known catalog pet. A displayed choice does not become
  // invalid merely because the last-hit timer expired just before this click.
  togglePetPin(id);
  renderTargetPetPin();
});
for (const type of ['pointerup', 'pointercancel', 'keyup']) document.addEventListener(type, () => requestAnimationFrame(() => { renderTargetPetPin(); renderPetTracking(); if (petDrawerRefreshPending) refreshPetsDrawer(); if (deferredRosterRefresh) { deferredRosterRefresh = false; renderMeter(); } scheduleOverlayRegions(); }));
document.addEventListener('scroll', scheduleOverlayRegions, true);
$('#identity-button').addEventListener('click', () => openDrawer('character'));
$('#modules-button').addEventListener('click', () => openDrawer('settings', 'appearance'));
$('#module-home').addEventListener('click', event => {
  const action = event.target.closest('[data-module-action]')?.dataset.moduleAction;
  if (action === 'pets') openPetGuide();
  if (action === 'all') savePreferences({ displayModules: displayModulePreset('all') });
});
$('#damage-scope').addEventListener('change', event => { selectedBoardTargetId = null; savePreferences(event.target.value === 'target' ? { autoTargetRoster: true } : { rosterScope: event.target.value, autoTargetRoster: false }); });
$('#dps-view-button').addEventListener('click', () => savePreferences({ displayModules: { ...prefs.displayModules, dps: true } }));
$('#show-all-targets').addEventListener('click', () => chooseTargetMode('all'));
$('#target-board-select').addEventListener('change', event => {
  const value = event.target.value;
  if (value.startsWith('target:')) { selectedBoardTargetId = value.slice(7); renderMeter(); }
  else { selectedBoardTargetId = null; savePreferences({ autoTargetRoster: value === 'auto' }); }
});
$('#target-board-select').addEventListener('blur', () => renderTargetBoardControls());
$('#close-window').addEventListener('click', () => action('close_window').catch(() => {}));
$('#drag-region').addEventListener('pointerdown', event => { if (isFullscreenDashboard(prefs) || startHudGesture(event)) return; if (native && event.button === 0 && !prefs.locked) { event.preventDefault(); invoke('start_drag').catch(() => {}); } });
$('.drawer-header').addEventListener('pointerdown', event => {
  if (isFullscreenDashboard(prefs)) return;
  if (drawer && isDrawerDragStart(event, event.currentTarget) && startHudGesture(event)) return;
  if (native && drawer && isDrawerDragStart(event, event.currentTarget)) {
    event.preventDefault();
    invoke('start_drag').catch(() => toast(t('failed'), true));
  }
});
$('#analysis-button').addEventListener('click', () => { snapshot = null; openDrawer('analysis', !prefs.displayModules.dps && prefs.displayModules.pets ? 'pets' : 'overview'); });
$('#training-button').addEventListener('click', () => { snapshot = null; openDrawer('analysis', 'training'); });
$('#event-chip').addEventListener('click', () => { if (prefs.activeEventId.startsWith('boss:')) { snapshot = null; openDrawer('analysis', 'worldBosses'); } else openDrawer('settings', 'calendar'); });
$('#cube-entry').addEventListener('click', () => openDrawer('settings', 'hiddenCube'));
$('#cube-nav-size').addEventListener('click', () => savePreferences({ cubeNavigatorSize: prefs.cubeNavigatorSize === 'full' ? 'compact' : 'full' }));
$('#combat-warning').addEventListener('click', () => { snapshot = null; openDrawer('analysis', 'effects'); });
$('#close-drawer').addEventListener('click', closeDrawer); $('#drawer-backdrop').addEventListener('click', closeDrawer);
$('#players').addEventListener('click', event => {
  const player = event.target.closest('[data-player]'); if (!player) return;
  if (player.getAttribute('aria-disabled') === 'true') return;
  selectedPlayer = player.dataset.player; skillsFromTargetBoard = player.dataset.targetScoped === 'true'; selectedBoardPlayerDetail = null;
  if (skillsFromTargetBoard) {
    const row = [...(renderedTargetBoard?.rows || []), renderedTargetBoard?.own].find(value => value?.id === selectedPlayer);
    if (row) selectedBoardPlayerDetail = { ...row, skills: [], board_summary_only: true };
  }
  snapshot = null; openDrawer('analysis', 'skills');
});
$('#sort').addEventListener('change', event => savePreferences({ sort: event.target.value }));
async function chooseTargetMode(mode) {
  try {
    if (native) { await action('set_target_mode', { mode }); await refreshState(); }
    else if (demo && filteredTargetDemoSource && mode !== 'boss') state = normalizeState({ ...filteredTargetDemoSource, encounter_started_ms: state.encounter_started_ms, focused_target_id: null, focused_target_observed_at_ms: null, live_target: null, observed_targets: state.observed_targets });
    savePreferences({ mode });
  } catch {}
}
$('#target-modes').addEventListener('click', async event => {
  const mode = delegatedControl(event, event.currentTarget, 'button[data-mode]')?.dataset.mode; if (!mode) return;
  await chooseTargetMode(mode);
});
$('#pause-button').addEventListener('click', async () => { try { await action('set_paused', { paused: !state.paused }, () => { state.paused = !state.paused; }); if (native) await refreshState(); else renderMeter(); } catch {} });
$('#reset-button').addEventListener('click', async () => { try { await action('reset_encounter', undefined, () => { state = normalizeState({ status: 'demo', paused: state.paused }); }); if (native) await refreshState(); else renderMeter(); toast(t('resetDone')); } catch {} });
$('#lock-button').addEventListener('click', async () => { try { const locked = !prefs.locked; if (native) await action('set_locked', { locked }); savePreferences({ locked }); } catch {} });
$('#resize-button').addEventListener('pointerdown', event => { if (isFullscreenDashboard(prefs) || startHudGesture(event, true)) return; if (event.button === 0 && !prefs.locked) { event.preventDefault(); action('start_resize').catch(() => {}); } });
$('#resize-button').addEventListener('keydown', event => {
  if (isFullscreenDashboard(prefs)) return;
  const step = resizeStep(event.key, event.shiftKey);
  if (step && !prefs.locked) { event.preventDefault(); if (prefs.fullscreenOverlay) { const rect = overlayRect(prefs, { width: innerWidth, height: innerHeight }); savePreferences({ overlayWidth: rect.width + step.dx, overlayHeight: rect.height + step.dy }); } else action('resize_by', step).catch(() => {}); }
  else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toast(native ? t('resizeHelp') : t('nativeOnly')); }
});
document.addEventListener('pointerdown', enableAudio, { passive: true });
document.addEventListener('keydown', event => {
  if (pvpPopoverOpen && !drawer && !toolsOpen && event.key === 'Escape') { event.preventDefault(); setPvpPopover(false); return; }
  if (toolsOpen && !drawer) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeTools(); return; }
    if (event.key === 'Tab') { const target = focusBoundary(modalControls($('#tools-menu')), document.activeElement, event.shiftKey); if (target) { event.preventDefault(); target.focus(); } }
  }
  if (event.key === 'F11' && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); toggleFullscreenOverlay(); return; }
  if (!drawer && event.key === 'Escape' && prefs.fullscreenOverlay) { event.preventDefault(); toggleFullscreenOverlay(false); return; }
  if (!drawer) return;
  if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
  if (event.key === 'Tab') {
    const target = focusBoundary(modalControls($('#drawer')), document.activeElement, event.shiftKey);
    if (target) { event.preventDefault(); target.focus(); }
  }
}, { capture: true });
$('#radar-chip').addEventListener('click', () => savePreferences({ radarOpen: !prefs.radarOpen }));
$('#radar-dock').addEventListener('click', event => { if (event.target.closest('[data-action=radar-details]')) openDrawer('analysis', 'radar'); });
$('#drawer-content').addEventListener('input', event => { if (event.target.name === 'replaySeek') { playback.seek(event.target.value, replayTimeline(playbackRecord || {}, prefs.damageScope).duration); updatePlayback(); } });
$('#dismiss-record').addEventListener('click', () => { recordNotifier.dismiss(); renderRecordNotice(); });
$('#drawer-groups').addEventListener('click', event => {
  const id = delegatedControl(event, event.currentTarget, 'button[data-group]')?.dataset.group;
  const visible = visibleAnalysisSections(ANALYSIS_SECTIONS, prefs);
  const first = ANALYSIS_GROUPS.find(group => group.id === id)?.sections.find(name => visible.includes(name));
  if (first) selectDrawerTab(first);
});
$('#drawer-tabs').addEventListener('click', event => { const name = delegatedControl(event, event.currentTarget, 'button[data-tab]')?.dataset.tab; if (name) selectDrawerTab(name); });
$('#drawer-tabs').addEventListener('keydown', event => { if (event.altKey || event.ctrlKey || event.metaKey) return; const next = nextTab($$('#drawer-tabs button').map(button => button.dataset.tab), drawer === 'settings' ? settingsTab : tab, event.key); if (next) { event.preventDefault(); selectDrawerTab(next); } });

$('#drawer-content').addEventListener('change', async event => {
  if (event.target.name === 'radarRange') { savePreferences({ radarRange: Number(event.target.value) }); refreshDrawer(); return; }
  if (event.target.name === 'radarFilter') { radarFilter = event.target.value; refreshDrawer(); return; }
  if (event.target.name === 'replayRecord') { playbackAwaitCurrent = false; playbackRecord = playbackChoices.find(row => row.key === event.target.value)?.record || null; playback.pause(); playback.seek(0, 0); refreshDrawer(); return; }
  if (event.target.name === 'replaySpeed') { playback.rate(event.target.value); return; }

  if (event.target.name === 'displayModule' && DISPLAY_MODULES.includes(event.target.value)) {
    const name = event.target.value;
    savePreferences({ displayModules: { ...prefs.displayModules, [name]: event.target.checked } }); refreshDrawer(); $(`[name=displayModule][value="${name}"]`)?.focus({ preventScroll: true }); return;
  }
  if (['petGoal', 'showPetTracker', 'petAutoTrack'].includes(event.target.name)) {
    const name = event.target.name; savePreferences({ [name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }); refreshDrawer(name); return;
  }
  if (['petFaction', 'petGenus', 'petStatus', 'petSort'].includes(event.target.name)) {
    const values = Object.fromEntries(new FormData(event.target.form));
    petFilters = { query: values.petQuery || '', faction: values.petFaction || 'all', genus: values.petGenus || 'all', status: values.petStatus || 'all', sort: values.petSort || 'name', page: 0 }; petSelectedId = null; petFiltersTouched = true; refreshDrawer(event.target.name); return;
  }
  const element = event.target, name = element.name;
  if (name === 'fullscreenOverlay') { await toggleFullscreenOverlay(element.checked, fullscreenLayout(prefs)); return; }
  if (name === 'fullscreenLayout') { await toggleFullscreenOverlay(prefs.fullscreenOverlay, element.value); return; }
  if (element.form?.id === 'history-filter-form' || element.form?.id === 'history-note-form') { captureHistoryForm(element.form); return; }
  if (element.form?.id === 'team-join-form') { teamConsent = element.form.elements.teamConsent.checked; teamInviteDraft = element.form.elements.teamInvite.value; for (const button of element.form.querySelectorAll('button')) button.disabled = !native || teamBusy || !teamConsent; return; }
  if (name === 'automaticTeamClass') { teamClassFilter = element.value; updateTeamLive(); return; }
  if (name === 'trainingSeconds') { trainingDurationDraft = element.value; const duration = validateTrainingDuration(trainingDurationDraft); if (duration !== null) trainingDuration = duration; updateTrainingLive(); return; }
  if (element.form?.id?.startsWith('community-')) { captureCommunityForm(element.form); if (['communityScope', 'communityRecordId', 'communityAnonymous', 'communityVisibility'].includes(name)) refreshCommunityDrawer(); return; }
  if (drawer === 'settings' && element.form?.id) dirtySettingsForms.add(element.form.id);
  if (name === 'showCubeLocator') { savePreferences({ showCubeLocator: element.checked }); return; }
  if (name === 'cubeNeedKeys') { savePreferences({ cubeNeedKeys: element.checked }); return; }
  if (name === 'rosterLimit') { const typed = Math.trunc(Number(element.value)); if (element.value.trim() !== '' && Number.isFinite(typed)) savePreferences({ rosterLimit: Math.min(50, Math.max(0, typed)) }); return; }
  if (name === 'overlayScale') { savePreferences({ overlayScale: Number(element.value) }); return; }
  if (name === 'overlayRate') { savePreferences({ overlayRate: Number(element.value) }); return; }
  if (name === 'overlaySnap') { savePreferences({ overlaySnap: element.checked }); return; }
  if (name === 'cubeAutoListen') { await setCubeListening(element.checked); return; }
  if (name === 'cubeNavigatorSize') { savePreferences({ cubeNavigatorSize: element.value }); return; }
  if (name === 'cubeSource') { if (cubeState.enabled || cubePending) return; savePreferences({ cubeSource: element.value }); setText($('#cube-source-help'), t(prefs.cubeSource === 'system' ? 'cubeSystemHelp' : 'cubeGameHelp')); return; }
  if (name === 'cubeThreshold') { if (cubeState.enabled || cubePending) return; savePreferences({ cubeThreshold: Number(element.value) }); element.value = prefs.cubeThreshold; setText($('#cube-threshold-value'), `${Math.round(prefs.cubeThreshold * 100)}%`); return; }
  if (name === 'cubeReferenceFile') {
    const file = element.files?.[0]; if (!file || !native || cubeState.enabled || cubePending) return;
    if (file.size <= 0 || file.size > CUBE_REFERENCE_MAX_BYTES) { toast(t('cubeImportInvalid'), true); element.value = ''; return; }
    await cubeCommand('import_cube_reference', async () => ({ data: await cubeReferenceBase64(file), start_seconds: 0, end_seconds: null }), 'cubeImported');
    element.value = ''; return;
  }
  if (['targetFontSize', 'numberPrecision'].includes(name)) { const patch = numericPreferenceEdit(name, element.value); if (patch) savePreferences(patch); element.value = prefs[name]; return; }
  if (['locale', 'font', 'targetFont', 'textScale', 'opacity', 'activeEventId', 'density', 'rowMetric', 'summaryMetric', 'damageScope', 'rowColorMode', 'recordNotifications'].includes(name)) { savePreferences({ [name]: element.value }); if (name === 'locale') refreshDrawer(name); if (name === 'activeEventId') syncCalendarSelection(); return; }
  if (name === 'ownHealth') { savePreferences({ alerts: { ...prefs.alerts, ownHealth: element.checked } }); return; }
  if (['showTargetName', 'showTargetHealth', 'showClass', 'showShares', 'showTeamCooldowns', 'autoTargetRoster'].includes(name)) { savePreferences({ [name]: element.checked }); return; }
  if (['eventReminderEnabled', 'eventReminderLead'].includes(name)) { const key = name === 'eventReminderEnabled' ? 'reminderEnabled' : 'reminderLeadMinutes'; savePreferences({ events: prefs.events.map(timer => timer.id === element.dataset.eventId ? { ...timer, [key]: name === 'eventReminderEnabled' ? element.checked : Number(element.value) } : timer) }); if (name === 'eventReminderLead') element.value = prefs.events.find(timer => timer.id === element.dataset.eventId)?.reminderLeadMinutes ?? 5; return; }
  if (['builtInReminderEnabled', 'builtInReminderLead'].includes(name)) { const id = element.dataset.eventId, current = prefs.builtInReminders[id] || { enabled: false, leadMinutes: 5 }; savePreferences({ builtInReminders: { ...prefs.builtInReminders, [id]: { ...current, [name === 'builtInReminderEnabled' ? 'enabled' : 'leadMinutes']: name === 'builtInReminderEnabled' ? element.checked : Number(element.value) } } }); const lead = element.closest('.schedule-card')?.querySelector('[name=builtInReminderLead]'); if (lead) { lead.disabled = !prefs.builtInReminders[id].enabled; if (name === 'builtInReminderLead') lead.value = prefs.builtInReminders[id].leadMinutes; } return; }
  if (name === 'calendarHorizonDays') { calendarHorizonDays = Number(element.value); return; }
  if (name === 'obsScope') { obsScope = element.value; return; }
  if (name === 'obsLanEnabled') { obsLanEnabled = element.checked; return; }
  if (name === 'obsPort') { obsPort = element.value; return; }
  if (['onlyAboveGame', 'clickThroughWhenLocked', 'fadeWhenIdle', 'hidePlayerNames', 'showSkillBoard', 'cleanLook', 'compactStrip', 'autoCheckUpdates'].includes(name)) { savePreferences({ [name]: element.checked }); return; }
  if (name === 'obsHideNames') { obsHideNames = element.checked; return; }
  if (name?.startsWith('color-')) { savePreferences({ theme: 'custom', customColors: { ...prefs.customColors, [name.slice(6)]: element.value } }); $$('.theme-swatch').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === 'custom'))); return; }
  if (name === 'recordMetric') { recordMetric = element.value; refreshDrawer(name); return; }
  if (name === 'recordQuery') { recordQuery = element.value.slice(0, 100); refreshDrawer(name); return; }
  if (name === 'selectedPlayer') { selectedPlayer = element.value; refreshDrawer(name); return; }
  if (name === 'skillSort') { skillSort = element.value; refreshDrawer(name); return; }
  if (name === 'trainingTargetId') { trainingTargetId = element.value; return; }
  if (name === 'selectedBuild') { selectedBuild = element.value; refreshDrawer(name); return; }
  if (name === 'gameReportFile') {
    try { const file = element.files[0]; if (!file) return; if (file.size > GAME_REPORT_MAX_BYTES) throw new Error('File size'); gameReport = decodeGameReport(await file.arrayBuffer()); await readComparisonRecord(); refreshDrawer(); }
    catch { toast(t('gameReportInvalid'), true); element.value = ''; }
    return;
  }
  if (name === 'reportFormat') { reportFormat = element.value; return; }
  if (name === 'reportAnonymize') { reportAnonymize = element.checked; return; }
  if (name === 'backgroundFile') {
    try {
      const file = element.files[0]; if (!file) return;
      if (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error(t('invalidRaster'));
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      await validateRasterDimensions(data);
      savePreferences({ background: data }); toast(t('saved'));
    } catch (error) { toast(error.message || t('invalidRaster'), true); }
    element.value = ''; return;
  }
  if (element.id === 'theme-file') { try { const theme = importTheme(await readFile(element.files[0])); await validateRasterDimensions(theme.background); savePreferences(theme); refreshDrawer(); toast(t('saved')); } catch { toast(t('invalidFile'), true); } return; }
  if (element.id === 'history-file') { try { const document = await readFile(element.files[0], 16 * 1024 * 1024), imported = importEncounterCollection(document).encounters; if (imported.some(record => record.total_damage === null)) throw new Error(t('unknownImport')); if (native) { await action('import_history', { document }); await refreshState(); await historyCache?.retry(); } else { if (imported.length > 30) throw new Error('Maximum 30 local records'); savePreferences({ importedHistory: imported }); } refreshDrawer(); toast(t('historyImported')); } catch (error) { toast(error.message === t('unknownImport') ? error.message : t('invalidFile'), true); } }
});

$('#drawer-content').addEventListener('input', event => {
  if (event.target.name === 'recordQuery') { recordQuery = event.target.value.slice(0, 100); refreshDrawer('recordQuery'); return; }
  if (event.target.name === 'petQuery') petFilters.query = event.target.value.slice(0, 120);
  const element = event.target;
  if (element.name === 'trainingSeconds') { trainingDurationDraft = element.value; const duration = validateTrainingDuration(trainingDurationDraft); if (duration !== null) trainingDuration = duration; updateTrainingLive(); return; }
  if (element.form?.id === 'history-filter-form' || element.form?.id === 'history-note-form') { captureHistoryForm(element.form); return; }
  if (element.form?.id === 'team-join-form') { teamConsent = element.form.elements.teamConsent.checked; teamInviteDraft = element.form.elements.teamInvite.value; for (const button of element.form.querySelectorAll('button')) button.disabled = !native || teamBusy || !teamConsent; return; }
  if (element.form?.id?.startsWith('community-')) { captureCommunityForm(element.form); return; }
  if (drawer === 'settings' && element.form?.id) dirtySettingsForms.add(element.form.id);
  if (element.name === 'cubeThreshold') { setText($('#cube-threshold-value'), `${Math.round(Number(element.value) * 100)}%`); return; }
  if (['targetFontSize', 'numberPrecision'].includes(element.name)) { preferenceCommitter?.invalidate(); const patch = numericPreferenceEdit(element.name, element.value); if (patch) savePreferences(patch); return; }
  if (['textScale', 'opacity'].includes(element.name)) { preferenceCommitter?.invalidate(); prefs[element.name] = Number(element.value); applyAppearance(); }
});
$('#drawer-content').addEventListener('click', async event => {
  const petLink = delegatedControl(event, event.currentTarget, 'a[data-pet-reference]');
  if (petLink) {
    event.preventDefault(); const url = petReferenceUrl(petLink.getAttribute('href'));
    if (url) { if (native) { try { await action('open_pet_reference', { url }); } catch {} } else window.open(url, '_blank', 'noopener,noreferrer'); }
    return;
  }
  const duration = delegatedControl(event, event.currentTarget, 'button[data-training-duration]')?.dataset.trainingDuration;
  if (duration) { const validated = validateTrainingDuration(Number(duration) / 1000); if (validated !== null) { trainingDuration = validated; trainingDurationDraft = String(validated / 1000); refreshDrawer(); } return; }
  const interval = delegatedControl(event, event.currentTarget, 'button[data-curve-interval]')?.dataset.curveInterval;
  if (interval) { curveInterval = Number(interval); refreshDrawer(); return; }
  const layout = delegatedControl(event, event.currentTarget, 'button[data-layout]')?.dataset.layout;
  if (layout) { savePreferences({ layout }); $$('.layout-card').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === layout))); return; }
  const theme = delegatedControl(event, event.currentTarget, 'button[data-theme]')?.dataset.theme;
  if (theme) { savePreferences({ theme }); $$('.theme-swatch').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === theme))); return; }
  const control = delegatedControl(event, event.currentTarget, 'button[data-action]'); if (!control) return;
  const actionName = control.dataset.action, id = control.dataset.id;
  if (['refresh-capture-diagnostics', 'copy-capture-diagnostics', 'save-capture-diagnostics'].includes(actionName)) { await captureDiagnosticAction(actionName); return; }
  if (['check-update', 'download-update', 'install-update'].includes(actionName)) { await runUpdate(actionName); return; }
  if (actionName === 'replay-toggle') { playback.toggle(replayTimeline(playbackRecord || {}, prefs.damageScope).duration); updatePlayback(); return; }
  if (actionName === 'replay-current') { playbackAwaitCurrent = true; playback.pause(); playbackRecord = null; snapshot = null; await readCurveRecord(); playback.seek(0, 0); refreshDrawer(); return; }
  if (actionName === 'radar-details') { openDrawer('analysis', 'radar'); return; }
  if (actionName === 'refresh-insights') { await readCurveRecord(); return; }
  if (actionName === 'team-create') { await teamAction('create_team_room'); return; }
  if (actionName === 'team-leave') { await teamAction('leave_team_room'); return; }
  if (actionName === 'team-copy-invite') {
    if (!native || teamBusy) return;
    const epoch = teamRequestEpoch, room = teamState.room_id;
    try {
      const invite = await invoke('get_team_invite');
      if (epoch !== teamRequestEpoch || room !== teamState.room_id || !teamState.enabled) return;
      try { await navigator.clipboard.writeText(invite); toast(t('copied')); }
      catch { if (epoch !== teamRequestEpoch || room !== teamState.room_id) return; teamInviteCopy = invite; showInviteFallback(); }
    } catch { toast(t('failed'), true); } return;
  }
  if (actionName === 'copy-community-summary') {
    try {
      const fromCommunity = tab === 'community', recordId = fromCommunity ? communityDraft.recordId : '', scope = fromCommunity ? communityDraft.scope : prefs.damageScope;
      const record = recordId ? (native ? historyCache.history : state.history).find(record => record.id === recordId) : !fromCommunity && snapshot ? snapshot : native ? await invoke('get_current_encounter') : state;
      communitySummaryText = communitySummary(record, { scope, locale: prefs.locale, anonymous: fromCommunity ? communityDraft.anonymous : true });
      if (!communitySummaryText) { toast(t('missingHistory')); return; }
      try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(communitySummaryText); refreshCommunityDrawer(); toast(t('copied')); }
      catch { if (tab !== 'community') openDrawer('analysis', 'community'); else refreshCommunityDrawer(); $('#community-summary-text')?.focus(); $('#community-summary-text')?.select(); toast(t('selectToCopy')); }
    } catch { toast(t('failed'), true); }
    return;
  }
  if (actionName === 'refresh-community') { await readCommunity(); return; }
  if (actionName === 'community-page-next' || actionName === 'community-page-previous') {
    await (actionName === 'community-page-next' ? communityController.nextRankingsPage() : communityController.previousRankingsPage());
    if (drawer === 'analysis' && tab === 'community' && (document.activeElement === document.body || document.activeElement === control || document.activeElement?.closest('.community-pagination'))) {
      const preferred = $(`[data-action="${actionName}"]`), available = $('.community-pagination button:not(:disabled)') || $('#community-rankings-form button[type=submit]');
      (preferred && !preferred.disabled ? preferred : available)?.focus({ preventScroll: true });
    }
    return;
  }
  if (actionName === 'open-community-section') { if (snapshot?.id && (native ? historyCache.history : state.history).some(record => record.id === snapshot.id && record.provenance !== 'imported-unverified')) communityDraft.recordId = snapshot.id; openDrawer('analysis', 'community'); return; }
  if (actionName === 'confirm-revoke-community' || actionName === 'cancel-revoke-community') { communityRevokeId = actionName === 'confirm-revoke-community' ? id : ''; refreshCommunityDrawer(); return; }
  if (actionName === 'revoke-community') { if (id !== communityRevokeId) return; if (await communityController.revoke(id)) { communityRevokeId = ''; toast(communityLabels[prefs.locale].removed); await communityController.refreshRankings(communityRankingDraft); } return; }
  if (actionName === 'open-community-rank') { await openCommunityUrl(communityController.view.rankings.entries.find(entry => entry.share_id === id)?.url); return; }
  if (actionName === 'open-community' || actionName === 'copy-community') {
    const share = communityController.view.state.shares.find(entry => entry.id === id); if (!share) return;
    let link; try { link = communityShareLink(await invoke('get_share_link', { id }), share.visibility); if (!link) throw new Error('Invalid share link'); } catch { toast(t('failed'), true); return; }
    if (actionName === 'open-community') await openCommunityUrl(link, share.visibility);
    else { try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(link); toast(communityLabels[prefs.locale].copied); } catch { if (share.visibility === 'private') { const field = document.createElement('textarea'); field.className = 'private-copy-field'; field.readOnly = true; field.value = link; field.setAttribute('aria-label', t('selectToCopy')); $('#drawer-content').append(field); field.focus(); field.select(); field.addEventListener('blur', () => { field.value = ''; field.remove(); }, { once: true }); toast(t('selectToCopy')); } else { const field = $$('[data-community-url]').find(element => element.dataset.communityUrl === id); field?.focus(); field?.select(); toast(t('selectToCopy')); } } }
    return;
  }
  if (actionName === 'save-capture') {
    const label = $('[name=captureLabel]')?.value ?? '';
    try {
      const path = await action('save_capture', { label, seconds: 120 });
      if (path) { setText($('#capture-saved'), `${prefs.locale === 'tr' ? 'Kaydedildi' : 'Saved'}: ${path}`); toast(t('saved')); }
    } catch { /* action already told the user why */ }
    return;
  }
  if (actionName === 'toggle-cube') { await toggleCubeListening(); return; }
  if (actionName === 'cube-marker-edit') { try { await invoke('set_overlay', { panel: 'cube', open: true }); await invoke('overlay_controls', { open: true }); toast(prefs.locale === 'tr' ? 'İşaretleri sürükle, bitince “Bitti”ye bas.' : 'Drag the markers, then press Done.'); } catch (error) { toast(`${t('failed')}: ${String(error).slice(0, 120)}`, true); } return; }
  if (actionName === 'reset-cube-reference') { if (!cubeState.enabled) await cubeCommand('reset_cube_reference', {}); return; }
  if (actionName === 'open-alerts' || actionName === 'open-training') { snapshot = null; openDrawer('analysis', actionName === 'open-alerts' ? 'alerts' : 'training'); }
  if (actionName === 'retry-history') { const pending = historyCache?.retry(); refreshDrawer(); await pending; if (drawer === 'analysis' && tab === 'history') refreshDrawer(); }
  if (actionName === 'select-calendar-event') { savePreferences({ activeEventId: id }); syncCalendarSelection(); }
  if (actionName === 'refresh-calendar') await readEventSchedule(true);
  if (actionName === 'start-obs' || actionName === 'stop-obs') await setObsRunning(actionName === 'start-obs');
  if (actionName === 'copy-obs-url') { const field = $('#obs-url'); if (field?.value) { try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(field.value); toast(t('copied')); } catch { field.focus(); field.select(); toast(t('selectToCopy')); } } }
  if (actionName === 'export-calendar') { const selected = activeEvent(); if (!selected) return; try { const options = { horizonDays: calendarHorizonDays, locale: prefs.locale }, content = typeof scheduling.calendarIcs === 'function' ? scheduling.calendarIcs([selected], options) : scheduling.exportEventCalendar(selected, options); if (native) { const path = await action('export_document', { format: 'ics', content }); toast(`${t('calendarSaved')}: ${path}`); } else { download('luma-schedule.ics', content, 'text/calendar'); toast(t('calendarSaved')); } } catch { toast(t('calendarFailed'), true); } }
  if (actionName === 'arm-training' || actionName === 'cancel-training') { const duration = validateTrainingDuration(trainingDurationDraft); if (actionName === 'arm-training' && duration === null) { toast(t('invalidTrainingDuration'), true); $('[name=trainingSeconds]')?.reportValidity(); return; } try { await action(actionName === 'arm-training' ? 'arm_training' : 'cancel_training', actionName === 'arm-training' ? { duration_ms: duration, target_id: trainingTargetId ? Number(trainingTargetId) : null } : {}); await refreshState(); refreshDrawer(); } catch {} }
  if (actionName === 'refresh-curve') await readCurveRecord();
  if (actionName === 'refresh-effects') await readAssistTimeline();
  if (actionName === 'refresh-build' || actionName === 'refresh-pets') await readCharacterData();
  if (actionName === 'save-pet-diagnostics') {
    if (petDiagnosticPending) return;
    petDiagnosticPending = true; refreshPetsDrawer();
    try {
      if (native) { await refreshState(); await readCharacterData(); }
      const content = JSON.stringify(petDiagnosticReport({ version: appVersion, mode: native ? 'native' : demo ? 'demo' : 'browser', state, character: characterData, pins: prefs.petPins, now: Date.now() }), null, 2);
      if (native) { const path = await action('export_document', { format: 'json', content }); toast(String(path)); }
      else { download('luma-pet-diagnostics.json', content, 'application/json'); toast(t('exported')); }
    } catch { toast(t('failed'), true); }
    finally { petDiagnosticPending = false; refreshPetsDrawer(); }
    return;
  }
  if (actionName === 'modules-pets' || actionName === 'modules-all') { savePreferences({ displayModules: displayModulePreset(actionName === 'modules-pets' ? 'pets' : 'all') }); refreshDrawer(); }
  if (actionName === 'open-pet-guide') openPetGuide();
  if (actionName === 'pet-pin') togglePetPin(Number(id));
  if (['pet-guide-reset', 'pet-guide-catalog'].includes(actionName)) { petSelectedId = null; petFiltersTouched = true; petFilters = petGuideFilterAction(petFilters, actionName); refreshDrawer(); }
  if (actionName === 'pet-guide-previous' || actionName === 'pet-guide-next') { petSelectedId = null; petFilters.page = Math.max(0, petFilters.page + (actionName === 'pet-guide-next' ? 1 : -1)); refreshDrawer(); }
  if (actionName === 'refresh-world') await readWorldData();
  if (actionName === 'refresh-comparison') await readComparisonRecord();
  if (actionName === 'open-world') { snapshot = null; openDrawer('analysis', 'worldBosses'); }
  if (actionName === 'select-boss-timer') { savePreferences({ activeEventId: id }); refreshDrawer(); }
  if (actionName === 'clear-character') {
    try { await action('set_local_player', { id: null, name: '' }, () => { state = normalizeState({ ...state, local_player_id: null, local_player_name: '', local_identity_source: 'unresolved', personal_total_damage: null, personal_dps: null, players: state.players.map(player => ({ ...player, is_local: false })) }); }); dirtySettingsForms.delete('character-form'); savePreferences({ characterName: '' }); if (native) await refreshState(); refreshDrawer(); } catch {}
  }
  if (actionName === 'remove-background') { savePreferences({ background: '' }); toast(t('saved')); }
  if (actionName === 'export-theme') download('luma-theme.json', exportTheme(prefs));
  if (actionName === 'import-theme') $('#theme-file').click();
  if (actionName === 'delete-event') { const events = prefs.events.filter(event => event.id !== id); savePreferences({ events, activeEventId: id === prefs.activeEventId ? '' : prefs.activeEventId }); refreshDrawer(); }
  if (actionName === 'support') { if (native) action('open_url', { url: SUPPORT_URL }).catch(() => {}); else window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer'); }
  if (actionName === 'export-current') {
    const s = analysisState(); if (!s.total_damage && !s.players.length) { toast(t('missingHistory')); return; }
    try { const fullRecord = native && !snapshot ? await action('get_current_encounter') : s; if (fullRecord) await exportReport([{ ...fullRecord, name: fullRecord.name || fullRecord.targets?.[0]?.name || 'Encounter', provenance: snapshot ? snapshot.provenance : demo ? 'demo' : 'received' }]); else toast(t('missingHistory')); } catch {}
  }
  if (actionName === 'export-history') { try { await historyCache?.retry(); const received = native ? (await action('get_history'))?.history || [] : state.history; await exportReport([...received, ...prefs.importedHistory]); } catch {} }
  if (actionName === 'import-history') $('#history-file').click();
  if (actionName === 'view-history') { captureHistoryForm($('#history-filter-form')); captureHistoryForm($('#history-note-form')); const item = allHistory()[Number(control.dataset.index)]?.item; if (item) { snapshot = item; selectedPlayer = ownPlayer(item)?.id || scopedEncounter(item, prefs.damageScope).players[0]?.id || ''; tab = ['skills', 'curves', 'overview', 'rotation'].includes(control.dataset.tab) ? control.dataset.tab : 'skills'; renderDrawerContent(); } }
  if (actionName === 'history-reset-filters') { historyFilters = historyFilterDefaults(); historyFilterDraft = historyFilterDefaults(); historyTrendKey = ''; refreshDrawer(); }
  if (actionName === 'history-close-note') { captureHistoryForm($('#history-filter-form')); historyEditKey = ''; historyEditDraft = null; refreshDrawer(); }
  if (['history-favorite', 'history-edit-note', 'history-compare'].includes(actionName)) {
    const key = control.dataset.key || '', record = allHistory().find(value => historyRecordKey(value.item, { imported: value.imported }) === key);
    if (!key || !record) { toast(historyLabel('recordMissing'), true); return; }
    captureHistoryForm($('#history-filter-form')); captureHistoryForm($('#history-note-form'));
    if (actionName === 'history-edit-note') { if (historyEditKey !== key || !historyEditDraft) historyEditDraft = historyNotebook.get(key); historyEditKey = key; refreshDrawer(); $('#history-note-form [name="historyNote"]')?.focus({ preventScroll: true }); }
    if (actionName === 'history-compare') { historyTrendKey = key; refreshHistoryDrawer(); }
    if (actionName === 'history-favorite') { const result = historyNotebook.set(key, { favorite: !historyNotebook.get(key).favorite }); historyNotebookError = result.ok ? '' : result.error; refreshHistoryDrawer(); if (!result.ok) toast(historyLabel('saveFailed'), true); }
  }
  if (actionName === 'clear-imported') {
    if (historyClearPending) return;
    historyClearPending = true; refreshHistoryDrawer();
    try {
      await clearImportedHistory({ native,
        clearNative: () => action('clear_imported_history'),
        clearLocal: () => { savePreferences({ importedHistory: [] }); if (snapshot?.provenance === 'imported-unverified' || snapshot?.source === 'imported') snapshot = null; },
        refresh: async value => { if (native) { if (value) receiveState(value); await refreshState(); await historyCache.retry(); } },
      });
      if (historyEditKey && !allHistory().some(value => historyRecordKey(value.item, { imported: value.imported }) === historyEditKey)) { historyEditKey = ''; historyEditDraft = null; }
      toast(t('clearConfirm'));
    } catch {} finally { historyClearPending = false; refreshHistoryDrawer(); }
  }
  if (actionName === 'delete-equipment') { savePreferences({ equipment: prefs.equipment.filter(item => item.id !== id) }); refreshDrawer(); }
  if (actionName === 'start-cooldown') { savePreferences({ manualCooldowns: prefs.manualCooldowns.map(item => item.id === id ? { ...item, startedAt: Date.now() } : item) }); tickTimers(); }
  if (actionName === 'delete-cooldown') { savePreferences({ manualCooldowns: prefs.manualCooldowns.filter(item => item.id !== id) }); refreshDrawer(); }
});

$('#drawer-content').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target, values = Object.fromEntries(new FormData(form));
  if (form.id === 'pet-filter-form') {
    petFilters = { query: values.petQuery || '', faction: values.petFaction || 'all', genus: values.petGenus || 'all', status: values.petStatus || 'all', sort: values.petSort || 'name', page: 0 }; petSelectedId = null; refreshDrawer(); return;
  }
  if (form.id === 'team-join-form') { teamInviteDraft = values.teamInvite || ''; teamConsent = values.teamConsent === 'on'; await teamAction('join_team_room'); return; }
  if (form.id === 'history-filter-form') {
    captureHistoryForm(form);
    const options = historyOptions(historyFilterDraft);
    if (options.from_ms !== null && options.to_ms !== null && options.from_ms > options.to_ms) { toast(historyLabel('dateError'), true); return; }
    historyFilters = { ...historyFilterDraft }; refreshHistoryDrawer(); return;
  }
  if (form.id === 'history-note-form') {
    captureHistoryForm(form);
    const key = String(values.historyKey || '');
    if (!key || key !== historyEditKey || !allHistory().some(value => historyRecordKey(value.item, { imported: value.imported }) === key)) { toast(historyLabel('recordMissing'), true); return; }
    const result = historyNotebook.set(key, { ...historyEditDraft, tags: parseHistoryTags(historyEditDraft.tags) });
    historyNotebookError = result.ok ? '' : result.error;
    if (result.ok) { historyEditDraft = result.annotation; refreshDrawer(); toast(historyLabel('saved')); }
    else { refreshHistoryDrawer(); toast(historyLabel('saveFailed'), true); }
    return;
  }
  if (form.id === 'community-share-form') {
    captureCommunityForm(form);
    if (!native || !communityDraft.consent) return;
    const id = communityDraft.recordId || null;
    if (id && !historyCache.history.some(record => record.id === id && record.provenance !== 'imported-unverified')) { toast(communityLabels[prefs.locale].recordMissing, true); return; }
    const result = await communityController.publish(id, communityDraft);
    if (result) { communityDraft.consent = false; refreshCommunityDrawer(); toast(communityLabels[prefs.locale].published); if (result.rank_opt_in) await communityController.refreshRankings(communityRankingDraft); }
    return;
  }
  if (form.id === 'hotkey-form') { await saveHotkeys(form); return; }
  if (form.id === 'community-rankings-form') { captureCommunityForm(form); if (native) await communityController.refreshRankings(communityRankingDraft); return; }
  if (form.id === 'character-form') {
    const name = String(values.characterName || '').trim(), selectedId = String(values.localPlayerId || '');
    try {
      if (native) { const numericId = Number(selectedId); if (selectedId && (!Number.isSafeInteger(numericId) || numericId < 0)) throw new Error(t('invalidFile')); await action('set_local_player', { id: selectedId ? numericId : null, name }); }
      else if (demo) { const matches = name ? state.players.filter(player => player.name === name) : [], own = state.players.find(player => player.id === selectedId) || (matches.length === 1 ? matches[0] : null); state = normalizeState({ ...state, local_player_id: own?.id ?? null, local_player_name: own ? name || own.name : '', local_identity_source: own ? 'manual' : 'unresolved', personal_total_damage: own?.damage ?? null, personal_dps: own?.dps ?? null, personal_elapsed_ms: state.elapsed_ms, personal_targets: own ? [{ ...state.targets[0], damage: own.damage }] : [], players: state.players.map(player => ({ ...player, is_local: player.id === own?.id, name: player.id === own?.id ? name || player.name : player.name })) }); }
      dirtySettingsForms.delete(form.id); savePreferences({ characterName: name }); if (native) await refreshState(); refreshDrawer(); toast(t('saved'));
    } catch (error) { if (!native) toast(error.message || t('failed'), true); }
  }
  if (form.id === 'party-form') {
    const selected = new FormData(form).getAll('partyMember').map(String);
    try { if (native) { const ids = selected.map(Number); if (ids.some(id => !Number.isSafeInteger(id) || id < 0)) throw new Error(t('invalidFile')); await action('set_party_members', { ids }); await refreshState(); }
      else if (demo) { const members = state.players.filter(player => selected.includes(player.id)); state = normalizeState({ ...state, party_member_ids: selected, party_membership_source: 'manual', party_total_damage: members.reduce((sum, player) => sum + player.damage, 0), party_dps: members.reduce((sum, player) => sum + player.dps, 0), party_targets: [], players: state.players.map(player => ({ ...player, in_party: selected.includes(player.id) })) }); }
      dirtySettingsForms.delete(form.id); savePreferences({ damageScope: 'party' }); refreshDrawer(); toast(t('saved'));
    } catch {}
  }
  if (form.id === 'event-form') { const anchor = new Date(values.anchor), interval = Number(values.intervalMinutes); if (!values.eventName.trim() || !Number.isFinite(anchor.getTime()) || interval < 1 || interval > 10080) { toast(t('invalidEvent'), true); return; } const id = uid(); dirtySettingsForms.delete(form.id); savePreferences({ events: [...prefs.events, { id, name: values.eventName.trim(), intervalMinutes: interval, anchor: anchor.toISOString(), reminderEnabled: values.reminderEnabled === 'on', reminderLeadMinutes: Number(values.reminderLeadMinutes) }], activeEventId: id }); refreshDrawer(); toast(t('saved')); }
  if (form.id === 'equipment-form') { if (!values.equipmentName.trim()) { toast(t('invalidEquipment'), true); return; } savePreferences({ equipment: [...prefs.equipment, { id: uid(), name: values.equipmentName.trim(), note: values.note }] }); refreshDrawer(); toast(t('saved')); }
  if (form.id === 'cooldown-form') { const seconds = Number(values.seconds); if (!values.cooldownName.trim() || seconds < 1 || seconds > 86400 || !Number.isFinite(seconds)) { toast(t('invalidPlanner'), true); return; } savePreferences({ manualCooldowns: [...prefs.manualCooldowns, { id: uid(), name: values.cooldownName.trim(), seconds, startedAt: 0 }] }); refreshDrawer(); toast(t('saved')); }
  if (form.id === 'odyle-form') { savePreferences({ odyle: values }); toast(t('saved')); tickTimers(); }
  if (form.id === 'alerts-form') { savePreferences({ alerts: { ...values, sound: values.sound === 'on', incomingWarnings: values.incomingWarnings === 'on', bossCasts: values.bossCasts === 'on', ownHealth: prefs.alerts.ownHealth } }); enableAudio(); toast(t('saved')); tickTimers(); }
  if (form.id === 'tickets-form') { dirtySettingsForms.delete(form.id); const ids = Object.keys(values).map(key => /^show:(\d+)$/.exec(key)?.[1]).filter(Boolean).map(Number); savePreferences({ ticketShow: normalizeTicketShow(ids) }); refreshDrawer(); toast(t('saved')); }
  if (form.id === 'names-form') { dirtySettingsForms.delete(form.id); const names = { ...prefs.idNames }, caps = { ...prefs.idCaps }; for (const [key, value] of Object.entries(values)) { const cap = /^cap:(ticket:\d+)$/.exec(key); if (cap) { const number = Number(value); if (Number.isInteger(number) && number >= 1) caps[cap[1]] = number; else delete caps[cap[1]]; continue; } if (!/^(ticket|item|server):/.test(key)) continue; if (String(value).trim()) names[key] = String(value); else delete names[key]; } savePreferences({ idNames: normalizeIdNames(names), idCaps: normalizeIdCaps(caps) }); refreshDrawer(); toast(t('saved')); }
  if (form.id === 'combat-form') { dirtySettingsForms.delete(form.id); savePreferences({ combatDetection: normalizeCombatDetection({ source: values.source, seconds: Number(values.seconds) }) }); refreshDrawer(); toast(t('saved')); }
  if (form.id === 'boss-form') { const ids = new FormData(form).getAll('bossId').map(Number).filter(Number.isSafeInteger); try { if (native) await action('set_boss_targets', { ids }); else if (demo) state = normalizeState({ ...state, targets: state.targets.map(target => ({ ...target, is_boss: ids.includes(Number(target.id)) })) }); dirtySettingsForms.delete(form.id); if (native) await refreshState(); refreshDrawer(); toast(t('saved')); } catch {} }
});

async function refreshState() {
  if (!native || refreshPending) return;
  const started = { revision: state.state_revision, receivedCount: receivedStateCount };
  refreshPending = true;
  try { receiveState(await invoke('get_state')); }
  catch (error) {
    if (!shouldApplyPollFailure(started, { revision: state.state_revision, receivedCount: receivedStateCount })) return;
    state = normalizeState({ ...state, status: 'disconnected', capture: { ...state.capture, status: 'disconnected', detail: `${t('failed')}: ${String(error).slice(0, 150)}` } }); renderMeter();
  }
  finally { refreshPending = false; }
}

function receiveState(value) {
  if (!acceptsStateSnapshot(state, value)) return;
  receivedStateCount++;
  const previous = state;
  state = normalizeState(value);
  if (previous.encounter_started_ms !== state.encounter_started_ms || previous.local_player_id !== state.local_player_id || previous.diagnostics.stream_gaps !== state.diagnostics.stream_gaps || previous.capture.missed_packets !== state.capture.missed_packets) { selectedBoardTargetId = null; automaticTargetFocus = null; }
  const diagnosticFingerprint = JSON.stringify([state.capture.status, state.capture.error_code, state.capture.admin?.elevated]);
  if (diagnosticFingerprint !== captureDiagnosticFingerprint) { captureDiagnosticFingerprint = diagnosticFingerprint; readCaptureDiagnostics(); }
  const petMetadata = petMetadataTransition(previous, state, { previousActorId: petCollectionOwner(previous)?.actor_id ?? null, currentActorId: petCollectionOwner(state)?.actor_id ?? null });
  if (petMetadata.clear) { characterData = characterSnapshot(); if (drawer === 'analysis' && ['build', 'pets'].includes(tab)) refreshDrawer(); }
  else if ((previous.diagnostics?.stream_gaps ?? 0) !== (state.diagnostics?.stream_gaps ?? 0) || (previous.capture?.missed_packets ?? 0) !== (state.capture?.missed_packets ?? 0)) markPetSnapshotStale('capture-gap');
  if (!state.field_boss_available) { worldData = fieldBossSnapshot(); if (drawer === 'analysis' && tab === 'worldBosses') refreshDrawer(); }
  if (petMetadata.fetch) readCharacterData();
  if (metadataEpoch(previous, 'world') !== metadataEpoch(state, 'world') && state.field_boss_available && (prefs.activeEventId.startsWith('boss:') || drawer === 'analysis' && tab === 'worldBosses')) readWorldData();
  if (drawer === 'analysis' && HISTORY_TABS.has(tab)) historyCache?.observe(state.history_revision); else historyCache?.track(state.history_revision);
  if (drawer === 'analysis' && tab === 'records' && state.personal_bests.revision !== recordData.revision) readRecords();
  renderMeter();
}

function openCaptureDiagnostics(event) {
  if ($('#notice').dataset.diagnostics !== 'true' || (event.type === 'keydown' && !['Enter', ' '].includes(event.key))) return;
  event.preventDefault(); openDrawer('settings', 'controls');
  $('#capture-diagnostics')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  readCaptureDiagnostics();
}
$('#notice').addEventListener('click', openCaptureDiagnostics);
$('#notice').addEventListener('keydown', openCaptureDiagnostics);
$('#compact-status').addEventListener('click', () => {
  if (!toolsOpen) openTools();
  $('#tools-status')?.scrollIntoView({ block: 'nearest' });
});
window.addEventListener('resize', syncOverlayGeometry);
window.addEventListener('blur', () => { if (hudGesture) finishHudGesture({ pointerId: hudGesture.pointerId }); });
if (typeof ResizeObserver === 'function') {
  const frameObserver = new ResizeObserver(() => {
    $('#meter').classList.toggle('short-frame', $('#meter').getBoundingClientRect().height <= 280);
    const roster = $('.roster-list');
    $('#meter').style.setProperty('--roster-gutter', `${Math.max(0, roster.offsetWidth - roster.clientWidth)}px`);
    renderPetTracking();
    scheduleRosterFit();
    scheduleOverlayRegions();
  });
  frameObserver.observe($('#meter')); frameObserver.observe($('.roster-list')); frameObserver.observe($('#players'));
}
applyAppearance(); renderMeter();
if (native) {
  invoke('get_app_info').then(info => { if (typeof info?.version === 'string') appVersion = info.version.slice(0, 40); if (drawer === 'settings' && !$('#drawer-content').contains(document.activeElement)) refreshDrawer(); }).catch(() => {});
  try { const loaded = await initialPreferences; if (loaded.untouched) prefs = loaded.preferences; applyAppearance(); renderMeter(); } catch {}
  try { await window.__TAURI__.event?.listen('luma-state', event => receiveState(event.payload)); } catch {}
  try { await window.__TAURI__.event?.listen('luma-calendar-state', event => applyScheduleSnapshot(event.payload)); } catch {}
  try { await window.__TAURI__.event?.listen('luma-cube-state', event => applyCubeSnapshot(event.payload)); } catch {}
  try { await window.__TAURI__.event?.listen('luma-hotkey', async event => { if (event.payload?.error) { toast(String(event.payload.error).slice(0, 200), true); return; } if (event.payload?.action === 'settings') openDrawer('settings', 'controls'); if (event.payload?.action === 'copy-summary') { try { const text = communitySummary(await invoke('get_current_encounter'), { scope: prefs.damageScope, locale: prefs.locale, anonymous: true }); if (text) { await navigator.clipboard.writeText(text); toast(t('copied')); } } catch { toast(t('failed'), true); } } }); } catch {}
  try { await window.__TAURI__.event?.listen('luma-fullscreen-error', event => { if (event.payload) toast(String(event.payload).slice(0, 200), true); }); } catch {}
  try { invoke('overlay_locked').then(value => { overlayLocked = value === true; applyAppearance(); scheduleRosterFit(); }).catch(() => {}); } catch {}
  try { await window.__TAURI__.event?.listen('luma-overlay-lock', event => { overlayLocked = event.payload === true; applyAppearance(); scheduleRosterFit(); }); } catch {}
  try { await window.__TAURI__.event?.listen('luma-main-action', event => { if (event.payload === 'settings') openDrawer('settings', 'controls'); else if (event.payload === 'analysis') openDrawer('analysis', 'overview'); }); } catch {}
  try { await window.__TAURI__.event?.listen('luma-preference-patch', event => { const patch = event.payload && typeof event.payload === 'object' ? event.payload : {}; const allowed = ['overlayScale', 'overlayRate', 'overlaySnap', 'opacity', 'combatDetection']; savePreferences(Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key)))); }); } catch {}
  try { await window.__TAURI__.event?.listen('luma-hotkey-state', event => { hotkeyState = event.payload; if (drawer === 'settings' && settingsTab === 'controls') refreshDrawer(); }); } catch {}
  try { await window.__TAURI__.event?.listen('luma-update-state', event => { updateState = event.payload; if (drawer === 'settings' && settingsTab === 'about') refreshDrawer(); renderUpdatePrompt(); }); } catch {}
  try { await window.__TAURI__.event?.listen('luma-preferences', () => { preferenceCommitter.load(async () => normalizePreferences(withSystemLocale(await invoke('get_preferences')))).then(result => { if (result.untouched) { prefs = result.preferences; applyAppearance(); renderMeter(); } }).catch(() => {}); }); } catch {}
  await refreshState();
  readRuntimeState();
  readCaptureDiagnostics();
  readWorldData();
  readEventSchedule();
  readCubeState();
  readTeamState();
  setInterval(() => { if (roomIntent || drawer === 'analysis' && tab === 'team') readTeamState(); }, 2000);
  setInterval(refreshState, 1500);
  setInterval(() => { if (drawer === 'analysis' && !snapshot && ['curves', 'rotation', 'healing', 'overview', 'effects'].includes(tab)) readCurveRecord(); }, 3000);
  setInterval(() => { if (prefs.activeEventId.startsWith('boss:') || drawer === 'analysis' && tab === 'worldBosses') readWorldData(); }, 15000);
  setInterval(() => { if (drawer === 'settings') readEventSchedule(); }, 30000);
  setInterval(() => { if (cubeState.enabled || drawer === 'settings' && settingsTab === 'hiddenCube') readCubeState(); }, 500);
}
setInterval(tickTimers, 1000);
setInterval(updatePlayback, 100);
setInterval(() => { if (prefs.radarOpen || drawer === 'analysis' && tab === 'radar') renderLiveRadar(); }, 1000);
