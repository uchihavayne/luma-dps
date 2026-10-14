const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);

// Visibility is a user choice. Nearby actors are never evidence of party membership.
export function scopedEncounter(state, scope = 'personal') {
  if (state?.timing_valid === false) {
    const scoped = scopedEncounter({ ...state, timing_valid: undefined }, scope);
    return { ...scoped, dps: null, players: scoped.players.map(player => ({ ...player, dps: null })) };
  }
  const players = Array.isArray(state?.players) ? state.players : [];
  const localId = state?.local_player_id;
  if (state?.provenance === 'imported-unverified' && state?.actor_scope === scope && scope !== 'observed') {
    const damage = nonnegative(state.total_damage), dps = nonnegative(state.dps);
    return { scope, known: damage !== null, players: damage !== null ? players : [], targets: damage !== null ? state?.targets || [] : [], damage, dps, elapsed: state?.elapsed_ms || 0 };
  }
  if (scope === 'observed') return { scope, known: true, players, targets: state?.targets || [], damage: nonnegative(state?.total_damage) ?? 0, dps: nonnegative(state?.dps) ?? 0, elapsed: state?.elapsed_ms || 0 };
  if (scope === 'party') {
    const memberIds = new Set((state?.party_member_ids || []).map(String));
    const known = ['server', 'manual'].includes(state?.party_membership_source);
    const partyElapsed = state?.party_elapsed_ms || state?.elapsed_ms || 0;
    const filtered = known ? players.filter(player => player.in_party === true || memberIds.has(String(player.id))).map(player => ({ ...player, dps: partyElapsed > 0 ? player.damage * 1000 / Math.max(partyElapsed, 1000) : player.dps })) : [];
    return { scope, known, players: filtered, targets: known ? state?.party_targets || [] : [], damage: known ? nonnegative(state?.party_total_damage) ?? filtered.reduce((sum, player) => sum + (nonnegative(player.damage) ?? 0), 0) : null, dps: known ? nonnegative(state?.party_dps) ?? filtered.reduce((sum, player) => sum + (nonnegative(player.dps) ?? 0), 0) : null, elapsed: state?.party_elapsed_ms || state?.elapsed_ms || 0 };
  }
  const filtered = players.filter(player => sameId(player.id, localId)).map(player => ({ ...player, dps: nonnegative(state?.personal_dps) ?? player.dps }));
  const known = localId !== null && localId !== undefined && String(localId) !== '' && ['server', 'manual', 'name-match'].includes(state?.local_identity_source);
  return { scope: 'personal', known, players: known ? filtered : [], targets: known ? state?.personal_targets || [] : [], damage: known ? nonnegative(state?.personal_total_damage) ?? filtered.reduce((sum, player) => sum + (nonnegative(player.damage) ?? 0), 0) : null, dps: known ? nonnegative(state?.personal_dps) ?? filtered.reduce((sum, player) => sum + (nonnegative(player.dps) ?? 0), 0) : null, elapsed: state?.personal_elapsed_ms || state?.elapsed_ms || 0 };
}

export function ownPlayer(state) {
  return (state?.players || []).find(player => sameId(player.id, state?.local_player_id)) || null;
}

export function skillSummary(player, elapsedMs = 0) {
  const skills = player?.skills || [];
  const hits = skills.reduce((sum, skill) => sum + (nonnegative(skill.hits) ?? 0), 0);
  const critical = skills.reduce((sum, skill) => sum + (nonnegative(skill.crit_hits) ?? 0), 0);
  const damage = nonnegative(player?.damage) ?? skills.reduce((sum, skill) => sum + (nonnegative(skill.damage) ?? 0), 0);
  return { hits, critical, criticalRate: hits ? Math.min(100, critical / hits * 100) : 0, average: hits ? damage / hits : 0, dps: elapsedMs > 0 ? damage * 1000 / elapsedMs : 0 };
}

export function sortedSkills(skills, sort = 'damage') {
  const value = skill => sort === 'crit' ? skill.hits > 0 ? skill.crit_hits / skill.hits : 0 : nonnegative(skill[sort]) ?? 0;
  return [...(skills || [])].sort((a, b) => value(b) - value(a) || String(a.name || a.id).localeCompare(String(b.name || b.id)));
}

