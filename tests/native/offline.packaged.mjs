import { test, expect } from '@playwright/test';
test('installed web payload boots without external requests and restores an interrupted run', async ({ page }) => {
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => { const url = new URL(route.request().url()); if (url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort(); } return route.continue(); });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__zombieV2.snapshot().time)).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('zombie:appstate', { detail: { isActive: false } })));
  await expect.poll(() => page.evaluate(() => window.__zombieV2.snapshot().paused)).toBe(true);
  await page.reload(); await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__zombieV2.snapshot().paused)).toBe(false);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
