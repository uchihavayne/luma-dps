import test from 'node:test';
import assert from 'node:assert/strict';
import { overlayRect, overlayGesture, fullscreenLayout, isFullscreenDashboard, clippedInputRegion } from '../overlay.mjs';
import { normalizePreferences, normalizePlayer, playerBarColor, importTheme, exportTheme } from '../model.mjs';

test('interactive buttons are clipped to the viewport and their actual scrolling surfaces', () => {
  const screen = { width: 420, height: 320 };
  assert.deepEqual(clippedInputRegion({ x: 5, y: 95, width: 180, height: 28 }, screen, [{ x: 10, y: 100, width: 300, height: 90 }]), { x: 10, y: 100, width: 175, height: 23 });
  assert.equal(clippedInputRegion({ x: 10, y: 200, width: 180, height: 28 }, screen, [{ x: 10, y: 100, width: 300, height: 90 }]), null);
  assert.deepEqual(clippedInputRegion({ x: -4, y: 309, width: 80, height: 28 }, screen), { x: 0, y: 309, width: 76, height: 11 });
  assert.equal(clippedInputRegion({ x: 420, y: 10, width: 80, height: 28 }, screen), null);
  assert.equal(clippedInputRegion({ x: NaN, y: 10, width: 80, height: 28 }, screen), null);
  assert.equal(clippedInputRegion({ x: 10, y: 10, width: 0, height: 28 }, screen), null);
});

test('fullscreen defaults to a dashboard that fills any viewport without changing saved HUD geometry', () => {
  const preferences = normalizePreferences({ fullscreenOverlay: true, compactStrip: true, overlayX: 1500, overlayY: 700, overlayWidth: 480, overlayHeight: 360 }), original = structuredClone(preferences);
  for (const viewport of [{ width: 2560, height: 1440 }, { width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 320, height: 200 }]) {
    assert.deepEqual(overlayRect(preferences, viewport), { x: 0, y: 0, ...viewport });
    assert.deepEqual(overlayRect(preferences, viewport, { panelOpen: true }), { x: 0, y: 0, ...viewport });
  }
  assert.deepEqual(preferences, original);
  assert.equal(fullscreenLayout({ fullscreenLayout: 'invalid' }), 'dashboard');
  assert.equal(isFullscreenDashboard(preferences), true);
  assert.equal(isFullscreenDashboard({ ...preferences, fullscreenOverlay: false }), false);
  assert.equal(normalizePreferences({ fullscreenLayout: 'hud' }).fullscreenLayout, 'hud');
  assert.equal(normalizePreferences({ fullscreenLayout: 'invalid' }).fullscreenLayout, 'dashboard');
});

test('optional floating HUD stays compact on a large monitor, including a compact strip', () => {
  assert.deepEqual(overlayRect({ fullscreenLayout: 'hud' }, { width: 2560, height: 1440 }), { x: 24, y: 24, width: 420, height: 340 });
  assert.equal(overlayRect({ fullscreenLayout: 'hud', compactStrip: true }, { width: 2560, height: 1440 }).height, 44);
});

test('off-screen, invalid and tiny viewport geometry remains reachable after display changes', () => {
  for (const viewport of [{ width: 320, height: 200 }, { width: 1366, height: 768 }, { width: 80, height: 40 }]) {
    const value = overlayRect({ fullscreenLayout: 'hud', overlayX: 19000, overlayY: 19000, overlayWidth: 1200, overlayHeight: 1200 }, viewport);
    assert.ok(value.x >= 0 && value.y >= 0);
    assert.ok(value.x + value.width <= viewport.width && value.y + value.height <= viewport.height);
  }
  assert.equal(overlayRect({ fullscreenLayout: 'hud', overlayX: Infinity, overlayWidth: NaN }, { width: 1920, height: 1080 }).width, 420);
  assert.deepEqual(overlayRect({}, { width: Infinity, height: NaN }), { x: 0, y: 0, width: 1280, height: 720 });
});

test('opening settings expands the HUD without mutating its saved normal size or position', () => {
  const preferences = { fullscreenLayout: 'hud', overlayX: 1200, overlayY: 680, overlayWidth: 340, overlayHeight: 220, compactStrip: true }, original = structuredClone(preferences);
  const panel = overlayRect(preferences, { width: 1920, height: 1080 }, { panelOpen: true });
  assert.equal(panel.width, 640); assert.equal(panel.height, 680);
  assert.deepEqual(preferences, original);
  assert.equal(overlayRect(preferences, { width: 1920, height: 1080 }).height, 44);
});

test('HUD dragging and resizing clamp at monitor edges without rewriting native window geometry', () => {
  const preferences = { fullscreenLayout: 'hud', overlayX: 24, overlayY: 24, overlayWidth: 420, overlayHeight: 340 };
  const start = { pointerX: 100, pointerY: 100, preferences, rect: overlayRect(preferences, { width: 1280, height: 720 }) };
  const moved = overlayGesture(start, { x: 4000, y: -4000 }, { width: 1280, height: 720 });
  assert.deepEqual(moved, { overlayX: 848, overlayY: 12 });
  const resized = overlayGesture(start, { x: 110, y: 120 }, { width: 1280, height: 720 }, { resize: true });
  assert.deepEqual(resized, { overlayWidth: 430, overlayHeight: 360 });
  assert.equal(Object.hasOwn(moved, 'width'), false);
});

test('dashboard does not drag or resize, and returning to HUD recovers its original rectangle', () => {
  const preferences = normalizePreferences({ fullscreenOverlay: true, fullscreenLayout: 'hud', overlayX: 300, overlayY: 180, overlayWidth: 480, overlayHeight: 360 });
  const viewport = { width: 1920, height: 1080 }, original = overlayRect(preferences, viewport);
  const dashboard = { ...preferences, fullscreenLayout: 'dashboard' };
  const start = { preferences: dashboard, rect: overlayRect(dashboard, viewport), pointerX: 0, pointerY: 0 };
  assert.deepEqual(overlayGesture(start, { x: 400, y: 200 }, viewport), {});
  assert.deepEqual(overlayGesture(start, { x: 400, y: 200 }, viewport, { resize: true }), {});
  assert.deepEqual(overlayRect({ ...dashboard, fullscreenLayout: 'hud' }, viewport), original);
  assert.equal(isFullscreenDashboard(preferences), false);
});

test('observed low DPS starts green and high DPS ends red; missing rates remain neutral', () => {
  assert.equal(playerBarColor({ dps: 3000 }, 10000, 'performance', '#ffffff', 3000), '#34c759');
  assert.equal(playerBarColor({ dps: 10000 }, 10000, 'performance', '#ffffff', 3000), '#ff453a');
  const yellow = playerBarColor({ dps: 5500 }, 10000), orange = playerBarColor({ dps: 7800 }, 10000);
  assert.equal(yellow, '#ffd60a'); assert.equal(orange, '#ff9f0a');
  assert.notEqual(playerBarColor({ dps: null }, 10000), '#34c759');
  assert.equal(playerBarColor({ dps: 20000 }, 10000), '#ff453a');
});

test('unknown placeholders do not replace an actual received name or invent a character', () => {
  assert.equal(normalizePlayer({ id: 7, name: 'Unknown' }).name, '#7');
  assert.equal(normalizePlayer({ id: 7, name: 'Unknown', identity_confirmed: true }).name, 'Unknown');
  assert.equal(normalizePlayer({ id: 7, name: '真实名字', identity_confirmed: true }).name, '真实名字');
  assert.equal(normalizePlayer({ id: 7, name: 'Ranger', identity_confirmed: true }).identity_pending, false);
  assert.equal(normalizePlayer({ id: 7 }).identity_pending, true);
});

test('new default appearance upgrades once and explicit themes/layouts keep their choices', () => {
  const upgraded = normalizePreferences({ theme: 'aurora', layout: 'studio' });
  assert.equal(upgraded.theme, 'graphite'); assert.equal(upgraded.layout, 'cupertino'); assert.equal(upgraded.density, 'compact');
  assert.equal(normalizePreferences({ ...upgraded, layout: 'studio', theme: 'aurora' }).layout, 'studio');
  assert.equal(normalizePreferences({ theme: 'rose', layout: 'glass' }).theme, 'rose');
  const restored = importTheme(exportTheme({ appearanceRevision: 2, theme: 'pearl', layout: 'cupertino', opacity: 0 }));
  assert.equal(restored.theme, 'pearl'); assert.equal(restored.opacity, 0);
  assert.equal(Object.hasOwn(restored, 'fullscreenOverlay'), false);
});

test('appearance revision 3 moves every older layout to Luma Clear once and keeps later choices', () => {
  for (const layout of ['focus', 'glass', 'minimal', 'studio']) {
    const migrated = normalizePreferences({ appearanceRevision: 2, layout, density: 'comfortable' });
    assert.equal(migrated.layout, 'cupertino', layout);
    assert.equal(migrated.density, 'compact');
    assert.equal(migrated.appearanceRevision, 3);
    assert.equal(normalizePreferences({ ...migrated, layout }).layout, layout, `${layout} chosen afterwards is kept`);
  }
  assert.equal(normalizePreferences({}).layout, 'cupertino');
  assert.equal(normalizePreferences({ appearanceRevision: 2, layout: 'cupertino', density: 'comfortable' }).density, 'comfortable');
  assert.equal(importTheme(exportTheme({ appearanceRevision: 3, layout: 'focus' })).layout, 'focus', 'an imported theme keeps its layout');
});
