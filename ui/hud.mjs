export const HUD_PANELS = Object.freeze(['pets', 'events', 'team', 'odyle']);

export function normalizeHudPanels(input) {
  return [...new Set((Array.isArray(input) ? input : []).filter(name => HUD_PANELS.includes(name)))];
}

// Collection/capture and visibility are independent. Hiding a panel never stops
// packet processing, the collection cache, cooldowns or Cube listening.
export function hudPanelVisible(preferences, name) {
  if (preferences?.displayModules?.[name] === false) return false;
  const petOnly = preferences?.displayModules?.pets === true && preferences?.displayModules?.dps === false && Object.entries(preferences.displayModules).every(([key, value]) => key === 'pets' || value === false);
  return preferences?.layout !== 'cupertino' || name === 'pets' && petOnly || normalizeHudPanels(preferences?.hudPanels).includes(name);
}

export function hudPanelChange(preferences, name, visible) {
  if (!HUD_PANELS.includes(name)) return {};
  const panels = new Set(normalizeHudPanels(preferences?.hudPanels));
  if (visible) panels.add(name); else panels.delete(name);
  return { hudPanels: [...panels], ...(visible ? { displayModules: { ...preferences?.displayModules, [name]: true } } : {}) };
}

export function previewFrame(input) {
  const match = typeof input === 'string' && /^(\d{3,4})x(\d{3,4})$/.exec(input);
  if (!match) return null;
  const width = Number(match[1]), height = Number(match[2]);
  return width >= 320 && width <= 1600 && height >= 200 && height <= 1600 ? { width, height } : null;
}

const classes = new Set(['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'spiritmaster', 'cleric', 'chanter', 'brawler']);
const actorKey = value => value === null || value === undefined ? '' : String(value);

// An amount alone does not identify a player. Unbound periodic sources stay in
// the encounter/analysis data; they must not fill the HUD with anonymous rows.
export function mainRoster(players = [], state = {}, { scope = 'observed', ranked = false } = {}) {
  const party = new Set((state.party_member_ids || []).map(actorKey));
  const live = state.live_team_identity;
  const sameParty = !live || live.party_membership_source === 'server'
    && (live.party_member_ids || []).length === party.size && (live.party_member_ids || []).every(id => party.has(actorKey(id)));
  const currentParty = state.encounter_active === true && state.party_membership_source === 'server'
    && state.party_identity_roster?.source === 'server' && sameParty;
  const members = currentParty ? state.party_identity_roster.members || [] : [];
  const metadata = new Map(members.filter(row => row.identity_confirmed === true && party.has(actorKey(row.actor_id))).map(row => [actorKey(row.actor_id), row]));
  const retained = [], hidden = [];
  for (const original of players) {
    const id = actorKey(original.id), member = metadata.get(id);
    const row = member ? { ...original, name: member.name || original.name, class_name: member.class_name || original.class_name, identity_confirmed: true, identity_pending: false, in_party: true } : original;
    const identified = row.identity_confirmed === true || row.is_local === true || row.in_party === true
      || state.party_membership_source === 'server' && party.has(id)
      || classes.has(String(row.class_name).toLowerCase().replace(/\s/g, ''));
    (identified ? retained : hidden).push(row);
  }
  if (!ranked && scope !== 'personal' && currentParty) {
    const seen = new Set(retained.map(row => actorKey(row.id)));
    members.slice(0, 12).forEach((member, index) => {
      const bound = member.identity_confirmed === true && party.has(actorKey(member.actor_id));
      const id = bound ? actorKey(member.actor_id) : `party-slot:${index}`;
      if (!member.name || seen.has(id)) return;
      seen.add(id);
      retained.push({ id, name: member.name, class_name: member.class_name || 'Unknown',
        identity_confirmed: bound, identity_pending: false, in_party: true, is_local: id === actorKey(state.local_player_id),
        damage: bound ? 0 : null, dps: bound ? 0 : null, skills: [], pending_actor: !bound });
    });
  }
  return { players: retained, unclassifiedCount: hidden.length, unclassifiedDamage: hidden.reduce((sum, row) => sum + (row.damage || 0), 0) };
}

export function rosterFit({ count = 0, height = 0, width = 320, scale = 1, density = 'compact', both = true, details = false } = {}) {
  count = Number.isSafeInteger(count) ? Math.max(0, count) : 0;
  height = Number.isFinite(height) ? Math.max(0, height) : 0;
  width = Number.isFinite(width) ? Math.max(120, width) : 320;
  scale = Number.isFinite(scale) ? Math.max(.85, Math.min(2, scale)) : 1;
  const enabled = count > 0 && count <= 12;
  if (!enabled) return { enabled: false, minimum: 0 };
  const suppressDamage = both && width < 280;
  both = both && !suppressDamage;
  const gap = height >= count * 23 ? 1 : 0;
  const minimum = count * 18;
  const preferredHeight = details ? 60 : density === 'comfortable' ? 40 : 30;
  const rowHeight = Math.max(18, Math.min(preferredHeight, Math.floor((height - gap * (count - 1)) / count * 10) / 10));
  const widthLimit = both ? (width - 150) / 13.5 : (width - 150) / 7.2;
  const font = Math.max(11, Math.min(12 * scale, widthLimit, (rowHeight - 2) / 1.3));
  return { enabled, minimum, suppressDamage, fits: rowHeight * count + gap * (count - 1) <= height + .1,
    rowHeight, gap, font, icon: Math.max(14, Math.min(20, rowHeight - 4)),
    rateWidth: Math.ceil(font * 7.2), damageWidth: both ? Math.ceil(font * 5.2) : 0,
    details: details && rowHeight >= 48 };
}
