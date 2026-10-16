import test from 'node:test';
import assert from 'node:assert/strict';
import { runContext, groupEncounterRuns, renderRunHistory } from '../run-history.mjs';

const record = (id = 1, start = 100000) => ({ id, started_ms: start, ended_ms: start + 10000, elapsed_ms: 10000, source: 'captured', provenance: 'received', name: 'Encounter', sample_complete: true, local_player_id: 1, local_player_name: 'center', local_identity_source: 'server', personal_total_damage: 1000, personal_dps: 100, total_damage: 5000, dps: 500, players: [{ id: 1, name: 'center', damage: 1000 }], targets: [{ id: 99, name: 'Boss', is_boss: true }] });
const context = (session = 'one', instance = 22, map = 11) => ({ source: 'server', session_id: session, instance_id: instance, map_id: map, instance_kind: 'dungeon', instance_name: 'Nightmare' });

test('adjacent fights without received context are local sessions, never verified dungeon clears', () => {
  const value = groupEncounterRuns([record(2, 130000), record(1)]);
  assert.equal(value.groups.length, 1); const group = value.groups[0];
  assert.equal(group.kind, 'session'); assert.equal(group.verified_dungeon, false); assert.equal(group.completion, 'unknown');
  assert.equal(group.encounter_count, 2); assert.equal(group.damage, 2000);
  assert.equal(group.combat_ms, 20000); assert.equal(group.wall_ms, 40000); assert.equal(group.idle_ms, 20000);
  assert.equal(group.dps, 100); assert.equal(group.boss_encounter_count, 2);
  assert.deepEqual(group.unique_boss_names, ['Boss']);
});

test('explicit server instance plus session identity permits a dungeon group without claiming completion', () => {
  const records = [record(1), record(2, 120000)].map(row => ({ ...row, context: context() }));
  const group = groupEncounterRuns(records).groups[0];
  assert.equal(group.kind, 'dungeon'); assert.equal(group.verified_dungeon, true);
  assert.equal(group.completion, 'unknown'); assert.equal(group.context.name, 'Nightmare');
  assert.equal(group.records.length, 2);
});

test('manual labels, map alone or reused instance identity without session do not verify dungeon grouping', () => {
  assert.equal(runContext({ context: { ...context(), source: 'manual' } }), null);
  assert.equal(runContext({ context: { source: 'server', map_id: 10 } }).kind, 'map-session');
  assert.equal(runContext({ context: { ...context(), session_id: null } }).kind, 'map-session');
  const group = groupEncounterRuns([{ ...record(), category: 'Dungeon', difficulty: 'Nightmare' }]).groups[0];
  assert.equal(group.kind, 'session'); assert.equal(group.verified_dungeon, false);
});

test('session, map, instance, character and gap changes split groups', () => {
  const cases = [
    [{ ...record(1), context: context() }, { ...record(2, 120000), context: context('two') }],
    [{ ...record(1), context: context() }, { ...record(2, 120000), context: context('one', 22, 12) }],
    [{ ...record(1), context: context() }, { ...record(2, 120000), context: context('one', 23) }],
    [record(1), { ...record(2, 120000), local_player_name: 'other' }],
    [record(1), record(2, 720001)],
    [record(1), { ...record(2, 120000), local_identity_source: 'unresolved' }],
  ];
  for (const records of cases) assert.equal(groupEncounterRuns(records).groups.length, 2);
  assert.equal(groupEncounterRuns([record(1), record(2, 120000)], { gapMs: 0 }).groups.length, 2);
});

test('imported and unknown records remain standalone and cannot join received sessions', () => {
  const imported = id => ({ ...record(id, 0), source: 'imported', provenance: 'imported-unverified', context: context() });
  const value = groupEncounterRuns([record(1), imported(2), imported(3), { ...record(4), source: undefined, provenance: undefined }]);
  assert.equal(value.groups.length, 4);
  for (const group of value.groups.filter(row => row.source === 'imported')) { assert.equal(group.kind, 'imported-encounter'); assert.equal(group.verified_dungeon, false); assert.equal(group.partial, true); }
});

test('overlapping records use a time union instead of doubling combat duration', () => {
  const group = groupEncounterRuns([record(1), record(2, 105000)]).groups[0];
  assert.equal(group.combat_ms, 15000); assert.equal(group.wall_ms, 15000); assert.equal(group.idle_ms, 0);
  assert.equal(group.dps, 2000000 / 15000);
});

test('scope arithmetic never replaces unknown personal or party identity with nearby totals', () => {
  const input = { ...record(), local_identity_source: 'unresolved' };
  assert.equal(groupEncounterRuns([input]).groups[0].damage, null);
  assert.equal(groupEncounterRuns([input]).groups[0].dps, null);
  assert.equal(groupEncounterRuns([input], { scope: 'observed' }).groups[0].damage, 5000);
  assert.equal(groupEncounterRuns([record()], { scope: 'party' }).groups[0].scope_known, false);
  const party = { ...record(), party_member_ids: [1], party_membership_source: 'server', party_total_damage: 1200 };
  assert.equal(groupEncounterRuns([party], { scope: 'party' }).groups[0].damage, 1200);
});

test('zero damage is retained, invalid timing is isolated and sparse history discloses limits', () => {
  const zero = { ...record(), personal_total_damage: 0 };
  assert.equal(groupEncounterRuns([zero]).groups[0].damage, 0);
  const bad = { ...record(2), timing_valid: false };
  const value = groupEncounterRuns([zero, bad]);
  assert.equal(value.groups.length, 2); assert.equal(value.groups.find(group => group.records[0].id === '2').partial, true);
  const many = groupEncounterRuns(Array.from({ length: 201 }, (_, i) => record(i + 1, 100000 + i * 10000)));
  assert.equal(many.record_count, 200); assert.equal(many.limited, true); assert.equal(many.groups[0].partial, true);
});

test('rendering escapes received labels and states grouping limits without fabricating completion', () => {
  const input = { ...record(), context: { ...context(), instance_name: '<img src=x onerror=1>' }, targets: [{ id: 99, is_boss: true, name: '<script>bad</script>' }] };
  const html = renderRunHistory([input], { locale: 'en' });
  assert.equal(html.includes('<img src='), false); assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;img/); assert.match(html, /not verified dungeon clears/); assert.match(html, /Received dungeon instance/);
  assert.match(renderRunHistory([], { locale: 'tr' }), /Kaydedilmiş karşılaşma yok/);
});
