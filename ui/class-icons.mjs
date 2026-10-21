// Game class artwork, bundled locally. Origin and rights: assets/classes/README.md.
const icons = Object.freeze({
  gladiator: 'gladiator', templar: 'templar', assassin: 'assassin', ranger: 'ranger',
  sorcerer: 'sorcerer', spiritmaster: 'elementalist', cleric: 'cleric', chanter: 'chanter', brawler: 'fighter',
});
const aliases = Object.freeze({
  검성: 'gladiator', 수호성: 'templar', 살성: 'assassin', 궁성: 'ranger', 마도성: 'sorcerer',
  정령성: 'spiritmaster', 치유성: 'cleric', 호법성: 'chanter', 권성: 'brawler',
  elementalist: 'spiritmaster', fighter: 'brawler',
});
export const CLASS_ICONS = Object.freeze(Object.keys(icons));

export function classIconPath(name) {
  const key = typeof name === 'string' ? name.trim().toLowerCase().replace(/[\s_-]/g, '') : '';
  const canonical = Object.hasOwn(aliases, key) ? aliases[key] : key;
  const icon = Object.hasOwn(icons, canonical) ? icons[canonical] : null;
  return icon ? `assets/classes/${icon}.png` : null;
}

export function classIcon(name) {
  const path = classIconPath(name);
  return path ? `<img src="${path}" width="24" height="24" alt="" aria-hidden="true" draggable="false">`
    : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="7"/><path d="M12 8v5m0 3h.01"/></svg>';
}
