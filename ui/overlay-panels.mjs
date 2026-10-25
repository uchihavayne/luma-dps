// What each detached panel window shows. Pure: state in, markup out, so it can be checked without a
// window. Every name that came from the game goes through `esc`.
import { bossCasts } from './assistance.mjs';
import { frenzyLabel, healthFraction } from './combat.mjs';
import { deathRecap } from './pvp.mjs';
import { clockText, idLabel, partyFraction, ticketRows } from './session-data.mjs';
import { automaticTeamState } from './team.mjs';

export const PANELS = Object.freeze(['pvp', 'vitals', 'cube', 'party', 'tickets', 'tracker', 'cooldowns']);
export const PANEL_TITLES = Object.freeze({
  pvp: ['PvP', 'PvP'], vitals: ['Can ve öfke', 'Health & frenzy'], cube: ['Hidden Cube', 'Hidden Cube'],
  party: ['Parti', 'Party'], tickets: ['Biletler', 'Tickets'], tracker: ['Takip', 'Tracker'], cooldowns: ['Beceriler', 'Skills'],
});

export const panelName = value => PANELS.includes(value) ? value : 'vitals';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
export const short = number => !Number.isFinite(number) ? '—' : number >= 1e6 ? `${(number / 1e6).toFixed(number >= 1e7 ? 0 : 1)}M` : number >= 1e3 ? `${(number / 1e3).toFixed(number >= 1e4 ? 0 : 1)}K` : String(Math.round(number));

const CUBE_ICON = '<svg class="cube-icon" viewBox="0 0 24 24" aria-hidden="true"><path class="top" d="M12 2.5 20.5 7 12 11.5 3.5 7z"/><path class="left" d="M3.5 7 12 11.5v10L3.5 17z"/><path class="right" d="M20.5 7 12 11.5v10l8.5-4.5z"/></svg>';

function pvpPanel({ state, locale, label }) {
  const tr = locale !== 'en', pvp = state.pvp, recap = deathRecap(pvp.last_death, { locale, label });
  const stat = (value, caption, title = '') => `<div${title ? ` title="${esc(title)}"` : ''}><b>${esc(value)}</b><small>${caption}</small></div>`;
  const rows = recap ? recap.skills.map(row => `<div class="skill" style="--share:${row.share.toFixed(3)}"><span class="name">${esc(row.name)}</span><span>${row.hits}×</span><span>${Math.round(row.share * 100)}%</span><span>${esc(short(row.damage))}</span></div>`).join('') : '';
  const assists = tr ? 'Asist, oyunun skor bildirimi ve parti listesindeki karakter kimliğin gelince görünür.' : 'Assists appear once the game score arrives and your character is in a party list.';
  return `<div class="stats">${stat(pvp.kills, tr ? 'ÖLDÜRME' : 'KILLS')}${stat(pvp.deaths, tr ? 'ÖLÜM' : 'DEATHS')}${stat(pvp.assists ?? '—', tr ? 'ASİST' : 'ASSISTS', pvp.assists === null ? assists : '')}</div>`
    + (recap ? `<div class="recap"><strong>${esc(recap.kind)}</strong><span>${esc(recap.line)}</span><small>${tr ? 'Son 10 sn alınan hasar' : 'Damage taken in the last 10 s'}: ${esc(short(recap.taken))}</small></div>${rows}`
      : `<p class="hint">${tr ? 'Henüz bir oyuncuyla savaşmadın.' : 'No player fought yet.'}</p>`);
}

function vitalsPanel({ state, locale, now, label }) {
  const tr = locale !== 'en', frenzy = frenzyLabel(state.frenzy, { locale, now }), health = state.own_health, fraction = healthFraction(health);
  const actor = id => state.players.find(player => player.id === String(id))?.name || state.targets.find(target => target.id === String(id))?.name || `#${id || '?'}`;
  const casts = bossCasts(state, now);
  const frenzyRow = frenzy
    ? `<div class="row frenzy" data-urgent="${frenzy.urgent}"><small>${tr ? 'BOSS ÖFKESİ' : 'BOSS FRENZY'}</small><b>${esc(frenzy.clock)}</b><span>${esc(state.frenzy.target_name || '')}</span></div>`
    : `<div class="row idle"><small>${tr ? 'BOSS ÖFKESİ' : 'BOSS FRENZY'}</small><b>—</b><span>${tr ? 'bildirim yok' : 'no notice'}</span></div>`;
  const healthRow = health
    ? `<div class="row hp" data-low="${fraction !== null && fraction < 0.3}"><small>${tr ? 'CANIN' : 'HEALTH'}</small><b>${esc(short(health.hp))}</b>${fraction === null ? `<span>${tr ? 'azami can bilinmiyor' : 'maximum unknown'}</span>` : `<i class="bar"><u style="width:${(fraction * 100).toFixed(1)}%"></u></i><span>${Math.round(fraction * 100)}%</span>`}</div>`
    : `<div class="row idle"><small>${tr ? 'CANIN' : 'HEALTH'}</small><b>—</b><span>${tr ? 'bildirim yok' : 'no notice'}</span></div>`;
  const castRows = casts.length
    ? casts.map(cast => `<div class="cast" data-aimed="${cast.aimed}" data-lethal="${Boolean(cast.lethal)}">${cast.lethal ? `<em>${tr ? 'ÖLÜMCÜL' : 'LETHAL'}</em>` : ''}<span>${esc(actor(cast.actor_id))} · ${esc(label(cast.skill_id || '?'))}</span><time>${(Math.max(0, cast.expires_ms - now) / 1000).toFixed(1)} s</time></div>`).join('')
    : `<p class="hint">${tr ? 'Yaklaşan boss büyüsü yok' : 'No monster cast coming'}</p>`;
  return `${frenzyRow}${healthRow}<div class="casts">${castRows}</div>`;
}

function cubePanel({ cube }) {
  const net = cube.network;
  if (!net.near) return `<p class="hint">${esc(net.label)}</p>`;
  const arrow = net.angle === null ? '' : `<svg class="arrow" viewBox="0 0 24 24" style="transform:rotate(${Number(net.angle)}deg)" aria-hidden="true"><path d="M12 3 18.5 17 12 13.8 5.5 17z"/></svg>`;
  return `<div class="cube" data-look="${esc(net.look || 'red')}" data-taken="${net.taken}">${CUBE_ICON}<div class="cube-main"><b>${esc(net.distance)}</b><span>${esc(net.nearLabel)}</span></div>${arrow}</div>${net.summary ? `<p class="hint">${esc(net.summary)}</p>` : ''}`;
}


function partyPanel({ state, locale }) {
  const tr = locale !== 'en';
  if (!state.party.length) return `<p class="hint">${tr ? 'Parti listesi yok. Bir partiye girince üyeler burada görünür.' : 'No party list. Members appear here once you are in a party.'}</p>`;
  return `<div class="members">${state.party.map(row => {
    const fraction = partyFraction(row);
    return `<div class="member" data-self="${row.is_self}" data-low="${fraction < 0.3}" title="${esc(short(row.hp))} / ${esc(short(row.hp_max))}"><span class="name">${esc(row.name)}</span><i class="bar"><u style="width:${(fraction * 100).toFixed(1)}%"></u></i><b>${Math.round(fraction * 100)}%</b></div>`;
  }).join('')}</div>`;
}

function ticketsPanel({ state, locale, now, names }) {
  const tr = locale !== 'en', rows = ticketRows(state.resources, { names, now, locale });
  if (!rows.length) return `<p class="hint">${tr ? 'Bilet bilgisi oyundan henüz gelmedi. Karakter seçerken ya da oyuna girerken gelir.' : 'No ticket data from the game yet. It arrives when you log in.'}</p>`;
  return `<div class="tickets">${rows.map(row => `<div class="ticket"><span class="name" title="#${row.id}">${esc(row.name)}</span><b>${row.count}${row.bonus ? `<small>+${row.bonus}</small>` : ''}</b><time>${row.left_ms ? esc(clockText(row.left_ms)) : ''}</time></div>`).join('')}</div>`;
}

function trackerPanel({ state, locale, names }) {
  const tr = locale !== 'en', tracker = state.tracker;
  if (!tracker.kills.length && !tracker.gathered.length) return `<p class="hint">${tr ? 'Bu oturumda henüz öldürme ya da toplama yok.' : 'Nothing killed or gathered this session yet.'}</p>`;
  const kills = tracker.kills.map(row => `<div class="line"><span class="name" title="#${row.model}">${esc(row.name || `${tr ? 'Canavar' : 'Monster'} #${row.model}`)}</span><b>${row.count}</b></div>`).join('');
  const gathered = tracker.gathered.map(row => `<div class="line"><span class="name" title="#${row.item}">${esc(idLabel(names, 'item', row.item, `${tr ? 'Eşya' : 'Item'} #${row.item}`))}</span><b>${row.count}</b></div>`).join('');
  return `${kills ? `<div class="group"><small>${tr ? 'ÖLDÜRÜLEN' : 'KILLED'} · ${tracker.kills_total}</small>${kills}</div>` : ''}${gathered ? `<div class="group"><small>${tr ? 'TOPLANAN' : 'GATHERED'}</small>${gathered}</div>` : ''}`;
}

// Your own skills the game has told us the cooldown of: cooling ones first, soonest first.
function cooldownsPanel({ state, locale, now, label }) {
  const tr = locale !== 'en', team = automaticTeamState(state, { now }), me = team.members.find(member => member.is_self);
  const ready = row => row.kind === 'confirmed' || row.kind === 'available-charge';
  const rows = (me?.cooldowns || []).filter(row => row.kind !== 'unknown').sort((a, b) => Number(ready(a)) - Number(ready(b)) || (a.remaining_ms ?? Infinity) - (b.remaining_ms ?? Infinity)).slice(0, 8);
  if (!rows.length) return `<p class="hint">${tr ? 'Beceri bekleme süresi bilgisi henüz gelmedi. Bir beceri kullanınca görünür.' : 'No skill cooldown seen yet. It appears once you use a skill.'}</p>`;
  return `<div class="cooldowns">${rows.map(row => {
    const seconds = row.remaining_ms === null ? '—' : row.remaining_ms < 10_000 ? `${(row.remaining_ms / 1000).toFixed(1)} ${tr ? 'sn' : 's'}` : `${Math.ceil(row.remaining_ms / 1000)} ${tr ? 'sn' : 's'}`;
    const percent = row.cooldown_ms > 0 && row.remaining_ms !== null ? Math.min(100, row.remaining_ms / row.cooldown_ms * 100) : 0;
    return `<div class="cd" data-ready="${ready(row)}"><span class="name">${esc(label(row.skill_id))}</span><time>${ready(row) ? (tr ? 'Hazır' : 'Ready') : esc(seconds)}</time><i class="bar"><u style="width:${(ready(row) ? 0 : percent).toFixed(1)}%"></u></i></div>`;
  }).join('')}</div>`;
}

export function renderPanel(panel, input) {
  const context = { label: id => `#${id}`, now: Date.now(), locale: 'tr', names: {}, ...input };
  return { pvp: pvpPanel, vitals: vitalsPanel, cube: cubePanel, party: partyPanel, tickets: ticketsPanel, tracker: trackerPanel, cooldowns: cooldownsPanel }[panelName(panel)](context);
}
