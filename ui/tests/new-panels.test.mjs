import test from 'node:test';
import assert from 'node:assert/strict';
import { PANELS, renderPanel } from '../overlay-panels.mjs';
import { allEvents } from '../events.mjs';
import { normalizePreferences, normalizeState } from '../model.mjs';
import { SKILLS_ICONS } from '../game-icons.mjs';

const NOW = 1_790_000_000_000;
const label = id => `Skill ${id}`;
const knownSkill = Number(Object.keys(SKILLS_ICONS).find(id => Number(id) > 11_000_000));

test('the Timers window lists what is open first, then what opens next, and says so when there is none', () => {
  const html = renderPanel('timers', { state: normalizeState({}), events: allEvents({}), now: NOW, locale: 'en' });
  assert.match(html, /class="timers"/);
  const rows = [...html.matchAll(/<div class="timer" data-open="(true|false)"><span class="name">([^<]*)<\/span><small>[^<]*<\/small><time>([^<]*)<\/time>/g)];
  assert.ok(rows.length >= 5 && rows.length <= 10);
  assert.ok(rows.every(row => /^\d+:\d{2}(:\d{2})?$/.test(row[3])), 'every row has a countdown');
  const open = rows.map(row => row[1] === 'true');
  assert.deepEqual(open, [...open].sort((a, b) => Number(b) - Number(a)), 'open events come first');
  assert.match(renderPanel('timers', { state: normalizeState({}), events: [], now: NOW, locale: 'en' }), /No event timer to show/);
  assert.match(renderPanel('timers', { state: normalizeState({}), events: [{ id: 'x', name: 'Off', enabled: false }], now: NOW }), /Gösterilecek etkinlik/);
  // A name that tries to inject markup is escaped.
  const hostile = [{ ...allEvents({})[0], name: '<b onmouseover=1>x</b>' }];
  assert.doesNotMatch(renderPanel('timers', { state: normalizeState({}), events: hostile, now: NOW }), /<b onmouseover/);
});

test('the Flight window shows the points as a bar and the seconds left only while they drain', () => {
  const drain = { fp: 60_000, max: 100_000, observed_at_ms: NOW, drain_per_s: 2_000 };
  const flying = renderPanel('flight', { state: normalizeState({ flight: drain }), now: NOW, locale: 'en' });
  assert.match(flying, /data-flying="true" data-low="false"/);
  assert.match(flying, /<b>60%<\/b><span>0:30<\/span>/);
  assert.match(flying, /style="width:60\.0%"/); assert.match(flying, /60K \/ 100K/);
  assert.match(renderPanel('flight', { state: normalizeState({ flight: { ...drain, fp: 10_000 } }), now: NOW }), /data-low="true"/);
  const resting = renderPanel('flight', { state: normalizeState({ flight: { ...drain, drain_per_s: null } }), now: NOW, locale: 'en' });
  assert.match(resting, /data-flying="false"/); assert.match(resting, /resting/);
  // Without a maximum there is no percent, only the points.
  assert.match(renderPanel('flight', { state: normalizeState({ flight: { fp: 5_000, max: null, drain_per_s: null } }), now: NOW }), /<b>5\.0K<\/b>/);
  assert.match(renderPanel('flight', { state: normalizeState({}), now: NOW, locale: 'en' }), /No flight points yet/);
  for (const junk of [{ fp: -1 }, { fp: 'x' }, { fp: 5, drain_per_s: -3 }, 7, []]) assert.ok(!/<script/.test(renderPanel('flight', { state: normalizeState({ flight: junk }), now: NOW })));
  assert.equal(normalizeState({ flight: { fp: 5, drain_per_s: -3 } }).flight.drain_per_s, null);
  assert.equal(normalizeState({ flight: { fp: -1 } }).flight, null);
  assert.deepEqual(normalizeState(normalizeState({ flight: drain })).flight, normalizeState({ flight: drain }).flight);
});

const target = (patch = {}) => ({ id: '90', name: 'Boss', npc_id: 2_300_001, is_boss: true, damage: 5000, current_hp: 600_000, reported_max_hp: 1_000_000, observed_peak_hp: 1_000_000, health_observed_at_ms: NOW - 500, current_hp_observed_at_ms: NOW - 500, ...patch });

test('the Target health window shows the focus first, then bosses, with bar, percent and numbers', () => {
  const state = normalizeState({ live_target: target({ id: '91', name: 'Add', is_boss: false, current_hp: 5_000, reported_max_hp: 20_000 }), personal_targets: [target({ id: '92', name: 'Small', is_boss: false, damage: 10 }), target()] });
  const html = renderPanel('bosshp', { state, now: NOW, locale: 'en' });
  assert.ok(html.indexOf('Add') < html.indexOf('Boss') && html.indexOf('Boss') < html.indexOf('Small'), 'focus, then boss, then the rest');
  assert.match(html, /<b>25%<\/b><i class="bar"><u style="width:25\.0%"><\/u><\/i><small>5\.0K \/ 20K<\/small>/);
  assert.match(html, /data-boss="true"/);
  // A value the game has not repeated lately is the last one known, dimmed; a dead one says so.
  const stale = renderPanel('bosshp', { state: normalizeState({ live_target: target({ current_hp_observed_at_ms: NOW - 60_000 }) }), now: NOW });
  assert.match(stale, /data-stale="true"/); assert.match(stale, /<b>60%<\/b>/);
  const dead = renderPanel('bosshp', { state: normalizeState({ live_target: target({ current_hp: 0 }) }), now: NOW, locale: 'en' });
  assert.match(dead, /data-dead="true"/); assert.match(dead, /<b>Dead<\/b>/);
  // No maximum: the number alone. No health at all: the target is not listed.
  assert.match(renderPanel('bosshp', { state: normalizeState({ live_target: target({ reported_max_hp: null }) }), now: NOW }), /<b>600K<\/b>/);
  assert.match(renderPanel('bosshp', { state: normalizeState({ live_target: target({ current_hp: null }) }), now: NOW, locale: 'en' }), /Waiting for a target/);
  assert.match(renderPanel('bosshp', { state: normalizeState({}), now: NOW }), /Hedef bekleniyor/);
  // Only four are shown, and a hostile name is escaped.
  const many = Array.from({ length: 9 }, (_, index) => target({ id: String(100 + index), name: `T${index}` }));
  assert.equal((renderPanel('bosshp', { state: normalizeState({ personal_targets: many }), now: NOW }).match(/class="target"/g) || []).length, 4);
  assert.doesNotMatch(renderPanel('bosshp', { state: normalizeState({ live_target: target({ name: '<img src=x onerror=1>' }) }), now: NOW }), /<img src=x/);
});

test('the Action bar keeps its tiles in fixed places and only the empty case needs no data', () => {
  assert.match(renderPanel('actions', { state: normalizeState({}), now: NOW, locale: 'en', label }), /No skill seen yet/);
  assert.match(renderPanel('actions', { state: normalizeState({}), now: NOW, label }), /Beceri bilgisi henüz gelmedi/);
  assert.ok(Number.isInteger(knownSkill));
});

test('window scale, update rate and snapping are bounded, saved and survive a second pass', () => {
  const defaults = normalizePreferences({});
  assert.deepEqual([defaults.overlayScale, defaults.overlayRate, defaults.overlaySnap], [1, 250, false]);
  const set = normalizePreferences({ overlayScale: 1.25, overlayRate: 500, overlaySnap: true });
  assert.deepEqual([set.overlayScale, set.overlayRate, set.overlaySnap], [1.25, 500, true]);
  assert.deepEqual(normalizePreferences(set).overlayScale, 1.25);
  assert.equal(normalizePreferences({ overlayScale: 9 }).overlayScale, 1.6);
  assert.equal(normalizePreferences({ overlayScale: 0.1 }).overlayScale, 0.8);
  assert.equal(normalizePreferences({ overlayScale: 'big' }).overlayScale, 1);
  assert.equal(normalizePreferences({ overlayRate: 40 }).overlayRate, 250);
  assert.equal(normalizePreferences({ overlayRate: '1000' }).overlayRate, 1000);
  assert.equal(normalizePreferences({ overlaySnap: 'yes' }).overlaySnap, false);
});

const rival = (patch = {}) => ({ actor_id: 21, skill_id: knownSkill, cooldown_ms: 30_000, remaining_ms: 20_000, sampled_at_ms: NOW, observed_at_ms: NOW - 10_000, ...patch });

test('the Opponent cooldowns window shows what others used, with the time still to run', () => {
  const state = normalizeState({ local_player_id: 7, party_member_ids: [7, 22], players: [{ id: 21, name: 'Slayer', class_name: 'Assassin' }, { id: 22, name: 'Friend', class_name: 'Cleric' }],
    actor_cooldowns: [rival(), rival({ skill_id: knownSkill + 10, remaining_ms: 4_000, cooldown_ms: 8_000 }), rival({ actor_id: 22, observed_at_ms: NOW - 1_000 }), rival({ actor_id: 7 })] });
  const html = renderPanel('rivals', { state, now: NOW + 2_000, locale: 'en', label });
  assert.equal((html.match(/<section class="rival"/g) || []).length, 2, 'you are not listed');
  assert.ok(html.indexOf('Friend') < html.indexOf('Slayer'), 'the most recently active first');
  assert.match(html, /data-ally="true"><header><b>Friend<\/b><small>Cleric · Ally<\/small>/);
  assert.match(html, /data-ally="false"><header><b>Slayer<\/b><small>Assassin · Opponent<\/small>/);
  assert.match(html, /<b>18<\/b>/, '20 s left, sampled two seconds ago');
  assert.match(html, /<b>2\.0<\/b>/); assert.match(html, /style="height:25\.0%"/);
  // Run out, impossible, or someone else's junk: not shown.
  const none = normalizeState({ local_player_id: 7, actor_cooldowns: [rival({ remaining_ms: 1_000 }), rival({ cooldown_ms: 0 }), rival({ skill_id: 5 }), rival({ remaining_ms: 'x' }), rival({ actor_id: 0 })] });
  assert.match(renderPanel('rivals', { state: none, now: NOW + 5_000, locale: 'en', label }), /show here/);
  assert.match(renderPanel('rivals', { state: normalizeState({}), now: NOW, label }), /Başkalarının kullandığı/);
  const hostile = normalizeState({ local_player_id: 7, players: [{ id: 21, name: '<img src=x onerror=1>', class_name: 'Ranger' }], actor_cooldowns: [rival()] });
  assert.doesNotMatch(renderPanel('rivals', { state: hostile, now: NOW, label }), /<img src=x/);
  const many = normalizeState({ local_player_id: 7, actor_cooldowns: Array.from({ length: 6 }, (_, index) => rival({ actor_id: 30 + index })) });
  assert.equal((renderPanel('rivals', { state: many, now: NOW, label }).match(/<section class="rival"/g) || []).length, 3);
});

const at = (actor, x, y, patch = {}) => ({ actor_id: actor, generation: 0, map_id: 1010, epoch: 1, x, y, z: 0, at_ms: NOW - 500, present: true, source: 'server-position', ...patch });
const world = (spatial = {}, patch = {}) => normalizeState({ local_player_id: 7, local_identity_source: 'server', party_member_ids: [7, 8],
  spatial: { map_id: 1010, epoch: 1, sampled_at_ms: NOW, actors: [{ actor_id: 8, generation: 0, name: 'Friend', class_name: 'Cleric', kind: 'player' }, { actor_id: 9, generation: 0, name: 'Stranger', class_name: 'Ranger', kind: 'player' }, { actor_id: 10, generation: 0, name: 'Beast', kind: 'npc', npc_id: 2300001 }],
    positions: [at(7, 0, 0), at(8, 20_000, 0), at(9, -10_000, -30_000), at(10, 900_000 - 400_000, 0)], track: [at(7, 0, 500, { at_ms: NOW - 3_000 }), at(7, 0, 0)], ...spatial }, ...patch });

test('the Map window centres the game map on you, with your heading and the others near', () => {
  const html = renderPanel('map', { state: world(), now: NOW, locale: 'en' });
  assert.match(html, /<div class="map" data-range="1000">/);
  assert.match(html, /<img class="world" src="assets\/maps\/world_l_a\.webp" alt="" draggable="false" style="width:816\.00%;transform:translate\(-50\.000%,-50\.000%\)">/);
  assert.match(html, /<svg class="me" [^>]*rotate\(0deg\)/, 'walking towards smaller y is north');
  assert.match(html, /class="dot party" data-stale="false" style="left:70\.00%;top:50\.00%" title="Friend"/);
  assert.match(html, /class="dot player" [^>]*style="left:40\.00%;top:20\.00%" title="Stranger"/);
  assert.doesNotMatch(html, /Beast/, 'what is outside the view is left out');
  assert.match(html, /<b>Verteron<\/b><span>1 km<\/span><time>0, 0 m<\/time>/);
  assert.match(renderPanel('map', { state: world(), now: NOW, locale: 'en', mapRange: 400 }), /data-range="400"[\s\S]*width:2040\.00%/);
  assert.match(renderPanel('map', { state: world(), now: NOW, mapRange: 7 }), /data-range="1000"/);
  // Standing still draws a dot instead of an arrow.
  assert.match(renderPanel('map', { state: world({ track: [at(7, 0, 0)] }), now: NOW }), /class="me still"/);
  // No fresh position, no map for that area, and a position off the picture each say so.
  assert.match(renderPanel('map', { state: normalizeState({}), now: NOW, locale: 'en' }), /position has not arrived/);
  assert.match(renderPanel('map', { state: world({ map_id: 600011, positions: [at(7, 0, 0, { map_id: 600011 })] }), now: NOW, locale: 'en' }), /no map \(area 600011\)/);
  assert.match(renderPanel('map', { state: world({ positions: [at(7, 500_000, 0)] }), now: NOW, locale: 'en' }), /off the map/);
});

test('the Ping window shows the round-trip time with bars that fill with a good connection', () => {
  // The state's own freshness is judged against the real clock, so the sample is taken from it.
  const clock = Date.now();
  const capture = ms => ({ capture: { status: 'capturing', game_connections: 2, network_latency: { status: 'ready', source: 'windows-tcp-estats', selection: 'worst-active-game-tcp', rtt_ms: ms, latest_rtt_ms: ms, variation_ms: 2, observed_at_ms: clock - 500, sampled_at_ms: clock, measured_connections: 2, game_connections: 2 } } });
  const bars = html => (html.match(/data-on="true"/g) || []).length;
  for (const [ms, tone, filled] of [[40, 'good', 4], [90, 'good', 3], [140, 'fair', 2], [300, 'poor', 1]]) {
    const html = renderPanel('ping', { state: normalizeState(capture(ms)), now: clock, locale: 'en' });
    assert.match(html, new RegExp(`data-tone="${tone}"`)); assert.equal(bars(html), filled, `${ms} ms`);
    assert.match(html, new RegExp(`<b>${ms}</b><small>ms</small>`));
  }
  const none = renderPanel('ping', { state: normalizeState({}), now: NOW, locale: 'en' });
  assert.match(none, /data-tone="idle"/); assert.match(none, /<b>—<\/b>/); assert.equal(bars(none), 0);
});

test('the Overlay controls list every window but themselves, show what is on, and carry the shared look', () => {
  const html = renderPanel('controls', { state: normalizeState({}), locale: 'en', now: NOW, controls: { open: ['pvp', 'map'], options: { scale: 1.25, opacity: .8, rate: 500, snap: true, source: 'hits', seconds: 20 }, locked: false } });
  const toggles = [...html.matchAll(/data-panel="([a-z]+)" aria-pressed="(true|false)"/g)];
  assert.deepEqual(toggles.map(row => row[1]), [...PANELS].filter(name => name !== 'controls'));
  assert.deepEqual(toggles.filter(row => row[2] === 'true').map(row => row[1]), ['pvp', 'map']);
  assert.match(html, /value="125" data-slider="overlayScale"/); assert.match(html, /value="80" data-slider="opacity"/);
  assert.match(html, /data-pref="overlayRate" data-value="500" aria-pressed="true"/); assert.match(html, /data-pref="overlayRate" data-value="250" aria-pressed="false"/);
  assert.match(html, /data-toggle="overlaySnap" aria-pressed="true"/);
  assert.match(html, /data-pref="source" data-value="hits" aria-pressed="true"/); assert.match(html, /data-pref="seconds" data-value="20" aria-pressed="true"/);
  assert.match(html, /data-action="lock" aria-pressed="false">Lock</); assert.match(html, /data-action="done"/);
  assert.match(renderPanel('controls', { state: normalizeState({}), locale: 'en', now: NOW, controls: { locked: true } }), />Unlock</);
  // With nothing read yet it still draws, with the defaults.
  assert.match(renderPanel('controls', { state: normalizeState({}), locale: 'tr', now: NOW }), /Pencereler/);
});

test('Alt+E is the eighth shortcut and the only one that may use a single modifier', async () => {
  const { hotkeyDraft, HOTKEY_ACTIONS } = await import('../runtime-tools.mjs');
  assert.equal(HOTKEY_ACTIONS.length, 8);
  const draft = hotkeyDraft([]);
  assert.deepEqual(draft[7], { action: 'overlay-controls', shortcut: 'Alt+E', enabled: true });
  assert.equal(draft[0].shortcut, 'Ctrl+Alt+Shift+F7');
  const prefs = normalizePreferences({});
  assert.equal(prefs.hotkeys.length, 8); assert.equal(prefs.hotkeys[7].shortcut, 'Alt+E');
  assert.equal(normalizePreferences({ hotkeys: [{ action: 'overlay-controls', shortcut: 'Alt+Q', enabled: false }] }).hotkeys[0].shortcut, 'Alt+Q');
});
