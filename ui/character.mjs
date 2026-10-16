import { petProgress } from './telemetry.mjs';

const id = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : typeof value === 'string' && /^\d{1,20}$/.test(value) ? value : null;
const metric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const text = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').slice(0, 100) : '';
const list = (value, limit) => Array.isArray(value) ? value.slice(0, limit) : [];
const optionalList = (value, limit, normalize) => Array.isArray(value) ? value.slice(0, limit).map(normalize) : null;
const integer = (value, minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
const receivedSource = value => ['server-self', 'server-self-unbound', 'imported'].includes(value) ? value : null;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function characterCollections(value = {}, { strict = false } = {}) {
  value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fail = label => { if (strict) throw new Error(`Invalid build ${label}`); return null; };
  const at = input => integer(input, 0, Number.MAX_SAFE_INTEGER);
  let combat_power = null, wing = null, species = [], species_observed_at_ms = null;
  if (value.combat_power !== null && value.combat_power !== undefined) {
    const row = value.combat_power;
    if (!row || typeof row !== 'object' || Array.isArray(row) || integer(row.current, 1, 100000000) === null || integer(row.highest, 1, 100000000) === null || at(row.observed_at_ms) === null || !receivedSource(row.source)) fail('combat power');
    else combat_power = { current: row.current, highest: row.highest, observed_at_ms: row.observed_at_ms, source: row.source };
  }
  if (value.wing !== null && value.wing !== undefined) {
    const row = value.wing;
    if (!row || typeof row !== 'object' || Array.isArray(row) || integer(row.wing_id, 30000000, 30599999) === null || integer(row.wing_id, 30400000, 30499999) !== null || row.skin_id !== null && row.skin_id !== undefined && integer(row.skin_id, 30400000, 30499999) === null || at(row.observed_at_ms) === null || !receivedSource(row.source)) fail('wing');
    else wing = { wing_id: row.wing_id, skin_id: row.skin_id ?? null, observed_at_ms: row.observed_at_ms, source: row.source };
  }
  if (value.species !== undefined && (!Array.isArray(value.species) || value.species.length > 0)) {
    const valid = Array.isArray(value.species) && value.species.length === 5 && at(value.species_observed_at_ms) !== null && value.species.every((row, index) => row && typeof row === 'object' && !Array.isArray(row) && row.species_id === index + 2 && integer(row.level, 1, 99) !== null && integer(row.progress, 0, Number.MAX_SAFE_INTEGER) !== null && Array.isArray(row.effects) && row.effects.length <= 160 && row.effects.every(effect => effect && typeof effect === 'object' && !Array.isArray(effect) && integer(effect.page, 1, 5) !== null && integer(effect.slot, 0, 31) !== null && integer(effect.kind, 0, 255) !== null && integer(effect.stat_id, 1, 65535) !== null && integer(effect.value, -1000000000000, 1000000000000) !== null) && new Set(row.effects.map(effect => `${effect.page}:${effect.slot}`)).size === row.effects.length);
    if (!valid) fail('species collection');
    else {
      species_observed_at_ms = value.species_observed_at_ms;
      species = value.species.map(row => ({ species_id: row.species_id, level: row.level, progress: row.progress, effects: row.effects.map(effect => ({ page: effect.page, slot: effect.slot, kind: effect.kind, stat_id: effect.stat_id, value: effect.value })) }));
    }
  }
  return { combat_power, wing, species, species_observed_at_ms };
}

function equipment(value = {}) {
  return { entry_index: metric(value.entry_index), slot: metric(value.slot), item_id: id(value.item_id), enchant: metric(value.enchant), godstone_id: id(value.godstone_id),
    stones: optionalList(value.stones, 12, stone => ({ stat_id: id(stone.stat_id), tier: metric(stone.tier) })),
    stats: optionalList(value.stats, 50, stat => ({ stat_id: id(stat.stat_id), value: metric(stat.value) })),
    skill_bonuses: optionalList(value.skill_bonuses, 50, skill => ({ skill_id: id(skill.skill_id), levels: metric(skill.levels) })),
  };
}

function build(value) {
  if (!value || typeof value !== 'object') return null;
  return { actor_id: id(value.actor_id), name: text(value.name), server_id: id(value.server_id), observed_at_ms: metric(value.observed_at_ms), equipment: list(value.equipment, 64).map(equipment), skills: list(value.skills, 500).map(skill => ({ skill_id: id(skill.skill_id), level: metric(skill.level), base_level: metric(skill.base_level) })), boards: list(value.boards, 32).map(board => ({ board_id: id(board.board_id), node_ids: list(board.node_ids, 500).map(id).filter(value => value !== null) })), equipment_observed_at_ms: metric(value.equipment_observed_at_ms), skills_observed_at_ms: metric(value.skills_observed_at_ms), boards_observed_at_ms: metric(value.boards_observed_at_ms), equipment_complete: value.equipment_complete === true, skills_complete: value.skills_complete === true, source: receivedSource(value.source) ?? 'unspecified', ...characterCollections(value) };
}

export function renderCharacterCollections(value, { locale = 'tr' } = {}) {
  if (!value || typeof value !== 'object') return '';
  const data = characterCollections(value), english = locale === 'en';
  if (!data.combat_power && !data.wing && !data.species.length) return '';
  const number = input => new Intl.NumberFormat(english ? 'en' : 'tr', { maximumFractionDigits: 0 }).format(input);
  const bound = id(value.actor_id) !== null;
  const imported = value.source === 'imported' || data.combat_power?.source === 'imported' || data.wing?.source === 'imported';
  const status = imported ? (english ? 'Imported · unverified' : 'İçe aktarılmış · doğrulanmamış') : bound ? (english ? 'Received from game' : 'Oyundan alındı') : (english ? 'Waiting for self identity' : 'Karakter kimliği bekleniyor');
  return `<section class="record-card character-collections"><div class="record-top"><strong>${english ? 'Power & collections' : 'Güç ve koleksiyonlar'}</strong><span class="tag">${status}</span></div><div class="analysis-metrics">${data.combat_power ? `<div><span>${english ? 'Combat power' : 'Savaş gücü'}</span><strong>${number(data.combat_power.current)}</strong><small>${english ? 'Highest received' : 'Alınan en yüksek'} · ${number(data.combat_power.highest)}</small></div>` : ''}${data.wing ? `<div><span>${english ? 'Equipped wing' : 'Takılı kanat'}</span><strong>#${data.wing.wing_id}</strong><small>${english ? 'Skin' : 'Görünüm'} · ${data.wing.skin_id === null ? '—' : `#${data.wing.skin_id}`}</small></div>` : ''}</div>${data.species.length ? `<div class="skill-table">${data.species.map(row => `<details><summary>${english ? 'Genus' : 'Tür bilgisi'} #${row.species_id} · Lv.${row.level} · ${number(row.progress)}</summary><p class="help">${english ? 'Received progress. Completion threshold is unknown.' : 'Alınan ilerleme. Tamamlama eşiği bilinmiyor.'}</p>${row.effects.length ? `<ul>${row.effects.map(effect => `<li>${english ? 'Page' : 'Sayfa'} ${effect.page} · ${english ? 'Slot' : 'Yuva'} ${effect.slot + 1} · #${effect.stat_id}: ${escape(number(effect.value))}</li>`).join('')}</ul>` : `<p class="help">${english ? 'No received effect slots.' : 'Alınan etki yuvası yok.'}</p>`}</details>`).join('')}</div>` : ''}<p class="help">${english ? 'Equipped wing and received genus progress; no complete unlock or stat-effect catalog is inferred.' : 'Takılı kanat ve alınan tür ilerlemesi; tüm açılımlar veya stat etkileri tahmin edilmez.'}</p></section>`;
}

export function characterSnapshot(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return { own: build(value.own), unbound_own: build(value.unbound_own), inspected: list(value.inspected, 32).map(character => ({ ...build(character), name: text(character.name), class_code: metric(character.class_code), level: metric(character.level), gear_score: metric(character.gear_score) })), pet_progress: petProgress(value.pet_progress) };
}

export function fieldBossSnapshot(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return { maps: list(value.maps, 32).map(map => ({ map_id: id(map.map_id), observed_at_ms: metric(map.observed_at_ms), slots: list(map.slots, 64).filter(slot => slot.source === 'server-map').map(slot => ({ slot_id: id(slot.slot_id), alive: slot.alive === true, server_time_ms: metric(slot.server_time_ms), observed_at_ms: metric(slot.observed_at_ms), position: Array.isArray(slot.position) && slot.position.length === 3 && slot.position.every(Number.isFinite) ? [...slot.position] : null, source: 'server-map' })) })) };
}

export function fieldBossTimers(value, now = Date.now()) {
  return fieldBossSnapshot(value).maps.flatMap(map => map.slots.map(slot => ({ ...slot, map_id: map.map_id, key: `boss:${map.map_id}:${slot.slot_id}`, known: slot.alive || slot.server_time_ms !== null, status: slot.alive ? 'alive' : slot.server_time_ms === null ? 'unknown' : slot.server_time_ms > now ? 'countdown' : 'awaiting', remaining: !slot.alive && slot.server_time_ms !== null ? Math.max(0, slot.server_time_ms - now) : null })));
}

export function metadataEpoch(state, kind) {
  return kind === 'character' ? `${state?.local_player_id ?? ''}:${state?.character_revision ?? 0}` : `${state?.field_boss_revision ?? 0}:${state?.field_boss_available === true}`;
}
