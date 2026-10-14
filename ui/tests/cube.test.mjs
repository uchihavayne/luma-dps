import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCubeState, acceptsCubeSnapshot, cubePresentation, cubeReferenceBase64, CUBE_REFERENCE_MAX_BYTES, CUBE_MATCH_LIFETIME_MS } from '../cube.mjs';
import { normalizePreferences, exportTheme, importTheme } from '../model.mjs';

const now = 1791939600000;
const match = overrides => ({ revision: 10, enabled: true, status: 'detected', source: 'game', reference: { name: 'Hidden Cube', seconds: 8 }, score: .938, direction: 'left', direction_confidence: .9, strength_db: -31.5, trend: 'approaching', last_detection_ms: now - 400, audio_channels: 2, sample_rate: 48000, ...overrides });

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
