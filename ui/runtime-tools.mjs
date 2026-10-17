const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const HOTKEY_ACTIONS = ['toggle-visibility', 'toggle-lock', 'toggle-pause', 'reset', 'settings', 'copy-summary', 'toggle-fullscreen'];
const labels = {
  tr: ['Göster / gizle', 'Kilitle / aç', 'Duraklat / sürdür', 'Karşılaşmayı sıfırla', 'Ayarları aç', 'Özeti kopyala', 'Tam ekran / pencere'],
  en: ['Show / hide', 'Lock / unlock', 'Pause / resume', 'Reset encounter', 'Open settings', 'Copy summary', 'Fullscreen / window'],
};
export function hotkeyDraft(rows) {
  return HOTKEY_ACTIONS.map((action, index) => {
    const row = (Array.isArray(rows) ? rows : []).find(item => item?.action === action);
    return { action, shortcut: typeof row?.shortcut === 'string' ? row.shortcut.slice(0, 48) : `Ctrl+Alt+Shift+F${[7, 8, 9, 10, 11, 6, 5][index]}`, enabled: row?.enabled !== false };
  });
}
export function renderHotkeys(state, { locale = 'tr', native = false, busy = false } = {}) {
  const tr = locale === 'tr';
  return `<h3 class="section-title">${tr ? 'Genel kısayollar' : 'Global shortcuts'}</h3><p class="help">${tr ? 'Oyun öndeyken de çalışır. Ctrl, Alt, Shift arasından en az ikisi ve bir tuş kullan. Çakışan değişiklikler kaydedilmez.' : 'Works while the game is foreground. Use at least two of Ctrl, Alt, Shift plus a key. Conflicting changes are not saved.'}</p>${(state?.errors || []).slice(0, 6).map(error => `<p class="quality-warning">${esc(String(error).slice(0, 240))}</p>`).join('')}<form id="hotkey-form" class="hotkey-form">${hotkeyDraft(state?.bindings).map((row, index) => `<div class="hotkey-row"><label class="check-field"><input type="checkbox" name="enabled-${row.action}" ${row.enabled ? 'checked' : ''} ${!native || busy ? 'disabled' : ''}>${labels[tr ? 'tr' : 'en'][index]}</label><input type="text" aria-label="${labels[tr ? 'tr' : 'en'][index]}" name="shortcut-${row.action}" maxlength="48" value="${esc(row.shortcut)}" spellcheck="false" ${!native || busy ? 'disabled' : ''}></div>`).join('')}<button type="submit" class="action-button" ${!native || busy ? 'disabled' : ''}>${tr ? 'Kısayolları kaydet' : 'Save shortcuts'}</button></form>`;
}
export function updatePresentation(value = {}) {
  const status = ['idle', 'checking', 'available', 'current', 'downloading', 'downloaded', 'installing', 'error'].includes(value.status) ? value.status : 'idle';
  const version = typeof value.version === 'string' ? value.version.slice(0, 40) : typeof value.available_version === 'string' ? value.available_version.slice(0, 40) : '';
  return { status, version, notes: typeof value.notes === 'string' ? value.notes.slice(0, 6000) : '', error: typeof value.error === 'string' ? value.error.slice(0, 320) : '', verified: value.publisher_verified === true, downloaded: value.downloaded === true || status === 'downloaded', busy: ['checking', 'downloading', 'installing'].includes(status) };
}
export function renderUpdates(value, { locale = 'tr', native = false, busy = false } = {}) {
  const tr = locale === 'tr', view = updatePresentation(value), names = tr ? { idle: 'Kontrol edilmeye hazır', checking: 'Kontrol ediliyor…', available: 'Yeni sürüm mevcut', current: 'Güncel', downloading: 'İndiriliyor…', downloaded: 'Kurulmaya hazır', installing: 'Yeniden başlatılıyor…', error: 'Güncelleme tamamlanamadı' } : { idle: 'Ready to check', checking: 'Checking…', available: 'Update available', current: 'Up to date', downloading: 'Downloading…', downloaded: 'Ready to install', installing: 'Restarting…', error: 'Update could not complete' };
  const disabled = !native || busy || view.busy;
  return `<section class="update-card"><h3 class="section-title">${tr ? 'Uygulama güncellemeleri' : 'App updates'}</h3><div class="record-top"><strong>${names[view.status]}</strong>${view.version ? `<span class="tag">${esc(view.version)}</span>` : ''}</div>${view.verified ? `<p class="help">${tr ? 'Yayıncı imzası doğrulandı' : 'Publisher signature verified'}</p>` : ''}${view.error ? `<p class="quality-warning">${esc(view.error)}</p>` : ''}${view.notes ? `<details><summary>${tr ? 'Sürüm notları' : 'Release notes'}</summary><p class="update-notes">${esc(view.notes)}</p></details>` : ''}<div class="button-row"><button class="action-button secondary" data-action="check-update" ${disabled ? 'disabled' : ''}>${tr ? 'Kontrol et' : 'Check'}</button>${view.verified && ['available', 'downloaded'].includes(view.status) ? `<button class="action-button" data-action="${view.downloaded ? 'install-update' : 'download-update'}" ${disabled ? 'disabled' : ''}>${view.downloaded ? tr ? 'Yükle ve yeniden başlat' : 'Install and restart' : tr ? 'İndir' : 'Download'}</button>` : ''}</div><p class="help">${tr ? 'Güncelleme paketi Luma yayıncı imzası ve SHA-256 ile doğrulanır. Kurulum seçildiğinde uygulama yeniden başlar.' : 'Update packages are verified using the Luma publisher signature and SHA-256. Choosing install restarts the app.'}</p></section>`;
}
