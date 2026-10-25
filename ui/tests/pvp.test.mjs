import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePvp, deathRecap } from '../pvp.mjs';

test('the PvP session keeps bounded counters and a sanitized recap, and survives garbage', () => {
  const pvp = normalizePvp({ kills: 3, deaths: 1, last_death: { at_ms: 5000, killer_name: ' Slayer\u0007 ', killer_player: true, skill_id: 15050340, npc_id: 0, npc_name: null, damage_taken: 4200,
    top_skills: [{ skill_id: 1, damage: 3000, hits: 4 }, { skill_id: 2, damage: 1200, hits: 2 }, { skill_id: null, damage: 9, hits: 1 }, { skill_id: 3, damage: 0, hits: 1 }, { skill_id: 4, damage: 5, hits: 1 }, { skill_id: 5, damage: 5, hits: 1 }] } });
  assert.deepEqual([pvp.kills, pvp.deaths], [3, 1]);
  assert.equal(pvp.last_death.killer_name, 'Slayer'); assert.equal(pvp.last_death.killer_player, true);
  assert.equal(pvp.last_death.npc_id, null); assert.equal(pvp.last_death.skill_id, 15050340);
  assert.deepEqual(pvp.last_death.top_skills.map(row => row.skill_id), [1, 2]); // at most three rows read, and only real ones kept
  for (const value of [null, undefined, [], 'x', 7, { kills: -1, deaths: 1.5, last_death: 'no' }, { kills: NaN, deaths: '2', last_death: [] }]) {
    const odd = normalizePvp(value);
    assert.deepEqual([odd.kills, odd.deaths, odd.last_death], [0, 0, null]);
  }
  assert.equal(normalizePvp({ kills: 1e12 }).kills, 99_999);
  assert.equal(normalizePvp(normalizePvp({ kills: 2, deaths: 5, last_death: { at_ms: 1, damage_taken: 7 } })).deaths, 5);
});

test('a death recap names the killer and skill, says what kind of killer it was and shares the damage', () => {
  const label = id => `Skill ${id}`;
  const player = deathRecap(normalizePvp({ last_death: { killer_name: 'Slayer', killer_player: true, skill_id: 7, damage_taken: 4000, top_skills: [{ skill_id: 7, damage: 3000, hits: 3 }, { skill_id: 8, damage: 1000, hits: 1 }] } }).last_death, { label });
  assert.equal(player.line, 'Slayer · Skill 7'); assert.equal(player.kind, 'Oyuncu seni öldürdü'); assert.equal(player.taken, 4000);
  assert.deepEqual(player.skills.map(row => [row.name, row.share]), [['Skill 7', .75], ['Skill 8', .25]]);
  const monster = deathRecap(normalizePvp({ last_death: { npc_name: 'Krall Armed Soldier', skill_id: null, damage_taken: 0 } }).last_death, { locale: 'en', label });
  assert.equal(monster.line, 'Krall Armed Soldier'); assert.equal(monster.kind, 'A monster killed you'); assert.deepEqual(monster.skills, []);
  assert.equal(deathRecap(normalizePvp({ last_death: {} }).last_death, { label }).line, 'Bilinmeyen');
  assert.equal(deathRecap(null), null);
});
