import test from 'node:test';
import assert from 'node:assert/strict';
import { PANELS, PANEL_TITLES, esc, panelName, renderPanel, short } from '../overlay-panels.mjs';
import { cubePresentation } from '../cube.mjs';
import { SKILLS_ICONS } from '../game-icons.mjs';
import { normalizePreferences, normalizeState } from '../model.mjs';

const NOW = 1_760_000_000_000;
const label = id => `Skill ${id}`;

test('panel names are a closed list and unknown names fall back to the vitals panel', () => {
  assert.deepEqual([...PANELS], ['damage', 'pvp', 'vitals', 'cube', 'party', 'tickets', 'tracker', 'cooldowns', 'currencies', 'effects', 'timers', 'flight', 'bosshp', 'actions', 'rivals', 'map', 'ping', 'controls']);
  for (const panel of PANELS) assert.ok(PANEL_TITLES[panel][0] && PANEL_TITLES[panel][1]);
  assert.equal(panelName('pvp'), 'pvp');
  for (const value of ['', null, undefined, 'main', '../pvp', 'PVP', 7]) assert.equal(panelName(value), 'vitals');
  assert.equal(short(6200), '6.2K'); assert.equal(short(12_400_000), '12M'); assert.equal(short(NaN), '—');
  assert.equal(esc('<b onclick="x">&\'</b>'), '&lt;b onclick=&quot;x&quot;&gt;&amp;&#39;&lt;/b&gt;');
});

test('the PvP panel shows the counters, the last death and what hit you', () => {
  const state = normalizeState({ pvp: { kills: 3, deaths: 1, last_death: { at_ms: 5, killer_name: 'Slay<er>', killer_player: true, skill_id: 7, damage_taken: 4200, top_skills: [{ skill_id: 7, damage: 3000, hits: 3 }, { skill_id: 8, damage: 1200, hits: 2 }] } } });
  const html = renderPanel('pvp', { state, label, now: NOW });
  assert.match(html, /<b>3<\/b><small>ÖLDÜRME/); assert.match(html, /<b>1<\/b><small>ÖLÜM/);
  assert.match(html, /Slay&lt;er&gt; · Skill 7/); assert.doesNotMatch(html, /Slay<er>/);
  assert.match(html, /4\.2K/); assert.match(html, /71%/);
  assert.match(renderPanel('pvp', { state: normalizeState({}), label, locale: 'en' }), /No player fought yet/);
});

test('the vitals panel counts the frenzy down, shows health only with a maximum for the percentage, and lists casts', () => {
  const state = normalizeState({
    local_identity_source: 'server', local_player_id: '1',
    frenzy: { target_id: 9, target_name: 'Boss', at_ms: NOW + 65_000 }, own_health: { hp: 2100, max_hp: 10_000 },
    players: [{ id: '1', name: 'Me' }], targets: [{ id: '9', name: 'Astral <sentinel>' }],
    assist: { casts: [{ actor_id: '9', skill_id: '77', target_id: '1', started_ms: NOW - 1000, expires_ms: NOW + 2100, duration_ms: 3000, source: 'server-windup', hostile: true, lethal: true }] },
  });
  const html = renderPanel('vitals', { state, label, now: NOW });
  assert.match(html, /data-urgent="false"><small>BOSS ÖFKESİ<\/small><b>1:05<\/b><span>Boss<\/span>/);
  assert.match(html, /data-low="true"><small>CANIN<\/small><b>2\.1K<\/b>.*width:21\.0%.*21%/s);
  assert.match(html, /data-lethal="true"><em>ÖLÜMCÜL<\/em><span>Astral &lt;sentinel&gt; · Skill 77<\/span><time>2\.1 s<\/time>/);
  const urgent = renderPanel('vitals', { state, label, now: NOW + 50_000, locale: 'en' });
  assert.match(urgent, /data-urgent="true"><small>BOSS FRENZY<\/small><b>0:15<\/b>/);
  // No maximum: the health is a number, never a percentage; no frenzy: no claim.
  const bare = renderPanel('vitals', { state: normalizeState({ own_health: { hp: 4000 } }), label, now: NOW });
  assert.match(bare, /<b>4\.0K<\/b><span>azami can bilinmiyor<\/span>/); assert.doesNotMatch(bare, /%/);
  assert.match(bare, /row idle"><small>BOSS ÖFKESİ<\/small><b>—<\/b><span>bildirim yok/); assert.match(bare, /Yaklaşan boss büyüsü yok/);
});

test('the Cube marker is the game\'s own cube with its direction, distance and age, and nothing when no cube is near', () => {
  const network = { cubes: 2, distance_m: 42, vertical_m: 3, direction_deg: 35, fix_age_s: 2, look: 'gold', bearing_deg: 90, live: true, age_s: 12 };
  const near = cubePresentation({ enabled: false, network }, { now: NOW, locale: 'tr' });
  const state = normalizeState({ cube_keys: 3 });
  const html = renderPanel('cube', { cube: near, state });
  assert.match(html, /class="marker" data-look="gold" data-taken="false"/);
  assert.match(html, /<img class="game-icon" src="assets\/icons\/cube_gold\.webp" width="56" height="56"/);
  assert.match(html, /<small class="kind">Altın Küp<\/small><b class="dist">42 m<\/b>/);
  assert.match(html, /rotate\(35deg\)/);
  assert.match(html, /<span class="detail">sağında · 3 m yukarıda · kuzeyde · \+1<\/span>/);
  assert.match(html, /<span class="meta">12 sn önce doğdu · Anahtar 3<\/span>/);
  // A red cube is drawn red, an opened one is marked and shows no arrow.
  const red = renderPanel('cube', { cube: cubePresentation({ network: { ...network, look: 'red' } }, { now: NOW, locale: 'en' }), state, locale: 'en' });
  assert.match(red, /data-look="red"/); assert.match(red, /cube_red\.webp/); assert.match(red, /Keys 3/);
  const taken = renderPanel('cube', { cube: cubePresentation({ network: { ...network, taken: true } }, { now: NOW, locale: 'en' }), state, locale: 'en' });
  assert.match(taken, /data-taken="true"/); assert.match(taken, /Gold Cube · opened/); assert.doesNotMatch(taken, /class="pointer"/);
  // No cube near: nothing is drawn, so the transparent window shows nothing at all.
  assert.equal(renderPanel('cube', { cube: cubePresentation({ network: { cubes: 0 } }, { now: NOW }), state }), '');
  // Switched off, or asked to show only with a key and there is none: nothing. Unknown keys never hide it.
  assert.equal(renderPanel('cube', { cube: near, state, marker: { enabled: false } }), '');
  assert.equal(renderPanel('cube', { cube: near, state: normalizeState({ cube_keys: 0 }), marker: { needKeys: true } }), '');
  assert.match(renderPanel('cube', { cube: near, state: normalizeState({}), marker: { needKeys: true } }), /class="marker"/);
  assert.match(renderPanel('cube', { cube: near, state: normalizeState({ cube_keys: 2 }), marker: { needKeys: true } }), /class="marker"/);
  // No heading to turn by: no arrow, but the compass wind stays.
  const noArrow = renderPanel('cube', { cube: cubePresentation({ network: { ...network, direction_deg: null } }, { now: NOW }), state });
  assert.doesNotMatch(noArrow, /class="pointer"/); assert.match(noArrow, /kuzeyde/);
  // While the player places it, a sample shows even with no cube near.
  assert.match(renderPanel('cube', { cube: cubePresentation({ network: { cubes: 0 } }, { now: NOW }), state, marker: { edit: true } }), /<b class="dist">42 m<\/b>/);
  assert.doesNotMatch(renderPanel('cube', { cube: near, state }), /<svg class="cube-icon"|class="top"/, 'the drawn cube is gone');
});

test('Hidden Cube keys and the show-only-with-a-key choice survive normalisation, and junk is unknown', () => {
  assert.equal(normalizeState({ cube_keys: 6 }).cube_keys, 6);
  assert.equal(normalizeState({ cube_keys: 0 }).cube_keys, 0);
  for (const junk of [undefined, null, -1, 1.5, NaN, '3', {}, Infinity]) assert.equal(normalizeState({ cube_keys: junk }).cube_keys, null);
  assert.equal(normalizeState({ cube_keys: 10 ** 9 }).cube_keys, 99_999);
  assert.equal(normalizeState(normalizeState({ cube_keys: 4 })).cube_keys, 4);
  assert.equal(normalizePreferences({}).cubeNeedKeys, false);
  assert.equal(normalizePreferences({ cubeNeedKeys: true }).cubeNeedKeys, true);
  assert.equal(normalizePreferences({ cubeNeedKeys: 'yes' }).cubeNeedKeys, false);
  assert.equal(normalizePreferences(normalizePreferences({ cubeNeedKeys: true })).cubeNeedKeys, true);
});

test('the party panel lists members with health as a share and flags the local player and low health', () => {
  const state = normalizeState({ party: [{ id: 11939, name: 'Mira', hp: 6200, hp_max: 10_000, is_self: true }, { id: 30011, name: 'Ast<er>', hp: 2000, hp_max: 9000 }, { id: 5, name: 'Bad', hp: 9, hp_max: 3 }] });
  const html = renderPanel('party', { state });
  assert.match(html, /data-self="true" data-low="false"[^>]*><span class="name">Mira<\/span>.*width:62\.0%.*<b>62%<\/b>/s);
  assert.match(html, /data-self="false" data-low="true".*Ast&lt;er&gt;.*<b>22%<\/b>/s);
  assert.doesNotMatch(html, /Bad/);
  assert.match(renderPanel('party', { state: normalizeState({}), locale: 'en' }), /No party or room/);
});

test('the tickets panel is a card for Odyle, tiles for counted tickets and lines for hours', () => {
  const resources = { source: 'server-contents-ticket', actor_id: 7, awaiting_identity: false, membership: { source: 'server-benefit-list', observed_at_ms: NOW - 1000, expires_at_ms: NOW + 86_400_000, active: true }, odyle: { ticket_id: 60_000_001, base: 105, bonus: 60, total: 165, time_left_ms: 4_440_000, observed_at_ms: NOW - 1000 }, tickets: [
    { ticket_id: 60_000_001, count: 105, bonus: 60, time_left_ms: 4_440_000, observed_at_ms: NOW },
    { ticket_id: 1, count: 9, bonus: 5, time_left_ms: 0, observed_at_ms: NOW },
    { ticket_id: 12, count: 14, bonus: 0, time_left_ms: 0, observed_at_ms: NOW },
    { ticket_id: 13, count: 0, bonus: 0, time_left_ms: 0, observed_at_ms: NOW },
    { ticket_id: 3, count: 0, bonus: 0, time_left_ms: 12_993_000, observed_at_ms: NOW },
  ] };
  const html = renderPanel('tickets', { state: normalizeState({ resources }), now: NOW, names: { 'ticket:12': 'Daily <dungeon>', 'ticket:3': 'Lower Abyss' }, caps: { 'ticket:1': 21, 'ticket:12': 14 } });
  assert.match(html, /class="hero"><div class="hero-top"><span class="gem"[^>]*><img class="game-icon" src="assets\/icons\/icon_item_odenergy_a_001\.webp"[^>]*><\/span><b>105<\/b><em>\+60<\/em><small>\/ 840<\/small><span class="refill"><small>Sonraki dolum<\/small><time>1h 14m<\/time>/);
  assert.match(html, /width:12\.5%/);
  // The names, the most each holds and the refill rule come from the catalog.
  assert.match(html, /Odyle Energy · \+15 her 3 sa<\/small>/);
  assert.match(html, /title="Shugo Festival Reward Key · \+3 günlük · #1"><span class="icon"><img[^>]*><\/span><b>9<em>\+5<\/em><small>\/21<\/small><\/b><span class="label">Shugo Festival Reward Key<\/span>/);
  assert.match(html, /class="time-row"[^>]*><span class="icon"><img[^>]*><\/span><span class="name">Lower Abyss<\/span><b>3h 36m<\/b>/);
  // A ticket outside the usual list stays out unless the player chose it, and then a name and a cap they typed win.
  assert.doesNotMatch(html, /#12/);
  const chosen = renderPanel('tickets', { state: normalizeState({ resources }), now: NOW, shown: [12, 1], names: { 'ticket:12': 'Daily <dungeon>' }, caps: { 'ticket:12': 14 } });
  assert.match(chosen, /data-full="true"[^>]*>.*<b>14<small>\/14<\/small><\/b><span class="label">Daily &lt;dungeon&gt;<\/span>/s);
  // A usual ticket with nothing in it is still listed: a time ticket at zero says 0m.
  assert.match(html, /Upper Abyss Usage Time<\/span><b>0m<\/b>/);
  assert.match(renderPanel('tickets', { state: normalizeState({}), locale: 'en' }), /No ticket data/);
  assert.match(renderPanel('tickets', { state: normalizeState({ resources: { ...resources, awaiting_identity: true } }), now: NOW }), /Bilet bilgisi/);
});

test('the tracker panel counts kills and gathered items with the names the player gave', () => {
  const state = normalizeState({ tracker: { kills_total: 5, kills: [{ model: 2_100_075, name: 'Krall <Soldier>', count: 3 }, { model: 2_100_093, name: null, count: 2 }], gathered: [{ item: 531_900_003, count: 4 }, { item: 7, count: 1 }] } });
  const html = renderPanel('tracker', { state, names: { 'item:531900003': 'Aether' } });
  assert.match(html, /ÖLDÜRÜLEN · 5/); assert.match(html, /Krall &lt;Soldier&gt;<\/span><b>3<\/b>/); assert.match(html, /Canavar #2100093<\/span><b>2<\/b>/);
  assert.match(html, /Aether<\/span><b>4<\/b>/); assert.match(html, /Eşya #7<\/span><b>1<\/b>/);
  assert.match(renderPanel('tracker', { state: normalizeState({}), locale: 'en' }), /No kills, gathering or loot/);
});

test('the skills panel says so when no cooldown has been seen', () => {
  assert.match(renderPanel('cooldowns', { state: normalizeState({}), locale: 'en' }), /No skill cooldown seen yet/);
  assert.match(renderPanel('cooldowns', { state: normalizeState({}), now: NOW }), /Beceri bekleme süresi/);
});

test('the room panel shows gear score, combat power, status and the average, and joins health by name', () => {
  const room = { title: 'Fire <Temple>', members: [
    { id: '651614571085448170', name: 'Shizoi', server: 2315, class: 'Ranger', level: 45, gear_score: 2262, combat_power: 122_800, ready: false, leader: false, is_self: false },
    { id: '651614571085448171', name: 'Maki', server: 2316, class: 'Cleric', level: 45, gear_score: 2319, combat_power: 108_900, ready: true, leader: false, is_self: true },
    { id: '651614571085448172', name: 'Twelve', server: 2317, class: 'Sorcerer', level: 45, gear_score: 2198, combat_power: 108_700, ready: false, leader: true, is_self: false },
  ] };
  const state = normalizeState({ room, party: [{ id: 2, name: 'Maki', hp: 2000, hp_max: 10_000 }] });
  const html = renderPanel('party', { state, names: { 'server:2315': 'XYZ' } });
  assert.match(html, /Fire &lt;Temple&gt;<\/strong><span>2\/3 hazır<\/span>/);
  assert.match(html, /<b>113\.5K<\/b><small>ortalama CP<\/small>/);
  assert.match(html, /data-status="waiting" data-self="false"><span class="icon"><img[^>]*ranger[^>]*><\/span><span class="who"><b>Shizoi<\/b><small>XYZ<\/small><\/span><span class="gs">2\.262<\/span><span class="cp">122\.8K<\/span><span class="state">Hazır değil<\/span>/);
  assert.match(html, /data-status="ready" data-self="true"[^>]*>.*<small>KRO<\/small>.*<span class="state">Hazır<\/span><i class="hp" data-low="true"><u style="width:20\.0%">/s);
  assert.match(html, /data-status="leader"[^>]*>.*<span class="state">♛ Lider<\/span>/s);
  assert.match(renderPanel('party', { state, locale: 'en' }), /<span>2\/3 ready<\/span>/);
  assert.doesNotMatch(html, /<script|onerror/);
});

test('the currencies panel lists what you carry by number and Odyle first', () => {
  const state = normalizeState({ currencies: [{ item: 930_100_001, count: 249_000 }, { item: 930_100_003, count: 6000 }], resources: { source: 'server-contents-ticket', actor_id: 7, awaiting_identity: false, odyle: { ticket_id: 60_000_001, base: 105, bonus: 60, total: 165, time_left_ms: 0, observed_at_ms: NOW }, tickets: [] } });
  const html = renderPanel('currencies', { state, now: NOW, names: { 'item:930100001': 'Kinah <x>' } });
  assert.match(html, /Odyle<\/span><b>165<\/b>.*Kinah &lt;x&gt;<\/span><b>249\.000<\/b>.*Abyss Points<\/span><b>6\.000<\/b>/s);
  assert.match(renderPanel('currencies', { state, now: NOW }), /Kina \(Bound\)<\/span><b>249\.000<\/b>/);
  assert.match(renderPanel('currencies', { state: normalizeState({ currencies: [{ item: 930_199_999, count: 3 }] }), now: NOW }), /Eşya #930199999/);
  assert.match(renderPanel('currencies', { state: normalizeState({}), locale: 'en' }), /No inventory from the game yet/);
});

test('the damage window ranks every skill you used with its icon, damage per second, share and total', () => {
  const skillId = String(Object.keys(SKILLS_ICONS).map(Number).find(id => id >= 11_000_000 && id < 12_000_000));
  const skills = [{ id: skillId, damage: 18_200, hits: 12, crit_hits: 3 }, { id: '999999990', damage: 11_000, hits: 8, crit_hits: 0 }, { id: '999999991', damage: 10_600, hits: 5, crit_hits: 1 }, { id: '999999992', damage: 610, hits: 1, crit_hits: 0 }, { id: '999999993', damage: 0, hits: 4, crit_hits: 0 }];
  const state = normalizeState({ local_player_id: 'p1', players: [{ id: 'p0', name: 'Other', damage: 5, skills: [{ id: '5', damage: 5, hits: 1 }] }, { id: 'p1', name: 'Me', is_local: true, damage: 40_410, skills }], personal_elapsed_ms: 4900 });
  const html = renderPanel('damage', { state, label: id => `Skill ${id}` });
  assert.match(html, /<div class="dmg-head"><b>8\.25K<\/b><small>DPS<\/small><time>0:04<\/time><\/div>/);
  assert.match(html, new RegExp(`title="Skill ${skillId} · 12×[^"]*"><span class="icon"><img class="game-icon" src="assets/icons/[a-z0-9_-]+\\.webp"[^>]*></span><span class="name">Skill ${skillId}</span><span class="rate">3\\.71K</span><span class="share">45\\.0%</span><span class="total">18\\.2K</span>`));
  assert.match(html, /Skill 999999990<\/span><span class="rate">2\.24K<\/span><span class="share">27\.2%<\/span><span class="total">11\.0K<\/span>/);
  assert.doesNotMatch(html, /Skill 999999993/, 'a skill that did no damage is not listed');
  assert.doesNotMatch(html, /Other/);
  assert.match(renderPanel('damage', { state: normalizeState({}), locale: 'en' }), /appear here once a fight starts/);
});
