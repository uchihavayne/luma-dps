import test from 'node:test';
import assert from 'node:assert/strict';
import { importEncounterCollection, exportEncounterCsv, exportEncounterHtml, exportEncounterJson } from '../reports.mjs';

const fight = () => ({ id: 3, started_ms: 1791882000123, ended_ms: 1791882060123, elapsed_ms: 60000, total_damage: 3000, dps: 50, local_player_id: 7, local_player_name: 'Self', local_identity_source: 'server', personal_total_damage: 1000, personal_dps: 20, personal_elapsed_ms: 50000, personal_targets: [{ id: 50, name: 'Boss', damage: 1000 }], party_member_ids: [7], party_membership_source: 'server', party_total_damage: 1000, party_dps: 20, party_targets: [{ id: 50, name: 'Boss', damage: 1000 }], players: [{ id: 7, name: 'Self', is_local: true, in_party: true, class_name: 'ranger', damage: 1000, dps: 20, skills: [{ id: 5, name: 'Arrow', damage: 1000, hits: 5, crit_hits: null, back_hits: 2 }] }, { id: 8, name: 'Nearby', damage: 2000, dps: 40, class_name: 'cleric', skills: [] }], targets: [{ id: 50, name: 'Boss', is_boss: true, damage: 3000, current_hp: 1000, observed_peak_hp: 8000 }], note: 'Private build', tags: ['guild'] });
const packet = records => ({ type: 'luma-history', version: 1, encounters: records });

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
