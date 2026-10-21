import { scopedEncounter } from './scope.mjs';
import { displayTargetName } from './model.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;

/** The boss a saved encounter is about: the boss target that took the most damage. */
export function primaryBoss(record) {
  const bosses = (Array.isArray(record?.targets) ? record.targets : []).filter(target => target?.is_boss === true && (finite(target.damage) ?? 0) > 0);
  return bosses.length ? bosses.reduce((best, target) => (finite(target.damage) ?? 0) > (finite(best.damage) ?? 0) ? target : best) : null;
}

/** A chart can be drawn from raw samples or from the compact timeline kept with every record. */
export const hasDamageChart = record => (record?.damage_samples?.length ?? 0) > 0 || (record?.timeline?.total?.length ?? 0) > 0;

const startedAt = record => finite(record?.started_ms) ?? (Date.parse(record?.timestamp) || 0);

/**
 * Groups saved encounters by boss. `rows` are `{ item, index }`, newest first; `index` is the
 * position the interface opens the record from. Figures follow the selected scope, and an
 * unknown personal result stays unknown (null) instead of becoming zero.
 */
export function bossLog(rows, { scope = 'personal', locale = 'tr' } = {}) {
  const groups = new Map();
  for (const { item, index } of Array.isArray(rows) ? rows : []) {
    const boss = primaryBoss(item);
    if (!boss) continue;
    const name = displayTargetName(boss, locale);
    const scoped = scopedEncounter(item, scope);
    const fight = {
      index, id: item.id ?? null, startedAt: startedAt(item),
      elapsedMs: finite(scoped.elapsed) ?? finite(item.elapsed_ms) ?? 0,
      dps: scoped.known ? finite(scoped.dps) : null, damage: scoped.known ? finite(scoped.damage) : null,
      bossDamage: finite(boss.damage), chart: hasDamageChart(item), complete: item.sample_complete === true,
      imported: item.source === 'imported' || item.provenance === 'imported-unverified',
    };
    if (!groups.has(name)) groups.set(name, { name, fights: [] });
    groups.get(name).fights.push(fight);
  }
  const bosses = [...groups.values()].map(group => {
    const known = group.fights.filter(fight => fight.dps !== null);
    const best = known.reduce((top, fight) => !top || fight.dps > top.dps ? fight : top, null);
    return { ...group, count: group.fights.length, bestDps: best?.dps ?? null, bestFight: best?.index ?? null,
      bestDamage: group.fights.reduce((top, fight) => Math.max(top, fight.damage ?? 0), 0) || null,
      lastAt: group.fights.reduce((latest, fight) => Math.max(latest, fight.startedAt), 0) };
  });
  return bosses.sort((a, b) => b.lastAt - a.lastAt || b.count - a.count);
}
