// Original outline symbols, kept local so the roster never needs an asset host.
const shapes = Object.freeze({
  gladiator: '<path d="m5 3 14 16M3 5l2-2m11 13 3 3M19 3 5 17m16-12-2-2M8 16l-3 3M3 17l4 4m10-4 4-4"/>',
  templar: '<path d="M12 2 4 5v6c0 5 8 11 8 11s8-6 8-11V5zM12 6v11M8 10h8"/>',
  assassin: '<path d="m4 3 9 9-4 2zM20 3l-9 9 4 2zM9 14l-5 7m11-7 5 7M6 14l5 4m2 0 5-4"/>',
  ranger: '<path d="M7 2c12 5 12 15 0 20L7 2zm0 0 6 10-6 10M3 12h18m-4-4 4 4-4 4"/>',
  sorcerer: '<path d="m12 2 2.4 6.2L21 10l-5 4.3.4 7-4.4-4-4.4 4 .4-7L3 10l6.6-1.8z"/><circle cx="12" cy="11" r="2"/>',
  spiritmaster: '<path d="M12 2c1 5 6 6 6 11a6 6 0 1 1-12 0c0-2 1-4 3-6 0 4 2 5 3 4 2-2 0-6 0-9zM12 13c4 4 3 8 0 8s-4-4 0-8z"/>',
  cleric: '<path d="M9 2h6v6h6v6h-6v8H9v-8H3V8h6z"/>',
  chanter: '<path d="M12 9v13M8 22h8M7 3l5-1 5 1-1 6-4 3-4-3zM4 5h3m10 0h3M9 6h6M4 15l3-2m13 2-3-2"/>',
  brawler: '<path d="M5 11V7a2 2 0 0 1 4 0V4a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v5l-4 8H9l-6-7a2 2 0 0 1 2-3zm4-4v5m4-6v6m4-4v4M9 21v-4h8"/>',
});

export const CLASS_ICONS = Object.freeze(Object.keys(shapes));

export function classIcon(name) {
  const key = typeof name === 'string' ? name.trim().toLowerCase().replace(/[\s_-]/g, '') : '';
  const shape = shapes[key] || '<circle cx="12" cy="12" r="7"/><path d="M12 8v5m0 3h.01"/>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape}</svg>`;
}
