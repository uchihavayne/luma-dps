import test from 'node:test';
import assert from 'node:assert/strict';
import { isDrawerDragStart, DRAG_CONTROL_SELECTOR, reconcileKeyedRows, setText, setAttribute, delegatedControl, visibleInputRegions } from '../dom.mjs';

test('locked input regions include visible pet controls, not hidden, disabled or clipped-out actions', () => {
  const visible = { display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto', overflowX: 'visible', overflowY: 'visible' };
  const root = { ownerDocument: { defaultView: { getComputedStyle: element => element.style || visible } }, parentElement: null, style: { ...visible, overflowY: 'hidden' },
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 320, height: 240 }), clientLeft: 0, clientTop: 0, clientWidth: 320, clientHeight: 240 };
  const button = (rect, extra = {}) => ({ parentElement: root, style: visible, matches: () => false, closest: () => null, getClientRects: () => [rect], getBoundingClientRect: () => rect, ...extra });
  const pin = button({ x: 20, y: 100, width: 270, height: 28 });
  const clipped = button({ x: 20, y: 230, width: 270, height: 28 });
  const outside = button({ x: 20, y: 250, width: 270, height: 28 });
  const disabled = button({ x: 20, y: 50, width: 270, height: 28 }, { matches: () => true });
  const hidden = button({ x: 20, y: 50, width: 270, height: 28 }, { closest: () => ({ hidden: true }) });
  root.querySelectorAll = () => [pin, clipped, outside, disabled, hidden];
  assert.deepEqual(visibleInputRegions(root, { width: 320, height: 240 }), [{ x: 20, y: 100, width: 270, height: 28 }, { x: 20, y: 230, width: 270, height: 10 }]);
  root.querySelectorAll = () => Array.from({ length: 140 }, () => pin);
  assert.equal(visibleInputRegions(root, { width: 320, height: 240 }).length, 128);
});

test('drawer title and blank header start primary drag; interactive descendants never do', () => {
  const header = { contains: target => target.inside };
  const target = { inside: true, closest: () => null };
  assert.equal(isDrawerDragStart({ button: 0, target }, header), true);
  assert.equal(isDrawerDragStart({ button: 2, target }, header), false);
  assert.equal(isDrawerDragStart({ button: 0, target, isPrimary: false }, header), false);
  assert.equal(isDrawerDragStart({ button: 0, target: { inside: false, closest: () => null } }, header), false);
  for (const selector of ['button', 'input', 'select', 'textarea', 'a', 'label', '[role="tab"]', '[role="button"]', '[contenteditable="true"]', '[data-no-drag]']) {
    assert.ok(DRAG_CONTROL_SELECTOR.includes(selector));
    assert.equal(isDrawerDragStart({ button: 0, target: { inside: true, closest: supplied => supplied.includes(selector) ? {} : null } }, header), false);
  }
});

function fixture() {
  const document = { activeElement: null };
  const container = {
    ownerDocument: document, children: [], scrollTop: 70, scrollLeft: 3, moves: 0,
    contains: node => container.children.includes(node),
    insertBefore(row, before) {
      container.moves += 1;
      const old = container.children.indexOf(row); if (old !== -1) container.children.splice(old, 1);
      if (document.activeElement === row) document.activeElement = null;
      const index = before ? container.children.indexOf(before) : container.children.length;
      container.children.splice(index, 0, row); row.parentElement = container; row.isConnected = true;
      container.scrollTop = 0;
    },
  };
  let created = 0;
  const options = {
    key: item => item.id,
    create: () => {
      created += 1;
      const row = { dataset: {}, value: '', parentElement: null, isConnected: false, focusOptions: null,
        focus(opts) { document.activeElement = row; row.focusOptions = opts; },
        remove() { container.children.splice(container.children.indexOf(row), 1); row.isConnected = false; row.parentElement = null; },
      };
      return row;
    },
    update: (row, item) => { row.value = item.value; },
  };
  return { container, document, options, created: () => created };
}

test('live value changes reuse row identities without DOM moves, focus loss or scroll changes', () => {
  const f = fixture(), first = [{ id: 'a', value: 10 }, { id: 'b', value: 20 }];
  reconcileKeyedRows(f.container, first, f.options);
  const [a, b] = f.container.children; f.document.activeElement = b; f.container.moves = 0;
  reconcileKeyedRows(f.container, [{ id: 'a', value: 11 }, { id: 'b', value: 23 }], f.options);
  assert.equal(f.created(), 2); assert.equal(f.container.moves, 0);
  assert.deepEqual(f.container.children, [a, b]); assert.equal(b.value, 23);
  assert.equal(f.document.activeElement, b); assert.equal(f.container.scrollTop, 70); assert.equal(f.container.scrollLeft, 3);
});

test('ranking changes keep focused rows and restore focus without moving the scroll position', () => {
  const f = fixture();
  reconcileKeyedRows(f.container, [{ id: 'a', value: 10 }, { id: 'b', value: 20 }], f.options);
  const [a, b] = f.container.children; f.document.activeElement = b;
  reconcileKeyedRows(f.container, [{ id: 'b', value: 30 }, { id: 'a', value: 10 }], f.options);
  assert.equal(f.created(), 2); assert.deepEqual(f.container.children, [b, a]);
  assert.equal(f.document.activeElement, b); assert.deepEqual(b.focusOptions, { preventScroll: true });
  assert.equal(f.container.scrollTop, 70);
});

test('removed players leave the tree and new players alone create a new row', () => {
  const f = fixture();
  reconcileKeyedRows(f.container, [{ id: 'a' }, { id: 'b' }], f.options);
  const a = f.container.children[0];
  reconcileKeyedRows(f.container, [{ id: 'b' }, { id: 'c' }], f.options);
  assert.equal(f.created(), 3); assert.equal(a.isConnected, false);
  assert.deepEqual(f.container.children.map(row => row.dataset.key), ['b', 'c']);
});

test('unchanged visible text and attributes are not written again', () => {
  let writes = 0, text = '12', attribute = '12';
  const node = { get textContent() { return text; }, set textContent(value) { text = value; writes += 1; }, getAttribute: () => attribute, setAttribute: (_name, value) => { attribute = value; writes += 1; } };
  setText(node, 12); setAttribute(node, 'aria-label', 12); assert.equal(writes, 0);
  setText(node, 13); setAttribute(node, 'aria-label', 13); assert.equal(writes, 2);
});

test('delegated drawer controls never resolve a layout attribute on the outer meter and swallow another action', () => {
  const meter = { dataset: { layout: 'studio' } }, themeButton = { dataset: { theme: 'white' } }, exportButton = { dataset: { action: 'export-current' } };
  const drawer = { contains: node => node === themeButton || node === exportButton };
  const target = { closest: selector => selector === '[data-layout]' ? meter : selector === 'button[data-theme]' ? themeButton : null };
  assert.equal(delegatedControl({ target }, drawer, '[data-layout]'), null);
  assert.equal(delegatedControl({ target }, drawer, 'button[data-layout]'), null);
  assert.equal(delegatedControl({ target }, drawer, 'button[data-theme]'), themeButton);
  const exportTarget = { closest: selector => selector === 'button[data-action]' ? exportButton : selector === '[data-layout]' ? meter : null };
  assert.equal(delegatedControl({ target: exportTarget }, drawer, 'button[data-layout]'), null);
  assert.equal(delegatedControl({ target: exportTarget }, drawer, 'button[data-action]'), exportButton);
});
