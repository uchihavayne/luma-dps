import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../../src-tauri/src/obs/overlay.js', import.meta.url), 'utf8');

function fixture() {
  const createElement = () => ({
    children: [], textContent: '', attributes: new Map(),
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } },
    setAttribute(name, value) { this.attributes.set(name, value); },
    insertBefore(node, before) {
      const previous = this.children.indexOf(node); if (previous !== -1) this.children.splice(previous, 1);
      const index = before ? this.children.indexOf(before) : this.children.length;
      this.children.splice(index, 0, node); node.parent = this;
    },
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); },
  });
  const elements = new Map();
  const document = { currentScript: { src: 'http://127.0.0.1:42000/overlay.js?key=abc' }, createElement, querySelector(selector) { if (!elements.has(selector)) elements.set(selector, createElement()); return elements.get(selector); } };
  const context = vm.createContext({ document, URL, Intl, fetch: () => new Promise(() => {}), setTimeout: () => {} });
  vm.runInContext(script, context);
  const render = state => { context.state = state; vm.runInContext('render(state)', context); };
  return { context, elements, render, rows: () => vm.runInContext('Array.from(nodes.values())', context) };
}

test('the served OBS script uses fixed K/s at large values and rejects unknown rates', () => {
  const { context } = fixture();
  for (const [value, expected] of [[0, '0/s'], [193, '193/s'], [11700, '11.7K/s'], [999999, '1000K/s'], [1234567, '1234.57K/s'], [1234567890, '1234567.89K/s'], [null, '—'], [-1, '—'], [NaN, '—'], [Infinity, '—']]) {
    context.value = value;
    assert.equal(vm.runInContext('perSecond(value)', context), expected);
  }
});

test('OBS summary and player rows distinguish accumulated damage from DPS without changing source data', () => {
  const view = fixture();
  const state = { actor_scope: 'personal', dps: 1234567, total_damage: 98765432, elapsed_ms: 61000, identity_known: true, capture_status: 'capturing', incomplete: false, players: [{ id: 7, name: '<b>Self</b>', class_name: 'ranger', damage: 98765432, dps: 1234567, share: 1 }] };
  const before = structuredClone(state); view.render(state);
  assert.equal(view.elements.get('#dps').textContent, '1234.57K/s');
  assert.equal(view.elements.get('#damage').textContent, '98.8M');
  assert.equal(view.elements.get('.metrics > div:nth-child(2) small').textContent, 'TOTAL DAMAGE');
  assert.equal(view.elements.get('#dps').attributes.get('aria-label'), 'DPS: 1234.57K/s');
  const [row] = view.rows();
  assert.equal(row.name.textContent, '<b>Self</b>');
  assert.equal(row.amount.textContent, '98.8M DMG');
  assert.equal(row.rate.textContent, '1234.57K/s DPS');
  assert.equal(row.amount.title, 'Total damage: 98.8M');
  assert.equal(row.rate.attributes.get('aria-label'), 'DPS: 1234.57K/s');
  assert.deepEqual(state, before);
});

test('OBS keeps row identities through rate updates and ranking changes with bounded progress values', () => {
  const view = fixture();
  const a = { id: 1, name: 'One', damage: 999999, dps: 999999, share: 2 }, b = { id: 2, name: 'Two', damage: 2500000, dps: 2500000, share: -1 };
  const state = { actor_scope: 'observed', dps: null, total_damage: null, players: [a, b], incomplete: true };
  view.render(state); const [one, two] = view.rows();
  assert.equal(one.rate.textContent, '1000K/s DPS'); assert.equal(one.bar.value, 100); assert.equal(two.bar.value, 0);
  view.render({ ...state, players: [{ ...b, dps: 3500000 }, { ...a, dps: 1000001 }] });
  assert.equal(view.elements.get('#players').children[0], two.element);
  assert.equal(view.elements.get('#players').children[1], one.element);
  assert.equal(two.rate.textContent, '3500K/s DPS'); assert.equal(one.rate.textContent, '1000K/s DPS');
  assert.equal(view.elements.get('#quality').textContent, 'PARTIAL DATA');
  assert.equal(view.elements.get('#dps').textContent, '—');
  view.render({ ...state, players: [a] }); assert.equal(view.rows().length, 1);
});

test('OBS does not present zero-duration accumulated damage as a measured DPS', () => {
  const view = fixture();
  const state = { actor_scope: 'personal', elapsed_ms: 0, total_damage: 3000, dps: 3000, identity_known: true, players: [{ id: 7, name: 'Self', damage: 3000, dps: 3000 }] };
  view.render(state);
  assert.equal(view.elements.get('#damage').textContent, '3K');
  assert.equal(view.elements.get('#dps').textContent, '—');
  assert.equal(view.rows()[0].amount.textContent, '3K DMG');
  assert.equal(view.rows()[0].rate.textContent, '— DPS');
  assert.equal(state.dps, 3000); assert.equal(state.elapsed_ms, 0);
  view.render({ ...state, elapsed_ms: 1000 });
  assert.equal(view.elements.get('#dps').textContent, '3K/s');
});
