import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, exportTheme, importTheme, normalizePreferences, sortedPlayers } from '../model.mjs';

test('the meter opens as the Glass card, with the list sorted by DPS, and the four looks are the only ones on offer', () => {
  assert.deepEqual(Object.keys(STYLES), ['card', 'pill', 'hud', 'crystal']);
  const fresh = normalizePreferences({});
  assert.equal(fresh.meterStyle, 'card'); assert.equal(fresh.layout, 'cupertino'); assert.equal(fresh.sort, 'dps');
  for (const style of Object.values(STYLES)) for (const language of ['tr', 'en']) { assert.ok(style.name[language]); assert.ok(style.description[language]); }
});

test('preferences saved before the looks existed move once to the Glass card; a choice made afterwards is kept', () => {
  // The player saved the Prism layout and an A-Z list: both move once.
  const before = normalizePreferences({ appearanceRevision: 4, layout: 'glass', sort: 'name' });
  assert.equal(before.meterStyle, 'card'); assert.equal(before.layout, 'cupertino'); assert.equal(before.sort, 'dps');
  // Each look is kept, and wins over a classic layout still named in the file.
  for (const style of Object.keys(STYLES)) {
    const kept = normalizePreferences({ appearanceRevision: 4, layout: 'studio', meterStyle: style });
    assert.equal(kept.meterStyle, style); assert.equal(kept.layout, 'cupertino');
    assert.equal(normalizePreferences(kept).meterStyle, style, 'normalizing twice changes nothing');
  }
  // A classic layout chosen afterwards (no look) is kept, and so is an A-Z list chosen afterwards.
  const classic = normalizePreferences({ appearanceRevision: 4, layout: 'glass', meterStyle: '', sort: 'name' });
  assert.equal(classic.meterStyle, ''); assert.equal(classic.layout, 'glass'); assert.equal(classic.sort, 'name');
  assert.equal(normalizePreferences(classic).layout, 'glass');
  // Garbage falls back to the default look.
  for (const bad of [null, 5, 'neon', {}, []]) assert.equal(normalizePreferences({ appearanceRevision: 4, meterStyle: bad }).meterStyle, 'card');
});

test('a theme file carries the look and restores it', () => {
  const restored = importTheme(exportTheme({ meterStyle: 'crystal' }));
  assert.equal(restored.meterStyle, 'crystal'); assert.equal(restored.layout, 'cupertino');
  assert.equal(importTheme(exportTheme({ appearanceRevision: 4, meterStyle: '', layout: 'focus' })).layout, 'focus');
});

test('whoever does the most damage per second is at the top, then the next, and so on', () => {
  const rows = [{ name: 'Mid', dps: 5, damage: 50 }, { name: 'Top', dps: 9, damage: 10 }, { name: 'Low', dps: 1, damage: 90 }, { name: 'Tie', dps: 5, damage: 5 }];
  assert.deepEqual(sortedPlayers(rows, 'dps').map(row => row.name), ['Top', 'Mid', 'Tie', 'Low']);
  assert.deepEqual(sortedPlayers(rows, 'damage').map(row => row.name), ['Low', 'Mid', 'Top', 'Tie']);
  assert.deepEqual(sortedPlayers(rows).map(row => row.name), ['Top', 'Mid', 'Tie', 'Low'], 'DPS is the default');
  assert.deepEqual(sortedPlayers([{ name: 'B', dps: NaN }, { name: 'A', dps: 3 }, { name: 'C' }]).map(row => row.name), ['A', 'B', 'C'], 'an unknown rate sits last');
});

test('every look keeps its rows tidy: the classic fit rules cannot squeeze the picture, the name or the figures', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../looks.css', import.meta.url), 'utf8');
  // The picture keeps its size and the name is cut with an ellipsis instead of going under it.
  assert.match(css, /\.player-class-icon \{ flex: 0 0 22px !important; width: 22px !important; height: 22px !important;/);
  assert.match(css, /\.player-name \{ flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;/);
  assert.match(css, /grid-template-columns: 20px minmax\(0, 1fr\) max-content !important; gap: 8px !important; height: auto !important;/);
  // The figures stay on one line, and a narrow window drops the share before the name is squeezed.
  assert.match(css, /\.player-stats > \.player-numbers \{ display: flex !important; flex-direction: row !important; flex-wrap: nowrap !important;/);
  assert.match(css, /@container meter-size \(max-width: 379px\)[^}]*\.player-share \{ display: none !important; \}/);
  // Locked, the empty controls row takes no room; unlocked, a controls row that wraps grows instead of covering the list.
  assert.match(css, /\[data-look=bare\] > \.roster-controls \{ display: none; \}/);
  assert.match(css, /> \.roster-controls \{ height: auto; padding: 3px 12px 6px; \}/);
  // The target's figures sit under its bar, not on it.
  assert.match(css, /#target-vitals \{ position: static; display: grid;[^}]*grid-template-areas: "bar bar" "text percent";/);
  // Each look is drawn both locked (bare) and unlocked (frame), and the number colour comes from the theme's text.
  for (const style of ['card', 'pill', 'hud', 'crystal']) assert.match(css, new RegExp(String.raw`\[data-style=${style}\]\[data-look=(frame|bare)\]`), style);
  assert.doesNotMatch(css, /player-dps \{ color: color-mix\([^}]*#fff/, 'a number mixed with white cannot be read on a light theme');
});
