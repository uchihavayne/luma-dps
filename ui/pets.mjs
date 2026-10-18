import { petProgress } from './telemetry.mjs';
import { PET_PIN_LIMIT } from './model.mjs';
export { PET_PIN_LIMIT } from './model.mjs';

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value, maximum) => Array.isArray(value) ? value.slice(0, maximum) : [];
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
const text = (value, maximum = 120) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maximum) : '';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const searchText = value => String(value).normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
export const PET_PAGE_SIZE = 24;

export function petReferenceUrl(value) {
  if (typeof value !== 'string' || value.length > 800) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !['metabot.gg', 'www.metabot.gg', 'github.com', 'aion2.plaync.com'].includes(url.hostname)) return '';
    if (url.hostname.endsWith('metabot.gg') && !/^\/en\/aion-2\/(mounts|map)(?:\/|$)/.test(url.pathname)) return '';
    if (url.hostname === 'github.com' && !url.pathname.startsWith('/MartinLVila/aion2-pet-overlay/')) return '';
    return url.href;
  } catch { return ''; }
}

function verifiedMapNpcId(value) {
  const reference = petReferenceUrl(value);
  if (!reference) return null;
  const url = new URL(reference);
  if (!['metabot.gg', 'www.metabot.gg'].includes(url.hostname) || !/^\/en\/aion-2\/map\/[a-z0-9-]+\/?$/.test(url.pathname) || url.hash || [...url.searchParams.keys()].length !== 1) return null;
  const focus = /^npc:([1-9]\d{5,6})$/.exec(url.searchParams.get('focus') || '');
  return focus ? integer(Number(focus[1]), 100000, 9999999) : null;
}

export function normalizePetPins(value) {
  return [...new Set(list(value, 100).filter(id => integer(id, 1000, 99999) !== null))].slice(0, PET_PIN_LIMIT);
}

export function petPinTransition(preferences, id, plan) {
  const pins = normalizePetPins(record(preferences).petPins);
  if (integer(id, 1000, 99999) === null) return { status: 'invalid', patch: null };
  if (pins.includes(id)) return { status: 'removed', patch: { petPins: pins.filter(value => value !== id) } };
  if (!list(record(plan).rows, 4500).some(row => record(row).id === id)) return { status: 'invalid', patch: null };
  if (pins.length >= PET_PIN_LIMIT) return { status: 'limit', patch: null };
  return { status: 'added', patch: { petPins: [...pins, id], showPetTracker: true, petTrackerCollapsed: false } };
}

export function petTargetMatches(target, catalog) {
  target = record(target);
  const hasNpcId = target.npc_id !== null && target.npc_id !== undefined;
  const npcId = integer(target.npc_id, 100000, 9999999), name = target.name;
  if (hasNpcId && npcId === null || !hasNpcId && (typeof name !== 'string' || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name))) return [];
  const wholeName = value => typeof value === 'string' ? value.normalize('NFC').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim() : '';
  const needle = hasNpcId ? '' : wholeName(name);
  if (!hasNpcId && !needle) return [];
  const matches = new Map();
  for (const pet of list(record(catalog).pets, 2500)) {
    if (integer(pet?.id, 1000, 99999) === null || !pet.name || pet.id_mapping_verified === false) continue;
    const location = list(pet.locations, 64).find(row => hasNpcId ? row?.verifiedNpcId === npcId : wholeName(row?.monster) === needle);
    if (location && !matches.has(pet.id)) matches.set(pet.id, { id: pet.id, name: text(pet.name), monster: text(location.monster) });
  }
  return [...matches.values()].sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id - b.id);
}

export function normalizePetCatalog(value) {
  value = record(value);
  const seen = new Set(), duplicate = new Set(), pets = [];
  for (const input of list(value.pets, 2500)) {
    const row = record(input), id = integer(row.id, 1000, 99999), name = text(row.name);
    if (id === null || !name || row.id_mapping_verified !== true) continue;
    if (seen.has(id)) { duplicate.add(id); continue; }
    seen.add(id);
    const locations = list(row.locations, 64).map(input => {
      const location = record(input);
      return { zone: text(location.zone), area: text(location.area), monster: text(location.monster), monster_level: integer(location.monster_level, 1, 1000), teleport: text(location.teleport), source_url: petReferenceUrl(location.source_url), map_url: petReferenceUrl(location.map_url), verifiedNpcId: verifiedMapNpcId(location.map_url) };
    }).filter(location => location.zone || location.area);
    const bonuses = list(row.bonuses, 30).map(input => {
      const bonus = record(input);
      return { stat: text(bonus.stat), level: integer(bonus.level, 1, 3), value: typeof bonus.value === 'number' && Number.isFinite(bonus.value) && Math.abs(bonus.value) <= 1e9 ? bonus.value : null, unit: bonus.unit === 'points' ? '' : bonus.unit === 'percent' ? '%' : text(bonus.unit, 12), verification: text(bonus.verification, 64) };
    }).filter(bonus => bonus.stat && bonus.level !== null);
    pets.push({ id, name, genus: text(row.genus, 40), faction: ['elyos', 'asmodian', 'both'].includes(row.faction) ? row.faction : 'unknown', locations, bonuses, source_url: petReferenceUrl(row.source_url), map_url: petReferenceUrl(row.map_url) });
  }
  const requirement = record(value.requirements), souls = list(requirement.souls, 3);
  const verified = value.region === 'EU/NA' && requirement.verified === true && requirement.basis === 'per-level' && souls.length === 3 && souls.every(value => integer(value, 1, 1000000) !== null) && Boolean(petReferenceUrl(requirement.source_url));
  return { schema_version: 1, region: text(value.region, 20), verified_at: text(value.verified_at, 40), requirements: verified ? { basis: 'per-level', souls, source_url: petReferenceUrl(requirement.source_url) } : null, pets: pets.filter(pet => !duplicate.has(pet.id)) };
}

export function petCompletion(observed, requirements, { now = Date.now(), goal = 'max' } = {}) {
  const row = record(observed), level = integer(row.level, 0, 3), receivedProgress = integer(row.progress, 0, 0xffffffff);
  const supportedProgress = ['server-absolute', 'server-delta'].includes(row.progress_source) || row.progress_source === 'server-level-reset' && level !== null && receivedProgress === 0;
  const progress = supportedProgress ? receivedProgress : null;
  const stale = row.progress_stale === true;
  const last = integer(row.observed_at_ms, 0, 8640000000000000);
  const validTime = last !== null && (last <= now + 250 || stale);
  const base = { level, progress: validTime ? progress : null, observedAtMs: validTime ? last : null, stale, goal: goal === 'next' ? 'next' : 'max', status: 'unknown', nextRemaining: null, maxRemaining: null, remaining: null, percent: null, required: null, soulsPerMinute: null, etaMs: null };
  if (level === 3 && validTime) return { ...base, status: 'complete', nextRemaining: 0, maxRemaining: 0, remaining: 0, percent: 100 };
  if (level === null || !validTime || !requirements || !Array.isArray(requirements.souls) || requirements.souls.length !== 3 || !requirements.souls.every(value => integer(value, 1, 1000000) !== null) || !supportedProgress || progress === null) return base;
  const required = requirements.souls[level];
  if (!Number.isSafeInteger(required)) return base;
  if (progress >= required) return { ...base, required, status: 'awaiting-level' };
  const nextRemaining = required - progress;
  const maxRemaining = requirements.souls.slice(level).reduce((sum, value) => sum + value, 0) - progress;
  const remaining = goal === 'next' ? nextRemaining : maxRemaining;
  const start = integer(row.session_started_at_ms), lastGain = integer(row.last_gain_at_ms), gained = integer(row.session_gained), baseline = integer(row.session_baseline_gained), events = integer(row.session_gain_events);
  const rateKnown = !stale && start !== null && lastGain !== null && gained !== null && baseline !== null && gained > baseline && events >= 3 && start <= lastGain && lastGain <= now && now - start >= 30000 && now - lastGain <= 120000;
  const soulsPerMinute = rateKnown ? (gained - baseline) * 60000 / (now - start) : null;
  const etaMs = soulsPerMinute > 0 ? remaining * 60000 / soulsPerMinute : null;
  return { ...base, status: 'progress', nextRemaining, maxRemaining, remaining, percent: progress / required * 100, required, soulsPerMinute, etaMs: Number.isFinite(etaMs) && etaMs <= 7 * 86400000 ? etaMs : null };
}

export function petPlan(input, catalog, { localPlayerId, now = Date.now(), goal = 'max', pins = [] } = {}) {
  const observed = petProgress(input, { localPlayerId });
  const current = new Map((observed?.pets || []).map(row => [row.pet_id, row]));
  const known = new Set(catalog.pets.map(row => row.id));
  const rows = catalog.pets.map(pet => {
    const live = current.get(pet.id);
    return { ...pet, observed: Boolean(live), summoned: observed?.active_pet_id === pet.id, sessionGained: live?.session_gained || 0, lastGainAt: live?.last_gain_at_ms !== null && live?.last_gain_at_ms <= now ? live.last_gain_at_ms : null, ...petCompletion(live, pet.genus === 'Special' ? null : catalog.requirements, { now, goal }) };
  });
  for (const live of current.values()) if (!known.has(live.pet_id)) rows.push({ id: live.pet_id, name: '', genus: '', faction: 'unknown', locations: [], bonuses: [], source_url: '', map_url: '', observed: true, summoned: observed.active_pet_id === live.pet_id, sessionGained: live.session_gained, lastGainAt: live.last_gain_at_ms !== null && live.last_gain_at_ms <= now ? live.last_gain_at_ms : null, ...petCompletion(live, null, { now, goal }) });
  for (const id of normalizePetPins(pins)) if (!rows.some(row => row.id === id)) rows.push({ id, name: '', genus: '', faction: 'unknown', locations: [], bonuses: [], source_url: '', map_url: '', observed: false, summoned: false, sessionGained: 0, lastGainAt: null, ...petCompletion(null, null, { now, goal }) });
  return { rows, observed, total: catalog.pets.length, observedCount: current.size, completeCount: rows.filter(row => row.status === 'complete').length };
}

export function filteredPets(plan, { query = '', faction = 'all', genus = 'all', status = 'all', sort = 'name', page = 0, pins = [] } = {}) {
  const needle = searchText(query), pinned = new Set(normalizePetPins(pins));
  const rows = plan.rows.filter(row => (!needle || searchText([row.name, row.genus, row.id, ...row.locations.flatMap(location => [location.zone, location.area, location.monster, location.teleport]), ...row.bonuses.map(bonus => bonus.stat)].join(' ')).includes(needle)) && (faction === 'all' || row.faction === faction || row.faction === 'both') && (genus === 'all' || row.genus === genus) && (status === 'all' || status === 'pinned' ? status !== 'pinned' || pinned.has(row.id) : status === 'observed' ? row.observed : status === 'complete' ? row.status === 'complete' : status === 'incomplete' ? row.status !== 'complete' : true));
  rows.sort((a, b) => sort === 'remaining' ? (a.remaining ?? Infinity) - (b.remaining ?? Infinity) || a.name.localeCompare(b.name, 'en') : sort === 'recent' ? (b.lastGainAt ?? 0) - (a.lastGainAt ?? 0) || b.sessionGained - a.sessionGained || a.name.localeCompare(b.name, 'en') : a.name.localeCompare(b.name, 'en') || a.id - b.id);
  const pages = Math.max(1, Math.ceil(rows.length / PET_PAGE_SIZE)), selectedPage = Math.min(pages - 1, Math.max(0, integer(page) ?? 0));
  return { rows: rows.slice(selectedPage * PET_PAGE_SIZE, (selectedPage + 1) * PET_PAGE_SIZE), total: rows.length, pages, page: selectedPage };
}

export function petGuideFilterAction(filters = {}, action) {
  if (action === 'pet-guide-reset') return { ...filters, query: '', faction: 'all', genus: 'all', status: 'all', page: 0 };
  if (action === 'pet-guide-catalog') return { ...filters, status: 'all', page: 0 };
  return { ...filters };
}

export function trackedPets(plan, pins, { automatic = true, now = Date.now() } = {}) {
  const selected = normalizePetPins(pins);
  const pinned = selected.map(id => plan.rows.find(row => row.id === id)).filter(Boolean).map(row => ({ ...row, automatic: false }));
  if (!automatic) return pinned;
  const recent = plan.rows.filter(row => !selected.includes(row.id) && row.observed && !row.stale && row.status !== 'complete' && integer(row.sessionGained, 1) !== null && integer(row.lastGainAt) !== null && row.lastGainAt <= now && now - row.lastGainAt <= 120000);
  recent.sort((a, b) => b.lastGainAt - a.lastGainAt || b.sessionGained - a.sessionGained || a.id - b.id);
  return recent.length ? [...pinned, { ...recent[0], automatic: true }] : pinned;
}

export function petMetadataTransition(previous = {}, current = {}, { previousActorId = previous.local_player_id ?? null, currentActorId = current.local_player_id ?? null } = {}) {
  const identityChanged = previousActorId !== currentActorId;
  const revisionChanged = previous.character_revision !== current.character_revision;
  const lost = (previous.diagnostics?.stream_gaps ?? 0) !== (current.diagnostics?.stream_gaps ?? 0) || (previous.capture?.missed_packets ?? 0) !== (current.capture?.missed_packets ?? 0);
  const buildAvailabilityChanged = previous.character_available !== current.character_available;
  return { fetch: identityChanged || revisionChanged || lost || buildAvailabilityChanged, clear: identityChanged };
}

export function petLabels(locale = 'tr') {
  return locale === 'en' ? {
    levelUnknown: 'Counter received · waiting for level', requirementUnknown: 'Counter received · level target unverified', recentGain: 'Recent soul gain',
    title: 'Pet guide & farming', tracker: 'Pet tracking', lastKnown: 'Last received', staleDetail: 'Previously received pet counters are retained after the interruption. They are marked as last received; time estimates resume only with a valid new baseline.', levelProgress: 'Level progress', trackerEmpty: 'Pin a pet in the guide to start tracking.', autoShort: 'AUTO', search: 'Search pet, zone or stat', all: 'All', elyos: 'Elyos', asmodian: 'Asmodian', both: 'Both factions', unknown: 'Unknown', genus: 'Genus', status: 'Progress', incomplete: 'Not maxed', complete: 'Level 3 complete', observed: 'Received', pinned: 'Pinned', sort: 'Sort', name: 'Name', remaining: 'Souls left', recent: 'Recent gains', apply: 'Search', pin: 'Pin', unpin: 'Unpin', next: 'Next level', max: 'Level 3', goal: 'Tracker goal', automatic: 'Automatically track recent gains', show: 'Show tracker', missing: 'Waiting for a received pet counter', transition: 'Waiting for the level update', location: 'Farming locations', noLocation: 'No verified farming location in this catalog', bonus: 'Reference collection bonuses', noBonus: 'No verified bonus values', map: 'Open source map', source: 'Data source', reference: 'Catalog reference', partial: 'Pet login data is incomplete. Only received counters are used for souls left.', baseline: 'If Luma started while you were already playing, the earlier pet list is not recovered. Return to character selection and log in once with Luma open. New gains also add the pet records received.', limit: `Up to ${PET_PIN_LIMIT} pinned pets`, estimated: 'Estimated', notObserved: 'Counter not received', summoned: 'Summoned', collapse: 'Collapse pet tracker', expand: 'Expand pet tracker', guide: 'Pet guide', nextPage: 'Next', previous: 'Previous', noResults: 'No pets match these filters.', resetFilters: 'Clear filters', catalogSearch: 'Show catalog entries', waitingLive: 'Waiting for live pet counters', refreshReceived: 'Refresh received data', refreshReceivedHint: 'Reload the latest pet data already received by Luma', waitingDetail: 'Locations, bonuses and pinning are available now. Souls left and time estimates appear only after game counters are received.', noReceived: 'No received pets to display yet.', noReceivedDetail: 'The progress filter hides catalog entries without live counters. Show catalog entries to inspect and pin this pet while waiting for data.', noPinned: 'No pets pinned yet.', noPinnedDetail: 'Clear filters to find a pet, then choose Pin. Pinning works before its live counter is received.', noMatchDetail: 'Try a different name, zone or genus, or clear the filters to browse the catalog.', raw: 'Received counter', session: 'This session', catalog: 'Catalog pets', registered: 'Received pets', unlock: 'Registration', inferredBonus: 'Reference bonus; not a live stat reading', missingName: 'Pet name unavailable', perMinute: 'souls/min', approximate: 'Varies with farming pace', details: 'Locations & bonuses',
  } : {
    levelUnknown: 'Sayaç alındı · seviye bekleniyor', requirementUnknown: 'Sayaç alındı · seviye hedefi doğrulanmadı', recentGain: 'Yeni ruh kazanımı',
    title: 'Pet rehberi ve kasma', tracker: 'Pet takibi', lastKnown: 'Son alınan', staleDetail: 'Kesintiden önce alınan pet sayaçları korunuyor. Son alınan olarak işaretlenen değerlerden süre tahmini yapılmaz; yeni geçerli sayaç geldiğinde güncellenir.', levelProgress: 'Seviye ilerlemesi', trackerEmpty: 'Takibe başlamak için rehberden bir pet sabitle.', autoShort: 'OTO', search: 'Pet, bölge veya özellik ara', all: 'Tümü', elyos: 'Elyos', asmodian: 'Asmodian', both: 'İki taraf', unknown: 'Bilinmiyor', genus: 'Tür', status: 'İlerleme', incomplete: 'Maksimum olmayan', complete: 'Seviye 3 tamam', observed: 'Verisi alınan', pinned: 'Sabitlenen', sort: 'Sıralama', name: 'Ad', remaining: 'Kalan ruh', recent: 'Son kazanımlar', apply: 'Ara', pin: 'Sabitle', unpin: 'Sabitlemeyi kaldır', next: 'Sonraki seviye', max: 'Seviye 3', goal: 'Takip hedefi', automatic: 'Son ruh kazanılan peti otomatik takip et', show: 'Takibi göster', missing: 'Oyundan pet sayacı bekleniyor', transition: 'Seviye güncellemesi bekleniyor', location: 'Kasma bölgeleri', noLocation: 'Katalogda doğrulanmış kasma konumu yok', bonus: 'Rehberdeki koleksiyon bonusları', noBonus: 'Doğrulanmış bonus değeri yok', map: 'Kaynak haritada aç', source: 'Veri kaynağı', reference: 'Katalog bilgisi', partial: 'Pet giriş verisi tam değil. Kalan ruh yalnız alınan sayaçlardan hesaplanır.', baseline: 'Luma’yı oyundayken açtıysan önceki pet listesi alınmaz. Pet listesi için Luma açıkken karakter seçimine dönüp bir kez tekrar giriş yap. Yeni kazanımlar geldikçe alınan pet kayıtları da görünür.', limit: `En fazla ${PET_PIN_LIMIT} pet sabitlenebilir`, estimated: 'Tahmini', notObserved: 'Sayaç alınmadı', summoned: 'Çağrılan', collapse: 'Pet takibini daralt', expand: 'Pet takibini genişlet', guide: 'Pet rehberi', nextPage: 'Sonraki', previous: 'Önceki', noResults: 'Filtrelere uyan pet yok.', resetFilters: 'Filtreleri temizle', catalogSearch: 'Katalog bilgilerini göster', waitingLive: 'Canlı pet sayaçları bekleniyor', refreshReceived: 'Alınan veriyi yenile', refreshReceivedHint: 'Luma’nın aldığı son pet verisini yeniden yükle', waitingDetail: 'Konumları ve bonusları inceleyebilir, sayaç gelmeden pet sabitleyebilirsin. Kalan ruh ve süre tahmini oyun sayaçları alındığında görünür.', noReceived: 'Henüz verisi alınan pet yok.', noReceivedDetail: 'İlerleme filtresi, canlı sayacı alınmayan katalog petlerini gizliyor. Veriyi beklerken bu peti incelemek ve sabitlemek için katalog bilgilerini göster.', noPinned: 'Henüz pet sabitlenmedi.', noPinnedDetail: 'Filtreleri temizleyip bir pet bul ve Sabitle’ye bas. Canlı sayacı alınmadan da pet sabitlenebilir.', noMatchDetail: 'Başka bir ad, bölge veya tür dene; kataloğu gezmek için filtreleri temizleyebilirsin.', raw: 'Alınan sayaç', session: 'Bu oturumda', catalog: 'Katalogdaki pet', registered: 'Verisi alınan pet', unlock: 'Kaydetme', inferredBonus: 'Rehber bonusu; canlı özellik ölçümü değil', missingName: 'Pet adı bulunamadı', perMinute: 'ruh/dk', approximate: 'Kasma hızına göre değişir', details: 'Konumlar ve bonuslar',
  };
}

const petName = (row, labels) => row.name || `${labels.missingName} · ${row.id}`;
const number = (value, locale) => value.toLocaleString(locale === 'en' ? 'en' : 'tr', { maximumFractionDigits: 1 });
const eta = (value, labels, locale) => value === null ? '' : `${labels.estimated} ${Math.max(1, Math.ceil(value / 60000)) < 60 ? `${Math.max(1, Math.ceil(value / 60000))} ${locale === 'en' ? 'min' : 'dk'}` : `${number(value / 3600000, locale)} ${locale === 'en' ? 'hr' : 'sa'}`}`;
const remainingText = (row, labels, locale) => row.status === 'complete' ? labels.complete : row.status === 'awaiting-level' ? labels.transition : row.remaining === null ? row.progress === null || row.progress === undefined ? labels.notObserved : row.level === null ? labels.levelUnknown : labels.requirementUnknown : `${row.goal === 'max' ? `${labels.max} · ` : ''}${number(row.remaining, locale)} ${locale === 'en' ? 'souls left' : 'ruh kaldı'}`;
const knownPercent = row => typeof row.percent === 'number' && Number.isFinite(row.percent) && row.percent >= 0 && row.percent <= 100 ? row.percent : null;
const counterText = (row, locale) => row.status === 'complete' ? 'Lv.3' : row.progress !== null && row.progress !== undefined ? row.required ? `${petLabels(locale).next} · ${number(row.progress, locale)} / ${number(row.required, locale)}` : `${petLabels(locale).raw} · ${number(row.progress, locale)}` : '—';
const sampleText = (row, labels, locale) => {
  if (!row.stale) return '';
  const stamp = row.observedAtMs === null || row.observedAtMs === undefined ? null : new Date(row.observedAtMs);
  const time = stamp && Number.isFinite(stamp.getTime()) ? stamp.toLocaleTimeString(locale === 'en' ? 'en-GB' : 'tr', { hour: '2-digit', minute: '2-digit' }) : '';
  return `${labels.lastKnown}${time ? ` · ${time}` : ''}`;
};
const progressBar = (row, labels, locale) => {
  const percent = knownPercent(row), tone = row.status === 'complete' ? 'complete' : percent === null ? 'unknown' : percent < 50 ? 'low' : percent < 80 ? 'medium' : 'high';
  const valueText = `${row.stale ? `${labels.lastKnown} · ` : ''}${counterText(row, locale)}${percent === null ? '' : ` · ${number(percent, locale)}%`}`;
  return `<div class="pet-progress-track is-${tone}${row.stale ? ' is-stale' : ''}"${percent === null ? ` aria-label="${escape(row.progress === null || row.progress === undefined ? labels.missing : `${valueText} · ${remainingText(row, labels, locale)}`)}"` : ` role="progressbar" aria-label="${escape(petName(row, labels))} · ${labels.levelProgress}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent.toFixed(1)}" aria-valuetext="${escape(valueText)}"`}><i style="width:${percent ?? 0}%"></i></div>`;
};
const sourceButton = (url, label) => url ? `<a class="action-button secondary" href="${escape(url)}" target="_blank" rel="noopener noreferrer" data-pet-reference>${escape(label)} ↗</a>` : '';

export function renderPetTracker(rows, { locale = 'tr', collapsed = false, compact = false } = {}) {
  const labels = petLabels(locale);
  // Compact mode constrains the scrolling viewport, not the saved selection.
  // Keep every row available to keyboard users and scroll-to-new-pin actions.
  const visible = rows;
  const pinLimitReached = rows.filter(row => !row.automatic).length >= PET_PIN_LIMIT;
  const rowHtml = row => {
    const percent = knownPercent(row), stale = sampleText(row, labels, locale), estimate = row.stale ? '' : eta(row.etaMs, labels, locale);
    const recentGain = row.automatic ? `${labels.recentGain} · ${labels.session} +${number(row.sessionGained, locale)}` : '';
    const description = [petName(row, labels), row.level === null ? '' : `Lv.${row.level}`, counterText(row, locale), percent === null ? '' : `${number(percent, locale)}%`, remainingText(row, labels, locale), stale, estimate, recentGain].filter(Boolean).join(' · ');
    return `<article class="pet-tracker-row${row.status === 'complete' ? ' is-complete' : ''}${row.stale ? ' is-stale' : ''}${row.automatic ? ' is-automatic' : ''}"><button type="button" class="pet-tracker-open" data-pet-action="open" data-id="${row.id}" aria-label="${escape(description)}" title="${escape(description)}"><span class="pet-tracker-title"><strong>${escape(petName(row, labels))}</strong><span class="pet-tracker-level">${row.level === null ? '—' : `Lv.${row.level}`}${row.automatic ? ` · ${labels.autoShort}` : ''}</span></span><span class="pet-tracker-values"><span class="pet-tracker-counter">${escape(counterText(row, locale))}</span><span class="pet-tracker-percent">${percent === null ? '—' : `${number(percent, locale)}%`}</span></span>${progressBar(row, labels, locale)}<span class="pet-tracker-meta"><small>${escape(remainingText(row, labels, locale))}${row.automatic ? `<span class="pet-recent-gain">${escape(recentGain)}</span>` : ''}</small><span class="pet-tracker-eta${row.stale ? ' is-stale' : ''}">${escape(stale || estimate)}</span></span></button>${row.automatic ? `<button class="pet-tracker-pin pet-pin" type="button" data-pet-action="pin" data-id="${row.id}" aria-label="${labels.pin} · ${escape(petName(row, labels))}" title="${pinLimitReached ? labels.limit : labels.pin}" ${pinLimitReached ? 'disabled' : ''}>◇ ${labels.pin}</button>` : `<button class="pet-unpin" type="button" data-pet-action="unpin" data-id="${row.id}" aria-label="${labels.unpin} · ${escape(petName(row, labels))}" title="${labels.unpin}">×</button>`}</article>`;
  };
  return `<div class="pet-tracker-heading${compact ? ' pet-tracker-mini' : ''}"><button type="button" data-pet-action="guide">${labels.tracker}${rows.length ? ` · ${rows.length}` : ''}${compact && rows.length > 1 ? ` · +${rows.length - 1}` : ''}</button><button type="button" data-pet-action="collapse" aria-expanded="${!collapsed}" aria-label="${collapsed ? labels.expand : labels.collapse}">${collapsed ? '⌄' : '⌃'}</button></div><div class="pet-tracker-rows${compact ? ' is-compact' : ''}" ${collapsed ? 'hidden' : ''}>${visible.length ? visible.map(rowHtml).join('') : `<p class="pet-tracker-empty">${labels.trackerEmpty}</p>`}</div>`;
}

export function renderPetGuide(plan, catalog, { locale = 'tr', filters = {}, pins = [], goal = 'max', show = true, automatic = true, selectedId = null } = {}) {
  const labels = petLabels(locale), selection = filteredPets(plan, { ...filters, pins });
  const selected = plan.rows.find(row => row.id === selectedId);
  const rows = selected && !selection.rows.some(row => row.id === selectedId) ? [selected, ...selection.rows] : selection.rows;
  const hasFaction = catalog.pets.some(row => row.faction !== 'unknown');
  const pinned = new Set(normalizePetPins(pins)), genera = [...new Set(catalog.pets.map(row => row.genus).filter(Boolean))].sort();
  const options = (values, selected) => values.map(([value, label]) => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(label)}</option>`).join('');
  const waitingForLive = plan.observedCount === 0;
  const liveOnlyFilter = ['observed', 'complete'].includes(filters.status);
  const noPinned = filters.status === 'pinned' && pinned.size === 0;
  const emptyTitle = waitingForLive && liveOnlyFilter ? labels.noReceived : noPinned ? labels.noPinned : labels.noResults;
  const emptyDetail = waitingForLive && liveOnlyFilter ? labels.noReceivedDetail : noPinned ? labels.noPinnedDetail : labels.noMatchDetail;
  const emptyAction = waitingForLive && liveOnlyFilter ? 'pet-guide-catalog' : 'pet-guide-reset';
  const emptyActionLabel = waitingForLive && liveOnlyFilter ? labels.catalogSearch : labels.resetFilters;
  return `<section class="pet-guide"><div class="pet-overview"><span><strong>${catalog.pets.length}</strong>${labels.catalog}</span><span><strong>${plan.observedCount}</strong>${labels.registered}</span><span><strong>${plan.completeCount}</strong>Lv.3</span></div><aside class="pet-live-state${waitingForLive ? ' is-waiting' : ''}" ${waitingForLive ? 'role="status"' : 'hidden'}><strong>${labels.waitingLive}</strong><p>${labels.waitingDetail}</p><p class="help">${labels.baseline}</p><button type="button" class="action-button secondary" data-action="refresh-pets" title="${labels.refreshReceivedHint}">${labels.refreshReceived}</button></aside>${plan.observed?.continuity === 'last-known' ? `<p class="quality-warning pet-stale-notice" role="status">${labels.staleDetail}</p>` : ''}${plan.observed && !plan.observed.inventory_complete ? `<p class="quality-warning">${labels.partial}</p>` : ''}<form id="pet-filter-form"><label class="field"><span>${labels.search}</span><input type="search" name="petQuery" value="${escape(filters.query || '')}" maxlength="120" autocomplete="off"></label><div class="field-grid"><label class="field" ${hasFaction ? '' : 'hidden'}><span>${locale === 'en' ? 'Faction' : 'Taraf'}</span><select name="petFaction">${options([['all', labels.all], ['elyos', labels.elyos], ['asmodian', labels.asmodian]], filters.faction || 'all')}</select></label><label class="field"><span>${labels.genus}</span><select name="petGenus">${options([['all', labels.all], ...genera.map(value => [value, value])], filters.genus || 'all')}</select></label><label class="field"><span>${labels.status}</span><select name="petStatus">${options(['all', 'incomplete', 'observed', 'pinned', 'complete'].map(value => [value, labels[value]]), filters.status || 'all')}</select></label><label class="field"><span>${labels.sort}</span><select name="petSort">${options(['name', 'remaining', 'recent'].map(value => [value, labels[value]]), filters.sort || 'name')}</select></label></div><div class="pet-filter-actions"><button class="action-button" type="submit">${labels.apply}</button><button class="action-button secondary" type="button" data-action="pet-guide-reset">${labels.resetFilters}</button></div></form><div class="pet-tracker-settings"><label class="field"><span>${labels.goal}</span><select name="petGoal">${options([['max', labels.max], ['next', labels.next]], goal)}</select></label><label class="check-field"><input type="checkbox" name="showPetTracker" ${show ? 'checked' : ''}>${labels.show}</label><label class="check-field"><input type="checkbox" name="petAutoTrack" ${automatic ? 'checked' : ''}>${labels.automatic}</label><p class="help">${labels.limit}. ${catalog.requirements ? `${labels.unlock}: ${catalog.requirements.souls[0]} · Lv.2: +${catalog.requirements.souls[1]} · Lv.3: +${catalog.requirements.souls[2]}` : ''}</p></div><div class="pet-results-heading"><strong>${selection.total} ${locale === 'en' ? 'results' : 'sonuç'}</strong><span>${selection.page + 1} / ${selection.pages}</span></div><div class="pet-guide-grid">${rows.length ? rows.map(row => `<article class="pet-guide-card${pinned.has(row.id) ? ' is-pinned' : ''}${row.stale ? ' is-stale' : ''}"><div class="record-top"><div><strong>${escape(petName(row, labels))}</strong><small>${escape([row.genus, row.faction === 'unknown' ? '' : labels[row.faction] || row.faction, row.level === null ? '' : `Lv.${row.level}`, row.summoned ? labels.summoned : ''].filter(Boolean).join(' · '))}</small></div><button type="button" class="pet-pin" data-action="pet-pin" data-id="${row.id}" aria-pressed="${pinned.has(row.id)}" aria-label="${pinned.has(row.id) ? labels.unpin : labels.pin} · ${escape(petName(row, labels))}" ${!pinned.has(row.id) && pinned.size >= PET_PIN_LIMIT ? 'disabled' : ''}>${pinned.has(row.id) ? '◆' : '◇'} ${pinned.has(row.id) ? labels.pinned : labels.pin}</button></div><strong class="pet-remaining">${escape(remainingText(row, labels, locale))}</strong>${row.stale ? `<small class="pet-stale-label">${escape(sampleText(row, labels, locale))}</small>` : ''}${progressBar(row, labels, locale)}<div class="pet-counter-detail">${row.progress !== null ? `${labels.raw}: ${number(row.progress, locale)}${row.required ? ` / ${number(row.required, locale)}` : ''}` : labels.missing}${row.sessionGained ? ` · ${labels.session} +${number(row.sessionGained, locale)}` : ''}${row.nextRemaining !== null && row.status !== 'complete' ? `<br>${labels.next}: ${number(row.nextRemaining, locale)} · ${labels.max}: ${number(row.maxRemaining, locale)}` : ''}${!row.stale && row.etaMs !== null ? `<br>${escape(eta(row.etaMs, labels, locale))} · ${number(row.soulsPerMinute, locale)} ${labels.perMinute} · ${labels.approximate}` : ''}</div><details data-state-key="pet-${row.id}" ${row.id === selectedId ? 'open' : ''}><summary>${labels.details}</summary><h4>${labels.location}</h4>${row.locations.length ? `<ul class="pet-locations">${row.locations.map(location => `<li><span class="pet-location-pin" aria-hidden="true">⌖</span><span><strong>${escape(location.zone)}</strong>${location.area ? `<small>${escape(location.area)}</small>` : ''}${location.monster ? `<small>${escape(location.monster)}${location.monster_level ? ` · Lv.${location.monster_level}` : ''}</small>` : ''}${sourceButton(location.map_url, labels.map)}${location.teleport ? `<small>${locale === 'en' ? 'Teleport' : 'Işınlanma'}: ${escape(location.teleport)}</small>` : ''}</span></li>`).join('')}</ul>` : `<p class="help">${labels.noLocation}</p>`}<h4>${labels.bonus}</h4>${row.bonuses.length ? `<ul class="pet-bonuses">${row.bonuses.map(bonus => `<li><span>${escape(bonus.stat)}</span><strong>${bonus.value === null ? '—' : `${bonus.value > 0 ? '+' : ''}${number(bonus.value, locale)}${escape(bonus.unit)}`}</strong>${bonus.level ? `<small>Lv.${bonus.level}</small>` : ''}</li>`).join('')}</ul><p class="help">${labels.inferredBonus}</p>` : `<p class="help">${labels.noBonus}</p>`}<div class="button-row">${sourceButton(row.map_url, labels.map)}</div></details><div class="pet-source-credit">${sourceButton(row.source_url, 'MetaBot.GG · ' + labels.source)}</div></article>`).join('') : `<div class="status-card pet-empty-state"><strong>${emptyTitle}</strong><p>${emptyDetail}</p><button type="button" class="action-button secondary" data-action="${emptyAction}">${emptyActionLabel}</button></div>`}</div><div class="button-row pet-pagination"><button class="action-button secondary" data-action="pet-guide-previous" ${selection.page === 0 ? 'disabled' : ''}>${labels.previous}</button><span>${selection.page + 1} / ${selection.pages}</span><button class="action-button secondary" data-action="pet-guide-next" ${selection.page >= selection.pages - 1 ? 'disabled' : ''}>${labels.nextPage}</button></div></section>`;
}
