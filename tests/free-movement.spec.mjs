import { test, expect } from '@playwright/test';
const snap = page => page.evaluate(() => window.__zombieV2.snapshot());
async function start(page) {
  await page.addInitScript(() => localStorage.setItem('zombieMayhemV2Profile', JSON.stringify({ tutorialComplete: true })));
  await page.goto('/v2/index.html'); await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
}
test('drag moves in two axes, release stops, and pause clears held keys', async ({ page }) => {
  await start(page); const before = (await snap(page)).position;
  const box = await page.locator('#gameCanvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * .7); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height * .7 - 80, { steps: 12 });
  await page.waitForTimeout(400); await page.mouse.up();
  const moved = (await snap(page)).position; expect(moved.x).toBeGreaterThan(before.x + 10); expect(moved.y).toBeLessThan(before.y - 25);
  await page.waitForTimeout(200); expect((await snap(page)).position).toEqual(moved);
  await page.keyboard.down('a'); await page.waitForTimeout(100); await page.locator('#pauseBtn').click(); await page.keyboard.up('a');
  const paused = (await snap(page)).position; await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForTimeout(200); expect((await snap(page)).position).toEqual(paused);
});
test('real touch drag and pointer cancellation do not leave movement stuck', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch injection is Chromium-specific; pointer/keyboard cases run on all engines.');
  await start(page); const before = (await snap(page)).position;
  const box = await page.locator('#movePad').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 40, y: y - 55, id: 1 }] });
  await page.waitForTimeout(400); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  const moved = (await snap(page)).position; expect(moved.x).toBeGreaterThan(before.x); expect(moved.y).toBeLessThan(before.y);
  await page.waitForTimeout(200); expect((await snap(page)).position).toEqual(moved);
});
test('orientation changes keep the player visible with reachable controls', async ({ page }, info) => {
  await start(page); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
  let s = await snap(page); expect(s.viewport).toBeLessThan(600);
  await expect(page.locator('#leftBtn')).toBeHidden(); await expect(page.locator('#abilityBtn')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('portrait.png') });
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(200);
  s = await snap(page); expect(s.position.x).toBeGreaterThan(480 - s.viewport / 2); expect(s.position.x).toBeLessThan(480 + s.viewport / 2);
  await expect(page.locator('#movePad')).toBeInViewport(); await expect(page.locator('#abilityBtn')).toBeInViewport();
});
