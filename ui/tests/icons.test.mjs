import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { BUFFS_ICONS, EXTRA_ICONS, ICONS, ITEMS_ICONS, SKILLS_ICONS, TICKETS_ICONS } from '../game-icons.mjs';
import { buffIconPath, cubeIconPath, iconImg, itemIconPath, skillIconPath, ticketIconPath } from '../icons.mjs';

const folder = new URL('../assets/icons/', import.meta.url);

test('every icon the map names is a small file on disk, and no file is left unnamed', () => {
  assert.ok(ICONS.length >= 600);
  assert.equal(new Set(ICONS).size, ICONS.length);
  for (const key of ICONS) {
    assert.match(key, /^[a-z0-9_-]+$/);
    const file = new URL(`${key}.webp`, folder);
    assert.ok(existsSync(file), `${key}.webp is missing`);
    assert.ok(statSync(file).size > 100 && statSync(file).size <= 16_384, `${key}.webp is ${statSync(file).size} bytes`);
  }
  assert.deepEqual(readdirSync(folder).filter(name => name.endsWith('.webp')).sort(), ICONS.map(key => `${key}.webp`).sort());
  const total = readdirSync(folder).reduce((sum, name) => sum + statSync(new URL(name, folder)).size, 0);
  assert.ok(total <= 2_500_000, `the icons weigh ${total} bytes`);
  for (const family of [SKILLS_ICONS, BUFFS_ICONS, TICKETS_ICONS, ITEMS_ICONS]) {
    for (const [id, index] of Object.entries(family)) assert.ok(Number(id) > 0 && Number.isInteger(index) && index >= 0 && index < ICONS.length, id);
  }
  for (const [name, index] of Object.entries(EXTRA_ICONS)) assert.equal(ICONS[index], name);
});

test('tickets, currencies and effects have their game icon', () => {
  assert.equal(ticketIconPath(60_000_001), 'assets/icons/icon_item_odenergy_a_001.webp');
  assert.match(ticketIconPath(3), /^assets\/icons\/icon_abysspoint\.webp$/);
  assert.match(itemIconPath(930_100_003), /^assets\/icons\/[a-z0-9_-]+\.webp$/);
  assert.match(buffIconPath(100), /^assets\/icons\/[a-z0-9_-]+\.webp$/);
  assert.equal(ticketIconPath(0), null); assert.equal(ticketIconPath(-1), null); assert.equal(ticketIconPath('3'), null);
  assert.equal(itemIconPath(1), null); assert.equal(buffIconPath(NaN), null); assert.equal(itemIconPath('constructor'), null);
});

test('the Hidden Cube is the game\'s own gold or red cube picture', () => {
  assert.deepEqual(Object.keys(EXTRA_ICONS).sort(), ['cube_gold', 'cube_red']);
  assert.equal(cubeIconPath('gold'), 'assets/icons/cube_gold.webp');
  assert.equal(cubeIconPath('red'), 'assets/icons/cube_red.webp');
  for (const unknown of [undefined, null, 'blue', 7]) assert.equal(cubeIconPath(unknown), 'assets/icons/cube_gold.webp');
});

test('a skill finds its icon through its level, then its family, and an unknown skill gets none', () => {
  const exact = Number(Object.keys(SKILLS_ICONS).find(id => Number(id) > 11_000_000 && Number(id) % 10 === 0));
  assert.match(skillIconPath(exact), /^assets\/icons\/[a-z0-9_-]+\.webp$/);
  // A level that only the ten-step names resolves through the ten-step.
  const stepped = Math.floor(exact / 10) * 10 + 7;
  if (!Object.hasOwn(SKILLS_ICONS, stepped)) assert.equal(skillIconPath(stepped), skillIconPath(exact));
  for (const unknown of [0, -5, 1.5, NaN, '14090000', null, undefined, 999_999_999_999]) assert.equal(skillIconPath(unknown), null);
});

test('an icon is a picture that is hidden from screen readers, or nothing', () => {
  assert.equal(iconImg(null), ''); assert.equal(iconImg(undefined, 30), '');
  assert.equal(iconImg('assets/icons/a.webp', 30), '<img class="game-icon" src="assets/icons/a.webp" width="30" height="30" alt="" aria-hidden="true" draggable="false">');
});
