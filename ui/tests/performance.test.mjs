import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('the looks draw nothing the player cannot see: no blur, no filter layers, no shadow outside a window the size of the card', async () => {
  const css = await read('looks.css');
  assert.doesNotMatch(css, /(^|[^-])filter:/m, 'a filter makes a layer of its own for every row');
  assert.doesNotMatch(css, /backdrop-filter:\s*blur/);
  for (const line of css.split('\n').filter(row => /box-shadow/.test(row) && /\[data-look=frame\]/.test(row))) assert.doesNotMatch(line, /,\s*0 \d+px \d+px #/, `an outer shadow is clipped by the window: ${line.slice(0, 80)}`);
});

test('windows whose numbers change slowly are redrawn slowly', async () => {
  const source = await read('overlay-window.mjs');
  assert.match(source, /const SLOWEST = \{[^}]*tickets: 2000[^}]*currencies: 2000[^}]*\}/);
  assert.match(source, /setTimeout\(tick, Math\.max\(rateMs, SLOWEST\[panel\] \?\? 0\)\)/);
  // The windows that must feel live keep the player's update rate.
  const { SLOWEST } = { SLOWEST: Object.fromEntries([...source.match(/const SLOWEST = \{([^}]*)\}/)[1].split(',').map(part => part.trim().split(': '))].filter(entry => entry[0])) };
  for (const live of ['cube', 'flight', 'bosshp', 'vitals', 'cooldowns', 'actions', 'effects', 'damage']) assert.equal(SLOWEST[live], undefined, live);
});

test('the bars jump instead of sliding, and the meter asks for the state only when none has come', async () => {
  const css = await read('looks.css'), app = await read('app.mjs');
  assert.match(css, /:is\(\.player-bar, \.player, #target-hp-track b\) \{ transition: none !important; \}/);
  assert.match(app, /if \(!native \|\| refreshPending \|\| Date\.now\(\) - lastStateAt < 3000\) return;/);
  assert.match(app, /lastStateAt = Date\.now\(\);\s+receivedStateCount\+\+;/);
});

test('the main window is not resized for every player who comes and goes, and history is not written during a fight', async () => {
  const app = await read('app.mjs'), shell = await readFile(new URL('../../src-tauri/src/main.rs', import.meta.url), 'utf8');
  assert.match(app, /followHeight\(fitMemory, natural, Date\.now\(\)\)/);
  assert.doesNotMatch(app, /fitRequested/);
  assert.match(shell, /fn history_save_due\(/);
  assert.match(shell, /perf::background_this_thread\(\);\s+let started/);
  assert.doesNotMatch(shell, /history_saved_at/);
});
