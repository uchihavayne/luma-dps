// The game's own combat state, a boss's frenzy countdown and the local player's health, as the
// engine reports them. Everything is bounded and survives garbage; a missing value stays null.
const count = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), max) : null;

// How an encounter ends: "hits" (a quiet spell after the last hit) or "game" (the game's own
// combat state), and the wait in seconds. The desktop shell rejects anything else.
export function normalizeCombatDetection(value) {
  value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const seconds = Number(value.seconds);
  return { source: value.source === 'game' ? 'game' : 'hits', seconds: Number.isFinite(seconds) ? Math.min(300, Math.max(5, Math.round(seconds))) : 10 };
}

export function normalizeCombat(value) {
  value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const tail = count(value.tail_ms, 300_000);
  return {
    source: value.source === 'game' ? 'game' : 'hits',
    tail_ms: tail === null ? 10_000 : Math.max(5_000, tail),
    game_in_combat: typeof value.game_in_combat === 'boolean' ? value.game_in_combat : null,
  };
}

// The frenzy applies at `at_ms` on this computer's clock.
export function normalizeFrenzy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const at = count(value.at_ms, Number.MAX_SAFE_INTEGER);
  if (!at) return null;
  const name = typeof value.target_name === 'string' ? value.target_name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) : '';
  return { target_id: count(value.target_id, Number.MAX_SAFE_INTEGER), target_name: name || null, at_ms: at };
}

export function normalizeOwnHealth(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const hp = count(value.hp, 1e12), max = count(value.max_hp, 1e12);
  if (hp === null) return null;
  return { hp, max_hp: max && max >= hp ? max : null, observed_at_ms: count(value.observed_at_ms, Number.MAX_SAFE_INTEGER) ?? 0 };
}

// "Öfke 1:05" until it applies, "Öfke!" for a few seconds once it has. The chip warns in the last
// thirty seconds. Null when there is nothing to show.
export function frenzyLabel(frenzy, { locale = 'tr', now = Date.now() } = {}) {
  if (!frenzy) return null;
  const left = frenzy.at_ms - now;
  if (left < -5_000 || left > 3_600_000) return null;
  const word = locale === 'en' ? 'Frenzy' : 'Öfke';
  if (left <= 0) return { text: `${word}!`, clock: locale === 'en' ? 'NOW' : 'ŞİMDİ', urgent: true, seconds: 0 };
  const total = Math.ceil(left / 1000), clock = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return { text: `${word} ${clock}`, clock, urgent: total <= 30, seconds: total };
}

// Fraction of health left, only when the maximum is known.
export function healthFraction(health) {
  return health && health.max_hp ? Math.max(0, Math.min(1, health.hp / health.max_hp)) : null;
}
