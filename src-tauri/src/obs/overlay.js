'use strict';
const key = new URL(document.currentScript.src).searchParams.get('key');
const list = document.querySelector('#players'), nodes = new Map();
const number = value => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : '—';
const perSecond = value => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  const thousands = value >= 1000;
  return Number((value / (thousands ? 1000 : 1)).toFixed(2)) + (thousands ? 'K/s' : '/s');
};
const labels = { personal: 'Personal', party: 'Party', observed: 'Observed players' };
const statuses = { capturing: 'Received game data', 'permission-required': 'Administrator permission needed', unsupported: 'Capture unavailable', 'waiting-game': 'Waiting for game', disconnected: 'Capture disconnected', error: 'Capture error', unknown: 'Waiting for capture' };
function text(id, value) { document.querySelector(id).textContent = value; }
function row(id) {
  const element = document.createElement('div'); element.className = 'row';
  const bar = document.createElement('progress'); bar.max = 100; bar.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span'), amount = document.createElement('strong'), rate = document.createElement('small');
  element.append(bar, name, amount, rate); list.append(element);
  const value = { element, bar, name, amount, rate }; nodes.set(id, value); return value;
}
function render(state) {
  const measuredRate = value => state.total_damage > 0 && !(state.elapsed_ms > 0) ? '—' : perSecond(value);
  text('#scope', labels[state.actor_scope] || 'Observed players'); text('#dps', measuredRate(state.dps)); text('#damage', number(state.total_damage));
  text('.metrics > div:nth-child(2) small', 'TOTAL DAMAGE');
  const dps = document.querySelector('#dps'), damage = document.querySelector('#damage');
  dps.title = 'DPS: ' + measuredRate(state.dps); damage.title = 'Total damage: ' + number(state.total_damage);
  dps.setAttribute('aria-label', dps.title); damage.setAttribute('aria-label', damage.title);
  const seconds = Math.floor(Math.max(0, Number(state.elapsed_ms) || 0) / 1000);
  text('#duration', String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'));
  text('#status', state.identity_known ? statuses[state.capture_status] || statuses.unknown : 'Character / party identity unresolved');
  text('#quality', state.incomplete ? 'PARTIAL DATA' : '');
  const seen = new Set();
  for (const [index, player] of (state.players || []).entries()) {
    const id = String(player.id); seen.add(id); const value = nodes.get(id) || row(id);
    value.element.className = 'row ' + player.class_name; value.name.textContent = player.name;
    value.amount.textContent = number(player.damage) + ' DMG'; value.rate.textContent = measuredRate(player.dps) + ' DPS';
    value.name.title = player.name; value.amount.title = 'Total damage: ' + number(player.damage); value.rate.title = 'DPS: ' + measuredRate(player.dps);
    value.amount.setAttribute('aria-label', value.amount.title); value.rate.setAttribute('aria-label', value.rate.title);
    value.bar.value = Math.max(0, Math.min(100, (Number(player.share) || 0) * 100));
    if (list.children[index] !== value.element) list.insertBefore(value.element, list.children[index] || null);
  }
  for (const [id, value] of nodes) if (!seen.has(id)) { value.element.remove(); nodes.delete(id); }
}
async function poll() {
  try {
    const response = await fetch('/state?key=' + key, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('Unavailable'); render(await response.json());
  } catch { text('#status', 'Luma source stopped'); }
  setTimeout(poll, 500);
}
poll();
