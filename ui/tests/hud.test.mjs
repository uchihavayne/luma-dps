import test from 'node:test';
import assert from 'node:assert/strict';
import { classIcon, CLASS_ICONS } from '../class-icons.mjs';
import { hudPanelChange, hudPanelVisible, previewFrame } from '../hud.mjs';
import { normalizePreferences, exportTheme, importTheme, visibleAnalysisSections } from '../model.mjs';
import { ANALYSIS_SECTIONS } from '../navigation.mjs';

test('a clean default retains every analysis tool without opening HUD panels', () => {
  const prefs = normalizePreferences();
  for (const name of ['pets', 'events', 'team', 'odyle']) assert.equal(hudPanelVisible(prefs, name), false);
  for (const tab of ['pets', 'radar', 'playback', 'team', 'community', 'history', 'records']) assert.ok(visibleAnalysisSections(ANALYSIS_SECTIONS, prefs).includes(tab), tab);
  assert.equal(prefs.cubeAutoListen, true);
  assert.equal(prefs.radarOpen, false);
});

test('closing and reopening the pet panel retains pins, counters settings and background listening', () => {
  const initial = normalizePreferences({ petPins: [1002, 1003], petGoal: 'next', cubeAutoListen: true, hudPanels: ['pets'] });
  const closed = normalizePreferences({ ...initial, ...hudPanelChange(initial, 'pets', false) });
  assert.equal(hudPanelVisible(closed, 'pets'), false);
  assert.deepEqual(closed.petPins, initial.petPins);
  assert.equal(closed.petGoal, 'next');
  assert.equal(closed.cubeAutoListen, true);
  assert.equal(closed.displayModules.pets, true);
  const reopened = normalizePreferences(JSON.parse(JSON.stringify({ ...closed, ...hudPanelChange(closed, 'pets', true) })));
  assert.equal(hudPanelVisible(reopened, 'pets'), true);
  assert.deepEqual(reopened.petPins, initial.petPins);
});

test('pet-only mode stays useful and a hidden collection can be re-enabled explicitly', () => {
  const prefs = normalizePreferences({ displayModules: { dps: false, pets: true } });
  assert.equal(hudPanelVisible(prefs, 'pets'), true);
  for (const name of ['events', 'team', 'odyle']) assert.equal(hudPanelVisible(prefs, name), false);
  const events = normalizePreferences({ ...prefs, ...hudPanelChange(prefs, 'events', true) });
  assert.equal(hudPanelVisible(events, 'events'), true);
  const radarOnly = normalizePreferences({ ...prefs, hudPanels: [], radarOpen: true });
  assert.equal(hudPanelVisible(radarOnly, 'pets'), false);
  const legacyPets = normalizePreferences({ displayModules: { dps: false, pets: true }, petPins: [1002] });
  assert.equal(hudPanelVisible(legacyPets, 'pets'), true);
  const disabled = normalizePreferences({ displayModules: { pets: false } });
  assert.equal(hudPanelVisible(disabled, 'pets'), false);
  const shown = normalizePreferences({ ...disabled, ...hudPanelChange(disabled, 'pets', true) });
  assert.equal(hudPanelVisible(shown, 'pets'), true);
});

test('appearance import cannot alter tool visibility, capture or collection preferences', () => {
  const prefs = normalizePreferences({ hudPanels: ['pets', 'events', 'pets', '<script>'], hudDetailRows: true });
  assert.deepEqual(prefs.hudPanels, ['pets', 'events']);
  const imported = importTheme(exportTheme(prefs));
  for (const key of ['hudPanels', 'displayModules', 'cubeAutoListen', 'petPins']) assert.equal(Object.hasOwn(imported, key), false);
  assert.deepEqual(hudPanelChange(prefs, '<script>', true), {});
});

test('every playable class has a distinct local SVG, including Chanter, Ranger and Brawler', () => {
  assert.equal(CLASS_ICONS.length, 9);
  assert.equal(new Set(CLASS_ICONS.map(classIcon)).size, CLASS_ICONS.length);
  assert.equal(classIcon(' SPIRIT MASTER '), classIcon('Spiritmaster'));
  assert.notEqual(classIcon('Chanter'), classIcon('Ranger'));
  for (const name of [...CLASS_ICONS, '"><img src=x onerror=alert(1)>']) {
    const svg = classIcon(name);
    assert.match(svg, /^<svg viewBox="0 0 24 24"/);
    assert.doesNotMatch(svg, /<script|<img|href|style=|onerror|https?:/i);
  }
});

test('browser size fixtures match supported desktop limits and reject CSS injection', () => {
  assert.deepEqual(previewFrame('320x200'), { width: 320, height: 200 });
  assert.deepEqual(previewFrame('1600x1600'), { width: 1600, height: 1600 });
  for (const value of ['319x200', '420x199', '1601x900', '420x430;display:none', null]) assert.equal(previewFrame(value), null);
});
