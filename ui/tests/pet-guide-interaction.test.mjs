import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshPetGuidePanel } from '../pets.mjs';

function fixture() {
  const document = { activeElement: null };
  let pressed = false, refreshes = 0, nodes = [];
  const host = { ownerDocument: document, scrollTop: 340,
    contains: node => nodes.includes(node),
    querySelector: selector => selector === 'button:active' && pressed ? document.activeElement : null,
    querySelectorAll: () => nodes,
  };
  const control = properties => ({ dataset: {}, name: '', isConnected: true, ...properties,
    focus(options) { this.focusOptions = options; document.activeElement = this; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
  });
  function replace() {
    for (const node of nodes) node.isConnected = false;
    nodes = [control({ name: 'petQuery', value: 'Krall', selectionStart: 0, selectionEnd: 0 }),
      control({ dataset: { action: 'pet-pin', id: '1002' } }),
      control({ dataset: { action: 'pet-pin', id: '1003' } })];
    host.scrollTop = 0; document.activeElement = null;
  }
  replace(); host.scrollTop = 340;
  return { document, host, nodes: () => nodes, pressed: value => { pressed = value; },
    refresh: () => { refreshes++; replace(); }, refreshes: () => refreshes };
}

test('live pet metadata cannot replace a pressed guide pin before its click, and release restores the exact focused pin', () => {
  const f = fixture(), original = f.nodes()[2];
  f.document.activeElement = original; f.pressed(true);
  assert.equal(refreshPetGuidePanel(f.host, f.refresh), false);
  assert.equal(f.refreshes(), 0); assert.equal(original.isConnected, true);
  assert.equal(f.document.activeElement, original); assert.equal(f.host.scrollTop, 340);
  f.pressed(false);
  assert.equal(refreshPetGuidePanel(f.host, f.refresh), true);
  assert.equal(f.refreshes(), 1); assert.equal(original.isConnected, false);
  assert.equal(f.document.activeElement, f.nodes()[2]);
  assert.equal(f.document.activeElement.dataset.id, '1003');
  assert.deepEqual(f.document.activeElement.focusOptions, { preventScroll: true });
  assert.equal(f.host.scrollTop, 340);
});

test('automatic guide refresh retains a typed query, selected text and scroll without focusing an unrelated control', () => {
  const f = fixture(), input = f.nodes()[0];
  Object.assign(input, { value: 'Krall Armed Soldier', selectionStart: 6, selectionEnd: 11 });
  f.document.activeElement = input;
  assert.equal(refreshPetGuidePanel(f.host, f.refresh), true);
  const current = f.nodes()[0];
  assert.equal(f.document.activeElement, current); assert.equal(current.value, 'Krall Armed Soldier');
  assert.equal(current.selectionStart, 6); assert.equal(current.selectionEnd, 11);
  assert.equal(f.host.scrollTop, 340);
  const outside = { name: 'petQuery', value: 'Outside' };
  f.document.activeElement = outside;
  f.refresh = () => {}; // No UI action should steal focus from outside this panel.
  assert.equal(refreshPetGuidePanel(f.host, f.refresh), true);
  assert.equal(f.document.activeElement, outside);
});
