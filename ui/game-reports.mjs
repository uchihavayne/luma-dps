const MAX_BYTES = 4_000_000;
const FORMAT_KEY = Uint8Array.of(0x25, 0xa8, 0x7e, 0x91);
const HEADER_MAGIC = 1145131858;
const COUNTERS = ['TotalCount', 'AccuracyCount', 'CriticalCount', 'PerfectCount', 'HardHitCount', 'FrontAttackCount', 'BackAttackCount', 'AdditionalHitCount', 'BlockCount', 'MissCount', 'ImmuneCount', 'IronWallCount', 'RestorationCount'];

function numeric(object, key, required = false) {
  const value = object?.[key];
  if (value === null || value === undefined) {
    if (required) throw new Error(`Missing report field: ${key}`);
    return null;
  }
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid report number: ${key}`);
  return value;
}

function counterTable(value) {
  if (value !== null && value !== undefined && (typeof value !== 'object' || Array.isArray(value))) throw new Error('Invalid report counters');
  return Object.fromEntries(COUNTERS.map(key => [key, numeric(value, key)]));
}

function flag(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') throw new Error('Invalid report flag');
  return value;
}

function localClock(value) {
  if (typeof value !== 'string' || value.length > 40) throw new Error('Missing report clock');
  const match = /^(20\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z?$/.exec(value);
  if (!match) throw new Error('Unsupported report clock');
  const parts = match.slice(1, 7).map(Number);
  const milliseconds = Number((match[7] || '').padEnd(3, '0').slice(0, 3));
  const [year, month, day, hour, minute, second] = parts;
  if (year < 2024 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) throw new Error('Invalid report clock');
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, milliseconds);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new Error('Invalid report date');
  return { text: value.replace(/Z$/, ''), clock_ms: naive, device_local_ms: new Date(year, month - 1, day, hour, minute, second, milliseconds).getTime() };
}

function sum(a, b) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new Error('Report total exceeds exact numeric range');
  return result;
}

export function decodeGameReport(input) {
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : null;
  if (!bytes || bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error('Choose a game report up to 4 MB');
  const decoded = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index++) decoded[index] = bytes[index] ^ FORMAT_KEY[index % 4];
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded)); }
  catch { throw new Error('This file is not a supported Combat Analyzer report'); }
  if (numeric(data, 'magic', true) !== HEADER_MAGIC || numeric(data, 'version', true) !== 1) throw new Error('Unsupported report version');
  const base = data.BaseStatData;
  const start = localClock(base?.AnalyzerStartTime), end = localClock(base?.AnalyzerEndTime);
  const duration = end.clock_ms - start.clock_ms;
  if (duration < 0 || duration > 86_400_000) throw new Error('Report duration must be within one day');
  const targetName = base?.TargetName;
  if (targetName !== null && targetName !== undefined && (typeof targetName !== 'string' || targetName.length > 300)) throw new Error('Invalid target name');
  const rows = data.SortedSkillStatList;
  if (!Array.isArray(rows) || rows.length > 1024) throw new Error('Invalid report skill count');
  const skills = new Map();
  for (const row of rows) {
    const id = numeric(row, 'SkillId', true), amount = numeric(row, 'DamageVal', true);
    if (id < 1 || id > 299999999) throw new Error('Invalid report skill ID');
    const stats = counterTable(row.HitStat);
    if (!skills.has(id)) skills.set(id, { id, damage: amount, counters: stats });
    else {
      const previous = skills.get(id);
      previous.damage = sum(previous.damage, amount);
      for (const key of COUNTERS) previous.counters[key] = previous.counters[key] === null || stats[key] === null ? null : sum(previous.counters[key], stats[key]);
    }
  }
  const attack = data.AttackStatData;
  const total = numeric(attack, 'TotalDamageVal', true);
  const timed = flag(base?.bExistAnalyzerTime);
  const skillRows = [...skills.values()].sort((a, b) => b.damage - a.damage || a.id - b.id);
  const skillTotal = skillRows.reduce((total, row) => sum(total, row.damage), 0);
  return {
    source: 'game-report', version: 1, target_name: typeof targetName === 'string' ? targetName.replace(/[\u0000-\u001f]/g, '') : '',
    target_filtered: flag(base?.bExistTargetFilter), timing_present: timed,
    started_local: start.text, ended_local: end.text, started_device_local_ms: start.device_local_ms, ended_device_local_ms: end.device_local_ms,
    time_interpretation: 'game-local-clock', duration_ms: duration, total_damage: total,
    dps: duration > 0 && timed !== false ? total * 1000 / duration : null,
    total_healing: numeric(attack, 'TotalHealVal'), damage_taken: numeric(data.TakeStatData, 'TotalDamageVal'),
    counters: counterTable(attack?.HitStat), taken_counters: counterTable(data.TakeStatData?.HitStat),
    skills: skillRows, skill_damage_total: skillTotal, skill_totals_match: skillTotal === total,
  };
}

export function comparePersonalReport(report, record) {
  const known = ['server', 'manual', 'name-match'].includes(record?.local_identity_source) && record?.local_player_id !== null && record?.local_player_id !== undefined;
  const damage = record?.personal_total_damage;
  if (!known || !Number.isSafeInteger(damage) || damage < 0) return { available: false, comparable: false, reason: 'identity-unresolved' };
  const duration = record.personal_elapsed_ms;
  const difference = damage - report.total_damage;
  const timingKnown = report.timing_present !== false && report.duration_ms > 0 && record.timing_valid !== false && typeof duration === 'number' && duration > 0;
  const durationMatches = timingKnown && Math.abs(duration - report.duration_ms) <= 1000;
  const recordedStart = record.personal_started_ms ?? record.started_ms;
  const clockMatches = typeof recordedStart === 'number' && Math.abs(recordedStart - report.started_device_local_ms) <= 1000;
  const targetMatches = report.target_filtered === false || report.target_filtered === true && record.personal_targets?.length === 1 && record.personal_targets[0].name === report.target_name;
  const complete = record.sample_complete === true && record.truncated !== true && !(record.stream_gaps > 0);
  return { available: true, comparable: durationMatches && clockMatches && targetMatches && complete, luma_damage: damage, game_damage: report.total_damage, difference,
    difference_percent: report.total_damage > 0 ? difference / report.total_damage * 100 : null,
    duration_matches: durationMatches, clock_matches: clockMatches, target_matches: targetMatches,
    reason: !durationMatches || !clockMatches ? 'different-window' : !targetMatches ? 'target-not-confirmed' : !complete ? 'incomplete-capture' : 'matched-local-window',
  };
}

export const GAME_REPORT_MAX_BYTES = MAX_BYTES;
