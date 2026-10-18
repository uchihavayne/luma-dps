import test from 'node:test';
import assert from 'node:assert/strict';
import { focusedTarget, targetVital, bossRoster, targetSummary, bossPresentation, targetBoardChoices } from '../bosses.mjs';

const player = (id, damage, extra = {}) => ({ id, name: `Player${id}`, class_name: 'Ranger', damage, dps: damage / 10, identity_confirmed: true, ...extra });
const target = (extra = {}) => ({ id: 900, name: 'Received boss', is_boss: true, damage: 1000, elapsed_ms: 10_000,
  current_hp: 50, reported_max_hp: 100, current_hp_observed_at_ms: 10_000,
  participants_available: true, participant_count: 2, participants: [player(2, 900), player(1, 100, { is_local: true })],
  own_participant: player(1, 100, { is_local: true }), own_rank: 2, own_last_hit_ms: 10_000,
  party_total_damage: null, party_dps: null, capture_complete: true, ...extra });
const state = (extra = {}) => ({ local_player_id: 1, local_identity_source: 'server', party_membership_source: 'unresolved', focused_target_id: 900, focused_target_observed_at_ms: 10_000, targets: [target()], ...extra });

test('focus follows the received last own target rather than largest accumulated damage', () => {
  const next = target({ id: 901, name: 'Next received target', own_last_hit_ms: 11_000 });
  const value = state({ focused_target_id: 901, focused_target_observed_at_ms: 11_000, targets: [target({ damage: 99_999_999 }), next] });
  assert.equal(focusedTarget(value, 12_000).target.id, 901);
  assert.equal(focusedTarget(value, 12_000).source, 'personal-hit');
});

test('independent live target remains visible when a boss category filter removes ordinary targets', () => {
  const value = state({ targets: [], live_target: target({ is_boss: false }) });
  const result = bossPresentation(value, { now: 11_000 });
  assert.equal(result.target.id, 900);
  assert.equal(result.vital.percent, 50);
  assert.equal(result.automatic, true);
  assert.equal(result.roster.kind, 'target');
  assert.equal(result.roster.totalDamage, 1000);
});

test('stale, future and capture-invalidated own observations cannot supply a target', () => {
  assert.equal(focusedTarget(state(), 20_000).target, null);
  assert.equal(focusedTarget(state(), 9999).target, null);
  const lost = state({ focused_target_id: null, focused_target_observed_at_ms: null,
    targets: [target({ own_last_hit_ms: null, last_hit_ms: 11_999 })] });
  assert.equal(focusedTarget(lost, 12_000).target, null);
});

test('fallback uses fresh actual own boss hits and never an unrelated observed boss', () => {
  const value = state({ focused_target_id: null, focused_target_observed_at_ms: null,
    targets: [target({ id: 8, own_last_hit_ms: 9000 }), target({ id: 9, own_last_hit_ms: 10_000 })] });
  assert.equal(focusedTarget(value, 11_000).target.id, 9);
  assert.equal(focusedTarget(state({ focused_target_id: null, targets: [target({ own_participant: null })] }), 11_000).target, null);
});

test('fresh actual HP uses only the reported maximum; zero remains a received death value', () => {
  assert.equal(targetVital(target(), 11_000).percent, 50);
  const dead = targetVital(target({ current_hp: 0 }), 11_000);
  assert.equal(dead.status, 'dead'); assert.equal(dead.percent, 0); assert.equal(dead.current, 0);
  const unknownMax = targetVital(target({ reported_max_hp: null, observed_peak_hp: 200 }), 11_000);
  assert.equal(unknownMax.current, 50); assert.equal(unknownMax.max, null); assert.equal(unknownMax.percent, null);
});

test('a maximum-only update cannot rejuvenate current HP and invalid maxima never clamp a bar', () => {
  const stale = targetVital(target({ current_hp_observed_at_ms: 1000, health_observed_at_ms: 10_999 }), 11_000);
  assert.equal(stale.status, 'stale'); assert.equal(stale.current, 50); assert.equal(stale.percent, null);
  const invalid = targetVital(target({ current_hp: 200, reported_max_hp: 100 }), 11_000);
  assert.equal(invalid.current, 200); assert.equal(invalid.maximumKnown, false); assert.equal(invalid.percent, null);
  assert.equal(targetVital(target({ current_hp_observed_at_ms: null }), 11_000).status, 'unknown');
});

test('nearby non-party contributors appear in the observed target board', () => {
  const result = bossPresentation(state(), { now: 11_000, rosterScope: 'party' });
  assert.equal(result.automatic, true); assert.equal(result.roster.scope, 'observed-target');
  assert.deepEqual(result.roster.rows.map(row => row.id), ['2', '1']);
  assert.equal(result.roster.rows[0].in_party, false);
  assert.equal(result.roster.totalDamage, 1000);
});

test('only ten positive contributors are displayed; unknown identities remain eligible', () => {
  const values = Array.from({ length: 12 }, (_, index) => player(index + 1, 1200 - index * 10));
  values[0].name = 'Unknown'; values[0].identity_confirmed = false;
  const result = bossRoster(target({ participants: values, participant_count: 12, damage: 20_000 }));
  assert.equal(result.rows.length, 10); assert.equal(result.participantCount, 12);
  assert.equal(result.rows[0].name, '#1'); assert.equal(result.rows[0].identity_confirmed, false);
  assert.equal(bossRoster(target({ participants: [player(2, 0)] })), null);
});

test('own contribution and rank remain available below the first ten without inflating party totals', () => {
  const value = target({ own_participant: player(99, 20), own_rank: 15,
    participant_count: 15, party_total_damage: 45, party_dps: 4.5 });
  const result = bossRoster(value, state({ local_player_id: 99 }));
  assert.equal(result.own.id, '99'); assert.equal(result.ownRank, 15);
  const summary = targetSummary(value, state({ local_player_id: 99, party_membership_source: 'server' }), 'party');
  assert.equal(summary.totalDamage, 45); assert.equal(summary.dps, 4.5);
  assert.notEqual(summary.totalDamage, result.rows.reduce((sum, row) => sum + row.damage, 0));
});

test('unresolved own or party metadata never supplies personal rank or scoped totals', () => {
  const unresolved = state({ local_identity_source: 'unresolved' });
  const board = bossRoster(target(), unresolved);
  assert.equal(board.own, null); assert.equal(board.ownRank, null);
  assert.ok(board.rows.every(row => !row.is_local));
  assert.equal(targetSummary(target(), unresolved, 'personal').known, false);
  assert.equal(targetSummary(target({ party_total_damage: 123, party_dps: 12.3 }), unresolved, 'party').known, false);
  assert.equal(bossRoster(target({ own_participant: player(8, 100) }), state()).own, null);
  assert.equal(targetSummary(target({ own_participant: player(8, 100) }), state(), 'personal').known, false);
});

test('simultaneous own hits on two bosses do not guess a fallback target', () => {
  const value = state({ focused_target_id: null, focused_target_observed_at_ms: null,
    targets: [target({ id: 8 }), target({ id: 9 })] });
  assert.equal(focusedTarget(value, 11_000).target, null);
});

test('header scope remains personal or party while roster is observed target damage', () => {
  const own = bossPresentation(state(), { now: 11_000, damageScope: 'personal' });
  assert.equal(own.summary.totalDamage, 100); assert.equal(own.summary.dps, 10);
  assert.equal(own.roster.totalDamage, 1000);
  const party = bossPresentation(state(), { now: 11_000, damageScope: 'party' });
  assert.equal(party.summary.known, false); assert.equal(party.summary.totalDamage, null);
  assert.equal(targetSummary(target(), state({ local_player_id: null }), 'personal').known, false);
});

test('partial capture is marked; an unclassified multi-player target is not mislabeled as a boss', () => {
  assert.equal(bossRoster(target(), { diagnostics: { stream_gaps: 1 } }).complete, false);
  const ordinary = target({ is_boss: false });
  const result = bossPresentation(state({ targets: [ordinary] }), { now: 11_000 });
  assert.equal(result.target.id, 900); assert.equal(result.automatic, true); assert.equal(result.roster.kind, 'target');
  const solo = target({ is_boss: false, participant_count: 1, participants: [player(1, 1000)] });
  assert.equal(bossPresentation(state({ targets: [solo] }), { now: 11_000 }).automatic, false);
  assert.equal(bossPresentation(state(), { now: 11_000, autoBossRoster: false }).automatic, false);
});

test('explicit shared-target selection remains available after personal focus expires and boss filtering hides the target', () => {
  const shared = target({ is_boss: false, participant_count: 171, own_rank: 99, own_last_hit_ms: 1000 });
  const value = state({ encounter_active: true, focused_target_id: null, focused_target_observed_at_ms: null, targets: [], observed_targets: [shared] });
  assert.equal(bossPresentation(value, { now: 30_000 }).roster, null);
  const choices = targetBoardChoices(value);
  assert.deepEqual(choices.map(row => row.id), [900]);
  const selected = bossPresentation(value, { now: 30_000, autoBossRoster: false, selectedTargetId: '900' });
  assert.equal(selected.focusSource, 'user-selected-target'); assert.equal(selected.automatic, false);
  assert.equal(selected.selectionAvailable, true); assert.equal(selected.roster.kind, 'target');
  assert.equal(selected.roster.participantCount, 171); assert.equal(selected.summary.totalDamage, 100);
  assert.equal(selected.vital.status, 'stale'); assert.equal(selected.vital.percent, null);
});

test('board choices merge only current received target lists, prefer the live DTO and keep unknown boss classification', () => {
  const current = target({ id: 901, name: 'Fresh shared target', is_boss: false, damage: 1000 });
  const value = state({ live_target: current, observed_targets: [target({ id: 901, name: 'Older copy' }), target({ id: 902, damage: 2000 })],
    targets: [target({ id: 901, name: 'Filtered duplicate' }), target({ id: 903, participants_available: false }), target({ id: 904, is_boss: false, participant_count: 1 })] });
  const choices = targetBoardChoices(value);
  assert.deepEqual(choices.map(row => row.id), [902, 901]);
  assert.equal(choices[1].name, 'Fresh shared target'); assert.equal(choices[1].is_boss, false);
  assert.equal(value.observed_targets.length, 2); assert.equal(value.targets.length, 3);
});

test('a missing explicit target never substitutes an unrelated board from another encounter', () => {
  const next = state({ targets: [target({ id: 901 })], focused_target_id: 901 });
  const selected = bossPresentation(next, { now: 11_000, selectedTargetId: 900, autoBossRoster: true });
  assert.equal(selected.target, null); assert.equal(selected.roster, null);
  assert.equal(selected.selectionAvailable, false); assert.equal(selected.focusSource, 'none');
  const anonymous = bossPresentation(state({ local_player_id: null, local_identity_source: 'unresolved' }), { now: 30_000, selectedTargetId: 900, damageScope: 'observed' });
  assert.equal(anonymous.roster.totalDamage, 1000); assert.equal(anonymous.summary.totalDamage, 1000);
  assert.equal(anonymous.roster.own, null); assert.equal(anonymous.roster.ownRank, null);
});

test('a previously attacked shared target remains automatic while others keep that exact fight active', () => {
  const shared = target({ is_boss: false, started_ms: 1000 });
  const active = state({ encounter_started_ms: 1000, encounter_active: true, capture: { status: 'capturing', missed_packets: 0 }, targets: [], observed_targets: [shared] });
  const first = bossPresentation(active, { now: 11_000 });
  assert.equal(first.target.id, 900); assert.ok(first.focusMemory);
  const ongoing = { ...active, focused_target_id: null, focused_target_observed_at_ms: null, observed_targets: [{ ...shared, last_hit_ms: 24_000 }] };
  assert.equal(bossPresentation(ongoing, { now: 25_000 }).target, null);
  const continued = bossPresentation(ongoing, { now: 25_000, previousFocus: first.focusMemory });
  assert.equal(continued.target.id, 900); assert.equal(continued.focusSource, 'continued-personal-target');
  assert.equal(continued.roster.kind, 'target'); assert.equal(continued.automatic, true);
  assert.equal(continued.focusMemory.ownLastHitMs, 10_000);
  assert.equal(bossPresentation(ongoing, { now: 34_000, previousFocus: continued.focusMemory }).target, null);
  const manual = bossPresentation(ongoing, { now: 25_000, selectedTargetId: 900 });
  assert.equal(manual.roster.totalDamage, 1000); assert.equal(manual.focusMemory, null);
});

test('automatic continuation clears on session, actor, loss, target epoch, death or stale target activity', () => {
  const shared = target({ is_boss: false, started_ms: 1000 });
  const active = state({ encounter_started_ms: 1000, encounter_active: true, capture: { status: 'capturing', missed_packets: 0 }, targets: [], observed_targets: [shared] });
  const previous = bossPresentation(active, { now: 11_000 }).focusMemory;
  const ongoing = { ...active, focused_target_id: null, focused_target_observed_at_ms: null, observed_targets: [{ ...shared, last_hit_ms: 24_000 }] };
  const variants = [
    { ...ongoing, encounter_active: false }, { ...ongoing, encounter_started_ms: 2000 },
    { ...ongoing, local_player_id: 2 }, { ...ongoing, capture: { status: 'error', missed_packets: 0 } },
    { ...ongoing, capture: { status: 'capturing', missed_packets: 1 } }, { ...ongoing, diagnostics: { stream_gaps: 1 } },
    ...[{ own_last_hit_ms: null }, { started_ms: 2000 }, { current_hp: 0 }, { last_hit_ms: 15_000 }, { last_hit_ms: 26_000 }]
      .map(patch => ({ ...ongoing, observed_targets: [{ ...ongoing.observed_targets[0], ...patch }] })),
    { ...ongoing, observed_targets: [] },
  ];
  for (const value of variants) {
    const result = bossPresentation(value, { now: 25_000, previousFocus: previous });
    assert.equal(result.target, null); assert.equal(result.focusMemory, null);
  }
  const noSession = bossPresentation({ ...active, encounter_started_ms: null }, { now: 11_000 });
  assert.equal(noSession.target.id, 900); assert.equal(noSession.focusMemory, null);
});

test('a newer own target supersedes continuation and unrelated nearby activity never supplies a replacement', () => {
  const shared = target({ is_boss: false, started_ms: 1000 });
  const active = state({ encounter_started_ms: 1000, encounter_active: true, capture: { status: 'capturing' }, targets: [], observed_targets: [shared] });
  const previous = bossPresentation(active, { now: 11_000 }).focusMemory;
  const next = target({ id: 901, is_boss: false, started_ms: 12_000, own_last_hit_ms: 24_000, last_hit_ms: 24_000 });
  const newer = { ...active, focused_target_id: 901, focused_target_observed_at_ms: 24_000, observed_targets: [{ ...shared, last_hit_ms: 24_000 }, next] };
  assert.equal(bossPresentation(newer, { now: 25_000, previousFocus: previous }).target.id, 901);
  const missedEarlierFocus = { ...newer, focused_target_id: null, focused_target_observed_at_ms: null, observed_targets: [{ ...shared, last_hit_ms: 24_000 }, { ...next, own_last_hit_ms: 12_000 }] };
  assert.equal(bossPresentation(missedEarlierFocus, { now: 25_000, previousFocus: previous }).target, null);
  const strangers = { ...active, focused_target_id: null, focused_target_observed_at_ms: null,
    observed_targets: [{ ...shared, last_hit_ms: 1000 }, { ...next, own_participant: null, own_last_hit_ms: null }] };
  assert.equal(bossPresentation(strangers, { now: 25_000, previousFocus: previous }).target, null);
});
