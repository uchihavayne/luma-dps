import test from 'node:test';
import assert from 'node:assert/strict';
import { PACKET_MONITOR_EXPORTS, normalizeCaptureDiagnostics, captureDiagnosticText, renderCaptureDiagnostics } from '../capture-diagnostics.mjs';

const fixture = () => ({ type: 'luma-capture-diagnostics', schema_version: 1, app_version: '0.20.4',
  compatibility: { schema_version: 1, diagnostic_only: true, capture_started: false,
    os: { status: 'ready', label: 'Windows 10', architecture: 'x86_64', process_architecture: 'x86_64', major: 10, minor: 0, build: 19045, ubr: 6575, version_source: 'RtlGetVersion', error_code: null },
    packet_monitor: { status: 'exports-available', system32_only: true, load_status: 'loaded', load_error_code: null, exports_present: [...PACKET_MONITOR_EXPORTS], exports_missing: [] } },
  capture: { status: 'capturing', error_code: null, operation: null, elevated: true },
});

test('native compatibility survives strict field-by-field export without private state', () => {
  const input = fixture();
  input.name = 'PRIVATE-NAME'; input.history = [{ packet: 'PRIVATE-PACKET' }]; input.token = 'PRIVATE-TOKEN';
  input.compatibility.os.hostname = 'PRIVATE-HOST'; input.compatibility.packet_monitor.path = 'C:/PRIVATE-PATH';
  input.capture.detail = 'PRIVATE-IP 127.0.0.1'; input.capture.audio = 'PRIVATE-AUDIO';
  const report = normalizeCaptureDiagnostics(input, { mode: 'native' });
  assert.equal(report.mode, 'native');
  assert.equal(report.compatibility.os.build, 19045);
  assert.deepEqual(report.compatibility.packet_monitor.exports_present, [...PACKET_MONITOR_EXPORTS]);
  assert.equal(report.capture.status, 'capturing');
  assert.equal(JSON.stringify(report).includes('PRIVATE-'), false);
  assert.deepEqual(normalizeCaptureDiagnostics(report), report);
});

test('only the named envelope and read-only System32 capability contract are accepted', () => {
  for (const invalid of [null, [], 'report', {}, { ...fixture(), type: '<script>' }, { ...fixture(), schema_version: 2 }, fixture().compatibility]) {
    assert.equal(normalizeCaptureDiagnostics(invalid), null);
    assert.equal(captureDiagnosticText(invalid), '');
  }
  for (const [key, value] of [['diagnostic_only', false], ['capture_started', true], ['schema_version', '1']]) {
    const input = fixture(); input.compatibility[key] = value;
    assert.equal(normalizeCaptureDiagnostics(input), null);
  }
  const input = fixture(); input.compatibility.packet_monitor.system32_only = false;
  assert.equal(normalizeCaptureDiagnostics(input), null);
});

test('uint32 fields and error code namespaces reject coercion, overflow and free text', () => {
  for (const invalid of [-1, 0x100000000, NaN, Infinity, 1.5, '19045', true, {}, []]) {
    const input = fixture();
    for (const field of ['major', 'minor', 'build', 'ubr']) input.compatibility.os[field] = invalid;
    input.compatibility.packet_monitor.load_error_code = invalid;
    const report = normalizeCaptureDiagnostics(input);
    for (const field of ['major', 'minor', 'build', 'ubr']) assert.equal(report.compatibility.os[field], null);
    assert.equal(report.compatibility.packet_monitor.load_error_code, null);
  }
  const input = fixture(); input.compatibility.os.ubr = 0xffffffff; input.compatibility.packet_monitor.load_error_code = 0;
  input.compatibility.os.error_code = 'ntstatus:0xc0000001'; input.capture.error_code = 'win32:4294967295';
  let report = normalizeCaptureDiagnostics(input);
  assert.equal(report.compatibility.os.ubr, 0xffffffff); assert.equal(report.compatibility.packet_monitor.load_error_code, 0);
  assert.equal(report.compatibility.os.error_code, 'ntstatus:0xC0000001'); assert.equal(report.capture.error_code, 'win32:4294967295');
  for (const invalid of ['win32:4294967296', 'win32:-1', 'win32:5\nPRIVATE', '0x123', '0x80070005 PRIVATE', 'C:/PRIVATE', '<script>', 5]) {
    input.compatibility.os.error_code = invalid; input.capture.error_code = invalid;
    report = normalizeCaptureDiagnostics(input);
    assert.equal(report.compatibility.os.error_code, null); assert.equal(report.capture.error_code, null);
  }
  input.capture.error_code = '0x8007000a'; assert.equal(normalizeCaptureDiagnostics(input).capture.error_code, '0x8007000A');
  input.capture.error_code = 'stream-stopped'; assert.equal(normalizeCaptureDiagnostics(input).capture.error_code, 'stream-stopped');
});

test('symbols, enums and labels are allowlisted and contradictory availability is not promoted', () => {
  const input = fixture(); input.compatibility.os.label = '<img src=x>'; input.compatibility.os.architecture = 'PRIVATE-CPU';
  input.compatibility.os.version_source = 'PRIVATE-SOURCE'; input.capture.operation = '<script>';
  input.capture.status = 'PRIVATE-STATUS'; input.capture.elevated = 'true';
  input.compatibility.packet_monitor.exports_present = ['PRIVATE-EXPORT', ...PACKET_MONITOR_EXPORTS, PACKET_MONITOR_EXPORTS[0]];
  input.compatibility.packet_monitor.exports_missing = [PACKET_MONITOR_EXPORTS[0], '<script>'];
  const report = normalizeCaptureDiagnostics(input);
  assert.equal(report.compatibility.os.label, null); assert.equal(report.compatibility.os.architecture, 'unknown');
  assert.equal(report.compatibility.os.version_source, 'unavailable'); assert.equal(report.capture.operation, null);
  assert.equal(report.capture.status, 'unknown'); assert.equal(report.capture.elevated, null);
  assert.equal(report.compatibility.packet_monitor.status, 'unknown');
  assert.equal(report.compatibility.packet_monitor.exports_present.length, 10);
  assert.deepEqual(report.compatibility.packet_monitor.exports_missing, []);
  assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
  for (const operation of [...PACKET_MONITOR_EXPORTS, 'LoadLibraryExW', 'GetProcAddress']) {
    input.capture.operation = operation;
    assert.equal(normalizeCaptureDiagnostics(input).capture.operation, operation);
  }
  const all = fixture(); all.compatibility.packet_monitor.exports_present = [];
  assert.equal(normalizeCaptureDiagnostics(all).compatibility.packet_monitor.status, 'unknown');
});

test('missing exports and real failure stage/code are readable without claiming capture support', () => {
  const input = fixture();
  input.compatibility.packet_monitor.status = 'api-unavailable';
  input.compatibility.packet_monitor.exports_missing = ['PacketMonitorCreateLiveSession'];
  input.compatibility.packet_monitor.exports_present = PACKET_MONITOR_EXPORTS.filter(name => name !== 'PacketMonitorCreateLiveSession');
  input.capture.status = 'api-version-mismatch'; input.capture.error_code = '0x8007051A'; input.capture.operation = 'PacketMonitorInitialize';
  const html = renderCaptureDiagnostics(input, { native: true, mode: 'native', locale: 'tr' });
  assert.match(html, /Windows 10/); assert.match(html, /19045\.6575/); assert.match(html, /x86_64/);
  assert.match(html, /Eksik işlevler/); assert.match(html, /PacketMonitorCreateLiveSession/);
  assert.match(html, /PacketMonitorInitialize/); assert.match(html, /0x8007051A/); assert.match(html, /Yönetici yetkisi/);
  assert.match(html, /yakalamanın çalıştığını doğrulamaz/); assert.doesNotMatch(html, /Windows.*(?:yükselt|upgrade)/i);
  const en = captureDiagnosticText(input, { locale: 'en', mode: 'native', format: 'text' });
  assert.match(en, /Mode: Desktop app/); assert.match(en, /This check started capture: false/);
  assert.match(en, /Failure stage: PacketMonitorInitialize/); assert.match(en, /not sent automatically/);
  assert.match(captureDiagnosticText(input, { locale: 'tr', mode: 'native', format: 'readable' }), /Çalışma biçimi: Yerel uygulama/);
  assert.equal(JSON.parse(captureDiagnosticText(input, { mode: 'native' })).mode, 'native');
});

test('DLL failure does not invent missing exports or availability', () => {
  const input = fixture(); input.compatibility.packet_monitor = { status: 'api-unavailable', system32_only: true, load_status: 'failed', load_error_code: 126, exports_present: [], exports_missing: [] };
  const html = renderCaptureDiagnostics(input, { native: true, mode: 'native', locale: 'en' });
  assert.match(html, /Could not load/); assert.match(html, /win32:126/); assert.match(html, /Present exports · 0\/11/);
  assert.doesNotMatch(html, /Missing exports:|Required API exports are present/);
});

test('browser, native loading/unavailable and demo displays remain distinguishable', () => {
  const browser = renderCaptureDiagnostics(fixture(), { locale: 'en' });
  assert.match(browser, /browser view does not inspect/); assert.doesNotMatch(browser, /19045|Windows 10|x86_64/);
  assert.match(browser, /data-action="refresh-capture-diagnostics" disabled/);
  assert.match(browser, /data-action="copy-capture-diagnostics" disabled/);
  const loading = renderCaptureDiagnostics(null, { native: true, mode: 'native', busy: true, locale: 'en' });
  assert.match(loading, /Reading local compatibility/); assert.match(loading, /aria-busy="true"/);
  const empty = renderCaptureDiagnostics(null, { native: true, mode: 'native', locale: 'en' });
  assert.match(empty, /No diagnostic report received/); assert.doesNotMatch(empty, /19045|Windows 10/);
  const demo = fixture(); demo.mode = 'demo';
  const html = renderCaptureDiagnostics(demo, { native: true, mode: 'native', locale: 'en' });
  assert.match(html, /DEMO · Example diagnostic data/); assert.match(html, /not measurements from your computer/);
  assert.match(html, /19045/); assert.match(html, /data-action="refresh-capture-diagnostics" disabled/);
  assert.equal(normalizeCaptureDiagnostics(demo, { mode: 'native' }).mode, 'demo');
  assert.equal(JSON.parse(captureDiagnosticText(demo, { mode: 'native' })).mode, 'demo');
  assert.match(captureDiagnosticText(demo, { mode: 'native', locale: 'en', format: 'text' }), /Mode: DEMO/);
  assert.equal(normalizeCaptureDiagnostics(fixture()).mode, 'unknown');
});
