import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme, themeVariables } from '../overlay-theme.mjs';
import { FONTS, THEMES, normalizePreferences } from '../model.mjs';

test('a detached window takes the theme\'s colours, its font and the chosen opacity', () => {
  for (const name of Object.keys(THEMES).filter(name => name !== 'custom')) {
    const { variables } = themeVariables(normalizePreferences({ theme: name, appearanceRevision: 4 }));
    assert.deepEqual([variables['--bg'], variables['--panel'], variables['--text'], variables['--accent']], [THEMES[name].bg, THEMES[name].panel, THEMES[name].text, THEMES[name].accent], name);
  }
  const graphite = themeVariables(normalizePreferences({ theme: 'graphite', font: 'georgia', opacity: 0.6 }));
  assert.equal(graphite.light, false); assert.equal(graphite.variables['--body-font'], FONTS.georgia); assert.equal(graphite.variables['--alpha'], '0.6');
  assert.match(graphite.variables['--muted'], /color-mix\(in srgb, #f5f5f7 58%, #16181d\)/);
  assert.equal(themeVariables(normalizePreferences({ theme: 'pearl', appearanceRevision: 4 })).light, true);
  assert.equal(themeVariables(normalizePreferences({ theme: 'white', appearanceRevision: 4 })).light, true);
});

test('custom colours are used, and anything unusable falls back to the graphite theme', () => {
  const custom = themeVariables(normalizePreferences({ theme: 'custom', customColors: { bg: '#102030', panel: '#203040', text: '#eeeeee', accent: '#ff8800' } }));
  assert.equal(custom.variables['--accent'], '#ff8800'); assert.equal(custom.variables['--bg'], '#102030');
  for (const prefs of [{ theme: 'nope' }, { theme: 'custom', customColors: { bg: 'red' } }, {}, null, undefined]) {
    assert.equal(themeVariables(prefs).variables['--bg'], THEMES.graphite.bg, JSON.stringify(prefs));
  }
});

test('opacity is bounded so a window never vanishes or overflows, and applying sets every variable on the root', () => {
  assert.equal(themeVariables({ opacity: 0 }).variables['--alpha'], '0.25');
  assert.equal(themeVariables({ opacity: 5 }).variables['--alpha'], '1');
  assert.equal(themeVariables({ opacity: NaN }).variables['--alpha'], '0.92');
  const set = {}, root = { style: { setProperty: (name, value) => { set[name] = value; } }, dataset: {} };
  applyTheme(normalizePreferences({ theme: 'pearl', opacity: 0.8, appearanceRevision: 4 }), root);
  assert.equal(set['--bg'], THEMES.pearl.bg); assert.equal(set['--alpha'], '0.8');
  assert.equal(root.dataset.surface, 'light'); assert.equal(root.style.colorScheme, 'light');
});

test('the detached windows\' styles hold no fixed card colour that a theme could not change', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../overlay.css', import.meta.url), 'utf8');
  // The defaults on :root are the only place the old colours may stay.
  // Markers sit on the game with no card, so they keep their own light-on-dark colours.
  const body = css.replace(/:root \{[^}]*\}/, '').replace(/body\.marker \{[^}]*\}/, '');
  assert.doesNotMatch(body, /#0d1218|#0b0f14|#0b1410/);
  assert.doesNotMatch(body, /rgba\(255, 255, 255, \.\d+\)/);
  assert.match(body, /opacity: var\(--alpha\)/, 'the opacity applies to the whole window');
  const clear = await readFile(new URL('../clear.css', import.meta.url), 'utf8');
  assert.match(clear, /\[data-look=bare\] \{ opacity: max\(\.3, var\(--opacity\)\); \}/, 'the bare meter takes the opacity too');
});
