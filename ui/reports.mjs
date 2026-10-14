import { formatRate } from './model.mjs';

const LIMITS = Object.freeze({ bytes: 16 * 1024 * 1024, encounters: 200, players: 100, skills: 500, targets: 100, rows: 100000, samples: 20000, collectionSamples: 100000 });
const SCOPES = new Set(['personal', 'party', 'observed']);
const STATS = ['hits', 'crit_hits', 'back_hits', 'front_hits', 'perfect_hits', 'double_hits', 'multi_hits', 'parry_hits', 'heavy_hits', 'smite_hits', 'healing', 'damage_taken', 'min', 'max'];
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const text = (value, maximum = 160) => typeof value === 'string' ? value.slice(0, maximum).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '') : '';
const metric = value => value === null || value === undefined ? null : typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
const identifier = value => typeof value === 'string' && /^[\w:-]{1,80}$/u.test(value) ? value : Number.isSafeInteger(value) && value >= 0 ? value : null;
const safeList = (value, maximum, label) => { if (value === undefined || value === null) return []; if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label} limit exceeded`); return value; };
const copyStats = value => Object.fromEntries(STATS.filter(key => Object.hasOwn(value, key)).map(key => [key, metric(value[key])]));
const scopeOf = value => SCOPES.has(value) ? value : 'observed';

function normalizeTarget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid target');
  return { id: identifier(value.id), name: text(value.name, 100), damage: metric(value.damage), is_boss: value.is_boss === true, current_hp: metric(value.current_hp), reported_max_hp: metric(value.reported_max_hp), observed_peak_hp: metric(value.observed_peak_hp), health_observed_at_ms: metric(value.health_observed_at_ms) };
}

function normalizeBuild(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid character build');
  const list = (input, maximum, name, mapper) => input === null || input === undefined ? null : safeList(input, maximum, name).map(mapper);
  const equipment = safeList(value.equipment, 64, 'Build equipment').map(item => ({
    entry_index: metric(item.entry_index) ?? 0, slot: metric(item.slot), item_id: identifier(item.item_id), enchant: metric(item.enchant),
    stones: list(item.stones, 6, 'Build stone', stone => ({ stat_id: identifier(stone.stat_id), tier: metric(stone.tier) })),
    stats: list(item.stats, 8, 'Build stat', stat => ({ stat_id: identifier(stat.stat_id), value: metric(stat.value) })),
    godstone_id: identifier(item.godstone_id), skill_bonuses: list(item.skill_bonuses, 8, 'Build bonus', bonus => ({ skill_id: identifier(bonus.skill_id), levels: metric(bonus.levels) })),
  }));
  return {
    actor_id: identifier(value.actor_id), name: text(value.name, 80), server_id: identifier(value.server_id), observed_at_ms: metric(value.observed_at_ms) ?? 0,
    equipment, skills: safeList(value.skills, 255, 'Build skill').map(skill => ({ skill_id: identifier(skill.skill_id), level: metric(skill.level), base_level: metric(skill.base_level) })),
    boards: safeList(value.boards, 32, 'Build board').map(board => ({ board_id: identifier(board.board_id), node_ids: safeList(board.node_ids, 255, 'Build node').map(identifier) })),
    equipment_observed_at_ms: metric(value.equipment_observed_at_ms), skills_observed_at_ms: metric(value.skills_observed_at_ms), boards_observed_at_ms: metric(value.boards_observed_at_ms),
    equipment_complete: value.equipment_complete === true, skills_complete: value.skills_complete === true, source: ['server-self', 'server-self-unbound', 'imported'].includes(value.source) ? value.source : 'unspecified',
  };
}

function normalizeAssist(value = {}) {
  const source = entry => text(entry.source, 40);
  return {
    casts: safeList(value.casts, 64, 'Cast').map(entry => ({ actor_id: identifier(entry.actor_id), skill_id: identifier(entry.skill_id), target_id: identifier(entry.target_id), started_ms: metric(entry.started_ms), expires_ms: metric(entry.expires_ms), duration_ms: metric(entry.duration_ms), source: source(entry) })),
    effects: safeList(value.effects, 256, 'Effect').map(entry => ({ recipient_id: identifier(entry.recipient_id), caster_id: identifier(entry.caster_id), instance_id: identifier(entry.instance_id), effect_id: identifier(entry.effect_id), duration_ms: metric(entry.duration_ms), started_ms: metric(entry.started_ms), expires_ms: metric(entry.expires_ms), persistent: entry.persistent === true, source: source(entry) })),
    timeline: safeList(value.timeline, 1000, 'Assistance timeline').map(entry => ({ kind: text(entry.kind, 40), at_ms: metric(entry.at_ms), actor_id: identifier(entry.actor_id), skill_id: identifier(entry.skill_id), target_id: identifier(entry.target_id), instance_id: identifier(entry.instance_id) })),
    health: safeList(value.health, 256, 'Health observation').map(entry => ({ actor_id: identifier(entry.actor_id), current_hp: metric(entry.current_hp), reported_max_hp: metric(entry.reported_max_hp), observed_peak_hp: metric(entry.observed_peak_hp), observed_at_ms: metric(entry.observed_at_ms) })),
    retention_limited: value.retention_limited === true,
  };
}

function scopedAssist(assist, members) {
  const included = id => id !== null && members.has(String(id));
  return { ...assist, casts: assist.casts.filter(row => included(row.actor_id) || included(row.target_id)), effects: assist.effects.filter(row => included(row.caster_id) || included(row.recipient_id)), timeline: assist.timeline.filter(row => included(row.actor_id) || included(row.target_id)), health: assist.health.filter(row => included(row.actor_id)) };
}

function normalizePlayer(value, budget) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid player');
  const skills = safeList(value.skills, LIMITS.skills, 'Skill').map(skill => {
    if (!skill || typeof skill !== 'object' || Array.isArray(skill)) throw new Error('Invalid skill');
    if (++budget.rows > LIMITS.rows) throw new Error('Report row limit exceeded');
    return { id: identifier(skill.id), name: text(skill.name, 100), damage: metric(skill.damage), ...copyStats(skill) };
  });
  const incoming_skills = safeList(value.incoming_skills, LIMITS.skills, 'Incoming skill').map(skill => {
    if (!skill || typeof skill !== 'object' || Array.isArray(skill) || ++budget.rows > LIMITS.rows) throw new Error('Invalid incoming skill');
    return { id: identifier(skill.id), name: text(skill.name, 100), damage: metric(skill.damage), ...copyStats(skill) };
  });
  const details = Object.fromEntries(['damage_taken_elapsed_ms', 'unclassified_player_target_amount', 'unclassified_player_target_events'].filter(key => Object.hasOwn(value,key)).map(key => [key,metric(value[key])]));
  return { id: identifier(value.id), name: text(value.name, 80), class_name: text(value.class_name, 60), damage: metric(value.damage), dps: metric(value.dps), share: metric(value.share), identity_confirmed: value.identity_confirmed === true, is_local: value.is_local === true, in_party: value.in_party === true, ...copyStats(value), ...details, hps:metric(value.hps), damage_taken_per_second:metric(value.damage_taken_per_second), damage_taken_started_ms:metric(value.damage_taken_started_ms), damage_taken_complete:value.damage_taken_complete===true, incoming_skills, skills };
}

function normalizeEncounter(value, budget) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid encounter');
  const samples = (input, incoming = false) => safeList(input, LIMITS.samples, incoming ? 'Received sample' : 'Damage sample').map(sample => {
    if (++budget.samples > LIMITS.collectionSamples) throw new Error('Collection sample limit exceeded');
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) throw new Error('Invalid damage sample');
    const normalized = { timestamp_ms: metric(sample.timestamp_ms), source: identifier(sample.source), player_id: identifier(sample.player_id), target: identifier(sample.target), skill: identifier(sample.skill), amount: metric(sample.amount), critical: sample.critical === true, tick: sample.tick === true, flags: Number.isInteger(sample.flags) && sample.flags >= 0 && sample.flags <= 255 ? sample.flags : 0, angle: Number.isInteger(sample.angle) && sample.angle >= 0 && sample.angle <= 255 ? sample.angle : 0 };
    if (Object.entries(normalized).some(([key, entry]) => entry === null)) throw new Error('Invalid damage sample');
    if (sample.metric !== undefined && sample.metric !== '' && sample.metric !== (incoming ? 'damage-taken' : 'damage')) throw new Error('Invalid sample metric');
    if (incoming || sample.metric !== undefined && sample.metric !== '') normalized.metric = incoming ? 'damage-taken' : 'damage';
    return normalized;
  });
  const record = {
    id: identifier(value.id), name: text(value.name, 100), timestamp: text(value.timestamp, 80),
    started_ms: metric(value.started_ms), ended_ms: metric(value.ended_ms), elapsed_ms: metric(value.elapsed_ms),
    total_damage: metric(value.total_damage), dps: metric(value.dps), actor_scope: scopeOf(value.actor_scope),
    local_player_id: identifier(value.local_player_id), local_player_name: text(value.local_player_name, 80),
    local_identity_source: ['server', 'manual', 'name', 'name-match'].includes(value.local_identity_source) ? value.local_identity_source : 'unresolved',
    personal_total_damage: metric(value.personal_total_damage), personal_dps: metric(value.personal_dps), personal_elapsed_ms: metric(value.personal_elapsed_ms), personal_started_ms: metric(value.personal_started_ms),
    personal_healing:metric(value.personal_healing), personal_hps:metric(value.personal_hps), personal_damage_taken:metric(value.personal_damage_taken), personal_damage_taken_per_second:metric(value.personal_damage_taken_per_second), personal_damage_taken_started_ms:metric(value.personal_damage_taken_started_ms), personal_damage_taken_complete:value.personal_damage_taken_complete===true,
    ...Object.fromEntries(['personal_damage_taken_elapsed_ms','unclassified_player_target_amount','unclassified_player_target_events'].filter(key=>Object.hasOwn(value,key)).map(key=>[key,metric(value[key])])),
    party_member_ids: safeList(value.party_member_ids, LIMITS.players, 'Party').map(identifier).filter(id => id !== null),
    party_membership_source: ['server', 'manual'].includes(value.party_membership_source) ? value.party_membership_source : 'unresolved',
    party_total_damage: metric(value.party_total_damage), party_dps: metric(value.party_dps), party_elapsed_ms: metric(value.party_elapsed_ms),
    players: safeList(value.players, LIMITS.players, 'Player').map(player => normalizePlayer(player, budget)),
    targets: safeList(value.targets, LIMITS.targets, 'Target').map(normalizeTarget),
    personal_targets: safeList(value.personal_targets, LIMITS.targets, 'Personal target').map(normalizeTarget),
    party_targets: safeList(value.party_targets, LIMITS.targets, 'Party target').map(normalizeTarget),
    damage_samples: samples(value.damage_samples), received_samples: samples(value.received_samples, true),
    sample_complete: value.sample_complete === true, source: text(value.source, 40) || 'unspecified',
    assist: normalizeAssist(value.assist),
    character_build: normalizeBuild(value.character_build),
    note: text(value.note ?? value.notes, 2000), tags: safeList(value.tags, 20, 'Tag').map(tag => text(tag, 64)),
    truncated: value.truncated === true || value.diagnostics?.truncated_encounter === true,
    stream_gaps: metric(value.stream_gaps ?? value.diagnostics?.stream_gaps),
    provenance: ['received', 'demo', 'imported-unverified'].includes(value.provenance) ? value.provenance : 'unspecified',
  };
  if (record.total_damage === null && record.personal_total_damage === null && record.party_total_damage === null && !(SCOPES.has(value.actor_scope) && value.actor_scope !== 'observed')) throw new Error('Encounter has no valid damage metric');
  return record;
}

function collection(value) {
  let records;
  if (Array.isArray(value)) records = value;
  else if (value?.type === 'luma-history' && value.version === 1) records = value.encounters;
  else if (value && typeof value === 'object' && Object.hasOwn(value, 'total_damage')) records = [value];
  else throw new Error('Unsupported encounter format');
  records = safeList(records, LIMITS.encounters, 'Encounter');
  if (!records.length) throw new Error('No encounters');
  const budget = { rows: 0, samples: 0 };
  return { type: 'luma-history', version: 1, encounters: records.map(record => normalizeEncounter(record, budget)) };
}

export function importEncounterCollection(input) {
  if (typeof input !== 'string' || new TextEncoder().encode(input).byteLength > LIMITS.bytes) throw new Error('Report file limit exceeded');
  let parsed;
  try { parsed = JSON.parse(input); } catch { throw new Error('Invalid report JSON'); }
  const result = collection(parsed);
  for (const record of result.encounters) { record.provenance = 'imported-unverified'; record.source = 'imported'; if (record.character_build) record.character_build.source = 'imported'; }
  return result;
}

function selectScope(record, requested) {
  const scope = scopeOf(requested ?? record.actor_scope);
  if (record.actor_scope !== 'observed' && (scope === record.actor_scope || scope === 'observed')) return { ...record };
  if (scope === 'observed') return { ...record, actor_scope: scope };
  if (scope === 'personal') {
    const known = record.local_player_id !== null && record.local_identity_source !== 'unresolved';
    const players = known ? record.players.filter(player => player.id !== null && String(player.id) === String(record.local_player_id)).map(player => ({ ...player, dps: record.personal_dps ?? (player.damage ?? 0) * 1000 / Math.max(1000, record.personal_elapsed_ms ?? record.elapsed_ms ?? 0), share: player.damage > 0 ? 1 : 0 })) : [];
    const confirmed = known && players.length <= 1;
    record = { ...record, unclassified_player_target_amount: players[0]?.unclassified_player_target_amount, unclassified_player_target_events: players[0]?.unclassified_player_target_events, received_samples: confirmed ? record.received_samples.filter(sample => String(sample.target) === String(record.local_player_id)) : [] };
    return { ...record, actor_scope: scope, players: confirmed ? players : [], targets: confirmed ? record.personal_targets : [], damage_samples: confirmed ? record.damage_samples.filter(sample => String(sample.player_id) === String(record.local_player_id)) : [], assist: scopedAssist(record.assist, new Set(confirmed ? [String(record.local_player_id)] : [])), total_damage: confirmed ? record.personal_total_damage ?? players[0]?.damage ?? 0 : null, dps: confirmed ? record.personal_dps ?? players[0]?.dps ?? 0 : null, elapsed_ms: record.personal_elapsed_ms ?? record.elapsed_ms, started_ms: record.personal_started_ms ?? record.started_ms, ended_ms: record.personal_started_ms === null || record.personal_elapsed_ms === null ? record.ended_ms : record.personal_started_ms + record.personal_elapsed_ms, party_member_ids: [], party_membership_source: 'unresolved', party_total_damage: null, party_dps: null, party_elapsed_ms: null, party_targets: [] };
  }
  const known = record.party_membership_source !== 'unresolved';
  const members = new Set(record.party_member_ids.map(String));
  const players = known ? record.players.filter(player => player.in_party || members.has(String(player.id))).map(player => ({ ...player, dps: (player.damage ?? 0) * 1000 / Math.max(1000, record.party_elapsed_ms ?? record.elapsed_ms ?? 0), share: record.party_total_damage > 0 ? (player.damage ?? 0) / record.party_total_damage : 0 })) : [];
  const included = new Set(players.map(player => String(player.id)));
  const scopedSum = key => players.every(player => typeof player[key] === 'number') ? players.reduce((sum, player) => sum + player[key], 0) : undefined;
  record = { ...record, unclassified_player_target_amount: known ? scopedSum('unclassified_player_target_amount') : undefined, unclassified_player_target_events: known ? scopedSum('unclassified_player_target_events') : undefined, received_samples: known ? record.received_samples.filter(sample => included.has(String(sample.target))) : [] };
  return { ...record, actor_scope: scope, players, targets: known ? record.party_targets : [], damage_samples: known ? record.damage_samples.filter(sample => included.has(String(sample.player_id))) : [], assist: scopedAssist(record.assist, included), total_damage: known ? record.party_total_damage ?? players.reduce((sum, player) => sum + (player.damage ?? 0), 0) : null, dps: known ? record.party_dps ?? players.reduce((sum, player) => sum + (player.dps ?? 0), 0) : null, elapsed_ms: record.party_elapsed_ms ?? record.elapsed_ms };
}

function prepared(input, options = {}) {
  const result = collection(input);
  result.encounters = result.encounters.map(record => selectScope(record, options.scope));
  if (!options.anonymize) return result;
  const actors = new Map();
  const names = new Map();
  const processedTargets = new WeakSet();
  const shiftedTargets = new WeakSet();
  const alias = (id, fallback) => {
    if (id === 0) return 0;
    const key = id === null ? `name:${fallback}` : `id:${id}`;
    if (!actors.has(key)) actors.set(key, actors.size + 1);
    return actors.get(key);
  };
  for (const record of result.encounters) {
    for (const player of record.players) { player.id = alias(player.id, player.name); player.name = `Player ${player.id}`; names.set(player.id, player.name); }
    for (const list of [record.targets, record.personal_targets, record.party_targets]) for (const target of list) {
      if (processedTargets.has(target)) continue;
      processedTargets.add(target);
      target.id = alias(target.id, target.name); target.name = `Target ${target.id}`;
    }
    const origin = record.started_ms ?? (record.damage_samples.length ? Math.min(...record.damage_samples.map(sample => sample.timestamp_ms)) : 0);
    const shift = value => value === null ? null : Math.max(0, value - origin);
    for (const list of [record.targets, record.personal_targets, record.party_targets]) for (const target of list) if (!shiftedTargets.has(target)) { target.health_observed_at_ms = shift(target.health_observed_at_ms); shiftedTargets.add(target); }
    for (const sample of [...record.damage_samples, ...record.received_samples]) { sample.source = alias(sample.source, ''); sample.player_id = alias(sample.player_id, ''); sample.target = alias(sample.target, ''); sample.timestamp_ms = Math.max(0, sample.timestamp_ms - origin); }
    for (const cast of record.assist.casts) { cast.actor_id = alias(cast.actor_id, ''); cast.target_id = alias(cast.target_id, ''); cast.started_ms = shift(cast.started_ms); cast.expires_ms = shift(cast.expires_ms); }
    for (const effect of record.assist.effects) { effect.caster_id = alias(effect.caster_id, ''); effect.recipient_id = alias(effect.recipient_id, ''); effect.started_ms = shift(effect.started_ms); effect.expires_ms = shift(effect.expires_ms); }
    for (const event of record.assist.timeline) { event.actor_id = alias(event.actor_id, ''); event.target_id = alias(event.target_id, ''); event.at_ms = shift(event.at_ms); }
    for (const health of record.assist.health) { health.actor_id = alias(health.actor_id, ''); health.observed_at_ms = shift(health.observed_at_ms); }
    record.local_player_id = record.local_player_id === null ? null : alias(record.local_player_id, record.local_player_name);
    record.local_player_name = record.local_player_id === null ? '' : names.get(record.local_player_id) || `Player ${record.local_player_id}`;
    record.party_member_ids = record.party_member_ids.map(id => alias(id, ''));
    record.personal_started_ms = shift(record.personal_started_ms);
    record.personal_damage_taken_started_ms = shift(record.personal_damage_taken_started_ms);
    for (const player of record.players) player.damage_taken_started_ms = shift(player.damage_taken_started_ms);
    if (record.character_build) {
      const build = record.character_build;
      build.actor_id = build.actor_id === null ? null : alias(build.actor_id, build.name); build.name = build.actor_id === null ? '' : names.get(build.actor_id) || `Player ${build.actor_id}`; build.server_id = null;
      for (const key of ['observed_at_ms', 'equipment_observed_at_ms', 'skills_observed_at_ms', 'boards_observed_at_ms']) build[key] = shift(build[key]);
    }
    record.note = ''; record.tags = []; record.name = ''; record.timestamp = ''; record.started_ms = 0; record.ended_ms = Math.max(0, (record.ended_ms ?? origin) - origin);
  }
  return result;
}

export function exportEncounterJson(input, options = {}) {
  const result = JSON.stringify(prepared(input, options), null, 2);
  if (new TextEncoder().encode(result).byteLength > LIMITS.bytes) throw new Error('Report file limit exceeded');
  return result;
}

function csvCell(value) {
  let string = String(value ?? '');
  if (/^[\s\u0000]*[=+@-]/u.test(string)) string = `'${string}`;
  return /[",\r\n]/u.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

export function exportEncounterCsv(input, options = {}) {
  const columns = ['encounter', 'scope', 'started_ms', 'ended_ms', 'elapsed_ms', 'row_type', 'player', 'class', 'skill_or_target', 'damage', 'dps', 'share', ...STATS, 'timestamp_ms', 'source_actor', 'player_id', 'target_id', 'tick', 'critical', 'flags', 'angle', 'sample_complete'];
  const rows = [columns];
  for (const record of prepared(input, options).encounters) {
    const playersById = new Map(record.players.map(player => [String(player.id), player]));
    const skillsByPlayer = new Map(record.players.map(player => [String(player.id), new Map(player.skills.map(skill => [String(skill.id), skill]))]));
    const prefix = [record.id, record.actor_scope, record.started_ms, record.ended_ms, record.elapsed_ms];
    rows.push([...prefix, 'encounter', '', '', record.name || '', record.total_damage, record.dps, '', ...STATS.map(() => null), '', '', '', '', '', '', '', '', record.sample_complete]);
    for (const player of record.players) {
      rows.push([...prefix, 'player', player.name, player.class_name, '', player.damage, player.dps, player.share, ...STATS.map(key => player[key]), '', '', player.id, '', '', '', '', '', record.sample_complete]);
      for (const skill of player.skills) rows.push([...prefix, 'skill', player.name, player.class_name, skill.name || `Skill #${skill.id ?? '?'}`, skill.damage, '', '', ...STATS.map(key => skill[key]), '', '', player.id, '', '', '', '', '', record.sample_complete]);
    }
    for (const target of record.targets) rows.push([...prefix, 'target', '', '', target.name || `Target #${target.id ?? '?'}`, target.damage, '', '', ...STATS.map(() => null), '', '', '', target.id, '', '', '', '', record.sample_complete]);
    for (const sample of record.damage_samples) {
      const player = playersById.get(String(sample.player_id));
      const skill = skillsByPlayer.get(String(sample.player_id))?.get(String(sample.skill));
      rows.push([...prefix, 'hit', player?.name || `#${sample.player_id}`, player?.class_name || '', skill?.name || `Skill #${sample.skill}`, sample.amount, '', '', ...STATS.map(() => null), sample.timestamp_ms, sample.source, sample.player_id, sample.target, sample.tick, sample.critical, sample.flags, sample.angle, record.sample_complete]);
    }
    for (const event of record.assist.timeline) rows.push([...prefix, event.kind, '', '', event.skill_id === null ? '' : `Skill #${event.skill_id}`, '', '', '', ...STATS.map(() => null), event.at_ms, event.actor_id, '', event.target_id, '', '', '', '', !record.assist.retention_limited]);
  }
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const labels = {
  tr: { title: 'Luma DPS · Karşılaşma raporu', personal: 'Kişisel', party: 'Parti', observed: 'Gözlenen oyuncular', missing: 'Bilinmiyor', unknownScope: 'Kimlik veya parti bilgisi bu kayıtta çözülmedi.', duration: 'Süre', damage: 'Hasar', player: 'Oyuncu', skill: 'Yetenek', target: 'Hedef', hits: 'Vuruş', critical: 'Kritik', note: 'Not', details: 'Yetenek ayrıntıları', incomplete: 'Kayıp veya veri sınırı bildirildi. Sonuç eksik olabilir.', provenance: 'Bu dosya yerel bir rapordur; doğrulanmış çevrimiçi sıralama oluşturmaz.', imported: 'İçe aktarılmış · doğrulanmamış', empty: 'Bu kapsam için oyuncu verisi yok.', anonymous: 'Oyuncu adları ve notlar gizlendi.' },
  en: { title: 'Luma DPS · Encounter report', personal: 'Personal', party: 'Party', observed: 'Observed players', missing: 'Unknown', unknownScope: 'Character or party identity is unresolved in this record.', duration: 'Duration', damage: 'Damage', player: 'Player', skill: 'Skill', target: 'Target', hits: 'Hits', critical: 'Critical', note: 'Note', details: 'Skill details', incomplete: 'Loss or a retention limit was reported. Results may be incomplete.', provenance: 'This is a local report; it does not establish a verified online ranking.', imported: 'Imported · unverified', empty: 'No player data for this scope.', anonymous: 'Player names and notes are hidden.' },
};

export function exportEncounterHtml(input, options = {}) {
  const records = prepared(input, options).encounters;
  const lang = options.locale === 'en' ? 'en' : 'tr', l = labels[lang];
  const number = value => value === null || value === undefined ? '—' : new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value);
  const rate = (count, hits) => count === null || count === undefined || !hits ? '—' : `${number(Math.min(100, count / hits * 100))}%`;
  const cards = records.map((record, index) => {
    const perSecond = value => record.total_damage > 0 && !(record.elapsed_ms > 0) ? '—' : formatRate(value, lang, 2);
    const title = record.name || record.targets.map(target => target.name).filter(Boolean).join(' · ') || `#${record.id ?? index + 1}`;
    const players = record.players.slice().sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0));
    return `<article><header><span class="badge">${html(l[record.actor_scope])}</span>${record.provenance === 'imported-unverified' ? `<span class="badge">${html(l.imported)}</span>` : ''}<h2>${html(title)}</h2>${record.timestamp ? `<p>${html(record.timestamp)}</p>` : ''}</header><div class="metrics"><div><small>${html(l.damage)}</small><b>${number(record.total_damage)}</b></div><div><small>DPS</small><b>${perSecond(record.dps)}</b></div><div><small>${html(l.duration)}</small><b>${record.elapsed_ms === null ? '—' : number(record.elapsed_ms / 1000)} s</b></div></div>${record.truncated || record.stream_gaps > 0 ? `<p class="warning">${html(l.incomplete)}</p>` : ''}${record.total_damage === null ? `<p class="warning">${html(l.unknownScope)}</p>` : ''}${players.length ? `<div class="table-wrap"><table><thead><tr><th>${html(l.player)}</th><th>${html(l.damage)}</th><th>DPS</th><th>${html(l.critical)}</th></tr></thead><tbody>${players.map(player => `<tr><td><strong>${html(player.name || `#${player.id ?? '?'}`)}</strong><small>${html(player.class_name)}</small></td><td>${number(player.damage)}</td><td>${perSecond(player.dps)}</td><td>${rate(player.crit_hits, player.hits)}</td></tr>`).join('')}</tbody></table></div>${players.map(player => `<details><summary>${html(player.name || `#${player.id ?? '?'}`)} · ${html(l.details)}</summary><div class="table-wrap"><table><thead><tr><th>${html(l.skill)}</th><th>${html(l.damage)}</th><th>${html(l.hits)}</th><th>${html(l.critical)}</th></tr></thead><tbody>${player.skills.slice().sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0)).map(skill => `<tr><td>${html(skill.name || `Skill #${skill.id ?? '?'}`)}</td><td>${number(skill.damage)}</td><td>${number(skill.hits)}</td><td>${rate(skill.crit_hits, skill.hits)}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}` : `<p>${html(l.empty)}</p>`}${record.targets.length ? `<details><summary>${html(l.target)}</summary><ul>${record.targets.map(target => `<li>${html(target.name || `#${target.id ?? '?'}`)} <b>${number(target.damage)}</b></li>`).join('')}</ul></details>` : ''}${record.note ? `<p class="note"><strong>${html(l.note)}</strong><br>${html(record.note).replaceAll('\n', '<br>')}</p>` : ''}</article>`;
  }).join('');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${html(l.title)}</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b121b;color:#e9f1f6;font:15px system-ui,sans-serif;line-height:1.5}main{max-width:960px;margin:auto;padding:32px 18px}h1{font-size:24px;letter-spacing:-.5px}h2{font-size:20px;margin:10px 0}p{color:#b3c3ce}article{background:#14212c;border:1px solid #2a3a48;border-radius:16px;padding:22px;margin:24px 0}small{display:block;color:#a4b7c5;font-size:12px}.badge{display:inline-block;padding:3px 10px;margin:0 6px 4px 0;border:1px solid #2f6f73;border-radius:20px;font-size:12px;color:#8de2d6}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:16px 0}.metrics b{font-size:24px;font-variant-numeric:tabular-nums}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}td,th{text-align:left;padding:12px 9px;border-bottom:1px solid #2a3a48}th{color:#a4b7c5;font-size:12px}details{margin:12px 0;border:1px solid #2a3a48;border-radius:9px;padding:12px}summary{cursor:pointer;color:#8de2d6}li{padding:4px}.warning{color:#f3c684}.note{overflow-wrap:anywhere}footer{font-size:12px;color:#a4b7c5}@media(max-width:480px){article{padding:14px}.metrics b{font-size:19px}.metrics{gap:8px}}@media print{:root{color-scheme:light}body,article{background:white;color:#18212b}p,small,th,footer{color:#44505c}article{break-inside:avoid}.badge,summary{color:#156c66}}</style></head><body><main><h1>${html(l.title)}</h1>${options.anonymize ? `<p>${html(l.anonymous)}</p>` : ''}${cards}<footer>${html(l.provenance)}</footer></main></body></html>`;
}
