import test from 'node:test';
import assert from 'node:assert/strict';
import { skillRows } from '../skills.mjs';

const player = skills => ({ skills });

test("skills are ranked by damage with a per-second rate over the player's own clock and a share", () => {
  const view = skillRows(player([{ id: 'b', damage: 11030, hits: 14, crit_hits: 5 }, { id: 'a', damage: 18194, hits: 18, crit_hits: 8 }, { id: 'c', damage: 610, hits: 1, crit_hits: 0 }]), 4900);
  assert.equal(view.total, 29834); assert.equal(view.seconds, 4.9);
  assert.deepEqual(view.rows.map(row => row.id), ['a', 'b', 'c']);
  assert.ok(Math.abs(view.rows[0].perSecond - 18194 / 4.9) < 1e-9);
  assert.ok(Math.abs(view.rows[0].share - 18194 / 29834) < 1e-12);
  assert.equal(view.rows[0].hits, 18); assert.equal(view.rows[0].crits, 8);
  assert.equal(view.more, 0);
  assert.ok(Math.abs(view.rows.reduce((sum, row) => sum + row.share, 0) - 1) < 1e-12);
});

test('a fight shorter than a second uses the one-second minimum, like the meter', () => {
  assert.equal(skillRows(player([{ id: 1, damage: 5000 }]), 0).rows[0].perSecond, 5000);
  assert.equal(skillRows(player([{ id: 1, damage: 5000 }]), 400).seconds, 1);
  assert.equal(skillRows(player([{ id: 1, damage: 5000 }]), undefined).seconds, 1);
});

test('the list is bounded and says how many skills it left out', () => {
  const many = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, damage: 100 * (index + 1) }));
  const view = skillRows(player(many), 10_000, { limit: 5 });
  assert.equal(view.rows.length, 5); assert.equal(view.more, 4); assert.equal(view.rows[0].id, 9);
  assert.equal(view.total, 4500);
  assert.equal(skillRows(player(many), 10_000, { limit: 99 }).rows.length, 9);
  assert.equal(skillRows(player(many), 10_000, { limit: 0 }).rows.length, 5);
});

test('nothing, zero damage, missing ids and malformed numbers never produce rows or NaN', () => {
  for (const value of [null, undefined, {}, player([]), player('x'), player([null, { id: 1 }, { id: 2, damage: 0 }, { id: 3, damage: -5 }, { id: 4, damage: NaN }, { damage: 10 }])]) {
    const view = skillRows(value, 5000);
    assert.deepEqual([view.rows.length, view.total, view.more], [0, 0, 0]);
  }
  const view = skillRows(player([{ id: 1, damage: 10, hits: NaN, crit_hits: 'x' }]), 'soon');
  assert.deepEqual([view.rows[0].hits, view.rows[0].crits, view.seconds], [0, 0, 1]);
});
