import test from 'node:test';
import assert from 'node:assert/strict';
import { combatMeasurement } from '../measurement.mjs';

const zero = { scope: 'personal', known: true, damage: 0, dps: 0 };
const known = { scope: 'personal', known: true, damage: 1200, dps: 100 };
const state = (extra = {}) => ({ total_damage: 0, local_player_id: 7, local_identity_source: 'server',
  capture: { status: 'capturing', packets: 50 }, diagnostics: { frames: 10, damage_events: 0 }, ...extra });
const measure = (value, options = {}, preferences = {}) => combatMeasurement(value, preferences, { summary: zero, ...options });

test('a missing received own contribution on a board takes precedence over zero, pause and boss-filter states', () => {
  const value = state({ paused: true, all_targets_summary: { total_damage: 1000 } });
  assert.deepEqual(measure(value, { board: true, boardSummary: { known: true, totalDamage: 0, evidence: 'no-observed-contribution' } }, { mode: 'boss' }),
    { kind: 'contribution-missing', suppressSummary: true });
  assert.equal(measure(value, { board: false, boardSummary: { evidence: 'no-observed-contribution' } }, { mode: 'boss' }).kind, 'boss-filter');
});

test('unknown board summaries distinguish missing identity, party membership and contribution evidence', () => {
  for (const [evidence, kind] of [['unresolved-identity', 'identity-pending'], ['conflicting-own-identity', 'identity-pending'],
    ['unresolved-party', 'party-pending'], ['contribution-unavailable', 'contribution-pending'], ['target-unavailable', 'contribution-pending']]) {
    const value = measure(state({ paused: true }), { board: true, boardSummary: { known: false, evidence } });
    assert.deepEqual(value, { kind, suppressSummary: true });
  }
  assert.equal(measure(state(), { board: true }).kind, 'contribution-pending');
  assert.equal(measure(state({ local_identity_source: 'unresolved' }), { board: true }).kind, 'identity-pending');
  assert.equal(measure(state(), { board: true }, { damageScope: 'party' }).kind, 'party-pending');
});

test('a known board preserves its independent target totals even when main boss totals are filtered to zero', () => {
  const value = state({ all_targets_summary: { total_damage: 9000 }, diagnostics: { frames: 0, damage_events: 0 } });
  assert.deepEqual(measure(value, { board: true, boardSummary: { known: true, totalDamage: 5000, evidence: 'received-target' } }, { mode: 'boss' }),
    { kind: 'measured', suppressSummary: false });
});

test('boss-filter detection includes retained records and precedes pending identity or pause', () => {
  for (const extra of [{}, { encounter_active: false }, { paused: true }, { local_identity_source: 'unresolved' }]) {
    assert.deepEqual(measure(state({ ...extra, all_targets_summary: { total_damage: 1234 } }), { summary: { known: false } }, { mode: 'boss' }),
      { kind: 'boss-filter', suppressSummary: true });
  }
  assert.equal(measure(state({ all_targets_summary: { total_damage: 1234 } }), {}, { mode: 'all' }).kind, 'measured');
  assert.notEqual(measure(state({ total_damage: null, all_targets_summary: { total_damage: 1234 } }), {}, { mode: 'boss' }).kind, 'boss-filter');
});

test('unknown regular summaries only blame the unresolved scope and never borrow nearby damage', () => {
  const unknown = { known: false, damage: null, dps: null };
  assert.deepEqual(measure(state({ local_identity_source: 'unresolved', total_damage: 5000 }), { summary: unknown }),
    { kind: 'identity-pending', suppressSummary: true });
  assert.equal(measure(state({ local_identity_source: 'unresolved' }), { summary: unknown }, { damageScope: 'party' }).kind, 'party-pending');
  assert.equal(measure(state({ party_membership_source: 'server' }), { summary: unknown }, { damageScope: 'party' }).kind, 'contribution-pending');
  assert.equal(measure(state(), { summary: unknown }).kind, 'contribution-pending');
  assert.equal(measure(state({ local_identity_source: 'unresolved' }), { summary: { ...unknown, scope: 'observed' } }).kind, 'contribution-pending');
});

test('pause retains known values before considering diagnostic no-combat counters', () => {
  for (const extra of [{ paused: true }, { status: 'paused' }]) {
    assert.deepEqual(measure(state(extra)), { kind: 'paused', suppressSummary: false });
  }
  assert.equal(measure(state({ paused: true, local_identity_source: 'unresolved' }), { summary: { known: false } }).kind, 'identity-pending');
  assert.deepEqual(measure(state({ paused: true }), { board: true, boardSummary: { known: true, evidence: 'received-own' } }),
    { kind: 'paused', suppressSummary: false });
});

test('known receive counters distinguish pending decode, damage events and outgoing credit', () => {
  const variants = [
    [{ frames: 0, damage_events: 0 }, 'decoding-pending'],
    [{ frames: 20, damage_events: 0 }, 'damage-pending'],
    [{ frames: 20, damage_events: 3 }, 'outgoing-pending'],
    [{ frames: null, damage_events: 3 }, 'outgoing-pending'],
  ];
  for (const [diagnostics, kind] of variants) assert.deepEqual(measure(state({ diagnostics })), { kind, suppressSummary: true });
});

test('missing, null or invalid counters are unknown and never become an implicit diagnostic zero', () => {
  for (const diagnostics of [undefined, null, {}, { frames: null, damage_events: null }, { frames: 20 }, { frames: null, damage_events: 0 },
    { frames: NaN, damage_events: Infinity }, { frames: '20', damage_events: '0' }, { frames: -1, damage_events: -1 }]) {
    assert.deepEqual(measure(state({ diagnostics })), { kind: 'measured', suppressSummary: false });
  }
  for (const packets of [undefined, null, 0, -1, NaN, Infinity, '50']) {
    assert.equal(measure(state({ capture: { status: 'capturing', packets }, diagnostics: { frames: 0 } })).kind, 'measured');
  }
});

test('positive main or unfiltered damage prevents old no-combat counters from suppressing a measured zero personal summary', () => {
  for (const damage of [{ total_damage: 1000 }, { all_targets_summary: { total_damage: 1000 } }]) {
    for (const diagnostics of [{ frames: 0, damage_events: 0 }, { frames: 20, damage_events: 0 }, { frames: 20, damage_events: 5 }]) {
      assert.deepEqual(measure(state({ ...damage, diagnostics })), { kind: 'measured', suppressSummary: false });
    }
  }
});

test('diagnostic hints require an active capturing backend and do not globally hide explicit zero', () => {
  for (const status of [undefined, 'waiting', 'error', 'api-unavailable', 'stopped']) {
    assert.deepEqual(measure(state({ capture: { status, packets: 50 } })), { kind: 'measured', suppressSummary: false });
  }
  assert.deepEqual(measure(state({ diagnostics: {} })), { kind: 'measured', suppressSummary: false });
  assert.deepEqual(measure(state({ total_damage: 1200 }), { summary: known }), { kind: 'measured', suppressSummary: false });
});
