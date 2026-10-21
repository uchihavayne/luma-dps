import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialSnapshot, spatialFrame, renderRadar } from '../spatial.mjs';
import { replayTimeline, replayFrame, replayClock, renderReplayFrame } from '../replay.mjs';
import { normalizeState, normalizeEncounter } from '../model.mjs';
import { exportEncounterJson, importEncounterCollection } from '../reports.mjs';
const point = (id, x, at = 1000, more = {}) => ({ actor_id: id, x, y: 2000, z: 100, at_ms: at, generation: 0, epoch: 1, map_id: 5, present: true, source: 'server-position', ...more });
const spatial = { map_id: 5, epoch: 1, sampled_at_ms: 1000, actors: [{ actor_id: 7, name: 'Archer', kind: 'player' }, { actor_id: 8, name: 'Mob', kind: 'npc', npc_id: 100001 }], positions: [point(7, 1000), point(8, 4000)], track: [point(7, 1000), point(8, 4000)] };
const record = { started_ms: 1000, ended_ms: 3000, total_damage: 9999, sample_complete: false, local_player_id: 7, local_identity_source: 'server', party_member_ids: [7, 9], party_membership_source: 'server', spatial,
  players: [{ id: 7, name: 'Archer' }, { id: 8, name: 'Nearby' }], damage_samples: [{ timestamp_ms: 1000, player_id: 7, source: 7, target: 10, skill: 1, amount: 100, metric: 'damage' }, { timestamp_ms: 2000, player_id: 8, source: 8, target: 10, skill: 1, amount: 200, metric: 'damage' }] };
test('relative radar uses received centimetres and requires a fresh self anchor', () => {
  const frame = spatialFrame(spatial, { at: 1100, selfId: 7 });
  assert.equal(frame.markers.find(p => p.actor_id === '8').distance, 30);
  assert.equal(spatialFrame(spatial, { at: 17000, selfId: 7 }).available, false);
  assert.equal(spatialFrame(spatial, { at: 1100, selfId: null }).available, false);
  assert.equal(spatialFrame({ ...spatial, epoch: 2 }, { at: 1100, selfId: 7 }).available, false);
});
test('replay uses actor generations and server removal rather than recycled names or interpolated positions', () => {
  const value = { ...spatial, actors: [...spatial.actors, { actor_id: 8, generation: 1, name: 'Replacement', kind: 'npc' }], track: [...spatial.track, point(8, 4000, 1500, { present: false, source: 'server-remove' }), point(8, 6000, 2000, { generation: 1 })] };
  assert.equal(spatialFrame(value, { at: 1600, selfId: 7, replay: true }).markers.length, 1);
  assert.equal(spatialFrame(value, { at: 2100, selfId: 7, replay: true }).markers.find(p => p.actor_id === '8').name, 'Replacement');
  assert.equal(spatialFrame(value, { at: 1200, selfId: 7, replay: true }).markers.find(p => p.actor_id === '8').name, 'Mob');
});
test('aim points cannot establish self position; invalid and future coordinates do not place dots', () => {
  assert.equal(spatialFrame({ ...spatial, positions: [], aims: [{ actor_id: 7, x: 10, y: 20, at_ms: 1000, until_ms: 2000 }] }, { at: 1100, selfId: 7 }).available, false);
  assert.equal(spatialSnapshot({ positions: [point(7, NaN), point(7, Infinity), point(7, 1000001)] }).positions.length, 0);
  assert.equal(spatialFrame(spatial, { at: 999, selfId: 7 }).available, false);
});
test('pet matches enable a real pin action and escaped radar labels honor privacy', () => {
  const frame = spatialFrame(spatial, { at: 1100, selfId: 7, filter: 'pets', petMatches: t => t.npc_id === 100001 ? [{ id: 1001, name: 'Pet <test>' }] : [] });
  const html = renderRadar(frame);
  assert.match(html, /data-action="pet-pin" data-id="1001"/);
  assert.match(html, /Pet &lt;test&gt;/);
  assert.doesNotMatch(renderRadar(spatialFrame(spatial, { at: 1100, selfId: 7, partyIds: [8] }), { hideNames: true }), />Mob</);
});
test('replay totals use retained samples at or before the cursor, never aggregate scaling', () => {
  const timeline = replayTimeline(record), frame = replayFrame(record, timeline, 500);
  assert.equal(frame.total, 100); assert.equal(frame.dps, 100); assert.equal(timeline.complete, false);
  assert.equal(replayFrame(record, timeline, 1000).total, 300);
  assert.equal(replayFrame(record, replayTimeline(record, 'personal'), 2000).total, 100);
  assert.equal(replayFrame(record, replayTimeline(record, 'party'), 2000).total, 100);
  assert.match(renderReplayFrame(frame, timeline), /Kısmi kayıt/);
});
test('old records replay damage without invented positions and exclude non-damage samples', () => {
  const old = { ...record, spatial: undefined, damage_samples: [...record.damage_samples, { ...record.damage_samples[0], metric: 'healing', amount: 10000 }] };
  const timeline = replayTimeline(old), frame = replayFrame(old, timeline, 2000);
  assert.equal(frame.total, 300); assert.equal(frame.spatial.available, false);
});
test('scrubbing and playback speed use elapsed real time without a jump after pause', () => {
  const c = replayClock();c.toggle(2000);c.tick(100, 2000);assert.equal(c.tick(600, 2000), 500);
  c.rate(2);assert.equal(c.tick(850, 2000), 1000);c.pause();c.tick(5000, 2000);assert.equal(c.offset, 1000);
  c.seek(100, 2000);c.toggle(2000);c.tick(6000, 2000);assert.equal(c.offset, 100);assert.equal(c.tick(8000, 2000), 2000);assert.equal(c.playing, false);
});
test('live and retained DTOs preserve bounded spatial data and ignore missing data', () => {
  assert.equal(normalizeState({ spatial }).spatial.positions.length, 2);
  assert.equal(normalizeEncounter(record).spatial.track.length, 2);
  assert.equal(normalizeState({}).spatial.positions.length, 0);
});
test('local JSON preserves replay coordinates with native numeric IDs while anonymous reports omit paths and names', () => {
  const source = { ...record, personal_total_damage: 100, personal_dps: 50, personal_elapsed_ms: 2000, personal_started_ms: 1000, players: record.players.map(p => ({ ...p, damage: 100, dps: 50, skills: [] })), damage_samples: record.damage_samples.map(s => ({ ...s, critical: false, tick: false, flags: 0, angle: 0 })) };
  const json = exportEncounterJson(source, { scope: 'observed' }), round = importEncounterCollection(json).encounters[0];
  assert.equal(round.spatial.track[0].actor_id, 7);
  assert.equal(round.spatial.track.length, 2);
  const anon = JSON.parse(exportEncounterJson(source, { scope: 'observed', anonymize: true })).encounters[0];
  assert.equal(anon.spatial, undefined);
  assert.doesNotMatch(JSON.stringify(anon), /Archer|Nearby|Mob/);
});
