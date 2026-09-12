import { test, expect } from '@playwright/test';

async function runtimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test('preserved V1.2 and isolated V2.0 both load', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page).toHaveTitle('Zombie Mayhem');
  await expect(page.getByRole('button', { name: 'Start Run', exact: true })).toBeVisible();

  await page.goto('/v2/index.html');
  await expect(page).toHaveTitle('Zombie Mayhem V2.0');
  await expect(page.getByRole('heading', { name: /Zombie Mayhem V2\.0/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /preserved V1\.2 build/i })).toHaveAttribute('href', '../index.html');
  await expect.poll(() => page.evaluate(() => window.__zombieV2?.version)).toMatch(/^2\.0\.0-(alpha|beta)\./);
});

test('V2.0 changes mode, starts, pauses, resumes, and reports runtime state', async ({ page }) => {
  const errors = await runtimeErrors(page);
  await page.goto('/v2/index.html');

  await page.getByRole('button', { name: /Boss Rush/i }).click();
  await expect(page.getByRole('button', { name: /Boss Rush/i })).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();

  await expect.poll(() => page.evaluate(() => window.__zombieV2?.snapshot())).toMatchObject({
    version: expect.stringMatching(/^2\.0\.0-(alpha|beta)\./),
    mode: 'bossrush',
    running: true,
    paused: false,
    gameOver: false,
    weapon: 'rifle'
  });

  await page.locator('#pauseBtn').click();
  await expect(page.getByRole('heading', { name: 'Hold the line', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__zombieV2?.snapshot().paused)).toBe(true);

  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__zombieV2?.snapshot().paused)).toBe(false);
  await expect(page.locator('#gameCanvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('V2.0 exposes deterministic simulation and tactical systems', async ({ page }) => {
  await page.goto('/v2/index.html');
  await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
  const snapshot = await page.evaluate(() => window.__zombieV2.snapshot());
  expect(snapshot.seed).toMatch(/^\d{8}$/);
  expect(snapshot.formation).toBe('wedge');
  expect(snapshot.biome).toBe('highway');
  if (await page.locator('#loadoutBtn').isVisible()) {
    await page.locator('#loadoutBtn').click();
    await page.locator('#mobileFormation').selectOption('box');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  } else {
    await expect(page.locator('#formationSelect')).toHaveValue('wedge');
    await page.locator('#formationSelect').selectOption('box');
  }
  await expect.poll(() => page.evaluate(() => window.__zombieV2.snapshot().formation)).toBe('box');
});

test('V2.0 settings persist and accessibility classes apply', async ({ page }) => {
  const errors = await runtimeErrors(page);
  await page.goto('/v2/index.html');
  await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
  await page.locator('#settingsBtn').click();

  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.locator('#masterVolume').fill('41');
  await page.locator('#masterVolume').dispatchEvent('input');
  await page.locator('#reducedMotion').check();
  await page.locator('#highContrast').check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await expect(page.locator('body')).toHaveClass(/reduced-motion/);
  await expect(page.locator('body')).toHaveClass(/high-contrast/);
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/reduced-motion/);
  await expect(page.locator('body')).toHaveClass(/high-contrast/);

  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('zombieMayhemV2Settings')));
  expect(settings.masterVolume).toBe(41);
  expect(settings.reducedMotion).toBe(true);
  expect(settings.highContrast).toBe(true);
  expect(errors).toEqual([]);
});

test('V2.0 skill and save tools open from title screen', async ({ page }) => {
  const errors = await runtimeErrors(page);
  await page.goto('/v2/index.html');

  await page.getByRole('button', { name: 'Skill Trees', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Skill Trees', exact: true })).toBeVisible();
  await expect(page.locator('.skill-tree')).toHaveCount(5);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page).toHaveTitle('Zombie Mayhem V2.0');

  await page.getByRole('button', { name: 'Save Tools', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Save Tools', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('#saveData')).not.toHaveValue('');
  expect(errors).toEqual([]);
});
