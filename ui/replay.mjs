import { compactNumber, formatRate } from './model.mjs';
import { spatialFrame, renderRadar, escapeSpatial as esc } from './spatial.mjs';

export function replayTimeline(record = {}, scope = 'observed') {
  const start = Number.isSafeInteger(record.started_ms) ? record.started_ms : 0, end = Math.max(start, Number.isSafeInteger(record.ended_ms) ? record.ended_ms : start);
  const self = String(record.local_player_id ?? ''), party = new Set((record.party_member_ids || []).map(String));
  const eligible = id => scope === 'personal' ? self && String(id) === self : scope === 'party' ? party.has(String(id)) : true;
  const samples = (record.damage_samples || []).filter(s => s.metric === 'damage' && Number.isSafeInteger(s.timestamp_ms) && s.timestamp_ms >= start && s.timestamp_ms <= end && eligible(s.player_id ?? s.source)).slice(0, 20000).sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  return { start, end, rateStart: samples[0]?.timestamp_ms ?? start, duration: end - start, samples, complete: record.sample_complete === true && !record.truncated,
    known: scope === 'personal' ? Boolean(self) : scope === 'party' ? record.party_membership_source === 'server' : true };
}

export function replayFrame(record, timeline, offset) {
  const at = timeline.start + Math.max(0, Math.min(timeline.duration, Number(offset) || 0)), players = new Map(), recent = [];
  const identities = new Map((record.players || []).map(p => [String(p.id), p]));
  let total = 0;
  for (const s of timeline.samples) {
    if (s.timestamp_ms > at) break;
    const id = String(s.player_id ?? s.source), amount = Number.isFinite(s.amount) ? Math.max(0, s.amount) : 0;
    total += amount;
    const row = players.get(id) || { id, name: identities.get(id)?.name || '', damage: 0 };
    row.damage += amount; players.set(id, row);
    recent.push(s); if (recent.length > 8) recent.shift();
  }
  const elapsed = Math.max(1000, at - timeline.rateStart);
  return { at, total, dps: total * 1000 / elapsed, players: [...players.values()].map(p => ({ ...p, dps: p.damage * 1000 / elapsed })).sort((a, b) => b.damage - a.damage), recent,
    spatial: spatialFrame(record.spatial, { at, selfId: record.local_player_id, partyIds: record.party_member_ids || [], replay: true }) };
}

export function replayClock() {
  let offset = 0, playing = false, speed = 1, last = null;
  return {
    get offset() { return offset; }, get playing() { return playing; }, get speed() { return speed; },
    seek(value, duration) { offset = Math.max(0, Math.min(duration, Number(value) || 0)); last = null; },
    toggle(duration) { if (!playing && offset >= duration) offset = 0; playing = !playing && duration > 0; last = null; },
    pause() { playing = false; last = null; },
    rate(value) { if ([.5, 1, 2, 4].includes(Number(value))) speed = Number(value); },
    tick(now, duration) { if (playing && last !== null && now >= last) offset = Math.min(duration, offset + (now - last) * speed); last = now; if (offset >= duration) playing = false; return offset; },
  };
}

export function renderReplayFrame(frame, timeline, { locale = 'tr', hideNames = false, range = 100 } = {}) {
  const tr = locale === 'tr', number = value => compactNumber(value, locale, 2), name = p => hideNames ? tr ? 'Oyuncu' : 'Player' : p.name && !/^#\d+$/.test(p.name) ? p.name : tr ? 'İsmi alınmayan kaynak' : 'Unidentified source';
  return `<div class="replay-summary"><div><small>${tr ? 'Alınan örneklerin toplamı' : 'Retained sample total'}</small><strong>${number(frame.total)}</strong></div><div><small>${tr ? 'Örnek DPS' : 'Sample DPS'}</small><strong>${formatRate(frame.dps, locale, 2)}</strong></div></div>${!timeline.known ? `<p class="quality-warning">${tr ? 'Bu kayıt için seçili kişi / takım kapsamı doğrulanmamış.' : 'Self / party scope is not verified for this record.'}</p>` : ''}${!timeline.complete ? `<p class="quality-warning">${tr ? 'Kısmi kayıt: yalnız saklanan vuruşlar oynatılıyor; eksik örnekler toplam hasara ölçeklenmez.' : 'Partial record: playback uses retained hits, without scaling missing samples to the aggregate.'}</p>` : ''}<div class="replay-grid"><div>${renderRadar(frame.spatial, { locale, range, hideNames, compact: true })}</div><div class="replay-roster">${frame.players.slice(0, 10).map((p, i) => `<article><span>${i + 1}</span><strong>${esc(name(p))}</strong><b>${number(p.damage)}<small>${formatRate(p.dps, locale, 2)}</small></b></article>`).join('') || `<p class="empty">${tr ? 'Bu ana kadar alınan vuruş yok.' : 'No received hits up to this point.'}</p>`}</div></div><p class="help">${tr ? 'Konumlar son gerçek gözlemde tutulur; eksik konum ve hareket uydurulmaz. Eski kayıtlarda yalnız hasar zaman çizelgesi bulunabilir.' : 'Positions stay at the last received observation. Missing movement is not invented; older records may contain only the damage timeline.'}</p>`;
}
