import test from 'node:test';
import assert from 'node:assert/strict';
import { PANELS, PANEL_TITLES, esc, panelName, renderPanel, short } from '../overlay-panels.mjs';
import { cubePresentation } from '../cube.mjs';
import { normalizeState } from '../model.mjs';

const NOW = 1_760_000_000_000;
const label = id => `Skill ${id}`;

test('panel names are a closed list and unknown names fall back to the vitals panel', () => {
  assert.deepEqual([...PANELS], ['pvp', 'vitals', 'cube', 'party', 'tickets', 'tracker', 'cooldowns']);
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

test('the Cube panel shows the nearest cube with its look and direction, or says there is none', () => {
  const network = { cubes: 2, distance_m: 42, vertical_m: 3, direction_deg: 35, fix_age_s: 2, look: 'gold', bearing_deg: 90, live: true, age_s: 12 };
  const near = cubePresentation({ enabled: false, network }, { now: NOW, locale: 'tr' });
  const html = renderPanel('cube', { cube: near });
  assert.match(html, /data-look="gold" data-taken="false"/); assert.match(html, /<b>42 m<\/b><span>Altın Küp yakında<\/span>/);
  assert.match(html, /rotate\(35deg\)/); assert.match(html, /12 sn önce doğdu/);
  const taken = renderPanel('cube', { cube: cubePresentation({ network: { ...network, taken: true } }, { now: NOW, locale: 'en' }) });
  assert.match(taken, /data-taken="true"/); assert.match(taken, /Gold Cube opened/);
  const none = renderPanel('cube', { cube: cubePresentation({ network: { cubes: 0 } }, { now: NOW, locale: 'en' }) });
  assert.match(none, /no Cube announced within about 100 m/); assert.doesNotMatch(none, /data-look/);
  // No known heading: no arrow is drawn.
  assert.doesNotMatch(renderPanel('cube', { cube: cubePresentation({ network: { ...network, direction_deg: null } }, { now: NOW }) }), /class="arrow"/);
});

test('the party panel lists members with health as a share and flags the local player and low health', () => {
  const state = normalizeState({ party: [{ id: 11939, name: 'Mira', hp: 6200, hp_max: 10_000, is_self: true }, { id: 30011, name: 'Ast<er>', hp: 2000, hp_max: 9000 }, { id: 5, name: 'Bad', hp: 9, hp_max: 3 }] });
  const html = renderPanel('party', { state });
  assert.match(html, /data-self="true" data-low="false"[^>]*><span class="name">Mira<\/span>.*width:62\.0%.*<b>62%<\/b>/s);
  assert.match(html, /data-self="false" data-low="true".*Ast&lt;er&gt;.*<b>22%<\/b>/s);
  assert.doesNotMatch(html, /Bad/);
  assert.match(renderPanel('party', { state: normalizeState({}), locale: 'en' }), /No party list/);
});

test('the tickets panel shows counts, bonus and a recharge countdown, and names only what is named', () => {
  const resources = { source: 'server-contents-ticket', awaiting_identity: false, tickets: [
    { ticket_id: 60_000_001, count: 420, bonus: 80, time_left_ms: 90_000, observed_at_ms: NOW - 30_000 },
    { ticket_id: 12, count: 14, bonus: 0, time_left_ms: 0, observed_at_ms: NOW },
    { ticket_id: 13, count: 0, bonus: 0, time_left_ms: 0, observed_at_ms: NOW },
    { ticket_id: 14, count: 0, bonus: 0, time_left_ms: 25_200_000, observed_at_ms: NOW },
  ] };
  const html = renderPanel('tickets', { state: normalizeState({ resources }), now: NOW, names: { 'ticket:12': 'Daily <dungeon>' } });
  assert.match(html, /Odyle<\/span><b>420<small>\+80<\/small><\/b><time>1:00<\/time>/);
  assert.match(html, /Daily &lt;dungeon&gt;<\/span><b>14<\/b>/);
  assert.match(html, /Bilet #14<\/span><b>0<\/b><time>7:00:00<\/time>/);
  assert.doesNotMatch(html, /#13/);
  assert.match(renderPanel('tickets', { state: normalizeState({}), locale: 'en' }), /No ticket data/);
  assert.match(renderPanel('tickets', { state: normalizeState({ resources: { ...resources, awaiting_identity: true } }), now: NOW }), /Bilet bilgisi/);
});

test('the tracker panel counts kills and gathered items with the names the player gave', () => {
  const state = normalizeState({ tracker: { kills_total: 5, kills: [{ model: 2_100_075, name: 'Krall <Soldier>', count: 3 }, { model: 2_100_093, name: null, count: 2 }], gathered: [{ item: 531_900_003, count: 4 }, { item: 7, count: 1 }] } });
  const html = renderPanel('tracker', { state, names: { 'item:531900003': 'Aether' } });
  assert.match(html, /ÖLDÜRÜLEN · 5/); assert.match(html, /Krall &lt;Soldier&gt;<\/span><b>3<\/b>/); assert.match(html, /Canavar #2100093<\/span><b>2<\/b>/);
  assert.match(html, /Aether<\/span><b>4<\/b>/); assert.match(html, /Eşya #7<\/span><b>1<\/b>/);
  assert.match(renderPanel('tracker', { state: normalizeState({}), locale: 'en' }), /Nothing killed or gathered/);
});

test('the skills panel says so when no cooldown has been seen', () => {
  assert.match(renderPanel('cooldowns', { state: normalizeState({}), locale: 'en' }), /No skill cooldown seen yet/);
  assert.match(renderPanel('cooldowns', { state: normalizeState({}), now: NOW }), /Beceri bekleme süresi/);
});
