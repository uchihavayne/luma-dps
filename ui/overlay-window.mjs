// A detached panel window. It shows one panel and only reads: the meter's state and the Cube state
// arrive the same way the meter gets them, and nothing here saves a preference.
import { normalizePreferences, normalizeState } from './model.mjs';
import { cubePresentation } from './cube.mjs';
import { skillLabel } from './skill-names.mjs';
import { DEMO_STATE } from './demo.mjs';
import { PANEL_TITLES, panelName, renderPanel } from './overlay-panels.mjs';

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
let names = {};
let raw = demo ? DEMO_STATE : {}, cubeRaw = demo ? DEMO_CUBE : {}, state = normalizeState(raw), fresh = true, lastEvent = 0;

function applyTitle() {
  const title = PANEL_TITLES[panel][locale === 'en' ? 1 : 0];
  $('#panel-title').textContent = title; document.title = `Luma · ${title}`; document.documentElement.lang = locale;
  $('#panel-close').setAttribute('aria-label', locale === 'en' ? 'Close' : 'Kapat');
  $('#panel-resize').setAttribute('aria-label', locale === 'en' ? 'Resize' : 'Boyutlandır');
}

function render() {
  if (fresh) { state = normalizeState(raw); fresh = false; }
  const now = Date.now();
  const html = renderPanel(panel, { state, cube: cubePresentation(cubeRaw, { now, locale, live: !demo }), locale, now, names, label: skillLabel });
  const body = $('#panel-body');
  if (body._html !== html) { body.innerHTML = html; body._html = html; }
}

async function pull() {
  try { raw = await invoke('get_state'); fresh = true; lastEvent = Date.now(); } catch {}
  if (panel === 'cube') { try { cubeRaw = await invoke('get_cube_state'); } catch {} }
}
async function pullPreferences() {
  try {
    const prefs = normalizePreferences(await invoke('get_preferences'));
    locale = prefs.locale === 'en' ? 'en' : 'tr';
    names = prefs.idNames;
    document.documentElement.style.setProperty('--alpha', String(Math.min(1, Math.max(0.4, prefs.opacity))));
    applyTitle();
  } catch {}
}
async function listen(name, handler) { try { await tauri.event?.listen(name, handler); } catch {} }

$('#panel-drag').addEventListener('pointerdown', event => { if (native && event.button === 0 && !event.target.closest('button')) invoke('overlay_drag').catch(() => {}); });
$('#panel-close').addEventListener('click', () => { if (native) invoke('set_overlay', { panel, open: false }).catch(() => {}); });
$('#panel-resize').addEventListener('pointerdown', event => { if (native && event.button === 0) { event.preventDefault(); invoke('overlay_resize').catch(() => {}); } });

applyTitle();
if (native) {
  listen('luma-state', event => { raw = event.payload; fresh = true; lastEvent = Date.now(); });
  listen('luma-cube-state', event => { cubeRaw = event.payload; });
  pull(); pullPreferences();
  // Events normally arrive several times a second; asking is only the fallback.
  setInterval(() => { if (Date.now() - lastEvent > 3000) pull(); }, 1000);
  setInterval(pullPreferences, 10000);
}
render();
setInterval(render, 250);
