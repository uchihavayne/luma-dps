const id = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : typeof value === 'string' && /^\d{1,20}$/.test(value) ? value : null;
const metric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const text = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').slice(0, 100) : '';
const list = (value, limit) => Array.isArray(value) ? value.slice(0, limit) : [];
const optionalList = (value, limit, normalize) => Array.isArray(value) ? value.slice(0, limit).map(normalize) : null;

function equipment(value = {}) {
  return { entry_index: metric(value.entry_index), slot: metric(value.slot), item_id: id(value.item_id), enchant: metric(value.enchant), godstone_id: id(value.godstone_id),
    stones: optionalList(value.stones, 12, stone => ({ stat_id: id(stone.stat_id), tier: metric(stone.tier) })),
    stats: optionalList(value.stats, 50, stat => ({ stat_id: id(stat.stat_id), value: metric(stat.value) })),
    skill_bonuses: optionalList(value.skill_bonuses, 50, skill => ({ skill_id: id(skill.skill_id), levels: metric(skill.levels) })),
  };
}

function build(value) {
  if (!value || typeof value !== 'object') return null;
  return { actor_id: id(value.actor_id), name: text(value.name), server_id: id(value.server_id), observed_at_ms: metric(value.observed_at_ms), equipment: list(value.equipment, 64).map(equipment), skills: list(value.skills, 500).map(skill => ({ skill_id: id(skill.skill_id), level: metric(skill.level), base_level: metric(skill.base_level) })), boards: list(value.boards, 32).map(board => ({ board_id: id(board.board_id), node_ids: list(board.node_ids, 500).map(id).filter(value => value !== null) })), equipment_observed_at_ms: metric(value.equipment_observed_at_ms), skills_observed_at_ms: metric(value.skills_observed_at_ms), boards_observed_at_ms: metric(value.boards_observed_at_ms), equipment_complete: value.equipment_complete === true, skills_complete: value.skills_complete === true };
}

export function characterSnapshot(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return { own: build(value.own), unbound_own: build(value.unbound_own), inspected: list(value.inspected, 32).map(character => ({ ...build(character), name: text(character.name), class_code: metric(character.class_code), level: metric(character.level), gear_score: metric(character.gear_score) })) };
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
