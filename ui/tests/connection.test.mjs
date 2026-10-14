import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionStatus, normalizeState } from '../model.mjs';

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

test('unsupported Windows and capture failures take precedence over retained combat', () => {
  assert.equal(status({ status: 'combat', total_damage: 100, capture: { status: 'unsupported' } }).kind, 'unsupported');
  assert.equal(status({ status: 'paused', paused: true, capture: { status: 'error', detail: 'Initialization failed' } }).kind, 'error');
  assert.equal(status({ capture: { status: 'error', detail: 'Windows Packet Monitor streaming API unavailable' } }).kind, 'unsupported');
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
