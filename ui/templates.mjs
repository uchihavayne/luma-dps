// Ready-made sets of detached windows: one click opens what a kind of play needs and closes the rest.
import { PANELS } from './overlay-panels.mjs';

export const TEMPLATES = Object.freeze({
  essentials: Object.freeze(['vitals', 'cube']),
  raid: Object.freeze(['bosshp', 'vitals', 'actions', 'effects', 'cube']),
  pvp: Object.freeze(['pvp', 'actions', 'rivals', 'effects', 'vitals', 'cube']),
  minimal: Object.freeze(['cube']),
});

export const TEMPLATE_LABELS = Object.freeze({ essentials: ['Temel', 'Essentials'], raid: ['Baskın', 'Raid'], pvp: ['PvP', 'PvP'], minimal: ['Sade', 'Minimal'] });

// Every window with whether it should be open: the template's panels open, the others closed.
export function templatePlan(name) {
  const wanted = Object.hasOwn(TEMPLATES, name) ? TEMPLATES[name] : null;
  return wanted ? PANELS.map(panel => ({ panel, open: wanted.includes(panel) })) : [];
}
