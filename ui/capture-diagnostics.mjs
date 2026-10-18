export const PACKET_MONITOR_EXPORTS = Object.freeze([
  'PacketMonitorInitialize', 'PacketMonitorUninitialize', 'PacketMonitorCreateLiveSession',
  'PacketMonitorCloseSessionHandle', 'PacketMonitorCreateRealtimeStream', 'PacketMonitorCloseRealtimeStream',
  'PacketMonitorSetSessionActive', 'PacketMonitorAttachOutputToSession', 'PacketMonitorEnumDataSources',
  'PacketMonitorAddSingleDataSourceToSession', 'PacketMonitorAddCaptureConstraint',
]);

const operations = new Set([...PACKET_MONITOR_EXPORTS, 'LoadLibraryExW', 'GetProcAddress']);
const captureStates = new Set(['starting', 'capturing', 'waiting', 'stopped', 'disconnected', 'error', 'no-game', 'permission-required', 'unavailable', 'unsupported', 'disabled', 'api-unavailable', 'api-version-mismatch', 'operation-not-supported']);
const osStates = new Set(['ready', 'unavailable', 'unsupported']);
const monitorStates = new Set(['exports-available', 'api-unavailable', 'permission-required', 'error', 'unsupported']);
const osLabels = new Set(['Windows 10', 'Windows 11', 'Windows Server', 'Windows', 'Not Windows']);
const architectures = new Set(['x86', 'x86_64', 'arm', 'aarch64', 'ia64', 'unknown']);
const modes = new Set(['native', 'demo', 'browser']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uint32 = value => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
const choice = (value, allowed, fallback = 'unknown') => allowed.has(value) ? value : fallback;
const esc = value => String(value ?? '').replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function errorCode(value) {
  if (typeof value !== 'string' || value.length > 24) return null;
  if (/^0x[0-9a-f]{8}$/i.test(value)) return `0x${value.slice(2).toUpperCase()}`;
  if (/^ntstatus:0x[0-9a-f]{8}$/i.test(value)) return `ntstatus:0x${value.slice(11).toUpperCase()}`;
  if (/^win32:\d{1,10}$/.test(value)) {
    const code = uint32(Number(value.slice(6)));
    return code === null ? null : `win32:${code}`;
  }
  return value === 'stream-stopped' ? value : null;
}

function exportNames(value) {
  const received = new Set(Array.isArray(value) ? value.slice(0, 64).filter(name => typeof name === 'string') : []);
  return PACKET_MONITOR_EXPORTS.filter(name => received.has(name));
}

function reportMode(value, requested) {
  // An example or browser report cannot be relabelled as a native observation.
  if (value === 'demo' || value === 'browser') return value;
  return modes.has(requested) ? requested : choice(value, modes);
}

// Construct the export field by field. A capture state can also contain player
// names, endpoints, tokens and packet data, none of which belongs in this report.
export function normalizeCaptureDiagnostics(value, { mode } = {}) {
  if (!object(value) || value.type !== 'luma-capture-diagnostics' || value.schema_version !== 1) return null;
  const compatibility = value.compatibility;
  if (!object(compatibility) || compatibility.schema_version !== 1 || compatibility.diagnostic_only !== true || compatibility.capture_started !== false) return null;
  const os = compatibility.os, monitor = compatibility.packet_monitor;
  if (!object(os) || !object(monitor) || monitor.system32_only !== true) return null;
  const present = exportNames(monitor.exports_present), missing = exportNames(monitor.exports_missing);
  const conflicts = new Set(present.filter(name => missing.includes(name)));
  const exportsPresent = present.filter(name => !conflicts.has(name)), exportsMissing = missing.filter(name => !conflicts.has(name));
  const loadStatus = choice(monitor.load_status, new Set(['loaded', 'failed', 'not-windows']));
  const loadError = uint32(monitor.load_error_code);
  let monitorStatus = choice(monitor.status, monitorStates);
  if (monitorStatus === 'exports-available' && (loadStatus !== 'loaded' || loadError !== null || exportsPresent.length !== PACKET_MONITOR_EXPORTS.length || exportsMissing.length || conflicts.size)) monitorStatus = 'unknown';
  const capture = object(value.capture) ? value.capture : {};
  return {
    type: 'luma-capture-diagnostics', schema_version: 1,
    app_version: typeof value.app_version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value.app_version) ? value.app_version : 'unknown',
    mode: reportMode(value.mode, mode),
    compatibility: {
      schema_version: 1, diagnostic_only: true, capture_started: false,
      os: {
        status: choice(os.status, osStates), label: choice(os.label, osLabels, null),
        architecture: choice(os.architecture, architectures), process_architecture: choice(os.process_architecture, architectures),
        major: uint32(os.major), minor: uint32(os.minor), build: uint32(os.build), ubr: uint32(os.ubr),
        version_source: choice(os.version_source, new Set(['RtlGetVersion', 'unavailable', 'not-windows']), 'unavailable'),
        error_code: errorCode(os.error_code),
      },
      packet_monitor: {
        status: monitorStatus, system32_only: true, load_status: loadStatus, load_error_code: loadError,
        exports_present: exportsPresent, exports_missing: exportsMissing,
      },
    },
    capture: {
      status: choice(capture.status, captureStates), error_code: errorCode(capture.error_code),
      operation: operations.has(capture.operation) ? capture.operation : null,
      elevated: typeof capture.elevated === 'boolean' ? capture.elevated : null,
    },
  };
}

const labels = {
  tr: {
    title: 'Yakalama uyumluluğu', demo: 'DEMO · Örnek tanı verisi', native: 'Yerel uygulama', browser: 'Tarayıcı', unknown: 'Bilinmiyor',
    loading: 'Yerel uyumluluk bilgileri okunuyor…', empty: 'Henüz tanı raporu alınmadı. Yenile ile Windows ve API bilgilerini oku.',
    browserDetail: 'Windows bilgileri yalnız masaüstü uygulamasından okunabilir. Bu tarayıcı görünümü bilgisayarını incelemez.',
    demoDetail: 'Bu bilgiler örnektir; bilgisayarından ölçülmedi.', unavailable: 'Bilgi alınamadı', os: 'İşletim sistemi', build: 'Build', architecture: 'Sistem mimarisi', process: 'Uygulama mimarisi',
    source: 'Sürüm kaynağı', api: 'Packet Monitor API', available: 'Gerekli API işlevleri mevcut', missingApi: 'Gerekli API mevcut değil', permission: 'Yetki gerekli', apiError: 'API incelemesi tamamlanamadı', unsupported: 'Bu platformda kullanılamıyor',
    dll: 'Sistem DLL incelemesi', loaded: 'Yüklendi', failed: 'Yüklenemedi', missing: 'Eksik işlevler', present: 'Bulunan işlevler', loadError: 'DLL hata kodu', osError: 'Windows sürüm hata kodu',
    status: 'Canlı yakalama durumu', operation: 'Hata aşaması', error: 'Yakalama hata kodu', elevated: 'Yönetici yetkisi', yes: 'Var', no: 'Yok',
    refresh: 'Yenile', copy: 'Tanıyı kopyala', save: 'Tanıyı kaydet',
    privacy: 'Bu yerel rapor ad, IP adresi, dosya yolu, paket içeriği veya ses içermez. Otomatik gönderilmez; paylaşmayı sen seçersin.',
    inspection: 'Bu kontrol yakalamayı başlatmaz. API işlevlerinin bulunması canlı yakalamanın çalıştığını doğrulamaz.',
    mode: 'Çalışma biçimi', version: 'Uygulama sürümü', diagnostic: 'Yalnız tanı', captureStarted: 'Bu kontrol yakalama başlattı',
  },
  en: {
    title: 'Capture compatibility', demo: 'DEMO · Example diagnostic data', native: 'Desktop app', browser: 'Browser', unknown: 'Unknown',
    loading: 'Reading local compatibility information…', empty: 'No diagnostic report received yet. Refresh to read Windows and API information.',
    browserDetail: 'Windows information can only be read by the desktop app. This browser view does not inspect your computer.',
    demoDetail: 'These are examples, not measurements from your computer.', unavailable: 'Information unavailable', os: 'Operating system', build: 'Build', architecture: 'System architecture', process: 'App architecture',
    source: 'Version source', api: 'Packet Monitor API', available: 'Required API exports are present', missingApi: 'Required API is unavailable', permission: 'Permission required', apiError: 'API inspection did not complete', unsupported: 'Unavailable on this platform',
    dll: 'System DLL inspection', loaded: 'Loaded', failed: 'Could not load', missing: 'Missing exports', present: 'Present exports', loadError: 'DLL error code', osError: 'Windows version error code',
    status: 'Live capture status', operation: 'Failure stage', error: 'Capture error code', elevated: 'Administrator permission', yes: 'Granted', no: 'Not granted',
    refresh: 'Refresh', copy: 'Copy diagnostics', save: 'Save diagnostics',
    privacy: 'This local report contains no names, IP addresses, file paths, packet contents or audio. It is not sent automatically; you choose whether to share it.',
    inspection: 'This check does not start capture. Finding API exports does not verify that live capture works.',
    mode: 'Mode', version: 'App version', diagnostic: 'Diagnostics only', captureStarted: 'This check started capture',
  },
};

const textFor = locale => labels[locale === 'en' ? 'en' : 'tr'];
const display = (value, text) => value === null || value === undefined || value === 'unknown' ? text.unknown : String(value);
function monitorLabel(status, text) {
  return ({ 'exports-available': text.available, 'api-unavailable': text.missingApi, 'permission-required': text.permission, error: text.apiError, unsupported: text.unsupported })[status] || text.unknown;
}
function diagnosticRows(report, text) {
  const { os, packet_monitor: monitor } = report.compatibility;
  const build = os.build === null ? text.unknown : `${os.build}${os.ubr === null ? '' : `.${os.ubr}`}`;
  return [
    [text.os, os.label || text.unavailable], [text.build, build], [text.architecture, display(os.architecture, text)],
    [text.process, display(os.process_architecture, text)], [text.source, display(os.version_source, text)],
    [text.api, monitorLabel(monitor.status, text)], [text.dll, ({ loaded: text.loaded, failed: text.failed, 'not-windows': text.unsupported })[monitor.load_status] || text.unknown],
    [text.loadError, monitor.load_error_code === null ? '—' : `win32:${monitor.load_error_code}`], [text.osError, os.error_code || '—'],
    [text.status, display(report.capture.status, text)], [text.operation, report.capture.operation || '—'], [text.error, report.capture.error_code || '—'],
    [text.elevated, report.capture.elevated === null ? text.unknown : report.capture.elevated ? text.yes : text.no],
  ];
}

export function captureDiagnosticText(value, { locale = 'tr', format = 'json', mode } = {}) {
  const report = normalizeCaptureDiagnostics(value, { mode });
  if (!report) return '';
  if (format !== 'text' && format !== 'readable') return JSON.stringify(report, null, 2);
  const text = textFor(locale), monitor = report.compatibility.packet_monitor;
  const modeText = report.mode === 'demo' ? text.demo : report.mode === 'native' ? text.native : report.mode === 'browser' ? text.browser : text.unknown;
  return [text.title, `${text.mode}: ${modeText}`, `${text.version}: ${report.app_version}`,
    `${text.diagnostic}: true`, `${text.captureStarted}: false`,
    ...diagnosticRows(report, text).map(([name, detail]) => `${name}: ${detail}`),
    `${text.present}: ${monitor.exports_present.join(', ') || '—'}`, `${text.missing}: ${monitor.exports_missing.join(', ') || '—'}`,
    text.inspection, text.privacy].join('\n');
}

export function renderCaptureDiagnostics(value, { locale = 'tr', native = false, busy = false, mode } = {}) {
  const text = textFor(locale), report = normalizeCaptureDiagnostics(value, { mode });
  const actualMode = report?.mode === 'demo' || mode === 'demo' ? 'demo' : !native || mode === 'browser' || report?.mode === 'browser' ? 'browser' : 'native';
  const visible = actualMode === 'browser' ? null : report;
  const enabled = native && actualMode === 'native';
  const exportable = Boolean(visible) && !busy;
  const content = visible ? `<dl class="capture-diagnostics-grid">${diagnosticRows(visible, text).map(([name, detail]) => `<div><dt>${esc(name)}</dt><dd>${esc(detail)}</dd></div>`).join('')}</dl>${visible.compatibility.packet_monitor.exports_missing.length ? `<p class="quality-warning">${text.missing}: <code>${visible.compatibility.packet_monitor.exports_missing.map(esc).join(', ')}</code></p>` : ''}<details><summary>${text.present} · ${visible.compatibility.packet_monitor.exports_present.length}/${PACKET_MONITOR_EXPORTS.length}</summary><ul>${visible.compatibility.packet_monitor.exports_present.map(name => `<li><code>${esc(name)}</code></li>`).join('')}</ul></details><p class="help">${text.inspection}</p>` : `<p class="help" role="status">${actualMode === 'browser' ? text.browserDetail : busy ? text.loading : text.empty}</p>`;
  return `<section class="record-card capture-diagnostics" aria-busy="${Boolean(busy)}"><div class="record-top"><h3 class="section-title">${text.title}</h3>${actualMode === 'demo' ? `<strong class="tag">${text.demo}</strong>` : ''}</div>${actualMode === 'demo' ? `<p class="quality-warning">${text.demoDetail}</p>` : ''}${content}<div class="button-row"><button type="button" class="action-button secondary" data-action="refresh-capture-diagnostics" ${!enabled || busy ? 'disabled' : ''}>${text.refresh}</button><button type="button" class="action-button secondary" data-action="copy-capture-diagnostics" ${!exportable ? 'disabled' : ''}>${text.copy}</button><button type="button" class="action-button secondary" data-action="save-capture-diagnostics" ${!exportable ? 'disabled' : ''}>${text.save}</button></div><p class="help">${text.privacy}</p></section>`;
}
