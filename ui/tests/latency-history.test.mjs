import test from 'node:test';
import assert from 'node:assert/strict';
import { LATENCY_HISTORY_LIMIT, normalizeLatencyHistory, latencyHistory, renderLatencyHistory } from '../latency-history.mjs';

const NOW = 1800000000000, START = NOW - 20000;
const sample = (offset, rtt = 50, patch = {}) => ({ observed_at_ms: START + offset, rtt_ms: rtt, latest_rtt_ms: rtt, variation_ms: 2, measured_connections: 1, ...patch });
const record = (samples = [sample(0), sample(1000)], patch = {}) => ({ started_ms: START, ended_ms: START + 1000, elapsed_ms: 1000, network_latency: { source: 'windows-tcp-estats', samples }, ...patch });

test('statistics are recomputed from actual bounded samples rather than imported summary fields', () => {
  const input = record([sample(0, 10), sample(1000, 20), sample(2000, 30), sample(3000, 100)], { ended_ms: START + 3000 });
  Object.assign(input.network_latency, { sample_count: 999, window_ms: 1, observed_span_ms: 1, minimum_ms: -500, maximum_ms: 1e20, average_ms: 99999, median_ms: NaN, p95_ms: 0 });
  const result = normalizeLatencyHistory(input.network_latency, input, { now: NOW });
  assert.equal(result.sample_count, 4); assert.equal(result.window_ms, 3000); assert.equal(result.observed_span_ms, 3000);
  assert.equal(result.minimum_ms, 10); assert.equal(result.maximum_ms, 100); assert.equal(result.average_ms, 40); assert.equal(result.median_ms, 25); assert.equal(result.p95_ms, 100);
  assert.equal(result.partial, false);
});

test('actual RTT zero is valid while an empty trace remains unknown and never becomes zero milliseconds', () => {
  const zero = record([sample(0, 0)], { ended_ms: START });
  const value = latencyHistory(zero, { now: NOW });
  assert.equal(value.available, true); assert.equal(value.average_ms, 0); assert.equal(value.minimum_ms, 0); assert.equal(value.p95_ms, 0);
  const empty = latencyHistory(record([]), { now: NOW });
  assert.equal(empty.available, false); assert.equal(empty.average_ms, null); assert.equal(empty.minimum_ms, null);
  assert.doesNotMatch(renderLatencyHistory(record([]), { now: NOW }), />0 ms</);
});

test('missing or unsupported sources, malformed windows, and invalid clocks fail closed', () => {
  for (const input of [null, {}, [], { source: 'icmp', samples: [] }, { source: 'windows-tcp-estats', samples: {} }]) assert.equal(normalizeLatencyHistory(input, record(), { now: NOW }), null);
  for (const patch of [{ started_ms: undefined }, { started_ms: NaN }, { ended_ms: START - 1 }, { ended_ms: 'later' }, { ended_ms: undefined, elapsed_ms: Infinity }, { started_ms: Number.MAX_SAFE_INTEGER, ended_ms: undefined, elapsed_ms: 1 }]) {
    const input = record([], patch); assert.equal(normalizeLatencyHistory(input.network_latency, input, { now: NOW }), null);
  }
  assert.equal(normalizeLatencyHistory(record().network_latency, record(), { now: NaN }), null);
  assert.equal(latencyHistory(undefined, { now: NOW }).available, false);
});

test('missing end time uses a safe elapsed interval while an explicitly reversed interval never silently falls back', () => {
  const input = record([sample(0), sample(3000)], { ended_ms: undefined, elapsed_ms: 3000 });
  assert.equal(latencyHistory(input, { now: NOW }).sample_count, 2);
  assert.equal(latencyHistory(input, { now: NOW }).ended_ms, START + 3000);
  const sentinel = { ...input, ended_ms: 0 };
  assert.equal(latencyHistory(sentinel, { now: NOW }).window_ms, 3000);
  assert.equal(latencyHistory({ ...input, ended_ms: START - 1 }, { now: NOW }).available, false);
});

test('samples outside the actual encounter or in the future are discarded and cannot influence statistics', () => {
  const input = record([sample(-1, 120000), sample(0, 10), sample(1000, 20), sample(1001, 120000), { ...sample(0, 120000), observed_at_ms: NOW + 1 }]);
  const value = latencyHistory(input, { now: NOW });
  assert.equal(value.sample_count, 2); assert.equal(value.average_ms, 15); assert.equal(value.maximum_ms, 20); assert.equal(value.partial, true);
});

test('duplicate and subsecond retained observations cannot overweight a held RTT value', () => {
  const input = record([sample(0, 10), sample(0, 120000), sample(999, 120000), sample(1000, 20)]);
  const value = latencyHistory(input, { now: NOW });
  assert.equal(value.sample_count, 2); assert.equal(value.average_ms, 15); assert.equal(value.partial, true);
});

test('unsorted valid observations are ordered without mutating the input objects', () => {
  const input = record([sample(1000, 20), sample(0, 10)]), before = JSON.stringify(input);
  const value = normalizeLatencyHistory(input.network_latency, input, { now: NOW });
  assert.deepEqual(value.samples.map(row => row.rtt_ms), [10, 20]); assert.equal(JSON.stringify(input), before);
  value.samples[0].rtt_ms = 100000; assert.equal(input.network_latency.samples[1].rtt_ms, 10);
});

test('malformed metric fields, invalid connection counts and noninteger values never become latency samples', () => {
  const variants = [
    { rtt_ms: -1 }, { rtt_ms: NaN }, { rtt_ms: Infinity }, { rtt_ms: '10' }, { rtt_ms: 1.5 }, { rtt_ms: 120001 },
    { observed_at_ms: NaN }, { observed_at_ms: START + .5 }, { observed_at_ms: '1000' },
    { measured_connections: 0 }, { measured_connections: 129 }, { measured_connections: NaN },
    { latest_rtt_ms: 120001 }, { latest_rtt_ms: NaN }, { variation_ms: Infinity }, { variation_ms: -.5 },
  ];
  for (const patch of variants) {
    const input = record([sample(0, 10, patch)]);
    const value = latencyHistory(input, { now: NOW });
    assert.equal(value.available, false, JSON.stringify(patch)); assert.equal(value.average_ms, null);
  }
  const input = record([sample(0, 10, { latest_rtt_ms: undefined, variation_ms: null })]);
  assert.equal(latencyHistory(input, { now: NOW }).available, true);
});

test('large traces retain at most the last 600 supplied samples and disclose truncation', () => {
  const input = record(Array.from({ length: 800 }, (_, i) => sample(i * 1000, i)), { ended_ms: START + 799000 });
  const value = latencyHistory(input, { now: START + 800000 });
  assert.equal(value.sample_count, LATENCY_HISTORY_LIMIT); assert.equal(value.samples[0].rtt_ms, 200); assert.equal(value.samples.at(-1).rtt_ms, 799);
  assert.equal(value.truncated, true); assert.equal(value.partial, true); assert.equal(value.minimum_ms, 200);
  assert.equal(input.network_latency.samples.length, 800);
});

test('retention and explicit partial flags remain visible even with otherwise continuous sample timing', () => {
  for (const patch of [{ truncated: true }, { partial: true }]) {
    const input = record(); Object.assign(input.network_latency, patch);
    const value = latencyHistory(input, { now: NOW }); assert.equal(value.partial, true);
    assert.match(renderLatencyHistory(input, { now: NOW, locale: 'en' }), /quality-warning/);
  }
  const input = record([sample(0), sample(11000)], { ended_ms: START + 11000 });
  assert.equal(latencyHistory(input, { now: NOW }).partial, true);
  assert.equal(latencyHistory(record([sample(6000)], { ended_ms: START + 12000 }), { now: NOW }).partial, true);
  assert.equal(latencyHistory(record([sample(1000)], { ended_ms: START + 10000 }), { now: NOW }).partial, true);
});

test('optional personal window only selects the same connection observations within its confirmed time range', () => {
  const input = record([sample(0, 100), sample(1000, 10), sample(2000, 20), sample(3000, 300)], { ended_ms: START + 3000, local_player_id: '7', local_identity_source: 'server', personal_started_ms: START + 1000, personal_elapsed_ms: 1000 });
  const value = latencyHistory(input, { scope: 'personal', now: NOW });
  assert.equal(value.scope, 'personal'); assert.equal(value.requested_scope, 'personal'); assert.equal(value.scope_trimmed, true);
  assert.equal(value.sample_count, 2); assert.equal(value.average_ms, 15); assert.equal(value.window_ms, 1000);
  assert.match(renderLatencyHistory(input, { scope: 'personal', now: NOW, locale: 'en' }), /Time window of the personal measurement/);
  assert.match(renderLatencyHistory(input, { scope: 'personal', now: NOW, locale: 'en' }), /game connection set/);
});

test('unknown identity, paused clocks and unsafe personal windows fall back to the labelled general encounter', () => {
  const base = record([sample(0, 10), sample(1000, 20)], { local_player_id: '7', local_identity_source: 'server', personal_started_ms: START, personal_elapsed_ms: 1000 });
  for (const patch of [{ local_identity_source: 'unresolved' }, { local_player_id: null }, { personal_started_ms: START - 1 }, { personal_elapsed_ms: 2000 }, { personal_started_ms: undefined }, { paused: true }, { paused_ms: 1000 }]) {
    const value = latencyHistory({ ...base, ...patch }, { scope: 'personal', now: NOW });
    assert.equal(value.available, true); assert.equal(value.scope, 'observed'); assert.equal(value.scope_trimmed, false); assert.equal(value.sample_count, 2);
  }
});

test('party windows require explicit membership and an actual start; missing start is never inferred from a combat-duration total', () => {
  const base = record([sample(0, 100), sample(1000, 10), sample(2000, 20)], { ended_ms: START + 2000, party_membership_source: 'server', party_elapsed_ms: 1000 });
  assert.equal(latencyHistory(base, { scope: 'party', now: NOW }).scope, 'observed');
  const selected = latencyHistory({ ...base, party_started_ms: START + 1000 }, { scope: 'party', now: NOW });
  assert.equal(selected.scope, 'party'); assert.equal(selected.average_ms, 15);
  assert.equal(latencyHistory({ ...base, party_started_ms: START + 1000, party_membership_source: 'unresolved' }, { scope: 'party', now: NOW }).scope, 'observed');
});

test('a combat clock contradicted by retained own hits cannot trim wall-clock RTT observations', () => {
  const input = record([sample(0, 10), sample(1000, 20), sample(2000, 100), sample(3000, 200)], { ended_ms: START + 3000, local_player_id: '7', local_identity_source: 'server', personal_started_ms: START, personal_elapsed_ms: 1000, damage_samples: [{ player_id: '7', timestamp_ms: START }, { player_id: '7', timestamp_ms: START + 3000 }] });
  const value = latencyHistory(input, { now: NOW, scope: 'personal' });
  assert.equal(value.scope, 'observed'); assert.equal(value.sample_count, 4); assert.equal(value.maximum_ms, 200);
});

test('allowlisted normalization cannot retain IPs, actor metadata, links, tokens or strings as hidden summary data', () => {
  const secret = 'PRIVATE_NOT_TO_RETAIN';
  const input = record([sample(0, 10, { ip: secret, actor_id: 123, hostname: secret, token: secret })]);
  input.network_latency.ip = secret; input.network_latency.summary_html = secret; input.network_latency.actor_id = 123;
  const value = normalizeLatencyHistory(input.network_latency, input, { now: NOW });
  assert.equal(JSON.stringify(value).includes(secret), false); assert.equal(JSON.stringify(value).includes('actor_id'), false);
  assert.deepEqual(Object.keys(value.samples[0]), ['observed_at_ms', 'rtt_ms', 'latest_rtt_ms', 'variation_ms', 'measured_connections']);
  assert.equal(renderLatencyHistory(input, { now: NOW }).includes(secret), false);
});

test('single-sample and all-zero SVG plots stay finite and render a visible observation', () => {
  for (const input of [record([sample(0, 0)], { ended_ms: START }), record([sample(0, 0), sample(1000, 0)])]) {
    const html = renderLatencyHistory(input, { now: NOW, locale: 'en' });
    assert.match(html, /viewBox="0 0 480 100"/); assert.doesNotMatch(html, /NaN|Infinity|undefined/);
    assert.match(html, />0 ms</);
  }
  assert.match(renderLatencyHistory(record([sample(0)], { ended_ms: START }), { now: NOW }), /<circle/);
});

test('the SVG does not draw a connecting line over a missing observation interval', () => {
  const input = record([sample(0), sample(11000)], { ended_ms: START + 11000 });
  const html = renderLatencyHistory(input, { now: NOW });
  const path = /<path d="([^"]*)"/.exec(html)[1];
  assert.equal(path.split('M').length - 1, 2); assert.equal(path.includes('L'), false);
});

test('nearest-rank P95 and even/odd medians match the native scalar summary contract', () => {
  const samples = Array.from({ length: 20 }, (_, i) => sample(i * 1000, i + 1));
  const input = record(samples, { ended_ms: START + 19000 });
  assert.equal(latencyHistory(input, { now: NOW }).p95_ms, 19); assert.equal(latencyHistory(input, { now: NOW }).median_ms, 10.5);
  const odd = record(samples.slice(0, 3), { ended_ms: START + 2000 });
  assert.equal(latencyHistory(odd, { now: NOW }).median_ms, 2);
});

test('relative anonymized record clocks retain valid zero RTT without restoring private wall-clock timestamps', () => {
  const input = record([{ observed_at_ms: 0, rtt_ms: 0, measured_connections: 1 }, { observed_at_ms: 1000, rtt_ms: 10, measured_connections: 1 }], { started_ms: 0, ended_ms: 1000, elapsed_ms: 1000 });
  const value = latencyHistory(input, { now: NOW });
  assert.equal(value.available, true); assert.equal(value.minimum_ms, 0); assert.equal(value.average_ms, 5); assert.equal(value.samples[0].observed_at_ms, 0);
});
