import { expect, test, type Locator, type Page } from '@playwright/test';

// Smoke tests: no Supabase needed. Without a session the app never calls Supabase on these pages,
// so they also run with the placeholder values from .env.e2e.

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

/** Answers requests to the Supabase API path (e.g. `auth/v1/recover`) with a fixed response. */
async function mockSupabase(page: Page, path: string, status: number, body: object) {
  await page.route(`**/${path}**`, async (route) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    await route.fulfill({ status, headers: cors, contentType: 'application/json', json: body });
  });
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

/** Touch targets are at least 44 px high (spec §45). */
async function expectTouchTarget(target: Locator) {
  const box = await target.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}

test('start page sends guests to the German login without errors or CSP violations', async ({
  page,
}) => {
  const problems = await watchForProblems(page);
  const response = await page.goto('/');

  // `vite preview` serves the same security headers as the deployment (vite.config.ts).
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  await expect(page).toHaveURL('/login?next=%2F');
  await expect(page).toHaveTitle('Anmelden · TeamPanel');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
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

  // The start page is protected: guests land on the login, focus moves to its heading.
  await backHome.click();
  await expect(page).toHaveURL('/login?next=%2F');
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeFocused();
  expect(problems).toEqual([]);
});

test('login form validates in the browser before contacting the server', async ({ page }) => {
  const problems = await watchForProblems(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

  // Zod runs jitless under the CSP; a violation would show up in `problems`.
  await expect(page.getByText('Bitte gib deine E-Mail-Adresse ein.')).toBeVisible();
  await expect(page.getByText('Bitte gib dein Passwort ein.')).toBeVisible();
  await expect(page.getByLabel('E-Mail', { exact: true })).toBeFocused();
  for (const field of ['E-Mail', 'Passwort']) {
    const box = await page.getByLabel(field, { exact: true }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(problems).toEqual([]);
});

test('sign-up and forgot-password pages render without errors', async ({ page }) => {
  const problems = await watchForProblems(page);
  await page.goto('/signup');
  await expect(page.getByRole('heading', { level: 1, name: 'Konto erstellen' })).toBeVisible();
  // Name and e-mail only: a password is set after the first confirmation (E-46).
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
  await expect(page.getByLabel('E-Mail', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/Passwort/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Konto erstellen' })).toHaveAccessibleDescription(
    'Wir schicken dir einen Link zur Bestätigung. Danach kannst du ein Passwort festlegen oder dich weiter per E-Mail-Link anmelden.',
  );

  await page.getByRole('link', { name: 'Anmelden', exact: true }).click();
  await page.getByRole('link', { name: 'Passwort vergessen?' }).click();
  await expect(page).toHaveURL('/forgot-password');
  await expect(page.getByRole('heading', { level: 1, name: 'Passwort vergessen' })).toBeFocused();
  expect(problems).toEqual([]);
});

test('e-mail links of unknown type are invalid and the token leaves the address bar', async ({
  page,
}) => {
  const problems = await watchForProblems(page);
  await page.goto('/auth/confirm?token_hash=abc123&type=signup');

  await expect(page).toHaveURL('/auth/confirm');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Link ungültig oder abgelaufen' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zur Anmeldung' })).toBeVisible();
  expect(problems).toEqual([]);
});

// Business addresses like vorname.nachname@firma.at are long and have no break opportunity. These
// checks mock the two Supabase Auth responses involved, so they also run without Supabase.
test.describe('long e-mail addresses on a 360 px phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  const longEmail = 'maximilian.mustermann@beispielunternehmen.at';

  test('"Prüfe dein Postfach" wraps the address instead of widening the page', async ({ page }) => {
    const problems = await watchForProblems(page);
    await mockSupabase(page, 'auth/v1/recover', 200, {});
    await page.goto('/forgot-password');
    await page.getByLabel('E-Mail', { exact: true }).fill(longEmail);
    await page.getByRole('button', { name: 'Link senden' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Prüfe dein Postfach' }),
    ).toBeVisible();
    await expect(page.getByText(longEmail, { exact: false })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(problems).toEqual([]);
  });

  test('"Bestätigungs-E-Mail erneut senden" fits the screen and is a 44 px target', async ({
    page,
  }) => {
    await mockSupabase(page, 'auth/v1/token', 400, {
      code: 400,
      error_code: 'email_not_confirmed',
      msg: 'Email not confirmed',
    });
    await page.goto('/login');
    await page.getByLabel('E-Mail', { exact: true }).fill(longEmail);
    await page.getByLabel('Passwort', { exact: true }).fill('ein langes Passwort');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

    const resend = page.getByRole('button', { name: 'Bestätigungs-E-Mail erneut senden' });
    await expect(resend).toBeVisible();
    const box = await resend.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);
  });
});

// The optional password step after an account's first confirmation (E-46). Auth and profile
// responses are mocked in the shape Supabase Auth returns them, so this also runs without
// Supabase; the real flow runs in auth-registration.spec.ts.
test.describe('first confirmation on a 360 px phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  const userId = '00000000-0000-4000-8000-000000000001';
  const signedUpAt = '2026-10-19T10:00:00.000001Z';
  const confirmedAt = '2026-10-19T10:05:00.000001Z';

  const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

  /** Response of POST /auth/v1/verify: a session from an e-mail link and the user's timestamps. */
  function verifyResponse(timestamps: Record<string, string>) {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      sub: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'anna@beispiel.at',
      iat: now,
      exp: now + 3600,
      aal: 'aal1',
      amr: [{ method: 'otp', timestamp: now }],
      session_id: '00000000-0000-4000-8000-000000000002',
    };
    return {
      // The app only decodes the token; the signature is never checked in the browser.
      access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(claims)}.c2lnbmF0dXJl`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: 'refresh-token',
      user: {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'anna@beispiel.at',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { display_name: 'Anna Muster', email_verified: true },
        identities: [],
        created_at: signedUpAt,
        confirmation_sent_at: signedUpAt,
        ...timestamps,
      },
    };
  }

  async function confirmEmailLink(page: Page, timestamps: Record<string, string>) {
    await mockSupabase(page, 'auth/v1/verify', 200, verifyResponse(timestamps));
    await mockSupabase(page, 'rest/v1/profiles', 200, [
      { display_name: 'Anna Muster', locale: 'de' },
    ]);
    await page.goto('/auth/confirm?token_hash=abc123&type=email');
    const confirm = page.getByRole('button', { name: 'Weiter' });
    await expect(confirm).not.toHaveAttribute('aria-busy', 'true');
    await confirm.click();
  }

  test('leads to the optional "Passwort festlegen" step, which can be skipped', async ({
    page,
  }) => {
    const problems = await watchForProblems(page);
    await confirmEmailLink(page, {
      email_confirmed_at: confirmedAt,
      last_sign_in_at: '2026-10-19T10:05:00.020001Z',
    });

    await expect(page).toHaveURL('/reset-password');
    await expect(page.getByRole('heading', { level: 1, name: 'Passwort festlegen' })).toBeVisible();
    await expect(page).toHaveTitle('Passwort festlegen · TeamPanel');
    const skip = page.getByRole('link', { name: 'Überspringen' });
    await expectTouchTarget(page.getByRole('button', { name: 'Passwort speichern' }));
    await expectTouchTarget(skip);
    await expectNoHorizontalScroll(page);

    await skip.click();
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Hallo, Anna Muster!' }),
    ).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('a later sign-in link goes straight home', async ({ page }) => {
    await confirmEmailLink(page, {
      email_confirmed_at: confirmedAt,
      recovery_sent_at: '2026-10-19T10:05:02.000001Z',
      last_sign_in_at: '2026-10-19T10:05:05.000001Z',
    });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Hallo, Anna Muster!' }),
    ).toBeVisible();
    await expect(page).toHaveURL('/');
  });
});
