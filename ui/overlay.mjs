const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export const fullscreenLayout = preferences => preferences?.fullscreenLayout === 'hud' ? 'hud' : 'dashboard';
export const isFullscreenDashboard = preferences => preferences?.fullscreenOverlay === true && fullscreenLayout(preferences) === 'dashboard';

// Regions use WebView CSS pixels. Clip controls to the viewport and every
// scrolling/clipping ancestor; off-screen buttons must not catch game clicks.
export function clippedInputRegion(rect, viewport, clips = []) {
  const valid = value => value && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(value[key])) && value.width > 0 && value.height > 0;
  if (!valid(rect) || !Number.isFinite(viewport?.width) || !Number.isFinite(viewport?.height) || viewport.width <= 0 || viewport.height <= 0) return null;
  let left = rect.x, top = rect.y, right = left + rect.width, bottom = top + rect.height;
  for (const clip of [{ x: 0, y: 0, width: Math.min(32768, viewport.width), height: Math.min(32768, viewport.height) }, ...clips]) {
    if (!valid(clip)) return null;
    left = Math.max(left, clip.x); top = Math.max(top, clip.y);
    right = Math.min(right, clip.x + clip.width); bottom = Math.min(bottom, clip.y + clip.height);
  }
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

// Both layouts use CSS pixels; the saved HUD and native window geometry stay separate.
export function overlayRect(preferences = {}, viewport = {}, { panelOpen = false } = {}) {
  const screenWidth = Math.max(1, finite(viewport.width, 1280)), screenHeight = Math.max(1, finite(viewport.height, 720));
  if (fullscreenLayout(preferences) === 'dashboard') return { x: 0, y: 0, width: Math.round(screenWidth), height: Math.round(screenHeight) };
  const inset = Math.max(0, Math.min(12, (screenWidth - 280) / 2, (screenHeight - 44) / 2));
  const availableWidth = Math.max(1, screenWidth - inset * 2), availableHeight = Math.max(1, screenHeight - inset * 2);
  const desiredWidth = clamp(finite(preferences.overlayWidth, 420), 280, 1200);
  const minimumHeight = preferences.layout && preferences.layout !== 'cupertino' ? 280 : 200;
  const desiredHeight = preferences.compactStrip && !panelOpen ? 44 : clamp(finite(preferences.overlayHeight, 340), minimumHeight, 1200);
  const width = Math.min(availableWidth, panelOpen ? Math.max(desiredWidth, Math.min(640, availableWidth)) : desiredWidth);
  const height = Math.min(availableHeight, panelOpen ? Math.max(desiredHeight, Math.min(680, availableHeight)) : desiredHeight);
  return { x: Math.round(clamp(finite(preferences.overlayX, 24), inset, screenWidth - inset - width)), y: Math.round(clamp(finite(preferences.overlayY, 24), inset, screenHeight - inset - height)), width: Math.round(width), height: Math.round(height) };
}

export function overlayGesture(start, pointer, viewport, { resize = false, panelOpen = false } = {}) {
  if (fullscreenLayout(start.preferences) === 'dashboard') return {};
  const dx = finite(pointer?.x, start.pointerX) - start.pointerX, dy = finite(pointer?.y, start.pointerY) - start.pointerY;
  const proposal = resize ? { ...start.preferences, overlayWidth: start.rect.width + dx, overlayHeight: start.rect.height + dy } : { ...start.preferences, overlayX: start.rect.x + dx, overlayY: start.rect.y + dy };
  const rect = overlayRect(proposal, viewport, { panelOpen });
  return resize ? { overlayWidth: rect.width, overlayHeight: rect.height } : { overlayX: rect.x, overlayY: rect.y };
}
