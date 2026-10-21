export const HUD_PANELS = Object.freeze(['pets', 'events', 'team', 'odyle']);

export function normalizeHudPanels(input) {
  return [...new Set((Array.isArray(input) ? input : []).filter(name => HUD_PANELS.includes(name)))];
}

// Collection/capture and visibility are independent. Hiding a panel never stops
// packet processing, the collection cache, cooldowns or Cube listening.
export function hudPanelVisible(preferences, name) {
  if (preferences?.displayModules?.[name] === false) return false;
  const petOnly = preferences?.displayModules?.pets === true && preferences?.displayModules?.dps === false && Object.entries(preferences.displayModules).every(([key, value]) => key === 'pets' || value === false);
  return preferences?.layout !== 'cupertino' || name === 'pets' && petOnly || normalizeHudPanels(preferences?.hudPanels).includes(name);
}

export function hudPanelChange(preferences, name, visible) {
  if (!HUD_PANELS.includes(name)) return {};
  const panels = new Set(normalizeHudPanels(preferences?.hudPanels));
  if (visible) panels.add(name); else panels.delete(name);
  return { hudPanels: [...panels], ...(visible ? { displayModules: { ...preferences?.displayModules, [name]: true } } : {}) };
}

export function previewFrame(input) {
  const match = typeof input === 'string' && /^(\d{3,4})x(\d{3,4})$/.exec(input);
  if (!match) return null;
  const width = Number(match[1]), height = Number(match[2]);
  return width >= 320 && width <= 1600 && height >= 200 && height <= 1600 ? { width, height } : null;
}
