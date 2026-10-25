// The skill table inside the main window: your skills ranked with the game's own icon, damage per
// second, share and total. Pure: the player and the fight time in, markup out.
import { iconImg, skillIconPath } from './icons.mjs';
import { skillRows } from './skills.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

// null when the player has no damage yet, so the window shows no empty table.
export function skillBoard({ player, elapsedMs, locale = 'tr', collapsed = false, label = String, rate = String, num = String, limit = 12 }) {
  const view = skillRows(player, elapsedMs, { limit });
  if (!view.rows.length) return null;
  const tr = locale !== 'en';
  const rows = view.rows.map(row => `<div class="skill-row" style="--share:${row.share.toFixed(3)}"><span class="skill-name" title="${esc(label(row.id))}">${iconImg(skillIconPath(Number(row.id)), 20)}<span>${esc(label(row.id))}</span></span><span class="skill-rate">${esc(rate(row.perSecond))}</span><span class="skill-share">${(row.share * 100).toFixed(1)}%</span><span class="skill-total">${esc(num(row.damage))}</span></div>`).join('');
  const toggle = collapsed ? (tr ? 'Aç' : 'Expand') : (tr ? 'Daralt' : 'Collapse');
  const body = collapsed ? '' : `<div class="board-rows">${rows}</div><div class="board-foot">${view.more ? `<span>+${view.more}</span>` : '<span></span>'}<button type="button" class="text-button" data-skill-board="all">${tr ? 'Tüm yetenekler ↗' : 'All skills ↗'}</button></div>`;
  const html = `<div class="board-head"><strong>${tr ? 'Yeteneklerim' : 'My skills'}</strong><span class="board-total"><b>${esc(rate(view.total / view.seconds))}</b> · ${esc(num(view.total))}</span><button type="button" class="icon-button" data-skill-board="toggle" aria-expanded="${!collapsed}" aria-label="${toggle}">⌃</button></div>${body}`;
  return { html, rows: view.rows.length, more: view.more };
}
