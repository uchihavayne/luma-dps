// Fixed UI samples; the desktop never enables browser demo parameters.
export function targetDemoState(base, now = Date.now()) {
  const names = ['Atlas', 'Nova', 'Echo', 'Aster', 'Liora', 'Nox', 'Sol', 'Rin', 'Iris', 'Orion', 'Lumen', 'Mira'];
  const classes = ['Gladiator', 'Ranger', 'Sorcerer', 'Assassin', 'Cleric', 'Spiritmaster', 'Templar', 'Chanter'];
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
