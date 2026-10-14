import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeGameReport, comparePersonalReport } from '../game-reports.mjs';

const key = [0x25, 0xa8, 0x7e, 0x91];
function report(fields = {}) {
  return { magic: 1145131858, version: 1,
    BaseStatData: { AnalyzerStartTime: '2026-10-13T10:00:00.000Z', AnalyzerEndTime: '2026-10-13T10:01:00.000Z', bExistAnalyzerTime: true, bExistTargetFilter: false },
    AttackStatData: { TotalDamageVal: 9000, TotalHealVal: 20, HitStat: { TotalCount: 3, CriticalCount: 1 } },
    SortedSkillStatList: [{ SkillId: 101, DamageVal: 9000, HitStat: { TotalCount: 3, CriticalCount: 1 } }], ...fields };
}
function encode(value) { return new TextEncoder().encode(JSON.stringify(value)).map((byte, index) => byte ^ key[index % 4]); }

test('official report fields survive without private account/name fields', () => {
  const parsed = decodeGameReport(encode(report({ AccountId: 'private-account', CharacterName: 'private-player' })));
  assert.equal(parsed.total_damage, 9000); assert.equal(parsed.duration_ms, 60000); assert.equal(parsed.dps, 150);
  assert.equal(parsed.total_healing, 20); assert.equal(parsed.skill_totals_match, true);
  assert.equal(parsed.counters.BackAttackCount, null);
  assert.ok(!JSON.stringify(parsed).includes('private-'));
  assert.equal(parsed.started_local, '2026-10-13T10:00:00.000');
});

test('unknown nullable counters remain unknown through merged skill rows', () => {
  const value = report(); value.SortedSkillStatList = [
    { SkillId: 101, DamageVal: 4000, HitStat: { TotalCount: 2, CriticalCount: 1 } },
    { SkillId: 101, DamageVal: 5000, HitStat: { TotalCount: 1 } },
  ];
  const parsed = decodeGameReport(encode(value));
  assert.equal(parsed.skills.length, 1); assert.equal(parsed.skills[0].damage, 9000);
  assert.equal(parsed.skills[0].counters.TotalCount, 3); assert.equal(parsed.skills[0].counters.CriticalCount, null);
});

test('foreign versions, corrupt files and invalid dates are rejected', () => {
  assert.throws(() => decodeGameReport(Uint8Array.of(1, 2, 3)));
  assert.throws(() => decodeGameReport(encode(report({ version: 2 }))));
  const value = report(); value.BaseStatData.AnalyzerStartTime = '2026-02-31T10:00:00Z';
  assert.throws(() => decodeGameReport(encode(value)));
});

test('absent time and zero duration cannot produce a fabricated DPS rate', () => {
  const value = report(); value.BaseStatData.bExistAnalyzerTime = false;
  assert.equal(decodeGameReport(encode(value)).dps, null);
  value.BaseStatData.bExistAnalyzerTime = true; value.BaseStatData.AnalyzerEndTime = value.BaseStatData.AnalyzerStartTime;
  assert.equal(decodeGameReport(encode(value)).dps, null);
});

test('comparison always uses personal damage instead of nearby observed total', () => {
  const parsed = decodeGameReport(encode(report()));
  const record = { local_player_id: 2, local_identity_source: 'server', personal_total_damage: 9000, total_damage: 45000, personal_elapsed_ms: 60000,
    started_ms: parsed.started_device_local_ms, sample_complete: true };
  const result = comparePersonalReport(parsed, record);
  assert.equal(result.comparable, true); assert.equal(result.difference, 0); assert.equal(result.luma_damage, 9000);
  assert.equal(comparePersonalReport(parsed, { ...record, personal_total_damage: null }).available, false);
  assert.equal(comparePersonalReport(parsed, { ...record, local_identity_source: 'unresolved' }).available, false);
});

test('mismatched windows or unknown target/capture scope are not certified equal', () => {
  const parsed = decodeGameReport(encode(report()));
  const record = { local_player_id: 2, local_identity_source: 'server', personal_total_damage: 9000, personal_elapsed_ms: 61050, started_ms: parsed.started_device_local_ms, sample_complete: true };
  assert.equal(comparePersonalReport(parsed, record).comparable, false);
  assert.equal(comparePersonalReport(parsed, { ...record, personal_elapsed_ms: 60000, sample_complete: false }).reason, 'incomplete-capture');
});

test('nearby combat starting earlier does not change the personal comparison window', () => {
  const parsed = decodeGameReport(encode(report()));
  const record = { local_player_id: 2, local_identity_source: 'server', personal_total_damage: 9000,
    started_ms: parsed.started_device_local_ms - 30000, personal_started_ms: parsed.started_device_local_ms,
    personal_elapsed_ms: 60000, sample_complete: true };
  assert.equal(comparePersonalReport(parsed, record).comparable, true);
  assert.equal(comparePersonalReport(parsed, { ...record, personal_started_ms: parsed.started_device_local_ms + 5000 }).comparable, false);
});

test('equal damage and clocks cannot certify reports with unavailable or invalid measurement timing', () => {
  const parsed = decodeGameReport(encode(report()));
  const record = { local_player_id: 2, local_identity_source: 'server', personal_total_damage: 9000, personal_elapsed_ms: 60000, personal_started_ms: parsed.started_device_local_ms, sample_complete: true };
  for (const [game, own] of [
    [{ ...parsed, timing_present: false }, record],
    [{ ...parsed, duration_ms: 0 }, { ...record, personal_elapsed_ms: 0 }],
    [parsed, { ...record, timing_valid: false }],
  ]) {
    const result = comparePersonalReport(game, own);
    assert.equal(result.available, true); assert.equal(result.difference, 0);
    assert.equal(result.comparable, false); assert.equal(result.duration_matches, false);
    assert.equal(result.reason, 'different-window');
  }
});
