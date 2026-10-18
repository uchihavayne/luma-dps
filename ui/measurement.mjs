const metric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const identityKnown = state => state?.local_player_id !== null && state?.local_player_id !== undefined
  && String(state.local_player_id) !== '' && ['server', 'manual', 'name-match'].includes(state.local_identity_source);
const partyKnown = state => ['server', 'manual'].includes(state?.party_membership_source);
const result = (kind, suppressSummary = true) => ({ kind, suppressSummary });

function pendingKind(state, preferences, summary) {
  if (['unresolved-identity', 'conflicting-own-identity'].includes(summary?.evidence)) return 'identity-pending';
  if (summary?.evidence === 'unresolved-party') return 'party-pending';
  if (summary?.evidence) return 'contribution-pending';
  const scope = summary?.scope ?? preferences?.damageScope ?? 'personal';
  if (scope === 'party' && !partyKnown(state)) return 'party-pending';
  if (scope === 'personal' && !identityKnown(state)) return 'identity-pending';
  return 'contribution-pending';
}

export function combatMeasurement(state = {}, preferences = {}, { summary, boardSummary = null, board = false } = {}) {
  if (board) {
    if (boardSummary?.evidence === 'no-observed-contribution') return result('contribution-missing');
    if (boardSummary?.known !== true) return result(pendingKind(state, preferences, boardSummary));
  } else {
    if (preferences?.mode === 'boss' && metric(state?.total_damage) === 0 && metric(state?.all_targets_summary?.total_damage) > 0) return result('boss-filter');
    if (summary?.known !== true) return result(pendingKind(state, preferences, summary));
  }
  if (state?.paused === true || state?.status === 'paused') return result('paused', false);
  const observedDamage = metric(state?.total_damage), allDamage = metric(state?.all_targets_summary?.total_damage);
  if (!board && state?.capture?.status === 'capturing' && !(observedDamage > 0 || allDamage > 0)) {
    const frames = metric(state?.diagnostics?.frames), events = metric(state?.diagnostics?.damage_events), packets = metric(state?.capture?.packets);
    if (frames === 0 && packets > 0) return result('decoding-pending');
    if (frames > 0 && events === 0) return result('damage-pending');
    if (events > 0) return result('outgoing-pending');
  }
  return result('measured', false);
}
