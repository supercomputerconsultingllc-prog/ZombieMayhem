import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatEngine } from '../docs/v2/src/engine.js';
import { sanitizeProfile } from '../docs/v2/src/storage.js';
import { FixedStepClock, ObjectPool } from '../docs/v2/src/simulation.js';
import { WEAPONS, EVOLUTIONS, LIMITS, FORMATIONS, SPECIALISTS, MISSION_TEMPLATES } from '../docs/v2/src/config.js';
import { awardRun } from '../docs/v2/src/progression.js';

const profile = () => sanitizeProfile({ accountLevel: 8, unlockedWeapons: Object.keys(WEAPONS), tutorialComplete: true });
const game = (mode = 'campaign') => new CombatEngine(profile(), mode, 'regression-seed');
function enemy(e, x = 480, y = 300, hp = 1000) {
  const target = e.spawnEnemy('walker', 1);
  Object.assign(target, { x, y, previousX: x, previousY: y, hp, maxHp: hp, armor: 0, elite: false });
  return target;
}
function shot(e, values = {}) {
  return e.spawn('bullets', { x: 480, y: 500, previousX: 480, previousY: 500,
    vx: 0, vy: -20000, size: 3, damage: 20, crit: 0, pierce: 0, knockback: 0,
    status: null, explosive: 0, chain: 0, life: 2, weapon: 'rifle', armorPierce: 0,
    hitIds: new Set(), counted: false, ...values });
}

test('identical inputs at 30, 60 and 144 render Hz produce identical simulation', () => {
  function run(hz) {
    const e = game(), clock = new FixedStepClock(); let step = 0;
    for (let frame = 0; frame < hz * 12; frame++) clock.advance(1 / hz, dt => {
      if (step % 120 === 0) e.lane((step / 120) % 3, true);
      if (step === 60) e.overdrive();
      if (e.state.draft) e.applyRunUpgrade(e.state.draft[0].id);
      e.tick(dt); step++;
    });
    return JSON.stringify({ state: e.state, random: e.rng.state });
  }
  assert.equal(run(30), run(60)); assert.equal(run(60), run(144));
});
test('pause freezes time, Overdrive, projectiles and random state', () => {
  const e = game(); e.overdrive(); e.tick(1 / 60); e.state.paused = true;
  const before = JSON.stringify(e.state), random = e.rng.state;
  for (let i = 0; i < 600; i++) e.tick(1 / 60);
  assert.equal(JSON.stringify(e.state), before); assert.equal(e.rng.state, random);
});
test('swept broad phase finds targets several cells before endpoint, nearest first', () => {
  const e = game(), far = enemy(e, 480, 240), near = enemy(e, 480, 430); shot(e);
  e.updateBullets(1 / 60); assert.equal(near.hp, 980); assert.equal(far.hp, 1000);
});
test('piercing projectile never damages the same enemy twice', () => {
  const e = game(), target = enemy(e, 480, 300); shot(e, { y: 305, vy: -1, pierce: 3 });
  for (let i = 0; i < 10; i++) e.updateBullets(1 / 60);
  assert.equal(target.hp, 980); assert.equal(e.state.hits, 1);
});
test('splash damage uses enlarged radius for falloff and grants each death once', () => {
  const e = game(); e.state.specialists = ['engineer'];
  const target = enemy(e, 480, 300, 10), secondary = enemy(e, 590, 300, 10);
  const bullet = shot(e, { damage: 72, explosive: 143.75 });
  e.hitEnemy(target, bullet); assert.equal(secondary.dead, true); assert.equal(e.state.kills, 2);
  const credits = e.state.credits; e.killEnemy(secondary); assert.equal(e.state.credits, credits);
});
test('chain lightning visits distinct targets without bouncing back to previous victims', () => {
  const e = game(), first = enemy(e, 400, 300), second = enemy(e, 450, 300), third = enemy(e, 500, 300);
  e.hitEnemy(first, shot(e, { damage: 100, chain: 6 }));
  assert.equal(first.hp, 900); assert.equal(second.hp, 930); assert.equal(third.hp, 951);
});
test('burn, freeze, shock, armor break and shatter have combat effects', () => {
  const e = game(), target = enemy(e); target.armor = 10;
  const events = []; e.events.subscribe(event => events.push(event));
  e.hitEnemy(target, shot(e, { damage: 100, status: 'burn' }));
  assert.equal(target.armor, 0); assert.ok(target.status.burn > 0); assert.ok(events.some(e => e.armorBreak));
  const hp = target.hp; e.updateEnemies(.1); assert.ok(target.hp < hp);
  e.hitEnemy(target, shot(e, { status: 'freeze' })); assert.ok(target.status.freeze > 0);
  const before = target.hp; e.hitEnemy(target, shot(e, { damage: 20, shatter: true })); assert.equal(before - target.hp, 40);
  e.hitEnemy(target, shot(e, { status: 'shock' })); assert.ok(target.status.shock > 0);
});
for (const id of Object.keys(WEAPONS)) test(`weapon ${id} fires finite projectiles with declared behavior`, () => {
  const e = game(); assert.equal(e.selectWeapon(id), true); e.fireWeapon();
  assert.equal(e.state.bullets.length, WEAPONS[id].shots);
  for (const b of e.state.bullets) for (const key of ['x', 'y', 'vx', 'vy', 'damage', 'life']) assert.ok(Number.isFinite(b[key]), `${id}.${key}`);
});
for (const [weapon, branches] of Object.entries(EVOLUTIONS)) for (const branch of branches) test(`evolution ${weapon}/${branch.id} applies its actual weapon modifiers`, () => {
  const e = game(), id = `evolution:${weapon}:${branch.id}`; e.state.draft = [{ id }]; e.state.paused = true;
  assert.equal(e.applyRunUpgrade(id), true); assert.equal(e.state.selectedWeapon, weapon);
  for (const [key, value] of Object.entries(branch.mods)) assert.equal(e.weapon()[key], value);
  assert.equal(e.applyRunUpgrade(id), false, 'a consumed draft cannot be applied again');
});
for (const id of Object.keys(SPECIALISTS)) test(`specialist ${id} is recruited once from an offered draft`, () => {
  const e = game(), choice = `specialist:${id}`; e.state.draft = [{ id: choice }];
  assert.equal(e.applyRunUpgrade(choice), true); assert.deepEqual(e.state.specialists, [id]);
  assert.equal(e.applyRunUpgrade(choice), false);
});
test('formations change outgoing and incoming damage', () => {
  const damages = {};
  for (const id of Object.keys(FORMATIONS)) { const e = game(); e.state.formation = id; e.fireWeapon(); damages[id] = e.state.bullets[0].damage; }
  assert.ok(damages.wedge > damages.wide && damages.wide > damages.box);
  const box = game(), wedge = game(); box.state.formation = 'box'; box.damageSquad(3); wedge.damageSquad(3); assert.ok(box.state.squad > wedge.state.squad);
});
test('invalid upgrade IDs cannot alter a paused draft', () => {
  const e = game(); e.showUpgradeDraft(); const before = JSON.stringify(e.state);
  assert.equal(e.applyRunUpgrade('specialist:__proto__'), false); assert.equal(JSON.stringify(e.state), before);
  assert.equal(e.state.draft.length, 3); assert.equal(new Set(e.state.draft.map(x => x.id)).size, 3);
});
test('boss stays in its arena and provides a warning before impact', () => {
  const e = game('bossrush'), boss = e.spawnEnemy('boss', 1);
  boss.y = 175; boss.attackTimer = 0; e.updateBoss(boss, 1 / 60);
  assert.ok(e.state.hazards.length); assert.ok(e.state.hazards.every(h => h.warning >= 1));
  const h = e.state.hazards[0]; e.state.laneX = h.x; const squad = e.state.squad;
  e.updateHazards(.5); assert.equal(e.state.squad, squad); e.updateHazards(.8); assert.ok(e.state.squad < squad);
  for (let i = 0; i < 2000; i++) e.updateEnemies(1 / 60);
  assert.ok(boss.y <= 175); assert.equal(boss.dead, false);
});
test('campaign advances through four biomes and has a finite victory', () => {
  const e = game(), indices = [];
  for (let chapter = 0; chapter < 4; chapter++) {
    indices.push(e.director.biomeIndex); const boss = e.spawnEnemy('boss', 1); e.killEnemy(boss); e.cleanup();
  }
  assert.deepEqual(indices, [0, 1, 2, 3]); assert.equal(e.state.victory, true); assert.equal(e.state.bosses, 4);
});
test('boss rush spawns a boss without ambient horde and ends after four fights', () => {
  const e = game('bossrush'); e.director.tick(1.1); assert.equal(e.state.enemies.length, 1); assert.equal(e.state.enemies[0].boss, true);
  for (let i = 0; i < 4; i++) { e.killEnemy(e.state.boss); e.cleanup(); if (i < 3) { e.state.draft = null; e.state.paused = false; e.director.tick(3); } }
  assert.equal(e.state.victory, true);
});
test('extraction requires a player decision and five surviving seconds', () => {
  const e = game('extraction'); assert.equal(e.extract(), false); e.state.distance = 600;
  e.director.tick(10); assert.equal(e.state.gameOver, false); assert.equal(e.extract(), true);
  e.director.tick(4.9); assert.equal(e.state.gameOver, false); e.director.tick(.11); assert.equal(e.state.victory, true);
  const failed = game('extraction'); failed.state.credits = 1000; failed.finish(false);
  assert.equal(awardRun(profile(), failed.state, 'extraction', 'test').report.banked, 250);
});
test('horde fortifications absorb breaches and base destruction ends the run', () => {
  const e = game('horde'); e.state.draft = [{ id: 'fortify' }]; e.applyRunUpgrade('fortify');
  const threat = enemy(e, 480, 630); threat.lane = 1; e.updateEnemies(1 / 60);
  assert.ok(e.state.fortifications[0].hp < 100); assert.equal(e.state.baseHealth, 100);
  e.state.fortifications = []; e.state.baseHealth = 1; enemy(e, 480, 630); e.updateEnemies(1 / 60); assert.equal(e.state.gameOver, true);
});
for (const [index, template] of MISSION_TEMPLATES.entries()) test(`mission ${template.type} rewards and queues a tactical draft`, () => {
  const e = game(); e.setMission(index);
  const key = { kills: 'kills', distance: 'distance', elite: 'eliteKills', credits: 'creditsEarned', survive: 'time', boss: 'bosses' }[template.type];
  e.state[key] = e.state.mission.target; e.updateMission();
  assert.equal(e.state.missionIndex, index + 1); assert.equal(e.state.pendingDrafts, 1); assert.equal(e.state.credits, template.reward);
});
test('pools bound allocations, reset stale fields, and avoid double-release', () => {
  const pool = new ObjectPool(2), a = pool.acquire({ stale: true }), b = pool.acquire({});
  assert.equal(pool.acquire({}), null); pool.release(a); pool.release(a);
  const c = pool.acquire({ fresh: true }); assert.equal(c, a); assert.equal(c.stale, undefined); assert.equal(pool.created, 2); assert.equal(pool.active.size, 2);
  pool.release(b); pool.release(c);
  const e = game(); for (let i = 0; i < 300; i++) e.spawnEnemy('walker'); assert.equal(e.state.enemies.length, LIMITS.enemies);
});
test('finish event fires once, preventing duplicate account rewards', () => {
  const e = game(); let events = 0; e.events.subscribe(event => { if (event.type === 'finish') events++; });
  e.finish(false); e.finish(true); assert.equal(events, 1); assert.equal(e.state.victory, false);
});
