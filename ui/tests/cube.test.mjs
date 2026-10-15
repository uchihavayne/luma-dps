import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCubeState, acceptsCubeSnapshot, cubePresentation, cubeReferenceBase64, CUBE_REFERENCE_MAX_BYTES, CUBE_MATCH_LIFETIME_MS } from '../cube.mjs';
import { normalizePreferences, exportTheme, importTheme } from '../model.mjs';

const now = 1791939600000;
const match = overrides => ({ revision: 10, enabled: true, status: 'detected', source: 'game', reference: { name: 'Hidden Cube', seconds: 8 }, score: .938, direction: 'left', direction_confidence: .9, pan: -.5, steer_degrees: -30, bearing_ambiguous: true, signal_strength: .64, snr_db: 17.35, strength_db: -31.5, trend: 'approaching', last_detection_ms: now - 400, audio_channels: 2, sample_rate: 48000, ...overrides });

test('a fresh installation exposes the Cube control and keeps live listening out of persisted settings', () => {
  const preferences = normalizePreferences({ cubeEnabled: true, enabled: true });
  assert.equal(preferences.showCubeLocator, true); assert.equal(preferences.cubeSource, 'game'); assert.equal(preferences.cubeThreshold, .82);
  assert.ok(!('cubeEnabled' in preferences)); assert.ok(!('enabled' in preferences));
  assert.equal(normalizeCubeState().enabled, false); assert.equal(normalizeCubeState().status, 'off');
  assert.equal(cubePresentation({}, { now }).similarity, '—');
});

test('Cube settings are bounded and theme import cannot enable output capture or change a reference', () => {
  const preferences = normalizePreferences({ showCubeLocator: false, cubeSource: 'microphone', cubeThreshold: 2 });
  assert.equal(preferences.showCubeLocator, false); assert.equal(preferences.cubeSource, 'game'); assert.equal(preferences.cubeThreshold, .97);
  assert.equal(normalizePreferences({ cubeThreshold: -.8 }).cubeThreshold, .6);
  const restored = importTheme(exportTheme({ cubeSource: 'system', cubeThreshold: .6, showCubeLocator: false }));
  assert.ok(!('cubeSource' in restored)); assert.ok(!('cubeThreshold' in restored)); assert.ok(!('showCubeLocator' in restored));
});

test('ordered snapshots reject a stale poll after a newer live frame, including a stopped session', () => {
  assert.equal(acceptsCubeSnapshot(normalizeCubeState(), { revision: 0 }), true);
  assert.equal(acceptsCubeSnapshot({ revision: 12 }, match({ revision: 11 })), false);
  assert.equal(acceptsCubeSnapshot({ revision: 12 }, match({ revision: 12 })), false);
  assert.equal(acceptsCubeSnapshot({ revision: 12 }, { revision: 13, enabled: false, status: 'off' }), true);
  for (const value of [null, [], { revision: -1 }, { revision: '13' }, { revision: Infinity }, {}]) assert.equal(acceptsCubeSnapshot({ revision: 12 }, value), false);
});

test('a current stereo match displays received direction, relative level and similarity without metric distance', () => {
  const view = cubePresentation(match(), { now, locale: 'en' });
  assert.equal(view.matched, true); assert.equal(view.direction, 'left'); assert.equal(view.short, '← Cube');
  assert.equal(view.similarity, '94%'); assert.equal(view.strength, '-31.5 dBFS'); assert.equal(view.trendLabel, 'Signal getting stronger');
  assert.ok(!('distance' in view)); assert.ok(!('bearing' in view)); assert.ok(!('probability' in view));
  assert.equal(cubePresentation(match({ direction: 'right' }), { now }).short, '→ Küp');
});

test('mono, low confidence, balanced and invalid bearings avoid invented front/back direction', () => {
  for (const overrides of [{ audio_channels: 1 }, { audio_channels: 6 }, { direction_confidence: .11 }, { direction: 'front' }, { direction: 'back' }]) {
    const view = cubePresentation(match(overrides), { now });
    assert.equal(view.direction, 'unknown'); assert.match(view.directionLabel, /dönerek/); assert.equal(view.matched, true);
  }
  const balanced = cubePresentation(match({ direction: 'center' }), { now, locale: 'en' });
  assert.equal(balanced.direction, 'center'); assert.equal(balanced.directionLabel, 'Stereo balanced · turn to locate');
});

test('moderate stereo cues survive similarity-weighted pan while weak cues stay unknown', () => {
  for (const direction of ['left', 'right']) {
    const moderate = cubePresentation(match({ direction, direction_confidence: .35 }), { now, locale: 'en' });
    assert.equal(moderate.direction, direction);
    assert.equal(moderate.directionLabel, direction === 'left' ? 'Left-weighted audio' : 'Right-weighted audio');
    const lowThreshold = normalizePreferences({ cubeThreshold: .6 }).cubeThreshold;
    const legal = cubePresentation(match({ direction, score: lowThreshold, direction_confidence: .133 }), { now });
    assert.equal(legal.direction, direction);
    assert.equal(legal.directionLabel, direction === 'left' ? 'Sol ses ağırlıklı' : 'Sağ ses ağırlıklı');
    assert.equal(cubePresentation(match({ direction, direction_confidence: .12 }), { now }).direction, direction);
    assert.equal(cubePresentation(match({ direction, direction_confidence: .119 }), { now }).direction, 'unknown');
  }
  assert.equal(cubePresentation(match({ direction: 'center', direction_confidence: .6 }), { now }).direction, 'center');
  assert.equal(cubePresentation(match({ direction: 'center', direction_confidence: .599 }), { now }).direction, 'unknown');
});

test('stale, future, stopped and failed matches immediately clear direction and relative measurements', () => {
  for (const input of [match({ last_detection_ms: now - CUBE_MATCH_LIFETIME_MS - 1 }), match({ last_detection_ms: now + 1000 }), match({ last_detection_ms: null }), match({ enabled: false }), match({ status: 'waiting_game' }), match({ status: 'error' })]) {
    const view = cubePresentation(input, { now });
    assert.equal(view.matched, false); assert.equal(view.direction, 'unknown'); assert.equal(view.similarity, '—'); assert.equal(view.strength, '—'); assert.equal(view.trendLabel, '—');
    assert.equal(view.steerDegrees, null); assert.equal(view.rearDegrees, null); assert.equal(view.signalStrength, null); assert.equal(view.relativeStrength, '—'); assert.equal(view.snr, '—');
  }
  assert.equal(cubePresentation(match({ last_detection_ms: now - CUBE_MATCH_LIFETIME_MS - 1 }), { now }).status, 'listening');
});

test('transport errors clear match cues and browser samples are explicitly distinguished from live game audio', () => {
  const failed = cubePresentation(match(), { now, readError: 'Audio state unavailable' });
  assert.equal(failed.status, 'error'); assert.equal(failed.matched, false); assert.equal(failed.detail, 'Audio state unavailable');
  const preview = cubePresentation(match({ source: 'system' }), { now, locale: 'en', live: false });
  assert.equal(preview.sourceLabel, 'UI SAMPLE · NOT LIVE');
  assert.equal(cubePresentation(match({ source: 'system' }), { now, locale: 'en' }).sourceLabel, 'SYSTEM OUTPUT');
});

test('malformed native data is bounded, sanitized and never converted into a location', () => {
  const state = normalizeCubeState(match({ score: Infinity, direction_confidence: 400, strength_db: NaN, reference: { name: 'a\u0000b', seconds: 999 }, message: 'x\n'.repeat(500), audio_channels: -2, sample_rate: -1, distance: 4 }));
  assert.equal(state.score, 0); assert.equal(state.direction_confidence, 1); assert.equal(state.strength_db, null);
  assert.equal(state.reference.name, 'ab'); assert.equal(state.reference.seconds, 30); assert.equal(state.message.length, 240);
  assert.equal(state.audio_channels, 0); assert.equal(state.sample_rate, 0); assert.ok(!('distance' in state));
});

test('bounded reference conversion preserves binary audio and rejects oversized data before reading it', async () => {
  const bytes = Uint8Array.from([0, 128, 255, 1, 32, 65]);
  assert.equal(await cubeReferenceBase64(new Blob([bytes], { type: 'audio/wav' })), Buffer.from(bytes).toString('base64'));
  let reads = 0;
  await assert.rejects(cubeReferenceBase64({ size: CUBE_REFERENCE_MAX_BYTES + 1, arrayBuffer() { reads++; return new ArrayBuffer(0); } }), /reference_size/);
  await assert.rejects(cubeReferenceBase64(new Blob([])), /reference_size/);
  assert.equal(reads, 0);
  await assert.rejects(cubeReferenceBase64({ size: 3, async arrayBuffer() { return new ArrayBuffer(2); } }), /reference_size/);
});

test('continuous audio steering preserves side and shows the equally possible rear mirror', () => {
  for (const [pan, steer, direction, rear] of [[-1, -90, 'left', 270], [-.5, -30, 'left', 210], [0, 0, 'center', 180], [.5, 30, 'right', 150], [1, 90, 'right', 90]]) {
    const state = normalizeCubeState(match({ pan, steer_degrees: steer, direction }));
    const view = cubePresentation(state, { now });
    assert.equal(state.pan, pan); assert.equal(view.steerDegrees, steer); assert.equal(view.rearDegrees, rear); assert.equal(view.bearingAmbiguous, true);
  }
  assert.equal(cubePresentation(match({ bearing_ambiguous: false }), { now }).bearingAmbiguous, true);
  const view = cubePresentation(match(), { now });
  assert.equal(view.relativeStrength, '64%'); assert.equal(view.snr, '17.4 dB');
});

test('invalid steering and relative signal values remain unknown instead of becoming a compass bearing', () => {
  for (const value of [-Infinity, Infinity, NaN, -1.01, 1.01, '0', null]) assert.equal(normalizeCubeState({ pan: value }).pan, null);
  for (const value of [-Infinity, Infinity, NaN, -90.01, 90.01, '30', null]) {
    const view = cubePresentation(match({ steer_degrees: value }), { now });
    assert.equal(view.steerDegrees, null); assert.equal(view.rearDegrees, null);
  }
  for (const value of [-1, 1.01, NaN, Infinity, '0.5', null]) assert.equal(normalizeCubeState({ signal_strength: value }).signal_strength, null);
  for (const value of [-121, 121, NaN, Infinity, '12', null]) assert.equal(normalizeCubeState({ snr_db: value }).snr_db, null);
  for (const override of [{ audio_channels: 1 }, { audio_channels: 6 }, { direction: 'unknown' }, { direction_confidence: .119 }]) {
    const view = cubePresentation(match(override), { now });
    assert.equal(view.steerDegrees, null); assert.equal(view.rearDegrees, null);
  }
});

test('navigator preferences restore a chosen layout without starting an audio session', () => {
  assert.equal(normalizePreferences().cubeView, 'dps'); assert.equal(normalizePreferences().cubeNavigatorSize, 'compact');
  const restored = normalizePreferences({ cubeView: 'navigator', cubeNavigatorSize: 'full', cubeEnabled: true });
  assert.equal(restored.cubeView, 'navigator'); assert.equal(restored.cubeNavigatorSize, 'full'); assert.ok(!('cubeEnabled' in restored));
  assert.equal(normalizePreferences({ cubeView: 'navigator', showCubeLocator: false }).cubeView, 'dps');
  const invalid = normalizePreferences({ cubeView: 'radar', cubeNavigatorSize: 'huge' });
  assert.equal(invalid.cubeView, 'dps'); assert.equal(invalid.cubeNavigatorSize, 'compact');
  const theme = importTheme(exportTheme(restored));
  assert.ok(!('cubeView' in theme)); assert.ok(!('cubeNavigatorSize' in theme));
});

test('quiet audio diagnostics require received frames and never become a Cube match', () => {
  const listening = { enabled: true, status: 'listening', sample_rate: 48000, received_audio_frames: 96000, audio_present: false, input_level_db: -108 };
  const quiet = cubePresentation(listening, { now });
  assert.equal(quiet.quietInput, true); assert.equal(quiet.matched, false); assert.equal(quiet.steerDegrees, null); assert.equal(quiet.relativeStrength, '—');
  for (const override of [{ received_audio_frames: 95999 }, { sample_rate: 0 }, { audio_present: true }, { enabled: false }, { status: 'waiting_game' }, { status: 'error' }]) assert.equal(cubePresentation({ ...listening, ...override }, { now }).quietInput, false);
  assert.equal(cubePresentation(listening, { now, readError: 'offline' }).quietInput, false);
  assert.equal(cubePresentation(match({ ...listening, status: 'detected' }), { now }).quietInput, false);
  const state = normalizeCubeState({ input_level_db: -121, received_audio_frames: -1, stream_discontinuities: NaN, timestamp_uncertain_packets: '9', audio_present: 1 });
  assert.equal(state.input_level_db, null); assert.equal(state.received_audio_frames, 0); assert.equal(state.stream_discontinuities, 0); assert.equal(state.timestamp_uncertain_packets, 0); assert.equal(state.audio_present, false);
});
