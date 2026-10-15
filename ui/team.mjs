import { classColor } from './model.mjs';

const FRESH_MS = 6000, PEER_TTL_MS = 20000, CAST_TTL_MS = 120000;
const CLASSES = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter', 'Unknown'];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
const hex = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value) ? value : null;
const actorId = value => integer(value, 1, 0xffffffff) !== null ? String(value) : typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 0xffffffff ? value : null;
const text = (value, limit = 80) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, limit) : '';
const className = value => CLASSES.find(name => name.toLowerCase() === String(value).toLowerCase()) || 'Unknown';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const validTime = value => integer(value) !== null;

/**
 * Normalize once when IPC resolves, then retain the returned sampled_at_ms.
 * Re-normalizing that value ages held observations without restarting clocks.
 * Room membership is deliberately never converted into game-party membership.
 */
export function teamSnapshot(value, { now = Date.now(), previous } = {}) {
  value = object(value);
  now = integer(now) ?? Date.now();
  const previousValue = object(previous);
  if (validTime(previousValue.sampled_at_ms) && validTime(value.sampled_at_ms)
      && value.sampled_at_ms < previousValue.sampled_at_ms) {
    return teamSnapshot(previousValue, { now });
  }
  if (hex(value.room_id) && value.room_id === previousValue.room_id
      && validTime(previousValue.last_sync_at_ms)
      && (!validTime(value.last_sync_at_ms) || value.last_sync_at_ms < previousValue.last_sync_at_ms)) {
    return teamSnapshot(previousValue, { now });
  }
  if (hex(value.room_id) && value.room_id === previousValue.room_id
      && Array.isArray(value.peers) && Array.isArray(previousValue.peers)
      && value.peers.some(peer => {
        const prior = previousValue.peers.find(previous => previous.peer_id === peer?.peer_id);
        return prior && integer(prior.sequence) !== null && integer(peer?.sequence) !== null && peer.sequence < prior.sequence;
      })) return teamSnapshot(previousValue, { now });
  const sampled = integer(value.sampled_at_ms) ?? now;
  const elapsed = now >= sampled ? now - sampled : null;
  const room = hex(value.room_id), self = hex(value.self_peer_id);
  const expiry = integer(value.expires_at_ms, 1);
  const expired = expiry !== null && now >= expiry;
  const enabled = value.enabled === true && room !== null && self !== null
    && expiry !== null && !expired && elapsed !== null
    && (!validTime(value.last_sync_at_ms) || value.last_sync_at_ms <= sampled);
  const status = expired ? 'expired' : ['idle', 'connecting', 'active', 'retrying', 'error', 'expired'].includes(value.status) ? !enabled && value.status === 'active' ? 'error' : value.status : 'idle';
  const peers = [], seen = new Set();
  for (const input of (enabled && Array.isArray(value.peers) ? value.peers : []).slice(0, 12)) {
    const row = object(input), id = hex(row.peer_id), name = text(row.display_name);
    const sequence = integer(row.sequence), baseAge = integer(row.age_ms, 0, PEER_TTL_MS);
    if (!id || !name || seen.has(id) || sequence === null || baseAge === null || !validTime(row.received_at_ms)) continue;
    const previousPeer = previousValue.room_id === room && Array.isArray(previousValue.peers)
      ? previousValue.peers.find(peer => peer.peer_id === id) : null;
    if (previousPeer && integer(previousPeer.sequence) !== null && sequence < previousPeer.sequence) continue;
    seen.add(id);
    const age = baseAge + elapsed;
    if (age > PEER_TTL_MS) continue;
    const fresh = row.capture_live === true && row.fresh === true && age <= FRESH_MS;
    const cooldowns = [], skills = new Set();
    for (const inputCooldown of (Array.isArray(row.cooldowns) ? row.cooldowns : []).slice(0, 64)) {
      const cooldown = object(inputCooldown), skill = integer(cooldown.skill_id, 1, 0xffffffff);
      const counterAge = integer(cooldown.age_ms, 0, 86400000);
      if (skill === null || skills.has(skill) || counterAge === null) continue;
      skills.add(skill);
      const currentAge = counterAge + elapsed;
      const current = fresh && cooldown.fresh === true && currentAge <= FRESH_MS;
      const raw = current ? integer(cooldown.raw_remaining_units, 0, 3600000) : null;
      const remaining = current ? integer(cooldown.estimated_remaining_ms, 0, 3600000) : null;
      const ready = current && cooldown.ready_confirmed === true && raw === 0;
      cooldowns.push({ skill_id: skill, raw_remaining_units: raw,
        estimated_remaining_ms: remaining === null ? null : Math.max(0, remaining - elapsed),
        charges: current ? integer(cooldown.charges, 0, 100) : null,
        age_ms: currentAge, fresh: current, ready_confirmed: ready,
        kind: !current ? 'stale' : ready ? 'confirmed' : remaining === null ? 'unknown' : remaining <= elapsed ? 'estimated-elapsed' : 'estimated-cooling' });
    }
    cooldowns.sort((a, b) => {
      const priority = row => ({ 'estimated-cooling': 0, 'confirmed': 1, 'estimated-elapsed': 2, 'unknown': 3, 'stale': 4 })[row.kind];
      return priority(a) - priority(b) || (a.estimated_remaining_ms ?? Infinity) - (b.estimated_remaining_ms ?? Infinity) || a.skill_id - b.skill_id;
    });
    peers.push({ peer_id: id, display_name: name, class_name: className(row.class_name),
      is_self: id === self, received_at_ms: row.received_at_ms, sequence,
      capture_live: row.capture_live === true, fresh, age_ms: age, cooldowns });
  }
  peers.sort((a, b) => Number(b.is_self) - Number(a.is_self) || a.display_name.localeCompare(b.display_name) || a.peer_id.localeCompare(b.peer_id));
  return { enabled, status, room_id: enabled ? room : null, self_peer_id: enabled ? self : null,
    expires_at_ms: expiry, is_host: enabled && value.is_host === true, peers,
    last_sync_at_ms: integer(value.last_sync_at_ms), sampled_at_ms: now,
    error: typeof value.error === 'string' && value.error.length ? 'unavailable' : '' };
}

export const normalizeTeamSnapshot = teamSnapshot;

/** Only completed, recent, actor-bound casts of a confirmed server roster. */
export function observedPartyCasts(state, now = Date.now()) {
  state = object(state);
  if (state.party_membership_source !== 'server' || !validTime(now)) return [];
  const party = new Set((Array.isArray(state.party_member_ids) ? state.party_member_ids : []).slice(0, 12).map(actorId).filter(Boolean));
  const players = new Map((Array.isArray(state.players) ? state.players : []).slice(0, 256)
    .filter(player => object(player).identity_confirmed === true && actorId(player.id))
    .map(player => [actorId(player.id), player]));
  const roster = object(state.party_identity_roster);
  if (roster.source !== 'server') return [];
  for (const input of (Array.isArray(roster.members) ? roster.members : []).slice(0, 12)) {
    const member = object(input), actor = actorId(member.actor_id);
    if (actor && party.has(actor) && member.identity_confirmed === true) {
      players.set(actor, { id: actor, name: text(member.name) || `#${actor}`, class_name: className(member.class_name), identity_confirmed: true });
    }
  }
  const own = state.local_identity_source === 'server' ? actorId(state.local_player_id) : null;
  const seen = new Set(), casts = [];
  for (const input of (Array.isArray(state.observed_casts) ? state.observed_casts : []).slice(0, 512)) {
    const row = object(input), actor = actorId(row.actor_id), player = players.get(actor);
    const skill = integer(row.skill_id, 1, 0xffffffff), observed = integer(row.last_observed_at_ms);
    const count = integer(row.use_count, 1, 0xffffffff);
    if (!actor || actor === own || !party.has(actor) || !player || skill === null || observed === null
        || count === null || row.source !== 'server-cast' || row.ready_confirmed !== false
        || row.fresh !== true || observed > now || now - observed > CAST_TTL_MS) continue;
    const key = `${actor}:${skill}`;
    if (seen.has(key)) continue;
    seen.add(key);
    casts.push({ actor_id: actor, name: text(player.name) || `#${actor}`, class_name: className(player.class_name),
      skill_id: skill, target_id: actorId(row.target_id), last_observed_at_ms: observed,
      age_ms: now - observed, use_count: count, source: 'server-cast', ready_confirmed: false });
  }
  return casts.sort((a, b) => b.last_observed_at_ms - a.last_observed_at_ms || a.actor_id.localeCompare(b.actor_id) || a.skill_id - b.skill_id).slice(0, 24);
}

const labels = locale => locale === 'en' ? {
  title: 'Team cooldowns', room: 'Room participants', roomNote: 'Shows Luma observations shared by people with this invitation. Joining a room does not establish game-party membership.',
  consent: 'Share my character name, class and received cooldown observations with this room for up to 2 hours.',
  privacy: 'Sharing starts when you create or join. Cube audio, encounters and equipment are excluded.',
  create: 'Create free room', join: 'Join room', invite: 'Invitation code', copy: 'Copy invitation', leave: 'Leave room', close: 'Close room for everyone',
  hostHelp: 'Closing this room ends synchronization for all participants.', native: 'Open the desktop app to use team rooms.',
  self: 'You', fresh: 'Live relay', stale: 'Waiting for fresh data', noCooldowns: 'No recent cooldown observations',
  unknown: 'Unknown', ready: 'Ready', elapsed: 'Estimate elapsed', more: 'More skills', error: 'The team service could not be reached. Received data expires normally.',
  idle: 'Not sharing', connecting: 'Connecting…', active: 'Room active', retrying: 'Reconnecting…', expired: 'Room expired',
  observed: 'Observed party uses', observedNote: 'Completed casts received from confirmed party actors. Time since use does not establish cooldown readiness.',
  noCasts: 'No recent completed party casts received.', uses: 'uses', ago: 'ago', seconds: 's', ttl: 'Room closes in',
} : {
  title: 'Takım cooldown’ları', room: 'Oda katılımcıları', roomNote: 'Bu davetle katılanların Luma gözlemlerini gösterir. Odaya katılmak oyundaki parti üyeliğini doğrulamaz.',
  consent: 'Karakter adımı, sınıfımı ve alınan cooldown gözlemlerimi en fazla 2 saat boyunca bu odayla paylaşmayı kabul ediyorum.',
  privacy: 'Paylaşım oda oluşturunca veya katılınca başlar. Küp sesi, karşılaşmalar ve ekipman gönderilmez.',
  create: 'Ücretsiz oda oluştur', join: 'Odaya katıl', invite: 'Davet kodu', copy: 'Daveti kopyala', leave: 'Odadan ayrıl', close: 'Odayı herkes için kapat',
  hostHelp: 'Odayı kapatınca tüm katılımcıların senkronizasyonu sona erer.', native: 'Takım odaları için masaüstü uygulamasını aç.',
  self: 'Sen', fresh: 'Canlı aktarım', stale: 'Yeni veri bekleniyor', noCooldowns: 'Yeni cooldown gözlemi yok',
  unknown: 'Bilinmiyor', ready: 'Hazır', elapsed: 'Tahmini süre doldu', more: 'Diğer yetenekler', error: 'Takım servisine ulaşılamadı. Alınan veriler normal süresinde geçersiz olur.',
  idle: 'Paylaşım kapalı', connecting: 'Bağlanıyor…', active: 'Oda açık', retrying: 'Yeniden bağlanıyor…', expired: 'Odanın süresi doldu',
  observed: 'Gözlenen parti kullanımları', observedNote: 'Doğrulanmış parti oyuncularından alınan tamamlanmış kullanımlar. Geçen süre, yeteneğin hazır olduğunu göstermez.',
  noCasts: 'Yakın zamanda tamamlanmış parti kullanımı alınmadı.', uses: 'kullanım', ago: 'önce', seconds: 'sn', ttl: 'Odanın kapanmasına',
};

export function renderTeamControls(value, options = {}) {
  const { locale = 'tr', now = Date.now(), native = true, busy = false, consent = false } = options;
  const e = typeof options.esc === 'function' ? options.esc : escapeHtml;
  const snapshot = teamSnapshot(value, { now }), t = labels(locale);
  const disabled = native !== true || busy === true;
  const status = snapshot.status === 'error' ? locale === 'en' ? 'Service unavailable' : 'Servis kullanılamıyor' : t[snapshot.status] || t.idle;
  const heading = `<div class="record-top"><h3 class="section-title">${e(t.title)}</h3><span class="source-tag" data-team-status>${e(status)}</span></div>`;
  if (snapshot.enabled) {
    const remaining = Math.max(0, Math.ceil((snapshot.expires_at_ms - now) / 60000));
    return `${heading}<p class="help">${e(t.roomNote)}</p><div class="button-row"><button class="action-button" type="button" data-action="team-copy-invite"${disabled ? ' disabled' : ''}>${e(t.copy)}</button><button class="action-button danger-button" type="button" data-action="team-leave"${disabled ? ' disabled' : ''}>${e(snapshot.is_host ? t.close : t.leave)}</button></div><p class="help" data-team-expiry>${e(t.ttl)} ${remaining} ${e(locale === 'en' ? 'min' : 'dk')}${snapshot.is_host ? ` · ${e(t.hostHelp)}` : ''}</p>`;
  }
  const canJoin = !disabled && consent === true;
  return `${heading}<p class="help">${e(t.roomNote)}</p>${native !== true ? `<p class="help">${e(t.native)}</p>` : ''}<form id="team-join-form" class="team-join-form"><label class="toggle-row team-consent"><input id="team-consent" name="teamConsent" type="checkbox" required${consent === true ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${e(t.consent)}</span></label><p class="help">${e(t.privacy)}</p><div class="button-row"><button class="action-button" type="button" data-action="team-create"${canJoin ? '' : ' disabled'}>${e(t.create)}</button></div><label class="field" for="team-invite"><span>${e(t.invite)}</span><input id="team-invite" name="teamInvite" type="password" maxlength="102" autocomplete="off" spellcheck="false" placeholder="LUMA:…" required${disabled ? ' disabled' : ''}></label><button class="action-button" type="submit" data-action="team-join"${canJoin ? '' : ' disabled'}>${e(t.join)}</button></form>`;
}

function renderCooldown(cooldown, t, e) {
  const value = cooldown.kind === 'confirmed' ? t.ready : cooldown.kind === 'estimated-cooling'
    ? `~${Math.ceil(cooldown.estimated_remaining_ms / 1000)} ${t.seconds}`
    : cooldown.kind === 'estimated-elapsed' ? t.elapsed : t.unknown;
  return `<li class="team-cooldown" data-cooldown-kind="${e(cooldown.kind)}"><span>Skill #${cooldown.skill_id}</span><strong>${e(value)}</strong>${cooldown.charges === null ? '' : `<small>${cooldown.charges} ${e(t.uses)}</small>`}</li>`;
}

export function renderTeam(value, options = {}) {
  const { locale = 'tr', now = Date.now(), state } = options;
  const e = typeof options.esc === 'function' ? options.esc : escapeHtml;
  const snapshot = teamSnapshot(value, { now }), t = labels(locale);
  const cards = snapshot.peers.map(peer => {
    const initial = peer.cooldowns.slice(0, 4), additional = peer.cooldowns.slice(4);
    return `<article class="record-card team-peer" data-team-peer="${e(peer.peer_id)}" style="--team-class:${classColor(peer.class_name)}"><div class="record-top"><strong>${e(peer.display_name)}${peer.is_self ? ` <small>· ${e(t.self)}</small>` : ''}</strong><span class="source-tag">${e(peer.class_name)}</span></div><div class="record-meta">${e(peer.fresh ? t.fresh : t.stale)}</div>${initial.length ? `<ul class="team-cooldowns">${initial.map(row => renderCooldown(row, t, e)).join('')}</ul>` : `<p class="help">${e(t.noCooldowns)}</p>`}${additional.length ? `<details class="team-more"><summary>${e(t.more)} (${additional.length})</summary><ul class="team-cooldowns">${additional.map(row => renderCooldown(row, t, e)).join('')}</ul></details>` : ''}</article>`;
  }).join('');
  const casts = observedPartyCasts(state, now);
  const castRows = casts.map(cast => `<li class="team-cast"><span><strong>${e(cast.name)}</strong> · Skill #${cast.skill_id}</span><span>${Math.floor(cast.age_ms / 1000)} ${e(t.seconds)} ${e(t.ago)} · ${cast.use_count} ${e(t.uses)}</span></li>`).join('');
  return `<section class="team-page">${renderTeamControls(snapshot, options)}${snapshot.error ? `<p class="help team-error" role="status">${e(t.error)}</p>` : ''}${snapshot.enabled ? `<h3 class="section-title">${e(t.room)} (${snapshot.peers.length}/12)</h3><div class="team-grid" data-team-peers>${cards || `<p class="help">${e(t.stale)}</p>`}</div>` : ''}<h3 class="section-title">${e(t.observed)}</h3><p class="help">${e(t.observedNote)}</p>${castRows ? `<ul class="team-cast-list">${castRows}</ul>` : `<p class="empty-state">${e(t.noCasts)}</p>`}</section>`;
}
