import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatEngine } from '../docs/v2/src/engine.js';
import { sanitizeProfile } from '../docs/v2/src/storage.js';
import { BALANCE, ENEMIES } from '../docs/v2/src/config.js';
const engine = (training = false) => new CombatEngine(sanitizeProfile({}), 'campaign', 'balance', training);
test('ignoring training cannot provide permanent invulnerability', () => {
  const e = engine(true), s = e.state;
  e.damageSquad(1); assert.equal(s.squad, 8);
  s.time = BALANCE.tutorialProtection; e.damageSquad(1); assert.ok(s.squad < 8);
  s.time = BALANCE.tutorialTimeout; e.tick(1 / 60); assert.equal(s.tutorial, -1);
});
test('drafts occur every third wave, never accumulate, and obey a combat-time gap', () => {
  const e = engine(), s = e.state;
  e.director.nextWave(); assert.equal(s.pendingDrafts, 0);
  e.director.nextWave(); assert.equal(s.pendingDrafts, 1);
  for (let i = 0; i < 10; i++) e.queueDraft(); assert.equal(s.pendingDrafts, 1);
  e.tick(1 / 60); assert.ok(s.draft); e.applyRunUpgrade(s.draft[0].id);
  e.queueDraft(); e.tick(1 / 60); assert.equal(s.draft, null);
  s.time = s.nextDraftAt; e.tick(1 / 60); assert.ok(s.draft);
});
test('loot upgrades remain bounded and a kill burst cannot flood the field with pickups', () => {
  const e = engine(), s = e.state;
  assert.equal(e.lootChance(), .035); s.runLuck = 999; e.profile.skills.scavenger_luck = 5;
  assert.ok(e.lootChance(true) <= .14);
  e.rng.chance = () => true;
  for (let i = 0; i < 20; i++) { const enemy = e.spawnEnemy('walker'); e.directDamage(enemy, 9999, 'rifle'); }
  assert.equal(s.pickups.length, 1);
  s.time = BALANCE.lootInterval; e.directDamage(e.spawnEnemy('walker'), 9999, 'rifle'); assert.equal(s.pickups.length, 2);
});
test('later waves increase health and movement pressure', () => {
  const e = engine(); e.rng.chance = () => false;
  const first = e.spawnEnemy('walker'); e.state.wave = 8; const later = e.spawnEnemy('walker');
  assert.ok(first.hp >= ENEMIES.walker.hp * 1.2); assert.ok(first.speed > ENEMIES.walker.speed);
  assert.ok(later.hp > first.hp * 1.9); assert.ok(later.speed > first.speed);
});
