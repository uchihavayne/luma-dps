import test from 'node:test';
import assert from 'node:assert/strict';
import { communityUrl, communityShareLink, communityFilters, communityShareOptions, communityEligibility, communitySummary, communitySnapshot, communityRankings, communityStatistics, createCommunityController, renderCommunity, renderCommunityStatistics } from '../community.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const share = id => ({ id, url: `https://reports.example.test/r/${id}`, created_at_ms: 1792000000000, scope: 'personal', anonymous: true, rank_opt_in: false, local_record_id: '7', validation: 'community' });
const rank = (id, dps = 1234) => ({ rank: 1, share_id: id, url: `https://reports.example.test/r/${id}`, name: 'Player 1', class_name: 'ranger', dps, total_damage: dps * 60, duration_ms: 60000, scope: 'personal', region: 'EU', boss: 'Boss' });
const fixture = overrides => createCommunityController({ readState: async () => ({ configured: true, endpoint: 'https://reports.example.test', shares: [share('old')] }), readRankings: async () => ({ entries: [rank('old')], total: 1 }), publish: async () => share('new'), revoke: async () => ({}), ...overrides });

test('sharing defaults to anonymous personal scope and never opts a record into rankings implicitly', () => {
  assert.deepEqual(communityShareOptions(), { scope: 'personal', anonymous: true, rank_opt_in: false, context: { region: '', server: '', boss: '', difficulty: '' }, visibility: 'public' });
  assert.equal(communityShareOptions({ anonymous: false }).anonymous, false);
  assert.equal(communityShareOptions({ anonymous: 'false', rank_opt_in: 'true' }).anonymous, true);
  assert.equal(communityShareOptions({ anonymous: 'false', rank_opt_in: 'true' }).rank_opt_in, false);
  assert.equal(communityShareOptions({ scope: 'party', rank_opt_in: true }).rank_opt_in, false);
  assert.equal(communityShareOptions({ scope: 'observed', rank_opt_in: true }).rank_opt_in, false);
});

test('private and unlisted visibility never ranks implicitly or exposes capabilities in routine state', () => {
  for (const visibility of ['unlisted', 'private']) {
    const options = communityShareOptions({ visibility, rank_opt_in: true });
    assert.equal(options.visibility, visibility); assert.equal(options.rank_opt_in, false);
    assert.equal(communityEligibility({}, options), 'publicOnly');
  }
  const key = 'a'.repeat(64), url = `https://reports.example.test/r/abc#view=${key}`;
  assert.equal(communityUrl(url), '');
  assert.equal(communityShareLink(url, 'private'), url);
  assert.equal(communityShareLink(url), '');
  assert.equal(communityShareLink('https://reports.example.test/r/abc?view=secret', 'private'), '');
  const state = communitySnapshot({ shares: [{ ...share('private'), visibility: 'private', view_token: key }, { ...share('leak'), url }] });
  assert.equal(state.shares.length, 1); assert.equal(state.shares[0].visibility, 'private');
  assert.doesNotMatch(JSON.stringify(state), /aaaaaaa|view_token/);
});

const stats = (dps = 5000) => ({ source: 'community-upload', weighting: 'submitted-records', status: 'available', cohort_minimum: 5, entries: [{ class_name: 'Ranger', count: 5, cp_known_count: 4, status: 'available', minimum_dps: 1000, maximum_dps: dps, median_dps: 3000, p95_dps: dps }] });

test('class cohorts preserve unavailable quantiles and percentiles cannot be manufactured from sparse or invalid counts', () => {
  assert.equal(communityStatistics().status, 'unavailable');
  const value = stats(); value.entries[0].count = 4; value.entries[0].cp_known_count = 4;
  assert.equal(communityStatistics(value).entries[0].median_dps, null);
  assert.equal(communityStatistics(stats()).entries[0].median_dps, 3000);
  const inconsistent = stats(); inconsistent.entries[0].median_dps = 99999;
  assert.equal(communityStatistics(inconsistent).entries[0].p95_dps, null);
  assert.equal(communityRankings({ entries: [{ ...rank('valid'), percentile: 90, cohort_count: 4, percentile_method: 'record-midrank' }] }).entries[0].percentile, null);
  assert.equal(communityRankings({ entries: [{ ...rank('valid'), percentile: 90, cohort_count: 5, percentile_method: 'record-midrank', combat_power: 356559 }] }).entries[0].percentile, 90);
  assert.equal(communityRankings({ entries: [{ ...rank('valid'), combat_power: 0 }] }).entries[0].combat_power, null);
  assert.equal(communityFilters({ cp_band: '300000-399999' }).cp_band, '300000-399999');
  assert.equal(communityFilters({ cp_band: '0 OR 1=1' }).cp_band, '');
});

test('statistics follow filters with independent errors and stale queries cannot replace a fresh cohort', async () => {
  const old = deferred();
  const service = fixture({ readStatistics: filters => filters.server === 'old' ? old.promise : Promise.resolve(stats(6000)) });
  const older = service.refreshRankings({ server: 'old' });
  await service.refreshRankings({ server: 'new' });
  old.resolve(stats(5000)); await older;
  assert.equal(service.view.statistics.entries[0].maximum_dps, 6000);
  assert.equal(service.view.filters.server, 'new'); assert.equal(service.view.readingStatistics, false);
  const failed = fixture({ readStatistics: async () => { throw new Error('stats offline'); } });
  await failed.refreshRankings();
  assert.equal(failed.view.rankings.entries.length, 1); assert.equal(failed.view.error, '');
  assert.equal(failed.view.statistics.status, 'unavailable'); assert.match(failed.view.statisticsError, /stats offline/);
});

test('privacy and cohort rendering includes same-interface controls, bounded escaped labels and no private key field', () => {
  const value = communitySnapshot({ configured: true, shares: [{ ...share('abc'), visibility: 'private', view_token: 'a'.repeat(64) }] });
  const view = { state: value, rankings: communityRankings(), mutation: false, statistics: stats() };
  const html = renderCommunity({ view, locale: 'en', native: true, draft: { visibility: 'private' } });
  assert.match(html, /name="communityVisibility"/); assert.match(html, /name="rankingCpBand"/); assert.match(html, /Private link/); assert.match(html, /Class statistics/);
  assert.doesNotMatch(html, /aaaaaaa|data-community-url="abc"/);
  const malicious = stats(); malicious.entries[0].class_name = '<script>alert(1)</script>';
  const rendered = renderCommunityStatistics(malicious, { locale: 'en' });
  assert.doesNotMatch(rendered, /<script>/); assert.match(rendered, /&lt;script&gt;/); assert.match(rendered, /not unique players/);
});

test('public URLs reject executable protocols, credentials and malformed values', () => {
  assert.equal(communityUrl('https://reports.example.test/r/abc'), 'https://reports.example.test/r/abc');
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'http://reports.example.test', 'https://user:secret@reports.example.test', '//reports.example.test', '/r/abc', null, {}, 'https://a.test/' + 'x'.repeat(2048)]) assert.equal(communityUrl(value), '');
});

test('filters preserve only bounded expected context and valid class/scope values', () => {
  const value = communityFilters({ region: ' EU\n', server: 'a'.repeat(200), boss: '<script>', class_name: 'RANGER', difficulty: 'Nightmare', scope: 'party', limit: 100000, delete_token: 'private' });
  assert.equal(value.region, 'EU'); assert.equal(value.server.length, 80); assert.equal(value.class_name, 'ranger'); assert.equal(value.limit, 25); assert.equal(value.scope, 'party');
  assert.equal(Object.hasOwn(value, 'delete_token'), false);
  assert.equal(communityFilters({ class_name: 'script', scope: 'world' }).class_name, '');
  assert.equal(communityFilters({ scope: 'world' }).scope, 'personal');
});

test('community snapshots never expose upload credentials or deletion secrets to UI', () => {
  const result = communitySnapshot({ configured: true, endpoint: 'https://reports.example.test', token: 'private-global', shares: [{ ...share('abc'), token: 'private-delete', raw_packet: 'secret' }, { ...share('bad'), url: 'javascript:alert(1)' }] });
  assert.equal(result.shares.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /private|secret|raw_packet/);
  assert.equal(result.shares[0].validation, 'community');
  assert.equal(communitySnapshot().configured, false);
});

test('rankings keep received positions and reject malformed public rows rather than inventing local ranks', () => {
  const result = communityRankings({ entries: [rank('valid'), { ...rank('nan'), dps: NaN }, { ...rank('duration'), duration_ms: 0 }, { ...rank('negative'), rank: -1 }, { ...rank('fraction'), rank: 1.5 }, { ...rank('badurl'), url: 'javascript:alert(1)' }], total: 5 });
  assert.equal(result.entries.length, 1); assert.equal(result.entries[0].rank, 1); assert.equal(result.total, 5);
  assert.equal(communityRankings().entries.length, 0);
});

test('ranking cursors are bounded numeric strings and each response remains one 25-row page', () => {
  assert.equal(communityFilters({ cursor: '0025' }).cursor, '25');
  assert.equal(communityRankings({ next_cursor: '50' }).next_cursor, '50');
  for (const cursor of ['-1', '5001', '10000', '00025', '25x', 'javascript:1', 25, null]) {
    assert.equal(communityFilters({ cursor }).cursor, '0');
    assert.equal(communityRankings({ next_cursor: cursor }).next_cursor, '');
  }
  const entries = Array.from({ length: 60 }, (_, index) => ({ ...rank(`id${index}`), rank: index + 1 }));
  assert.equal(communityRankings({ entries, total: 60 }).entries.length, 25);
});

test('basic ranking eligibility explains source, duration, identity, completeness and scope separately', () => {
  const record = { provenance: 'received', source: 'captured', local_player_id: '7', local_identity_source: 'server', players: [{ id: '7', identity_confirmed: true, class_name: 'Ranger' }], personal_elapsed_ms: 60000, personal_total_damage: 2000, personal_targets: [{ name: 'Boss', is_boss: true }], sample_complete: true };
  const context = { region: 'EU', server: 'Example', boss: 'Boss', difficulty: 'Normal' };
  assert.equal(communityEligibility(record, { context }), 'eligible');
  assert.equal(communityEligibility(record, { context: { ...context, boss: 'Other boss' } }), 'contextRequired');
  assert.equal(communityEligibility({ ...record, personal_targets: [...record.personal_targets, { name: 'Add', is_boss: false }] }, { context }), 'bossRequired');
  assert.equal(communityEligibility(record, { scope: 'party' }), 'personalOnly');
  assert.equal(communityEligibility({ ...record, provenance: 'imported-unverified' }), 'receivedOnly');
  assert.equal(communityEligibility({ ...record, provenance: 'demo' }), 'receivedOnly');
  assert.equal(communityEligibility({ ...record, local_identity_source: 'unresolved' }), 'identityRequired');
  assert.equal(communityEligibility({ ...record, local_identity_source: 'manual' }), 'identityRequired');
  assert.equal(communityEligibility({ ...record, sample_complete: false }), 'completeRequired');
  assert.equal(communityEligibility({ ...record, stream_gaps: 1 }), 'completeRequired');
  assert.equal(communityEligibility({ ...record, personal_elapsed_ms: 9999 }), 'durationRequired');
  assert.equal(communityEligibility({ ...record, personal_targets: [] }), 'bossRequired');
  assert.equal(communityEligibility({ ...record, personal_targets: [] }, { context: { boss: 'User labelled boss' } }), 'bossRequired');
  assert.equal(communityEligibility(record), 'contextRequired');
  assert.equal(communityEligibility({ ...record, players: [{ id: '7', identity_confirmed: true, class_name: 'Unknown' }] }, { context }), 'classRequired');
});

test('free text summaries use personal or explicit observed scope, seconds and anonymous third-party labels', () => {
  const record = { total_damage: 3_000_000, dps: 50_000, elapsed_ms: 60_000, local_player_id: 'self', local_identity_source: 'server', personal_total_damage: 1_200_000, personal_dps: 20_000, personal_elapsed_ms: 60_000, players: [{ id: 'other', name: 'OtherPrivate', damage: 1_800_000, dps: 30_000, class_name: 'Cleric' }, { id: 'self', name: 'MyPrivate', damage: 1_200_000, dps: 20_000, class_name: 'Ranger' }] };
  const personal = communitySummary(record);
  assert.match(personal, /20K\/sn/); assert.match(personal, /1.2M/); assert.doesNotMatch(personal, /OtherPrivate|MyPrivate|30K/);
  const observed = communitySummary(record, { scope: 'observed', anonymous: false, locale: 'en' });
  assert.match(observed, /50K\/s/); assert.match(observed, /30K\/s/); assert.match(observed, /MyPrivate/); assert.doesNotMatch(observed, /OtherPrivate/);
  assert.equal(communitySummary({ ...record, local_identity_source: 'unresolved' }), '');
  assert.equal(communitySummary(null), '');
});

test('offline and unconfigured services cannot produce a false successful public share', async () => {
  let calls = 0;
  const service = fixture({ readState: async () => ({ configured: false }), publish: async () => { calls++; return share('new'); } });
  await service.refreshState();
  assert.equal(await service.publish(null, {}), null); assert.equal(calls, 0); assert.equal(service.view.state.shares.length, 0);
});

test('a failed refresh retains confirmed public shares and ranking results', async () => {
  let fail = false;
  const service = fixture({ readState: async () => { if (fail) throw new Error('offline'); return { configured: true, shares: [share('old')] }; }, readRankings: async () => { if (fail) throw new Error('offline'); return { entries: [rank('old')], total: 1 }; } });
  await service.refreshState(); await service.refreshRankings(); fail = true;
  await service.refreshState(); await service.refreshRankings();
  assert.equal(service.view.state.shares[0].id, 'old'); assert.equal(service.view.rankings.entries[0].share_id, 'old'); assert.match(service.view.error, /offline/);
});

test('a slower old ranking response cannot replace the latest filter results or error state', async () => {
  const old = deferred(), fresh = deferred();
  const service = fixture({ readRankings: filters => filters.server === 'old' ? old.promise : fresh.promise });
  const a = service.refreshRankings({ server: 'old' }), b = service.refreshRankings({ server: 'new' });
  fresh.resolve({ entries: [rank('new')], total: 1 }); await b;
  old.resolve({ entries: [rank('old')], total: 1 }); await a;
  assert.equal(service.view.filters.server, 'new'); assert.equal(service.view.rankings.entries[0].share_id, 'new'); assert.equal(service.view.readingRankings, false);
});

test('a stale failed ranking request cannot obscure a newer successful query', async () => {
  const old = deferred();
  const service = fixture({ readRankings: filters => filters.server === 'old' ? old.promise : Promise.resolve({ entries: [rank('new')], total: 1 }) });
  const a = service.refreshRankings({ server: 'old' }); await service.refreshRankings({ server: 'new' }); old.reject(new Error('stale offline')); await a;
  assert.equal(service.view.error, ''); assert.equal(service.view.rankings.entries[0].share_id, 'new');
});

test('next and previous replace bounded pages and preserve only confirmed prior cursors', async () => {
  const calls = [];
  const service = fixture({ readRankings: async filters => {
    calls.push({ ...filters }); const offset = Number(filters.cursor);
    return { entries: Array.from({ length: 25 }, (_, index) => ({ ...rank(`row${offset + index}`), rank: offset + index + 1 })), total: 75, next_cursor: offset < 50 ? String(offset + 25) : null };
  } });
  await service.refreshRankings({ server: 'same' });
  assert.equal(service.view.pagination.page, 1); assert.equal(service.view.pagination.can_previous, false);
  assert.equal(await service.nextRankingsPage(), true);
  assert.equal(service.view.rankings.entries.length, 25); assert.equal(service.view.rankings.entries[0].share_id, 'row25');
  assert.equal(service.view.pagination.page, 2); assert.deepEqual(service.view.pagination.previous_cursors, ['0']);
  const copy = service.view.pagination.previous_cursors; copy.push('5000'); assert.equal(service.view.pagination.page, 2);
  await service.nextRankingsPage(); assert.equal(service.view.pagination.page, 3); assert.equal(service.view.pagination.can_next, false);
  await service.previousRankingsPage(); assert.equal(service.view.pagination.page, 2); assert.equal(service.view.rankings.entries[0].share_id, 'row25');
  await service.previousRankingsPage(); assert.equal(service.view.pagination.page, 1); assert.equal(service.view.rankings.entries[0].share_id, 'row0');
  assert.deepEqual(calls.map(call => call.cursor), ['0', '25', '50', '25', '0']);
  assert.ok(calls.every(call => call.server === 'same' && call.limit === 25));
});

test('a failed page request retains the confirmed page, cursor history and retry destination', async () => {
  let failure = true;
  const service = fixture({ readRankings: async filters => {
    if (filters.cursor === '25' && failure) throw new Error('page offline');
    return { entries: [{ ...rank(`row${filters.cursor}`), rank: Number(filters.cursor) + 1 }], total: 75, next_cursor: filters.cursor === '0' ? '25' : '50' };
  } });
  await service.refreshRankings(); assert.equal(await service.nextRankingsPage(), false);
  assert.equal(service.view.rankings.entries[0].share_id, 'row0'); assert.equal(service.view.pagination.cursor, '0'); assert.equal(service.view.pagination.page, 1); assert.deepEqual(service.view.pagination.previous_cursors, []); assert.match(service.view.error, /page offline/);
  failure = false; await service.nextRankingsPage();
  assert.equal(service.view.pagination.page, 2); assert.equal(service.view.pagination.cursor, '25'); assert.equal(service.view.rankings.entries[0].share_id, 'row25');
});

test('failed previous navigation does not pop the confirmed cursor stack', async () => {
  let failPrevious = false;
  const service = fixture({ readRankings: async filters => {
    if (filters.cursor === '0' && failPrevious) throw new Error('previous offline');
    return { entries: [rank(`row${filters.cursor}`)], total: 50, next_cursor: filters.cursor === '0' ? '25' : null };
  } });
  await service.refreshRankings(); await service.nextRankingsPage(); failPrevious = true;
  assert.equal(await service.previousRankingsPage(), false);
  assert.equal(service.view.pagination.page, 2); assert.deepEqual(service.view.pagination.previous_cursors, ['0']); assert.equal(service.view.rankings.entries[0].share_id, 'row25');
  failPrevious = false; await service.previousRankingsPage(); assert.equal(service.view.pagination.page, 1);
});

test('changing filters resets pagination and a stale page response cannot overwrite the new filter', async () => {
  const oldPage = deferred();
  const service = fixture({ readRankings: filters => filters.server === 'old' && filters.cursor === '25' ? oldPage.promise : Promise.resolve({ entries: [rank(filters.server)], total: 50, next_cursor: '25' }) });
  await service.refreshRankings({ server: 'old' }); const pending = service.nextRankingsPage();
  await service.refreshRankings({ server: 'new', cursor: '25' });
  oldPage.resolve({ entries: [rank('stale-page')], total: 50, next_cursor: null }); await pending;
  assert.equal(service.view.filters.server, 'new'); assert.equal(service.view.filters.cursor, '0'); assert.equal(service.view.pagination.page, 1); assert.deepEqual(service.view.pagination.previous_cursors, []); assert.equal(service.view.rankings.entries[0].share_id, 'new');
});

test('a failed new filter preserves previous rows but cannot page them under the wrong filters', async () => {
  let offline = true;
  const service = fixture({ readRankings: async filters => {
    if (filters.server === 'new' && offline) throw new Error('filter offline');
    return { entries: [rank(`${filters.server}-${filters.cursor}`)], total: 75, next_cursor: String(Number(filters.cursor) + 25) };
  } });
  await service.refreshRankings({ server: 'old' }); await service.nextRankingsPage();
  await service.refreshRankings({ server: 'new' });
  assert.equal(service.view.rankings.entries[0].share_id, 'old-25'); assert.equal(service.view.pagination.page, 2); assert.equal(service.view.pagination.can_previous, false); assert.equal(service.view.pagination.can_next, false);
  assert.equal(await service.nextRankingsPage(), false);
  offline = false; await service.refreshRankings({ server: 'new' });
  assert.equal(service.view.pagination.page, 1); assert.deepEqual(service.view.pagination.previous_cursors, []); assert.equal(service.view.rankings.entries[0].share_id, 'new-0');
});

test('pager blocks double navigation while pending and ignores repeated or backward next cursors', async () => {
  const pending = deferred(); let calls = 0;
  const service = fixture({ readRankings: filters => { calls++; return filters.cursor === '0' ? Promise.resolve({ entries: [rank('first')], total: 75, next_cursor: '25' }) : pending.promise; } });
  await service.refreshRankings(); const second = service.nextRankingsPage();
  assert.equal(service.view.readingRankings, true); assert.equal(service.view.pagination.can_next, false); assert.equal(await service.nextRankingsPage(), false); assert.equal(calls, 2);
  pending.resolve({ entries: [rank('second')], total: 75, next_cursor: '25' }); await second;
  assert.equal(service.view.pagination.can_next, false); assert.equal(await service.nextRankingsPage(), false); assert.equal(calls, 2);
});

test('sharing serializes double clicks and only commits a validated successful response', async () => {
  const pending = deferred(); let calls = 0, received;
  const service = fixture({ publish: (id, options) => { calls++; received = { id, options }; return pending.promise; } });
  await service.refreshState(); const a = service.publish('7', { anonymous: false, rank_opt_in: true });
  assert.equal(await service.publish('8', {}), null); assert.equal(calls, 1); assert.equal(service.view.mutation, true);
  pending.resolve(share('new')); await a;
  assert.equal(service.view.state.shares[0].id, 'new'); assert.equal(service.view.lastShare.id, 'new'); assert.equal(service.view.mutation, false);
  assert.equal(received.id, '7'); assert.equal(received.options.anonymous, false); assert.equal(received.options.rank_opt_in, true);
});

test('refreshing metadata cannot race a publication and hide its newly created share', async () => {
  const pending = deferred(); let reads = 0;
  const service = fixture({ readState: async () => { reads++; return { configured: true, shares: [] }; }, publish: () => pending.promise });
  await service.refreshState(); const publication = service.publish(null, {});
  await service.refreshState(); assert.equal(reads, 1);
  pending.resolve(share('new')); await publication;
  assert.equal(service.view.state.shares[0].id, 'new');
});

test('failed creation and failed revocation preserve existing shares and never claim success', async () => {
  const service = fixture({ publish: async () => ({ ...share('bad'), url: 'javascript:alert(1)' }), revoke: async () => { throw new Error('offline'); } });
  await service.refreshState(); assert.equal(await service.publish(null, {}), null);
  assert.equal(service.view.state.shares.length, 1); assert.equal(service.view.lastShare, null);
  assert.equal(await service.revoke('old'), false); assert.equal(service.view.state.shares.length, 1); assert.match(service.view.error, /offline/);
});

test('revocation only removes a locally known share after the service confirms it', async () => {
  let calls = 0; const service = fixture({ revoke: async () => { calls++; return {}; } }); await service.refreshState();
  assert.equal(await service.revoke('unknown'), false); assert.equal(calls, 0);
  assert.equal(await service.revoke('old'), true); assert.equal(calls, 1); assert.equal(service.view.state.shares.length, 0);
});

test('rendered public text and URLs cannot inject markup, and publication requires explicit consent', () => {
  const view = { state: communitySnapshot({ configured: true, shares: [share('old')] }), rankings: communityRankings({ entries: [{ ...rank('old'), name: '<img src=x onerror=alert(1)>', boss: '" onclick="alert(1)' }] }), readingState: false, readingRankings: false, mutation: false };
  const html = renderCommunity({ view, native: true, locale: 'en' });
  assert.doesNotMatch(html, /<img src=x/); assert.match(html, /&lt;img/); assert.match(html, /name="communityConsent" type="checkbox"\s+required/);
  assert.doesNotMatch(html, /name="communityRankOptIn" type="checkbox" checked/);
  assert.match(html, /Other players always use anonymous labels/); assert.match(html, /COMMUNITY RECORD/);
});

test('the browser sample is conspicuous and does not pretend to be a live world leaderboard', () => {
  const view = { state: communitySnapshot(), rankings: communityRankings(), readingState: false, readingRankings: false, mutation: false };
  const html = renderCommunity({ view, demo: true, locale: 'tr' });
  assert.match(html, /ARAYÜZ ÖRNEĞİ · ÇEVRİMİÇİ DEĞİL/); assert.match(html, /henüz bağlı değil/); assert.match(html, /type="submit" disabled/);
  assert.doesNotMatch(html, /community-rank"/); assert.doesNotMatch(html, /dünya sıralamasında #/);
});

test('pager rendering labels the confirmed page and disables unavailable boundaries', async () => {
  const service = fixture({ readRankings: async () => ({ entries: [rank('first')], total: 50, next_cursor: '25' }) });
  await service.refreshState(); await service.refreshRankings();
  const first = renderCommunity({ view: service.view, native: true, locale: 'tr' });
  assert.match(first, /Sayfa 1 \/ 2/); assert.match(first, /data-action="community-page-previous" disabled/); assert.match(first, /data-action="community-page-next" >/);
  const unavailable = renderCommunity({ view: { ...service.view, readingRankings: true, pagination: { ...service.view.pagination, can_next: false } }, native: true, locale: 'en' });
  assert.match(unavailable, /Page 1 \/ 2/); assert.match(unavailable, /data-action="community-page-next" disabled/);
});
