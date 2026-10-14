import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_SECTIONS, settingsSection, nextTab, modalControls, focusBoundary, shouldApplyPollFailure, captureFormDraft, restoreFormDraft, createPanelSynchronizer } from '../navigation.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('settings routes calendar directly and defaults unknown sections to appearance', () => {
  assert.equal(settingsSection('calendar'), 'calendar');
  assert.equal(settingsSection('overview'), 'appearance');
  assert.equal(settingsSection(undefined), 'appearance');
  assert.deepEqual(SETTINGS_SECTIONS, ['appearance', 'character', 'calendar', 'combatSettings', 'streaming', 'about']);
});

test('keyboard category navigation wraps and supports Home/End without handling typing', () => {
  assert.equal(nextTab(SETTINGS_SECTIONS, 'appearance', 'ArrowLeft'), 'about');
  assert.equal(nextTab(SETTINGS_SECTIONS, 'about', 'ArrowRight'), 'appearance');
  assert.equal(nextTab(SETTINGS_SECTIONS, 'calendar', 'Home'), 'appearance');
  assert.equal(nextTab(SETTINGS_SECTIONS, 'calendar', 'End'), 'about');
  assert.equal(nextTab(SETTINGS_SECTIONS, 'calendar', 'c'), null);
  assert.equal(nextTab([], 'calendar', 'End'), null);
});

test('modal keyboard order excludes disabled inputs/selects and hidden panels but includes summary', () => {
  const control = (kind, { disabled = false, hidden = false, rects = true, tabIndex = 0 } = {}) => ({ kind, tabIndex, matches: () => disabled, closest: () => hidden ? {} : null, getClientRects: () => rects ? [{}] : [] });
  const close = control('button'), summary = control('summary'), disabledInput = control('input', { disabled: true }), disabledSelect = control('select', { disabled: true });
  const hiddenPanel = control('input', { hidden: true }), collapsedInput = control('input', { rects: false }), rovingTab = control('button', { tabIndex: -1 });
  const panel = { querySelectorAll: selector => { assert.ok(selector.includes('summary')); return [close, disabledInput, disabledSelect, hiddenPanel, collapsedInput, rovingTab, summary]; } };
  assert.deepEqual(modalControls(panel), [close, summary]);
});

test('modal tab wraps both directions and safely recovers focus after a control disappears', () => {
  const first = {}, middle = {}, last = {}, detached = {};
  assert.equal(focusBoundary([first, middle, last], last), first);
  assert.equal(focusBoundary([first, middle, last], first, true), last);
  assert.equal(focusBoundary([first, middle, last], detached), first);
  assert.equal(focusBoundary([first, middle, last], detached, true), last);
  assert.equal(focusBoundary([first, middle, last], middle), null);
  assert.equal(focusBoundary([], detached), null);
});

test('a delayed failed poll cannot overwrite a newer live event with a false disconnected status', () => {
  const started = { revision: 17, receivedCount: 4 };
  assert.equal(shouldApplyPollFailure(started, { revision: 17, receivedCount: 4 }), true);
  assert.equal(shouldApplyPollFailure(started, { revision: 18, receivedCount: 5 }), false);
  assert.equal(shouldApplyPollFailure(started, { revision: 18, receivedCount: 4 }), false);
  assert.equal(shouldApplyPollFailure({ revision: null, receivedCount: 0 }, { revision: null, receivedCount: 1 }), false);
  assert.equal(shouldApplyPollFailure({ revision: null, receivedCount: 0 }, { revision: null, receivedCount: 0 }), true);
});

test('unsaved form drafts retain names and selected actors across an asynchronous refresh/reorder', () => {
  const source = { elements: [{ name: 'characterName', type: 'text', value: 'Mira draft' }, { name: 'partyMember', type: 'checkbox', value: '7', checked: true }, { name: 'partyMember', type: 'checkbox', value: '8', checked: false }, { name: 'file', type: 'file', value: 'private-path' }, { name: 'disabled', type: 'text', disabled: true, value: 'discard' }] };
  const draft = captureFormDraft(source);
  assert.equal(draft.length, 3);
  const target = { elements: [{ name: 'partyMember', type: 'checkbox', value: '8', checked: true }, { name: 'partyMember', type: 'checkbox', value: '9', checked: true }, { name: 'characterName', type: 'text', value: 'Mira' }, { name: 'partyMember', type: 'checkbox', value: '7', checked: false }] };
  restoreFormDraft(target, draft);
  assert.equal(target.elements[0].checked, false); assert.equal(target.elements[1].checked, true);
  assert.equal(target.elements[2].value, 'Mira draft'); assert.equal(target.elements[3].checked, true);
});

test('draft restoration never replaces a missing selected actor with another actor', () => {
  const draft = captureFormDraft({ elements: [{ name: 'localPlayerId', type: 'select-one', value: '7' }] });
  const target = { elements: [{ name: 'localPlayerId', type: 'select-one', value: '', options: [{ value: '' }, { value: '9' }] }] };
  restoreFormDraft(target, draft);
  assert.equal(target.elements[0].value, '');
});

test('a delayed native panel open completes before the final close', async () => {
  const opened = deferred(), release = deferred(), writes = [];
  const setPanel = createPanelSynchronizer(async open => { writes.push(open); if (open) { opened.resolve(); await release.promise; } });
  const first = setPanel(true); await opened.promise;
  const last = setPanel(false); release.resolve(); await Promise.all([first, last]);
  assert.deepEqual(writes, [true, false]);
});

test('queued intermediate panel toggles coalesce to the latest desired state', async () => {
  const writes = [], setPanel = createPanelSynchronizer(async open => { writes.push(open); });
  await Promise.all([setPanel(true), setPanel(false), setPanel(true), setPanel(false)]);
  assert.deepEqual(writes, [false]);
});

test('stale transition failure does not obscure a successful final close', async () => {
  const opened = deferred(), release = deferred(), errors = [], writes = [];
  const setPanel = createPanelSynchronizer(async open => { writes.push(open); if (open) { opened.resolve(); await release.promise; } }, error => errors.push(error));
  const first = setPanel(true); await opened.promise; const last = setPanel(false);
  release.reject(new Error('old transition failed')); await Promise.all([first, last]);
  assert.deepEqual(writes, [true, false]); assert.deepEqual(errors, []);
});

test('latest panel failure is reported once and does not poison subsequent transitions', async () => {
  const errors = [], setPanel = createPanelSynchronizer(async open => { if (open) throw new Error('resize failed'); }, error => errors.push(error.message));
  assert.equal(await setPanel(true), false); assert.deepEqual(errors, ['resize failed']);
  assert.equal(await setPanel(false), true); assert.deepEqual(errors, ['resize failed']);
});
