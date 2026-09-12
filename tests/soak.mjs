import assert from 'node:assert/strict';
import { CombatEngine } from '../docs/v2/src/engine.js';
import { sanitizeProfile } from '../docs/v2/src/storage.js';
import { WEAPONS, LIMITS } from '../docs/v2/src/config.js';
// Accelerated, headless SIMULATION soak. This does not claim GPU/browser FPS.
const e = new CombatEngine(sanitizeProfile({ accountLevel: 8, unlockedWeapons: Object.keys(WEAPONS), tutorialComplete: true }), 'horde', 'soak-60m');
const started = performance.now(), checkpoints = [];
for (let frame = 0; frame < 60 * 3600; frame++) {
  // Keep the harness alive to stress long-run allocation, rather than end at a defeat.
  e.state.baseHealth = 100; e.state.squad = 40; e.state.armor = 500;
  if (e.state.draft) e.applyRunUpgrade(e.state.draft[0].id);
  if (frame % 90 === 0) e.lane(Math.floor(frame / 90) % 3, true);
  if (frame % 300 === 0) e.selectWeapon(Object.keys(WEAPONS)[Math.floor(frame / 300) % 8]);
  if (e.state.overdrive >= 100) e.overdrive();
  e.tick(1 / 60);
  for (const [key, limit] of Object.entries(LIMITS)) {
    assert.ok(e.state[key].length <= limit, `${key} active cap`);
    assert.ok(e.pools[key].created <= limit, `${key} allocation cap`);
  }
  assert.equal(e.state.gameOver, false); assert.ok(Number.isFinite(e.state.damageDealt));
  if ([600 * 60 - 1, 1800 * 60 - 1, 3600 * 60 - 1].includes(frame)) checkpoints.push({ simulatedMinutes: Math.round(e.state.time / 60), wave: e.state.wave, kills: e.state.kills, enemies: e.state.enemies.length });
}
assert.ok(e.state.time > 3599);
console.log(JSON.stringify({ checkpoints, elapsedSeconds: +((performance.now() - started) / 1000).toFixed(2), allocations: Object.fromEntries(Object.entries(e.pools).map(([id, p]) => [id, p.created])) }, null, 2));
