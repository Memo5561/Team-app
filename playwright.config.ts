import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Optional override for environments with a preinstalled browser build that differs from the
// one this Playwright version expects (e.g. cloud sessions). CI installs the matching browser.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: 'tests/e2e',
  // Checks the local Supabase stack for the @supabase tests: skipped without it locally,
  // a hard failure in CI (see tests/README.md).
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'de-AT',
    timezoneId: 'Europe/Vienna',
    trace: 'retain-on-failure',
  },
  // Mobile-first (spec §45): every flow runs on a phone viewport and on desktop.
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions } },
  ],
  webServer: {
    // vite.config.ts pins host 127.0.0.1 and adds the production security headers to `preview`.
    command: `pnpm build --mode e2e && pnpm preview --mode e2e --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
  },
});
