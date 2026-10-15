import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceStatus } from '../resources.mjs';

const NOW = 1_790_000_000_000;
const snapshot = (odyle = {}, resources = {}) => ({
  actor_id: 17, source: 'server-contents-ticket', awaiting_identity: false, snapshot_complete: true,
  observed_at_ms: NOW - 1000,
  odyle: { ticket_id: 60_000_001, base: 75, bonus: 520, total: 595, time_left_ms: 0, observed_at_ms: NOW - 1000, ...odyle },
  ...resources,
});

test('received absolute energy exposes regular plus bonus without an invented total capacity', () => {
  const result = resourceStatus(snapshot(), NOW, 17);
  assert.equal(result.available, true);
  assert.equal(result.actor_id, '17');
  assert.deepEqual([result.base, result.bonus, result.total], [75, 520, 595]);
  assert.equal(result.age_ms, 1000);
  assert.equal(result.base_capacity, null);
  assert.equal(result.membership_active, null);
  assert.equal(result.capacity_source, null);
  assert.equal(result.status, 'received');
});

test('unknown identity, another actor and pending login cannot publish the previous character energy', () => {
  for (const id of [null, 0, 18, '18', NaN, Infinity, {}, '017']) {
    assert.equal(resourceStatus(snapshot(), NOW, id).available, false);
  }
  assert.equal(resourceStatus(snapshot({}, { actor_id: null }), NOW).available, false);
  assert.equal(resourceStatus(snapshot({}, { awaiting_identity: true }), NOW, 17).reason, 'awaiting-identity');
  assert.equal(resourceStatus(snapshot(), NOW, '17').available, true);
});

test('unsupported or manual sources and other ticket ids do not masquerade as received Odyle', () => {
  for (const source of ['manual', 'estimate', 'server-mp', '', null]) {
    assert.equal(resourceStatus(snapshot({}, { source }), NOW, 17).available, false);
  }
  for (const ticket_id of [51591, 74292, '60000001', null]) {
    assert.equal(resourceStatus(snapshot({ ticket_id }), NOW, 17).available, false);
  }
  assert.equal(resourceStatus(snapshot({}, { odyle: null }), NOW, 17).reason, 'no-odyle-observation');
});

test('present zero is available while missing, inconsistent and invalid values remain unknown', () => {
  assert.equal(resourceStatus(snapshot({ base: 0, bonus: 0, total: 0 }), NOW, 17).total, 0);
  for (const patch of [{ base: null }, { bonus: -1 }, { total: 594 }, { base: '75' }, { bonus: NaN }, { total: Infinity }, { base: 10_000_001 }, { time_left_ms: -1 }, { time_left_ms: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal(resourceStatus(snapshot(patch), NOW, 17).available, false);
  }
  assert.equal(resourceStatus(null, NOW).available, false);
  assert.equal(resourceStatus([], NOW).available, false);
  assert.equal(resourceStatus(snapshot(), NaN).available, false);
});

test('capacity requires separate observed membership and applies only to the regular component', () => {
  const membership = { source: 'server-benefit-list', expires_at_ms: NOW + 10000, observed_at_ms: NOW - 1000, active: true };
  const result = resourceStatus(snapshot({ base: 800, bonus: 900, total: 1700 }, { membership }), NOW, 17);
  assert.equal(result.base_capacity, 840);
  assert.equal(result.total, 1700);
  assert.equal(result.capacity_source, 'membership-rule');
  assert.equal(result.capacity_mismatch, false);
  assert.equal(result.membership_active, true);
  assert.equal(resourceStatus(snapshot({ base_capacity: 840, membership_active: true, capacity_source: 'membership-rule' }), NOW, 17).base_capacity, null);
  assert.equal(resourceStatus(snapshot({}, { membership: { ...membership, source: 'manual' } }), NOW, 17).base_capacity, null);
});

test('membership expiry is reevaluated and a conflicting capacity never clamps the observed amount', () => {
  const membership = { source: 'server-benefit-list', expires_at_ms: NOW, observed_at_ms: NOW - 1000, active: true };
  const result = resourceStatus(snapshot({ base: 800, bonus: 900, total: 1700 }, { membership }), NOW, 17);
  assert.equal(result.membership_active, false);
  assert.equal(result.base_capacity, null);
  assert.equal(result.capacity_mismatch, true);
  assert.equal(result.total, 1700);
  const regular = resourceStatus(snapshot({}, { membership: { ...membership, expires_at_ms: null } }), NOW, 17);
  assert.equal(regular.base_capacity, 560);
});

test('timestamps remain observations, with no fabricated recharge or countdown', () => {
  assert.equal(resourceStatus(snapshot({ observed_at_ms: NOW + 1001 }), NOW, 17).available, false);
  assert.equal(resourceStatus(snapshot({ observed_at_ms: NOW + 200 }), NOW, 17).age_ms, 0);
  const old = resourceStatus(snapshot({ observed_at_ms: NOW - 86_400_000 }), NOW, 17);
  assert.equal(old.total, 595);
  assert.equal(old.age_ms, 86_400_000);
  assert.equal('next_recharge_ms' in old, false);
  assert.equal(resourceStatus(snapshot({}, { snapshot_complete: false }), NOW, 17).snapshot_complete, false);
});
