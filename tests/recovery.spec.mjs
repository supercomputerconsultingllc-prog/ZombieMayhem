import { test, expect } from '@playwright/test';
test('reload recovery resumes behind a pause screen and mobile preferences persist', async ({ page }) => {
  await page.goto('/v2/');
  await page.getByRole('button', { name: 'Start V2.0 Run', exact: true }).click();
  await page.locator('#pauseBtn').click();
  await page.reload();
  await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.locator('#settingsBtn').click();
  await page.locator('#leftHanded').check(); await page.locator('#haptics').uncheck();
  await page.locator('#textScale').fill('140');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('body')).toHaveClass(/left-handed/);
  await page.reload(); await expect(page.locator('body')).toHaveClass(/left-handed/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zombieMayhemV2Settings')))).toMatchObject({ leftHanded: true, haptics: false, textScale: 140 });
});
