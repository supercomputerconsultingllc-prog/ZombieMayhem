import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatEngine } from '../docs/v2/src/engine.js';
import { sanitizeProfile } from '../docs/v2/src/storage.js';
import { squadLayout } from '../docs/v2/src/presentation.js';
import { WEAPONS } from '../docs/v2/src/config.js';
const game = () => new CombatEngine(sanitizeProfile({ accountLevel: 8, tutorialComplete: true }), 'campaign', 'presentation');

test('every recruit has a unique formation slot, and casualties shrink the group', () => {
  for (const formation of ['wedge', 'wide', 'box']) for (let count = 1; count <= 40; count++) {
    const layout = squadLayout(count, formation);
    assert.equal(layout.slots.length, count);
    assert.equal(new Set(layout.slots.map(p => `${p.x}:${p.y}`)).size, count);
  }
  assert.ok(squadLayout(40).halfHeight > squadLayout(8).halfHeight);
  assert.equal(squadLayout(39.1).slots.length, 40);
  assert.equal(squadLayout(12).slots.length, 12);
});
test('all forty soldiers and their status bar fit the smallest phone viewport at every boundary', () => {
  for (const formation of ['wedge', 'wide', 'box']) {
    const e = game(), s = e.state; s.squad = 40; s.formation = formation; e.setViewport(300);
    const layout = squadLayout(s.squad, formation);
    for (const x of [e.bounds.left, e.bounds.right]) for (const y of [e.bounds.top, e.bounds.bottom]) {
      for (const slot of layout.slots) { assert.ok(x + slot.x - 24 >= 330); assert.ok(x + slot.x + 24 <= 630); assert.ok(y + slot.y - 40 >= 0); assert.ok(y + slot.y + 24 <= 720); }
      assert.ok(y + layout.halfHeight + 16 < 720);
    }
    s.x = s.targetX = e.bounds.right; s.y = s.targetY = e.bounds.bottom;
    s.formation = 'wedge'; e.tick(1 / 60);
    assert.ok(s.x <= e.bounds.right && s.y <= e.bounds.bottom);
  }
});
test('gun switches create eight distinct projectile families without changing flying rounds', () => {
  const e = game(), styles = [];
  for (const id of Object.keys(WEAPONS)) {
    assert.equal(e.selectWeapon(id), true); e.state.fireTimer = 0; e.fireWeapon();
    const bullet = e.state.bullets.at(-1); assert.equal(bullet.weapon, id); styles.push(bullet.style);
  }
  assert.equal(new Set(styles).size, 8);
  assert.equal(e.state.bullets[0].style, 'tracer'); assert.equal(e.state.bullets[0].weapon, 'rifle');
});
test('every squad member takes a firing turn and muzzle events match projectile origins', () => {
  const e = game(), s = e.state; s.squad = 40; const origins = [];
  e.events.subscribe(event => { if (event.type === 'shot') origins.push([event.x, event.y]); });
  for (let i = 0; i < 40; i++) { s.fireTimer = 0; e.fireWeapon(); const b = s.bullets.at(-1), origin = origins.at(-1); assert.ok(Math.abs(b.x - origin[0]) <= 3); assert.equal(b.y, origin[1]); }
  assert.equal(new Set(origins.map(p => p.join(':'))).size, 40);
  assert.equal(s.bullets.length, 40);
});
