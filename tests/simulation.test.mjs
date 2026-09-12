import assert from 'node:assert/strict';
import { SeededRandom, FixedStepClock, SpatialGrid, sweptCircleHit } from '../docs/v2/src/simulation.js';

const first = new SeededRandom(42), second = new SeededRandom(42);
assert.deepEqual(Array.from({ length: 8 }, () => first.next()), Array.from({ length: 8 }, () => second.next()), 'seeded runs must reproduce');
assert.equal(sweptCircleHit(0, 0, 100, 0, 50, 4, 5), true, 'fast projectile should hit across its swept path');
assert.equal(sweptCircleHit(0, 0, 100, 0, 50, 10, 5), false, 'distant projectile should miss');

const grid = new SpatialGrid(50), target = { x: 55, y: 55 };
grid.rebuild([target]);
assert.ok(grid.nearby(10, 10).includes(target), 'adjacent grid cells should be queried');

const clock = new FixedStepClock(.01, 5);
let steps = 0;
clock.advance(.031, () => steps++);
assert.equal(steps, 3, 'fixed-step clock should advance deterministically');
console.log('Simulation foundation tests passed.');
