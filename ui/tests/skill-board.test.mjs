import test from 'node:test';
import assert from 'node:assert/strict';
import { skillBoard } from '../skill-board.mjs';
import { SKILLS_ICONS } from '../game-icons.mjs';

const knownSkill = Object.keys(SKILLS_ICONS).find(id => Number(id) > 11_000_000);
const player = { skills: [
  { id: knownSkill, damage: 4500, hits: 9, crit_hits: 2 },
  { id: '999', damage: 2700, hits: 5 },
  { id: '998', damage: 1800, hits: 3 },
] };
const label = id => `Skill ${id}`;

test('the skill table ranks every used skill with icon, rate, share and total', () => {
  const board = skillBoard({ player, elapsedMs: 9000, locale: 'en', label, rate: value => `${Math.round(value)}/s`, num: value => `${value}` });
  assert.equal(board.rows, 3); assert.equal(board.more, 0);
  assert.match(board.html, /<strong>My skills<\/strong><span class="board-total"><b>1000\/s<\/b> · 9000<\/span>/);
  assert.match(board.html, new RegExp(`<img class="game-icon" src="assets/icons/[a-z0-9_-]+\\.webp" width="20" height="20"`), 'the game icon');
  assert.match(board.html, /<span class="skill-rate">500\/s<\/span><span class="skill-share">50\.0%<\/span><span class="skill-total">4500<\/span>/);
  assert.match(board.html, /style="--share:0\.500"/);
  assert.ok(board.html.indexOf('Skill 999') < board.html.indexOf('Skill 998'), 'the biggest first');
  assert.match(board.html, /data-skill-board="all"/); assert.match(board.html, /aria-expanded="true" aria-label="Collapse"/);
});

test('collapsed it keeps only the heading, and the same rows come back when it opens', () => {
  const collapsed = skillBoard({ player, elapsedMs: 9000, locale: 'tr', collapsed: true, label });
  assert.match(collapsed.html, /Yeteneklerim/); assert.match(collapsed.html, /aria-expanded="false" aria-label="Aç"/);
  assert.doesNotMatch(collapsed.html, /skill-row|board-foot/);
  assert.equal(collapsed.rows, 3, 'the row count that sizes the window is the same either way');
});

test('more than twelve skills say how many are left, and there is no table before any damage', () => {
  const many = { skills: Array.from({ length: 15 }, (_, index) => ({ id: String(900 + index), damage: 100 + index })) };
  const board = skillBoard({ player: many, elapsedMs: 5000, label });
  assert.equal(board.rows, 12); assert.equal(board.more, 3); assert.match(board.html, /<span>\+3<\/span>/);
  for (const nothing of [undefined, null, {}, { skills: [] }, { skills: [{ id: '1', damage: 0 }] }, { skills: 'x' }]) assert.equal(skillBoard({ player: nothing, elapsedMs: 5000 }), null);
});

test('a skill name that tries to inject markup is escaped', () => {
  const board = skillBoard({ player: { skills: [{ id: '5', damage: 10 }] }, elapsedMs: 1000, label: () => '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(board.html, /<img src=x/); assert.match(board.html, /&lt;img src=x/);
});
