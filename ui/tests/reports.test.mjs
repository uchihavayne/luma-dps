import test from 'node:test';
import assert from 'node:assert/strict';
import { importEncounterCollection, exportEncounterCsv, exportEncounterHtml, exportEncounterJson } from '../reports.mjs';
import { normalizeEncounter } from '../model.mjs';

const fight = () => ({ id: 3, started_ms: 1791882000123, ended_ms: 1791882060123, elapsed_ms: 60000, total_damage: 3000, dps: 50, local_player_id: 7, local_player_name: 'Self', local_identity_source: 'server', personal_total_damage: 1000, personal_dps: 20, personal_elapsed_ms: 50000, personal_targets: [{ id: 50, name: 'Boss', damage: 1000 }], party_member_ids: [7], party_membership_source: 'server', party_total_damage: 1000, party_dps: 20, party_targets: [{ id: 50, name: 'Boss', damage: 1000 }], players: [{ id: 7, name: 'Self', is_local: true, in_party: true, class_name: 'ranger', damage: 1000, dps: 20, skills: [{ id: 5, name: 'Arrow', damage: 1000, hits: 5, crit_hits: null, back_hits: 2 }] }, { id: 8, name: 'Nearby', damage: 2000, dps: 40, class_name: 'cleric', skills: [] }], targets: [{ id: 50, name: 'Boss', is_boss: true, damage: 3000, current_hp: 1000, observed_peak_hp: 8000 }], note: 'Private build', tags: ['guild'] });
const packet = records => ({ type: 'luma-history', version: 1, encounters: records });

function withNewReceivedFields() {
  const value = fight(), at = value.started_ms;
  value.context = { source: 'server-zone', map_id: 600001, session_id: `zone-600001-${at}-1`, zone_observed_at_ms: at - 1000, token: 'private-context' };
  value.character_build = { actor_id: 7, name: 'Self', source: 'server-self', observed_at_ms: at - 1000,
    combat_power: { current: 356559, highest: 400000, observed_at_ms: at - 900, source: 'server-self' },
    wing: { wing_id: 30500200, skin_id: null, observed_at_ms: at - 800, source: 'server-self' },
    species: Array.from({ length: 5 }, (_, index) => ({ species_id: index + 2, level: 12, progress: 0, effects: [{ page: 1, slot: 0, kind: 3, stat_id: 42, value: -123 }] })), species_observed_at_ms: at - 700,
  };
  value.players[0].healing = 83; value.players[0].hps = 83 / 60; value.players[0].healing_coverage = 'explicit-received';
  value.players[0].healing_skills = [{ id: 17050000, damage: 83, hits: 1 }];
  value.healing_samples = [{ timestamp_ms: at + 1, source: 7, player_id: 7, target: 8, skill: 17050000, amount: 83, tick: true, metric: 'healing' }];
  value.healing_sample_complete = true;
  value.assist = { health_history: [{ actor_id: 50, current_hp: 1000, reported_max_hp: 2000, observed_at_ms: at + 1 }, { actor_id: 50, current_hp: 0, reported_max_hp: 0, observed_at_ms: at + 2 }, { actor_id: 999, current_hp: 300, observed_at_ms: at + 3 }] };
  return value;
}

test('new received build fields, context and healing retain exact separate values across reports', () => {
  const input = withNewReceivedFields();
  const report = JSON.parse(exportEncounterJson(input)).encounters[0];
  assert.equal(report.character_build.combat_power.current, 356559);
  assert.equal(report.character_build.species[0].effects[0].value, -123);
  assert.equal(report.context.map_id, 600001);
  assert.equal(report.healing_samples[0].metric, 'healing');
  assert.equal(report.healing_samples[0].amount, 83);
  assert.equal(report.damage_samples.length, 0);
  assert.equal(report.total_damage, 3000);
  assert.equal(report.players[0].healing_skills[0].damage, 83);
  assert.equal(report.assist.health_history[1].current_hp, 0);
  assert.equal(report.assist.health_history[1].reported_max_hp, null);
  const imported = importEncounterCollection(exportEncounterJson(input)).encounters[0];
  assert.equal(imported.character_build.combat_power.source, 'imported');
  assert.equal(imported.context.source, 'imported');
});

test('scoped healing and HP history include only selected actors, targets and actual record time', () => {
  const input = withNewReceivedFields();
  input.healing_samples.push({ ...input.healing_samples[0], source: 8, player_id: 8, target: 7 });
  input.assist.health_history.push({ actor_id: 50, current_hp: 500, observed_at_ms: input.ended_ms + 1 });
  const report = JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0];
  assert.equal(report.healing_samples.length, 1);
  assert.equal(report.healing_samples[0].player_id, 7);
  assert.equal(report.assist.health_history.length, 2);
  assert.ok(report.assist.health_history.every(row => row.actor_id === 50));
  input.local_player_id = null; input.local_identity_source = 'unresolved';
  const unknown = JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0];
  assert.equal(unknown.character_build, null);
  assert.deepEqual(unknown.healing_samples, []);
  assert.deepEqual(unknown.assist.health_history, []);
});

test('anonymous new fields remove wall time, session identifiers and actual actor references', () => {
  const input = withNewReceivedFields();
  const raw = exportEncounterJson(input, { anonymize: true, scope: 'personal' });
  assert.doesNotMatch(raw, /179188|zone-600001-|private-context|Self/);
  const report = JSON.parse(raw).encounters[0];
  assert.equal(report.context.session_id, 'Session 1');
  assert.equal(report.context.zone_observed_at_ms, 0);
  assert.equal(report.character_build.combat_power.observed_at_ms, 0);
  assert.equal(report.character_build.wing.observed_at_ms, 0);
  assert.equal(report.character_build.species_observed_at_ms, 0);
  assert.equal(report.healing_samples[0].player_id, report.local_player_id);
  assert.equal(report.healing_samples[0].timestamp_ms, 1);
  assert.equal(report.assist.health_history[0].actor_id, report.targets[0].id);
  assert.equal(report.assist.health_history[1].observed_at_ms, 2);
  assert.equal(importEncounterCollection(raw).encounters[0].character_build.species[0].progress, 0);
});

test('new report observations reject oversized collections and metric cross-contamination', () => {
  let input = withNewReceivedFields(); input.assist.health_history = Array(513).fill(input.assist.health_history[0]);
  assert.throws(() => exportEncounterJson(input), /Health history/);
  input = withNewReceivedFields(); input.character_build.species[0].effects = Array(161).fill(input.character_build.species[0].effects[0]);
  assert.throws(() => exportEncounterJson(input), /species/);
  input = withNewReceivedFields(); input.healing_samples[0].metric = 'damage';
  assert.throws(() => exportEncounterJson(input), /metric/);
});

test('offline exports show received healing coverage separately and preserve legacy CSV columns', () => {
  const input = withNewReceivedFields(), before = structuredClone(input);
  const csv = exportEncounterCsv(input, { scope: 'personal' });
  const header = csv.split('\r\n')[0].split(',');
  assert.ok(header.includes('healing_coverage')); assert.ok(header.includes('hps'));
  const healingRow = csv.split('\r\n').find(row => row.includes('healing-tick')).split(',');
  assert.equal(healingRow[header.indexOf('damage')], '');
  assert.equal(healingRow[header.indexOf('healing')], '83');
  const html = exportEncounterHtml(input, { locale: 'en', scope: 'personal' });
  assert.match(html, /Received healing/); assert.match(html, /direct-heal coverage is incomplete/);
  assert.match(html, /Combat power/); assert.match(html, /356,559/);
  assert.equal(exportEncounterCsv(fight()).split('\r\n')[0].split(',').length, 35);
  assert.deepEqual(input, before);
});

test('UI-normalized history exports numeric IDs accepted by native integer fields', () => {
  const value = withNewReceivedFields();
  value.damage_samples = [{ timestamp_ms: value.started_ms + 1, source: 7, player_id: 7, target: 50, skill: 5, amount: 1000 }];
  value.character_build.equipment = [{ item_id: 110150026, slot: 1 }];
  value.character_build.boards = [{ board_id: 11, node_ids: [110001] }];
  const normalized = normalizeEncounter(value);
  assert.equal(normalized.local_player_id, '7'); // actual UI boundary uses text IDs
  const exported = JSON.parse(exportEncounterJson(normalized)).encounters[0];
  for (const id of [exported.id, exported.local_player_id, exported.players[0].id, exported.players[0].skills[0].id, exported.targets[0].id, exported.damage_samples[0].source, exported.character_build.actor_id, exported.character_build.equipment[0].item_id, exported.character_build.boards[0].node_ids[0]]) assert.equal(typeof id, 'number');
  assert.equal(exported.damage_samples[0].source, 7);
  const textIds = fight(); textIds.players[0].id = 'Player-A'; textIds.targets[0].id = '9007199254740993';
  const textResult = JSON.parse(exportEncounterJson(textIds)).encounters[0];
  assert.equal(textResult.players[0].id, 'Player-A');
  assert.equal(textResult.targets[0].id, '9007199254740993'); // no unsafe rounding
});

function withStagger() {
  const value = fight();
  value.assist = { stagger: [50, 7, 65].map(actor_id => ({ actor_id, current: 750, maximum: 1200, broken: false, observed_at_ms: value.started_ms + 20, fresh_for_ms: 5000, fresh: true, source: 'server' })) };
  return value;
}

test('recorded stagger survives JSON and scopes only self and actually damaged targets', () => {
  const input = withStagger();
  const all = JSON.parse(exportEncounterJson(input)).encounters[0];
  assert.deepEqual(all.assist.stagger, input.assist.stagger);
  const personal = JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0];
  assert.deepEqual(personal.assist.stagger.map(row => row.actor_id), [50, 7]);
  const party = JSON.parse(exportEncounterJson(input, { scope: 'party' })).encounters[0];
  assert.deepEqual(party.assist.stagger.map(row => row.actor_id), [50, 7]);
  input.local_player_id = null; input.local_identity_source = 'unresolved';
  assert.deepEqual(JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0].assist.stagger, []);
});

test('anonymous stagger aliases and timestamps use the same target mapping and appear in free offline exports', () => {
  const input = withStagger();
  const report = JSON.parse(exportEncounterJson(input, { scope: 'personal', anonymize: true })).encounters[0];
  assert.equal(report.assist.stagger[0].actor_id, report.targets[0].id);
  assert.equal(report.assist.stagger[0].observed_at_ms, 20);
  assert.equal(report.assist.stagger[1].actor_id, report.local_player_id);
  const csv = exportEncounterCsv(input, { scope: 'personal' });
  const row = csv.split('\r\n').find(row => row.includes('stagger-observation'));
  assert.ok(row); assert.equal(row.split(',').length, 35); assert.match(row, /750 \/ 1200/);
  const html = exportEncounterHtml(input, { scope: 'personal', locale: 'en' });
  assert.match(html, /Observed boss stagger/); assert.match(html, /750 \/ 1,200/);
});

test('stagger imports reject oversized or invalid observations instead of silently truncating', () => {
  const input = withStagger();
  input.assist.stagger = Array(65).fill(input.assist.stagger[0]);
  assert.throws(() => exportEncounterJson(input), /Stagger/);
  input.assist.stagger = [{ ...input.assist.stagger[0], current: 1201 }];
  assert.throws(() => exportEncounterJson(input), /stagger/);
  input.assist.stagger = [{ ...input.assist.stagger[0], current: 0, maximum: null, broken: true, private_data: 'hidden' }];
  const valid = exportEncounterJson(input);
  assert.doesNotMatch(valid, /private_data|hidden/);
  assert.equal(JSON.parse(valid).encounters[0].assist.stagger[0].maximum, null);
});

test('native milliseconds and unknown quality counters survive import and JSON export', () => {
  const imported = importEncounterCollection(JSON.stringify(packet([fight()])));
  assert.equal(imported.encounters[0].started_ms, 1791882000123);
  assert.equal(imported.encounters[0].players[0].skills[0].crit_hits, null);
  assert.equal(imported.encounters[0].players[0].skills[0].back_hits, 2);
  assert.equal(imported.encounters[0].provenance, 'imported-unverified');
  const roundTrip = importEncounterCollection(exportEncounterJson(imported));
  assert.equal(roundTrip.encounters[0].started_ms, imported.encounters[0].started_ms);
});

test('personal report excludes nearby actors and uses personal time and totals', () => {
  const input = fight(); input.players[0].dps = 1;
  const exported = JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0];
  assert.equal(exported.total_damage, 1000);
  assert.equal(exported.dps, 20);
  assert.equal(exported.elapsed_ms, 50000);
  assert.deepEqual(exported.players.map(player => player.name), ['Self']);
  assert.equal(exported.targets[0].damage, 1000);
  assert.equal(exported.actor_scope, 'personal');
  assert.equal(exported.players[0].dps, 20);
  assert.equal(input.players[0].dps, 1);
});

test('unknown personal identity shows unknown total without leaking nearby rows', () => {
  const input = fight();
  input.local_player_id = null; input.local_identity_source = 'unresolved'; input.personal_total_damage = null; input.personal_dps = null;
  input.players[0].is_local = false;
  const exported = JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0];
  assert.equal(exported.total_damage, null);
  assert.deepEqual(exported.players, []);
  assert.deepEqual(exported.targets, []);
  const report = exportEncounterHtml(input, { scope: 'personal' });
  assert.match(report, /Kimlik veya parti bilgisi/);
  assert.doesNotMatch(report, /Nearby/);
  input.players[0].is_local = true;
  assert.equal(JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0].total_damage, null);
});

test('party export needs membership and never relabels all nearby damage as party', () => {
  let exported = JSON.parse(exportEncounterJson(fight(), { scope: 'party' })).encounters[0];
  assert.equal(exported.total_damage, 1000);
  assert.deepEqual(exported.players.map(player => player.name), ['Self']);
  const unknown = fight(); unknown.party_membership_source = 'unresolved';
  exported = JSON.parse(exportEncounterJson(unknown, { scope: 'party' })).encounters[0];
  assert.equal(exported.total_damage, null);
  assert.deepEqual(exported.players, []);
});

test('anonymous aliases are stable across encounters and remove private identity and notes', () => {
  const a = fight(), b = fight(); b.id = 4; b.players.reverse();
  const raw = exportEncounterJson(packet([a, b]), { anonymize: true });
  assert.doesNotMatch(raw, /Self|Nearby|Private build|guild/);
  const records = JSON.parse(raw).encounters;
  assert.equal(records[0].players[0].name, records[1].players[1].name);
  assert.equal(records[0].local_player_id, records[0].players[0].id);
  assert.equal(records[0].started_ms, 0);
  assert.deepEqual(records[0].party_member_ids, [records[0].players[0].id]);
  assert.match(records[0].targets[0].name, /^Target \d+$/);
});

test('anonymous scoped collection retains its recorded scope and totals after import', () => {
  const first = exportEncounterJson(fight(), { scope: 'personal', anonymize: true });
  const imported = importEncounterCollection(first);
  const second = JSON.parse(exportEncounterJson(imported, { scope: 'personal' })).encounters[0];
  assert.equal(second.total_damage, 1000);
  assert.equal(second.actor_scope, 'personal');
  assert.equal(second.players.length, 1);
  assert.equal(second.provenance, 'imported-unverified');
  const observed = JSON.parse(exportEncounterJson(imported, { scope: 'observed' })).encounters[0];
  assert.equal(observed.actor_scope, 'personal');
});

test('CSV quotes delimiter/newline content and neutralizes spreadsheet formulas', () => {
  const input = fight(); input.players[0].name = ' =HYPERLINK("bad")'; input.players[1].name = 'Line\nTwo,Three';
  const report = exportEncounterCsv(input);
  assert.match(report, /"' =HYPERLINK\(""bad""\)"/);
  assert.match(report, /"Line\nTwo,Three"/);
  assert.match(report, /1791882000123/);
  assert.equal(report.split('\r\n')[0].split(',').length, 35);
});

test('offline HTML escapes names and notes and cannot run injected scripts or contact a server', () => {
  const input = fight(); input.players[0].name = '<img src=x onerror="alert(1)">'; input.note = '</p><script>fetch("bad")</script>';
  const report = exportEncounterHtml(input);
  assert.doesNotMatch(report, /<script|<img|<iframe|<link/i);
  assert.match(report, /&lt;script&gt;/);
  assert.match(report, /default-src 'none'/);
  assert.match(report, /Gözlenen oyuncular/);
});

test('imports reject unsupported, oversized or excessively long collections', () => {
  assert.throws(() => importEncounterCollection('bad'), /JSON/);
  assert.throws(() => importEncounterCollection(JSON.stringify({ type: 'other', version: 1, encounters: [] })), /format/);
  assert.throws(() => importEncounterCollection(JSON.stringify(packet(Array.from({ length: 201 }, fight)))), /limit/);
  assert.throws(() => importEncounterCollection(' '.repeat(16 * 1024 * 1024 + 1)), /limit/);
  const input = fight(); input.players[0].skills = Array.from({ length: 501 }, () => ({ damage: 1 }));
  assert.throws(() => importEncounterCollection(JSON.stringify(input)), /limit/);
});

test('unknown fields are not echoed or treated as authenticated capture data', () => {
  const input = fight(); input.privateToken = 'do-not-copy'; input.players[0].rawPacket = 'private'; input.total_damage = NaN;
  const raw = exportEncounterJson(input);
  assert.doesNotMatch(raw, /privateToken|do-not-copy|rawPacket|NaN/);
  assert.equal(JSON.parse(raw).encounters[0].total_damage, null);
});

test('export does not mutate the live encounter object', () => {
  const input = fight(), before = structuredClone(input);
  exportEncounterHtml(input, { anonymize: true, scope: 'personal' });
  exportEncounterCsv(input, { scope: 'party' });
  assert.deepEqual(input, before);
});

test('amount samples remain exact and anonymous references retain actor attribution', () => {
  const input = fight(); input.local_identity_source = 'name'; input.sample_complete = false; input.party_elapsed_ms = 50000;
  input.damage_samples = [
    { timestamp_ms: input.started_ms + 1, source: 700, player_id: 7, target: 50, skill: 5, amount: 1000, critical: true, tick: false, flags: 4, angle: 1 },
    { timestamp_ms: input.started_ms + 2, source: 8, player_id: 8, target: 50, skill: 6, amount: 2000, critical: false, tick: true, flags: 0, angle: 0 },
  ];
  const imported = importEncounterCollection(exportEncounterJson(input));
  assert.deepEqual(imported.encounters[0].damage_samples, input.damage_samples);
  assert.equal(imported.encounters[0].sample_complete, false);
  assert.equal(imported.encounters[0].local_identity_source, 'name');
  const own = JSON.parse(exportEncounterJson(input, { scope: 'personal', anonymize: true })).encounters[0];
  assert.equal(own.damage_samples.length, 1);
  assert.equal(own.damage_samples[0].player_id, own.players[0].id);
  assert.equal(own.damage_samples[0].target, own.targets[0].id);
  assert.equal(own.damage_samples[0].timestamp_ms, 1);
  assert.notEqual(own.damage_samples[0].source, 700);
  assert.equal(own.sample_complete, false);
  assert.equal(own.party_total_damage, null);
});

test('sample retention budgets reject excess instead of silently dropping timeline data', () => {
  const sample = { timestamp_ms: 1, source: 7, player_id: 7, target: 50, skill: 5, amount: 1 };
  const input = fight(); input.damage_samples = Array.from({ length: 20001 }, () => sample);
  assert.throws(() => exportEncounterJson(input), /limit/);
  input.damage_samples = Array.from({ length: 20000 }, () => sample);
  assert.throws(() => exportEncounterCsv(packet(Array.from({ length: 6 }, () => input))), /Collection sample limit/);
});

test('observed assistance and conditional max HP survive reports and anonymous ID mapping', () => {
  const input = fight(); input.targets[0].reported_max_hp = 9000;
  input.assist = { casts: [{ actor_id: 50, skill_id: 4, target_id: 7, started_ms: input.started_ms + 5, expires_ms: input.started_ms + 505, duration_ms: 500, source: 'server-windup' }], effects: [{ recipient_id: 7, caster_id: 50, instance_id: 17, effect_id: 100, duration_ms: null, started_ms: input.started_ms + 3, expires_ms: null, persistent: true, source: 'server-effect' }], timeline: [{ kind: 'effect-applied', at_ms: input.started_ms + 3, actor_id: 50, skill_id: 10, target_id: 7, instance_id: 17 }], health: [{ actor_id: 50, current_hp: 1000, reported_max_hp: 9000, observed_peak_hp: 8000, observed_at_ms: input.started_ms + 4 }], retention_limited: true };
  const plain = importEncounterCollection(exportEncounterJson(input)).encounters[0];
  assert.deepEqual(plain.assist, input.assist);
  assert.equal(plain.targets[0].reported_max_hp, 9000);
  const anonymous = JSON.parse(exportEncounterJson(input, { anonymize: true })).encounters[0];
  assert.equal(anonymous.assist.casts[0].target_id, anonymous.players[0].id);
  assert.equal(anonymous.assist.effects[0].caster_id, anonymous.targets[0].id);
  assert.equal(anonymous.assist.timeline[0].at_ms, 3);
  assert.equal(anonymous.assist.health[0].actor_id, anonymous.targets[0].id);
  assert.equal(anonymous.assist.effects[0].expires_ms, null);
  assert.match(exportEncounterCsv(input), /effect-applied/);
});

test('personal start clock and frozen observed build survive scoped export without exposing build identity', () => {
  const input = fight(); input.personal_started_ms = input.started_ms + 10000;
  input.character_build = { actor_id: 7, name: 'PrivateBuildName', server_id: 5018, observed_at_ms: input.started_ms - 1000, equipment: [{ entry_index: 0, slot: 1, item_id: 110150026, enchant: null, stones: null, stats: [{ stat_id: 282, value: 1068 }], godstone_id: 0, skill_bonuses: [] }], skills: [{ skill_id: 11010000, level: 12, base_level: 10 }], boards: [{ board_id: 11, node_ids: [110001] }], equipment_observed_at_ms: input.started_ms - 1000, skills_observed_at_ms: null, boards_observed_at_ms: null, equipment_complete: false, skills_complete: true, source: 'server-self' };
  const plain = JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0];
  assert.equal(plain.started_ms, input.personal_started_ms);
  assert.equal(plain.ended_ms, input.personal_started_ms + input.personal_elapsed_ms);
  assert.equal(plain.personal_started_ms, input.personal_started_ms);
  assert.deepEqual(plain.character_build, input.character_build);
  const hiddenText = exportEncounterJson(input, { scope: 'personal', anonymize: true });
  assert.doesNotMatch(hiddenText, /PrivateBuildName|5018/);
  const hidden = JSON.parse(hiddenText).encounters[0];
  assert.equal(hidden.personal_started_ms, 0);
  assert.equal(hidden.character_build.actor_id, hidden.players[0].id);
  assert.equal(hidden.character_build.observed_at_ms, 0);
  assert.equal(hidden.character_build.equipment[0].enchant, null);
  const imported = importEncounterCollection(hiddenText).encounters[0];
  assert.equal(imported.character_build.source, 'imported');
  assert.equal(imported.source, 'imported');
  assert.equal(input.character_build.name, 'PrivateBuildName');
});

test('build lists have explicit limits and unknown private metadata is excluded', () => {
  const input = fight(); input.character_build = { privateAccount: 'secret', equipment: Array.from({ length: 65 }, () => ({ item_id: 1 })) };
  assert.throws(() => exportEncounterJson(input), /limit/);
  input.character_build = { privateAccount: 'secret', equipment: [], skills: [], boards: [] };
  assert.doesNotMatch(exportEncounterJson(input), /privateAccount|secret/);
});

test('received body samples and ambiguity metadata stay in the selected actor scope', () => {
  const input = fight();
  input.unclassified_player_target_amount = 1000; input.unclassified_player_target_events = 5;
  Object.assign(input.players[0], { damage_taken:45, damage_taken_per_second:4.5, damage_taken_complete:false, damage_taken_started_ms:input.started_ms+1000, incoming_skills:[{id:55,name:'NPC hit',damage:45,hits:1}], unclassified_player_target_amount:100,unclassified_player_target_events:1 });
  Object.assign(input.players[1], { unclassified_player_target_amount:900,unclassified_player_target_events:4 });
  Object.assign(input, { personal_damage_taken:45,personal_damage_taken_per_second:4.5,personal_damage_taken_elapsed_ms:10000,personal_damage_taken_started_ms:input.started_ms+1000,personal_damage_taken_complete:false,personal_healing:null,personal_hps:null });
  const sample = { timestamp_ms:input.started_ms+2000,source:50,player_id:50,target:7,skill:55,amount:45,critical:false,tick:false,flags:0,angle:0,metric:'damage-taken' };
  input.received_samples = [sample,{...sample,target:8,amount:90}];
  const own = JSON.parse(exportEncounterJson(input,{scope:'personal'})).encounters[0];
  assert.equal(own.unclassified_player_target_amount,100); assert.equal(own.unclassified_player_target_events,1);
  assert.equal(own.received_samples.length,1); assert.equal(own.received_samples[0].amount,45);
  assert.equal(own.personal_damage_taken_complete,false); assert.equal(own.personal_hps,null);
  assert.equal(own.players[0].incoming_skills[0].damage,45);
  const anonymous = JSON.parse(exportEncounterJson(input,{scope:'personal',anonymize:true})).encounters[0];
  assert.equal(anonymous.received_samples[0].target,anonymous.local_player_id);
  assert.equal(anonymous.received_samples[0].timestamp_ms,2000);
  assert.equal(anonymous.personal_damage_taken_started_ms,1000);
  assert.equal(anonymous.players[0].damage_taken_started_ms,1000);
  assert.equal(JSON.parse(exportEncounterJson(input,{scope:'party'})).encounters[0].unclassified_player_target_amount,100);
  input.damage_samples = [{...sample,target:50,source:7,player_id:7,metric:''}];
  assert.equal(JSON.parse(exportEncounterJson(input)).encounters[0].damage_samples[0].amount,45);
  input.damage_samples[0].metric = 'healing';
  assert.throws(() => exportEncounterJson(input), /metric/);
});

test('a complete native 200-encounter history fits the report count limit', () => {
  const rows = Array.from({length:200},(_,index)=>({...fight(),id:index+1}));
  assert.equal(importEncounterCollection(exportEncounterJson(rows)).encounters.length,200);
});

test('offline HTML uses fixed K per-second DPS while total damage stays a full number', () => {
  const rates = [[193, '193'], [11700, '11.7K'], [999999, '1000K'], [1234567, '1234.57K'], [1234567890, '1234567.89K']];
  for (const [dps, expected] of rates) {
    const input = fight(); input.total_damage = 706821; input.dps = dps; input.players[0].dps = dps;
    for (const locale of ['tr', 'en']) {
      const report = exportEncounterHtml(input, { locale });
      const suffix = locale === 'tr' ? '/sn' : '/s';
      assert.ok(report.includes(`<small>DPS</small><b>${expected}${suffix}</b>`));
      assert.ok(report.includes(`<td>${expected}${suffix}</td>`));
      assert.ok(report.includes(`<b>${new Intl.NumberFormat(locale).format(706821)}</b>`));
      assert.doesNotMatch(report, /\dM\/(?:sn|s)/);
    }
    const numeric = JSON.parse(exportEncounterJson(input)).encounters[0];
    assert.equal(numeric.dps, dps); assert.equal(numeric.total_damage, 706821); assert.equal(numeric.players[0].dps, dps);
    assert.ok(exportEncounterCsv(input).includes(`,706821,${dps},`));
  }
});

test('offline HTML does not invent a numeric rate when DPS is unavailable', () => {
  const input = fight(); input.dps = null; input.players[0].dps = null;
  const report = exportEncounterHtml(input);
  assert.ok(report.includes('<small>DPS</small><b>—</b>'));
  assert.ok(report.includes('<td>—</td>'));
});

test('zero-duration history displays unknown DPS instead of accumulated damage as a rate', () => {
  for (const scope of ['observed', 'personal']) {
    const input = fight(); input.elapsed_ms = 0; input.personal_elapsed_ms = 0;
    input.dps = 3000; input.personal_dps = 1000; input.players[0].dps = 1000; input.players[1].dps = 2000;
    const report = exportEncounterHtml(input, { scope });
    assert.ok(report.includes('<small>DPS</small><b>—</b>'));
    assert.doesNotMatch(report, /\d(?:K)?\/sn/);
    assert.ok(report.includes('<td>—</td>'));
    const raw = JSON.parse(exportEncounterJson(input, { scope })).encounters[0];
    assert.equal(raw.elapsed_ms, 0); assert.equal(raw.dps, scope === 'personal' ? 1000 : 3000);
    assert.ok(exportEncounterCsv(input, { scope }).includes(`,${raw.total_damage},${raw.dps},`));
  }
});

function latencyFight() {
  const input = fight();
  input.network_latency = { source: 'windows-tcp-estats', samples: Array.from({ length: 61 }, (_, i) => ({ observed_at_ms: input.started_ms + i * 1000, rtt_ms: 10 + i % 3 * 10, latest_rtt_ms: 10 + i % 3 * 10, variation_ms: 2, measured_connections: 2 })), sample_count: 999, average_ms: 99999, minimum_ms: 99999, maximum_ms: 99999, median_ms: 99999, p95_ms: 99999, window_ms: 1, observed_span_ms: 1, partial: false, truncated: false };
  return input;
}

test('connection RTT survives JSON roundtrip with recomputed statistics and imported provenance', () => {
  const input = latencyFight(), expected = input.network_latency.samples.reduce((sum, sample) => sum + sample.rtt_ms, 0) / 61;
  const exported = JSON.parse(exportEncounterJson(input)).encounters[0];
  assert.equal(exported.network_latency.sample_count, 61); assert.equal(exported.network_latency.average_ms, expected);
  assert.equal(exported.network_latency.minimum_ms, 10); assert.equal(exported.network_latency.maximum_ms, 30); assert.equal(exported.network_latency.p95_ms, 30);
  assert.equal(exported.network_latency.window_ms, 60000); assert.equal(exported.network_latency.observed_span_ms, 60000);
  const imported = importEncounterCollection(exportEncounterJson(input)).encounters[0];
  assert.equal(imported.provenance, 'imported-unverified'); assert.equal(imported.network_latency.source, 'windows-tcp-estats');
  assert.deepEqual(imported.network_latency, exported.network_latency);
  assert.equal(input.network_latency.average_ms, 99999);
});

test('personal connection RTT exports trim only an explicitly known safe measurement clock', () => {
  const input = latencyFight(); input.personal_started_ms = input.started_ms + 10000;
  const selected = JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0];
  assert.equal(selected.network_latency.sample_count, 51); assert.equal(selected.network_latency.window_ms, 50000);
  assert.equal(selected.network_latency.samples[0].observed_at_ms, input.started_ms + 10000);
  assert.equal(selected.network_latency.samples.at(-1).observed_at_ms, input.ended_ms);
  assert.equal(selected.network_latency.partial, false);
  const unknownStart = latencyFight();
  const general = JSON.parse(exportEncounterJson(unknownStart, { scope: 'personal' })).encounters[0];
  assert.equal(general.network_latency.sample_count, 61); assert.equal(general.network_latency.window_ms, 60000);
  assert.match(exportEncounterHtml(unknownStart, { scope: 'personal', locale: 'en' }), /Encounter time window/);
});

test('party RTT can use a known explicit clock and never invents a party start from its elapsed duration', () => {
  const input = latencyFight(); input.party_elapsed_ms = 20000;
  const fallback = JSON.parse(exportEncounterJson(input, { scope: 'party' })).encounters[0];
  assert.equal(fallback.network_latency.sample_count, 61);
  input.party_started_ms = input.started_ms + 20000;
  const selected = JSON.parse(exportEncounterJson(input, { scope: 'party' })).encounters[0];
  assert.equal(selected.network_latency.sample_count, 21); assert.equal(selected.started_ms, input.party_started_ms);
  assert.equal(selected.ended_ms, input.party_started_ms + 20000); assert.equal(selected.network_latency.window_ms, 20000);
  const roundtrip = importEncounterCollection(exportEncounterJson(input, { scope: 'party' })).encounters[0];
  assert.deepEqual(roundtrip.network_latency, selected.network_latency);
});

test('scope exports keep the actual wall-clock interval when retained hits contradict an uninterrupted personal clock', () => {
  const input = latencyFight(); input.personal_started_ms = input.started_ms; input.personal_elapsed_ms = 30000;
  input.damage_samples = [0, 59000].map(offset => ({ timestamp_ms: input.started_ms + offset, source: 7, player_id: 7, target: 50, skill: 5, amount: 500 }));
  const selected = JSON.parse(exportEncounterJson(input, { scope: 'personal' })).encounters[0];
  assert.equal(selected.elapsed_ms, 30000); assert.equal(selected.ended_ms, input.ended_ms);
  assert.equal(selected.network_latency.sample_count, 61); assert.equal(selected.damage_samples.at(-1).timestamp_ms, input.started_ms + 59000);
});

test('anonymous connection RTT shifts every sample timestamp and permits a zero first sample on reimport', () => {
  const input = latencyFight(), before = structuredClone(input), text = exportEncounterJson(input, { anonymize: true });
  assert.equal(text.includes(String(input.started_ms)), false); assert.equal(text.includes(String(input.ended_ms)), false);
  const selected = JSON.parse(text).encounters[0];
  assert.equal(selected.network_latency.samples[0].observed_at_ms, 0); assert.equal(selected.network_latency.samples.at(-1).observed_at_ms, 60000);
  assert.equal(selected.network_latency.sample_count, 61);
  const imported = importEncounterCollection(text).encounters[0];
  assert.deepEqual(imported.network_latency, selected.network_latency);
  assert.deepEqual(input, before);
  const scoped = JSON.parse(exportEncounterJson({ ...input, personal_started_ms: input.started_ms + 10000 }, { scope: 'personal', anonymize: true })).encounters[0];
  assert.equal(scoped.network_latency.samples[0].observed_at_ms, 0); assert.equal(scoped.network_latency.samples.at(-1).observed_at_ms, 50000);
});

test('RTT samples and summary export no connection addresses, actor attribution or unknown private metadata', () => {
  const input = latencyFight(), secret = 'PRIVATE_CONNECTION_DO_NOT_COPY';
  input.network_latency.ip = secret; input.network_latency.connection = secret; input.network_latency.samples[0].remote_addr = secret; input.network_latency.samples[0].actor_id = 12345;
  for (const text of [exportEncounterJson(input), exportEncounterCsv(input), exportEncounterHtml(input)]) assert.equal(text.includes(secret), false);
  const result = JSON.parse(exportEncounterJson(input)).encounters[0].network_latency;
  assert.equal(JSON.stringify(result).includes('actor_id'), false); assert.equal(JSON.stringify(result).includes('remote_addr'), false);
});

test('CSV appends clearly labelled connection RTT rows with no player or actor association and rectangular columns', () => {
  const csv = exportEncounterCsv(latencyFight()), lines = csv.trimEnd().split('\r\n'), columns = lines[0].split(',');
  assert.equal(columns.length, 50); assert.ok(columns.includes('connection_rtt_ms')); assert.ok(columns.includes('connection_rtt_average_ms'));
  const rows = lines.slice(1).map(line => Object.fromEntries(line.split(',').map((value, index) => [columns[index], value])));
  assert.equal(rows.filter(row => row.row_type === 'connection-rtt-summary').length, 1);
  const samples = rows.filter(row => row.row_type === 'connection-rtt-sample'); assert.equal(samples.length, 61);
  for (const row of samples) { assert.equal(row.player, ''); assert.equal(row.player_id, ''); assert.equal(row.source_actor, ''); assert.equal(row.connection_rtt_source, 'windows-tcp-estats'); assert.equal(row.skill_or_target, 'Game TCP connection set'); }
  assert.equal(lines.every(line => line.split(',').length === columns.length), true);
  assert.equal(samples[0].connection_rtt_ms, '10'); assert.equal(samples[0].connection_rtt_measured_connections, '2');
  assert.equal(exportEncounterCsv(fight()).split('\r\n')[0].split(',').length, 35);
});

test('offline RTT HTML includes its own compact styles and SVG while staying local and showing imported provenance', () => {
  const input = importEncounterCollection(exportEncounterJson(latencyFight()));
  const html = exportEncounterHtml(input, { locale: 'en' });
  assert.match(html, /Encounter connection RTT/); assert.match(html, /Imported · unverified/);
  assert.match(html, /\.latency-history \.analysis-metrics\{/); assert.match(html, /--accent:#8de2d6/);
  assert.match(html, /<svg viewBox="0 0 480 100"/); assert.match(html, />P95</); assert.match(html, />30 ms</);
  assert.doesNotMatch(html, /<script|<link|<iframe|<img|https?:\/\//i);
  assert.match(html, /default-src 'none'/);
});

test('unsupported or malformed RTT sources cannot fabricate exported statistics or break ordinary damage reports', () => {
  for (const source of ['icmp', 'other-meter', null]) {
    const input = latencyFight(); input.network_latency.source = source;
    assert.equal(Object.hasOwn(JSON.parse(exportEncounterJson(input)).encounters[0], 'network_latency'), false);
    assert.equal(exportEncounterCsv(input).includes('connection-rtt-summary'), false);
    assert.equal(exportEncounterHtml(input).includes('latency-history"><'), false);
  }
  const input = latencyFight(); input.network_latency.samples[0].rtt_ms = NaN;
  const result = JSON.parse(exportEncounterJson(input)).encounters[0];
  assert.equal(result.network_latency.sample_count, 60); assert.equal(result.network_latency.partial, true);
  assert.equal(result.total_damage, 3000);
});
