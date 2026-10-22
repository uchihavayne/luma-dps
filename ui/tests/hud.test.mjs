import test from 'node:test';
import assert from 'node:assert/strict';
import { classIcon, classIconPath, CLASS_ICONS } from '../class-icons.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hudPanelChange, hudPanelVisible, previewFrame, mainRoster, unnamedSourcesNotice } from '../hud.mjs';
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

test('every playable class loads its actual bundled game image with documented unchanged source bytes', () => {
  assert.equal(CLASS_ICONS.length, 9);
  assert.equal(new Set(CLASS_ICONS.map(classIcon)).size, CLASS_ICONS.length);
  assert.equal(classIcon(' SPIRIT MASTER '), classIcon('Spiritmaster'));
  assert.equal(classIconPath('호법성'), 'assets/classes/chanter.png');
  assert.equal(classIconPath('궁성'), 'assets/classes/ranger.png');
  assert.equal(classIconPath('Spiritmaster'), 'assets/classes/elementalist.png');
  assert.equal(classIconPath('Brawler'), 'assets/classes/fighter.png');
  assert.notEqual(classIcon('Chanter'), classIcon('Ranger'));
  const provenance = readFileSync(new URL('../assets/classes/README.md', import.meta.url), 'utf8');
  for (const name of CLASS_ICONS) {
    const path = classIconPath(name), bytes = readFileSync(new URL(`../${path}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(provenance.includes(createHash('sha256').update(bytes).digest('hex')));
    assert.match(classIcon(name), /^<img src="assets\/classes\/[a-z]+\.png"/);
    assert.doesNotMatch(classIcon(name), /onerror|style=|https?:/i);
  }
  for (const name of ['constructor', '__proto__', 'toString', 'Unknown', '"><img src=x onerror=alert(1)>']) {
    assert.equal(classIconPath(name), null);
    assert.match(classIcon(name), /^<svg viewBox="0 0 24 24"/);
    assert.doesNotMatch(classIcon(name), /<script|<img|href|style=|onerror|https?:/i);
  }
});

test('target name and health can be hidden independently and survive saved preferences', () => {
  const initial = normalizePreferences({});
  assert.equal(initial.showTargetName, true);
  assert.equal(initial.showTargetHealth, true);
  for (const name of ['showTargetName', 'showTargetHealth']) {
    const saved = normalizePreferences(JSON.parse(JSON.stringify({ ...initial, [name]: false })));
    assert.equal(saved[name], false);
    assert.equal(saved[name === 'showTargetName' ? 'showTargetHealth' : 'showTargetName'], true);
  }
});

test('browser size fixtures match supported desktop limits and reject CSS injection', () => {
  assert.deepEqual(previewFrame('320x200'), { width: 320, height: 200 });
  assert.deepEqual(previewFrame('1600x1600'), { width: 1600, height: 1600 });
  for (const value of ['319x200', '420x199', '1601x900', '420x430;display:none', null]) assert.equal(previewFrame(value), null);
});

test('sources without a received identity are reported in one quiet line instead of silently hidden', () => {
  const fmt = value => `${value / 1000}K`;
  assert.deepEqual(unnamedSourcesNotice(2, 13000, 'en', fmt).text, '+2 sources awaiting identity · 13K damage');
  assert.equal(unnamedSourcesNotice(1, 500, 'en', fmt).text, '+1 source awaiting identity · 0.5K damage');
  assert.equal(unnamedSourcesNotice(3, 13000, 'tr', fmt).text, '+3 kaynak kimlik bekliyor · 13K hasar');
  assert.ok(unnamedSourcesNotice(1, 1, 'tr').title.includes('Analiz'));
  for (const [count, damage] of [[0, 100], [2, 0], [2, null], [-1, 5], [1.5, 5], [2, Number.NaN], [undefined, 5]]) assert.equal(unnamedSourcesNotice(count, damage), null, `${count}/${damage}`);
  // mainRoster feeds it: an actor with damage but no identity is hidden from the list and counted.
  const roster = mainRoster([{ id: '1', name: 'Self', class_name: 'Chanter', damage: 100, is_local: true, identity_confirmed: true }, { id: '2', name: '#2', class_name: 'Unknown', damage: 40 }], {});
  assert.deepEqual([roster.players.length, roster.unclassifiedCount, roster.unclassifiedDamage], [1, 1, 40]);
});
