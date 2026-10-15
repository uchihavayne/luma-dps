const ODYLE_TICKET_ID = 60_000_001;
const MAX_COUNTER = 10_000_000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, maximum = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : null;
const actor = value => {
  if (typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value)) value = Number(value);
  return integer(value, 0xffff_ffff) > 0 ? String(value) : null;
};

function empty(status, reason) {
  return { available: false, status, reason, actor_id: null, base: null, bonus: null, total: null, base_capacity: null, capacity_source: null, membership_active: null, observed_at_ms: null, age_ms: null, capacity_mismatch: false, source: null, snapshot_complete: false, time_left_ms: null };
}

function observedTime(value, now) {
  const timestamp = integer(value);
  // One second accommodates delivery/render clock granularity. A clock jump
  // must not turn a future or invalid observation into a current game value.
  return timestamp !== null && timestamp <= now + 1000 ? timestamp : null;
}

function membershipStatus(value, now) {
  if (!object(value) || value.source !== 'server-benefit-list' || observedTime(value.observed_at_ms, now) === null) return null;
  if (value.expires_at_ms === null) return false;
  const expires = integer(value.expires_at_ms);
  return expires !== null && expires >= 1_500_000_000_000 && expires < 4_000_000_000_000 ? expires > now : null;
}

/**
 * Received Odyle energy, never a refill estimate or a manual planner value.
 * The native store binds its actor only from a fresh server self record. When
 * a confirmed local actor is available, pass it explicitly as argument three;
 * null deliberately rejects an unknown local identity.
 */
export function resourceStatus(resources, nowMs = Date.now(), localPlayerId = undefined) {
  const now = integer(nowMs);
  if (now === null || !object(resources)) return empty('unavailable', 'missing');
  if (resources.awaiting_identity === true) return empty('waiting', 'awaiting-identity');
  if (resources.source !== 'server-contents-ticket') return empty('unavailable', 'unsupported-source');
  const actorId = actor(resources.actor_id);
  if (actorId === null) return empty('waiting', 'missing-identity');
  if (localPlayerId !== undefined && actor(localPlayerId) !== actorId) return empty('waiting', 'identity-mismatch');
  const value = resources.odyle;
  if (!object(value)) return empty('waiting', 'no-odyle-observation');
  if (value.ticket_id !== ODYLE_TICKET_ID) return empty('unavailable', 'unknown-ticket');
  const base = integer(value.base, MAX_COUNTER);
  const bonus = integer(value.bonus, MAX_COUNTER);
  const total = integer(value.total, 2 * MAX_COUNTER);
  const observed = observedTime(value.observed_at_ms, now);
  const time = integer(value.time_left_ms);
  if (base === null || bonus === null || total === null || total !== base + bonus || observed === null || time === null) return empty('unavailable', 'invalid-observation');
  const member = membershipStatus(resources.membership, now);
  const ruleCapacity = member === null ? null : member ? 840 : 560;
  const mismatch = ruleCapacity !== null && base > ruleCapacity;
  return {
    available: true,
    status: 'received',
    reason: null,
    actor_id: actorId,
    base,
    bonus,
    total,
    // The rule caps the regular component. Bonus energy can exceed it.
    base_capacity: mismatch ? null : ruleCapacity,
    capacity_source: ruleCapacity !== null && !mismatch ? 'membership-rule' : null,
    membership_active: member,
    observed_at_ms: observed,
    age_ms: Math.max(0, now - observed),
    capacity_mismatch: mismatch,
    source: 'server-contents-ticket',
    snapshot_complete: resources.snapshot_complete === true,
    // This is a received ticket field, not a promised next-recharge timer.
    time_left_ms: time,
  };
}
