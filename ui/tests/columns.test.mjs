import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPanel } from '../overlay-panels.mjs';
import { normalizeState } from '../model.mjs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('the party heading has one cell for every column of a row, and the columns share one fixed width', () => {
  const room = { title: 'Room', members: [
    { id: '1', name: 'Aster', server: 2315, class: 'Gladiator', gear_score: 2262, combat_power: 122_800, ready: false, leader: false },
    { id: '2', name: 'Mira', server: 2316, class: 'Ranger', gear_score: 0, combat_power: 108_900, ready: true, leader: false },
    { id: '3', name: 'Nox', server: 2317, class: 'Sorcerer', gear_score: 2198, combat_power: 108_700, ready: false, leader: true },
  ] };
  const html = renderPanel('party', { state: normalizeState({ room }) });
  const head = /<div class="seat-head">(.*?)<\/div>/.exec(html)[1];
  const cells = row => [...row.matchAll(/<span\b/g)].length;
  assert.equal(cells(head), 5);
  assert.match(head, /<span>GS<\/span><span>CP<\/span><span><\/span>$/);
  // Every row: an icon, who, GS, CP and the state, at the same places as the heading.
  for (const row of html.split('<div class="seat"').slice(1)) {
    assert.match(row, /<span class="icon">.*<\/span><span class="who">.*<\/span><span class="gs">[^<]*<\/span><span class="cp">[^<]*<\/span><span class="state">[^<]*<\/span>/s);
  }
  // A row with no gear score keeps its place with a dash instead of pulling the next column left.
  assert.match(html, /<span class="gs">—<\/span>/);
  const css = read('overlay.css');
  const rules = [...css.matchAll(/\.seat-head, \.seat \{[^}]*grid-template-columns:([^;}]*)[;}]/g)].map(match => match[1].trim());
  assert.ok(rules.length >= 1);
  for (const columns of rules) assert.doesNotMatch(columns, /max-content|min-content|auto\b/, `a column that sizes itself shifts the others: ${columns}`);
  assert.equal(new Set(rules.map(rule => rule.replace(/\s+/g, ' '))).size, 1, 'the heading and the rows must be given the same columns');
});

test('the meter heading has a cell for each number a row shows, and the share one is placed by the meter', () => {
  const html = read('index.html');
  assert.match(html, /<span id="column-rate">DPS<\/span><span id="column-damage">Toplam<\/span><span id="column-share">%<\/span>/);
  for (const selector of ['.player-dps', '.player-damage', '.player-share']) assert.match(read('app.mjs'), new RegExp(selector.replace('.', '\\.')));
  assert.match(read('clear.css'), /\.clear-column-headings > #column-share \{ display: none; \}/);
  // A heading is never placed from the stale flex direction of a grid.
  assert.match(read('app.mjs'), /display\.includes\('flex'\) && getComputedStyle\(head\)\.flexDirection === 'column'/);
});
