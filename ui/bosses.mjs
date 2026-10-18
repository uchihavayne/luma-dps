// Live target observations and a bounded local contribution board. These are
// received combat events, not an official server-wide ranking or target API.
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const actor = value => /^[1-9]\d{0,9}$/.test(String(value)) && Number(value) <= 0xffffffff ? String(value) : null;
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const fresh = (at, now, limit) => number(at) !== null && number(now) !== null && now >= at && now - at < limit;
const localIdentity = state => ['server', 'manual', 'name-match'].includes(state.local_identity_source) ? actor(state.local_player_id) : null;

function targetObservations(state) {
  const values = [state.live_target,
    ...(Array.isArray(state.observed_targets) ? state.observed_targets.slice(0, 4096) : []),
    ...(Array.isArray(state.targets) ? state.targets.slice(0, 4096) : [])];
  const unique = new Map();
  for (const value of values) {
    const id = value && typeof value === 'object' && !Array.isArray(value) ? actor(value.id) : null;
    if (id && !unique.has(id)) unique.set(id, value);
  }
  return [...unique.values()];
}

export function focusedTarget(state = {}, now = Date.now()) {
  const local = localIdentity(state);
  if (!local) return { target: null, source: 'none' };
  const targets = targetObservations(state);
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

export function continuedPersonalTarget(previous, state = {}, now = Date.now()) {
  const focus = focusedTarget(state, now), local = localIdentity(state);
  const timestamp = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const count = value => timestamp(value) ?? 0;
  const encounter = timestamp(state.encounter_started_ms), capturing = state.capture?.status === 'capturing' && state.encounter_active === true;
  const gaps = count(state.diagnostics?.stream_gaps), missed = count(state.capture?.missed_packets);
  const remember = target => capturing && encounter !== null && timestamp(target.started_ms) !== null
    && actor(target.own_participant?.id) === local && number(target.own_participant?.damage) > 0
    && timestamp(target.own_last_hit_ms) !== null && fresh(target.own_last_hit_ms, now, 10_000)
    ? { localId: local, encounterStartedMs: encounter, targetId: actor(target.id), targetStartedMs: target.started_ms, ownLastHitMs: target.own_last_hit_ms, gaps, missed } : null;
  if (focus.target) return { ...focus, memory: remember(focus.target) };
  const empty = { target: null, source: 'none', memory: null };
  if (!previous || !capturing || !local || encounter === null || actor(previous.targetId) !== previous.targetId || timestamp(previous.ownLastHitMs) === null || now < previous.ownLastHitMs
    || previous.localId !== local || previous.encounterStartedMs !== encounter || previous.gaps !== gaps || previous.missed !== missed) return empty;
  const targets = targetObservations(state), target = targets.find(row => actor(row.id) === previous.targetId);
  if (!target || timestamp(target.started_ms) !== previous.targetStartedMs || timestamp(target.own_last_hit_ms) !== previous.ownLastHitMs
    || actor(target.own_participant?.id) !== local || !(number(target.own_participant?.damage) > 0)
    || !fresh(target.last_hit_ms, now, 10_000) || number(target.current_hp) === 0) return empty;
  if (state.focused_target_id !== null && state.focused_target_id !== undefined && actor(state.focused_target_id) !== previous.targetId) return empty;
  if (targets.some(row => actor(row.id) !== previous.targetId && actor(row.own_participant?.id) === local && number(row.own_participant?.damage) > 0
    && timestamp(row.own_last_hit_ms) !== null && row.own_last_hit_ms >= previous.ownLastHitMs)) return empty;
  return { target, source: 'continued-personal-target', memory: previous };
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
  const elapsedMs = number(target?.elapsed_ms);
  if (!target) return { known: false, totalDamage: null, dps: null, elapsedMs, scope, evidence: 'target-unavailable' };
  let totalDamage = null, dps = null, evidence = 'contribution-unavailable';
  if (scope === 'observed') { totalDamage = number(target.damage); evidence = totalDamage === null ? 'contribution-unavailable' : 'received-target'; }
  else if (scope === 'party') {
    if (['server', 'manual'].includes(state.party_membership_source)) {
      totalDamage = number(target.party_total_damage); dps = number(target.party_dps);
      if (totalDamage !== null) evidence = 'received-party';
    } else evidence = 'unresolved-party';
  } else if (localIdentity(state)) {
    const ownId = actor(target.own_participant?.id);
    if (target.own_participant && ownId === localIdentity(state)) {
      totalDamage = number(target.own_participant.damage); dps = number(target.own_participant.dps);
      if (totalDamage !== null) evidence = 'received-own';
    } else if (target.own_participant) evidence = 'conflicting-own-identity';
    else if (bossRoster(target, state)) {
      // The engine checks the full received contributor map before the top-ten
      // cap. No own row means no received own credit, not proof of game-wide 0.
      totalDamage = 0; dps = 0; evidence = 'no-observed-contribution';
    }
  } else evidence = 'unresolved-identity';
  if (totalDamage !== null && dps === null && elapsedMs !== null) dps = totalDamage / Math.max(elapsedMs / 1000, 1);
  return { known: totalDamage !== null, totalDamage, dps, elapsedMs, scope, evidence };
}

export function targetBoardChoices(state = {}) {
  return targetObservations(state).filter(target => bossRoster(target, state))
    .sort((a, b) => b.damage - a.damage || Number(a.id) - Number(b.id));
}

export function bossPresentation(state = {}, { now = Date.now(), autoBossRoster = true, damageScope = 'personal', selectedTargetId = null, previousFocus = null } = {}) {
  const explicit = selectedTargetId !== null && selectedTargetId !== undefined && selectedTargetId !== '';
  const selected = explicit ? actor(selectedTargetId) : null;
  const personal = continuedPersonalTarget(previousFocus, state, now);
  const focus = explicit ? { target: selected ? targetObservations(state).find(target => actor(target.id) === selected) || null : null, source: 'user-selected-target' } : personal;
  const roster = explicit || autoBossRoster ? bossRoster(focus.target, state) : null;
  const target = explicit && !roster ? null : focus.target;
  return { target, vital: targetVital(target || {}, now), roster,
    summary: roster ? targetSummary(target, state, damageScope) : null,
    automatic: Boolean(roster) && !explicit, focusSource: target ? focus.source : 'none',
    selectedTargetId: selected, selectionAvailable: !explicit || Boolean(roster), focusMemory: personal.memory };
}

export function worldTargetPresentation(state = {}, options = {}) {
  const { now = Date.now(), autoBossRoster = true, damageScope = 'personal', selectedTargetId = null } = options;
  let view = bossPresentation(state, { ...options, now });
  const timestamp = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const started = timestamp(state.encounter_started_ms);
  const live = autoBossRoster && state.encounter_active === true && state.paused !== true
    && state.capture?.status === 'capturing' && started !== null && started <= now;
  const candidates = live ? targetObservations(state).filter(target => Number.isSafeInteger(target.participant_count) && target.participant_count >= 10
    && timestamp(target.started_ms) !== null && target.started_ms >= started && target.started_ms <= now
    && fresh(target.last_hit_ms, now, 10_000) && target.last_hit_ms >= target.started_ms
    && number(target.current_hp) !== 0 && bossRoster(target, state)) : [];
  const explicit = selectedTargetId !== null && selectedTargetId !== undefined && selectedTargetId !== '';
  // A single nearby received fight can be shown without claiming it is a boss
  // or the player's target. Multiple candidates require the existing chooser.
  // Neither this fallback nor explicit selection seeds personal focus memory.
  if (!explicit && !view.target && candidates.length === 1) {
    const target = candidates[0], roster = bossRoster(target, state);
    view = { ...view, target, vital: targetVital(target, now), roster,
      summary: targetSummary(target, state, damageScope), automatic: true,
      focusSource: 'observed-shared-target' };
  }
  return { ...view, observedCandidateCount: candidates.length,
    observedSummary: view.roster ? targetSummary(view.target, state, 'observed') : null,
    personalSummary: view.roster ? targetSummary(view.target, state, 'personal') : null,
    partySummary: view.roster ? targetSummary(view.target, state, 'party') : null };
}
