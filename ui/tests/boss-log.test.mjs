import test from 'node:test';
import assert from 'node:assert/strict';
import { bossLog, primaryBoss, hasDamageChart } from '../boss-log.mjs';
import { normalizeEncounter } from '../model.mjs';

const fight = (overrides = {}) => normalizeEncounter({
  id: 1, started_ms: 1_000_000, elapsed_ms: 20_000, ended_ms: 1_020_000, total_damage: 400_000, dps: 20_000,
  local_player_id: 1, local_identity_source: 'server', personal_total_damage: 300_000, personal_dps: 15_000, personal_elapsed_ms: 20_000,
  players: [{ id: '1', name: 'Self', class_name: 'Chanter', damage: 300_000, dps: 15_000, is_local: true, identity_confirmed: true, skills: [] }],
  targets: [{ id: '9', name: 'Black Smoke Murute', is_boss: true, damage: 400_000 }],
  timeline: { interval_ms: 1000, started_ms: 1_000_000, total: [1, 2, 3], players: [], complete: true },
  ...overrides,
});
const rows = records => records.map((item, index) => ({ item, index }));

test('only encounters with a boss that took damage are listed, grouped by boss name', () => {
  const log = bossLog(rows([
    fight({ id: 3, started_ms: 3_000_000 }),
    fight({ id: 2, started_ms: 2_000_000, targets: [{ id: '8', name: 'Ordinary mob', is_boss: false, damage: 5 }] }),
    fight({ id: 1, started_ms: 1_000_000 }),
    fight({ id: 4, started_ms: 4_000_000, targets: [{ id: '7', name: 'Kaira', is_boss: true, damage: 900_000 }] }),
  ]));
  assert.deepEqual(log.map(boss => [boss.name, boss.count]), [['Kaira', 1], ['Black Smoke Murute', 2]]);
  assert.equal(log[1].lastAt, 3_000_000);
  assert.deepEqual(log[1].fights.map(entry => entry.index), [0, 2]);
});

test('best figures follow the scope and an unknown personal result stays unknown', () => {
  const records = [
    fight({ id: 3, personal_dps: 12_000, personal_total_damage: 240_000 }),
    fight({ id: 2, personal_dps: 31_000, personal_total_damage: 620_000 }),
    fight({ id: 1, local_identity_source: 'unresolved' }),
  ];
  const personal = bossLog(rows(records), { scope: 'personal' })[0];
  assert.equal(personal.bestDps, 31_000);
  assert.equal(personal.bestFight, 1);
  assert.equal(personal.bestDamage, 620_000);
  assert.equal(personal.fights[2].dps, null);
  assert.equal(personal.fights[2].damage, null);
  const observed = bossLog(rows(records), { scope: 'observed' })[0];
  assert.equal(observed.bestDps, 20_000);
  const nobody = bossLog(rows([fight({ local_identity_source: 'unresolved' })]), { scope: 'personal' })[0];
  assert.equal(nobody.bestDps, null);
  assert.equal(nobody.bestFight, null);
});

test('a boss is attributed to the target that took the most damage', () => {
  const record = fight({ targets: [{ id: '1', name: 'Minor boss', is_boss: true, damage: 10 }, { id: '2', name: 'Main boss', is_boss: true, damage: 90 }, { id: '3', name: 'Mob', is_boss: false, damage: 999 }] });
  assert.equal(primaryBoss(record).name, 'Main boss');
  assert.equal(primaryBoss(fight({ targets: [] })), null);
  assert.equal(primaryBoss(null), null);
});

test('chart availability and completeness are reported per fight without hiding the record', () => {
  const log = bossLog(rows([
    fight({ id: 3, sample_complete: true }),
    fight({ id: 2, timeline: undefined, damage_samples: [] }),
    fight({ id: 1, timeline: undefined, damage_samples: [{ timestamp_ms: 1_000_100, amount: 5, player_id: 1, source: 1 }] }),
  ]))[0].fights;
  assert.deepEqual(log.map(entry => entry.chart), [true, false, true]);
  assert.deepEqual(log.map(entry => entry.complete), [true, false, false]);
  assert.equal(hasDamageChart(null), false);
});

test('malformed input produces an empty log instead of throwing', () => {
  for (const input of [null, undefined, 'x', [], [{ item: null, index: 0 }], [{ item: {}, index: 1 }]]) assert.deepEqual(bossLog(input), []);
});
