// Fixed UI samples; the desktop never enables browser demo parameters.
export function targetDemoState(base, now = Date.now()) {
  const names = ['Atlas', 'Nova', 'Echo', 'Aster', 'Liora', 'Nox', 'Sol', 'Rin', 'Iris', 'Orion', 'Lumen', 'Mira'];
  const classes = ['Gladiator', 'Ranger', 'Sorcerer', 'Assassin', 'Cleric', 'Spiritmaster', 'Templar', 'Chanter', 'Brawler'];
  const contributors = names.map((name, index) => ({ id: index === 11 ? 7 : 101 + index, name, class_name: index === 11 ? 'Ranger' : classes[index % classes.length],
    damage: (12 - index) * 50_000, dps: (12 - index) * 50_000 / 60, identity_confirmed: true, is_local: index === 11, in_party: index === 11 || index === 4, skills: [] }));
  const damage = contributors.reduce((sum, player) => sum + player.damage, 0), own = contributors[11];
  const target = { id: 900, name: 'Demo · Ashen Warden', is_boss: true, damage, current_hp: 6_400_000, reported_max_hp: 10_000_000,
    current_hp_observed_at_ms: now, health_observed_at_ms: now, participants: contributors.slice(0, 10), participant_count: 12, participants_available: true,
    own_participant: own, own_rank: 12, party_total_damage: contributors[4].damage + own.damage, party_dps: (contributors[4].damage + own.damage) / 60,
    started_ms: now - 60_000, elapsed_ms: 60_000, last_hit_ms: now, own_last_hit_ms: now, capture_complete: true };
  return { ...base, source: 'demo', provenance: 'demo', elapsed_ms: 60_000, local_player_id: 7, local_player_name: own.name, local_identity_source: 'server',
    focused_target_id: 900, focused_target_observed_at_ms: now, personal_total_damage: own.damage + 200_000, personal_dps: (own.damage + 200_000) / 60,
    party_member_ids: [7, contributors[4].id], party_membership_source: 'server',
    targets: [target, { id: 901, name: 'Demo · Other target', is_boss: false, damage: 200_000 }],
    players: contributors.map(player => player.is_local ? { ...player, damage: player.damage + 200_000, dps: (player.damage + 200_000) / 60 } : player),
    total_damage: damage + 200_000, dps: (damage + 200_000) / 60 };
}

export function rosterDemoState(base, count = 5, now = Date.now()) {
  const source = targetDemoState(base, now);
  const players = source.players.slice(0, count).map((row, index) => ({ ...row, is_local: index === 0, in_party: true }));
  const unbound = Array.from({ length: 32 }, (_, index) => ({ id: 50_000 + index, name: `#${50_000 + index}`, class_name: 'Unknown', damage: 12_000, dps: 200, skills: [], identity_confirmed: false }));
  const partyDamage = players.reduce((sum, player) => sum + player.damage, 0);
  const total = partyDamage + unbound.reduce((sum, row) => sum + row.damage, 0), own = players[0];
  const target = { ...source.targets[0], damage: total, own_participant: own, own_rank: 1, participants: players.slice(0, 10), participant_count: count,
    party_total_damage: partyDamage, party_dps: partyDamage / 60 };
  return { ...source, encounter_active: true, encounter_started_ms: now - 60_000, players: [...players, ...unbound], targets: [target],
    local_player_id: own.id, local_player_name: own.name, personal_total_damage: own.damage, personal_dps: own.dps, personal_elapsed_ms: 60_000,
    personal_targets: [{ ...target, damage: own.damage }], party_member_ids: players.map(row => row.id), party_total_damage: partyDamage, party_dps: partyDamage / 60,
    total_damage: total, dps: total / 60, party_identity_roster: { source: 'server', members: players.map(row => ({ actor_id: row.id, name: row.name, class_name: row.class_name, identity_confirmed: true })) } };
}
