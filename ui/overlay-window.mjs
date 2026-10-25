// A detached panel window. It shows one panel and only reads: the meter's state and the Cube state
// arrive the same way the meter gets them, and nothing here saves a preference.
import { normalizePreferences, normalizeState } from './model.mjs';
import { allEvents } from './events.mjs';
import { cubePresentation } from './cube.mjs';
import { skillLabel } from './skill-names.mjs';
import { DEMO_STATE } from './demo.mjs';
import { MAP_RANGES, PANEL_TITLES, panelName, renderPanel } from './overlay-panels.mjs';

const params = new URLSearchParams(location.search);
// The page address names the panel; the window's own label is the fallback.
const labelPanel = String(window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label || '').replace(/^overlay-/, '');
const panel = panelName(params.get('panel') || labelPanel);
const tauri = window.__TAURI__;
const native = Boolean(tauri?.core?.invoke);
const demo = !native && params.get('demo') === '1';
const invoke = (command, args) => tauri.core.invoke(command, args);
const $ = selector => document.querySelector(selector);

// The browser preview (?demo=1) shows fixtures; the app shows nothing until the game has said something.
const DEMO_CUBE = { enabled: false, network: { cubes: 2, distance_m: 42, vertical_m: 3, direction_deg: 35, fix_age_s: 2, look: 'gold', bearing_deg: 90, live: true, age_s: 12 } };
let locale = params.get('lang') === 'en' ? 'en' : 'tr';
let names = {}, caps = {}, events = [], shown = null, scale = 1, rateMs = 250, optionsSent = '', mapRange = 1000, locked = false, holding = false, controlsOpen = [], controlsOptions = {}, markerPrefs = { enabled: true, needKeys: false }, editing = false;
const marker = ['cube', 'ping', 'flight'].includes(panel);
document.body.classList.toggle('marker', marker);
document.body.dataset.panel = panel;
let raw = demo ? DEMO_STATE : {}, cubeRaw = demo ? DEMO_CUBE : {}, state = normalizeState(raw), fresh = true, lastEvent = 0;

function applyTitle() {
  const title = PANEL_TITLES[panel][locale === 'en' ? 1 : 0];
  $('#panel-title').textContent = title; document.title = `Luma · ${title}`; document.documentElement.lang = locale;
  $('#panel-close').setAttribute('aria-label', locale === 'en' ? 'Close' : 'Kapat');
  $('#panel-reload').setAttribute('aria-label', locale === 'en' ? 'Refresh' : 'Yenile'); $('#panel-reload').title = locale === 'en' ? 'Refresh' : 'Yenile';
  $('#panel-resize').setAttribute('aria-label', locale === 'en' ? 'Resize' : 'Boyutlandır');
  $('#edit-hint').textContent = `${title} · ${locale === 'en' ? 'drag it where you want it' : 'istediğin yere sürükle'}`;
  $('#edit-done').textContent = locale === 'en' ? 'Done' : 'Bitti';
}

// The browser preview of the Map window: a player walking north-east across Verteron with a party member near.
function demoMapState(now) {
  const at = (actor, x, y, patch = {}) => ({ actor_id: actor, generation: 0, map_id: 1010, epoch: 1, x, y, z: 0, at_ms: now - 300, present: true, source: 'server-position', ...patch });
  return { local_player_id: 7, local_identity_source: 'server', party_member_ids: [7, 8], spatial: { map_id: 1010, epoch: 1, sampled_at_ms: now,
    actors: [{ actor_id: 8, generation: 0, name: 'Friend', class_name: 'Cleric', kind: 'player' }, { actor_id: 9, generation: 0, name: 'Stranger', class_name: 'Ranger', kind: 'player' }],
    positions: [at(7, 52_000, -91_000), at(8, 56_000, -88_000), at(9, 48_000, -97_000)], track: [at(7, 51_000, -90_000, { at_ms: now - 4_000 }), at(7, 52_000, -91_000)], aims: [], retention_limited: false } };
}

function render() {
  if (demo && panel === 'map') { raw = demoMapState(Date.now()); fresh = true; }
  if (fresh) { state = normalizeState(raw); fresh = false; }
  const now = Date.now();
  const html = renderPanel(panel, { state, cube: cubePresentation(cubeRaw, { now, locale, live: !demo }), locale, now, names, caps, events, shown, mapRange, controls: { open: controlsOpen, options: controlsOptions, locked }, marker: { ...markerPrefs, edit: editing }, label: skillLabel });
  const content = $('#panel-content');
  // A slider that is being dragged is not redrawn under the hand.
  if (holding && panel === 'controls') return;
  if (content._html !== html) { content.innerHTML = html; content._html = html; contentRevision += 1; }
  requestAnimationFrame(scaleToFit);
}

// A window can be made any size by hand: its content is laid out at a width of its own and scaled to
// the room it has, so made smaller it shrinks and still shows every row, made bigger it grows. Nothing
// is cut, scrolled away or pulled back.
const DESIGN_WIDTH = { tickets: 340, party: 380, damage: 340, controls: 340, map: 300, cooldowns: 300, actions: 300, rivals: 300 };
let contentRevision = 0, fittedKey = '';
function scaleToFit() {
  if (marker) return;
  const body = $('#panel-body'), content = $('#panel-content'), look = getComputedStyle(body);
  const room = { width: body.clientWidth - parseFloat(look.paddingLeft) - parseFloat(look.paddingRight), height: body.clientHeight - parseFloat(look.paddingTop) - parseFloat(look.paddingBottom) };
  if (!(room.width > 0 && room.height > 0)) return;
  const key = `${panel}:${contentRevision}:${Math.round(room.width)}x${Math.round(room.height)}`;
  if (key === fittedKey) return;
  fittedKey = key;
  const design = DESIGN_WIDTH[panel] ?? 290;
  content.style.zoom = '1'; content.style.width = `${design}px`; content.style.alignSelf = 'center';
  const natural = Math.max(1, content.offsetHeight);
  const zoom = Math.min(2.2, Math.max(0.45, Math.min(room.width / design, room.height / natural)));
  content.style.zoom = String(zoom);
  // Only at the smallest scale may anything be left to scroll to.
  body.style.overflowY = zoom <= 0.46 ? 'auto' : 'hidden';
}
new ResizeObserver(() => requestAnimationFrame(scaleToFit)).observe($('#panel-body'));

async function pull() {
  try { raw = await invoke('get_state'); fresh = true; lastEvent = Date.now(); } catch {}
  if (panel === 'cube') { try { cubeRaw = await invoke('get_cube_state'); } catch {} }
}
async function pullPreferences() {
  try {
    const prefs = normalizePreferences(await invoke('get_preferences'));
    locale = prefs.locale === 'en' ? 'en' : 'tr';
    names = prefs.idNames;
    caps = prefs.idCaps;
    shown = prefs.ticketShow;
    events = panel === 'timers' ? allEvents(prefs) : [];
    rateMs = prefs.overlayRate;
    scale = marker || panel === 'controls' ? 1 : prefs.overlayScale;
    const options = JSON.stringify([prefs.overlaySnap ? 20 : 0, scale]);
    if (options !== optionsSent) { optionsSent = options; invoke('overlay_options', { snap: prefs.overlaySnap ? 20 : 0, scale }).catch(() => { optionsSent = ''; }); }
    markerPrefs = { enabled: prefs.showCubeLocator, needKeys: prefs.cubeNeedKeys };
    if (!holding) controlsOptions = { scale: prefs.overlayScale, opacity: prefs.opacity, rate: prefs.overlayRate, snap: prefs.overlaySnap, source: prefs.combatDetection.source, seconds: prefs.combatDetection.seconds };
    document.documentElement.style.setProperty('--alpha', String(Math.min(1, Math.max(0.4, prefs.opacity))));
    applyTitle();
  } catch {}
}
async function listen(name, handler) { try { await tauri.event?.listen(name, handler); } catch {} }

$('#panel-drag').addEventListener('pointerdown', event => { if (native && event.button === 0 && !event.target.closest('button')) invoke('overlay_drag').catch(() => {}); });
// While the Cube marker is being placed, a press anywhere on it drags it; Done gives the clicks back to the game.
document.addEventListener('pointerdown', event => { if (native && marker && editing && event.button === 0 && !event.target.closest('button')) invoke('overlay_drag').catch(() => {}); });
$('#edit-done').addEventListener('click', () => { if (native) invoke('overlay_controls', { open: false }).catch(() => {}); });
$('#panel-content').addEventListener('click', event => { if (panel === 'map' && event.target.closest('.map-view')) { mapRange = MAP_RANGES[(MAP_RANGES.indexOf(mapRange) + 1) % MAP_RANGES.length]; render(); } });
const reloadWindow = () => location.reload();
$('#panel-reload').addEventListener('click', reloadWindow);
function setLocked(value) {
  locked = value === true;
  document.body.classList.toggle('locked', locked && panel !== 'controls' && !marker);
  // An unlocked marker is being placed: it shows a sample, a dashed edge, and a press drags it.
  editing = marker && !locked;
  document.body.classList.toggle('editing', editing);
  render();
}
// The controls window changes a few look settings; the meter window saves them.
function changePreference(key, value) {
  const names = { overlayScale: 'scale', opacity: 'opacity', overlayRate: 'rate', overlaySnap: 'snap' };
  let patch;
  if (key === 'combat') { controlsOptions = { ...controlsOptions, ...value }; patch = { combatDetection: { source: controlsOptions.source, seconds: controlsOptions.seconds } }; }
  else { controlsOptions = { ...controlsOptions, [names[key]]: value }; patch = { [key]: value }; }
  invoke('overlay_preference', { patch }).catch(() => {});
  render();
}
async function readOpen() { try { controlsOpen = await invoke('list_overlays'); } catch {} }
$('#panel-content').addEventListener('click', async event => {
  const button = panel === 'controls' ? event.target.closest('button') : null;
  if (!button || !native) return;
  const { panel: name, pref, value, toggle, action } = button.dataset;
  if (name) { try { controlsOpen = await invoke('set_overlay', { panel: name, open: !controlsOpen.includes(name) }); } catch {} render(); }
  else if (pref === 'overlayRate') changePreference('overlayRate', Number(value));
  else if (pref === 'source') changePreference('combat', { source: value });
  else if (pref === 'seconds') changePreference('combat', { seconds: Number(value) });
  else if (toggle === 'overlaySnap') changePreference('overlaySnap', controlsOptions.snap !== true);
  else if (action === 'reload') invoke('overlay_reload').catch(() => {});
  else if (action === 'open-app') invoke('overlay_show_main').catch(() => {});
  else if (action === 'done') invoke('overlay_controls', { open: false }).catch(() => {});
  else if (action === 'lock') invoke('overlay_lock', { locked: !locked }).catch(() => {});
});
$('#panel-content').addEventListener('input', event => {
  const slider = panel === 'controls' ? event.target.closest('[data-slider]') : null;
  if (!slider || !native) return;
  const percent = Number(slider.value);
  slider.nextElementSibling.textContent = `${percent}%`;
  changePreference(slider.dataset.slider, percent / 100);
});
$('#panel-content').addEventListener('pointerdown', event => { if (event.target.closest('[data-slider]')) holding = true; });
addEventListener('pointerup', () => { if (holding) { holding = false; render(); } });
addEventListener('pointercancel', () => { holding = false; });
$('#panel-close').addEventListener('click', () => { if (native) invoke('set_overlay', { panel, open: false }).catch(() => {}); });
$('#panel-resize').addEventListener('pointerdown', event => { if (native && event.button === 0) { event.preventDefault(); invoke('overlay_resize').catch(() => {}); } });

applyTitle();
if (native) {
  listen('luma-state', event => { raw = event.payload; fresh = true; lastEvent = Date.now(); });
  listen('luma-cube-state', event => { cubeRaw = event.payload; });
  listen('luma-overlay-lock', event => setLocked(event.payload));
  invoke('overlay_locked').then(setLocked).catch(() => {});
  if (panel === 'controls') { readOpen(); setInterval(readOpen, 1500); }
  listen('luma-marker-edit', event => { editing = event.payload === true; document.body.classList.toggle('editing', editing); render(); });
  pull(); pullPreferences();
  // Events normally arrive several times a second; asking is only the fallback.
  setInterval(() => { if (Date.now() - lastEvent > 3000) pull(); }, 1000);
  setInterval(pullPreferences, 10000);
}
render();
(function tick() { render(); setTimeout(tick, rateMs); })();
