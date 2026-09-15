import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatEngine } from '../docs/v2/src/engine.js';
import { sanitizeProfile } from '../docs/v2/src/storage.js';
const game = () => new CombatEngine(sanitizeProfile({ tutorialComplete: true }), 'campaign', 'movement');
test('free movement reaches arbitrary x/y positions without lane snapping', () => {
  const e = game(); e.moveTo(421.7, 443.2);
  for (let i = 0; i < 180; i++) e.tick(1 / 60);
  assert.ok(Math.abs(e.state.x - 421.7) < .02); assert.ok(Math.abs(e.state.y - 443.2) < .02);
});
test('movement speed is bounded and diagonal keyboard movement is normalized', () => {
  const e = game(), s = e.state; e.moveAxes(1, -1); const { x, y } = s;
  e.tick(1 / 60); assert.ok(Math.abs(Math.hypot(s.x - x, s.y - y) - 470 / 60) < 1e-8);
});
test('mobile bounds constrain targets and continuous enemy spawns', () => {
  const e = game(); e.setViewport(420); e.moveTo(-1e8, 1e8);
  assert.equal(e.state.targetX, e.bounds.left); assert.equal(e.state.targetY, e.bounds.bottom);
  const positions = Array.from({ length: 30 }, () => e.spawnEnemy('walker').x);
  assert.ok(positions.every(x => x >= e.bounds.left && x <= e.bounds.right)); assert.equal(new Set(positions).size, 30);
});
test('release stops movement and paused input cannot move the squad', () => {
  const e = game(); e.moveTo(600, 400); e.tick(1 / 60); e.stopMovement(); const { x, y } = e.state;
  e.tick(1 / 60); assert.equal(e.state.x, x); assert.equal(e.state.y, y);
  e.state.paused = true; e.moveTo(100, 200); e.moveAxes(1, 1); e.tick(1);
  assert.equal(e.state.x, x); assert.equal(e.state.y, y);
});
test('boss impact zones can be dodged vertically, not just horizontally', () => {
  const e = game(), s = e.state; const boss = e.spawnEnemy('boss'); boss.y = 175; boss.attackTimer = 0;
  e.updateBoss(boss, 1 / 60); const original = s.squad; s.y -= 180;
  e.updateHazards(1.3); assert.equal(s.squad, original);
});
test('contact and pickups follow squad position instead of the bottom row', () => {
  const e = game(), s = e.state; s.y = s.previousY = 380;
  const enemy = e.spawnEnemy('walker'); enemy.x = s.x; enemy.y = 380; enemy.speed = 0;
  const original = s.squad; e.updateEnemies(1 / 60); assert.ok(s.squad < original);
  e.dropLoot(s.x, s.y); e.updatePickups(1 / 60); assert.equal(s.pickups[0].dead, true);
});
test('aim assistance shoots toward an off-center enemy ahead of the squad', () => {
  const e = game(), enemy = e.spawnEnemy('walker'); enemy.x = 540; enemy.y = 300;
  e.fireWeapon(); assert.ok(e.state.bullets[0].vx > 0); assert.ok(e.state.bullets[0].vy < 0);
});
