// The open-world maps: where each picture's corners are in game coordinates (centimetres; +x is
// east, +y is south, so north is up as on the map), so a received position lands on the picture.
// The corners come from the map definition of the public game database; the pictures are in
// assets/maps (tools/fetch_maps.py). Dungeons, arenas and the upper Abyss have no picture here.
const SECTOR = 102_000;
const world = (name, file, startX, startY, columns, rows) => Object.freeze({
  name, image: `assets/maps/${file}.webp`,
  minX: startX, maxX: startX + columns * SECTOR,
  minY: -(startY + rows * SECTOR), maxY: -startY,
});

export const WORLDS = Object.freeze({
  1000: world('Poeta', 'world_l_starter', -204_000, -204_000, 4, 4),
  1010: world('Verteron', 'world_l_a', -408_000, -408_000, 8, 8),
  1011: world('Eltnen', 'world_l_b', -408_000, -408_000, 8, 8),
  1100: world('Ishalgen', 'world_d_starter', -329_748, -257_999.78, 5, 5),
  1110: world('Altgard', 'world_d_a', -408_000, -408_000, 8, 8),
  1111: world('Morheim', 'world_d_b', -408_000, -408_000, 8, 8),
  20: world('Chaotic Lower Reshanta', 'abyss_reshanta_a', -204_000, -204_000, 4, 4),
});

export const worldMap = mapId => Number.isInteger(mapId) && Object.hasOwn(WORLDS, mapId) ? WORLDS[mapId] : null;

// Where a game position falls on the picture, as fractions from its top-left corner; null when it
// is not a finite position or lies outside the picture.
export function mapPoint(map, x, y) {
  if (!map || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const u = (x - map.minX) / (map.maxX - map.minX), v = (y - map.minY) / (map.maxY - map.minY);
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null;
}

// The way the player is heading, in degrees clockwise from north, from the last real walk: at least
// 3 m between two received positions of the same place, the older one not more than 30 s before.
export function heading(track, selfId, { minimumCm = 300, windowMs = 30_000 } = {}) {
  const mine = (Array.isArray(track) ? track : []).filter(point => String(point?.actor_id) === String(selfId) && Number.isFinite(point.x) && Number.isFinite(point.y));
  const last = mine.at(-1);
  if (!last) return null;
  for (let index = mine.length - 2; index >= 0; index -= 1) {
    const before = mine[index];
    if (last.at_ms - before.at_ms > windowMs) return null;
    if (before.map_id !== last.map_id || before.epoch !== last.epoch) return null;
    if (Math.hypot(last.x - before.x, last.y - before.y) >= minimumCm) {
      const degrees = Math.atan2(last.x - before.x, -(last.y - before.y)) * 180 / Math.PI;
      return Math.round((degrees + 360) % 360 * 10) / 10;
    }
  }
  return null;
}
