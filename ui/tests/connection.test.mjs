import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionStatus, normalizeState, recentPetTarget } from '../model.mjs';

const status = value => connectionStatus(value, { native: true, locale: 'tr', now: 10000 });

test('successful native IPC alone never reports game traffic or combat', () => {
  assert.equal(status({ status: 'connected' }).kind, 'disconnected');
  assert.equal(status({ status: 'combat', total_damage: 100 }).kind, 'disconnected');
});

test('access denied produces the actionable localized instruction before raw detail', () => {
  const value = { status: 'waiting', capture: { status: 'error', detail: 'PacketMonitorInitialize failed (0x80070005)' } };
  const tr = status(value);
  assert.equal(tr.kind, 'permission'); assert.equal(tr.tone, 'error');
  assert.ok(tr.message.startsWith('Yönetici olarak yeniden açın.'));
  assert.ok(!tr.message.includes('PacketMonitorInitialize')); assert.ok(tr.detail.includes('0x80070005'));
  assert.ok(connectionStatus(value, { native: true, locale: 'en' }).message.startsWith('Reopen as administrator.'));
});

test('structured admin state works without parsing an English error', () => {
  assert.equal(status({ capture: { status: 'permission-required', admin: { required: true, elevated: false, status: 'required' } } }).kind, 'permission');
  assert.equal(status({ capture: { status: 'capturing', packets: 1, last_packet_at_ms: 9999, admin: { required: true, elevated: true, status: 'ready' } } }).kind, 'traffic');
  assert.equal(status({ capture: { status: 'error', admin: { required: true, elevated: false, status: 'unknown' } } }).kind, 'error');
});

test('legacy API-unavailable and capture failures take precedence over retained combat without blaming the Windows version', () => {
  const legacy = { status: 'combat', total_damage: 100, capture: { status: 'unsupported', error_code: 'win32:193' } };
  const tr = status(legacy), en = connectionStatus(legacy, { native: true, locale: 'en' });
  assert.equal(tr.kind, 'unsupported'); assert.equal(tr.label, 'Yakalama API’si kullanılamıyor');
  assert.equal(en.label, 'Capture API unavailable');
  assert.ok(!/güncelle|Windows sürüm|update Windows|Windows version/i.test(`${tr.message} ${en.message}`));
  assert.ok(tr.detail.includes('win32:193'));
  assert.equal(status({ status: 'paused', paused: true, capture: { status: 'error', detail: 'Initialization failed' } }).kind, 'error');
  assert.equal(status({ capture: { status: 'error', detail: 'Windows Packet Monitor streaming API unavailable' } }).kind, 'error');
});

test('explicit API failure statuses stay distinct and retain the underlying loader or operation error', () => {
  const cases = [
    ['api-unavailable', 'api_unavailable', 'win32:193'],
    ['api-version-mismatch', 'api_version_mismatch', '0x8007051A'],
    ['operation-not-supported', 'operation_not_supported', '0x80070032'],
  ];
  for (const [captureStatus, kind, code] of cases) {
    const input = { status: 'combat', paused: true, total_damage: 500, diagnostics: { stream_gaps: 2 }, capture: { status: captureStatus, error_code: code, detail: 'Native capture failed', game_connections: 0 } };
    for (const locale of ['tr', 'en']) {
      const result = connectionStatus(input, { native: true, locale });
      assert.equal(result.kind, kind); assert.equal(result.tone, 'error');
      assert.ok(result.detail.includes(code));
      assert.ok(!/Windows sürüm|Windows version|güncelle|update Windows/i.test(result.message));
    }
  }
});

test('generic and unknown capture errors cannot become an OS support claim from free text', () => {
  const details = ['Windows Packet Monitor streaming API unavailable', 'Unsupported network address family', 'Windows is unavailable', 'Access denied while reading network state'];
  for (const detail of details) assert.equal(status({ capture: { status: 'error', detail } }).kind, 'error');
  for (const error_code of ['win32:193', '193', '0x800700C1']) {
    const result = status({ capture: { status: 'error', error_code, detail: 'Windows unavailable; unsupported loader format; old text: 0x80070005' } });
    assert.equal(result.kind, 'error'); assert.ok(result.detail.includes(error_code));
  }
  for (const captureStatus of ['failed', 'server-failure', 'new-capture-state', 'unavailable']) assert.equal(status({ status: 'combat', total_damage: 500, capture: { status: captureStatus, game_connections: 0 } }).kind, 'error');
  assert.equal(status({ status: 'capture initialization failed' }).kind, 'error');
});

test('actual permission status, admin flags and error codes keep priority over loader diagnoses', () => {
  for (const captureStatus of ['api-unavailable', 'api-version-mismatch', 'operation-not-supported', 'unsupported', 'error']) {
    for (const error_code of ['win32:5', '0x80070005', '0x80070522', 'win32:1314', '0x800702E4', '740']) {
      const result = status({ capture: { status: captureStatus, error_code, detail: 'Loader unavailable, unsupported operation' } });
      assert.equal(result.kind, 'permission'); assert.ok(result.detail.includes(error_code));
    }
    assert.equal(status({ capture: { status: captureStatus, error_code: 'win32:193', admin: { required: true, elevated: false, status: 'required' } } }).kind, 'permission');
  }
});

test('API failures invalidate a recent pet target and do not revive it on recovery', () => {
  const live = normalizeState({ local_player_id: 7, local_identity_source: 'server', capture: { status: 'capturing' }, recent_personal_target: { actor_id: 7, target_id: 99, target_npc_id: 2100075, hit_at_ms: 1000, source: 'server-self-hit' } });
  const observed = recentPetTarget(null, live, 1000);
  assert.equal(observed.target.id, '99');
  for (const captureStatus of ['api-unavailable', 'api-version-mismatch', 'operation-not-supported']) {
    const stopped = recentPetTarget(observed, { ...live, capture: { status: captureStatus } }, 1500);
    assert.equal(stopped.target, null);
    assert.equal(recentPetTarget(stopped, live, 2000).target, null);
  }
});

test('game presence, packets and combat are separate factual states', () => {
  assert.equal(status({ capture: { status: 'waiting', game_connections: 0 } }).kind, 'waiting_game');
  assert.equal(status({ capture: { status: 'waiting', game_processes: 1, game_connections: 0 } }).kind, 'waiting_connection');
  assert.equal(status({ capture: { status: 'capturing', game_connections: 1, packets: 0 } }).kind, 'waiting_traffic');
  assert.equal(status({ status: 'traffic', capture: { status: 'capturing', game_connections: 1, packets: 12, last_packet_at_ms: 9999 } }).kind, 'traffic');
  assert.equal(status({ status: 'combat', capture: { status: 'capturing', game_connections: 1, packets: 12, last_packet_at_ms: 9999 } }).kind, 'combat');
  assert.equal(status({ status: 'combat', capture: { status: 'waiting', game_connections: 0, packets: 12 } }).kind, 'waiting_game');
});

test('cumulative counters or old timestamps never imply current game traffic', () => {
  assert.equal(status({ status: 'combat', capture: { status: 'capturing', game_connections: 1, packets: 200 } }).kind, 'waiting_traffic');
  assert.equal(status({ status: 'traffic', capture: { status: 'capturing', game_connections: 1, packets: 200, last_packet_at_ms: 4999 } }).kind, 'waiting_traffic');
  assert.equal(status({ status: 'traffic', capture: { status: 'capturing', game_connections: 1, packets: 200, last_packet_at_ms: 5000 } }).kind, 'traffic');
  assert.equal(status({ status: 'traffic', capture: { status: 'capturing', game_connections: 1, last_packet_at_ms: 11000 } }).kind, 'waiting_traffic');
});

test('active encounter metadata distinguishes combat from a retained record', () => {
  const capture = { status: 'capturing', game_connections: 1, last_packet_at_ms: 9999 };
  assert.equal(status({ capture, encounter_active: true, total_damage: 10 }).kind, 'combat_active');
  assert.equal(status({ capture, encounter_active: true, total_damage: 10 }).label, 'Savaş');
  assert.equal(status({ capture, encounter_active: false, total_damage: 10 }).kind, 'combat');
  assert.equal(status({ capture, encounter_active: false, total_damage: 10 }).label, 'Savaş verisi');
  for (const [captureStatus, kind] of [['permission-required', 'permission'], ['waiting', 'waiting_game'], ['unsupported', 'unsupported'], ['error', 'error']]) {
    assert.equal(status({ capture: { ...capture, status: captureStatus }, encounter_active: true, total_damage: 10 }).kind, kind);
  }
  assert.equal(status({ capture, encounter_active: true, total_damage: 10, diagnostics: { stream_gaps: 1 } }).kind, 'loss');
});

test('packet loss remains visible instead of presenting partial statistics as healthy', () => {
  assert.equal(status({ status: 'capture-gap', capture: { status: 'capturing' } }).kind, 'loss');
  assert.equal(status({ status: 'combat', capture: { status: 'capturing', missed_packets: 2 } }).tone, 'warning');
  assert.equal(status({ status: 'combat', capture: { status: 'capturing' }, diagnostics: { stream_gaps: 1 } }).kind, 'loss');
});

test('a previous loss never hides that the game or its connection is now absent', () => {
  const value = { status: 'capture-gap', diagnostics: { stream_gaps: 1 }, capture: { status: 'waiting', missed_packets: 2, game_connections: 0 } };
  assert.equal(status(value).kind, 'waiting_game');
  value.capture.game_processes = 1;
  assert.equal(status(value).kind, 'waiting_connection');
});

test('native disabled and starting states never imply connected capture', () => {
  assert.equal(status({ capture: { status: 'starting' } }).kind, 'starting');
  assert.equal(status({ capture: { status: 'disabled' } }).kind, 'disabled');
  assert.equal(status({ paused: true, capture: { status: 'capturing' } }).kind, 'paused');
});

test('demo is explicit and cannot replace native capture diagnostics', () => {
  assert.equal(connectionStatus({}, { native: false }).kind, 'browser');
  assert.equal(connectionStatus({}, { demo: true, native: false }).kind, 'demo');
  assert.equal(connectionStatus({ capture: { status: 'error' } }, { native: true, demo: true }).kind, 'error');
});

test('new capture metadata survives repeated state normalization without false defaults', () => {
  const value = { capture: { status: 'capturing', game_processes: 1, game_connections: 2, last_packet_at_ms: 42, error_code: '0x1', admin: { required: true, elevated: true, status: 'ready' } } };
  const result = normalizeState(normalizeState(value));
  assert.equal(result.capture.game_connections, 2); assert.equal(result.capture.last_packet_at_ms, 42);
  assert.equal(result.capture.game_processes, 1);
  assert.equal(result.capture.error_code, '0x1'); assert.equal(result.capture.admin.elevated, true);
  assert.equal(normalizeState({}).capture.game_connections, null);
});
