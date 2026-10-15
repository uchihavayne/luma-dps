import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, normalizePreferences, normalizeEncounter, importTheme, exportTheme, compactNumber, formatRate, playerMetricLabel, playerBarColor, classColor } from '../model.mjs';
import { scopedEncounter, meterScopes, ownPlayer, skillSummary, sortedSkills } from '../scope.mjs';

const nearby = () => normalizeState({
  total_damage: 9000, dps: 900, elapsed_ms: 10000,
  players: [{ id: 1, name: 'Stranger', damage: 7000, dps: 700 }, { id: 2, name: 'Me', damage: 2000, dps: 200 }],
  targets: [{ id: 50, name: 'Target', damage: 9000 }],
});

test('personal is the default and never silently totals nearby damage before identifying the user', () => {
  const state = nearby(), prefs = normalizePreferences();
  assert.equal(prefs.damageScope, 'personal');
  const scoped = scopedEncounter(state, prefs.damageScope);
  assert.equal(scoped.known, false); assert.equal(scoped.damage, null); assert.equal(scoped.dps, null);
  assert.deepEqual(scoped.players, []); assert.deepEqual(scoped.targets, []);
  assert.equal(ownPlayer(state), null);
});

test('the default roster shows nearby names and DPS independently of an unidentified personal summary', () => {
  const prefs = normalizePreferences({ damageScope: 'personal' });
  const view = meterScopes(nearby(), prefs);
  assert.equal(prefs.rosterScope, 'observed');
  assert.deepEqual(view.roster.players.map(player => player.name), ['Stranger', 'Me']);
  assert.deepEqual(view.roster.players.map(player => player.dps), [700, 200]);
  assert.equal(view.summary.known, false); assert.equal(view.summary.damage, null);
  assert.equal(view.summaries.observed.damage, 9000);
  assert.equal(view.summaries.party.known, false);
});

test('own, party and nearby totals remain distinct while roster filtering changes', () => {
  const state = normalizeState({ ...nearby(), local_player_id: 2, local_identity_source: 'server', personal_total_damage: 2000, personal_dps: 200, party_member_ids: [2], party_membership_source: 'server', party_total_damage: 2000, party_dps: 200 });
  const defaults = normalizePreferences();
  const all = meterScopes(state, defaults);
  assert.equal(all.roster.players.length, 2); assert.equal(all.summary.damage, 2000);
  const party = meterScopes(state, { ...defaults, rosterScope: 'party' });
  assert.deepEqual(party.roster.players.map(player => player.name), ['Me']);
  assert.equal(party.summary.damage, 2000); assert.equal(party.summaries.observed.damage, 9000);
  assert.equal(party.fallback, false);
  const waiting = meterScopes(nearby(), { rosterScope: 'party' });
  assert.equal(waiting.fallback, true); assert.equal(waiting.roster.scope, 'observed');
  assert.equal(waiting.summaries.party.damage, null); assert.equal(waiting.roster.players.length, 2);
});

test('performance color follows relative DPS and class or theme choices remain independent', () => {
  const player = { dps: 800, class_name: 'Ranger' };
  assert.match(playerBarColor(player, 1000), /^#[0-9a-f]{6}$/);
  assert.notEqual(playerBarColor(player, 1000), playerBarColor({ ...player, dps: 200 }, 1000));
  assert.equal(playerBarColor(player, 1000), playerBarColor({ ...player, dps: 1600 }, 2000));
  assert.equal(playerBarColor(player, 1000, 'class'), classColor('Ranger'));
  assert.equal(playerBarColor(player, 1000, 'accent', '#123456'), '#123456');
  for (const dps of [null, NaN, Infinity, -1, 0]) assert.match(playerBarColor({ dps }, 0), /^#[0-9a-f]{6}$/);
});

test('an explicit local actor shows only personal damage even when a stranger has the highest damage', () => {
  const state = normalizeState({ ...nearby(), local_player_id: 2, local_identity_source: 'manual', personal_total_damage: 2000, personal_dps: 200, personal_elapsed_ms: 10000, personal_targets: [{ id: 50, damage: 2000 }] });
  const scoped = scopedEncounter(state);
  assert.equal(scoped.known, true); assert.equal(scoped.damage, 2000); assert.equal(scoped.dps, 200);
  assert.deepEqual(scoped.players.map(player => player.name), ['Me']); assert.equal(ownPlayer(state).id, '2');
  assert.equal(scoped.targets[0].damage, 2000);
  assert.equal(state.total_damage, 9000);
});

test('name strings do not independently guess local identity or party membership', () => {
  const state = normalizeState({ ...nearby(), local_player_name: 'Me' });
  assert.equal(scopedEncounter(state).known, false);
  assert.equal(scopedEncounter(state, 'party').known, false);
  assert.equal(scopedEncounter(state, 'party').damage, null);
});

test('party visibility requires membership evidence even if every observed actor has an in_party flag', () => {
  const state = normalizeState({ ...nearby(), players: nearby().players.map(player => ({ ...player, in_party: true })) });
  assert.equal(scopedEncounter(state, 'party').known, false);
  assert.deepEqual(scopedEncounter(state, 'party').players, []);
});

test('an explicit manual roster excludes nearby strangers and an empty known roster stays empty', () => {
  const state = normalizeState({ ...nearby(), party_member_ids: [2], party_membership_source: 'manual', party_total_damage: 2000, party_dps: 200 });
  assert.deepEqual(scopedEncounter(state, 'party').players.map(player => player.id), ['2']);
  assert.equal(scopedEncounter(state, 'party').damage, 2000);
  const empty = scopedEncounter(normalizeState({ ...nearby(), party_membership_source: 'manual', party_member_ids: [] }), 'party');
  assert.equal(empty.known, true); assert.equal(empty.damage, 0); assert.deepEqual(empty.players, []);
});

test('all observed actors and totals require an explicit observed scope', () => {
  const scoped = scopedEncounter(nearby(), 'observed');
  assert.equal(scoped.damage, 9000); assert.equal(scoped.dps, 900); assert.equal(scoped.players.length, 2);
});

test('invalid personal metrics stay unknown while a confirmed actor with no hits has measured zero', () => {
  const invalid = normalizeState({ personal_total_damage: NaN, personal_dps: Infinity });
  assert.equal(invalid.personal_total_damage, null); assert.equal(invalid.personal_dps, null);
  const known = normalizeState({ local_player_id: 1, local_identity_source: 'server' });
  assert.equal(scopedEncounter(known).known, true); assert.equal(scopedEncounter(known).damage, 0);
});

test('appearance export roundtrip includes layout but never exports identity, roster or scope preferences', () => {
  const encoded = exportTheme({ layout: 'glass', density: 'compact', rowMetric: 'damage', showClass: false, showShares: false, characterName: 'Private name', damageScope: 'party' });
  const decoded = importTheme(encoded);
  assert.equal(decoded.layout, 'glass'); assert.equal(decoded.density, 'compact'); assert.equal(decoded.rowMetric, 'damage');
  assert.equal(decoded.showClass, false); assert.equal(decoded.showShares, false);
  assert.equal('characterName' in decoded, false); assert.equal('damageScope' in decoded, false);
  assert.equal(encoded.includes('Private name'), false);
});

test('skill summary uses weighted critical rate and guards empty totals; sort does not mutate data', () => {
  const skills = [{ name: 'A', hits: 2, crit_hits: 2, damage: 100 }, { name: 'B', hits: 8, crit_hits: 2, damage: 900 }];
  const summary = skillSummary({ damage: 1000, skills }, 10000);
  assert.equal(summary.criticalRate, 40); assert.equal(summary.average, 100); assert.equal(summary.dps, 100);
  assert.equal(skillSummary({ skills: [] }).average, 0);
  assert.deepEqual(sortedSkills(skills, 'crit').map(skill => skill.name), ['A', 'B']);
  assert.deepEqual(sortedSkills(skills, 'damage').map(skill => skill.name), ['B', 'A']);
  assert.equal(skills[0].name, 'A');
});

test('a scoped imported report keeps measured totals but an unresolved report stays unknown', () => {
  const imported = normalizeEncounter({ actor_scope: 'personal', provenance: 'imported-unverified', total_damage: 500, dps: 50, players: [{ id: 'Player-1', name: 'Player 1', damage: 500, dps: 50 }] });
  assert.equal(scopedEncounter(imported).damage, 500); assert.equal(scopedEncounter(imported).players.length, 1);
  const unknown = normalizeEncounter({ actor_scope: 'personal', provenance: 'imported-unverified', total_damage: null, dps: null });
  assert.equal(unknown.total_damage, null); assert.equal(scopedEncounter(unknown).known, false);
});

test('compact meter numbers keep meaningful precision and unambiguous k/M units across locales', () => {
  assert.equal(compactNumber(4040.82, 'tr'), '4.04K'); assert.equal(compactNumber(594000, 'tr'), '594K');
  assert.equal(compactNumber(2856000, 'tr'), '2.86M'); assert.equal(compactNumber(4040.82, 'en'), '4.04K');
  assert.equal(compactNumber(999999), '1M'); assert.equal(compactNumber(91.6, 'tr', 0), '92');
  assert.equal(compactNumber(NaN), '0');
});

test('exact name-match identity is accepted while conflicting row flags cannot override the local ID', () => {
  const state = normalizeState({ ...nearby(), local_player_id: 2, local_identity_source: 'name-match', personal_dps: 400, personal_elapsed_ms: 5000, players: [{ ...nearby().players[0], is_local: true }, nearby().players[1]] });
  assert.deepEqual(scopedEncounter(state).players.map(player => player.id), ['2']);
  assert.equal(scopedEncounter(state).players[0].dps, 400); assert.equal(state.players[1].dps, 200);
});

test('rate values explicitly show seconds in the selected language while totals keep their own units', () => {
  assert.equal(formatRate(12300, 'tr'), '12.3K/sn'); assert.equal(formatRate(12300, 'en'), '12.3K/s');
  assert.equal(formatRate(0, 'tr'), '0/sn'); assert.equal(formatRate(1234567, 'tr'), '1234.57K/sn');
  assert.equal(formatRate(999999, 'tr'), '1000K/sn');
  assert.equal(formatRate(1000000, 'en', 0), '1000K/s');
  assert.equal(formatRate(193, 'tr'), '193/sn');
  assert.equal(formatRate(11700, 'tr'), '11.7K/sn');
  assert.equal(compactNumber(708820, 'tr'), '708.82K');
  assert.equal(formatRate(1234567890, 'en'), '1234567.89K/s');
  assert.equal(formatRate(null), '—'); assert.equal(formatRate(NaN), '—');
  assert.equal(compactNumber(12300), '12.3K'); assert.equal(compactNumber(12300).includes('/'), false);
});

test('header summary and row metric choices are independent and appearance exports do not include personal scope', () => {
  for (const summaryMetric of ['dps', 'damage', 'both']) for (const rowMetric of ['dps', 'damage', 'both']) {
    const prefs = normalizePreferences({ summaryMetric, rowMetric, damageScope: 'party', characterName: 'Private' });
    assert.equal(prefs.summaryMetric, summaryMetric); assert.equal(prefs.rowMetric, rowMetric);
    const theme = importTheme(exportTheme(prefs));
    assert.equal(theme.summaryMetric, summaryMetric); assert.equal(theme.rowMetric, rowMetric);
    assert.equal('damageScope' in theme, false); assert.equal('characterName' in theme, false);
  }
  assert.equal(normalizePreferences().summaryMetric, 'both');
  assert.equal(normalizePreferences({ summaryMetric: 'invalid' }).summaryMetric, 'both');
});

test('screen-reader row metrics match the visible damage, rate or both selection', () => {
  const player = { damage: 594000, dps: 4040.82 };
  assert.equal(playerMetricLabel(player, 'damage', 'tr'), '594K toplam hasar');
  assert.equal(playerMetricLabel(player, 'dps', 'tr'), '4.04K/sn DPS');
  assert.equal(playerMetricLabel(player, 'both', 'en'), '594K total damage, 4.04K/s DPS');
});

test('a legacy zero-duration record preserves damage but cannot report total damage as DPS', () => {
  const record = normalizeEncounter({ total_damage: 8605252, dps: 8605252, elapsed_ms: 0, started_ms: 550085638326210, local_player_id: 2, local_identity_source: 'server', personal_total_damage: 2408764, personal_dps: 2408764, personal_elapsed_ms: 0, party_membership_source: 'server', party_member_ids: [2], party_total_damage: 2408764, party_dps: 2408764, players: [{ id: 2, damage: 2408764, dps: 2408764, in_party: true }] });
  assert.equal(record.timing_valid, false); assert.equal(record.timestamp, '');
  for (const scope of ['personal', 'party', 'observed']) {
    const selected = scopedEncounter(record, scope);
    assert.equal(selected.known, true); assert.equal(selected.dps, null);
    assert.equal(selected.players[0].dps, null); assert.equal(formatRate(selected.dps), '—');
    assert.equal(selected.damage, scope === 'observed' ? 8605252 : 2408764);
  }
  assert.equal(record.dps, 8605252);
  assert.equal(normalizeEncounter({ total_damage: 1200000, dps: 20000, elapsed_ms: 60000 }).timing_valid, true);
});
