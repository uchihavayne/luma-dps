// The skills panel: a player's skills ranked by damage, each with its damage per second over the
// player's own clock, its share of the player's damage and its total.
const amount = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

export function skillRows(player, elapsedMs, { limit = 5 } = {}) {
  const ranked = (Array.isArray(player?.skills) ? player.skills : [])
    .map(skill => ({ id: skill?.id ?? null, damage: amount(skill?.damage), hits: amount(skill?.hits), crits: amount(skill?.crit_hits) }))
    .filter(skill => skill.damage > 0 && skill.id !== null)
    .sort((a, b) => b.damage - a.damage);
  const total = ranked.reduce((sum, skill) => sum + skill.damage, 0);
  // The same one-second minimum the meter uses for a very short fight.
  const seconds = Math.max(1, amount(elapsedMs) / 1000);
  const count = Math.max(1, Math.min(12, Math.trunc(limit) || 5));
  return {
    total, seconds,
    rows: ranked.slice(0, count).map(skill => ({ ...skill, perSecond: skill.damage / seconds, share: total ? skill.damage / total : 0 })),
    more: Math.max(0, ranked.length - count),
  };
}
