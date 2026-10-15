// Deterministic fixtures, used exclusively when the URL contains ?demo=1.
export const DEMO_STATE = Object.freeze({
  status: 'demo', elapsed_ms: 147000, total_damage: 2856000, dps: 19428.57, paused: false,
  local_player_id: 'demo-3', local_player_name: 'Mira', local_identity_source: 'manual', personal_total_damage: 594000, personal_dps: 4040.82, personal_elapsed_ms: 147000,
  personal_targets: [{ id: 'demo-target', name: 'Demo • Astral sentinel', is_boss: true, damage: 594000 }], party_member_ids: [], party_membership_source: 'unresolved',
  players: [
    { id: 'demo-1', name: 'Aster', class_name: 'Gladiator', damage: 1128000, dps: 7673.47, share: 0.395, skills: [{ id: 'd1', name: 'Demo • Crescent strike', hits: 42, damage: 588000, crit_hits: 15, min: 8200, max: 21800 }, { id: 'd2', name: 'Demo • Rising arc', hits: 31, damage: 330000, crit_hits: 12, min: 6500, max: 17200 }, { id: 'd3', name: 'Demo • Basic attack', hits: 60, damage: 210000, crit_hits: 9, min: 1800, max: 4900 }] },
    { id: 'demo-2', name: 'Nox', class_name: 'Sorcerer', damage: 921000, dps: 6265.31, share: 0.3225, skills: [{ id: 'd4', name: 'Demo • Starfall', hits: 28, damage: 921000, crit_hits: 11, min: 18000, max: 49000 }] },
    { id: 'demo-3', name: 'Mira', class_name: 'Ranger', is_local: true, damage: 594000, dps: 4040.82, share: 0.208, skills: [{ id: 'd5', name: 'Demo • Arrow volley', hits: 67, damage: 594000, crit_hits: 20, min: 4200, max: 14500 }] },
    { id: 'demo-4', name: 'Sol', class_name: 'Cleric', damage: 213000, dps: 1448.98, share: 0.0745, skills: [{ id: 'd6', name: 'Demo • Dawn spark', hits: 40, damage: 213000, crit_hits: 6, min: 2100, max: 7500 }] },
  ],
  targets: [{ id: 'demo-target', name: 'Demo • Astral sentinel', is_boss: true, damage: 2390000 }, { id: 'demo-add', name: 'Demo • Echo', is_boss: false, damage: 466000 }], history: [], cooldowns: [],
});

export const DEMO_PARTY_STATE = Object.freeze({
  ...DEMO_STATE,
  party_member_ids: ['demo-1', 'demo-3', 'demo-4'], party_membership_source: 'server',
  party_total_damage: 1935000, party_dps: 13163.2653, party_elapsed_ms: 147000,
  party_targets: [{ id: 'demo-target', name: 'Demo • Astral sentinel', is_boss: true, damage: 1935000 }],
  players: DEMO_STATE.players.map(player => ({ ...player, in_party: ['demo-1', 'demo-3', 'demo-4'].includes(player.id) })),
});
