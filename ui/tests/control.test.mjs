import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_LABELS, controlLabel, controlLoss, ownEffects } from '../control.mjs';
import { buffInfo } from '../catalog.mjs';
import { renderPanel } from '../overlay-panels.mjs';
import { TEMPLATES, TEMPLATE_LABELS, templatePlan } from '../templates.mjs';
import { PANELS } from '../overlay-panels.mjs';
import { normalizeState } from '../model.mjs';

const NOW = 1_760_000_000_000;
const effect = (id, remaining, extra = {}) => ({ recipient_id: '1', caster_id: '9', instance_id: String(id), effect_id: String(id), duration_ms: 8000, started_ms: NOW - 1000, expires_ms: NOW + remaining, persistent: false, source: 'server-effect', ...extra });
const stateWith = (effects, more = {}) => normalizeState({ local_identity_source: 'server', local_player_id: '1', assist: { effects }, ...more });

test('the catalog says which effects take control away', () => {
  assert.deepEqual(buffInfo(100), { name: 'Stun', control: 'stun', debuff: true });
  assert.equal(buffInfo(308).control, 'knockdown');
  assert.deepEqual([buffInfo(30019).name, buffInfo(30019).control, buffInfo(30019).debuff], ['Defense Increase', null, false]);
  assert.equal(buffInfo(18_014_501).debuff, true);
  assert.equal(buffInfo(1), null); assert.equal(buffInfo('constructor'), null); assert.equal(buffInfo(-5), null);
  for (const control of Object.keys(CONTROL_LABELS)) assert.ok(CONTROL_LABELS[control][0] && CONTROL_LABELS[control][1]);
  assert.equal(controlLabel('stun'), 'Sersemletme'); assert.equal(controlLabel('stun', 'en'), 'Stun'); assert.equal(controlLabel('mystery', 'en'), 'mystery');
});

test('your effects list puts control first, then what harms, then by time left, and leaves out what the catalog does not show', () => {
  const state = stateWith([effect(30019, 20_000), effect(18_014_501, 5000), effect(100, 1500), effect(777_777_777, 3000), effect(30046, 4000, { persistent: true, expires_ms: null }),
    effect(100, 900, { instance_id: '99' }), effect(308, 2500, { recipient_id: '2' })]);
  const rows = ownEffects(state, NOW);
  assert.deepEqual(rows.map(row => [row.id, row.control, row.debuff, row.remaining_ms]), [[100, 'stun', true, 1500], [18_014_501, null, true, 5000], [30019, null, false, 20_000], [30046, null, false, null]]);
  assert.equal(rows[3].persistent, true);
  // Someone else's effect, an unknown effect and an expired one are never yours to see.
  assert.ok(!rows.some(row => row.id === 777_777_777 || row.id === 308));
  assert.deepEqual(ownEffects(stateWith([effect(100, -5000)]), NOW), []);
  assert.deepEqual(ownEffects(normalizeState({}), NOW), []);
  assert.deepEqual(ownEffects(normalizeState({ assist: { effects: [effect(100, 1000)] } }), NOW), [], 'without a known local player nothing is yours');
});

test('you are out of control until the last control effect ends', () => {
  const rows = ownEffects(stateWith([effect(100, 1500), effect(308, 2500), effect(30019, 9000)]), NOW);
  assert.equal(controlLoss(rows).id, 308);
  assert.equal(controlLoss(ownEffects(stateWith([effect(30019, 9000)]), NOW)), null);
  assert.equal(controlLoss([]), null);
  const open = ownEffects(stateWith([effect(100, 1500), effect(308, 0, { persistent: true, expires_ms: null })]), NOW);
  assert.equal(controlLoss(open).id, 308, 'a control effect with no end outlasts one with an end');
});

test('the effects window shows control, harm and help with their time, and says so when there is none', () => {
  const state = stateWith([effect(100, 1500), effect(18_014_501, 65_000), effect(30019, 20_000)]);
  const html = renderPanel('effects', { state, now: NOW });
  assert.match(html, /data-kind="control" title="#100"><span class="icon"><img[^>]*><\/span><span class="name">Stun<em>Sersemletme<\/em><\/span><time>1\.5 sn<\/time>/);
  assert.match(html, /data-kind="debuff" title="#18014501"><span class="icon"><img[^>]*><\/span><span class="name">Root<\/span><time>1m<\/time>/);
  assert.match(html, /data-kind="buff" title="#30019"><span class="icon"><img[^>]*><\/span><span class="name">Defense Increase<\/span><time>20 sn<\/time>/);
  assert.match(renderPanel('effects', { state: normalizeState({}), locale: 'en' }), /No effect on you to show/);
});

test('the health window warns of lost control and shows the ping once the game connection has one', () => {
  // The state normalizer judges a latency sample against the real clock, so this test uses it.
  const now = Date.now();
  const control = (remaining, extra = {}) => effect(100, remaining, { started_ms: now - 1000, expires_ms: now + remaining, ...extra });
  const rtt = { status: 'ready', source: 'windows-tcp-estats', selection: 'worst-active-game-tcp', rtt_ms: 42, latest_rtt_ms: 40, variation_ms: 3, sampled_at_ms: now - 500, observed_at_ms: now - 500, fresh_for_ms: 5000, measured_connections: 1, game_connections: 1 };
  const capture = { status: 'capturing', game_connections: 1, network_latency: rtt };
  const html = renderPanel('vitals', { state: stateWith([control(1500)], { capture }), now });
  assert.match(html, /class="alert"><b>KONTROL KAYBI<\/b><span>Sersemletme<\/span><time>1\.5 sn<\/time>/);
  assert.match(html, /class="row ping"><small>GECİKME<\/small><b>42<\/b><span>ms<\/span>/);
  const calm = renderPanel('vitals', { state: stateWith([], { capture }), now, locale: 'en' });
  assert.doesNotMatch(calm, /class="alert"/); assert.match(calm, /<small>PING<\/small>/);
  assert.doesNotMatch(renderPanel('vitals', { state: stateWith([]), now }), /class="row ping"/);
  // A sample older than five seconds is not shown as the ping.
  assert.doesNotMatch(renderPanel('vitals', { state: stateWith([], { capture }), now: now + 20_000 }), /class="row ping"/);
});

test('a layout opens its windows and closes the rest', () => {
  assert.ok(PANELS.includes('effects'));
  assert.deepEqual(Object.keys(TEMPLATES), Object.keys(TEMPLATE_LABELS));
  for (const [name, panels] of Object.entries(TEMPLATES)) {
    const plan = templatePlan(name);
    assert.deepEqual(plan.map(row => row.panel), [...PANELS]);
    assert.deepEqual(plan.filter(row => row.open).map(row => row.panel), PANELS.filter(panel => panels.includes(panel)));
    for (const panel of panels) assert.ok(PANELS.includes(panel), `${name}: ${panel}`);
  }
  // The skill table is in the main window, so no layout opens a second one; the Cube marker stays.
  for (const panels of Object.values(TEMPLATES)) assert.ok(!panels.includes('damage') && panels.includes('cube'));
  assert.deepEqual(templatePlan('minimal').filter(row => row.open), [{ panel: 'cube', open: true }]);
  assert.deepEqual(templatePlan('pvp').filter(row => row.open).map(row => row.panel), ['pvp', 'vitals', 'cube', 'effects', 'actions', 'rivals']);
  for (const unknown of ['', 'toString', '__proto__', null, undefined]) assert.deepEqual(templatePlan(unknown), []);
});
