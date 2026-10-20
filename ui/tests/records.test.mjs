import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordNotifier, recordObservation, recordSnapshot, recordStatus, recordPresentation, recordKey, renderRecords } from '../records.mjs';
import { normalizePreferences, normalizeState, visibleAnalysisSections } from '../model.mjs';
import { ANALYSIS_SECTIONS } from '../navigation.mjs';

const hit = (amount = 13000, at_ms = 1000, extra = {}) => ({ name: 'Archer', server_id: 1001, class_name: 'Ranger', actor_id: 7,
  is_local: true, metric: 'hit', amount, at_ms, skill_id: 14090000, critical: true, tick: false, target_name: 'Boss', target_npc_id: 100,
  map_id: 1, boss_max_hp: 1000000, elapsed_ms: null, ...extra });
const notice = (sequence = 1, extra = {}) => ({ sequence, best: hit(13000, 1000, extra), previous: hit(10000, 500, extra) });
const status = (...notices) => ({ revision: 3, count: 1, notices });

test('10K to 13K is a single-hit record, with a separate explicitly labelled DPS rate', () => {
  const view = recordPresentation(notice(), { locale: 'tr' });
  assert.match(view.label, /tek vuruş/); assert.equal(view.value, '13K'); assert.equal(view.previous, '10K'); assert.equal(view.gain, '+30.0%');
  const boss = { metric: 'boss-dps', elapsed_ms: 60000, skill_id: null };
  const rate = recordPresentation({ best: hit(780000,1000,boss), previous: hit(600000,500,boss) }, { locale: 'tr' });
  assert.equal(rate.value, '13K/sn'); assert.match(rate.label, /Boss DPS/);
});
test('equal, decreasing, malformed, missing-context and duplicate records never produce false notices', () => {
  assert.equal(recordStatus(status({ ...notice(), best: hit(10000) })).notices.length, 0);
  assert.equal(recordStatus(status({ ...notice(), best: hit(9000) })).notices.length, 0);
  for (const extra of [{ server_id: null }, { name: '#123' }, { amount: NaN }, { at_ms: 9e15 }, { metric: 'boss-dps', elapsed_ms: 0 }]) assert.equal(recordObservation(hit(13, 1000, extra)), null);
  const snapshot = recordSnapshot({ records: [{ best: hit() }, { best: hit(15000) }] });
  assert.equal(snapshot.records.length, 1);
  assert.notEqual(recordKey(hit()), recordKey(hit(13000,1000,{ server_id: 1002 })));
});
test('polling never replays a notice and rapid new records do not prolong its display', () => {
  const notifier = createRecordNotifier(), first = status(notice());
  assert.equal(notifier.update(first, { now: 1000 }).best.amount, 13000);
  assert.equal(notifier.update(first, { now: 2000 }).best.amount, 13000);
  const newer = { sequence: 2, best: hit(15000, 3000), previous: hit() };
  assert.equal(notifier.update(status(newer), { now: 3000 }).best.amount, 15000);
  assert.equal(notifier.update(status(newer), { now: 5201 }), null);
  assert.equal(notifier.update(first, { now: 10000 }), null);
});
test('self-only, opt-out, hidden module, stale evidence and dismissal are quiet', () => {
  for (const options of [{ mode: 'off' }, { visible: false }, { mode: 'self' }]) {
    const notifier = createRecordNotifier(), value = status(notice(1, { is_local: false }));
    assert.equal(notifier.update(value, { now: 1000, ...options }), null);
    assert.equal(notifier.update(value, { now: 1001 }), null);
  }
  const notifier = createRecordNotifier(); assert.equal(notifier.update(status(notice()), { now: 8000 }), null);
  const fresh = createRecordNotifier(); fresh.update(status(notice()), { now: 1000 }); fresh.dismiss();
  assert.equal(fresh.update(status(notice()), { now: 1001 }), null);
});
test('hidden names and unsafe text remain hidden or escaped in the record panel', () => {
  const row = { best: hit(13000,1000,{ name: '<Archer>', target_name: '<img src=x onerror=1>' }), previous: null };
  const html = renderRecords({ records: [row] });
  assert.ok(html.includes('&lt;Archer&gt;')); assert.ok(!html.includes('<img'));
  const privateHtml = renderRecords({ records: [row] }, { hideNames: true });
  assert.ok(!privateHtml.includes('&lt;Archer&gt;')); assert.ok(privateHtml.includes('Sen'));
});
test('preferences survive normalization and the record panel follows the DPS module', () => {
  assert.equal(normalizePreferences({ recordNotifications: 'self' }).recordNotifications, 'self');
  assert.equal(normalizePreferences({ recordNotifications: 'invalid' }).recordNotifications, 'party');
  assert.ok(ANALYSIS_SECTIONS.includes('records'));
  assert.ok(!visibleAnalysisSections(ANALYSIS_SECTIONS, { displayModules: { dps: false } }).includes('records'));
  assert.equal(normalizeState({ personal_bests: status(notice()) }).personal_bests.notices.length, 1);
});
