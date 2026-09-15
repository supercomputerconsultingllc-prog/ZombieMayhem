import { test, expect } from '@playwright/test';

test('authored props, full squads and all eight weapon effects render on desktop and phone', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/v2/assets/README.md');
  await page.setContent('<style>body{margin:0;background:#071211}canvas{display:block;width:100vw;height:100vh}</style><canvas id="fixture"></canvas>');
  const results = await page.evaluate(async () => {
    const [{ CombatEngine }, { GameRenderer }, { sanitizeProfile }, { WEAPONS, LOOT }] = await Promise.all([
      import('/v2/src/engine.js'), import('/v2/src/renderer.js'), import('/v2/src/storage.js'), import('/v2/src/config.js')
    ]);
    const renderer = new GameRenderer(document.querySelector('canvas'), { quality: 'high', reducedMotion: true, screenShake: false });
    await renderer.load();
    const e = new CombatEngine(sanitizeProfile({ accountLevel: 8 }), 'campaign', 'visual'); e.setViewport(renderer.viewWidth);
    const s = e.state; s.squad = 40; e.syncSquadBounds(); s.time = 3; s.paused = true;
    const middle = 480, span = Math.min(renderer.viewWidth - 120, 500);
    for (const [i, type] of ['wreck', 'barrel', 'fire', 'flood'].entries()) e.spawn('hazards', { type, x: middle + (i % 2 - .5) * span * .65, y: 110 + Math.floor(i / 2) * 130, previousY: 110 + Math.floor(i / 2) * 130, size: 42, hp: Infinity, life: 10 });
    for (const [i, loot] of LOOT.entries()) e.spawn('pickups', { x: middle + (i - 2) * span / 5, y: 365, previousY: 365, loot });
    let soldiers = 0, props = 0; const sprite = renderer.sprite.bind(renderer), prop = renderer.prop.bind(renderer);
    renderer.sprite = (...args) => { if (args[1] === 0) soldiers++; sprite(...args); };
    renderer.prop = (...args) => { props++; prop(...args); };
    renderer.render(e); const counts = { soldiers, props, assets: Object.keys(renderer.assets).length };
    window.visualFixture = { renderer, e, weapons: Object.keys(WEAPONS) };
    return counts;
  });
  expect(results).toEqual({ soldiers: 40, props: 9, assets: 3 });
  await page.screenshot({ path: info.outputPath('squad-and-props.png') });
  const frames = [];
  for (const weapon of ['rifle', 'shotgun', 'sniper', 'minigun', 'flame', 'tesla', 'freeze', 'grenade']) {
    frames.push(await page.evaluate(id => {
      const { renderer, e } = window.visualFixture, s = e.state;
      s.hazards.length = s.pickups.length = 0; s.bullets.forEach(b => e.pools.bullets.release(b)); s.bullets.length = 0;
      s.squad = 8; s.volley = 0; s.fireTimer = 0; e.selectWeapon(id); e.syncSquadBounds(); e.fireWeapon();
      e.updateBullets(.35); renderer.render(e);
      return renderer.canvas.toDataURL();
    }, weapon));
    await page.screenshot({ path: info.outputPath(`weapon-${weapon}.png`) });
  }
  expect(new Set(frames).size).toBe(8); expect(errors).toEqual([]);
});
