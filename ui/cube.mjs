export const CUBE_REFERENCE_MAX_BYTES = 8 * 1024 * 1024;
export const CUBE_MATCH_LIFETIME_MS = 3000;
export const CUBE_DIRECTION_LIFETIME_MS = 900;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const bounded = (value, minimum, maximum, fallback) => finite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
const text = (value, maximum = 240) => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').slice(0, maximum) : '';

// The desktop learns which spawned entity is the Cube from the audio match, then reports the
// nearest one it can see in the received game data. Distances are whole metres; the output keeps
// the input's field names so a stored state can be normalized again.
export function normalizeCubeNetwork(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const distance = Number.isSafeInteger(input.distance_m) && input.distance_m >= 0 && input.distance_m <= 500 ? input.distance_m : null;
  const phase = ['ready', 'near'].includes(input.phase) ? input.phase : 'learning';
  return {
    phase: phase === 'near' && distance === null ? 'ready' : phase,
    matches: Math.round(bounded(input.matches, 0, 10, 0)), needed: Math.round(bounded(input.needed, 1, 10, 3)),
    distance_m: distance, trend: ['approaching', 'receding', 'steady'].includes(input.trend) ? input.trend : 'unknown',
    facing: ['ahead', 'side', 'behind'].includes(input.facing) ? input.facing : 'unknown',
  };
}

export function normalizeCubeState(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const enabled = input.enabled === true;
  const status = enabled && ['waiting_game', 'listening', 'detected', 'error'].includes(input.status) ? input.status : input.status === 'error' ? 'error' : 'off';
  return {
    revision: Number.isSafeInteger(input.revision) && input.revision >= 0 ? input.revision : null,
    enabled, status, source: input.source === 'system' ? 'system' : 'game', message: text(input.message),
    reference: { name: text(input.reference?.name, 100), seconds: bounded(input.reference?.seconds, 0, 30, 0) },
    score: bounded(input.score, 0, 1, 0),
    analysis_window_ms: Math.round(bounded(input.analysis_window_ms, 0, 4096, 0)),
    direction: ['left', 'right', 'center'].includes(input.direction) ? input.direction : 'unknown',
    direction_confidence: bounded(input.direction_confidence, 0, 1, 0),
    pan: finite(input.pan) && input.pan >= -1 && input.pan <= 1 ? input.pan : null,
    steer_degrees: finite(input.steer_degrees) && input.steer_degrees >= -90 && input.steer_degrees <= 90 ? input.steer_degrees : null,
    // Stereo level differences cannot distinguish a front source from its rear mirror.
    bearing_ambiguous: true,
    snr_db: finite(input.snr_db) && input.snr_db >= -120 && input.snr_db <= 120 ? input.snr_db : null,
    signal_strength: finite(input.signal_strength) && input.signal_strength >= 0 && input.signal_strength <= 1 ? input.signal_strength : null,
    input_level_db: finite(input.input_level_db) && input.input_level_db >= -120 && input.input_level_db <= 0 ? input.input_level_db : null,
    audio_present: input.audio_present === true,
    received_audio_frames: Number.isSafeInteger(input.received_audio_frames) && input.received_audio_frames >= 0 ? input.received_audio_frames : 0,
    timestamp_uncertain_packets: Number.isSafeInteger(input.timestamp_uncertain_packets) && input.timestamp_uncertain_packets >= 0 ? input.timestamp_uncertain_packets : 0,
    stream_discontinuities: Number.isSafeInteger(input.stream_discontinuities) && input.stream_discontinuities >= 0 ? input.stream_discontinuities : 0,
    strength_db: finite(input.strength_db) && input.strength_db >= -160 && input.strength_db <= 40 ? input.strength_db : null,
    trend: ['approaching', 'receding', 'steady'].includes(input.trend) ? input.trend : 'unknown',
    last_detection_ms: finite(input.last_detection_ms) && input.last_detection_ms > 0 ? input.last_detection_ms : null,
    audio_channels: Math.round(bounded(input.audio_channels, 0, 32, 0)),
    sample_rate: Math.round(bounded(input.sample_rate, 0, 384000, 0)),
    network: normalizeCubeNetwork(input.network),
  };
}

export function acceptsCubeSnapshot(current, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming) || !Number.isSafeInteger(incoming.revision) || incoming.revision < 0) return false;
  return !Number.isSafeInteger(current?.revision) || incoming.revision > current.revision;
}

export function cubeDockVisible(presentation, preferences = {}) {
  return preferences.showCubeLocator !== false && (presentation?.matched === true || presentation?.network?.near === true);
}

export function cubePresentation(input, { now = Date.now(), locale = 'tr', live = true, readError = '' } = {}) {
  const state = normalizeCubeState(input);
  const tr = locale !== 'en';
  const age = state.last_detection_ms === null ? Infinity : now - state.last_detection_ms;
  const matched = !readError && state.enabled && state.status === 'detected' && Number.isFinite(age) && age >= -250 && age <= CUBE_MATCH_LIFETIME_MS;
  const side = state.steer_degrees !== null && (state.direction === 'left' && state.pan !== null && state.pan < -.04 && state.steer_degrees < 0 || state.direction === 'right' && state.pan !== null && state.pan > .04 && state.steer_degrees > 0);
  const directionFresh = matched && age <= CUBE_DIRECTION_LIFETIME_MS && state.analysis_window_ms < 1024;
  const directionFloor = ['left', 'right'].includes(state.direction) ? .35 : .6;
  const direction = directionFresh && state.audio_channels === 2 && state.direction_confidence >= directionFloor && (side || state.direction === 'center') ? state.direction : 'unknown';
  const status = readError ? 'error' : state.status === 'detected' && !matched ? 'listening' : state.status;
  const labels = tr
    ? { off: 'Dinleme kapalı', waiting_game: 'AION2 bekleniyor', listening: 'Küp sesi bekleniyor', detected: 'Küp sesi eşleşti', error: 'Ses bağlantısı yok' }
    : { off: 'Listening is off', waiting_game: 'Waiting for AION2', listening: 'Listening for Cube', detected: 'Cube sound matched', error: 'Audio unavailable' };
  const directions = tr
    ? { left: 'Sol ses ağırlıklı', right: 'Sağ ses ağırlıklı', center: 'Stereo dengeli · dönerek ara', unknown: 'Yön belirlenemedi · dönerek ara' }
    : { left: 'Left-weighted audio', right: 'Right-weighted audio', center: 'Stereo balanced · turn to locate', unknown: 'Direction unavailable · turn to locate' };
  const trends = tr
    ? { approaching: 'Sinyal güçleniyor', receding: 'Sinyal zayıflıyor', steady: 'Sinyal dengeli', unknown: 'Değişim için dinleniyor' }
    : { approaching: 'Signal getting stronger', receding: 'Signal getting weaker', steady: 'Signal steady', unknown: 'Listening for a change' };
  const prefix = tr ? 'Küp' : 'Cube';
  const net = state.network, netNear = !readError && net.phase === 'near';
  const trendWords = tr ? { approaching: 'yaklaşıyorsun', receding: 'uzaklaşıyorsun', steady: 'yan geçiyorsun' } : { approaching: 'getting closer', receding: 'moving away', steady: 'passing by' };
  const facingWords = tr ? { ahead: 'önünde', side: 'yanında', behind: 'arkanda' } : { ahead: 'ahead', side: 'to the side', behind: 'behind you' };
  const netParts = netNear ? [`${net.distance_m} m`, trendWords[net.trend], facingWords[net.facing]].filter(Boolean) : [];
  const netLabel = net.phase === 'learning'
    ? tr ? `Ağ eşleşmesi öğreniyor · ${net.matches}/${net.needed} ses eşleşmesi` : `Learning the network match · ${net.matches}/${net.needed} sound matches`
    : netNear ? tr ? `Küp ${net.distance_m} m yakında` : `Cube ${net.distance_m} m away`
    : tr ? 'Ağ eşleşmesi hazır · yakında Küp yok' : 'Network match ready · no Cube nearby';
  const quietInput = !readError && state.enabled && status === 'listening' && !state.audio_present && state.sample_rate > 0 && state.received_audio_frames >= state.sample_rate * 2;
  const short = matched ? `${{ left: '←', right: '→', center: '↔', unknown: '◇' }[direction]} ${prefix}` : `${prefix} · ${tr ? { off: 'kapalı', waiting_game: 'bekliyor', listening: 'ara', error: 'hata' }[status] : { off: 'off', waiting_game: 'wait', listening: 'listen', error: 'error' }[status]}`;
  return {
    network: { phase: net.phase, near: netNear, distance: netNear ? `${net.distance_m} m` : '—', summary: netParts.join(' · '), detail: netParts.slice(1).join(' · '), label: netLabel, nearLabel: tr ? 'Küp yakında' : 'Cube nearby' },
    status, matched, direction, label: labels[status], short, quietInput, sensitive: matched && state.analysis_window_ms >= 1024,
    // A stereo balance establishes a side, not a calibrated world bearing.
    // Balanced audio cannot prove that a Cube is in front of the player.
    steerDegrees: direction === 'left' ? -90 : direction === 'right' ? 90 : null,
    rearDegrees: null,
    bearingAmbiguous: state.bearing_ambiguous,
    signalStrength: matched ? state.signal_strength : null,
    relativeStrength: matched && state.signal_strength !== null ? `${Math.round(state.signal_strength * 100)}%` : '—',
    snr: matched && state.snr_db !== null ? `${state.snr_db.toFixed(1)} dB` : '—',
    detail: readError || state.message,
    directionLabel: matched ? directions[direction] : '—',
    similarity: matched ? `${Math.round(state.score * 100)}%` : '—',
    strength: matched && state.strength_db !== null ? `${state.strength_db.toFixed(1)} dBFS` : '—',
    trend: matched ? state.trend : 'unknown', trendLabel: matched ? trends[state.trend] : '—',
    sourceLabel: !live ? tr ? 'ARAYÜZ ÖRNEĞİ · CANLI DEĞİL' : 'UI SAMPLE · NOT LIVE' : state.source === 'system' ? tr ? 'SİSTEM ÇIKIŞI' : 'SYSTEM OUTPUT' : 'AION2',
  };
}

export async function cubeReferenceBase64(file) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0 || file.size > CUBE_REFERENCE_MAX_BYTES) throw new Error('reference_size');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > CUBE_REFERENCE_MAX_BYTES) throw new Error('reference_size');
  const chunks = [];
  for (let index = 0; index < bytes.length; index += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(index, index + 0x8000)));
  return btoa(chunks.join(''));
}
