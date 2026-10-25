// Deterministic fixtures, used exclusively when the URL contains ?demo=1.
export const DEMO_STATE = Object.freeze({
  status: 'demo', elapsed_ms: 147000, total_damage: 2856000, dps: 19428.57, paused: false,
  combat: { source: 'game', tail_ms: 10000, game_in_combat: true },
  frenzy: { target_id: 'demo-target', target_name: 'Demo • Astral sentinel', at_ms: Date.now() + 95000 },
  own_health: { hp: 6200, max_hp: 10000, observed_at_ms: 1 },
  party: [
    { id: 3, name: 'Mira', hp: 6200, hp_max: 10000, is_self: true, observed_at_ms: 1 }, { id: 1, name: 'Aster', hp: 9000, hp_max: 9000, observed_at_ms: 1 },
    { id: 2, name: 'Nox', hp: 2100, hp_max: 7000, observed_at_ms: 1 }, { id: 4, name: 'Sol', hp: 4800, hp_max: 5200, observed_at_ms: 1 },
  ],
  tracker: { kills_total: 14, kills: [{ model: 2100066, name: 'Demo • Krall soldier', count: 9 }, { model: 2400251, name: null, count: 5 }], gathered: [{ item: 531900003, count: 12 }, { item: 210460018, count: 3 }] },
  resources: { actor_id: 3, awaiting_identity: false, source: 'server-contents-ticket', snapshot_complete: true, observed_at_ms: Date.now(), tickets: [
    { ticket_id: 60000001, count: 420, bonus: 80, time_left_ms: 1800000, observed_at_ms: Date.now() }, { ticket_id: 1, count: 9, bonus: 5, time_left_ms: 0, observed_at_ms: Date.now() },
    { ticket_id: 4, count: 4, bonus: 1, time_left_ms: 0, observed_at_ms: Date.now() }, { ticket_id: 6, count: 0, bonus: 0, time_left_ms: 3227798, observed_at_ms: Date.now() },
  ] },
  pvp: { kills: 3, deaths: 1, assists: 5, last_death: { at_ms: 1, killer_name: 'Slayer', killer_player: true, skill_id: 15050340, damage_taken: 4200, top_skills: [{ skill_id: 15050340, damage: 3000, hits: 3 }, { skill_id: 15060340, damage: 1200, hits: 2 }] } },
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
