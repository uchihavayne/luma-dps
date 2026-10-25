// The effects on the local player the game shows, and the ones that take control away (stun,
// knockdown, airborne, fear, paralysis, sleep). Names and the control each effect applies come from
// the game catalog; an effect the catalog does not show is left out rather than guessed.
import { scopedEffects } from './assistance.mjs';
import { buffInfo } from './catalog.mjs';

export const CONTROL_LABELS = Object.freeze({
  stun: ['Sersemletme', 'Stun'], knockdown: ['Yere devirme', 'Knockdown'], airborne: ['Havaya kalkma', 'Airborne'],
  fear: ['Korku', 'Fear'], paralysis: ['Felç', 'Paralysis'], sleep: ['Uyku', 'Sleep'],
});

// Active effects on you, control first, then what harms, then by time left (the ones with no end last).
export function ownEffects(state, now = Date.now()) {
  const byId = new Map();
  for (const effect of scopedEffects(state, 'personal', now)) {
    const id = Number(effect.effect_id), info = Number.isSafeInteger(id) ? buffInfo(id) : null;
    if (!info) continue;
    const remaining = effect.persistent || effect.expires_ms === null ? null : Math.max(0, effect.expires_ms - now);
    const row = { id, name: info.name, control: info.control, debuff: info.debuff, persistent: remaining === null, remaining_ms: remaining, duration_ms: effect.duration_ms };
    const earlier = byId.get(id);
    // The same effect applied twice is one row, the one that lasts longer.
    if (!earlier || (earlier.remaining_ms !== null && (row.remaining_ms === null || row.remaining_ms > earlier.remaining_ms))) byId.set(id, row);
  }
  const left = row => row.remaining_ms ?? Infinity;
  return [...byId.values()].sort((a, b) => Number(Boolean(b.control)) - Number(Boolean(a.control)) || Number(b.debuff) - Number(a.debuff) || left(a) - left(b) || a.id - b.id).slice(0, 24);
}

// The control effect that ends last: you are out of control until it does.
export function controlLoss(rows) {
  const controls = rows.filter(row => row.control);
  return controls.length ? controls.reduce((last, row) => (row.remaining_ms ?? Infinity) > (last.remaining_ms ?? Infinity) ? row : last) : null;
}

export const controlLabel = (control, locale = 'tr') => CONTROL_LABELS[control]?.[locale === 'en' ? 1 : 0] ?? control;
