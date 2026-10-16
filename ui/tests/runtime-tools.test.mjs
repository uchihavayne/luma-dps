import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHotkeys, renderUpdates, updatePresentation } from '../runtime-tools.mjs';
import { normalizeEncounter } from '../model.mjs';
import { encounterInsights, effectAttribution } from '../combat-insights.mjs';
import { runContext } from '../run-history.mjs';

const record = () => ({ started_ms: 1000, ended_ms: 5000, elapsed_ms: 4000, total_damage: 100, sample_complete: true, healing_sample_complete: true, local_player_id: 1, local_identity_source: 'server', players: [{ id: 1, name: 'Example', identity_confirmed: true, damage: 100, healing: 40, healing_skills: [{ id: 12, damage: 40, hits: 1 }] }], damage_samples: [{ timestamp_ms: 2000, source: 1, player_id: 1, target: 99, skill: 10, amount: 100 }], healing_samples: [{ timestamp_ms: 3000, source: 1, player_id: 1, target: 2, skill: 12, amount: 40, metric: 'healing' }], assist: { effects: [{ recipient_id: 1, caster_id: 2, instance_id: 7, effect_id: 201, source: 'server-effect', started_ms: 500, expires_ms: 4000, duration_ms: 3500 }], timeline: [{ kind: 'cast', actor_id: 1, target_id: 99, skill_id: 10, at_ms: 1500 }], health_history: [{ actor_id: 99, current_hp: 800, reported_max_hp: null, observed_at_ms: 3000 }] } });

test('IPC normalization preserves complete cast, effect and healing observations without mixing metrics', () => {
  const normalized = normalizeEncounter(record());
  assert.equal(encounterInsights(normalized).cast_count, 1);
  assert.equal(effectAttribution(normalized).rows[0].observed_damage, 100);
  assert.equal(normalized.players[0].identity_confirmed, true);
  assert.equal(normalized.players[0].healing_skills[0].damage, 40);
  assert.equal(normalized.healing_samples[0].amount, 40);
  assert.equal(normalized.damage_samples.length, 1);
  assert.equal(normalized.assist.health_history[0].reported_max_hp, null);
});

test('dropping corrupt samples invalidates complete activity and healing coverage', () => {
  const input = record(); input.damage_samples.push({ timestamp_ms: 2200, amount: -50 }); input.healing_samples.push({ timestamp_ms: Infinity, amount: 40 });
  const normalized = normalizeEncounter(input);
  assert.equal(normalized.sample_complete, false);
  assert.equal(normalized.healing_sample_complete, false);
  assert.equal(encounterInsights(normalized).modeled_active_dps, null);
});

test('received zone sessions preserve map boundaries without promoting them to verified dungeons', () => {
  const input = record(); input.context = { source: 'server-zone', map_id: 214, session_id: 'zone-214-1000-1', instance_kind: 'dungeon', instance_id: 99 };
  const normalized = normalizeEncounter(input), context = runContext(normalized);
  assert.equal(context.map_id, '214'); assert.equal(context.kind, 'map-session'); assert.equal(context.instance_id, null);
});

test('unverified or malformed updater states never expose download or install controls', () => {
  for (const state of [{ status: 'downloaded', downloaded: true }, { status: 'available', publisher_verified: false }, { status: '<script>' }]) {
    assert.doesNotMatch(renderUpdates(state, { native: true, locale: 'en' }), /data-action="(?:download|install)-update"/);
  }
  assert.match(renderUpdates({ status: 'downloaded', downloaded: true, publisher_verified: true, available_version: '0.17.0', notes: '<img src=x>' }, { native: true, locale: 'en' }), /data-action="install-update"/);
  assert.equal(updatePresentation({ status: 'checking' }).busy, true);
  assert.match(renderUpdates({ notes: '<script>alert(1)</script>' }), /&lt;script&gt;/);
});

test('hotkey UI escapes received errors and bindings and disables browser-only changes', () => {
  const markup = renderHotkeys({ bindings: [{ action: 'settings', shortcut: '"><img src=x>', enabled: true }], errors: ['<script>'] }, { locale: 'en' });
  assert.doesNotMatch(markup, /<img|<script/); assert.match(markup, /&lt;script&gt;/); assert.match(markup, /disabled/);
});
