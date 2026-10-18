import test from 'node:test';
import assert from 'node:assert/strict';
import { PET_CATALOG, PET_DATA_NOTICE } from '../pet-catalog.mjs';
import { normalizePreferences, liveServerActorId } from '../model.mjs';
import { normalizePetCatalog, petCompletion, petPlan, filteredPets, trackedPets, normalizePetPins, petReferenceUrl, petMetadataTransition, renderPetGuide, renderPetTracker } from '../pets.mjs';

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

test('missing counters, unsupported levels, malformed requirements and rollover cannot invent a remaining count', () => {
  for (const value of [{ level: null }, { level: 0 }, { progress: null }, { progress_source: 'unknown' }, { observed_at_ms: now + 1000 }]) assert.equal(petCompletion(pet(value), catalog.requirements, { now }).remaining, null);
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

test('pet-only revision changes refresh even when build availability remains false, while loss invalidates immediately', () => {
  const previous = { local_player_id: '7', character_revision: 1, character_available: false, diagnostics: { stream_gaps: 0 } };
  assert.deepEqual(petMetadataTransition(previous, { ...previous, character_revision: 2 }), { fetch: true, clear: false });
  assert.deepEqual(petMetadataTransition(previous, { ...previous, character_revision: 2, diagnostics: { stream_gaps: 1 } }), { fetch: true, clear: true });
  const archived = { ...previous, local_identity_source: 'server', live_team_identity: { local: { actor_id: null, identity_source: 'unknown' } } };
  assert.equal(liveServerActorId(archived), null);
  assert.deepEqual(petMetadataTransition(previous, archived, { previousActorId: '7', currentActorId: liveServerActorId(archived) }), { fetch: true, clear: true });
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
