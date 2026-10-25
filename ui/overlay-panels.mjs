// What each detached panel window shows. Pure: state in, markup out, so it can be checked without a
// window. Every name that came from the game goes through `esc`.
import { bossCasts } from './assistance.mjs';
import { itemLabel, serverLabel } from './catalog.mjs';
import { classIcon } from './class-icons.mjs';
import { controlLabel, controlLoss, ownEffects } from './control.mjs';
import { frenzyLabel, healthFraction } from './combat.mjs';
import { buffIconPath, cubeIconPath, iconImg, itemIconPath, skillIconPath, ticketIconPath } from './icons.mjs';
import { targetVital } from './bosses.mjs';
import { liveServerActorId } from './model.mjs';
import { nextScheduledEvent } from './events.mjs';
import { heading, mapPoint, worldMap } from './maps.mjs';
import { spatialFrame } from './spatial.mjs';
import { deathRecap } from './pvp.mjs';
import { resourceStatus } from './resources.mjs';
import { groupedNumber, partyFraction, powerText, roomSummary, spanText, ticketRows } from './session-data.mjs';
import { skillRows } from './skills.mjs';
import { latencyPresentation } from './telemetry.mjs';
import { automaticTeamState } from './team.mjs';

export const PANELS = Object.freeze(['damage', 'pvp', 'vitals', 'cube', 'party', 'tickets', 'tracker', 'cooldowns', 'currencies', 'effects', 'timers', 'flight', 'bosshp', 'actions', 'rivals', 'map', 'ping', 'controls']);
export const PANEL_TITLES = Object.freeze({
  damage: ['Hasar dökümü', 'Damage'], pvp: ['PvP', 'PvP'], vitals: ['Can ve öfke', 'Health & frenzy'], cube: ['Hidden Cube', 'Hidden Cube'],
  party: ['Parti', 'Party'], tickets: ['Biletler', 'Tickets'], tracker: ['Takip', 'Tracker'], cooldowns: ['Beceriler', 'Skills'], currencies: ['Para', 'Currencies'], effects: ['Etkiler', 'Effects'],
  timers: ['Zamanlayıcılar', 'Timers'], flight: ['Uçuş', 'Flight'], bosshp: ['Hedef canı', 'Target health'], actions: ['Yetenek çubuğu', 'Action bar'], rivals: ['Rakip süreleri', 'Opponent cooldowns'], map: ['Harita', 'Map'], ping: ['Gecikme', 'Ping'], controls: ['Pencere kontrolleri', 'Overlay controls'],
});

export const panelName = value => PANELS.includes(value) ? value : 'vitals';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
export const short = number => !Number.isFinite(number) ? '—' : number >= 1e6 ? `${(number / 1e6).toFixed(number >= 1e7 ? 0 : 1)}M` : number >= 1e3 ? `${(number / 1e3).toFixed(number >= 1e4 ? 0 : 1)}K` : String(Math.round(number));

// 8250 is "8.25K", 18200 "18.2K": the way the game's players write damage.
export const dpsText = number => !Number.isFinite(number) || number <= 0 ? '0' : number >= 1e6 ? `${(number / 1e6).toFixed(2)}M` : number >= 1e3 ? `${(number / 1e3).toFixed(number >= 1e4 ? 1 : 2)}K` : String(Math.round(number));
const totalText = number => !Number.isFinite(number) || number <= 0 ? '0' : number >= 1e6 ? `${(number / 1e6).toFixed(2)}M` : number >= 1e3 ? `${(number / 1e3).toFixed(1)}K` : String(Math.round(number));
const clock = milliseconds => { const total = Math.floor(Math.max(0, milliseconds) / 1000); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };


// Every skill you used, ranked: its icon, its damage per second, its share and its total, under your
// own damage per second and the time of the fight.
function damagePanel({ state, locale, label }) {
  const tr = locale !== 'en', own = state.players.find(player => player.is_local) || state.players.find(player => player.id === String(state.local_player_id));
  const elapsed = state.personal_elapsed_ms || state.elapsed_ms || 0, view = skillRows(own, elapsed, { limit: 12 });
  if (!view.rows.length) return `<p class="hint">${tr ? 'Savaş başlayınca kullandığın yetenekler ve hasarları burada görünür.' : 'The skills you use and their damage appear here once a fight starts.'}</p>`;
  const rows = view.rows.map(row => `<div class="skill-line" style="--share:${row.share.toFixed(3)}" title="${esc(label(row.id))} · ${row.hits}×${row.crits ? ` · ${Math.round(row.crits / row.hits * 100)}% ${tr ? 'kritik' : 'crit'}` : ''}"><span class="icon">${iconImg(skillIconPath(Number(row.id)), 26)}</span><span class="name">${esc(label(row.id))}</span><span class="rate">${esc(dpsText(row.perSecond))}</span><span class="share">${(row.share * 100).toFixed(1)}%</span><span class="total">${esc(totalText(row.damage))}</span></div>`).join('');
  return `<div class="dmg-head"><b>${esc(dpsText(view.total / view.seconds))}</b><small>DPS</small><time>${clock(elapsed)}</time></div><div class="skill-lines">${rows}</div>${view.more ? `<small class="more">+${view.more} ${tr ? 'yetenek daha' : 'more skills'}</small>` : ''}`;
}

function pvpPanel({ state, locale, label }) {
  const tr = locale !== 'en', pvp = state.pvp, recap = deathRecap(pvp.last_death, { locale, label });
  const stat = (value, caption, title = '') => `<div${title ? ` title="${esc(title)}"` : ''}><b>${esc(value)}</b><small>${caption}</small></div>`;
  const rows = recap ? recap.skills.map(row => `<div class="skill" style="--share:${row.share.toFixed(3)}"><span class="name">${esc(row.name)}</span><span>${row.hits}×</span><span>${Math.round(row.share * 100)}%</span><span>${esc(short(row.damage))}</span></div>`).join('') : '';
  const assists = tr ? 'Asist, oyunun skor bildirimi ve parti ya da oda listesindeki karakter kimliğin gelince görünür.' : 'Assists appear once the game score arrives and your character is in a party or room list.';
  return `<div class="stats">${stat(pvp.kills, tr ? 'ÖLDÜRME' : 'KILLS')}${stat(pvp.deaths, tr ? 'ÖLÜM' : 'DEATHS')}${stat(pvp.assists ?? '—', tr ? 'ASİST' : 'ASSISTS', pvp.assists === null ? assists : '')}</div>`
    + (recap ? `<div class="recap"><strong>${esc(recap.kind)}</strong><span>${esc(recap.line)}</span><small>${tr ? 'Son 10 sn alınan hasar' : 'Damage taken in the last 10 s'}: ${esc(short(recap.taken))}</small></div>${rows}`
      : `<p class="hint">${tr ? 'Henüz bir oyuncuyla savaşmadın.' : 'No player fought yet.'}</p>`);
}

function vitalsPanel({ state, locale, now, label }) {
  const tr = locale !== 'en', frenzy = frenzyLabel(state.frenzy, { locale, now }), health = state.own_health, fraction = healthFraction(health);
  const actor = id => state.players.find(player => player.id === String(id))?.name || state.targets.find(target => target.id === String(id))?.name || `#${id || '?'}`;
  const casts = bossCasts(state, now);
  const loss = controlLoss(ownEffects(state, now));
  const banner = loss ? `<div class="alert"><b>${tr ? 'KONTROL KAYBI' : 'CONTROL LOST'}</b><span>${esc(controlLabel(loss.control, locale))}</span>${loss.remaining_ms === null ? '' : `<time>${(loss.remaining_ms / 1000).toFixed(1)} ${tr ? 'sn' : 's'}</time>`}</div>` : '';
  const ping = latencyPresentation(state.capture?.status === 'capturing' ? state.capture.network_latency : { status: 'unavailable' }, { now, locale });
  const pingRow = ping.fresh ? `<div class="row ping"><small>${tr ? 'GECİKME' : 'PING'}</small><b>${ping.rtt_ms}</b><span>ms</span></div>` : '';
  const frenzyRow = frenzy
    ? `<div class="row frenzy" data-urgent="${frenzy.urgent}"><small>${tr ? 'BOSS ÖFKESİ' : 'BOSS FRENZY'}</small><b>${esc(frenzy.clock)}</b><span>${esc(state.frenzy.target_name || '')}</span></div>`
    : `<div class="row idle"><small>${tr ? 'BOSS ÖFKESİ' : 'BOSS FRENZY'}</small><b>—</b><span>${tr ? 'bildirim yok' : 'no notice'}</span></div>`;
  const healthRow = health
    ? `<div class="row hp" data-low="${fraction !== null && fraction < 0.3}"><small>${tr ? 'CANIN' : 'HEALTH'}</small><b>${esc(short(health.hp))}</b>${fraction === null ? `<span>${tr ? 'azami can bilinmiyor' : 'maximum unknown'}</span>` : `<i class="bar"><u style="width:${(fraction * 100).toFixed(1)}%"></u></i><span>${Math.round(fraction * 100)}%</span>`}</div>`
    : `<div class="row idle"><small>${tr ? 'CANIN' : 'HEALTH'}</small><b>—</b><span>${tr ? 'bildirim yok' : 'no notice'}</span></div>`;
  const castRows = casts.length
    ? casts.map(cast => `<div class="cast" data-aimed="${cast.aimed}" data-lethal="${Boolean(cast.lethal)}">${cast.lethal ? `<em>${tr ? 'ÖLÜMCÜL' : 'LETHAL'}</em>` : ''}${iconImg(skillIconPath(Number(cast.skill_id)), 18)}<span>${esc(actor(cast.actor_id))} · ${esc(label(cast.skill_id || '?'))}</span><time>${(Math.max(0, cast.expires_ms - now) / 1000).toFixed(1)} s</time></div>`).join('')
    : `<p class="hint">${tr ? 'Yaklaşan boss büyüsü yok' : 'No monster cast coming'}</p>`;
  return `${banner}${frenzyRow}${healthRow}${pingRow}<div class="casts">${castRows}</div>`;
}

// The Hidden Cube marker: not a window but the game's own cube picture on the screen with its
// direction, distance and age, there only while a Cube is near (and, if asked, only while you hold a
// key). While the player places it, a sample shows.
function cubePanel({ cube, state, locale, marker = {} }) {
  const tr = locale !== 'en', { enabled = true, needKeys = false, edit = false } = marker, net = cube.network;
  const keys = state.cube_keys;
  const sample = edit && !net.near;
  if (!sample && (!enabled || !net.near || (needKeys && keys === 0))) return '';
  const view = sample ? { look: 'gold', taken: false, kind: tr ? 'Altın Küp' : 'Gold Cube', distance: '42 m', side: tr ? 'sağında' : 'to your right', detail: tr ? '3 m yukarıda · kuzeydoğuda' : '3 m above · to the northeast', age: null, angle: 40 } : net;
  const look = view.look === 'red' ? 'red' : 'gold';
  const pointer = view.angle === null || view.taken ? '' : `<svg class="pointer" viewBox="0 0 100 100" style="transform:rotate(${Number(view.angle)}deg)" aria-hidden="true"><path d="M50 0 63 19 50 12 37 19z"/></svg>`;
  const detail = view.taken ? '' : [view.side, view.detail].filter(Boolean).join(' · ');
  const meta = [view.taken ? null : view.age, keys === null ? null : `${tr ? 'Anahtar' : 'Keys'} ${keys}`].filter(Boolean).join(' · ');
  return `<div class="marker" data-look="${look}" data-taken="${Boolean(view.taken)}"><span class="marker-art"><span class="glow"></span>${iconImg(cubeIconPath(look), 56)}${pointer}</span><span class="marker-text"><small class="kind">${esc(view.taken ? (tr ? `${view.kind} · açıldı` : `${view.kind} · opened`) : view.kind)}</small><b class="dist">${esc(view.distance)}</b>${detail ? `<span class="detail">${esc(detail)}</span>` : ''}${meta ? `<span class="meta">${esc(meta)}</span>` : ''}</span></div>`;
}

// The room (or, without one, the party): class, name and server, gear score, combat power and who
// is ready, with the health of the members the party list also gives.
function partyPanel({ state, locale, names }) {
  const tr = locale !== 'en', room = state.room, summary = roomSummary(room);
  if (!room || !room.members.length) {
    if (!state.party.length) return `<p class="hint">${tr ? 'Parti ya da oda yok. Birine girince üyeler burada görünür.' : 'No party or room. Members appear here once you join one.'}</p>`;
    return `<div class="members">${state.party.map(row => {
      const fraction = partyFraction(row);
      return `<div class="member" data-self="${row.is_self}" data-low="${fraction < 0.3}" title="${esc(short(row.hp))} / ${esc(short(row.hp_max))}"><span class="name">${esc(row.name)}</span><i class="bar"><u style="width:${(fraction * 100).toFixed(1)}%"></u></i><b>${Math.round(fraction * 100)}%</b></div>`;
    }).join('')}</div>`;
  }
  const health = new Map(state.party.map(row => [row.name, row]));
  const status = row => row.leader ? ['leader', `♛ ${tr ? 'Lider' : 'Leader'}`] : row.ready ? ['ready', tr ? 'Hazır' : 'Ready'] : ['waiting', tr ? 'Hazır değil' : 'Not ready'];
  const seats = room.members.map(row => {
    const [kind, text] = status(row), vitals = health.get(row.name), fraction = vitals ? partyFraction(vitals) : null;
    const tag = row.server ? serverLabel(names, row.server) : '';
    return `<div class="seat" data-status="${kind}" data-self="${row.is_self}"><span class="icon">${classIcon(row.class)}</span><span class="who"><b>${esc(row.name)}</b>${tag ? `<small>${esc(tag)}</small>` : ''}</span><span class="gs">${esc(row.gear_score ? groupedNumber(row.gear_score, locale) : '—')}</span><span class="cp">${esc(powerText(row.combat_power))}</span><span class="state">${esc(text)}</span>${fraction === null ? '' : `<i class="hp" data-low="${fraction < 0.3}"><u style="width:${(fraction * 100).toFixed(1)}%"></u></i>`}</div>`;
  }).join('');
  return `<div class="group-head"><strong>${esc(room.title || (tr ? 'Parti' : 'Party'))}</strong><span>${summary.ready}/${summary.total} ${tr ? 'hazır' : 'ready'}</span></div>`
    + `<div class="average"><b>${esc(powerText(summary.average_power))}</b><small>${tr ? 'ortalama CP' : 'average CP'}</small></div>`
    + `<div class="seats"><div class="seat-head"><span></span><span></span><span>GS</span><span>CP</span><span></span></div>${seats}</div>`;
}

function hourglass(left) {
  return `<time>${esc(spanText(left))}</time>`;
}

// Odyle is a card with its bar; the other tickets are tiles with their icon, what is left and the most
// they hold; tickets that hold hours are lines.
function ticketsPanel({ state, locale, now, names, caps, shown }) {
  const tr = locale !== 'en', status = resourceStatus(state.resources, now), rows = ticketRows(state.resources, { names, caps, now, locale, shown, member: status.membership_active });
  if (!rows.length) return `<p class="hint">${tr ? 'Bilet bilgisi oyundan henüz gelmedi. Karakter seçerken ya da oyuna girerken gelir.' : 'No ticket data from the game yet. It arrives when you log in.'}</p>`;
  const hero = rows.find(row => row.hero), times = rows.filter(row => row.kind === 'time' && !row.hero), tiles = rows.filter(row => row.kind === 'count' && !row.hero);
  const capacity = hero ? (status.base_capacity ?? hero.cap) : null;
  const card = hero ? `<div class="hero"><div class="hero-top"><span class="gem" aria-hidden="true">${iconImg(ticketIconPath(hero.id), 40)}</span><b>${hero.count}</b>${hero.bonus ? `<em>+${hero.bonus}</em>` : ''}${capacity ? `<small>/ ${capacity}</small>` : ''}<span class="refill">${hero.left_ms ? `<small>${tr ? 'Sonraki dolum' : 'Next refill'}</small>${hourglass(hero.left_ms)}` : ''}</span></div>${capacity ? `<i class="bar"><u style="width:${Math.min(100, hero.count / capacity * 100).toFixed(1)}%"></u></i>` : ''}<small class="hero-name">${esc(hero.name)}${hero.rule ? ` · ${esc(hero.rule)}` : ''}</small></div>` : '';
  const grid = tiles.length ? `<div class="tiles">${tiles.map(row => `<div class="tile" data-full="${row.cap !== null && row.count >= row.cap}" title="${esc([row.category, row.name, row.rule, `#${row.id}`].filter(Boolean).join(' · '))}"><span class="icon">${iconImg(ticketIconPath(row.id), 30)}</span><b>${row.count}${row.bonus ? `<em>+${row.bonus}</em>` : ''}${row.cap !== null ? `<small>/${row.cap}</small>` : ''}</b><span class="label">${esc(row.name)}</span></div>`).join('')}</div>` : '';
  const lines = times.length ? `<div class="times">${times.map(row => `<div class="time-row" title="${esc([row.category, row.name, `#${row.id}`].filter(Boolean).join(' · '))}"><span class="icon">${iconImg(ticketIconPath(row.id), 22)}</span><span class="name">${esc(row.name)}</span><b>${esc(spanText(row.left_ms))}</b></div>`).join('')}</div>` : '';
  return `${card}${grid}${lines}`;
}

function trackerPanel({ state, locale, names }) {
  const tr = locale !== 'en', tracker = state.tracker;
  if (!tracker.kills.length && !tracker.gathered.length && !tracker.looted.length) return `<p class="hint">${tr ? 'Bu oturumda henüz öldürme, toplama ya da ganimet yok.' : 'No kills, gathering or loot this session yet.'}</p>`;
  const item = row => `<div class="line"><span class="name" title="#${row.item}">${esc(itemLabel(names, row.item, locale))}</span><b>${groupedNumber(row.count, locale)}</b></div>`;
  const kills = tracker.kills.map(row => `<div class="line"><span class="name" title="#${row.model}">${esc(row.name || `${tr ? 'Canavar' : 'Monster'} #${row.model}`)}</span><b>${row.count}</b></div>`).join('');
  const looted = tracker.looted.slice(0, 8).map(item).join(''), gathered = tracker.gathered.slice(0, 8).map(item).join('');
  return `${kills ? `<div class="group"><small>${tr ? 'ÖLDÜRÜLEN' : 'KILLED'} · ${tracker.kills_total}</small>${kills}</div>` : ''}${looted ? `<div class="group"><small>${tr ? 'GANİMET' : 'LOOT'}</small>${looted}</div>` : ''}${gathered ? `<div class="group"><small>${tr ? 'TOPLANAN' : 'GATHERED'}</small>${gathered}</div>` : ''}`;
}

// What you carry that the game counts as money, with the game's icon, and Odyle.
function currenciesPanel({ state, locale, now, names }) {
  const tr = locale !== 'en', odyle = resourceStatus(state.resources, now);
  const rows = state.currencies.map(row => `<div class="line"><span class="icon">${iconImg(itemIconPath(row.item), 22)}</span><span class="name" title="#${row.item}">${esc(itemLabel(names, row.item, locale))}</span><b>${groupedNumber(row.count, locale)}</b></div>`);
  if (odyle.available) rows.unshift(`<div class="line"><span class="icon">${iconImg(ticketIconPath(60_000_001), 22)}</span><span class="name">Odyle</span><b>${groupedNumber(odyle.total, locale)}</b></div>`);
  return rows.length ? `<div class="group">${rows.join('')}</div>` : `<p class="hint">${tr ? 'Envanter oyundan henüz gelmedi. Karakter seçerken ya da oyuna girerken gelir.' : 'No inventory from the game yet. It arrives when you log in.'}</p>`;
}

// Your own skills the game has told us the cooldown of: cooling ones first, soonest first.
function cooldownsPanel({ state, locale, now, label }) {
  const tr = locale !== 'en', team = automaticTeamState(state, { now }), me = team.members.find(member => member.is_self);
  const ready = row => row.kind === 'confirmed' || row.kind === 'available-charge';
  const rows = (me?.cooldowns || []).filter(row => row.kind !== 'unknown').sort((a, b) => Number(ready(a)) - Number(ready(b)) || (a.remaining_ms ?? Infinity) - (b.remaining_ms ?? Infinity)).slice(0, 10);
  if (!rows.length) return `<p class="hint">${tr ? 'Beceri bekleme süresi bilgisi henüz gelmedi. Bir beceri kullanınca görünür.' : 'No skill cooldown seen yet. It appears once you use a skill.'}</p>`;
  return `<div class="cooldowns">${rows.map(row => {
    const seconds = row.remaining_ms === null ? '—' : row.remaining_ms < 10_000 ? `${(row.remaining_ms / 1000).toFixed(1)} ${tr ? 'sn' : 's'}` : `${Math.ceil(row.remaining_ms / 1000)} ${tr ? 'sn' : 's'}`;
    const percent = row.cooldown_ms > 0 && row.remaining_ms !== null ? Math.min(100, row.remaining_ms / row.cooldown_ms * 100) : 0;
    return `<div class="cd" data-ready="${ready(row)}"><span class="icon">${iconImg(skillIconPath(Number(row.skill_id)), 26)}</span><span class="name">${esc(label(row.skill_id))}</span><time>${ready(row) ? (tr ? 'Hazır' : 'Ready') : esc(seconds)}</time><i class="bar"><u style="width:${(ready(row) ? 0 : percent).toFixed(1)}%"></u></i></div>`;
  }).join('')}</div>`;
}

// The effects on you the game shows: what takes control away first, then what harms, with the time left.
function effectsPanel({ state, locale, now }) {
  const tr = locale !== 'en', rows = ownEffects(state, now).slice(0, 14);
  if (!rows.length) return `<p class="hint">${tr ? 'Üzerinde gösterilecek etki yok.' : 'No effect on you to show.'}</p>`;
  const time = ms => ms === null ? '∞' : ms < 10_000 ? `${(ms / 1000).toFixed(1)} ${tr ? 'sn' : 's'}` : ms < 60_000 ? `${Math.ceil(ms / 1000)} ${tr ? 'sn' : 's'}` : spanText(ms);
  return `<div class="effects">${rows.map(row => {
    const kind = row.control ? 'control' : row.debuff ? 'debuff' : 'buff';
    const percent = row.remaining_ms !== null && row.duration_ms > 0 ? Math.min(100, row.remaining_ms / row.duration_ms * 100) : 100;
    return `<div class="effect" data-kind="${kind}" title="#${row.id}"><span class="icon">${iconImg(buffIconPath(row.id), 22)}</span><span class="name">${esc(row.name)}${row.control ? `<em>${esc(controlLabel(row.control, locale))}</em>` : ''}</span><time>${esc(time(row.remaining_ms))}</time><i class="bar"><u style="width:${percent.toFixed(1)}%"></u></i></div>`;
  }).join('')}</div>`;
}

// What opens next: the events that are open come first, then by time left.
function timersPanel({ events, locale, now }) {
  const tr = locale !== 'en';
  const rows = (Array.isArray(events) ? events : []).filter(event => event && event.enabled !== false).map(event => ({ event, timing: nextScheduledEvent(event, now) })).filter(row => row.timing)
    .sort((a, b) => Number(b.timing.status === 'open') - Number(a.timing.status === 'open') || a.timing.remainingMs - b.timing.remainingMs).slice(0, 10);
  if (!rows.length) return `<p class="hint">${tr ? 'Gösterilecek etkinlik zamanlayıcısı yok.' : 'No event timer to show.'}</p>`;
  return `<div class="timers">${rows.map(({ event, timing }) => {
    const open = timing.status === 'open';
    return `<div class="timer" data-open="${open}"><span class="name">${esc(event.name)}</span><small>${open ? (tr ? 'AÇIK' : 'OPEN') : ''}</small><time>${esc(countdown(timing.remainingMs))}</time></div>`;
  }).join('')}</div>`;
}
const countdown = milliseconds => { const total = Math.max(0, Math.ceil(milliseconds / 1000)), hours = Math.floor(total / 3600); return hours ? `${hours}:${String(Math.floor(total % 3600 / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };

// The time left to fly, drawn straight on the screen like the Hidden Cube: it is there only while the
// flight points are running out, with the seconds left, a bar and the points. While the windows are
// being placed a sample shows.
function flightPanel({ state, locale, marker = {} }) {
  const tr = locale !== 'en', real = state.flight, flying = Boolean(real) && real.drain_per_s !== null;
  if (!flying && marker.edit !== true) return '';
  const flight = flying ? real : { fp: 62_000, max: 100_000, drain_per_s: 1_500 };
  const fraction = flight.max ? Math.min(1, flight.fp / flight.max) : null, left = flight.fp / flight.drain_per_s;
  return `<div class="flyer" data-low="${left < 10}" data-sample="${!flying}"><div class="fly-main"><b class="fly-time">${clock(left * 1000)}</b><span class="fly-label">${tr ? 'UÇUŞ' : 'FLIGHT'}</span></div><i class="bar wide"><u style="width:${((fraction ?? 1) * 100).toFixed(1)}%"></u></i><small class="fly-points">${fraction === null ? esc(short(flight.fp)) : `${Math.round(fraction * 100)}% · ${esc(short(flight.fp))} / ${esc(short(flight.max))}`}</small></div>`;
}

// The health of what you fight: the target in focus, then bosses, each with its bar, percent and
// numbers. A value the game has not repeated lately is shown dimmed as the last one known.
function targetHealthPanel({ state, locale, now }) {
  const tr = locale !== 'en', seen = new Set();
  const rows = [state.live_target, ...state.personal_targets, ...state.party_targets].filter(target => {
    if (!target || seen.has(target.id)) return false;
    seen.add(target.id);
    return target.current_hp !== null;
  }).map(target => ({ target, vital: targetVital(target, now), live: target === state.live_target }))
    .sort((a, b) => Number(b.live) - Number(a.live) || Number(b.target.is_boss) - Number(a.target.is_boss) || b.target.damage - a.target.damage).slice(0, 4);
  if (!rows.length) return `<p class="hint">${tr ? 'Hedef bekleniyor. Bir hedefe vurunca canı burada görünür.' : 'Waiting for a target. Its health shows here once you hit one.'}</p>`;
  return `<div class="targets">${rows.map(({ target, vital }) => {
    const dead = vital.current === 0, percent = dead ? 0 : vital.max ? Math.min(100, vital.current / vital.max * 100) : null;
    return `<div class="target" data-dead="${dead}" data-stale="${vital.status === 'stale'}" data-boss="${target.is_boss}"><span class="name">${esc(target.name)}</span><b>${dead ? (tr ? 'Öldü' : 'Dead') : percent === null ? esc(short(vital.current)) : `${Number(percent.toFixed(percent < 10 ? 1 : 0))}%`}</b><i class="bar"><u style="width:${(percent ?? 100).toFixed(1)}%"></u></i>${vital.max && !dead ? `<small>${esc(short(vital.current))} / ${esc(short(vital.max))}</small>` : '<small></small>'}</div>`;
  }).join('')}</div>`;
}

// The skills as a bar of tiles in fixed places: the icon, a shade that drains as the cooldown runs
// and the seconds left; a ready skill is lit.
function actionBarPanel({ state, locale, now, label }) {
  const tr = locale !== 'en', team = automaticTeamState(state, { now }), me = team.members.find(member => member.is_self);
  const ready = row => row.kind === 'confirmed' || row.kind === 'available-charge';
  const rows = (me?.cooldowns || []).filter(row => row.kind !== 'unknown').sort((a, b) => Number(a.skill_id) - Number(b.skill_id)).slice(0, 18);
  if (!rows.length) return `<p class="hint">${tr ? 'Beceri bilgisi henüz gelmedi. Bir beceri kullanınca çubuk dolar.' : 'No skill seen yet. The bar fills as you use skills.'}</p>`;
  return `<div class="tiles">${rows.map(row => {
    const left = ready(row) || row.remaining_ms === null ? null : row.remaining_ms, share = left !== null && row.cooldown_ms > 0 ? Math.min(1, left / row.cooldown_ms) : 0;
    const seconds = left === null ? '' : left < 10_000 ? (left / 1000).toFixed(1) : String(Math.ceil(left / 1000));
    return `<div class="tile" data-ready="${left === null}" title="${esc(label(row.skill_id))}">${iconImg(skillIconPath(Number(row.skill_id)), 40)}<i style="height:${(share * 100).toFixed(1)}%"></i><b>${esc(seconds)}</b></div>`;
  }).join('')}</div>`;
}

// What others have just used: every player but you whose skill the game announced with its
// cooldown, the most recently active first, with the time each skill still has to run.
function rivalsPanel({ state, locale, now, label }) {
  const tr = locale !== 'en', self = String(state.local_player_id ?? ''), allies = new Set((Array.isArray(state.party_member_ids) ? state.party_member_ids : []).map(String));
  const people = new Map((Array.isArray(state.players) ? state.players : []).map(player => [String(player.id), player]));
  const groups = new Map();
  for (const row of Array.isArray(state.actor_cooldowns) ? state.actor_cooldowns : []) {
    const actorNumber = Number(row.actor_id), id = actorNumber > 0 ? String(actorNumber) : '', skill = Number(row.skill_id), total = Number(row.cooldown_ms), remaining = Number(row.remaining_ms), sampled = Number(row.sampled_at_ms);
    if (!id || id === self || !Number.isInteger(skill) || skill < 11_000_000 || skill >= 20_000_000 || !(total > 0 && total <= 3_600_000) || !Number.isFinite(remaining)) continue;
    const left = remaining - (Number.isFinite(sampled) && now > sampled ? Math.min(now - sampled, 600_000) : 0);
    if (left <= 0) continue;
    const group = groups.get(id) || { id, tiles: [], seen: 0 };
    group.tiles.push({ skill, left, total });
    group.seen = Math.max(group.seen, Number(row.observed_at_ms) || 0);
    groups.set(id, group);
  }
  const actors = [...groups.values()].sort((a, b) => b.seen - a.seen).slice(0, 3);
  if (!actors.length) return `<p class="hint">${tr ? 'Başkalarının kullandığı beceriler ve bekleme süreleri burada görünür.' : 'The skills others use, and their cooldowns, show here.'}</p>`;
  return actors.map(actor => {
    const person = people.get(actor.id), ally = allies.has(actor.id);
    const tiles = actor.tiles.sort((a, b) => a.left - b.left || a.skill - b.skill).slice(0, 10).map(tile => {
      const seconds = tile.left < 10_000 ? (tile.left / 1000).toFixed(1) : String(Math.ceil(tile.left / 1000));
      return `<div class="tile" data-ready="false" title="${esc(label(tile.skill))}">${iconImg(skillIconPath(tile.skill), 40)}<i style="height:${(Math.min(1, tile.left / tile.total) * 100).toFixed(1)}%"></i><b>${esc(seconds)}</b></div>`;
    }).join('');
    return `<section class="rival" data-ally="${ally}"><header><b>${esc(person?.name || `#${actor.id}`)}</b><small>${esc([person?.class_name, ally ? (tr ? 'Müttefik' : 'Ally') : (tr ? 'Rakip' : 'Opponent')].filter(Boolean).join(' · '))}</small></header><div class="tiles">${tiles}</div></section>`;
  }).join('');
}

// The open world with you in the middle: the game's own map picture, your heading, your party and
// the others that are near. A click on it changes how many metres it shows.
export const MAP_RANGES = Object.freeze([400, 1000, 2500]);
function mapPanel({ state, locale, now, mapRange = 1000 }) {
  const tr = locale !== 'en', selfId = liveServerActorId(state), range = MAP_RANGES.includes(mapRange) ? mapRange : 1000;
  const data = state.spatial, positions = data.positions.filter(point => point.map_id === data.map_id);
  // Your position comes only every few seconds (more rarely while walking): the last one stays on the
  // map, dimmed once it is old, and goes only when you leave the place or it is half an hour old.
  const me = selfId === null ? undefined : positions.filter(point => point.actor_id === selfId && point.present && point.epoch === data.epoch).sort((a, b) => b.at_ms - a.at_ms)[0];
  if (!me || now < me.at_ms || now - me.at_ms > 1_800_000) return `<p class="hint">${tr ? 'Konumun henüz gelmedi. Hareket edince harita görünür.' : 'Your position has not arrived yet. The map shows once you move.'}</p>`;
  const map = worldMap(data.map_id);
  const place = `${Math.round(me.x / 100)}, ${Math.round(me.y / 100)} m`;
  if (!map) return `<p class="hint">${tr ? `Bu alanın haritası yok (alan ${data.map_id ?? '?'}).` : `This area has no map (area ${data.map_id ?? '?'}).`}</p><p class="hint">${esc(place)}</p>`;
  const at = mapPoint(map, me.x, me.y);
  if (!at) return `<p class="hint">${tr ? 'Konum harita dışında.' : 'The position is off the map.'}</p><p class="hint">${esc(place)}</p>`;
  const age = now - me.at_ms, old = age > 15_000, across = (map.maxX - map.minX) / 100;
  const names = new Map(data.actors.map(actor => [`${actor.actor_id}:${actor.generation}`, actor]));
  const allies = new Set((Array.isArray(state.party_member_ids) ? state.party_member_ids : []).map(String));
  const latest = new Map();
  for (const point of positions) if (point.actor_id !== selfId && point.present && point.epoch === me.epoch && point.at_ms <= now && now - point.at_ms <= 15_000 && (!latest.has(point.actor_id) || point.at_ms >= latest.get(point.actor_id).at_ms)) latest.set(point.actor_id, point);
  const dots = [...latest.values()].map(point => ({ point, dx: (point.x - me.x) / 100, dy: (point.y - me.y) / 100, meta: names.get(`${point.actor_id}:${point.generation}`) || {} }))
    .filter(row => Math.abs(row.dx) <= range * .55 && Math.abs(row.dy) <= range * .55).slice(0, 60).map(({ point, dx, dy, meta }) => {
      const kind = allies.has(point.actor_id) ? 'party' : meta.kind === 'player' ? 'player' : 'npc';
      return `<i class="dot ${kind}" data-stale="${now - point.at_ms > 5000}" style="left:${(50 + dx / range * 100).toFixed(2)}%;top:${(50 + dy / range * 100).toFixed(2)}%" title="${esc(meta.name || '')}"></i>`;
    }).join('');
  const turn = heading(data.track, selfId);
  const arrow = turn === null ? '<i class="me still"></i>' : `<svg class="me" viewBox="0 0 100 100" style="transform:translate(-50%,-50%) rotate(${turn}deg)" aria-hidden="true"><path d="M50 6 80 90 50 70 20 90z"/></svg>`;
  const ago = old ? ` · ${age < 90_000 ? `${Math.round(age / 1000)} ${tr ? 'sn önce' : 's ago'}` : `${Math.round(age / 60_000)} ${tr ? 'dk önce' : 'min ago'}`}` : '';
  return `<div class="map" data-range="${range}"><div class="map-view" data-old="${old}" title="${tr ? 'Yakınlaştırmak için tıkla' : 'Click to change the zoom'}"><img class="world" src="${esc(map.image)}" alt="" draggable="false" style="width:${(across / range * 100).toFixed(2)}%;transform:translate(-${(at.u * 100).toFixed(3)}%,-${(at.v * 100).toFixed(3)}%)">${dots}${arrow}</div><div class="map-foot"><b>${esc(map.name)}</b><span>${range < 1000 ? `${range} m` : `${range / 1000} km`}</span><time>${esc(place + ago)}</time></div></div>`;
}

// The connection as a small pill: bars that fill with a good one, and the round-trip time.
function pingPanel({ state, locale, now, marker = {} }) {
  const ping = latencyPresentation(state.capture?.status === 'capturing' ? state.capture.network_latency : { status: 'unavailable' }, { now, locale });
  const ms = ping.fresh ? ping.rtt_ms : marker.edit === true ? 42 : null;
  const level = ms === null ? 0 : ms <= 60 ? 4 : ms <= 100 ? 3 : ms <= 160 ? 2 : 1;
  const tone = ms === null ? 'idle' : ms <= 100 ? 'good' : ms <= 160 ? 'fair' : 'poor';
  return `<div class="ping" data-tone="${tone}" title="${esc(ping.detail)}"><span class="signal">${[1, 2, 3, 4].map(step => `<i data-on="${step <= level}" style="height:${4 + step * 3}px"></i>`).join('')}</span><b>${ms === null ? '—' : ms}</b><small>ms</small></div>`;
}

// The window that opens the others: every detached window as a button, and what they share. It is
// drawn from what the controls window read (which are open, the look settings, the lock).
function controlsPanel({ controls, locale }) {
  const tr = locale !== 'en', open = new Set(controls?.open || []), option = controls?.options || {}, locked = controls?.locked === true;
  const toggles = PANELS.filter(name => name !== 'controls').map(name => `<button type="button" class="ctl-toggle" data-panel="${name}" aria-pressed="${open.has(name)}">${esc(PANEL_TITLES[name][tr ? 0 : 1])}</button>`).join('');
  const segment = (key, choices, current) => `<div class="ctl-seg">${choices.map(([value, text]) => `<button type="button" data-pref="${key}" data-value="${value}" aria-pressed="${String(current) === String(value)}">${text}</button>`).join('')}</div>`;
  const slider = (key, label, low, high, value) => `<label class="ctl-row"><span>${label}</span><input type="range" min="${low}" max="${high}" step="5" value="${value}" data-slider="${key}"><output>${value}%</output></label>`;
  const scale = Math.round((Number(option.scale) || 1) * 100), opacity = Math.round((Number(option.opacity) || .88) * 100);
  return `<div class="ctl"><h4>${tr ? 'Pencereler' : 'Windows'}</h4><div class="ctl-grid">${toggles}</div>
<h4>${tr ? 'Tüm pencereler' : 'All windows'}</h4>${slider('overlayScale', tr ? 'Ölçek' : 'Scale', 80, 160, scale)}${slider('opacity', tr ? 'Saydamlık' : 'Opacity', 40, 100, opacity)}
<div class="ctl-row"><span>${tr ? 'Yenileme' : 'Update'}</span>${segment('overlayRate', [[250, '250 ms'], [500, '500 ms'], [1000, '1 s']], option.rate ?? 250)}</div>
<button type="button" class="ctl-toggle" data-toggle="overlaySnap" aria-pressed="${option.snap === true}">${tr ? 'Izgaraya oturt' : 'Snap to grid'}</button>
<h4>${tr ? 'Savaş algılama' : 'Combat detection'}</h4>${segment('source', [['game', tr ? 'Oyun söylediğinde' : 'The game says so'], ['hits', tr ? 'Vurduğumda' : 'When I hit']], option.source ?? 'game')}
${segment('seconds', [[5, '5 s'], [10, '10 s'], [20, '20 s'], [30, '30 s'], [60, '60 s']], option.seconds ?? 10)}
<div class="ctl-foot"><button type="button" data-action="lock" aria-pressed="${locked}">${locked ? (tr ? 'Kilidi aç' : 'Unlock') : (tr ? 'Kilitle' : 'Lock')}</button><button type="button" data-action="reload">${tr ? 'Yenile' : 'Refresh'}</button><button type="button" data-action="open-app">${tr ? 'Uygulamada aç' : 'Open app'}</button></div>
<div class="ctl-foot"><button type="button" class="primary" data-action="done">${tr ? 'Bitti' : 'Done'}</button></div></div>`;
}

export function renderPanel(panel, input) {
  const context = { label: id => `#${id}`, now: Date.now(), locale: 'tr', names: {}, caps: {}, ...input };
  return { damage: damagePanel, pvp: pvpPanel, vitals: vitalsPanel, cube: cubePanel, party: partyPanel, tickets: ticketsPanel, tracker: trackerPanel, cooldowns: cooldownsPanel, currencies: currenciesPanel, effects: effectsPanel, timers: timersPanel, flight: flightPanel, bosshp: targetHealthPanel, actions: actionBarPanel, rivals: rivalsPanel, map: mapPanel, ping: pingPanel, controls: controlsPanel }[panelName(panel)](context);
}

