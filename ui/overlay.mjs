const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// HUD coordinates are CSS pixels; native monitor geometry is kept separately.
export function overlayRect(preferences = {}, viewport = {}, { panelOpen = false } = {}) {
  const screenWidth = Math.max(1, finite(viewport.width, 1280)), screenHeight = Math.max(1, finite(viewport.height, 720));
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
  const dx = finite(pointer?.x, start.pointerX) - start.pointerX, dy = finite(pointer?.y, start.pointerY) - start.pointerY;
  const proposal = resize ? { ...start.preferences, overlayWidth: start.rect.width + dx, overlayHeight: start.rect.height + dy } : { ...start.preferences, overlayX: start.rect.x + dx, overlayY: start.rect.y + dy };
  const rect = overlayRect(proposal, viewport, { panelOpen });
  return resize ? { overlayWidth: rect.width, overlayHeight: rect.height } : { overlayX: rect.x, overlayY: rect.y };
}
