import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { WORLDS, heading, mapPoint, worldMap } from '../maps.mjs';

test('every world has its picture on disk and no picture is left unnamed', () => {
  const folder = new URL('../assets/maps/', import.meta.url);
  for (const [id, map] of Object.entries(WORLDS)) {
    assert.match(map.image, /^assets\/maps\/[a-z0-9_]+\.webp$/, id);
    const file = new URL(map.image.replace('assets/maps/', ''), folder);
    assert.ok(existsSync(file), map.image);
    assert.ok(statSync(file).size > 50_000 && statSync(file).size <= 400_000, `${map.image} is ${statSync(file).size} bytes`);
    assert.ok(map.maxX > map.minX && map.maxY > map.minY, id);
    assert.equal(map.maxX - map.minX, map.maxY - map.minY, `${id} is square like its picture`);
  }
  assert.deepEqual(readdirSync(folder).filter(name => name.endsWith('.webp')).sort(), Object.values(WORLDS).map(map => map.image.replace('assets/maps/', '')).sort());
});

test('a position lands on the picture with north up and east to the right', () => {
  const map = worldMap(1010);
  assert.equal(map.name, 'Verteron');
  assert.deepEqual(mapPoint(map, 0, 0), { u: 0.5, v: 0.5 });
  assert.deepEqual(mapPoint(map, -408_000, -408_000), { u: 0, v: 0 }, 'north-west corner');
  assert.deepEqual(mapPoint(map, 408_000, 408_000), { u: 1, v: 1 }, 'south-east corner');
  assert.ok(mapPoint(map, 0, -204_000).v < 0.5, 'smaller y is further north, up the picture');
  assert.ok(mapPoint(map, 204_000, 0).u > 0.5, 'larger x is further east, to the right');
  const ishalgen = worldMap(1100);
  assert.ok(Math.abs(mapPoint(ishalgen, -329_748, -252_000.22).u) < 1e-9 && Math.abs(mapPoint(ishalgen, -329_748, -252_000.22).v) < 1e-9);
  for (const [x, y] of [[409_000, 0], [0, -409_000], [NaN, 0], [0, Infinity], [undefined, 0]]) assert.equal(mapPoint(map, x, y), null);
  assert.equal(mapPoint(null, 0, 0), null);
});

test('only the open worlds have a map, and map ids are looked up exactly', () => {
  for (const id of [1000, 1010, 1011, 1100, 1110, 1111, 20]) assert.ok(worldMap(id), id);
  for (const id of [0, 22, 600011, 1010.5, '1010', null, undefined, NaN, -1]) assert.equal(worldMap(id), null, String(id));
  assert.equal(worldMap('constructor'), null); assert.equal(worldMap('__proto__'), null);
});

const step = (at, x, y, patch = {}) => ({ actor_id: '7', at_ms: at, x, y, map_id: 1010, epoch: 1, ...patch });

test('the heading comes from the last real walk and is clockwise from north', () => {
  assert.equal(heading([step(0, 0, 0), step(1000, 0, -500)], 7), 0, 'smaller y is north');
  assert.equal(heading([step(0, 0, 0), step(1000, 500, 0)], 7), 90, 'east');
  assert.equal(heading([step(0, 0, 0), step(1000, 0, 500)], 7), 180, 'south');
  assert.equal(heading([step(0, 0, 0), step(1000, -500, 0)], 7), 270, 'west');
  // A standing still, an old walk, another place and another player give no heading.
  assert.equal(heading([step(0, 0, 0), step(1000, 100, 0)], 7), null, 'under 3 m');
  assert.equal(heading([step(0, 0, 0), step(40_000, 500, 0)], 7), null, 'older than 30 s');
  assert.equal(heading([step(0, 0, 0, { map_id: 1110 }), step(1000, 500, 0)], 7), null);
  assert.equal(heading([step(0, 0, 0, { epoch: 0 }), step(1000, 500, 0)], 7), null);
  assert.equal(heading([step(0, 0, 0, { actor_id: '9' }), step(1000, 500, 0, { actor_id: '9' })], 7), null);
  assert.equal(heading([], 7), null); assert.equal(heading(undefined, 7), null);
  // It uses the newest point and the nearest older one that is far enough.
  assert.equal(heading([step(0, 0, 0), step(500, 200, 0), step(1000, 400, 0)], 7), 90);
});
