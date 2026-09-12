import { test, expect } from '@playwright/test';

async function open(page, trained = true) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (trained) await page.addInitScript(() => localStorage.setItem('zombieMayhemV2Profile', JSON.stringify({ accountLevel: 8, tutorialComplete: true })));
  await page.goto('/v2/index.html'); await page.waitForFunction(() => window.__zombieV2?.snapshot().assetsLoaded);
  return errors;
}
const snap = page => page.evaluate(() => window.__zombieV2.snapshot());

test('new art loads and playfield remains 4:3 within the viewport', async ({ page }, info) => {
  const errors = await open(page);
  await page.screenshot({ path: info.outputPath('title.png') });
  await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
  await page.waitForTimeout(2800);
  const box = await page.locator('#gameCanvas').boundingBox(); expect(box.width / box.height).toBeCloseTo(4 / 3, 2);
  const overflow = await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > innerWidth, vertical: document.documentElement.scrollHeight > innerHeight + 2 }));
  expect(overflow).toEqual({ horizontal: false, vertical: false });
  await expect(page.locator('#rightBtn')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('gameplay.png') }); expect(errors).toEqual([]);
});
test('settings return to pause, and paused simulation stays frozen', async ({ page }) => {
  const errors = await open(page); await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
  await page.locator('#pauseBtn').click(); const time = (await snap(page)).time;
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#screenShake').uncheck(); await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hold the line' })).toBeVisible();
  expect((await snap(page)).time).toBe(time);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect.poll(async () => (await snap(page)).time).toBeGreaterThan(time); expect(errors).toEqual([]);
});
test('training responds to lane input and Overdrive; skip persists', async ({ page }) => {
  const errors = await open(page, false); await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
  expect((await snap(page)).tutorial).toBe(0); await page.locator('#leftBtn').click(); expect((await snap(page)).tutorial).toBe(1);
  await page.locator('#abilityBtn').click(); expect((await snap(page)).tutorial).toBe(2);
  await page.getByRole('button', { name: 'Skip training' }).click(); expect((await snap(page)).tutorial).toBe(-1);
  await page.reload(); expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zombieMayhemV2Profile')).profile.tutorialComplete)).toBe(true);
  expect(errors).toEqual([]);
});
test('draft cannot be bypassed with Escape and resumes after choosing once', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = await open(page);
  await page.locator('#runSeed').fill('draft-regression');
  await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose one upgrade' })).toBeVisible({ timeout: 45_000 });
  const before = await snap(page); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  expect((await snap(page)).time).toBe(before.time); expect((await snap(page)).screen).toBe('draft');
  await page.screenshot({ path: info.outputPath('draft.png') });
  await page.locator('[data-draft]').first().click(); expect((await snap(page)).paused).toBe(false);
  expect(errors).toEqual([]);
});
test('abandon confirmation records one result and returns to retained title', async ({ page }, info) => {
  const errors = await open(page); await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
  await page.locator('#pauseBtn').click(); await page.getByRole('button', { name: 'Title Screen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'End this run?' })).toBeVisible();
  await page.getByRole('button', { name: 'End run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start V2.0 Run', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Service Record', exact: true }).click();
  await expect(page.locator('details')).toHaveCount(1); await page.locator('summary').click();
  await page.screenshot({ path: info.outputPath('report.png') }); expect(errors).toEqual([]);
});
test('malformed save import stays in save tools and leaves profile intact', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Save Tools', exact: true }).click();
  await page.locator('#saveData').fill('not a valid backup'); await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.locator('#saveStatus')).toContainText('Import failed'); expect((await snap(page)).screen).toBe('saves');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start V2.0 Run', exact: true })).toBeVisible();
});
