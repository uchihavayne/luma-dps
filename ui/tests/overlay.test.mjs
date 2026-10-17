import test from 'node:test';
import assert from 'node:assert/strict';
import { overlayRect, overlayGesture } from '../overlay.mjs';
import { normalizePreferences, normalizePlayer, playerBarColor, importTheme, exportTheme } from '../model.mjs';

test('fullscreen HUD stays compact on a large monitor, including a compact strip', () => {
  assert.deepEqual(overlayRect({}, { width: 2560, height: 1440 }), { x: 24, y: 24, width: 420, height: 340 });
  assert.equal(overlayRect({ compactStrip: true }, { width: 2560, height: 1440 }).height, 44);
});

test('off-screen, invalid and tiny viewport geometry remains reachable after display changes', () => {
  for (const viewport of [{ width: 320, height: 200 }, { width: 1366, height: 768 }, { width: 80, height: 40 }]) {
    const value = overlayRect({ overlayX: 19000, overlayY: 19000, overlayWidth: 1200, overlayHeight: 1200 }, viewport);
    assert.ok(value.x >= 0 && value.y >= 0);
    assert.ok(value.x + value.width <= viewport.width && value.y + value.height <= viewport.height);
  }
  assert.equal(overlayRect({ overlayX: Infinity, overlayWidth: NaN }, { width: 1920, height: 1080 }).width, 420);
});

test('opening settings expands the HUD without mutating its saved normal size or position', () => {
  const preferences = { overlayX: 1200, overlayY: 680, overlayWidth: 340, overlayHeight: 220, compactStrip: true }, original = structuredClone(preferences);
  const panel = overlayRect(preferences, { width: 1920, height: 1080 }, { panelOpen: true });
  assert.equal(panel.width, 640); assert.equal(panel.height, 680);
  assert.deepEqual(preferences, original);
  assert.equal(overlayRect(preferences, { width: 1920, height: 1080 }).height, 44);
});

test('HUD dragging and resizing clamp at monitor edges without rewriting native window geometry', () => {
  const preferences = { overlayX: 24, overlayY: 24, overlayWidth: 420, overlayHeight: 340 };
  const start = { pointerX: 100, pointerY: 100, preferences, rect: overlayRect(preferences, { width: 1280, height: 720 }) };
  const moved = overlayGesture(start, { x: 4000, y: -4000 }, { width: 1280, height: 720 });
  assert.deepEqual(moved, { overlayX: 848, overlayY: 12 });
  const resized = overlayGesture(start, { x: 110, y: 120 }, { width: 1280, height: 720 }, { resize: true });
  assert.deepEqual(resized, { overlayWidth: 430, overlayHeight: 360 });
  assert.equal(Object.hasOwn(moved, 'width'), false);
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
