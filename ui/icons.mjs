// The game's own icons for skills, effects, tickets and currencies, kept as small files in
// assets/icons (docs/reference-data.md). An id with no icon gets none, never a wrong one.
import { BUFFS_ICONS, EXTRA_ICONS, ICONS, ITEMS_ICONS, SKILLS_ICONS, TICKETS_ICONS } from './game-icons.mjs';

const file = index => Number.isInteger(index) ? `assets/icons/${ICONS[index]}.webp` : null;
const find = (family, id) => Number.isSafeInteger(id) && Object.hasOwn(family, id) ? file(family[id]) : null;

// The Hidden Cube as the game draws it: gold or red.
export const cubeIconPath = look => file(look === 'red' ? EXTRA_ICONS.cube_red : EXTRA_ICONS.cube_gold);
export const ticketIconPath = id => find(TICKETS_ICONS, id);
export const itemIconPath = id => find(ITEMS_ICONS, id);
export const buffIconPath = id => find(BUFFS_ICONS, id);

// A skill id names its level in the last digits: the exact id, then the ten-step, then the family.
export function skillIconPath(id) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  for (const candidate of [id, Math.floor(id / 10) * 10, Math.floor(id / 10_000) * 10_000]) {
    const path = find(SKILLS_ICONS, candidate);
    if (path) return path;
  }
  return null;
}

// The picture as markup, or nothing when there is none.
export const iconImg = (path, size = 24) => path ? `<img class="game-icon" src="${path}" width="${size}" height="${size}" alt="" aria-hidden="true" draggable="false">` : '';
