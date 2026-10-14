import { trainingState } from './analysis.mjs';
import { assistanceState } from './assistance.mjs';
import { characterSnapshot } from './character.mjs';

export const THEMES = Object.freeze({
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
  studio: { name: 'Studio', description: { tr: 'Dengeli kartlar, net sayılar', en: 'Balanced cards, clear numbers' } },
  minimal: { name: 'Line', description: { tr: 'İnce çizgiler, sade liste', en: 'Fine lines, simple roster' } },
  focus: { name: 'Focus', description: { tr: 'Kişisel ölçüm ön planda', en: 'Personal measurement in focus' } },
  glass: { name: 'Prism', description: { tr: 'Yumuşak ışık, hafif yüzeyler', en: 'Soft light, light surfaces' } },
});
export const DEFAULTS = Object.freeze({
  version: 1, locale: 'tr', theme: 'aurora', font: 'system', targetFont: 'system', targetFontSize: 15,
  textScale: 1, opacity: 0.96, sort: 'dps', mode: 'all', locked: false,
  customColors: THEMES.custom, background: '', events: [], activeEventId: 'builtin:rift', bossIds: [],
  equipment: [], manualCooldowns: [], odyle: { current: 0, max: 0, refill: 0, intervalMinutes: 0, anchor: '' },
  alerts: { dpsGoal: 0, eventLeadMinutes: 5, sound: false, incomingWarnings: true }, importedHistory: [],
  damageScope: 'personal', characterName: '', layout: 'studio', density: 'comfortable', showClass: true, showShares: true, rowMetric: 'both',
  numberPrecision: 2,
  summaryMetric: 'both',
  calendarVersion: 1, calendarRegion: 'EU', builtInReminders: {},
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
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
    version: 1, locale: oneOf(p.locale, ['tr', 'en'], DEFAULTS.locale),
    theme: oneOf(p.theme, Object.keys(THEMES), DEFAULTS.theme),
    font: oneOf(p.font, Object.keys(FONTS), DEFAULTS.font),
    targetFont: oneOf(p.targetFont, Object.keys(FONTS), DEFAULTS.targetFont),
    targetFontSize: bounded(p.targetFontSize, 8, 28, DEFAULTS.targetFontSize),
    textScale: bounded(p.textScale, 0.85, 1.2, 1), opacity: bounded(p.opacity, 0.65, 1, 0.96),
    sort: oneOf(p.sort, ['dps', 'damage', 'name'], 'dps'), mode: oneOf(p.mode, ['all', 'boss', 'both'], 'all'), locked: Boolean(p.locked),
    damageScope: oneOf(p.damageScope, ['personal', 'party', 'observed'], 'personal'), characterName: str(p.characterName, 64).trim(),
    layout: oneOf(p.layout, Object.keys(LAYOUTS), 'studio'), density: oneOf(p.density, ['comfortable', 'compact'], 'comfortable'),
    showClass: p.showClass !== false, showShares: p.showShares !== false, rowMetric: oneOf(p.rowMetric, ['both', 'dps', 'damage'], 'both'),
    numberPrecision: Math.round(bounded(p.numberPrecision, 0, 3, 2)),
    summaryMetric: oneOf(p.summaryMetric, ['dps', 'damage', 'both'], 'both'),
    calendarVersion: 1, calendarRegion: oneOf(p.calendarRegion, ['EU'], 'EU'), builtInReminders,
    customColors: Object.fromEntries(['bg', 'panel', 'text', 'accent'].map(key => [key, color(custom[key], THEMES.custom[key])])),
    background: validBackground(p.background), events,
    activeEventId,
    bossIds: [...new Set((Array.isArray(p.bossIds) ? p.bossIds : []).filter(value => Number.isSafeInteger(Number(value)) && Number(value) >= 0).map(Number))].slice(0, 100),
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
  const p = normalizePreferences(parsed.theme);
  if (parsed.theme.background && !p.background) throw new Error('Invalid raster background');
  return Object.fromEntries(['theme', 'font', 'targetFont', 'targetFontSize', 'textScale', 'opacity', 'customColors', 'background', 'layout', 'density', 'showClass', 'showShares', 'rowMetric', 'summaryMetric', 'numberPrecision'].map(key => [key, p[key]]));
}

export function exportTheme(prefs) {
  const p = normalizePreferences(prefs);
  return JSON.stringify({ type: 'luma-theme', version: 1, theme: Object.fromEntries(['theme', 'font', 'targetFont', 'targetFontSize', 'textScale', 'opacity', 'customColors', 'background', 'layout', 'density', 'showClass', 'showShares', 'rowMetric', 'summaryMetric', 'numberPrecision'].map(key => [key, p[key]])) }, null, 2);
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

export function normalizePlayer(player = {}) {
  const received = Object.fromEntries(['damage_taken', 'damage_taken_per_second', 'healing', 'hps', 'unclassified_player_target_amount', 'unclassified_player_target_events'].map(key => [key, typeof player[key] === 'number' && Number.isFinite(player[key]) && player[key] >= 0 ? player[key] : null]));
  return { ...received, damage_taken_complete: typeof player.damage_taken_complete === 'boolean' ? player.damage_taken_complete : null, id: identifier(player.id), name: str(player.name, 80) || `#${identifier(player.id) || '?'}`, class_name: str(player.class_name, 60) || '—', is_local: player.is_local === true, in_party: player.in_party === true, damage: Math.max(0, finite(player.damage)), dps: Math.max(0, finite(player.dps)), share: bounded(player.share, 0, 100), skills: (Array.isArray(player.skills) ? player.skills : []).slice(0, 500).map(normalizeSkill) };
}

function identityState(value = {}) {
  const nullableMetric = metric => typeof metric === 'number' && Number.isFinite(metric) ? Math.max(0, metric) : null;
  return {
    local_player_id: value.local_player_id === null || value.local_player_id === undefined ? null : identifier(value.local_player_id),
    local_player_name: str(value.local_player_name, 80), local_identity_source: oneOf(value.local_identity_source, ['server', 'manual', 'name-match', 'unresolved'], 'unresolved'),
    personal_total_damage: nullableMetric(value.personal_total_damage), personal_dps: nullableMetric(value.personal_dps), personal_elapsed_ms: Math.max(0, finite(value.personal_elapsed_ms)), personal_started_ms: nullableMetric(value.personal_started_ms),
    personal_damage_taken: nullableMetric(value.personal_damage_taken), personal_damage_taken_per_second: nullableMetric(value.personal_damage_taken_per_second), personal_damage_taken_elapsed_ms: Math.max(0, finite(value.personal_damage_taken_elapsed_ms)), personal_damage_taken_started_ms: nullableMetric(value.personal_damage_taken_started_ms), personal_healing: nullableMetric(value.personal_healing), personal_hps: nullableMetric(value.personal_hps),
    personal_damage_taken_complete: typeof value.personal_damage_taken_complete === 'boolean' ? value.personal_damage_taken_complete : null, unclassified_player_target_amount: nullableMetric(value.unclassified_player_target_amount), unclassified_player_target_events: nullableMetric(value.unclassified_player_target_events),
    personal_targets: (Array.isArray(value.personal_targets) ? value.personal_targets : []).slice(0, 100).map(normalizeTarget),
    party_member_ids: (Array.isArray(value.party_member_ids) ? value.party_member_ids : []).slice(0, 100).map(identifier),
    party_membership_source: oneOf(value.party_membership_source, ['server', 'manual', 'unresolved'], 'unresolved'),
    party_total_damage: nullableMetric(value.party_total_damage), party_dps: nullableMetric(value.party_dps), party_elapsed_ms: Math.max(0, finite(value.party_elapsed_ms)),
    party_targets: (Array.isArray(value.party_targets) ? value.party_targets : []).slice(0, 100).map(normalizeTarget),
  };
}

export function normalizeEncounter(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const actorScope = oneOf(value.actor_scope, ['personal', 'party', 'observed'], 'observed');
  const unknownScopedTotal = value.total_damage === null && actorScope !== 'observed';
  if (!unknownScopedTotal && !Number.isFinite(Number(value.total_damage ?? value.damage))) return null;
  const publishedTime = iso(value.timestamp ?? value.started_at);
  const timestamp = publishedTime && Date.parse(publishedTime) <= 253_402_300_799_999 ? publishedTime : Number.isFinite(value.started_ms) && value.started_ms > 0 && value.started_ms <= 253_402_300_799_999 ? new Date(value.started_ms).toISOString() : '';
  const samples = Array.isArray(value.damage_samples) ? value.damage_samples : [];
  return { ...identityState(value), timing_valid: value.timing_valid !== false && !(finite(value.elapsed_ms) <= 0 && finite(value.total_damage ?? value.damage) > 0), character_build: characterSnapshot({ own: value.character_build }).own, actor_scope: actorScope, provenance: value.provenance === 'imported-unverified' || value.source === 'imported' ? 'imported-unverified' : value.provenance === 'demo' ? 'demo' : 'received', id: identifier(value.id), name: str(value.name ?? value.target_name ?? value.targets?.[0]?.name, 100) || 'Encounter', timestamp, started_ms: Number.isFinite(value.started_ms) ? Math.max(0, value.started_ms) : null, ended_ms: Number.isFinite(value.ended_ms) ? Math.max(0, value.ended_ms) : null, sample_complete: value.sample_complete === true && samples.length <= 5000, damage_samples: samples.slice(0, 5000).filter(sample => Number.isFinite(sample?.timestamp_ms) && Number.isFinite(sample?.amount) && sample.amount >= 0).map(sample => ({ timestamp_ms: sample.timestamp_ms, amount: sample.amount, source: identifier(sample.source), player_id: identifier(sample.player_id ?? sample.source), target: identifier(sample.target), skill: identifier(sample.skill), critical: sample.critical === true, tick: sample.tick === true })), elapsed_ms: Math.max(0, finite(value.elapsed_ms)), total_damage: unknownScopedTotal ? null : Math.max(0, finite(value.total_damage ?? value.damage)), dps: unknownScopedTotal && value.dps === null ? null : Math.max(0, finite(value.dps)), players: (Array.isArray(value.players) ? value.players : []).slice(0, 100).map(normalizePlayer), targets: (Array.isArray(value.targets) ? value.targets : []).slice(0, 100).map(normalizeTarget) };
}

function normalizeTarget(target = {}) { const hp = key => typeof target[key] === 'number' && Number.isFinite(target[key]) && target[key] >= 0 ? target[key] : null; return { id: identifier(target.id), name: str(target.name, 100) || `#${identifier(target.id) || '?'}`, is_boss: Boolean(target.is_boss), damage: Math.max(0, finite(target.damage)), current_hp: hp('current_hp'), reported_max_hp: hp('reported_max_hp'), observed_peak_hp: hp('observed_peak_hp'), health_observed_at_ms: hp('health_observed_at_ms') }; }

export function normalizeState(value) {
  const s = value && typeof value === 'object' ? value : {};
  const capture = s.capture || {}, admin = capture.admin || {};
  const historyRevision = Number.isSafeInteger(s.history_revision) && s.history_revision >= 0 ? s.history_revision : 0;
  const historyCount = Number.isSafeInteger(s.history_count) && s.history_count >= 0 ? s.history_count : (Array.isArray(s.history) ? s.history.length : 0);
  const encounterActive = typeof s.encounter_active === 'boolean' ? s.encounter_active : null;
  const metadata = { state_revision: Number.isSafeInteger(s.state_revision) && s.state_revision >= 0 ? s.state_revision : null, character_revision: Number.isSafeInteger(s.character_revision) && s.character_revision >= 0 ? s.character_revision : 0, character_available: s.character_available === true, field_boss_revision: Number.isSafeInteger(s.field_boss_revision) && s.field_boss_revision >= 0 ? s.field_boss_revision : 0, field_boss_available: s.field_boss_available === true };
  return { ...identityState(s), ...metadata, training: trainingState(s.training), assist: assistanceState(s.assist), history_revision: historyRevision, history_count: historyCount, encounter_active: encounterActive, status: str(s.status, 120) || 'disconnected', elapsed_ms: Math.max(0, finite(s.elapsed_ms)), total_damage: Math.max(0, finite(s.total_damage)), dps: Math.max(0, finite(s.dps)), paused: Boolean(s.paused), players: (Array.isArray(s.players) ? s.players : []).slice(0, 100).map(normalizePlayer), targets: (Array.isArray(s.targets) ? s.targets : []).slice(0, 100).map(normalizeTarget), history: (Array.isArray(s.history) ? s.history : []).slice(0, 30).map(normalizeEncounter).filter(Boolean), cooldowns: Array.isArray(s.cooldowns) ? s.cooldowns.slice(0, 50) : [], diagnostics: { stream_gaps: Math.max(0, finite(s.diagnostics?.stream_gaps)) }, capture: { status: str(capture.status, 120), detail: str(capture.detail, 500), error_code: str(capture.error_code, 80), packets: Math.max(0, finite(capture.packets)), missed_packets: Math.max(0, finite(capture.missed_packets)), game_processes: Number.isFinite(capture.game_processes) ? Math.max(0, capture.game_processes) : null, game_connections: Number.isFinite(capture.game_connections) ? Math.max(0, capture.game_connections) : null, last_packet_at_ms: Number.isFinite(capture.last_packet_at_ms) ? Math.max(0, capture.last_packet_at_ms) : null, admin: { required: admin.required === true, elevated: typeof admin.elevated === 'boolean' ? admin.elevated : null, status: str(admin.status, 80), detail: str(admin.detail, 300) } } };
}

const CONNECTION_TEXT = Object.freeze({
  tr: {
    browser: ['Tarayıcı önizlemesi', 'Tarayıcı önizlemesi · Canlı yakalama için masaüstü uygulaması gerekir.'],
    demo: ['DEMO', 'DEMO · Sabit örnek veriler. Canlı oyun verisi değildir.'],
    permission: ['Yönetici gerekli', 'Yönetici olarak yeniden açın. Windows paket yakalama izni reddedildi.'],
    unsupported: ['Windows desteklenmiyor', 'Windows sürümünüz bu yakalama API’sini desteklemiyor. Windows’u güncelleyin.'],
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
    unsupported: ['Windows unsupported', 'This Windows version does not support the capture API. Update Windows.'],
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
  const error = `${captureStatus} ${c.error_code} ${c.detail} ${c.admin.status}`.toLowerCase();
  let kind;
  if (demo && !native) kind = 'demo';
  else if (!native) kind = 'browser';
  else if (/permission[-_ ]required|0x80070005|win32:5\b|access denied|elevation required|administrator required/.test(error) || c.admin.status === 'required' || (c.admin.required && c.admin.elevated === false && c.admin.status !== 'unknown')) kind = 'permission';
  else if (/unsupported|unavailable.*windows|windows.*unavailable|0x80070032|0x80004001/.test(error)) kind = 'unsupported';
  else if (captureStatus === 'disabled') kind = 'disabled';
  else if (/error|failed/.test(captureStatus)) kind = 'error';
  else if (engineStatus === 'disconnected' && !captureStatus) kind = 'disconnected';
  else if (captureStatus === 'starting') kind = 'starting';
  else if (captureStatus === 'waiting' || c.game_connections === 0) kind = c.game_processes > 0 ? 'waiting_connection' : 'waiting_game';
  else if (/capture[-_]gap|capture[-_]loss/.test(engineStatus) || c.missed_packets > 0 || s.diagnostics.stream_gaps > 0) kind = 'loss';
  else if (s.paused || engineStatus === 'paused') kind = 'paused';
  else if (captureStatus === 'capturing' && c.last_packet_at_ms !== null && now >= c.last_packet_at_ms && now - c.last_packet_at_ms <= 5000) kind = s.encounter_active === true ? 'combat_active' : engineStatus === 'combat' || s.total_damage > 0 ? 'combat' : 'traffic';
  else if (captureStatus === 'capturing' && c.game_connections > 0) kind = 'waiting_traffic';
  else kind = 'disconnected';
  const [label, message] = CONNECTION_TEXT[locale === 'en' ? 'en' : 'tr'][kind];
  const tone = ['permission', 'unsupported', 'error', 'disconnected'].includes(kind) ? 'error' : kind === 'loss' ? 'warning' : ['traffic', 'combat', 'combat_active'].includes(kind) ? 'live' : kind === 'demo' ? 'demo' : 'waiting';
  return { kind, tone, label, message, detail: [c.detail, c.error_code, c.admin.detail].filter(Boolean).join(' · ') || s.status };
}

export function sortedPlayers(players, sort = 'dps') {
  return [...players].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : finite(b[sort]) - finite(a[sort]) || a.name.localeCompare(b.name));
}

export function playerShare(player, total) {
  return total > 0 ? Math.max(0, Math.min(1, player.damage / total)) : 0;
}

export function cooldownStatus(value) {
  const remaining = typeof value?.remaining_ms === 'number' && Number.isFinite(value.remaining_ms) ? Math.max(0, value.remaining_ms) : null;
  return {
    kind: remaining === null ? 'unknown' : remaining > 0 ? 'countdown' : value?.ready_confirmed === true ? 'confirmed' : 'elapsed',
    remaining,
    charges: typeof value?.charges === 'number' && Number.isFinite(value.charges) && value.charges >= 0 ? Math.floor(value.charges) : null,
    source: value?.source === 'server' ? 'server' : 'received',
  };
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
