import test from 'node:test';
import assert from 'node:assert/strict';
import { PET_CATALOG, PET_DATA_NOTICE } from '../pet-catalog.mjs';
import { normalizePreferences, liveServerActorId } from '../model.mjs';
import { normalizePetCatalog, petCompletion, petPlan, filteredPets, petGuideFilterAction, trackedPets, normalizePetPins, petReferenceUrl, petMetadataTransition, renderPetGuide, renderPetTracker } from '../pets.mjs';

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

test('remaining souls use the current tier counter rather than a lifetime count', () => {
  const first = petCompletion(pet(), catalog.requirements, { now });
  assert.equal(first.nextRemaining, 13); assert.equal(first.maxRemaining, 88); assert.equal(first.remaining, 88); assert.equal(first.percent, 48);
  assert.equal(petCompletion(pet(), catalog.requirements, { now, goal: 'next' }).remaining, 13);
  const second = petCompletion(pet({ level: 2, progress: 32 }), catalog.requirements, { now });
  assert.equal(second.nextRemaining, 43); assert.equal(second.maxRemaining, 43);
  assert.equal(petCompletion(pet({ level: 3, progress: null }), catalog.requirements, { now }).remaining, 0);
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
  assert.equal((compact.match(/class="pet-tracker-row/g) || []).length, 2); // container and the first visible pet
  const unknown = renderPetTracker([plan([]).rows.find(row => row.id === 1002)]);
  assert.ok(unknown.includes('is-unknown'));
  assert.ok(!unknown.includes('role="progressbar"'));
  assert.ok(!unknown.includes('class="pet-tracker-percent">0%'));
  assert.ok(unknown.includes('class="pet-tracker-percent">—'));
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
  assert.ok(guide.includes('karakter seçimine dönüp bir kez tekrar giriş yap'));
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
  const ids = [1002, 1002, 1003, 1004, 1005, 1006, 1007, 1008, '1009', 0];
  assert.deepEqual(normalizePreferences({ petPins: ids }).petPins, normalizePetPins(ids));
  assert.equal(normalizePetPins(ids).length, 6);
  const value = plan([pet(), pet({ pet_id: 1003, last_gain_at_ms: now })]);
  assert.equal(trackedPets(value, [], { now })[0].id, 1003);
  assert.equal(trackedPets(value, [1002], { now })[0].id, 1002);
  assert.equal(trackedPets(value, [], { automatic: false, now }).length, 0);
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
