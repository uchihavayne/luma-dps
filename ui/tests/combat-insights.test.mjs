import test from 'node:test';
import assert from 'node:assert/strict';
import { insightWindow, encounterInsights, effectAttribution, bossProjection, renderCombatInsights, renderEffectAttribution, renderBossProjection } from '../combat-insights.mjs';

const cast = (at, actor = 1, skill = 10, target = 99) => ({ kind: 'cast', at_ms: at, actor_id: actor, skill_id: skill, target_id: target });
const hit = (at, amount = 100, actor = 1, skill = 10, tick = false) => ({ timestamp_ms: at, amount, source: actor, player_id: actor, skill, tick, target: 99 });
const effect = (kind, at, instance = 7, family = 20, caster = 2, recipient = 1) => ({ kind, at_ms: at, actor_id: caster, target_id: recipient, instance_id: instance, skill_id: family });
const record = () => ({ started_ms: 1000, ended_ms: 11000, elapsed_ms: 10000, total_damage: 400, source: 'captured', sample_complete: true, local_player_id: 1, local_identity_source: 'server', players: [{ id: 1, name: 'Ranger', damage: 400, skills: [{ id: 10, name: 'Arrow' }] }, { id: 2, name: 'Cleric', skills: [] }], targets: [{ id: 99, name: 'Boss', is_boss: true }], damage_samples: [hit(1000), hit(2000, 100, 1, 10, true), hit(8000), hit(9000)], assist: { timeline: [cast(1000), cast(8000)], effects: [], health_history: [], retention_limited: false } });

test('rotation counts only actual server cast observations, never windups, hits or ticks', () => {
  const input = record();
  input.assist.timeline.push({ ...cast(1500), kind: 'windup' }, { ...cast(1500), kind: 'windup-elapsed' }, cast(1000));
  const value = encounterInsights(input);
  assert.equal(value.cast_count, 2);
  assert.equal(value.damage_event_count, 4);
  assert.equal(value.tick_event_count, 1);
  assert.equal(value.casts_per_minute, 12);
  assert.deepEqual(value.rotation.map(row => row.previous_cast_gap_ms), [null, 7000]);
  assert.equal(value.skills[0].cast_interval_median_ms, 7000);
  assert.equal(value.skills[0].skill_name, 'Arrow');
});

test('hit-only records retain damage, and do not invent casts or action rate', () => {
  const input = record(); input.assist.timeline = [];
  const value = encounterInsights(input);
  assert.equal(value.available, true); assert.equal(value.cast_count, 0);
  assert.equal(value.casts_per_minute, null); assert.equal(value.cast_activity_ms, null);
  assert.equal(value.skills[0].cast_interval_median_ms, null);
  assert.match(renderCombatInsights(input, { locale: 'en' }), /hits do not establish a rotation/);
});

test('activity uses a bounded union of explicit hit windows with a separate model rate', () => {
  const value = encounterInsights(record(), { activityWindowMs: 3000 });
  assert.equal(value.hit_activity_ms, 7000); // [1000,5000) + [8000,11000)
  assert.equal(value.cast_activity_ms, 6000);
  assert.equal(value.observed_damage, 400);
  assert.equal(value.modeled_active_dps, 400000 / 7000);
  assert.equal(value.players[0].modeled_active_dps, value.modeled_active_dps);
  assert.equal(value.skills[0].modeled_active_dps, value.modeled_active_dps);
  assert.equal(encounterInsights(record(), { activityWindowMs: -1 }).activity_window_ms, 3000);
  assert.equal(encounterInsights(record(), { activityWindowMs: 1000 }).hit_activity_ms, 4000);
});

test('pauses are not silently removed from retained wall-clock activity windows', () => {
  const input = { ...record(), elapsed_ms: 2000 };
  const value = encounterInsights(input);
  assert.equal(value.window.duration_ms, 10000);
  assert.equal(value.window.paused_or_clock_difference, true);
  assert.equal(value.rotation[1].elapsed_ms, 7000);
  assert.equal(value.casts_per_minute, 12);
});

test('partial samples, timeline retention and stream loss suppress model DPS', () => {
  for (const input of [{ ...record(), sample_complete: false }, { ...record(), stream_gaps: 1 }, { ...record(), assist: { ...record().assist, retention_limited: true } }, { ...record(), truncated: true }]) {
    const value = encounterInsights(input);
    assert.equal(value.partial, true); assert.equal(value.modeled_active_dps, null);
    assert.equal(value.skills[0].modeled_active_dps, null);
    assert.equal(value.players[0].modeled_active_dps, null);
  }
});

test('personal and party scopes require identity and exclude nearby actors', () => {
  const input = record(); input.damage_samples.push(hit(3000, 900, 3)); input.assist.timeline.push(cast(3000, 3));
  assert.equal(encounterInsights(input).observed_damage, 400);
  assert.equal(encounterInsights(input, { scope: 'observed' }).observed_damage, 1300);
  assert.equal(encounterInsights(input, { scope: 'party' }).available, false);
  input.party_member_ids = [1, 2]; input.party_membership_source = 'server';
  assert.equal(encounterInsights(input, { scope: 'party' }).observed_damage, 400);
  assert.equal(encounterInsights(input, { actorId: 3 }).available, false);
  assert.equal(encounterInsights({ ...input, local_identity_source: 'unresolved' }).available, false);
  assert.equal(encounterInsights({ ...input, actor_scope: 'personal' }, { scope: 'party' }).available, false);
});

test('cast skill and actor identities remain separate for same class and nearby names', () => {
  const input = record(); input.party_membership_source = 'server'; input.party_member_ids = [1, 2];
  input.assist.timeline.push(cast(4000, 2)); input.damage_samples.push(hit(4500, 500, 2));
  const value = encounterInsights(input, { scope: 'party' });
  assert.equal(value.skills.length, 2); assert.equal(value.players.length, 2);
  assert.equal(value.players.find(row => row.actor_id === '2').observed_damage, 500);
  assert.deepEqual(value.rotation.map(row => row.actor_id), ['1', '2', '1']);
});

test('a measured zero damage sample remains zero and invalid timing stays unavailable', () => {
  const input = record(); input.damage_samples = [hit(1000, 0)]; input.assist.timeline = [];
  assert.equal(encounterInsights(input).modeled_active_dps, 0);
  assert.equal(encounterInsights(input).observed_damage, 0);
  assert.equal(insightWindow({ started_ms: 0, ended_ms: 1000, elapsed_ms: 1000 }).start_ms, 0);
  for (const value of [null, {}, { ...input, timing_valid: false }, { ...input, ended_ms: 500 }, { ...input, ended_ms: Infinity }]) assert.equal(encounterInsights(value).available, false);
});

test('effects pair observed application/removal by recipient and instance with half-open boundaries', () => {
  const input = record();
  input.assist.timeline.push(effect('effect-applied', 1000), effect('effect-refreshed', 4000), effect('effect-removed', 8000));
  const value = effectAttribution(input), row = value.rows[0];
  assert.equal(value.available, true); assert.equal(value.additive, false); assert.equal(value.causal_bonus_damage, null); assert.equal(value.rdps, null);
  assert.equal(row.effect_family_id, '20'); assert.equal(row.observed_uptime_ms, 7000);
  assert.equal(row.damage_event_count, 2); assert.equal(row.observed_damage, 200);
  assert.equal(row.skills[0].tick_event_count, 1);
});

test('effect intervals applied before the fight clip to retained encounter boundaries', () => {
  const input = record(); input.assist.timeline = [effect('effect-applied', 0), effect('effect-expired', 3000)];
  const row = effectAttribution(input).rows[0];
  assert.deepEqual(row.intervals, [{ start_ms: 1000, end_ms: 3000 }]);
  assert.equal(row.observed_damage, 200);
});

test('active effect deadlines and persistent observations can complete received intervals', () => {
  const input = record();
  input.assist.timeline.push(effect('effect-applied', 1000));
  input.assist.effects = [{ source: 'server-effect', recipient_id: 1, caster_id: 2, instance_id: 7, effect_id: 200, started_ms: 4000, expires_ms: 9000 }];
  const row = effectAttribution(input).rows[0];
  assert.deepEqual(row.effect_ids, [200]); assert.equal(row.observed_uptime_ms, 8000);
  assert.equal(row.damage_event_count, 3);
  input.assist.effects[0].persistent = true; input.assist.effects[0].expires_ms = null;
  assert.equal(effectAttribution(input).rows[0].damage_event_count, 4);
});

test('unpaired effects do not invent expiry and instance reuse cannot merge different effects', () => {
  const input = record(); input.assist.timeline = [effect('effect-applied', 1000)];
  const missing = effectAttribution(input);
  assert.equal(missing.available, false); assert.equal(missing.unresolved_intervals, 1); assert.equal(missing.partial, true);
  input.assist.timeline.push(effect('effect-applied', 4000, 7, 30), effect('effect-removed', 10000, 7, 30));
  const reused = effectAttribution(input);
  assert.equal(reused.rows.length, 2);
  assert.equal(reused.rows.find(row => row.effect_family_id === '20').observed_uptime_ms, 3000);
  assert.equal(reused.rows.find(row => row.effect_family_id === '30').observed_uptime_ms, 6000);
});

test('multiple effects may overlap one hit, and recipient membership controls scope', () => {
  const input = record(); input.assist.timeline = [effect('effect-applied', 1000), effect('effect-removed', 10000), effect('effect-applied', 1000, 8, 30), effect('effect-removed', 10000, 8, 30), effect('effect-applied', 1000, 9, 40, 1, 3), effect('effect-removed', 10000, 9, 40, 1, 3)];
  assert.equal(effectAttribution(input).rows.length, 2);
  assert.equal(effectAttribution(input).rows.reduce((sum, row) => sum + row.observed_damage, 0), 800);
  assert.equal(effectAttribution(input, { scope: 'observed' }).rows.length, 3);
});

test('summon ownership credit does not establish that an owner effect applied to a pet attack', () => {
  const input = record(); input.assist.timeline = [effect('effect-applied', 1000), effect('effect-removed', 10000)];
  input.damage_samples.push({ ...hit(5000, 900), source: 8, player_id: 1 });
  assert.equal(encounterInsights(input).observed_damage, 1300);
  assert.equal(effectAttribution(input).rows[0].observed_damage, 400);
});

const withHp = () => {
  const input = record(); input.assist.health_history = Array.from({ length: 5 }, (_, i) => ({ actor_id: 99, current_hp: 1000 - i * 100, reported_max_hp: 1000, observed_at_ms: 5000 + i * 1000 }));
  return input;
};

test('boss projection uses fresh actual falling HP, not meter DPS or a preset berserk', () => {
  const input = withHp(); input.dps = 900000000;
  const value = bossProjection(input, { now: 9000 });
  assert.equal(value.available, true); assert.equal(value.remaining_ms, 6000);
  assert.deepEqual(value.range_ms, [6000, 6000]); assert.equal(value.hp_per_second, 100);
  assert.equal(value.berserk_ms, null); assert.equal(value.confidence, null);
  assert.equal(value.sample_count, 5);
});

test('sparse, stale, future, flat, paused, lost, reset or changing maximum HP cannot project', () => {
  const sparse = withHp(); sparse.assist.health_history = sparse.assist.health_history.slice(0, 3);
  assert.equal(bossProjection(sparse, { now: 9000 }).available, false);
  assert.equal(bossProjection(withHp(), { now: 15000 }).reason, 'stale');
  assert.equal(bossProjection(withHp(), { now: 4000 }).available, false);
  assert.equal(bossProjection({ ...withHp(), paused: true }, { now: 9000 }).reason, 'paused');
  assert.equal(bossProjection({ ...withHp(), stream_gaps: 1 }, { now: 9000 }).reason, 'capture-incomplete');
  const reset = withHp(); reset.assist.health_history[3].current_hp = 999;
  assert.equal(bossProjection(reset, { now: 9000 }).reason, 'healing-or-reset');
  const flat = withHp(); flat.assist.health_history.forEach(sample => sample.current_hp = 500);
  assert.equal(bossProjection(flat, { now: 9000 }).available, false);
  const changed = withHp(); changed.assist.health_history[3].reported_max_hp = 2000;
  assert.equal(bossProjection(changed, { now: 9000 }).reason, 'maximum-changed');
});

test('unstable rates, long gaps, conflicts and non-boss targets cannot produce a confident countdown', () => {
  const unstable = withHp(); unstable.assist.health_history[1].current_hp = 999;
  assert.equal(bossProjection(unstable, { now: 9000 }).reason, 'unstable-trend');
  const gap = withHp(); gap.started_ms = 0; gap.elapsed_ms = 11000; gap.assist.health_history[0].observed_at_ms = 0;
  assert.equal(bossProjection(gap, { now: 9000 }).reason, 'observation-gap');
  const conflict = withHp(); conflict.assist.health_history.push({ ...conflict.assist.health_history[0], current_hp: 999 });
  assert.equal(bossProjection(conflict, { now: 9000 }).reason, 'conflicting-health');
  assert.equal(bossProjection({ ...withHp(), targets: [{ id: 99, is_boss: false }] }, { now: 9000 }).available, false);
});

test('fresh zero HP is explicit while out-of-order samples sort and timestamps are shift invariant', () => {
  const input = withHp(); input.assist.health_history.at(-1).current_hp = 0;
  assert.equal(bossProjection(input, { now: 9000 }).remaining_ms, 0);
  const base = withHp(), shift = 1000;
  const shifted = { ...base, source: 'imported', started_ms: 0, ended_ms: 10000, assist: { ...base.assist, health_history: base.assist.health_history.map(row => ({ ...row, observed_at_ms: row.observed_at_ms - shift })).reverse() } };
  assert.equal(bossProjection(shifted, { now: 8000 }).remaining_ms, bossProjection(base, { now: 9000 }).remaining_ms);
  assert.equal(bossProjection(shifted, { now: 8000 }).imported, true);
});

test('all renderers escape received labels and include observation/uncertainty limits', () => {
  const input = withHp(); input.players[0].name = '<img src=x onerror=alert(1)>'; input.players[0].skills[0].name = '<script>bad</script>'; input.targets[0].name = '<svg/onload=1>';
  input.assist.timeline.push(effect('effect-applied', 1000), effect('effect-removed', 10000));
  const html = [renderCombatInsights(input, { locale: 'en' }), renderEffectAttribution(input, { locale: 'en' }), renderBossProjection(input, { now: 9000, locale: 'en' })].join('');
  assert.equal(html.includes('<script>'), false); assert.equal(html.includes('<img src='), false); assert.equal(html.includes('<svg/onload'), false);
  assert.match(html, /&lt;script&gt;/); assert.match(html, /non-additive/); assert.match(html, /not a berserk timer/);
});
