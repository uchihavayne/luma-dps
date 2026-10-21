import { spatialSnapshot } from './spatial.mjs';
import { trainingState } from './analysis.mjs';
import { assistanceState, encounterAssistance } from './assistance.mjs';
import { networkLatency, cooldownObservation, petProgress, stalePetProgress } from './telemetry.mjs';
import { characterSnapshot, petCollectionOwner } from './character.mjs';
export { petCollectionOwner } from './character.mjs';
import { normalizeLatencyHistory } from './latency-history.mjs';
import { focusedTarget } from './bosses.mjs';

export const THEMES = Object.freeze({
  graphite: { name: 'Graphite', bg: '#16181d', panel: '#262930', text: '#f5f5f7', accent: '#a8c7fa' },
  pearl: { name: 'Pearl', bg: '#f5f5f7', panel: '#ffffff', text: '#1d1d1f', accent: '#0066cc' },
  aurora: { name: 'Aurora', bg: '#101a27', panel: '#192938', text: '#edf8f7', accent: '#7ce9cb' },
  midnight: { name: 'Midnight', bg: '#10121b', panel: '#202433', text: '#edf0fa', accent: '#b2baff' },
  ocean: { name: 'Ocean', bg: '#081d29', panel: '#123344', text: '#e4f7ff', accent: '#6dd6f8' },
  violet: { name: 'Violet', bg: '#201629', panel: '#34253f', text: '#f6ecff', accent: '#d2a8ff' },
  ember: { name: 'Ember', bg: '#251812', panel: '#3b281f', text: '#fff2e8', accent: '#ffb078' },
  forest: { name: 'Forest', bg: '#14231e', panel: '#26382e', text: '#edf7e9', accent: '#b0dd88' },
  bronze: { name: 'Bronze', bg: '#242018', panel: '#393225', text: '#fcf4dd', accent: '#e8c477' },
  slate: { name: 'Slate', bg: '#1c232d', panel: '#2d3845', text: '#f0f3f7', accent: '#b7cadf' },
  rose: { name: 'Rose', bg: '#281920', panel: '#422832', text: '#ffedf2', accent: '#ffa9c5' },
  ice: { name: 'Ice', bg: '#14252c', panel: '#263d44', text: '#e8ffff', accent: '#a4e8ef' },
  white: { name: 'White', bg: '#f7f7f2', panel: '#e6eae7', text: '#1c3433', accent: '#087967' },
  custom: { name: 'Custom', bg: '#151c28', panel: '#293244', text: '#f2f6ff', accent: '#8bd6ff' },
});

export const FONTS = Object.freeze({
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  segoe: '"Segoe UI", system-ui, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  mono: '"Cascadia Code", Consolas, monospace',
});
export const LAYOUTS = Object.freeze({
  cupertino: { name: 'Luma Clear', description: { tr: 'Sıkı çubuklar, temiz cam yüzeyler', en: 'Compact bars, clean glass surfaces' } },
  studio: { name: 'Studio', description: { tr: 'Dengeli kartlar, net sayılar', en: 'Balanced cards, clear numbers' } },
  minimal: { name: 'Line', description: { tr: 'İnce çizgiler, sade liste', en: 'Fine lines, simple roster' } },
  focus: { name: 'Focus', description: { tr: 'Kişisel ölçüm ön planda', en: 'Personal measurement in focus' } },
  glass: { name: 'Prism', description: { tr: 'Yumuşak ışık, hafif yüzeyler', en: 'Soft light, light surfaces' } },
});
export const DISPLAY_MODULES = Object.freeze(['dps', 'pets', 'cube', 'events', 'odyle', 'team']);
export const PET_PIN_LIMIT = 12;

export function normalizeDisplayModules(input) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const modules = Object.fromEntries(DISPLAY_MODULES.map(name => [name, value[name] !== false]));
  if (!Object.values(modules).some(Boolean)) modules.pets = true;
  return modules;
}

export function displayModulePreset(preset) {
  return Object.fromEntries(DISPLAY_MODULES.map(name => [name, preset !== 'pets' || name === 'pets']));
}

export function petOnlyDisplay(preferences = {}) {
  const modules = normalizeDisplayModules(preferences.displayModules);
  return modules.pets && DISPLAY_MODULES.every(name => name === 'pets' || !modules[name]);
}

export function visibleAnalysisSections(sections, preferences = {}) {
  const modules = normalizeDisplayModules(preferences.displayModules);
  return sections.filter(name => ['pets', 'radar'].includes(name) ? modules.pets || name === 'radar' && modules.dps : name === 'team' ? modules.team
    : name === 'build' ? modules.dps || modules.odyle : name === 'worldBosses' ? modules.events
    : name === 'planner' ? modules.events || modules.odyle : name === 'alerts' ? modules.events || modules.dps : modules.dps);
}
export function visibleSettingsSections(sections, preferences = {}) {
  const modules = normalizeDisplayModules(preferences.displayModules);
  return sections.filter(name => name === 'calendar' ? modules.events : ['combatSettings', 'streaming'].includes(name) ? modules.dps
    : name === 'hiddenCube' ? modules.cube : name === 'character' ? modules.dps || modules.pets || modules.odyle : true);
}
export const DEFAULTS = Object.freeze({
  version: 1, appearanceRevision: 2, locale: 'tr', theme: 'graphite', font: 'system', targetFont: 'system', targetFontSize: 15,
  textScale: 1, opacity: 0.96, sort: 'dps', mode: 'all', locked: false,
  customColors: THEMES.custom, background: '', events: [], activeEventId: 'builtin:rift', bossIds: [],
  equipment: [], manualCooldowns: [], odyle: { current: 0, max: 0, refill: 0, intervalMinutes: 0, anchor: '' },
  alerts: { dpsGoal: 0, eventLeadMinutes: 5, sound: false, incomingWarnings: true }, importedHistory: [],
  damageScope: 'personal', rosterScope: 'observed', rowColorMode: 'performance', characterName: '', layout: 'cupertino', density: 'compact', showClass: true, showShares: true, showTeamCooldowns: true, rowMetric: 'both',
  numberPrecision: 2,
  summaryMetric: 'both', autoTargetRoster: true, recordNotifications: 'party',
  displayModules: Object.freeze(displayModulePreset('all')),
  radarOpen: false, radarRange: 100, petPins: [], petGoal: 'max', petAutoTrack: true, showPetTracker: true, petTrackerCollapsed: false,
  onlyAboveGame: false, clickThroughWhenLocked: false, fadeWhenIdle: false, hidePlayerNames: false, compactStrip: false, autoCheckUpdates: true, hotkeys: [],
  fullscreenOverlay: false, fullscreenLayout: 'dashboard', overlayX: 24, overlayY: 24, overlayWidth: 420, overlayHeight: 340,
  calendarVersion: 1, calendarRegion: 'EU', builtInReminders: {},
  showCubeLocator: true, cubeAutoListen: true, cubeSource: 'game', cubeThreshold: .82, cubeView: 'dps', cubeNavigatorSize: 'compact',
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
// A missing rate is not measured zero. Keep it unknown so a caller can use
// a received total and the matching scope's clock, or display an unavailable rate.
const nullableRate = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const diagnosticCount = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const bounded = (value, low, high, fallback = low) => Math.min(high, Math.max(low, finite(value, fallback)));
const str = (value, length = 80) => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').slice(0, length) : '';
const identifier = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : str(value, 80);
const oneOf = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : fallback;
const iso = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';

export function validBackground(value) {
  return typeof value === 'string' && value.length <= 1400000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
}

export function normalizePreferences(input = {}) {
  const p = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const events = (Array.isArray(p.events) ? p.events : []).slice(0, 20).map((event, i) => ({
    id: str(event?.id, 64) || `event-${i}`, name: str(event?.name, 64) || 'Event',
    intervalMinutes: bounded(event?.intervalMinutes, 1, 10080, 180), anchor: iso(event?.anchor),
    reminderEnabled: event?.reminderEnabled !== false, reminderLeadMinutes: Math.round(bounded(event?.reminderLeadMinutes, 0, 60, bounded(p.alerts?.eventLeadMinutes, 0, 60, 5))),
  })).filter(event => event.anchor);
  const custom = p.customColors || {};
  const builtInReminders = Object.fromEntries(Object.entries(p.builtInReminders && typeof p.builtInReminders === 'object' ? p.builtInReminders : {}).filter(([id, value]) => /^builtin:[a-z0-9-]{1,48}$/.test(id) && value && typeof value === 'object').slice(0, 32).map(([id, value]) => [id, { enabled: value.enabled === true, leadMinutes: Math.round(bounded(value.leadMinutes, 0, 60, 5)) }]));
  const activeEventId = !p.activeEventId && p.calendarVersion !== 1 ? 'builtin:rift' : p.activeEventId === '' ? '' : events.some(event => event.id === p.activeEventId) || /^boss:\d{1,20}:\d{1,20}$/.test(p.activeEventId || '') || /^builtin:[a-z0-9-]{1,48}$/.test(p.activeEventId || '') ? p.activeEventId : 'builtin:rift';
  return {
    version: 1, appearanceRevision: 2, locale: oneOf(p.locale, ['tr', 'en'], DEFAULTS.locale),
    theme: p.appearanceRevision !== 2 && p.theme === 'aurora' && (!p.layout || p.layout === 'studio') ? 'graphite' : oneOf(p.theme, Object.keys(THEMES), DEFAULTS.theme),
    font: oneOf(p.font, Object.keys(FONTS), DEFAULTS.font),
    targetFont: oneOf(p.targetFont, Object.keys(FONTS), DEFAULTS.targetFont),
    targetFontSize: bounded(p.targetFontSize, 8, 28, DEFAULTS.targetFontSize),
    textScale: bounded(p.textScale, 0.85, 2, 1), opacity: bounded(p.opacity, 0, 1, 0.96),
    sort: oneOf(p.sort, ['dps', 'damage', 'name'], 'dps'), mode: oneOf(p.mode, ['all', 'boss', 'both'], 'all'), locked: Boolean(p.locked),
    damageScope: oneOf(p.damageScope, ['personal', 'party', 'observed'], 'personal'), characterName: str(p.characterName, 64).trim(),
    rosterScope: oneOf(p.rosterScope, ['personal', 'party', 'observed'], 'observed'),
    rowColorMode: oneOf(p.rowColorMode, ['performance', 'class', 'accent'], 'performance'),
    layout: p.appearanceRevision !== 2 && (!p.layout || p.layout === 'studio') ? 'cupertino' : oneOf(p.layout, Object.keys(LAYOUTS), DEFAULTS.layout), density: p.appearanceRevision !== 2 && (!p.layout || p.layout === 'studio') ? 'compact' : oneOf(p.density, ['comfortable', 'compact'], DEFAULTS.density),
    showClass: p.showClass !== false, showShares: p.showShares !== false, showTeamCooldowns: p.showTeamCooldowns !== false, rowMetric: oneOf(p.rowMetric, ['both', 'dps', 'damage'], 'both'),
    numberPrecision: Math.round(bounded(p.numberPrecision, 0, 3, 2)),
    summaryMetric: oneOf(p.summaryMetric, ['dps', 'damage', 'both'], 'both'), autoTargetRoster: p.autoTargetRoster !== false, recordNotifications: oneOf(p.recordNotifications, ['party', 'self', 'off'], 'party'),
    displayModules: normalizeDisplayModules(p.displayModules),
    petPins: [...new Set((Array.isArray(p.petPins) ? p.petPins : []).slice(0, 100).filter(value => Number.isSafeInteger(value) && value >= 1000 && value <= 99999))].slice(0, PET_PIN_LIMIT),
    radarOpen: p.radarOpen === true, radarRange: [20, 50, 100, 200].includes(p.radarRange) ? p.radarRange : 100,
    petGoal: oneOf(p.petGoal, ['next', 'max'], 'max'), petAutoTrack: p.petAutoTrack !== false, showPetTracker: p.showPetTracker !== false, petTrackerCollapsed: p.petTrackerCollapsed === true,
    onlyAboveGame: p.onlyAboveGame === true, clickThroughWhenLocked: p.clickThroughWhenLocked === true, fadeWhenIdle: p.fadeWhenIdle === true, hidePlayerNames: p.hidePlayerNames === true, compactStrip: p.compactStrip === true, autoCheckUpdates: p.autoCheckUpdates !== false,
    fullscreenOverlay: p.fullscreenOverlay === true, fullscreenLayout: oneOf(p.fullscreenLayout, ['dashboard', 'hud'], 'dashboard'), overlayX: bounded(p.overlayX, 0, 20000, 24), overlayY: bounded(p.overlayY, 0, 20000, 24), overlayWidth: bounded(p.overlayWidth, 280, 1200, 420), overlayHeight: bounded(p.overlayHeight, 200, 1200, 340),
    hotkeys: (Array.isArray(p.hotkeys) && p.hotkeys.length ? p.hotkeys : ['toggle-visibility', 'toggle-lock', 'toggle-pause', 'reset', 'settings', 'copy-summary', 'toggle-fullscreen'].map((action, index) => ({ action, shortcut: `Ctrl+Alt+Shift+F${[7, 8, 9, 10, 11, 6, 5][index]}`, enabled: true }))).slice(0, 7).filter(row => row && ['toggle-visibility', 'toggle-lock', 'toggle-pause', 'reset', 'settings', 'copy-summary', 'toggle-fullscreen'].includes(row.action)).map(row => ({ action: row.action, shortcut: str(row.shortcut, 80), enabled: row.enabled !== false })),
    calendarVersion: 1, calendarRegion: oneOf(p.calendarRegion, ['EU'], 'EU'), builtInReminders,
    showCubeLocator: p.showCubeLocator !== false, cubeAutoListen: p.cubeAutoListen !== false, cubeSource: oneOf(p.cubeSource, ['game', 'system'], 'game'), cubeThreshold: bounded(p.cubeThreshold, .6, .97, .82),
    cubeView: 'dps', cubeNavigatorSize: oneOf(p.cubeNavigatorSize, ['compact', 'full'], 'compact'),
    customColors: Object.fromEntries(['bg', 'panel', 'text', 'accent'].map(key => [key, color(custom[key], THEMES.custom[key])])),
    background: validBackground(p.background), events,
    activeEventId,
    bossIds: [],
    equipment: (Array.isArray(p.equipment) ? p.equipment : []).slice(0, 20).map(item => ({ id: str(item?.id, 64), name: str(item?.name, 64), note: str(item?.note, 200) })).filter(item => item.name),
    manualCooldowns: (Array.isArray(p.manualCooldowns) ? p.manualCooldowns : []).slice(0, 20).map(item => ({ id: str(item?.id, 64), name: str(item?.name, 64), seconds: bounded(item?.seconds, 1, 86400, 60), startedAt: bounded(item?.startedAt, 0, 8640000000000000, 0) })).filter(item => item.name),
    odyle: { current: bounded(p.odyle?.current, 0, 1000000), max: bounded(p.odyle?.max, 0, 1000000), refill: bounded(p.odyle?.refill, 0, 1000000), intervalMinutes: bounded(p.odyle?.intervalMinutes, 0, 10080), anchor: iso(p.odyle?.anchor) },
    alerts: { dpsGoal: bounded(p.alerts?.dpsGoal, 0, 1e12), eventLeadMinutes: bounded(p.alerts?.eventLeadMinutes, 0, 60, 5), sound: Boolean(p.alerts?.sound), incomingWarnings: p.alerts?.incomingWarnings !== false },
    importedHistory: (Array.isArray(p.importedHistory) ? p.importedHistory : []).slice(0, 30).map(normalizeEncounter).filter(Boolean),
  };
}

export function numericPreferenceEdit(name, value) {
  const limits = { targetFontSize: [8, 28], numberPrecision: [0, 3] }[name];
  if (!limits || typeof value !== 'string' || !/^\d+(?:\.0+)?$/.test(value)) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= limits[0] && number <= limits[1] ? { [name]: number } : null;
}

export function acceptsCalendarSnapshot(current, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return false;
  if (Number.isSafeInteger(incoming.revision) && Number.isSafeInteger(current?.revision)) return incoming.revision > current.revision;
  return JSON.stringify(current) !== JSON.stringify(incoming);
}

export function acceptsStateSnapshot(current, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return false;
  const revision = value => Number.isSafeInteger(value?.state_revision) && value.state_revision >= 0 ? value.state_revision : null;
  const previous = revision(current), next = revision(incoming);
  return previous === null || next !== null && next > previous;
}

export function importTheme(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.type !== 'luma-theme' || parsed.version !== 1 || !parsed.theme || typeof parsed.theme !== 'object') throw new Error('Invalid Luma theme');
  const p = normalizePreferences({ ...parsed.theme, appearanceRevision: 2 });
  if (parsed.theme.background && !p.background) throw new Error('Invalid raster background');
  return Object.fromEntries(['appearanceRevision', 'theme', 'font', 'targetFont', 'targetFontSize', 'textScale', 'opacity', 'customColors', 'background', 'layout', 'density', 'showClass', 'showShares', 'rowMetric', 'rowColorMode', 'summaryMetric', 'numberPrecision'].map(key => [key, p[key]]));
}

export function exportTheme(prefs) {
  const p = normalizePreferences(prefs);
  return JSON.stringify({ type: 'luma-theme', version: 1, theme: Object.fromEntries(['appearanceRevision', 'theme', 'font', 'targetFont', 'targetFontSize', 'textScale', 'opacity', 'customColors', 'background', 'layout', 'density', 'showClass', 'showShares', 'rowMetric', 'rowColorMode', 'summaryMetric', 'numberPrecision'].map(key => [key, p[key]])) }, null, 2);
}

export function recurringEvent(event, now = Date.now()) {
  const anchor = Date.parse(event?.anchor);
  const period = finite(event?.intervalMinutes) * 60000;
  if (!Number.isFinite(anchor) || period < 60000 || !Number.isFinite(now)) return null;
  const next = now < anchor ? anchor : anchor + (Math.floor((now - anchor) / period) + 1) * period;
  return { next, remaining: Math.max(0, next - now) };
}

export function manualOdyle(plan, now = Date.now()) {
  const current = Math.max(0, finite(plan?.current));
  const maximum = Math.max(0, finite(plan?.max));
  const anchor = Date.parse(plan?.anchor);
  const period = finite(plan?.intervalMinutes) * 60000;
  const cycles = Number.isFinite(anchor) && period > 0 ? Math.max(0, Math.floor((now - anchor) / period)) : 0;
  const estimated = current + cycles * Math.max(0, finite(plan?.refill));
  return maximum > 0 ? Math.min(maximum, estimated) : estimated;
}

export function normalizeSkill(skill = {}) {
  const quality = Object.fromEntries(['direction_1_hits', 'direction_2_hits', 'perfect_hits', 'double_hits', 'parry_hits', 'quality_hits', 'direct_hits', 'tick_hits'].map(key => [key, typeof skill[key] === 'number' && Number.isFinite(skill[key]) && skill[key] >= 0 ? skill[key] : null]));
  return { ...quality, id: identifier(skill.id), name: str(skill.name, 100) || `Skill #${identifier(skill.id) || '?'}`, hits: Math.max(0, finite(skill.hits)), damage: Math.max(0, finite(skill.damage)), crit_hits: Math.max(0, finite(skill.crit_hits)), min: Math.max(0, finite(skill.min)), max: Math.max(0, finite(skill.max)) };
}

export function observedPlayerName(player = {}) {
  const name = str(player.name, 80).trim(), id = identifier(player.id) || '?';
  const placeholder = !name || player.identity_confirmed !== true && /^(?:unknown|undefined|null|bilinmiyor)$/iu.test(name);
  return placeholder ? `#${id}` : name;
}

export function displayPlayerName(player = {}, locale = 'tr') {
  const name = observedPlayerName(player);
  return player.identity_pending === true || player.identity_confirmed !== true && /^#\d+$/u.test(name)
    ? locale === 'en' ? 'Name pending' : 'İsim bekleniyor'
    : name;
}

export function displayTargetName(target = {}, locale = 'tr') {
  const name = str(target.name, 100).trim();
  if (name && !/^(?:#\d+|(?:Target|NPC)\s+#?\d+)$/iu.test(name)) return name;
  return locale === 'en' ? target.is_boss ? 'Boss name pending' : 'Target name pending' : target.is_boss ? 'Boss adı bekleniyor' : 'Hedef adı bekleniyor';
}

export function rosterEligible(player = {}) {
  return player.damage > 0 || player.identity_confirmed === true || player.is_local === true || player.in_party === true;
}

export function normalizePlayer(player = {}) {
  const received = Object.fromEntries(['damage_taken', 'damage_taken_per_second', 'healing', 'hps', 'unclassified_player_target_amount', 'unclassified_player_target_events'].map(key => [key, typeof player[key] === 'number' && Number.isFinite(player[key]) && player[key] >= 0 ? player[key] : null]));
  return { ...received, identity_confirmed: player.identity_confirmed === true, healing_coverage: str(player.healing_coverage, 40), healing_skills: (Array.isArray(player.healing_skills) ? player.healing_skills : []).slice(0, 500).map(normalizeSkill), damage_taken_complete: typeof player.damage_taken_complete === 'boolean' ? player.damage_taken_complete : null, id: identifier(player.id), name: observedPlayerName(player), identity_pending: player.identity_confirmed !== true && observedPlayerName(player) === `#${identifier(player.id) || '?'}`, class_name: str(player.class_name, 60) || '—', is_local: player.is_local === true, in_party: player.in_party === true, damage: Math.max(0, finite(player.damage)), dps: nullableRate(player.dps), share: bounded(player.share, 0, 100), skills: (Array.isArray(player.skills) ? player.skills : []).slice(0, 500).map(normalizeSkill) };
}

function identityState(value = {}) {
  const nullableMetric = metric => typeof metric === 'number' && Number.isFinite(metric) ? Math.max(0, metric) : null;
  return {
    focused_target_id: value.focused_target_id === null || value.focused_target_id === undefined ? null : identifier(value.focused_target_id),
    focused_target_observed_at_ms: nullableMetric(value.focused_target_observed_at_ms),
    live_target: value.live_target && typeof value.live_target === 'object' && !Array.isArray(value.live_target) ? normalizeTarget(value.live_target) : null,
    local_player_id: value.local_player_id === null || value.local_player_id === undefined ? null : identifier(value.local_player_id),
    local_player_name: str(value.local_player_name, 80), local_identity_source: oneOf(value.local_identity_source, ['server', 'manual', 'name-match', 'unresolved'], 'unresolved'),
    personal_total_damage: nullableMetric(value.personal_total_damage), personal_dps: nullableRate(value.personal_dps), personal_elapsed_ms: nullableMetric(value.personal_elapsed_ms), personal_started_ms: nullableMetric(value.personal_started_ms),
    personal_damage_taken: nullableMetric(value.personal_damage_taken), personal_damage_taken_per_second: nullableMetric(value.personal_damage_taken_per_second), personal_damage_taken_elapsed_ms: Math.max(0, finite(value.personal_damage_taken_elapsed_ms)), personal_damage_taken_started_ms: nullableMetric(value.personal_damage_taken_started_ms), personal_healing: nullableMetric(value.personal_healing), personal_hps: nullableMetric(value.personal_hps),
    personal_damage_taken_complete: typeof value.personal_damage_taken_complete === 'boolean' ? value.personal_damage_taken_complete : null, unclassified_player_target_amount: nullableMetric(value.unclassified_player_target_amount), unclassified_player_target_events: nullableMetric(value.unclassified_player_target_events),
    personal_targets: (Array.isArray(value.personal_targets) ? value.personal_targets : []).slice(0, 100).map(normalizeTarget),
    party_member_ids: (Array.isArray(value.party_member_ids) ? value.party_member_ids : []).slice(0, 100).map(identifier),
    party_membership_source: oneOf(value.party_membership_source, ['server', 'manual', 'unresolved'], 'unresolved'),
    party_total_damage: nullableMetric(value.party_total_damage), party_dps: nullableRate(value.party_dps), party_elapsed_ms: nullableMetric(value.party_elapsed_ms),
    party_targets: (Array.isArray(value.party_targets) ? value.party_targets : []).slice(0, 100).map(normalizeTarget),
  };
}

export function liveServerActorId(state = {}) {
  const live = state.live_team_identity;
  const value = live && typeof live === 'object' && !Array.isArray(live) ? live.local : { actor_id: state.local_player_id, identity_source: state.local_identity_source };
  const id = value?.actor_id;
  return value?.identity_source === 'server' && /^[1-9]\d{0,9}$/.test(String(id)) && Number(id) <= 0xffffffff ? String(id) : null;
}

export function petCollectionEpoch(value = {}) {
  const owner = petCollectionOwner(value);
  return owner ? `${owner.generation}:${owner.actor_id}` : 'none';
}

export function acceptsPetCollectionSnapshot(state, incoming) {
  const owner = petCollectionOwner(state), received = petCollectionOwner(incoming);
  if (!owner || !received || owner.actor_id !== received.actor_id || owner.generation !== received.generation) return false;
  return incoming.pet_progress === null || incoming.pet_progress === undefined || petProgress(incoming.pet_progress, { localPlayerId: owner.actor_id }) !== null;
}

// Entity death cannot erase a verified collection. Keep its received counters
// visible, with no rate estimate until the matching combat self is available.
export function petCollectionProgress(state, snapshot, { now = Date.now() } = {}) {
  if (!acceptsPetCollectionSnapshot(state, snapshot)) return null;
  const owner = petCollectionOwner(state), received = petProgress(snapshot.pet_progress, { localPlayerId: owner.actor_id });
  if (!received) return null;
  const reversed = !Number.isSafeInteger(now) || now < 0 || received.observed_at_ms > now + 250 || received.pets.some(row => row.observed_at_ms > now + 250);
  const reason = liveServerActorId(state) !== owner.actor_id ? 'combat-entity-unavailable'
    : state.capture?.status !== 'capturing' ? 'capture-unavailable' : reversed ? 'clock-reversal' : null;
  return reason ? stalePetProgress(received, { now, reason }) : received;
}

// A short-lived affordance after an actual own hit, including the moment the
// target dies. Reading a report or repainting never extends its hit timestamp.
export function normalizeRecentPersonalTarget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.source !== 'server-self-hit') return null;
  const actor = input => /^[1-9]\d{0,9}$/.test(String(input)) && Number(input) <= 0xffffffff ? String(input) : null;
  const own = actor(value.actor_id), target = actor(value.target_id), at = value.hit_at_ms;
  if (!own || !target || !Number.isSafeInteger(at) || at < 0 || at > 8640000000000000) return null;
  const name = value.target_name === null || value.target_name === undefined ? null : typeof value.target_name === 'string' && value.target_name.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value.target_name) ? value.target_name : null;
  const npc = Number.isInteger(value.target_npc_id) && value.target_npc_id >= 100000 && value.target_npc_id <= 9999999 ? value.target_npc_id : null;
  return { actor_id: own, target_id: target, target_name: name, target_npc_id: npc, hit_at_ms: at, source: 'server-self-hit' };
}

export function recentPetTarget(previous, state = {}, now = Date.now()) {
  const actor = liveServerActorId(state), ownName = str(state.live_team_identity?.local?.name ?? state.local_player_name, 80);
  const capture = state.capture || {};
  if (!actor || !Number.isSafeInteger(now) || now < 0) return null;
  const epoch = `${actor}:${ownName}:${state.diagnostics?.stream_gaps ?? 0}:${capture.missed_packets ?? 0}`;
  const notBefore = previous && previous.epoch !== epoch ? now : previous?.notBefore ?? 0;
  const empty = { target: null, at: null, epoch, notBefore };
  if (['stopped', 'disconnected', 'error', 'no-game', 'waiting', 'starting', 'permission-required', 'unavailable', 'unsupported', 'api-unavailable', 'api-version-mismatch', 'operation-not-supported'].includes(capture.status)) return { ...empty, notBefore: now };
  const received = normalizeRecentPersonalTarget(state.recent_personal_target);
  if (received) {
    if (received.actor_id !== actor || received.hit_at_ms < notBefore || now < received.hit_at_ms || now - received.hit_at_ms >= 10000) return empty;
    return { target: { id: received.target_id, name: received.target_name || '', npc_id: received.target_npc_id }, at: received.hit_at_ms, epoch, notBefore, source: 'received-hit' };
  }
  if (previous?.source === 'received-hit') return empty;
  const at = state.focused_target_observed_at_ms;
  const focus = focusedTarget(state, now);
  if (focus.source === 'personal-hit' && String(state.local_player_id) === actor && state.local_identity_source === 'server'
      && String(focus.target?.own_participant?.id) === actor && Number.isSafeInteger(at) && at >= notBefore && now >= at && now - at < 10000) {
    return { target: focus.target, at, epoch, notBefore };
  }
  if (!previous?.target || previous.epoch !== epoch || !Number.isSafeInteger(previous.at) || now < previous.at || now - previous.at >= 10000) return empty;
  if (state.focused_target_id !== null && state.focused_target_id !== undefined && String(state.focused_target_id) !== String(previous.target.id)) return empty;
  return previous;
}

export function petTargetStatus(state = {}, observation, matches = []) {
  if (!liveServerActorId(state)) return 'self-identity-pending';
  const target = observation?.target;
  if (!target) return 'waiting-personal-hit';
  if (Array.isArray(matches) && matches.length) return 'matched';
  const name = typeof target.name === 'string' ? target.name.trim() : '';
  return !target.npc_id && (!name || /^(?:#\d+|Target\s+#?\d+)$/iu.test(name)) ? 'npc-metadata-pending' : 'catalog-no-match';
}

function encounterContext(value = {}) {
  if (!value || typeof value !== 'object' || !['server', 'server-zone'].includes(value.source)) return null;
  return { source: value.source, map_id: Number.isSafeInteger(value.map_id) && value.map_id > 0 && value.map_id <= 10000000 ? value.map_id : null, instance_id: value.source === 'server' && value.instance_id != null ? identifier(value.instance_id) : null, session_id: str(value.session_id, 128), zone_observed_at_ms: typeof value.zone_observed_at_ms === 'number' && Number.isFinite(value.zone_observed_at_ms) && value.zone_observed_at_ms >= 0 ? value.zone_observed_at_ms : null, instance_kind: value.source === 'server' && value.instance_kind === 'dungeon' ? 'dungeon' : '', instance_name: str(value.instance_name, 100), map_name: str(value.map_name, 100), difficulty: str(value.difficulty, 48) };
}
function encounterSamples(rows, metric) {
  return (Array.isArray(rows) ? rows : []).slice(0, 20000).filter(row => row && Number.isSafeInteger(row.timestamp_ms) && row.timestamp_ms >= 0 && typeof row.amount === 'number' && Number.isFinite(row.amount) && row.amount >= 0 && row.amount <= Number.MAX_SAFE_INTEGER && (!row.metric || row.metric === metric)).map(row => ({ timestamp_ms: row.timestamp_ms, amount: row.amount, source: identifier(row.source), player_id: identifier(row.player_id ?? row.source), target: identifier(row.target), skill: identifier(row.skill), critical: row.critical === true, tick: row.tick === true, metric }));
}

export function normalizeEncounter(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const actorScope = oneOf(value.actor_scope, ['personal', 'party', 'observed'], 'observed');
  const unknownScopedTotal = value.total_damage === null && actorScope !== 'observed';
  if (!unknownScopedTotal && !Number.isFinite(Number(value.total_damage ?? value.damage))) return null;
  const publishedTime = iso(value.timestamp ?? value.started_at);
  const timestamp = publishedTime && Date.parse(publishedTime) <= 253_402_300_799_999 ? publishedTime : Number.isFinite(value.started_ms) && value.started_ms > 0 && value.started_ms <= 253_402_300_799_999 ? new Date(value.started_ms).toISOString() : '';
  const samples = Array.isArray(value.damage_samples) ? value.damage_samples : [];
  const damageSamples = encounterSamples(samples, 'damage'), healingSamples = encounterSamples(value.healing_samples, 'healing');
  return { spatial: spatialSnapshot(value.spatial), assist: encounterAssistance(value.assist), context: encounterContext(value.context), healing_samples: healingSamples, healing_sample_complete: value.healing_sample_complete === true && healingSamples.length === (value.healing_samples?.length || 0), source: oneOf(value.source, ['captured', 'imported', 'demo'], 'unknown'), stream_gaps: Math.max(0, finite(value.stream_gaps ?? value.diagnostics?.stream_gaps)), truncated: value.truncated === true || value.diagnostics?.truncated_encounter === true, ...identityState(value), timing_valid: value.timing_valid !== false && !(finite(value.elapsed_ms) <= 0 && finite(value.total_damage ?? value.damage) > 0), network_latency: normalizeLatencyHistory(value.network_latency, value), character_build: characterSnapshot({ own: value.character_build }).own, actor_scope: actorScope, provenance: value.provenance === 'imported-unverified' || value.source === 'imported' ? 'imported-unverified' : value.provenance === 'demo' ? 'demo' : 'received', id: identifier(value.id), name: str(value.name ?? value.target_name ?? value.targets?.[0]?.name, 100) || 'Encounter', timestamp, started_ms: Number.isFinite(value.started_ms) ? Math.max(0, value.started_ms) : null, ended_ms: Number.isFinite(value.ended_ms) ? Math.max(0, value.ended_ms) : null, sample_complete: value.sample_complete === true && damageSamples.length === samples.length, damage_samples: damageSamples, elapsed_ms: Math.max(0, finite(value.elapsed_ms)), total_damage: unknownScopedTotal ? null : Math.max(0, finite(value.total_damage ?? value.damage)), dps: nullableRate(value.dps), players: (Array.isArray(value.players) ? value.players : []).slice(0, 100).map(normalizePlayer), targets: (Array.isArray(value.targets) ? value.targets : []).slice(0, 100).map(normalizeTarget) };
}

function normalizeTarget(target = {}) {
  const hp = key => typeof target[key] === 'number' && Number.isFinite(target[key]) && target[key] >= 0 ? target[key] : null;
  const participant = value => normalizePlayer({ ...value, skills: [] });
  return { id: identifier(target.id), name: str(target.name, 100) || `#${identifier(target.id) || '?'}`, npc_id: Number.isInteger(target.npc_id) && target.npc_id >= 100000 && target.npc_id <= 9999999 ? target.npc_id : null, is_boss: target.is_boss === true, damage: Math.max(0, finite(target.damage)), current_hp: hp('current_hp'), reported_max_hp: hp('reported_max_hp'), observed_peak_hp: hp('observed_peak_hp'), health_observed_at_ms: hp('health_observed_at_ms'), current_hp_observed_at_ms: hp('current_hp_observed_at_ms'),
    participants: (Array.isArray(target.participants) ? target.participants : []).slice(0, 10).map(participant), participant_count: Math.max(0, finite(target.participant_count)), participants_available: target.participants_available === true,
    own_participant: target.own_participant && typeof target.own_participant === 'object' && !Array.isArray(target.own_participant) ? participant(target.own_participant) : null,
    own_rank: hp('own_rank'), party_total_damage: hp('party_total_damage'), party_dps: hp('party_dps'), started_ms: hp('started_ms'), elapsed_ms: hp('elapsed_ms'), last_hit_ms: hp('last_hit_ms'), own_last_hit_ms: hp('own_last_hit_ms'), capture_complete: target.capture_complete === true };
}

function liveTargets(values, focusedId) {
  const targets = Array.isArray(values) ? values : [];
  const focused = focusedId === null || focusedId === undefined ? null : targets.find(target => String(target?.id) === String(focusedId));
  return (focused ? [focused, ...targets.filter(target => target !== focused).slice(0, 99)] : targets.slice(0, 100)).map(normalizeTarget);
}

function allTargetsSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const total = diagnosticCount(value.total_damage), elapsed = diagnosticCount(value.elapsed_ms);
  const rate = input => nullableRate(input) !== null && input <= Number.MAX_SAFE_INTEGER ? input : null;
  const dps = rate(value.dps);
  if (total === null || elapsed === null || dps === null) return null;
  return {
    total_damage: total, dps, elapsed_ms: elapsed,
    personal_total_damage: diagnosticCount(value.personal_total_damage), personal_dps: rate(value.personal_dps), personal_elapsed_ms: diagnosticCount(value.personal_elapsed_ms),
    party_total_damage: diagnosticCount(value.party_total_damage), party_dps: rate(value.party_dps), party_elapsed_ms: diagnosticCount(value.party_elapsed_ms),
  };
}

export function normalizeState(value) {
  const s = value && typeof value === 'object' ? value : {};
  const capture = s.capture || {}, admin = capture.admin || {};
  const historyRevision = Number.isSafeInteger(s.history_revision) && s.history_revision >= 0 ? s.history_revision : 0;
  const historyCount = Number.isSafeInteger(s.history_count) && s.history_count >= 0 ? s.history_count : (Array.isArray(s.history) ? s.history.length : 0);
  const encounterActive = typeof s.encounter_active === 'boolean' ? s.encounter_active : null;
  const metadata = { personal_bests: { revision: diagnosticCount(s.personal_bests?.revision) ?? 0, count: diagnosticCount(s.personal_bests?.count) ?? 0, notices: Array.isArray(s.personal_bests?.notices) ? s.personal_bests.notices.slice(0, 8) : [], storage_error: str(s.personal_bests?.storage_error, 200) }, state_revision: Number.isSafeInteger(s.state_revision) && s.state_revision >= 0 ? s.state_revision : null, character_revision: Number.isSafeInteger(s.character_revision) && s.character_revision >= 0 ? s.character_revision : 0, character_available: s.character_available === true, field_boss_revision: Number.isSafeInteger(s.field_boss_revision) && s.field_boss_revision >= 0 ? s.field_boss_revision : 0, field_boss_available: s.field_boss_available === true, recent_personal_target: normalizeRecentPersonalTarget(s.recent_personal_target), all_targets_summary: allTargetsSummary(s.all_targets_summary), pet_collection_owner: petCollectionOwner(s) };
  return { spatial: spatialSnapshot(s.spatial), ...identityState(s), ...metadata, live_team_identity: s.live_team_identity && typeof s.live_team_identity === 'object' && !Array.isArray(s.live_team_identity) ? s.live_team_identity : null, party_identity_roster: s.party_identity_roster && typeof s.party_identity_roster === 'object' && !Array.isArray(s.party_identity_roster) ? s.party_identity_roster : null, resources: s.resources && typeof s.resources === 'object' && !Array.isArray(s.resources) ? s.resources : null, actor_cooldowns: Array.isArray(s.actor_cooldowns) ? s.actor_cooldowns.slice(0, 1024).filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [], observed_casts: Array.isArray(s.observed_casts) ? s.observed_casts.slice(0, 512) : [], training: trainingState(s.training), assist: assistanceState(s.assist), history_revision: historyRevision, history_count: historyCount, encounter_active: encounterActive, status: str(s.status, 120) || 'disconnected', elapsed_ms: Math.max(0, finite(s.elapsed_ms)), total_damage: Math.max(0, finite(s.total_damage)), dps: nullableRate(s.dps), paused: Boolean(s.paused), players: (Array.isArray(s.players) ? s.players : []).slice(0, 100).map(normalizePlayer), targets: liveTargets(s.targets, s.focused_target_id), observed_targets: liveTargets(s.observed_targets, s.focused_target_id), encounter_started_ms: typeof s.encounter_started_ms === 'number' && Number.isSafeInteger(s.encounter_started_ms) && s.encounter_started_ms >= 0 ? s.encounter_started_ms : null, history: (Array.isArray(s.history) ? s.history : []).slice(0, 200).map(normalizeEncounter).filter(Boolean), cooldowns: Array.isArray(s.cooldowns) ? s.cooldowns.slice(0, 256).filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [], diagnostics: { frames: diagnosticCount(s.diagnostics?.frames), damage_events: diagnosticCount(s.diagnostics?.damage_events), stream_gaps: Math.max(0, finite(s.diagnostics?.stream_gaps)), ambiguous_periodic_events: Math.max(0, finite(s.diagnostics?.ambiguous_periodic_events)), ambiguous_periodic_amount: Math.max(0, finite(s.diagnostics?.ambiguous_periodic_amount)) }, capture: { network_latency: networkLatency(capture.network_latency), status: str(capture.status, 120), detail: str(capture.detail, 500), error_code: str(capture.error_code, 80), packets: Math.max(0, finite(capture.packets)), missed_packets: Math.max(0, finite(capture.missed_packets)), game_processes: Number.isFinite(capture.game_processes) ? Math.max(0, capture.game_processes) : null, game_connections: Number.isFinite(capture.game_connections) ? Math.max(0, capture.game_connections) : null, last_packet_at_ms: Number.isFinite(capture.last_packet_at_ms) ? Math.max(0, capture.last_packet_at_ms) : null, admin: { required: admin.required === true, elevated: typeof admin.elevated === 'boolean' ? admin.elevated : null, status: str(admin.status, 80), detail: str(admin.detail, 300) } } };
}

const CONNECTION_TEXT = Object.freeze({
  tr: {
    browser: ['Tarayıcı önizlemesi', 'Tarayıcı önizlemesi · Canlı yakalama için masaüstü uygulaması gerekir.'],
    demo: ['DEMO', 'DEMO · Sabit örnek veriler. Canlı oyun verisi değildir.'],
    permission: ['Yönetici gerekli', 'Yönetici olarak yeniden açın. Windows paket yakalama izni reddedildi.'],
    unsupported: ['Yakalama API’si kullanılamıyor', 'Windows paket yakalama API’si kullanılamıyor. Nedeni belirlemek için uyumluluk tanısını açın.'],
    api_unavailable: ['Yakalama API’si kullanılamıyor', 'Windows paket yakalama API’si yüklenemedi. Ayrıntılar ve hata kodu için uyumluluk tanısını açın.'],
    api_version_mismatch: ['Yakalama API sürümü uyumsuz', 'Yüklenen paket yakalama API’si ile istenen sürüm uyuşmuyor. Uyumluluk tanısını açın.'],
    operation_not_supported: ['Yakalama işlemi desteklenmiyor', 'Paket yakalama API’si istenen işlemi desteklemiyor. Uyumluluk tanısını açın.'],
    disabled: ['Yakalama kapalı', 'Bu başlatmada paket yakalama kapalı. Canlı olaylar alınmıyor.'],
    error: ['Yakalama hatası', 'Paket yakalama başlatılamadı. Ayrıntı için bu bildirimin üzerine gelin.'],
    disconnected: ['Bağlantı yok', 'Yakalama durumu alınamıyor. Masaüstü uygulamasını yeniden açın.'],
    starting: ['Yakalama başlıyor', 'Windows paket yakalama hazırlanıyor.'],
    waiting_game: ['Oyun bekleniyor', 'AION2 TCP bağlantısı bekleniyor. Oyunu açın ve karaktere giriş yapın.'],
    waiting_connection: ['Bağlantı bekleniyor', 'AION2 açık; desteklenen oyun TCP bağlantısı bekleniyor. Karaktere giriş yapın.'],
    waiting_traffic: ['Trafik bekleniyor', 'AION2 TCP bağlantısı var; oyun paketleri bekleniyor.'],
    traffic: ['Oyun trafiği', 'AION2 TCP paketleri alınıyor; henüz savaş olayı yok.'],
    loss: ['Paket kaybı', 'Bu yakalama oturumunda paket kaybı oluştu. Ölçüm verileri eksik olabilir.'],
    paused: ['Duraklatıldı', 'Hasar kaydı duraklatıldı. Devam etmek için ▶ düğmesini kullanın.'],
    combat: ['Savaş verisi', 'Alınan savaş olayları gösteriliyor.'],
    combat_active: ['Savaş', 'Alınan savaş olayları kaydediliyor.'],
  },
  en: {
    browser: ['Browser preview', 'Browser preview · Live capture requires the desktop app.'],
    demo: ['DEMO', 'DEMO · Fixed sample data. These are not live game statistics.'],
    permission: ['Admin required', 'Reopen as administrator. Windows denied packet capture permission.'],
    unsupported: ['Capture API unavailable', 'The Windows packet capture API is unavailable. Open compatibility diagnostics to identify the cause.'],
    api_unavailable: ['Capture API unavailable', 'The Windows packet capture API could not be loaded. Open compatibility diagnostics for details and the error code.'],
    api_version_mismatch: ['Capture API version mismatch', 'The loaded packet capture API does not match the requested version. Open compatibility diagnostics.'],
    operation_not_supported: ['Capture operation unsupported', 'The packet capture API does not support the requested operation. Open compatibility diagnostics.'],
    disabled: ['Capture disabled', 'Packet capture is disabled for this launch. No live events are being received.'],
    error: ['Capture error', 'Packet capture could not start. Hover over this notice for details.'],
    disconnected: ['Disconnected', 'Capture status is unavailable. Reopen the desktop app.'],
    starting: ['Starting capture', 'Preparing Windows packet capture.'],
    waiting_game: ['Waiting for game', 'Waiting for an AION2 TCP connection. Open the game and log into a character.'],
    waiting_connection: ['Waiting for connection', 'AION2 is running; waiting for a supported game TCP connection. Log into a character.'],
    waiting_traffic: ['Waiting for traffic', 'An AION2 TCP connection exists; waiting for game packets.'],
    traffic: ['Game traffic', 'Receiving AION2 TCP packets; no combat event has been received yet.'],
    loss: ['Packet loss', 'This capture session has lost packets. Recorded statistics may be incomplete.'],
    paused: ['Paused', 'Damage recording is paused. Use ▶ to resume.'],
    combat: ['Combat data', 'Showing received combat events.'],
    combat_active: ['In combat', 'Recording received combat events.'],
  },
});

// A responsive native bridge is not evidence of a working game capture.
export function connectionStatus(value, { native = false, demo = false, locale = 'tr', now = Date.now() } = {}) {
  const s = normalizeState(value), c = s.capture;
  const engineStatus = s.status.toLowerCase(), captureStatus = c.status.toLowerCase();
  const code = c.error_code.toLowerCase().trim(), adminStatus = c.admin.status.toLowerCase();
  const permissionCode = /^(?:0x80070005|0x80070522|0x800702e4|win32:(?:5|740|1314)|5|740|1314|e_accessdenied)$/;
  const legacyPermissionCode = !code && /(?:^|[^a-z0-9])(?:0x80070005|0x80070522|0x800702e4|win32:(?:5|740|1314))\b/i.test(c.detail);
  const permissionRequired = captureStatus === 'permission-required' || permissionCode.test(code) || legacyPermissionCode || adminStatus === 'required' || c.admin.required && c.admin.elevated === false && adminStatus !== 'unknown';
  let kind;
  if (demo && !native) kind = 'demo';
  else if (!native) kind = 'browser';
  else if (permissionRequired) kind = 'permission';
  else if (captureStatus === 'unsupported') kind = 'unsupported';
  else if (captureStatus === 'api-unavailable') kind = 'api_unavailable';
  else if (captureStatus === 'api-version-mismatch') kind = 'api_version_mismatch';
  else if (captureStatus === 'operation-not-supported') kind = 'operation_not_supported';
  else if (captureStatus === 'disabled') kind = 'disabled';
  else if (captureStatus && !['capturing', 'starting', 'waiting', 'disconnected', 'stopped', 'no-game'].includes(captureStatus)) kind = 'error';
  else if (!captureStatus && (code || /error|failed|unavailable|unsupported/.test(engineStatus))) kind = 'error';
  else if (captureStatus === 'disconnected' || captureStatus === 'stopped') kind = 'disconnected';
  else if (engineStatus === 'disconnected' && !captureStatus) kind = 'disconnected';
  else if (captureStatus === 'starting') kind = 'starting';
  else if (captureStatus === 'waiting' || captureStatus === 'no-game' || c.game_connections === 0) kind = c.game_processes > 0 ? 'waiting_connection' : 'waiting_game';
  else if (/capture[-_]gap|capture[-_]loss/.test(engineStatus) || c.missed_packets > 0 || s.diagnostics.stream_gaps > 0) kind = 'loss';
  else if (s.paused || engineStatus === 'paused') kind = 'paused';
  else if (captureStatus === 'capturing' && c.last_packet_at_ms !== null && now >= c.last_packet_at_ms && now - c.last_packet_at_ms <= 5000) kind = s.encounter_active === true ? 'combat_active' : engineStatus === 'combat' || s.total_damage > 0 ? 'combat' : 'traffic';
  else if (captureStatus === 'capturing' && c.game_connections > 0) kind = 'waiting_traffic';
  else kind = 'disconnected';
  const [label, message] = CONNECTION_TEXT[locale === 'en' ? 'en' : 'tr'][kind];
  const tone = ['permission', 'unsupported', 'api_unavailable', 'api_version_mismatch', 'operation_not_supported', 'error', 'disconnected'].includes(kind) ? 'error' : kind === 'loss' ? 'warning' : ['traffic', 'combat', 'combat_active'].includes(kind) ? 'live' : kind === 'demo' ? 'demo' : 'waiting';
  return { kind, tone, label, message, detail: [c.detail, c.error_code, c.admin.detail].filter(Boolean).join(' · ') || s.status };
}

export function sortedPlayers(players, sort = 'dps') {
  return [...players].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : finite(b[sort]) - finite(a[sort]) || a.name.localeCompare(b.name));
}

export function playerShare(player, total) {
  return total > 0 ? Math.max(0, Math.min(1, player.damage / total)) : 0;
}

export function cooldownStatus(value) {
  return cooldownObservation(value);
}

export function resizeStep(key, shift = false) {
  const amount = shift ? 20 : 10;
  return { ArrowLeft: { dx: -amount, dy: 0 }, ArrowRight: { dx: amount, dy: 0 }, ArrowUp: { dx: 0, dy: -amount }, ArrowDown: { dx: 0, dy: amount } }[key] || null;
}

export function compactHeaderHeight(targetFontSize, eventVisible) {
  return Math.max(32, eventVisible ? bounded(targetFontSize, 8, 28, 15) + 18 : 32);
}

export function compactNumber(number, locale = 'tr', digits = 2) {
  const value = Math.max(0, finite(number)), precision = Math.round(bounded(digits, 0, 3, 2));
  const units = ['', 'K', 'M', 'B', 'T'];
  let unit = Math.min(units.length - 1, value > 0 ? Math.max(0, Math.floor(Math.log10(value) / 3)) : 0);
  let scaled = value / 1000 ** unit;
  if (Number(scaled.toFixed(precision)) >= 1000 && unit < units.length - 1) { unit++; scaled = value / 1000 ** unit; }
  return `${Number(scaled.toFixed(precision))}${units[unit]}`;
}

export function formatRate(value, locale = 'tr', digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  const precision = Math.round(bounded(digits, 0, 3, 2));
  const thousands = value >= 1000;
  const amount = Number((value / (thousands ? 1000 : 1)).toFixed(precision));
  return `${amount}${thousands ? 'K' : ''}/${locale === 'tr' ? 'sn' : 's'}`;
}

export function playerMetricLabel(player, metric = 'both', locale = 'tr', digits = 2) {
  const damage = `${compactNumber(player.damage, locale, digits)} ${locale === 'tr' ? 'toplam hasar' : 'total damage'}`;
  const dps = `${formatRate(player.dps, locale, digits)} DPS`;
  return metric === 'damage' ? damage : metric === 'dps' ? dps : `${damage}, ${dps}`;
}

export function clockTime(ms, hours = false) {
  const sec = Math.floor(Math.max(0, finite(ms)) / 1000);
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return h || hours ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function importHistory(text) {
  const parsed = JSON.parse(text);
  if (parsed?.type !== 'luma-history' || parsed.version !== 1 || !Array.isArray(parsed.encounters)) throw new Error('Invalid Luma history');
  if (parsed.encounters.length > 30) throw new Error('Maximum 30 encounters');
  const encounters = parsed.encounters.map(normalizeEncounter);
  if (encounters.some(value => !value)) throw new Error('Invalid encounter');
  return encounters;
}

export const CLASS_COLORS = Object.freeze({ gladiator: '#e7a076', templar: '#dfc680', assassin: '#bd94ef', ranger: '#8bd498', sorcerer: '#8dbdfa', spiritmaster: '#b0a4ef', cleric: '#efdd9f', chanter: '#7fd8d0', unknown: '#a1b8ce' });
export const classColor = name => CLASS_COLORS[String(name).toLowerCase()] || CLASS_COLORS.unknown;

export function playerBarColor(player, maximumDps, mode = 'performance', accent = THEMES.aurora.accent, minimumDps = 0) {
  if (mode === 'class') return classColor(player?.class_name);
  if (mode === 'accent') return color(accent, THEMES.aurora.accent);
  const rate = typeof player?.dps === 'number' && Number.isFinite(player.dps) ? Math.max(0, player.dps) : 0;
  const maximum = typeof maximumDps === 'number' && Number.isFinite(maximumDps) ? Math.max(0, maximumDps) : 0;
  if (!maximum || typeof player?.dps !== 'number' || !Number.isFinite(player.dps) || player.dps < 0) return CLASS_COLORS.unknown;
  const minimum = typeof minimumDps === 'number' && Number.isFinite(minimumDps) ? Math.max(0, Math.min(maximum, minimumDps)) : 0;
  const ratio = Math.max(0, Math.min(1, maximum > minimum ? (rate - minimum) / (maximum - minimum) : rate / maximum));
  const stops = [[0, [52, 199, 89]], [.35, [180, 208, 54]], [.55, [255, 214, 10]], [.78, [255, 159, 10]], [1, [255, 69, 58]]];
  const upper = stops.findIndex(([position]) => position >= ratio);
  const [start, from] = stops[Math.max(0, upper - 1)], [end, to] = stops[upper];
  const blend = end > start ? (ratio - start) / (end - start) : 0;
  return `#${from.map((channel, index) => Math.round(channel + (to[index] - channel) * blend).toString(16).padStart(2, '0')).join('')}`;
}
