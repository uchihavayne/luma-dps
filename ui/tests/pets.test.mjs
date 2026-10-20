import test from 'node:test';
import assert from 'node:assert/strict';
import { PET_CATALOG, PET_DATA_NOTICE } from '../pet-catalog.mjs';
import { normalizePreferences, liveServerActorId } from '../model.mjs';
import { normalizePetCatalog, petCompletion, petPlan, filteredPets, petGuideFilterAction, trackedPets, normalizePetPins, petPinTransition, petTargetMatches, petReferenceUrl, petMetadataTransition, renderPetGuide, renderPetTracker, PET_PIN_LIMIT } from '../pets.mjs';

const now = 1_000_000;
const catalog = normalizePetCatalog(PET_CATALOG);
const pet = (overrides = {}) => ({ pet_id: 1002, level: 1, progress: 12, progress_source: 'server-absolute', session_gained: 12, session_baseline_gained: 0, session_started_at_ms: now - 60000, session_gain_events: 6, last_gain_at_ms: now - 1000, observed_at_ms: now, ...overrides });
const inventory = (pets, overrides = {}) => ({ actor_id: 7, source: 'server-self', pets, active_pet_known: true, active_pet_id: 1002, inventory_complete: true, observed_at_ms: now, ...overrides });
const plan = (pets = [pet()], options = {}) => petPlan(inventory(pets), catalog, { localPlayerId: '7', now, ...options });

test('bundled factual catalog retains verified mappings, all locations, bonuses and specific source links', () => {
  assert.equal(catalog.pets.length, 207);
  assert.equal(new Set(catalog.pets.map(row => row.id)).size, 207);
  assert.equal(catalog.pets.reduce((sum, row) => sum + row.locations.length, 0), 495);
  assert.equal(catalog.pets.reduce((sum, row) => sum + row.bonuses.length, 0), 800);
  assert.equal(catalog.pets.filter(row => row.map_url).length, 155);
  assert.deepEqual(catalog.requirements.souls, [5, 25, 75]);
  assert.ok(catalog.pets.every(row => row.source_url.startsWith('https://metabot.gg/en/aion-2/mounts/')));
  assert.ok(PET_DATA_NOTICE.includes('MIT License') && PET_DATA_NOTICE.includes('Copyright (c) 2026 MartinLVila'));
});

test('unverified ID mappings, ambiguous duplicates and wrong-region thresholds cannot label live progress', () => {
  const example = PET_CATALOG.pets[1];
  assert.equal(normalizePetCatalog({ ...PET_CATALOG, pets: [{ ...example, id_mapping_verified: false }] }).pets.length, 0);
  assert.equal(normalizePetCatalog({ ...PET_CATALOG, pets: [example, { ...example, name: 'Other' }] }).pets.length, 0);
  assert.equal(normalizePetCatalog({ ...PET_CATALOG, region: 'TW' }).requirements, null);
});

test('target pin suggestions match whole verified monster names without guessing from actor or pet IDs', () => {
  const reference = { pets: [
    { id: 1002, name: 'Pet title', locations: [{ monster: 'Krall Laborer' }] },
    { id: 1003, name: 'Krall Laborer', locations: [{ monster: 'Other monster' }] },
    { id: 1004, name: 'Another pet', locations: [{ monster: 'KRALL LABORER' }, { monster: 'Krall Laborer' }] },
    { id: 1005, name: 'Rejected pet', id_mapping_verified: false, locations: [{ monster: 'Krall Laborer' }] },
    { id: 1006, name: 'Unicode pet', locations: [{ monster: 'Célebrant' }] },
  ] };
  assert.deepEqual(petTargetMatches({ id: '99999', name: ' krall   laborer ' }, reference), [
    { id: 1004, name: 'Another pet', monster: 'KRALL LABORER' },
    { id: 1002, name: 'Pet title', monster: 'Krall Laborer' },
  ]);
  for (const name of ['Krall', 'Elite Krall Laborer', 'Krall Laborer Chief', 'Pet title', '', 'Krall\u0000 Laborer']) assert.deepEqual(petTargetMatches({ id: 1002, name }, reference), []);
  assert.deepEqual(petTargetMatches({ id: 1002 }, reference), []);
  assert.equal(petTargetMatches({ name: 'Ce\u0301lebrant' }, reference)[0].id, 1006);
  const actual = catalog.pets.find(row => row.id === 1002);
  assert.ok(petTargetMatches({ name: actual.locations[0].monster }, catalog).some(row => row.id === 1002));
});

test('received NPC template IDs use only validated source-map mappings and override localized or conflicting names', () => {
  const actual = catalog.pets.find(row => row.id === 1002);
  assert.equal(actual.locations[0].verifiedNpcId, 2100075);
  assert.ok(petTargetMatches({ npc_id: 2100075, name: 'Yerelleştirilmiş canavar adı' }, catalog).some(row => row.id === 1002));
  assert.ok(petTargetMatches({ npc_id: 2100480 }, catalog).some(row => row.id === 1002));
  for (const npc_id of [9999999, 1002, 0, '2100075']) assert.deepEqual(petTargetMatches({ npc_id, id: '2100075', name: actual.locations[0].monster }, catalog), []);
  const example = PET_CATALOG.pets.find(row => row.id === 1002);
  const invalid = [
    'https://other.test/en/aion-2/map/verteron?focus=npc:2100075',
    'https://metabot.gg/en/aion-2/mounts/krall-laborer?focus=npc:2100075',
    'https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100075&extra=1',
    'https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100075&focus=npc:2100480',
    'https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100075#other',
    'https://metabot.gg/en/aion-2/map/verteron?focus=npc:02100075',
    'https://metabot.gg/en/aion-2/map/verteron?focus=npc:1002',
  ];
  for (const map_url of invalid) {
    const checked = normalizePetCatalog({ ...PET_CATALOG, pets: [{ ...example, locations: [{ zone: 'Verteron', monster: 'Krall Armed Soldier', map_url, verifiedNpcId: 2100075 }] }] });
    assert.equal(checked.pets[0].locations[0].verifiedNpcId, null);
    assert.deepEqual(petTargetMatches({ npc_id: 2100075 }, checked), []);
  }
});

test('remaining souls use the current tier counter rather than a lifetime count', () => {
  const first = petCompletion(pet(), catalog.requirements, { now });
  assert.equal(first.nextRemaining, 13); assert.equal(first.maxRemaining, 88); assert.equal(first.remaining, 88); assert.equal(first.percent, 48);
  assert.equal(petCompletion(pet(), catalog.requirements, { now, goal: 'next' }).remaining, 13);
  const second = petCompletion(pet({ level: 2, progress: 32 }), catalog.requirements, { now });
  assert.equal(second.nextRemaining, 43); assert.equal(second.maxRemaining, 43);
  assert.equal(petCompletion(pet({ level: 3, progress: null }), catalog.requirements, { now }).remaining, 0);
});

test('a received level reset opens the next tier and later gains advance it without guessing a level from totals', () => {
  const pending = plan([pet({ progress: 25 })]).rows.find(row => row.id === 1002);
  assert.equal(pending.level, 1); assert.equal(pending.status, 'awaiting-level');
  assert.equal(pending.percent, null); assert.equal(pending.remaining, null);
  const reset = pet({ level: 2, progress: 0, progress_source: 'server-level-reset', session_started_at_ms: null, session_gain_events: 0, last_gain_at_ms: null });
  const collection = petPlan(inventory([reset, pet({ pet_id: 1003, progress_stale: true })], { continuity: 'last-known' }), catalog, { localPlayerId: '7', now });
  const next = collection.rows.find(row => row.id === 1002);
  assert.equal(next.level, 2); assert.equal(next.progress, 0); assert.equal(next.required, 75);
  assert.equal(next.remaining, 75); assert.equal(next.percent, 0); assert.equal(next.stale, false);
  assert.equal(next.etaMs, null);
  assert.equal(collection.rows.find(row => row.id === 1003).stale, true);
  const gained = plan([{ ...reset, progress: 3, progress_source: 'server-delta' }]).rows.find(row => row.id === 1002);
  assert.equal(gained.level, 2); assert.equal(gained.remaining, 72); assert.equal(gained.percent, 4);
  const html = renderPetTracker([next]);
  assert.ok(html.includes('Sonraki seviye · 0 / 75'));
  assert.ok(html.includes('75 ruh kaldı'));
  assert.equal(petCompletion(pet({ progress: 0, level: null, progress_source: 'server-level-reset' }), catalog.requirements, { now }).remaining, null);
  assert.equal(petCompletion(pet({ progress: 12, progress_source: 'server-level-reset' }), catalog.requirements, { now }).remaining, null);
});

test('explicit received level zero tracks registration souls while absent levels remain unknown', () => {
  const registration = petCompletion(pet({ level: 0, progress: 2 }), catalog.requirements, { now });
  assert.equal(registration.level, 0);
  assert.equal(registration.status, 'progress');
  assert.equal(registration.required, 5);
  assert.equal(registration.nextRemaining, 3);
  assert.equal(registration.maxRemaining, 103);
  assert.equal(registration.percent, 40);
  assert.equal(petCompletion(pet({ level: 0, progress: 2 }), catalog.requirements, { now, goal: 'next' }).remaining, 3);
  assert.equal(petCompletion(pet({ level: 0, progress: 5 }), catalog.requirements, { now }).status, 'awaiting-level');
  const registered = plan([pet({ level: 0, progress: 2 })]);
  assert.equal(registered.observedCount, 1);
  assert.equal(registered.rows.find(row => row.id === 1002).remaining, 103);
  for (const level of [null, undefined]) {
    const missing = petCompletion(pet({ level, progress: 2 }), catalog.requirements, { now });
    assert.equal(missing.level, null); assert.equal(missing.remaining, null);
  }
});

test('missing counters, unsupported levels, malformed requirements and rollover cannot invent a remaining count', () => {
  for (const value of [{ level: null }, { level: 4 }, { progress: null }, { progress_source: 'unknown' }, { observed_at_ms: now + 1000 }]) assert.equal(petCompletion(pet(value), catalog.requirements, { now }).remaining, null);
  for (const requirements of [null, {}, { souls: [5, 25] }, { souls: [5, -25, 75] }]) assert.equal(petCompletion(pet(), requirements, { now }).remaining, null);
  for (const progress of [25, 26, 1000]) { const value = petCompletion(pet({ progress }), catalog.requirements, { now }); assert.equal(value.status, 'awaiting-level'); assert.equal(value.percent, null); assert.equal(value.remaining, null); }
  assert.equal(plan([]).rows.find(row => row.id === 1002).remaining, null);
});

test('ETA requires enough timed received gains and excludes the first unbased delta', () => {
  const value = petCompletion(pet(), catalog.requirements, { now });
  assert.equal(value.soulsPerMinute, 12); assert.equal(value.etaMs, 440000);
  for (const override of [{ session_started_at_ms: null }, { session_baseline_gained: 12 }, { session_baseline_gained: 13 }, { session_gain_events: 1 }, { session_started_at_ms: now - 1000 }, { last_gain_at_ms: now + 1 }, { last_gain_at_ms: now - 120001 }, { last_gain_at_ms: now - 70000 }]) assert.equal(petCompletion(pet(override), catalog.requirements, { now }).etaMs, null);
});

test('only current authoritative self inventory binds; special and unmapped pets do not inherit ordinary requirements', () => {
  for (const options of [{ localPlayerId: '8' }, { localPlayerId: null }]) assert.equal(plan([pet()], options).observedCount, 0);
  assert.equal(petPlan(inventory([pet()], { source: 'server-self-unbound' }), catalog, { now, localPlayerId: '7' }).observedCount, 0);
  const unknown = plan([pet({ pet_id: 99999 })]).rows.find(row => row.id === 99999);
  assert.equal(unknown.name, ''); assert.equal(unknown.remaining, null);
  assert.equal(plan([pet({ pet_id: 1001 })]).rows.find(row => row.id === 1001).remaining, null);
});

test('pet-only revisions and transient losses request a fresh snapshot while only identity changes clear pet data', () => {
  const previous = { local_player_id: '7', character_revision: 1, character_available: false, diagnostics: { stream_gaps: 0 } };
  assert.deepEqual(petMetadataTransition(previous, { ...previous, character_revision: 2 }), { fetch: true, clear: false });
  assert.deepEqual(petMetadataTransition(previous, { ...previous, character_revision: 2, diagnostics: { stream_gaps: 1 } }), { fetch: true, clear: false });
  assert.deepEqual(petMetadataTransition(previous, { ...previous, diagnostics: { stream_gaps: 1 } }), { fetch: true, clear: false });
  assert.deepEqual(petMetadataTransition({ ...previous, character_available: true }, previous), { fetch: true, clear: false });
  const archived = { ...previous, local_identity_source: 'server', live_team_identity: { local: { actor_id: null, identity_source: 'unknown' } } };
  assert.equal(liveServerActorId(archived), null);
  assert.deepEqual(petMetadataTransition(previous, archived, { previousActorId: '7', currentActorId: liveServerActorId(archived) }), { fetch: true, clear: true });
});

test('last-known verified pet counters keep their bar and remaining souls but cannot produce an ETA', () => {
  const value = petPlan(inventory([pet({ progress_stale: true })], { continuity: 'last-known', stale_reason: 'stream-gap', stale_at_ms: now }), catalog, { localPlayerId: '7', now });
  const row = value.rows.find(row => row.id === 1002);
  assert.equal(value.observedCount, 1);
  assert.equal(value.observed.continuity, 'last-known');
  assert.equal(row.stale, true); assert.equal(row.percent, 48); assert.equal(row.progress, 12);
  assert.equal(row.remaining, 88); assert.equal(row.observedAtMs, now);
  assert.equal(row.soulsPerMinute, null); assert.equal(row.etaMs, null);
  const guide = renderPetGuide(value, catalog, { filters: { query: 'Krall Laborer' } });
  assert.ok(guide.includes('Kesintiden önce alınan pet sayaçları korunuyor.'));
  assert.ok(guide.includes('Son alınan'));
  assert.ok(!guide.includes('Sayaç alınmadı'));
  const tracker = renderPetTracker([{ ...row, etaMs: 5000, automatic: false }]);
  assert.ok(tracker.includes('Son alınan'));
  assert.ok(tracker.includes('aria-valuenow="48.0"'));
  assert.ok(tracker.includes('12 / 25'));
  assert.ok(!tracker.includes('Tahmini'));
  const fresh = plan([pet()]).rows.find(row => row.id === 1002);
  assert.equal(fresh.stale, false); assert.equal(fresh.etaMs, 440000);
  assert.equal(petPlan(value.observed, catalog, { localPlayerId: '8', now }).observedCount, 0);
  const clockReset = petCompletion(pet({ progress_stale: true, observed_at_ms: now + 10000 }), catalog.requirements, { now });
  assert.equal(clockReset.percent, 48); assert.equal(clockReset.remaining, 88); assert.equal(clockReset.etaMs, null);
  assert.equal(petCompletion(pet({ observed_at_ms: now + 10000 }), catalog.requirements, { now }).percent, null);
});

test('tracker shows level, numerator, percentage and color progress in both regular and compact views', () => {
  const value = plan([pet(), pet({ pet_id: 1003, progress: 15 }), pet({ pet_id: 1004, progress: 22 })]);
  const rows = value.rows.filter(row => [1002, 1003, 1004].includes(row.id));
  const regular = renderPetTracker(rows);
  assert.ok(regular.includes('Lv.1'));
  assert.ok(regular.includes('Sonraki seviye · 12 / 25'));
  assert.ok(regular.includes('Seviye 3 · 88 ruh kaldı'));
  assert.ok(regular.includes('48%'));
  for (const tone of ['low', 'medium', 'high']) assert.ok(regular.includes(`pet-progress-track is-${tone}`));
  assert.ok(regular.includes('aria-label="Krall Laborer · Seviye ilerlemesi"'));
  const compact = renderPetTracker(rows, { compact: true });
  assert.ok(compact.includes('12 / 25'));
  assert.ok(compact.includes('48%'));
  assert.ok(compact.includes('style="width:48%"'));
  assert.equal((compact.match(/<article class="pet-tracker-row/g) || []).length, 3);
  for (const id of [1002, 1003, 1004]) assert.ok(compact.includes(`data-pet-action="open" data-id="${id}"`));
  const unknown = renderPetTracker([plan([]).rows.find(row => row.id === 1002)]);
  assert.ok(unknown.includes('is-unknown'));
  assert.ok(!unknown.includes('role="progressbar"'));
  assert.ok(!unknown.includes('class="pet-tracker-percent">0%'));
  assert.ok(unknown.includes('class="pet-tracker-percent">—'));
});

test('received points without a level remain visible in the tracker without invented tiers or percentages', () => {
  const row = plan([pet({ level: null, progress: 12 })]).rows.find(row => row.id === 1002);
  assert.equal(row.progress, 12); assert.equal(row.level, null); assert.equal(row.required, null);
  assert.equal(row.remaining, null); assert.equal(row.percent, null); assert.equal(row.etaMs, null);
  const tracker = renderPetTracker([row]);
  assert.ok(tracker.includes('Alınan sayaç · 12'));
  assert.ok(tracker.includes('Sayaç alındı · seviye bekleniyor'));
  assert.ok(!tracker.includes('Sayaç alınmadı'));
  assert.ok(!tracker.includes('role="progressbar"'));
  assert.ok(!tracker.includes('12 / 25'));
  const guide = renderPetGuide(plan([pet({ level: null, progress: 12 })]), catalog, { filters: { query: 'Krall Laborer' } });
  assert.ok(guide.includes('Alınan sayaç: 12'));
  assert.ok(guide.includes('Sayaç alındı · seviye bekleniyor'));
  assert.ok(!guide.includes('Sayaç alınmadı'));
  const en = renderPetTracker([row], { locale: 'en' });
  assert.ok(en.includes('Received counter · 12'));
  assert.ok(en.includes('Counter received · waiting for level'));
  assert.ok(!en.includes('Counter not received'));
});

test('pinning a gains-only pet keeps its live session counter visible before the login baseline arrives', () => {
  const value = plan([pet({ level: null, progress: null, progress_source: 'unknown', session_gained: 11 })]);
  const row = value.rows.find(row => row.id === 1002);
  for (const automatic of [false, true]) for (const compact of [false, true]) {
    const html = renderPetTracker([{ ...row, automatic }], { compact });
    assert.ok(html.includes('Bu oturumda +11 ruh'));
    assert.ok(html.includes('Seviye ve toplam sayaç bekleniyor'));
    assert.ok(!html.includes('Sayaç alınmadı'));
    assert.ok(!html.includes('role="progressbar"'));
    assert.ok(!html.includes('11 / 25'));
    assert.ok(!html.includes('Tahmini'));
    assert.ok(html.includes(automatic ? 'data-pet-action="pin"' : 'data-pet-action="unpin"'));
  }
  const english = renderPetTracker([row], { locale: 'en' });
  assert.ok(english.includes('This session +11 souls'));
  assert.ok(english.includes('Waiting for level and total counter'));
  const guide = renderPetGuide(value, catalog, { filters: { query: 'Krall Laborer' }, pins: [1002] });
  assert.ok(guide.includes('Bu oturumda +11 ruh'));
  assert.ok(!guide.includes('Sayaç alınmadı'));
  const baseline = renderPetTracker([plan([pet({ session_gained: 11 })]).rows.find(row => row.id === 1002)]);
  assert.ok(baseline.includes('12 / 25'));
  assert.ok(baseline.includes('Bu oturumda +11'));
});

test('raw counters with unknown requirements and stale points keep their precise missing-data reason', () => {
  const value = plan([pet({ pet_id: 1001, progress: 8 }), pet({ pet_id: 1002, level: null, progress: 0, progress_stale: true })]);
  const special = value.rows.find(row => row.id === 1001), stale = value.rows.find(row => row.id === 1002);
  assert.equal(special.required, null); assert.equal(special.progress, 8);
  const html = renderPetTracker([special, stale]);
  assert.ok(html.includes('Alınan sayaç · 8'));
  assert.ok(html.includes('Sayaç alındı · seviye hedefi doğrulanmadı'));
  assert.ok(html.includes('Alınan sayaç · 0'));
  assert.ok(html.includes('Son alınan'));
  assert.ok(!html.includes('Tahmini'));
  assert.ok(!html.includes('Sayaç alınmadı'));
  for (const input of [pet({ progress_source: 'unknown' }), pet({ progress_source: 'server-level-reset', level: null, progress: 0 }), pet({ observed_at_ms: now + 1000 })]) {
    assert.equal(petCompletion(input, catalog.requirements, { now }).progress, null);
  }
});

test('compact tracker keeps every pin reachable and removable instead of dropping all but the first', () => {
  const ids = [1002, 1003, 1004, 1005, 1006, 1007];
  const rows = trackedPets(plan(ids.map(pet_id => pet({ pet_id }))), ids, { now });
  const html = renderPetTracker(rows, { compact: true });
  assert.equal((html.match(/<article class="pet-tracker-row/g) || []).length, ids.length);
  assert.ok(html.includes('pet-tracker-rows is-compact'));
  for (const id of ids) {
    assert.ok(html.includes(`data-pet-action="open" data-id="${id}"`));
    assert.ok(html.includes(`data-pet-action="unpin" data-id="${id}"`));
  }
  const collapsed = renderPetTracker(rows, { compact: true, collapsed: true });
  assert.ok(collapsed.includes('class="pet-tracker-rows is-compact" hidden'));
  assert.equal((collapsed.match(/<article class="pet-tracker-row/g) || []).length, ids.length);
});

test('six pinned pets retain independent counters and only the interrupted row loses its ETA', () => {
  const ids = [1002, 1003, 1004, 1005, 1006, 1007];
  const value = plan(ids.map((pet_id, index) => pet({ pet_id, level: index === 5 ? 2 : 1, progress: index + 1, progress_stale: index === 2 })), { pins: ids });
  const rows = trackedPets(value, ids, { now });
  assert.equal(rows.length, 6);
  for (const [index, row] of rows.entries()) {
    assert.equal(row.id, ids[index]); assert.equal(row.progress, index + 1);
    assert.equal(row.required, index === 5 ? 75 : 25);
    assert.equal(row.remaining, index === 5 ? 69 : 100 - (index + 1));
    assert.equal(row.stale, index === 2);
    assert.equal(row.etaMs === null, index === 2);
  }
  const tracker = renderPetTracker(rows);
  assert.equal((tracker.match(/<article class="pet-tracker-row/g) || []).length, 6);
  assert.equal((tracker.match(/pet-tracker-row is-stale/g) || []).length, 1);
  assert.ok(tracker.includes('Sonraki seviye · 6 / 75'));
  assert.ok(tracker.includes('Sonraki seviye · 3 / 25'));
  assert.ok(tracker.includes('Pet takibi · 6'));
});

test('filtering and pagination preserve live unknowns without treating unobserved pets as completed or zero', () => {
  const value = plan([pet(), pet({ pet_id: 1003, level: 3, progress: null })]);
  assert.equal(filteredPets(value, { query: 'KRALL LABORER' }).rows[0].id, 1002);
  assert.equal(filteredPets(value, { query: 'Verteron Fortress Ruins' }).rows.some(row => row.id === 1002), true);
  assert.equal(filteredPets(value, { status: 'complete' }).total, 1);
  assert.equal(filteredPets(value, { status: 'observed' }).total, 2);
  assert.equal(filteredPets(value, { status: 'pinned', pins: [1002] }).total, 1);
  assert.equal(filteredPets(value, { status: 'incomplete' }).total, 206);
  assert.equal(filteredPets(value, { page: 999 }).page, 8);
});

test('received-only empty state exposes reference catalog without inventing live data or losing the search', () => {
  const value = petPlan(null, catalog, { localPlayerId: '7', now });
  const filters = { query: 'Distorted Mutant', genus: 'Varian', status: 'observed', faction: 'all', sort: 'remaining', page: 3 };
  const guide = renderPetGuide(value, catalog, { filters });
  assert.equal(filteredPets(value, filters).total, 0);
  assert.ok(guide.includes('Canlı pet sayaçları bekleniyor'));
  assert.ok(guide.includes('Henüz verisi alınan pet yok.'));
  assert.ok(guide.includes('data-action="pet-guide-catalog"'));
  assert.ok(guide.includes('data-action="pet-guide-reset"'));
  assert.ok(guide.includes('data-action="refresh-pets"'));
  assert.ok(guide.includes('Pet verileri doğrulanan karakter ve sunucu için otomatik kaydedilir'));
  assert.ok(!guide.includes('karakter seçimine dönüp'));
  assert.ok(!guide.includes('class="pet-guide-card'));
  const catalogFilters = petGuideFilterAction(filters, 'pet-guide-catalog');
  assert.deepEqual(catalogFilters, { ...filters, status: 'all', page: 0 });
  const result = filteredPets(value, catalogFilters);
  assert.equal(result.total, 1); assert.equal(result.rows[0].name, 'Distorted Mutant');
  assert.equal(result.rows[0].observed, false); assert.equal(result.rows[0].remaining, null);
  const reference = renderPetGuide(value, catalog, { filters: catalogFilters });
  assert.ok(reference.includes('data-action="pet-pin" data-id="1142"'));
  assert.ok(reference.includes('Sayaç alınmadı'));
  assert.equal(value.observedCount, 0);
});

test('filter reset preserves sort and distinguishes unmatched searches from empty pins', () => {
  const value = plan();
  const filters = { query: 'No such pet', genus: 'Varian', status: 'complete', faction: 'asmodian', sort: 'recent', page: 7 };
  const reset = petGuideFilterAction(filters, 'pet-guide-reset');
  assert.deepEqual(reset, { query: '', genus: 'all', status: 'all', faction: 'all', sort: 'recent', page: 0 });
  assert.equal(filteredPets(value, reset).total, 207);
  assert.deepEqual(petGuideFilterAction(filters, 'other'), filters);
  assert.equal(filters.query, 'No such pet');
  const unmatched = renderPetGuide(value, catalog, { filters: { query: 'No such pet' } });
  assert.ok(unmatched.includes('Filtrelere uyan pet yok.'));
  assert.ok(unmatched.includes('Başka bir ad, bölge veya tür dene'));
  assert.ok(!unmatched.includes('Henüz verisi alınan pet yok.'));
  const pinned = renderPetGuide(value, catalog, { filters: { status: 'pinned' } });
  assert.ok(pinned.includes('Henüz pet sabitlenmedi.'));
  assert.ok(pinned.includes('Canlı sayacı alınmadan da pet sabitlenebilir.'));
  assert.ok(!pinned.includes('Filtrelere uyan pet yok.'));
  const all = renderPetGuide(value, catalog);
  assert.ok(all.includes('data-action="pet-guide-reset"'));
  const selected = renderPetGuide(value, catalog, { filters: { query: 'No such pet' }, selectedId: 1002 });
  assert.ok(selected.includes('data-state-key="pet-1002" open'));
  assert.ok(!selected.includes('class="status-card pet-empty-state"'));
});

test('pins persist uniquely and stay bounded; explicit pins take priority over automatic tracking', () => {
  const ids = [1002, 1002, ...Array.from({ length: 20 }, (_, index) => 1003 + index), '1009', 0];
  assert.deepEqual(normalizePreferences({ petPins: ids }).petPins, normalizePetPins(ids));
  assert.equal(normalizePetPins(ids).length, PET_PIN_LIMIT);
  const value = plan([pet(), pet({ pet_id: 1003, last_gain_at_ms: now })]);
  assert.equal(trackedPets(value, [], { now })[0].id, 1003);
  assert.equal(trackedPets(value, [1002], { now })[0].id, 1002);
  assert.equal(trackedPets(value, [], { automatic: false, now }).length, 0);
});

test('pinning a known reference pet opens a collapsed hidden tracker without requiring a live counter', () => {
  const reference = petPlan(null, catalog, { localPlayerId: '7', now });
  const preferences = Object.freeze({ petPins: Object.freeze([1002]), showPetTracker: false, petTrackerCollapsed: true, petGoal: 'next', theme: 'pearl', displayModules: Object.freeze({ pets: true, dps: false }) });
  const change = petPinTransition(preferences, 1003, reference);
  assert.equal(reference.observedCount, 0);
  assert.equal(change.status, 'added');
  assert.deepEqual(change.patch, { petPins: [1002, 1003], showPetTracker: true, petTrackerCollapsed: false });
  const merged = { ...preferences, ...change.patch };
  assert.equal(merged.petGoal, 'next'); assert.equal(merged.theme, 'pearl');
  assert.equal(merged.displayModules, preferences.displayModules);
  assert.deepEqual(preferences.petPins, [1002]);
  const rows = trackedPets(reference, merged.petPins, { now });
  assert.equal(rows.length, 2); assert.ok(rows.every(row => row.remaining === null));
});

test('successive pin selections append independently, normalize duplicates and stop at twelve without dropping saved pets', () => {
  const reference = plan([]);
  let preferences = { petPins: [1002, 1002, '1003', -1], petTrackerCollapsed: true };
  for (const id of Array.from({ length: PET_PIN_LIMIT - 1 }, (_, index) => 1003 + index)) {
    const result = petPinTransition(preferences, id, reference);
    assert.equal(result.status, 'added');
    preferences = { ...preferences, ...result.patch };
  }
  const expected = Array.from({ length: 12 }, (_, index) => 1002 + index);
  assert.deepEqual(preferences.petPins, expected);
  const full = petPinTransition(preferences, 1014, reference);
  assert.deepEqual(full, { status: 'limit', patch: null });
  assert.deepEqual(preferences.petPins, expected);
});

test('recent untracked gains append one automatic row after all twelve pins without replacing a pin', () => {
  const ids = Array.from({ length: 12 }, (_, index) => 1002 + index);
  const rows = ids.map((pet_id, index) => pet({ pet_id, progress: index + 1 }));
  const value = plan([...rows, pet({ pet_id: 1014, last_gain_at_ms: now - 100 }), pet({ pet_id: 1015, last_gain_at_ms: now - 200 })], { pins: ids });
  const tracked = trackedPets(value, ids, { now });
  assert.equal(PET_PIN_LIMIT, 12);
  assert.deepEqual(tracked.slice(0, 12).map(row => row.id), ids);
  assert.ok(tracked.slice(0, 12).every(row => row.automatic === false));
  assert.equal(tracked.length, 13); assert.equal(tracked[12].id, 1014); assert.equal(tracked[12].automatic, true);
  const html = renderPetTracker(tracked, { compact: true });
  assert.equal((html.match(/<article class="pet-tracker-row/g) || []).length, 13);
  assert.equal((html.match(/data-pet-action="unpin"/g) || []).length, 12);
  assert.ok(html.includes('data-pet-action="pin" data-id="1014"'));
  assert.match(html, /data-pet-action="pin" data-id="1014"[^>]* disabled/);
  assert.ok(html.includes('En fazla 12 pet sabitlenebilir'));
  assert.deepEqual(trackedPets(value, ids, { now, automatic: false }).map(row => row.id), ids);
});

test('automatic tracking requires recent real timed gains, with no first-pet or summoned fallback', () => {
  for (const overrides of [
    { session_gained: 0 }, { last_gain_at_ms: null }, { last_gain_at_ms: now + 1 },
    { last_gain_at_ms: now - 120001 }, { progress_stale: true }, { level: 3, progress: null },
  ]) {
    const value = plan([pet(overrides)]);
    assert.deepEqual(trackedPets(value, [], { now }), []);
  }
  const current = plan([pet({ last_gain_at_ms: now - 120000 })]);
  assert.equal(trackedPets(current, [], { now })[0].id, 1002);
  assert.equal(trackedPets(current, [], { now, automatic: false }).length, 0);
  const html = renderPetTracker(trackedPets(current, [], { now }));
  assert.ok(html.includes('Yeni ruh kazanımı · Bu oturumda +12'));
  assert.match(html, /data-pet-action="pin" data-id="1002"[^>]*>/);
  assert.doesNotMatch(html, /data-pet-action="pin"[^>]*disabled/);
  const pinned = trackedPets(current, [1002], { now });
  assert.equal(pinned.length, 1); assert.equal(pinned[0].automatic, false);
});

test('unpinning patches only the list and allows a missing saved pet to be removed', () => {
  const preferences = { petPins: [1002, 99999], showPetTracker: false, petTrackerCollapsed: true, petGoal: 'max' };
  const change = petPinTransition(preferences, 99999, { rows: [] });
  assert.deepEqual(change, { status: 'removed', patch: { petPins: [1002] } });
  const merged = { ...preferences, ...change.patch };
  assert.equal(merged.showPetTracker, false); assert.equal(merged.petTrackerCollapsed, true); assert.equal(merged.petGoal, 'max');
  assert.deepEqual(preferences.petPins, [1002, 99999]);
});

test('pin requests reject invalid or unknown new IDs without a preference patch', () => {
  const reference = plan([]);
  for (const id of [null, undefined, '1002', 0, 999, 100000, 1002.5, 99999]) assert.deepEqual(petPinTransition({ petPins: [] }, id, reference), { status: 'invalid', patch: null });
  for (const invalidPlan of [null, [], {}, { rows: [null, {}, { id: '1002' }] }]) assert.deepEqual(petPinTransition({ petPins: [] }, 1002, invalidPlan), { status: 'invalid', patch: null });
});

test('catalog links cannot introduce credentials, arbitrary hosts or executable protocols', () => {
  for (const value of ['javascript:alert(1)', 'https://metabot.gg.evil.test/en/aion-2/map/verteron', 'https://name@metabot.gg/en/aion-2/map/verteron', 'https://metabot.gg:8443/en/aion-2/map/verteron', 'https://metabot.gg/en/account']) assert.equal(petReferenceUrl(value), '');
  assert.ok(petReferenceUrl('https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100075'));
});

test('a pinned pet missing from both catalog and the next login remains visible and removable without invented progress', () => {
  const saved = normalizePreferences({ petPins: [99999] });
  const value = petPlan(null, catalog, { now, localPlayerId: '7', pins: saved.petPins });
  const rows = trackedPets(value, saved.petPins, { now });
  assert.equal(value.observedCount, 0); assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 99999); assert.equal(rows[0].name, '');
  assert.equal(rows[0].observed, false); assert.equal(rows[0].remaining, null);
  assert.equal(filteredPets(value, { status: 'pinned', pins: saved.petPins }).total, 1);
  assert.ok(renderPetTracker(rows).includes('data-pet-action="unpin" data-id="99999"'));
  assert.ok(renderPetGuide(value, catalog, { pins: saved.petPins, filters: { query: '99999' } }).includes('data-action="pet-pin" data-id="99999" aria-pressed="true"'));
});

test('rendered guide and tracker escape names and retain ordinary source attribution anchors', () => {
  const value = plan(), item = value.rows.find(row => row.id === 1002);
  item.name = '<img src=x onerror=alert(1)>';
  const guide = renderPetGuide(value, catalog, { filters: { query: 'onerror' }, pins: [1002] });
  const tracker = renderPetTracker([{ ...item, automatic: false }]);
  assert.ok(!guide.includes('<img src=x') && !tracker.includes('<img src=x'));
  assert.ok(guide.includes('&lt;img src=x'));
  assert.ok(guide.includes('href="https://metabot.gg/en/aion-2/mounts/krall-laborer"'));
  assert.ok(!guide.includes('nofollow'));
});


test('a fresh soul event can auto-track a cached pet without pretending its older counter is live', () => {
  const current = petPlan(inventory([pet({ progress_stale: true })], { continuity: 'last-known', stale_reason: 'previous-session', inventory_complete: false }), catalog, { localPlayerId: '7', now });
  const rows = trackedPets(current, [], { now });
  assert.equal(rows.length, 1); assert.equal(rows[0].automatic, true); assert.equal(rows[0].stale, true);
  assert.equal(rows[0].etaMs, null);
  const html = renderPetTracker(rows);
  assert.ok(html.includes('Son alınan')); assert.ok(html.includes('Bu oturumda +12'));
  assert.ok(html.includes('data-pet-action="pin"')); assert.ok(!html.includes('Tahmini'));
  for (const input of [{ session_gained: 0 }, { last_gain_at_ms: null }]) {
    const oldOnly = petPlan(inventory([pet({ ...input, progress_stale: true })], { continuity: 'last-known', stale_reason: 'previous-session' }), catalog, { localPlayerId: '7', now });
    assert.deepEqual(trackedPets(oldOnly, [], { now }), []);
  }
});
