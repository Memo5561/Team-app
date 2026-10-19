import { createClient } from '@supabase/supabase-js';
import {
  expect,
  expectCheckInbox,
  expectHome,
  openEmailLink,
  saveNewPassword,
  signInWithPassword,
  signOut,
  SUBJECTS,
  test,
} from './support/fixtures';

// Sign-in, e-mail links and route protection against the local Supabase stack.
test.describe('sign-in', { tag: '@supabase' }, () => {
  test.describe.configure({ timeout: 90_000 });

  test('magic link signs an existing user in', async ({ page, mailbox, registeredUser }) => {
    // Seconds after the account's confirmation: still a sign-in, not the first confirmation.
    const user = await registeredUser('magiclink');
    await page.goto('/login');
    await page.getByLabel('E-Mail', { exact: true }).fill(user.email);
    await page.getByRole('button', { name: 'Anmeldelink per E-Mail' }).click();
    await expectCheckInbox(page);

    const link = await mailbox.nextLink(user.email, 'email', SUBJECTS.magicLink);
    await openEmailLink(page, link, 'Anmeldung bestätigen');
    await expect(page).toHaveURL('/');
    await expectHome(page, user.name);
  });

  test('forgotten password: reset via e-mail link, then only the new password works', async ({
    page,
    mailbox,
    registeredUser,
  }) => {
    const user = await registeredUser('reset');
    const newPassword = `${user.password}-neu`;
    await page.goto('/login');
    await page.getByRole('link', { name: 'Passwort vergessen?' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Passwort vergessen' })).toBeVisible();
    await page.getByLabel('E-Mail', { exact: true }).fill(user.email);
    await page.getByRole('button', { name: 'Link senden' }).click();
    await expectCheckInbox(page);

    const link = await mailbox.nextLink(user.email, 'recovery', SUBJECTS.recovery);
    await openEmailLink(page, link, 'Passwort zurücksetzen');
    await expect(page).toHaveURL('/reset-password');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Neues Passwort festlegen' }),
    ).toBeVisible();
    await saveNewPassword(page, newPassword);
    await expect(page).toHaveURL('/');
    await expect(
      page.getByText('Dein Passwort wurde geändert. Andere Geräte wurden abgemeldet.'),
    ).toBeVisible();

    await signOut(page);
    await signInWithPassword(page, user.email, user.password);
    await expect(page.getByRole('alert')).toContainText('E-Mail-Adresse oder Passwort ist falsch.');
    await expect(page).toHaveURL('/login');

    await page.getByLabel('Passwort', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expectHome(page, user.name);
  });

  test('an e-mail link works only once', async ({ page, mailbox, registeredUser, supabase }) => {
    const user = await registeredUser('reuse');
    const client = createClient(supabase.apiUrl, supabase.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await client.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    expect(error).toBeNull();
    const link = await mailbox.nextLink(user.email, 'email', SUBJECTS.magicLink);

    await openEmailLink(page, link, 'Anmeldung bestätigen');
    await expectHome(page, user.name);
    await signOut(page);

    await openEmailLink(page, link, 'Anmeldung bestätigen');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Link ungültig oder abgelaufen' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Zur Anmeldung' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Passwort zurücksetzen' })).toBeVisible();
  });

  test('a forged e-mail link is rejected', async ({ page }) => {
    await openEmailLink(
      page,
      `/auth/confirm?token_hash=${'0'.repeat(56)}&type=email`,
      'Anmeldung bestätigen',
    );
    await expect(
      page.getByRole('heading', { level: 1, name: 'Link ungültig oder abgelaufen' }),
    ).toBeVisible();
  });

  test('protected routes send guests to the login and back afterwards', async ({
    page,
    registeredUser,
  }) => {
    const user = await registeredUser('redirect');
    await page.goto('/?ansicht=start');
    await expect(page).toHaveURL('/login?next=%2F%3Fansicht%3Dstart');
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();

    await signInWithPassword(page, user.email, user.password);
    await expect(page).toHaveURL('/?ansicht=start');
    await expectHome(page, user.name);

    // Signed in: guest-only pages lead home, and a password session cannot set a new password
    // without the current one (/reset-password needs a session from an e-mail link).
    await page.goto('/login');
    await expect(page).toHaveURL('/');
    await page.goto('/reset-password');
    await expect(page).toHaveURL('/');
    await expectHome(page, user.name);
  });
});
