// Only received world positions belong on the radar. Cast aim points stay
// separate, and an old observation never becomes a fresh position on a poll.
const rows = (value, cap) => Array.isArray(value) ? value.slice(0, cap) : [];
const uint = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null;
const actorId = value => uint(Number(value), 0xffffffff) > 0 ? String(Number(value)) : null;
const text = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) : '';
export const escapeSpatial = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const coord = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1000000;
const sources = new Set(['server-position', 'server-spawn', 'server-zone', 'server-effect', 'server-remove']);
const pointKey = p => `${p.actor_id}:${p.generation}`;

export function spatialSnapshot(input = {}) {
  const value = input && typeof input === 'object' ? input : {};
  const point = p => p && actorId(p.actor_id) && uint(p.at_ms) !== null && coord(p.x) && coord(p.y) && (p.z == null || coord(p.z)) && sources.has(p.source)
    ? { actor_id: actorId(p.actor_id), generation: uint(p.generation, 0xffffffff) ?? 0, map_id: uint(p.map_id), epoch: uint(p.epoch, 0xffffffff) ?? 0, x: p.x, y: p.y, z: p.z ?? null, at_ms: p.at_ms, present: p.present === true, source: p.source } : null;
  const actors = rows(value.actors, 1024).filter(a => a && actorId(a.actor_id)).map(a => ({ actor_id: actorId(a.actor_id), generation: uint(a.generation, 0xffffffff) ?? 0,
    name: text(a.name), class_name: text(a.class_name), kind: ['player', 'npc', 'pet'].includes(a.kind) ? a.kind : 'unknown', npc_id: uint(a.npc_id, 9999999) }));
  const aims = rows(value.aims, 512).filter(a => a && actorId(a.actor_id) && uint(a.at_ms) !== null && uint(a.until_ms) !== null && a.until_ms >= a.at_ms && a.until_ms - a.at_ms <= 120000 && coord(a.x) && coord(a.y) && (a.z == null || coord(a.z))).map(a => ({ actor_id: actorId(a.actor_id), generation: uint(a.generation, 0xffffffff) ?? 0, target_id: actorId(a.target_id), skill_id: uint(a.skill_id, 0xffffffff), at_ms: a.at_ms, until_ms: a.until_ms, map_id: uint(a.map_id), epoch: uint(a.epoch, 0xffffffff) ?? 0, x: a.x, y: a.y, z: a.z ?? null }));
  return { map_id: uint(value.map_id), epoch: uint(value.epoch, 0xffffffff) ?? 0, sampled_at_ms: uint(value.sampled_at_ms) ?? 0, actors,
    positions: rows(value.positions, 256).map(point).filter(Boolean), track: rows(value.track, 12000).map(point).filter(Boolean).sort((a, b) => a.at_ms - b.at_ms), aims, retention_limited: value.retention_limited === true };
}

export function spatialFrame(value, { at = Date.now(), selfId, partyIds = [], replay = false, filter = 'all', petMatches = () => [] } = {}) {
  const data = spatialSnapshot(value), latest = new Map(), metadata = new Map(data.actors.map(a => [pointKey(a), a]));
  for (const p of replay ? data.track : data.positions) if (p.at_ms <= at && p.map_id === data.map_id) {
    const prior = latest.get(p.actor_id);
    if (!prior || p.at_ms >= prior.at_ms) latest.set(p.actor_id, p);
  }
  const self = latest.get(String(selfId)), fresh = p => p?.present && at >= p.at_ms && at - p.at_ms <= 15000;
  // Without a fresh, received self position a relative distance is unknowable.
  if (!fresh(self) || !replay && self.epoch !== data.epoch) return { available: false, mapId: data.map_id, markers: [], aims: [], reason: 'self-position' };
  const members = new Set(partyIds.map(String)), markers = [];
  for (const p of latest.values()) {
    if (!fresh(p) || p.epoch !== self.epoch) continue;
    const meta = metadata.get(pointKey(p)) || {}, own = p.actor_id === String(selfId), pets = petMatches({ npc_id: meta.npc_id, name: meta.name });
    const party = members.has(p.actor_id), kind = own ? 'self' : party ? 'party' : meta.kind || 'unknown';
    if (!own && (filter === 'party' && !party || filter === 'pets' && !pets.length || filter === 'npc' && !['npc', 'pet'].includes(kind))) continue;
    const dx = (p.x - self.x) / 100, dy = (p.y - self.y) / 100;
    markers.push({ ...p, kind, name: meta.name || '', npc_id: meta.npc_id, pets, dx, dy, distance: Math.hypot(dx, dy), height: p.z !== null && self.z !== null ? (p.z - self.z) / 100 : null, stale: at - p.at_ms > 5000, ageMs: at - p.at_ms });
  }
  const aims = data.aims.filter(a => a.map_id === self.map_id && a.epoch === self.epoch && a.at_ms <= at && a.until_ms > at)
    .map(a => ({ ...a, dx: (a.x - self.x) / 100, dy: (a.y - self.y) / 100 }));
  return { available: true, mapId: data.map_id, self, markers: markers.sort((a, b) => a.distance - b.distance), aims, stale: at - self.at_ms > 5000 };
}

export function renderRadar(frame, { locale = 'tr', range = 100, hideNames = false, compact = false, pinnedIds = [] } = {}) {
  const tr = locale === 'tr', esc = escapeSpatial;
  if (!frame.available) return `<div class="spatial-empty"><span aria-hidden="true">⌖</span><strong>${tr ? 'Konum bekleniyor' : 'Waiting for position'}</strong><p>${tr ? 'Karakterin konumu oyun akışından geldiğinde radar otomatik açılır. Hareket ettikçe güncellenir.' : 'The radar appears automatically when the game supplies your position and updates as you move.'}</p></div>`;
  const radius = [20, 50, 100, 200].includes(Number(range)) ? Number(range) : 100;
  const visible = frame.markers.filter(p => p.distance <= radius), label = p => hideNames && ['self', 'player', 'party'].includes(p.kind) ? tr ? 'Oyuncu' : 'Player' : p.name || (p.kind === 'self' ? tr ? 'Sen' : 'You' : p.pets[0]?.monster || (tr ? 'Alınan kaynak' : 'Received source'));
  return `<div class="radar-view ${compact ? 'radar-compact' : ''}"><svg viewBox="0 0 320 320" role="img" aria-label="${tr ? 'Oyuncu merkezli konum radarı, sabit dünya eksenleri' : 'Player centred radar, fixed world axes'}"><circle class="radar-surface" cx="160" cy="160" r="144"/><g class="radar-grid"><circle cx="160" cy="160" r="48"/><circle cx="160" cy="160" r="96"/><circle cx="160" cy="160" r="144"/><path d="M16 160h288M160 16v288"/></g><g class="radar-axis"><text x="160" y="12" text-anchor="middle">+Y</text><text x="308" y="164">+X</text><text x="163" y="305">${radius} m</text></g>${frame.aims.filter(a => Math.hypot(a.dx, a.dy) <= radius).map(a => `<path class="radar-aim" d="M${160 + a.dx / radius * 144 - 5} ${160 - a.dy / radius * 144}h10m-5-5v10"><title>${tr ? 'Yetenek hedef noktası' : 'Skill aim point'}</title></path>`).join('')}${visible.map(p => `<g class="radar-point" data-kind="${p.pets.length && p.kind !== 'self' ? 'pet' : p.kind}" data-stale="${p.stale}" transform="translate(${160 + p.dx / radius * 144} ${160 - p.dy / radius * 144})"><title>${esc(label(p))} · ${p.distance.toFixed(1)} m · ${(p.ageMs / 1000).toFixed(1)} s</title>${p.kind === 'self' ? '<path d="m0-7 6 12-6-3-6 3z"/>' : p.pets.length ? '<path d="m0-6 6 6-6 6-6-6z"/>' : '<circle r="4"/>'}</g>`).join('')}</svg><p class="radar-caption">${frame.stale ? tr ? 'Son alınan konum · ' : 'Last received position · ' : ''}${tr ? 'Sabit +X / +Y · kamera yönü değildir' : 'Fixed +X / +Y · not camera heading'}</p></div>${compact ? '' : `<div class="radar-list">${visible.filter(p => p.kind !== 'self').slice(0, 32).map(p => `<article class="radar-entry"><span class="radar-dot" data-kind="${p.pets.length ? 'pet' : p.kind}"></span><div><strong>${esc(label(p))}</strong><small>${esc(p.pets.map(p => p.name).join(' · '))}${p.stale ? ` · ${tr ? 'son görülen' : 'last seen'} ${(p.ageMs / 1000).toFixed(0)} s` : ''}</small></div><b>${p.distance.toFixed(1)} m${p.height === null ? '' : ` <small>${p.height > 0 ? '↑' : '↓'}${Math.abs(p.height).toFixed(0)}</small>`}</b>${p.pets.slice(0, 3).map(pet => `<button type="button" class="text-button" data-action="pet-pin" data-id="${pet.id}" aria-pressed="${pinnedIds.includes(pet.id)}" aria-label="${esc(tr ? `Sabitle: ${pet.name}` : `Pin: ${pet.name}`)}">⌖</button>`).join('')}</article>`).join('') || `<p class="help">${tr ? 'Bu aralıkta alınan konum yok.' : 'No received positions in this range.'}</p>`}</div>`}`;
}
