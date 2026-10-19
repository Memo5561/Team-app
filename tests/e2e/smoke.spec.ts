import { expect, test, type Page } from '@playwright/test';

/** Collects console errors, uncaught exceptions and CSP violations for a page. */
async function watchForProblems(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  await page.exposeFunction('reportCspViolation', (directive: string, blocked: string) => {
    problems.push(`csp: ${directive} blocked ${blocked}`);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as Record<string, (d: string, b: string) => void>)
        .reportCspViolation;
      report?.(event.violatedDirective, event.blockedURI);
    });
  });
  return problems;
}

test('home page renders in German without errors or CSP violations', async ({ page }) => {
  const problems = await watchForProblems(page);
  const response = await page.goto('/');

  // `vite preview` serves the same security headers as the deployment (vite.config.ts).
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  await expect(page).toHaveTitle('TeamPanel');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { level: 1, name: 'TeamPanel' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('unknown routes show the 404 page with a way back', async ({ page }) => {
  const problems = await watchForProblems(page);
  await page.goto('/gibt-es-nicht');
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
  await expect(page).toHaveTitle('Seite nicht gefunden · TeamPanel');

  const backHome = page.getByRole('link', { name: 'Zur Startseite' });
  const box = await backHome.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44); // touch target size (spec §45)

  await backHome.click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'TeamPanel' })).toBeFocused();
  expect(problems).toEqual([]);
});
