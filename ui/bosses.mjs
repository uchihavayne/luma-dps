// Live target observations and a bounded local contribution board. These are
// received combat events, not an official server-wide ranking or target API.
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const actor = value => /^[1-9]\d{0,9}$/.test(String(value)) && Number(value) <= 0xffffffff ? String(value) : null;
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const fresh = (at, now, limit) => number(at) !== null && number(now) !== null && now >= at && now - at < limit;
const localIdentity = state => ['server', 'manual', 'name-match'].includes(state.local_identity_source) ? actor(state.local_player_id) : null;

export function focusedTarget(state = {}, now = Date.now()) {
  const local = localIdentity(state);
  if (!local) return { target: null, source: 'none' };
  const targets = (Array.isArray(state.targets) ? state.targets : []).slice(0, 4096);
  if (state.live_target && typeof state.live_target === 'object' && !Array.isArray(state.live_target)) {
    const liveId = actor(state.live_target.id);
    if (liveId) {
      const previous = targets.findIndex(target => actor(target?.id) === liveId);
      if (previous >= 0) targets.splice(previous, 1);
      targets.unshift(state.live_target);
    }
  }
  const id = actor(state.focused_target_id), at = state.focused_target_observed_at_ms;
  const received = id && targets.find(target => actor(target?.id) === id);
  if (received && fresh(at, now, 10_000)) return { target: received, source: 'personal-hit' };
  // An explicit current-target packet is not available. Only an actually
  // attacked, freshly observed own boss may supply the fallback. The engine
  // invalidates own_last_hit_ms after capture loss and encounter completion.
  const own = targets.filter(target => target?.is_boss === true
    && actor(target.own_participant?.id) === local
    && number(target.own_participant?.damage) > 0 && fresh(target.own_last_hit_ms, now, 10_000));
  own.sort((a, b) => b.own_last_hit_ms - a.own_last_hit_ms
    || b.own_participant.damage - a.own_participant.damage || Number(a.id) - Number(b.id));
  if (own.length > 1 && own[0].own_last_hit_ms === own[1].own_last_hit_ms) return { target: null, source: 'none' };
  return { target: own[0] || null, source: own.length ? 'personal-boss-hit' : 'none' };
}

export function targetVital(target = {}, now = Date.now(), freshnessMs = 5000) {
  const current = number(target.current_hp), reported = number(target.reported_max_hp);
  // Peak HP and a max-only packet are not evidence of a fresh current value.
  const at = number(target.current_hp_observed_at_ms);
  const ageMs = at !== null && number(now) !== null && now >= at ? now - at : null;
  const maximumKnown = reported !== null && reported > 0 && (current === null || current <= reported);
  const maximum = maximumKnown ? reported : null;
  const currentFresh = current !== null && ageMs !== null && ageMs <= freshnessMs;
  const status = current === null || ageMs === null ? 'unknown'
    : !currentFresh ? 'stale' : current === 0 ? 'dead' : 'fresh';
  return { status, current, max: maximum, percent: currentFresh && maximumKnown ? current / maximum * 100 : null,
    ageMs, maximumKnown, observedAtMs: at };
}

function contribution(row, total) {
  const id = actor(row?.id), damage = number(row?.damage), dps = number(row?.dps);
  if (!id || damage === null || damage <= 0 || dps === null) return null;
  const rawName = text(row.name, 100).trim();
  const name = !rawName || row.identity_confirmed !== true && /^(?:unknown|undefined|null|bilinmiyor)$/iu.test(rawName) ? `#${id}` : rawName;
  return { id, name, class_name: text(row.class_name, 60) || '—', damage, dps,
    share: total > 0 ? damage / total * 100 : 0, identity_confirmed: row.identity_confirmed === true,
    is_local: row.is_local === true, in_party: row.in_party === true };
}

export function bossRoster(target, state = {}) {
  const total = number(target?.damage), elapsedMs = number(target?.elapsed_ms);
  if (!target || target.is_boss !== true && !(target.participant_count >= 2)
    || target.participants_available !== true || total === null || total <= 0 || elapsedMs === null) return null;
  const local = localIdentity(state), partyKnown = ['server', 'manual'].includes(state.party_membership_source);
  const unique = new Map();
  for (const value of (Array.isArray(target.participants) ? target.participants : []).slice(0, 10)) {
    const row = contribution(value, total);
    if (row && row.damage <= total && !unique.has(row.id)) unique.set(row.id,
      { ...row, is_local: local !== null && row.id === local, in_party: partyKnown && row.in_party });
  }
  const rows = [...unique.values()].sort((a, b) => b.damage - a.damage || Number(a.id) - Number(b.id))
    .slice(0, 10).map((row, index) => ({ ...row, rank: index + 1 }));
  if (!rows.length || rows.reduce((sum, row) => sum + row.damage, 0) > total) return null;
  const receivedOwn = contribution(target.own_participant, total);
  const own = local && receivedOwn?.id === local ? { ...receivedOwn, is_local: true } : null;
  const ownRank = own && Number.isSafeInteger(target.own_rank) && target.own_rank > 0 ? target.own_rank : null;
  const participantCount = Number.isSafeInteger(target.participant_count) && target.participant_count >= rows.length ? target.participant_count : null;
  return { rows, participantCount, totalDamage: total, dps: total / Math.max(elapsedMs / 1000, 1), elapsedMs,
    complete: target.capture_complete === true && !(state.diagnostics?.stream_gaps > 0), own, ownRank,
    scope: 'observed-target', kind: target.is_boss === true ? 'boss' : 'target' };
}

export function targetSummary(target, state = {}, scope = 'personal') {
  const elapsedMs = number(target?.elapsed_ms) ?? 0;
  if (!target) return { known: false, totalDamage: null, dps: null, elapsedMs, scope };
  let totalDamage = null, dps = null;
  if (scope === 'observed') totalDamage = number(target.damage);
  else if (scope === 'party') {
    if (['server', 'manual'].includes(state.party_membership_source)) { totalDamage = number(target.party_total_damage); dps = number(target.party_dps); }
  } else if (localIdentity(state)) {
    const ownId = actor(target.own_participant?.id);
    if (!target.own_participant || ownId === localIdentity(state)) {
      totalDamage = number(target.own_participant?.damage) ?? 0; dps = number(target.own_participant?.dps);
    }
  }
  if (totalDamage !== null && dps === null) dps = totalDamage / Math.max(elapsedMs / 1000, 1);
  return { known: totalDamage !== null, totalDamage, dps, elapsedMs, scope };
}

export function bossPresentation(state = {}, { now = Date.now(), autoBossRoster = true, damageScope = 'personal' } = {}) {
  const focus = focusedTarget(state, now), target = focus.target;
  const roster = autoBossRoster ? bossRoster(target, state) : null;
  return { target, vital: targetVital(target || {}, now), roster,
    summary: roster ? targetSummary(target, state, damageScope) : null,
    automatic: Boolean(roster), focusSource: focus.source };
}
