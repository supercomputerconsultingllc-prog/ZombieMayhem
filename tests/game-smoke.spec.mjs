import { test, expect } from '@playwright/test';

async function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const expectedOfflineNoise = /supabase|cdn\.jsdelivr|Failed to load resource: net::ERR_FAILED/i.test(text);
    if (!expectedOfflineNoise) errors.push(text);
  });
  return errors;
}

const startRunButton = (page) => page.getByRole('button', { name: 'Start Run', exact: true });
const titleSettingsButton = (page) => page.getByRole('button', { name: 'Settings', exact: true });

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  // V1 warms up checkout on page load. Keep smoke tests offline and payment-free.
  await page.route('https://checkout.stripe.com/**', (route) => route.fulfill({ status: 200, body: '' }));
});

test('title, settings, start, pause, resume, and restart remain functional', async ({ page }) => {
  // Several complete menu transitions take longer on mobile WebKit in CI.
  test.setTimeout(60_000);
  const errors = await collectRuntimeErrors(page);
  await page.goto('/index.html');

  await expect(page).toHaveTitle('Zombie Mayhem');
  await expect(page.getByRole('heading', { name: 'Zombie Mayhem', exact: true })).toBeVisible();
  await expect(startRunButton(page)).toBeVisible();
  await expect(titleSettingsButton(page)).toBeVisible();

  await titleSettingsButton(page).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('#volumeRange')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await startRunButton(page).click();

  const pauseButton = page.locator('#pauseBtn');
  await expect(pauseButton).toBeVisible();
  await pauseButton.click();
  await expect(page.getByRole('heading', { name: 'Paused', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Unpause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Paused', exact: true })).toBeHidden();

  await pauseButton.click();
  await page.locator('#overlay').getByRole('button', { name: 'Restart Run', exact: true }).click();
  await expect(page.locator('.app')).toBeVisible();
  await expect(pauseButton).toBeVisible();
  expect(errors).toEqual([]);
});

test('local settings survive reload when cloud services are unavailable', async ({ page }) => {
  const errors = await collectRuntimeErrors(page);
  await page.goto('/index.html');
  await titleSettingsButton(page).click();

  const volume = page.locator('#volumeRange');
  await volume.fill('37');
  await volume.dispatchEvent('input');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await titleSettingsButton(page).click();
  await expect(page.locator('#volumeRange')).toHaveValue('37');
  expect(errors).toEqual([]);
});

test('capture presets load without crashing', async ({ page }) => {
  const errors = await collectRuntimeErrors(page);
  for (const scene of ['title', 'action', 'wall', 'shop', 'revive']) {
    await page.goto(`/index.html?capture=1&scene=${scene}`);
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('.app')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
