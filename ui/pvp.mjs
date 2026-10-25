// The PvP session of the local player: kills and deaths, and what the last death looked like.
const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 9_999_999_999) : 0;
const text = (value, maximum = 48) => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum) || null : null;
const skill = value => Number.isSafeInteger(value) && value > 0 ? value : null;

export function normalizePvp(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const recap = input.last_death && typeof input.last_death === 'object' && !Array.isArray(input.last_death) ? input.last_death : null;
  return {
    kills: Math.min(count(input.kills), 99_999), deaths: Math.min(count(input.deaths), 99_999),
    // Null until the game's score has been matched to the local character.
    assists: Number.isSafeInteger(input.assists) && input.assists >= 0 ? Math.min(input.assists, 255) : null,
    last_death: recap ? {
      at_ms: count(recap.at_ms), killer_name: text(recap.killer_name), killer_player: recap.killer_player === true,
      skill_id: skill(recap.skill_id), npc_id: skill(recap.npc_id), npc_name: text(recap.npc_name), damage_taken: count(recap.damage_taken),
      top_skills: (Array.isArray(recap.top_skills) ? recap.top_skills : []).slice(0, 3).map(row => ({ skill_id: skill(row?.skill_id), damage: count(row?.damage), hits: count(row?.hits) })).filter(row => row.skill_id !== null && row.damage > 0),
    } : null,
  };
}

// The sentence and the figures of a death recap; `label` turns a skill id into its name.
export function deathRecap(recap, { locale = 'tr', label = id => `#${id}` } = {}) {
  if (!recap) return null;
  const tr = locale !== 'en';
  const who = recap.killer_name ?? recap.npc_name ?? (tr ? 'Bilinmeyen' : 'Unknown');
  const how = recap.skill_id === null ? '' : ` · ${label(recap.skill_id)}`;
  return {
    line: `${who}${how}`,
    kind: recap.killer_player ? (tr ? 'Oyuncu seni öldürdü' : 'A player killed you') : (tr ? 'Canavar seni öldürdü' : 'A monster killed you'),
    taken: recap.damage_taken, skills: recap.top_skills.map(row => ({ ...row, name: label(row.skill_id), share: recap.damage_taken ? row.damage / recap.damage_taken : 0 })),
  };
}
