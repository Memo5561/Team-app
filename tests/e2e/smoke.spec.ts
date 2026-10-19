import { expect, test, type Page } from '@playwright/test';

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('home page renders in German without errors', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/');

  await expect(page).toHaveTitle('TeamPanel');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { level: 1, name: 'TeamPanel' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('unknown routes show the 404 page with a way back', async ({ page }) => {
  await page.goto('/gibt-es-nicht');
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();

  const backHome = page.getByRole('link', { name: 'Zur Startseite' });
  const box = await backHome.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44); // touch target size (spec §45)

  await backHome.click();
  await expect(page).toHaveURL('/');
});
