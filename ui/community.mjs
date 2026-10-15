import { clockTime, compactNumber, formatRate } from './model.mjs';
import { scopedEncounter } from './scope.mjs';

const SCOPES = ['personal', 'party', 'observed'];
const CLASSES = ['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'spiritmaster', 'cleric', 'chanter'];
const clean = (value, maximum = 80) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum) : '';
const metric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : Number.isSafeInteger(value) && value >= 0 ? String(value) : '';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const rankingCursor = value => typeof value === 'string' && /^\d{1,4}$/.test(value) && Number(value) <= 5000 ? String(Number(value)) : '';
const rankingFilterKey = value => JSON.stringify(['region', 'server', 'boss', 'difficulty', 'class_name', 'scope'].map(key => value[key]));

export function communityUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}

export function communityFilters(value = {}) {
  const filters = Object.fromEntries(['region', 'server', 'boss', 'difficulty'].map(key => [key, clean(value[key])]));
  filters.class_name = CLASSES.includes(String(value.class_name).toLowerCase()) ? String(value.class_name).toLowerCase() : '';
  filters.scope = SCOPES.includes(value.scope) ? value.scope : 'personal';
  filters.limit = 25;
  filters.cursor = rankingCursor(value.cursor) || '0';
  return filters;
}

export function communityShareOptions(value = {}) {
  const scope = SCOPES.includes(value.scope) ? value.scope : 'personal';
  const context = Object.fromEntries(['region', 'server', 'boss', 'difficulty'].map(key => [key, clean(value.context?.[key])]));
  return { scope, anonymous: value.anonymous !== false, rank_opt_in: value.rank_opt_in === true && scope === 'personal', context };
}

export function communityEligibility(record, options = {}) {
  const selected = communityShareOptions(options);
  if (selected.scope !== 'personal') return 'personalOnly';
  if (!record || record.provenance === 'demo' || record.provenance === 'imported-unverified' || record.source && record.source !== 'captured') return 'receivedOnly';
  const own = record.players?.find(player => String(player.id) === String(record.local_player_id));
  if (record.local_player_id === null || record.local_player_id === undefined || !['server', 'name-match'].includes(record.local_identity_source) || own?.identity_confirmed !== true) return 'identityRequired';
  if (record.sample_complete !== true || record.truncated === true || record.stream_gaps > 0 || record.diagnostics?.stream_gaps > 0) return 'completeRequired';
  if (!(record.personal_elapsed_ms >= 10000) || !(record.personal_total_damage > 0)) return 'durationRequired';
  if (record.personal_targets?.length !== 1 || record.personal_targets[0].is_boss !== true) return 'bossRequired';
  if (!own.class_name || own.class_name.toLowerCase() === 'unknown') return 'classRequired';
  if (Object.values(selected.context).some(value => !value) || record.personal_targets[0].name?.toLowerCase() !== selected.context.boss.toLowerCase()) return 'contextRequired';
  return 'eligible';
}

export function communitySummary(record, { scope = 'personal', anonymous = true, locale = 'tr' } = {}) {
  const chosen = scopedEncounter(record, SCOPES.includes(scope) ? scope : 'personal');
  if (!chosen.known || !(chosen.damage > 0) || !(chosen.elapsed > 0)) return '';
  const en = locale === 'en', lines = [`Luma DPS · ${({ personal: en ? 'Personal' : 'Kişisel', party: en ? 'Group' : 'Takım', observed: en ? 'Observed players' : 'Gözlenen oyuncular' })[chosen.scope] || (en ? 'Encounter' : 'Karşılaşma')}`, `${en ? 'Duration' : 'Süre'}: ${clockTime(chosen.elapsed)} · DPS: ${formatRate(chosen.dps, locale)} · ${en ? 'Damage' : 'Hasar'}: ${compactNumber(chosen.damage, locale)}`];
  const players = chosen.players.slice().sort((a, b) => b.dps - a.dps);
  for (const [index, player] of players.slice(0, 20).entries()) {
    const own = String(player.id) === String(record.local_player_id), name = !anonymous && own ? clean(player.name, 60) : `Player ${index + 1}`;
    lines.push(`${index + 1}. ${name} · ${clean(player.class_name, 40)} · ${formatRate(player.dps, locale)} · ${compactNumber(player.damage, locale)}`);
  }
  if (players.length > 20) lines.push(`+${players.length - 20} ${en ? 'players' : 'oyuncu'}`);
  lines.push(en ? 'Local encounter summary · not a verified ranking' : 'Yerel karşılaşma özeti · doğrulanmış sıralama değildir');
  return lines.join('\n').slice(0, 2000);
}

function normalizedShare(value) {
  const id = identifier(value?.id), url = communityUrl(value?.url);
  if (!id || !url) return null;
  return { id, url, created_at_ms: metric(value.created_at_ms), scope: SCOPES.includes(value.scope) ? value.scope : 'observed', anonymous: value.anonymous !== false, rank_opt_in: value.rank_opt_in === true, local_record_id: identifier(value.local_record_id), validation: 'community' };
}

export function communitySnapshot(value = {}) {
  return { configured: value.configured === true, endpoint: communityUrl(value.endpoint), shares: Array.isArray(value.shares) ? value.shares.slice(0, 200).map(normalizedShare).filter(Boolean) : [], pending_count: metric(value.pending_count) ?? 0, storage_error: clean(value.storage_error, 160) };
}

export function communityRankings(value = {}) {
  const entries = Array.isArray(value.entries) ? value.entries.slice(0, 25).flatMap(row => {
    const id = identifier(row?.share_id), url = communityUrl(row?.url), dps = metric(row?.dps), damage = metric(row?.total_damage), duration = metric(row?.duration_ms), rank = metric(row?.rank);
    if (!id || !url || dps === null || damage === null || !(duration > 0) || !Number.isInteger(rank) || rank < 1) return [];
    return [{ rank, share_id: id, url, name: clean(row.name, 80) || 'Player', class_name: clean(row.class_name, 60), dps, total_damage: damage, duration_ms: duration, ...Object.fromEntries(['region', 'server', 'boss', 'difficulty'].map(key => [key, clean(row[key])])), scope: SCOPES.includes(row.scope) ? row.scope : 'personal', validation: 'community' }];
  }) : [];
  return { entries, total: Number.isSafeInteger(value.total) && value.total >= 0 ? value.total : entries.length, next_cursor: rankingCursor(value.next_cursor), notice: clean(value.notice, 300) };
}

export const communityLabels = Object.freeze({
  tr: {
    community: 'Paylaşım ve sıralama', intro: 'Karşılaşmanı ücretsiz bağlantıyla paylaş veya topluluk sıralamasına katıl. Hiçbir kayıt otomatik yüklenmez.', loading: 'Yükleniyor…', unavailable: 'Çevrimiçi topluluk hizmeti henüz bağlı değil. Yerel HTML / JSON raporlarını Geçmiş bölümünden ücretsiz paylaşabilirsin.', offline: 'Hizmete ulaşılamadı. Son alınan sonuçlar korunuyor.', retry: 'Yenile', sample: 'ARAYÜZ ÖRNEĞİ · ÇEVRİMİÇİ DEĞİL', shareTitle: 'Karşılaşma paylaş', record: 'Paylaşılacak kayıt', current: 'Şimdiki karşılaşmanın anlık görüntüsü', scope: 'Kapsam', personal: 'Kişisel', party: 'Takım', observed: 'Gözlenen oyuncular', anonymous: 'Kendi adımı da gizle', namesHelp: 'Kapalıysa kendi adın herkese açık olur. Diğer oyuncuların adları her zaman takma etiketle gösterilir. Özel notlar ve ham paketler paylaşılmaz.', rank: 'Ayrıca topluluk sıralamasına katıl', rankHelp: 'Sıralama yalnızca tam kaydı ve doğrulanmış kişisel kimliği olan canlı kişisel sonuçları kabul eder. Topluluk yüklemeleri oyun sunucusunca doğrulanmış dünya rekorları değildir.', consent: 'Bu karşılaşmayı herkesin açabileceği bir bağlantıyla yayınlamayı kabul ediyorum.', publish: 'Ücretsiz paylaşım bağlantısı oluştur', busy: 'İşleniyor…', own: 'Paylaştıklarım', noShares: 'Henüz paylaştığın çevrimiçi kayıt yok.', copy: 'Bağlantıyı kopyala', open: 'Raporu aç', revoke: 'Bağlantıyı kaldır', revokeConfirm: 'Bu herkese açık raporun bağlantısı kaldırılacak.', revokeCancel: 'Vazgeç', revokeYes: 'Evet, kaldır', public: 'Herkese açık bağlantı', anonymousLabel: 'Adlar gizli', namesLabel: 'Kendi adın açık', ranked: 'Sıralamaya katıldı', unranked: 'Yalnızca paylaşım', leaderboard: 'Topluluk sıralaması', rankingHelp: 'Yalnızca paylaşmayı ve sıralamaya katılmayı seçen oyuncular. Eşit karşılaştırma için aynı boss, zorluk ve süreyi kontrol et. Bölge / sunucu / zorluk etiketleri paylaşan kişi tarafından belirtilir.', noRankings: 'Bu filtrelere uygun paylaşılmış sonuç yok.', region: 'Bölge', server: 'Sunucu', boss: 'Boss / hedef', difficulty: 'Zorluk', class: 'Sınıf', all: 'Tümü', filter: 'Sıralamayı getir', player: 'Oyuncu', duration: 'Süre', damage: 'Toplam hasar', unverified: 'TOPLULUK KAYDI', shown: 'gösterilen', total: 'sonuç', published: 'Paylaşım bağlantısı oluşturuldu', removed: 'Paylaşım kaldırıldı', copied: 'Bağlantı kopyalandı', failed: 'İşlem tamamlanamadı', unknownDate: 'Tarih bilinmiyor', selected: 'Seçili kayıt', noRecord: 'Paylaşmak için önce bir karşılaşma kaydet.', noNative: 'Çevrimiçi paylaşım için masaüstü uygulamasını aç.', note: 'Yalnızca açıkça seçtiğin karşılaşma gönderilir. Küp sesi, diğer kayıtların ve yerel dosyaların gönderilmez.', rankAnonymous: 'Adın gizliyken sonuç takma etiketle görünür.', recordMissing: 'Seçili kayıt artık geçmişte değil; tekrar seç.'
  },
  en: {
    community: 'Sharing and rankings', intro: 'Share an encounter with a free link or join the community rankings. Records are never uploaded automatically.', loading: 'Loading…', unavailable: 'The online community service is not connected yet. You can share free local HTML / JSON reports from History.', offline: 'The service could not be reached. Previously received results are preserved.', retry: 'Refresh', sample: 'UI SAMPLE · NOT ONLINE', shareTitle: 'Share encounter', record: 'Record to share', current: 'Snapshot of the current encounter', scope: 'Scope', personal: 'Personal', party: 'Group', observed: 'Observed players', anonymous: 'Also hide my name', namesHelp: 'When off, your own name is public. Other players always use anonymous labels. Private notes and raw packets are excluded.', rank: 'Also enter the community rankings', rankHelp: 'Rankings accept only complete live personal results with a confirmed local identity. Community uploads are not world records verified by the game server.', consent: 'I agree to publish this encounter through a link that anyone can open.', publish: 'Create a free share link', busy: 'Working…', own: 'My shared records', noShares: 'You have not shared an online record yet.', copy: 'Copy link', open: 'Open report', revoke: 'Remove link', revokeConfirm: 'This public report link will be removed.', revokeCancel: 'Cancel', revokeYes: 'Yes, remove', public: 'Public link', anonymousLabel: 'Names hidden', namesLabel: 'Own name visible', ranked: 'Entered rankings', unranked: 'Shared only', leaderboard: 'Community rankings', rankingHelp: 'Only players who chose to share and enter the rankings appear. Compare the same boss, difficulty and duration. Region / server / difficulty labels are supplied by the uploader.', noRankings: 'No shared results match these filters.', region: 'Region', server: 'Server', boss: 'Boss / target', difficulty: 'Difficulty', class: 'Class', all: 'All', filter: 'Load rankings', player: 'Player', duration: 'Duration', damage: 'Total damage', unverified: 'COMMUNITY RECORD', shown: 'shown', total: 'results', published: 'Share link created', removed: 'Share removed', copied: 'Link copied', failed: 'The action could not be completed', unknownDate: 'Date unavailable', selected: 'Selected record', noRecord: 'Record an encounter before sharing.', noNative: 'Open the desktop app for online sharing.', note: 'Only the encounter you explicitly select is sent. Cube audio, other records and local files are excluded.', rankAnonymous: 'When names are hidden, your result appears under an anonymous label.', recordMissing: 'This record is no longer in history; select it again.'
  }
});

export function createCommunityController({ readState, readRankings, publish, revoke, onChanged } = {}) {
  let state = communitySnapshot(), rankings = communityRankings(), filters = communityFilters(), readingState = false, readingRankings = false, mutation = false, error = '', lastShare = null, filterRevision = 0;
  let currentCursor = '0', previousCursors = [], confirmedFilterKey = rankingFilterKey(filters);
  const changed = () => onChanged?.();
  const fail = value => { error = clean(String(value?.message || value || 'Request failed'), 180); };
  const pagination = () => {
    const sameFilters = confirmedFilterKey === rankingFilterKey(filters);
    const hasNext = rankings.next_cursor !== '' && Number(rankings.next_cursor) > Number(currentCursor) && Number(rankings.next_cursor) < rankings.total && previousCursors.length < 200;
    return { cursor: currentCursor, previous_cursors: previousCursors.slice(), page: previousCursors.length + 1, pages: Math.max(1, Math.ceil(rankings.total / 25)), has_previous: previousCursors.length > 0, has_next: hasNext, can_previous: !readingRankings && sameFilters && previousCursors.length > 0, can_next: !readingRankings && sameFilters && hasNext };
  };
  async function requestRankings(input, previous) {
    const requested = communityFilters(input), revision = ++filterRevision;
    filters = requested; readingRankings = true; error = ''; changed();
    try {
      const result = communityRankings(await readRankings(requested));
      if (revision !== filterRevision) return false;
      rankings = result; currentCursor = requested.cursor; previousCursors = previous.slice(0, 200); confirmedFilterKey = rankingFilterKey(requested); error = '';
      return true;
    }
    catch (e) { if (revision === filterRevision) fail(e); return false; }
    finally { if (revision === filterRevision) { readingRankings = false; changed(); } }
  }
  return {
    get view() { return { state, rankings, filters: { ...filters }, pagination: pagination(), readingState, readingRankings, mutation, error, lastShare }; },
    async refreshState() {
      if (readingState || mutation) return;
      readingState = true; changed();
      try { state = communitySnapshot(await readState()); error = ''; }
      catch (e) { fail(e); }
      finally { readingState = false; changed(); }
    },
    refreshRankings(input = filters) { return requestRankings({ ...input, cursor: '0' }, []); },
    async nextRankingsPage() {
      if (!pagination().can_next) return false;
      return requestRankings({ ...filters, cursor: rankings.next_cursor }, [...previousCursors, currentCursor]);
    },
    async previousRankingsPage() {
      if (!pagination().can_previous) return false;
      return requestRankings({ ...filters, cursor: previousCursors.at(-1) }, previousCursors.slice(0, -1));
    },
    async publish(recordId, options) {
      if (mutation || readingState || !state.configured) return null;
      mutation = true; error = ''; changed();
      try {
        const result = normalizedShare(await publish(recordId, communityShareOptions(options)));
        if (!result) throw new Error('Invalid sharing response');
        state = { ...state, shares: [result, ...state.shares.filter(share => share.id !== result.id)].slice(0, 200) }; lastShare = result;
        return result;
      } catch (e) { fail(e); return null; }
      finally { mutation = false; changed(); }
    },
    async revoke(id) {
      if (mutation || !state.shares.some(share => share.id === id)) return false;
      mutation = true; error = ''; changed();
      try { await revoke(id); state = { ...state, shares: state.shares.filter(share => share.id !== id) }; if (lastShare?.id === id) lastShare = null; return true; }
      catch (e) { fail(e); return false; }
      finally { mutation = false; changed(); }
    }
  };
}

export function renderCommunity({ view, locale = 'tr', records = [], currentRecord = null, draft = {}, rankingDraft = {}, demo = false, native = false, revokeId = '', summaryText = '' }) {
  const l = communityLabels[locale] || communityLabels.tr, s = view.state, o = communityShareOptions(draft), filters = communityFilters(rankingDraft), busy = view.mutation, disabled = !native || !s.configured || busy || view.readingState;
  const labels = key => esc(l[key]);
  const page = view.pagination || { page: 1, pages: 1, can_previous: false, can_next: false };
  const pageWords = locale === 'en' ? { previous: 'Previous', next: 'Next', page: 'Page', navigation: 'Ranking pages' } : { previous: 'Önceki', next: 'Sonraki', page: 'Sayfa', navigation: 'Sıralama sayfaları' };
  const pager = view.rankings.entries.length || page.page > 1 ? `<nav class="button-row community-pagination" aria-label="${esc(pageWords.navigation)}"><button type="button" class="action-button secondary" data-action="community-page-previous" ${!native || !s.configured || !page.can_previous ? 'disabled' : ''}>← ${esc(pageWords.previous)}</button><span class="help" role="status">${esc(pageWords.page)} ${page.page} / ${Math.max(page.page, page.pages)}</span><button type="button" class="action-button secondary" data-action="community-page-next" ${!native || !s.configured || !page.can_next ? 'disabled' : ''}>${esc(pageWords.next)} →</button></nav>` : '';
  const select = (name, label, values, value, empty = false, extra = '') => `<label class="field"><span>${labels(label)}</span><select name="${name}" ${extra}>${empty ? `<option value="">${labels('all')}</option>` : ''}${values.map(option => `<option value="${esc(option.value ?? option)}" ${String(option.value ?? option) === String(value) ? 'selected' : ''}>${esc(option.label ?? l[option] ?? option)}</option>`).join('')}</select></label>`;
  const input = (name, label, value) => `<label class="field"><span>${labels(label)}</span><input name="${name}" value="${esc(value)}" type="text" maxlength="80" autocomplete="off"></label>`;
  const context = (prefix, value) => `${input(`${prefix}Region`, 'region', value.region)}${input(`${prefix}Server`, 'server', value.server)}${input(`${prefix}Boss`, 'boss', value.boss)}${input(`${prefix}Difficulty`, 'difficulty', value.difficulty)}`;
  const share = row => `<article class="record-card community-result"><div class="record-top"><strong>${labels('public')} · ${labels(row.scope)}</strong><span class="tag">${labels('unverified')}</span></div><p class="record-meta">${labels(row.anonymous ? 'anonymousLabel' : 'namesLabel')} · ${labels(row.rank_opt_in ? 'ranked' : 'unranked')} · ${row.created_at_ms !== null ? esc(new Date(row.created_at_ms).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')) : labels('unknownDate')}</p><label class="field"><span>${labels('public')}</span><input readonly spellcheck="false" data-community-url="${esc(row.id)}" value="${esc(row.url)}"></label><div class="button-row"><button type="button" class="action-button secondary" data-action="copy-community" data-id="${esc(row.id)}">${labels('copy')}</button><button type="button" class="action-button secondary" data-action="open-community" data-id="${esc(row.id)}">${labels('open')}</button><button type="button" class="action-button secondary" data-action="confirm-revoke-community" data-id="${esc(row.id)}" ${busy ? 'disabled' : ''}>${labels('revoke')}</button></div>${revokeId === row.id ? `<div class="community-revoke" role="group" aria-label="${labels('revoke')}"><p class="help">${labels('revokeConfirm')}</p><div class="button-row"><button type="button" class="action-button" data-action="revoke-community" data-id="${esc(row.id)}" ${busy ? 'disabled' : ''}>${labels('revokeYes')}</button><button type="button" class="action-button secondary" data-action="cancel-revoke-community">${labels('revokeCancel')}</button></div></div>` : ''}</article>`;
  const chosenRecord = draft.recordId ? records.find(record => String(record.id) === String(draft.recordId)) : null;
  const eligibility = communityEligibility(draft.recordId ? chosenRecord : currentRecord, o);
  const eligibilityText = (locale === 'en' ? {
    eligible: 'This record meets the basic ranking requirements. The service validates the submitted result.', personalOnly: 'Choose Personal to enter the rankings. Group and observed records can still be shared.', receivedOnly: 'Only a live captured record can enter the rankings. Imported records and demos cannot.', identityRequired: 'Wait for your own character name to be received automatically before recording a ranking attempt.', completeRequired: 'A complete recorded encounter is required for rankings.', durationRequired: 'Record at least 10 seconds of personal damage to enter the rankings.', bossRequired: 'Select an encounter with a boss target before ranking.', classRequired: 'Your character class must be known for a ranking result.', contextRequired: 'Enter region, server, boss and difficulty to make the result comparable.'
  } : {
    eligible: 'Kayıt temel sıralama koşullarını sağlıyor. Gönderilen sonucu hizmet kontrol eder.', personalOnly: 'Sıralama için Kişisel seç. Takım ve gözlenen kayıtlar da paylaşılabilir.', receivedOnly: 'Sıralamaya yalnızca canlı yakalanan kayıt katılabilir. İçe aktarılan kayıt ve demo katılamaz.', identityRequired: 'Sıralama denemesinden önce karakter adının otomatik alınmasını bekle.', completeRequired: 'Sıralama için eksiksiz karşılaşma kaydı gerekir.', durationRequired: 'Sıralama için en az 10 saniye kişisel hasar kaydet.', bossRequired: 'Sıralama için boss hedefi bulunan bir karşılaşma seç.', classRequired: 'Sıralama için karakter sınıfının bilinmesi gerekir.', contextRequired: 'Karşılaştırılabilir sonuç için bölge, sunucu, boss ve zorluğu gir.'
  })[eligibility];
  const storageWarning = s.storage_error ? `<p class="quality-warning" role="status">${locale === 'en' ? 'The local sharing key store could not be read. Resolve this before publishing another record.' : 'Yerel paylaşım anahtarları okunamadı. Yeni kayıt paylaşmadan önce bu sorunu gider.'} <small>${esc(s.storage_error)}</small></p>` : '';
  const pendingWarning = s.pending_count > 0 ? `<p class="help" role="status">${locale === 'en' ? `${s.pending_count} upload requests await confirmation. Retry the same record to recover its link.` : `${s.pending_count} paylaşım isteğinin onayı bekleniyor. Bağlantıyı kurtarmak için aynı kaydı tekrar paylaş.`}</p>` : '';
  return `<section class="community-page">${demo ? `<p class="quality-warning">${labels('sample')}</p>` : ''}<p class="help">${labels('intro')}</p>${!native && !demo ? `<p class="status-card">${labels('noNative')}</p>` : ''}${view.error ? `<div class="status-card community-error" role="status"><p>${labels('offline')}</p><small>${esc(view.error)}</small></div>` : ''}${!s.configured ? `<p class="status-card">${labels('unavailable')}</p>` : ''}<div class="button-row"><button type="button" class="action-button secondary" data-action="refresh-community" ${view.readingState ? 'disabled' : ''}>${labels(view.readingState ? 'loading' : 'retry')}</button></div>
    <h3 class="section-title">${labels('shareTitle')}</h3><form id="community-share-form"><div class="field-grid">${select('communityRecordId', 'record', [{ value: '', label: l.current }, ...records.map(record => ({ value: String(record.id), label: record.name || `#${record.id}` }))], draft.recordId || '')}${select('communityScope', 'scope', SCOPES, o.scope)}</div>${chosenRecord ? `<p class="record-meta community-share-summary">${labels('selected')}: ${esc(chosenRecord.name || `#${chosenRecord.id}`)} · ${clockTime(chosenRecord.elapsed_ms)}</p>` : ''}<div class="field-grid">${context('community', o.context)}</div><label class="check-field"><input name="communityAnonymous" type="checkbox" ${o.anonymous ? 'checked' : ''} ${busy ? 'disabled' : ''}>${labels('anonymous')}</label><p class="help">${labels('namesHelp')}</p><label class="check-field"><input name="communityRankOptIn" type="checkbox" ${o.rank_opt_in ? 'checked' : ''} ${o.scope !== 'personal' || busy ? 'disabled' : ''}>${labels('rank')}</label><p class="help">${labels('rankHelp')} ${o.anonymous ? labels('rankAnonymous') : ''}</p><p class="help">${labels('note')}</p><label class="check-field"><input name="communityConsent" type="checkbox" ${draft.consent === true ? 'checked' : ''} required ${disabled ? 'disabled' : ''}>${labels('consent')}</label><div class="button-row"><button class="action-button" type="submit" ${disabled ? 'disabled' : ''}>${labels(busy ? 'busy' : 'publish')}</button></div></form>
    <p class="help community-eligibility" role="status">${esc(eligibilityText)}</p>${storageWarning}${pendingWarning}<div class="button-row"><button type="button" class="action-button secondary" data-action="copy-community-summary">${locale === 'en' ? 'Copy encounter text' : 'Karşılaşma metnini kopyala'}</button></div>${summaryText ? `<label class="field"><span>${locale === 'en' ? 'Text summary · no upload' : 'Metin özeti · yükleme yapılmaz'}</span><textarea id="community-summary-text" rows="6" readonly>${esc(summaryText)}</textarea></label>` : ''}<h3 class="section-title">${labels('own')}</h3><div class="community-shares">${s.shares.length ? s.shares.map(share).join('') : `<p class="help">${labels('noShares')}</p>`}</div>
    <h3 class="section-title">${labels('leaderboard')}</h3><p class="help">${labels('rankingHelp')}</p><form id="community-rankings-form"><div class="field-grid">${context('ranking', filters)}${select('rankingClass', 'class', CLASSES, filters.class_name, true)}${select('rankingScope', 'scope', SCOPES, filters.scope)}</div><div class="button-row"><button class="action-button secondary" type="submit" ${!native || !s.configured || view.readingRankings ? 'disabled' : ''}>${labels(view.readingRankings ? 'loading' : 'filter')}</button></div></form>${view.rankings.notice ? `<p class="help">${esc(view.rankings.notice)}</p>` : ''}<div class="community-ranking" aria-live="polite">${view.rankings.entries.length ? `<p class="help">${view.rankings.entries.length} ${labels('shown')} · ${view.rankings.total} ${labels('total')}</p>${view.rankings.entries.map(row => `<article class="record-card community-rank"><div class="record-top"><strong>#${row.rank} · ${esc(row.name)}</strong><strong>${esc(formatRate(row.dps, locale))}</strong></div><p class="record-meta">${[row.class_name, row.region, row.server, row.boss, row.difficulty].filter(Boolean).map(esc).join(' · ')}<br>${labels('damage')}: ${esc(compactNumber(row.total_damage, locale))} · ${labels('duration')}: ${clockTime(row.duration_ms)} · ${labels('unverified')}</p><div class="button-row"><button type="button" class="action-button secondary" data-action="open-community-rank" data-id="${esc(row.share_id)}">${labels('open')}</button></div></article>`).join('')}` : `<p class="help">${labels('noRankings')}</p>`}${pager}</div></section>`;
}
