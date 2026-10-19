import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  expect,
  expectCheckInbox,
  expectHome,
  expectPasswordSetup,
  openEmailLink,
  saveNewPassword,
  signInWithPassword,
  signOut,
  SUBJECTS,
  test,
  type TestUser,
} from './support/fixtures';

// Registration against the local Supabase stack; mails are read from Mailpit. Sign-up asks for
// name and e-mail only; a password can be set right after the first confirmation (E-46).

async function signUp(page: Page, user: TestUser) {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { level: 1, name: 'Konto erstellen' })).toBeVisible();
  await expect(page.getByLabel(/Passwort/)).toHaveCount(0);
  await page.getByLabel('Name', { exact: true }).fill(user.name);
  await page.getByLabel('E-Mail', { exact: true }).fill(user.email);
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expectCheckInbox(page);
}

const INVALID_CREDENTIALS = 'E-Mail-Adresse oder Passwort ist falsch.';

test.describe('registration', { tag: '@supabase' }, () => {
  test.describe.configure({ timeout: 90_000 });

  test('sign-up, confirm on another device, set a password, sign out and in with it', async ({
    page,
    mailbox,
    newUser,
    newDevice,
  }) => {
    const user = newUser('signup');
    await page.goto('/signup');
    await expect(page.getByRole('heading', { level: 1, name: 'Konto erstellen' })).toBeVisible();
    await expect(page.getByLabel(/Passwort/)).toHaveCount(0);
    // Extra whitespace is normalized like the database does it.
    await page.getByLabel('Name', { exact: true }).fill(`  ${user.name.replace(' ', '   ')} `);
    await page.getByLabel('E-Mail', { exact: true }).fill(user.email.toUpperCase());
    await page.getByRole('button', { name: 'Konto erstellen' }).click();
    await expectCheckInbox(page);
    await expect(
      page.getByText(`Wir haben dir eine E-Mail an ${user.email} geschickt.`),
    ).toBeVisible();

    // The link is opened on another device (cross-device: no PKCE verifier there).
    const link = await mailbox.nextLink(user.email, 'email', SUBJECTS.confirmation);
    const otherDevice = await (await newDevice()).newPage();
    await openEmailLink(otherDevice, link, 'Anmeldung bestätigen');
    await expectPasswordSetup(otherDevice);
    await saveNewPassword(otherDevice, user.password);
    await expect(otherDevice).toHaveURL('/');
    await expect(
      otherDevice.getByText(
        'Passwort festgelegt. Du kannst dich ab jetzt auch mit E-Mail-Adresse und Passwort anmelden.',
      ),
    ).toBeVisible();
    await expectHome(otherDevice, user.name);

    await signOut(otherDevice);
    await signInWithPassword(otherDevice, user.email, user.password);
    await expect(otherDevice).toHaveURL('/');
    await expectHome(otherDevice, user.name);
  });

  test('skipping the password step keeps sign-in by e-mail link', async ({
    page,
    mailbox,
    newUser,
  }) => {
    const user = newUser('passwordless');
    await signUp(page, user);

    const link = await mailbox.nextLink(user.email, 'email', SUBJECTS.confirmation);
    await openEmailLink(page, link, 'Anmeldung bestätigen');
    await expectPasswordSetup(page);
    await page.getByRole('link', { name: 'Überspringen' }).click();
    await expect(page).toHaveURL('/');
    await expectHome(page, user.name);

    // No password: the password sign-in fails, the sign-in link works (and skips the step).
    await signOut(page);
    await signInWithPassword(page, user.email, user.password);
    await expect(page.getByRole('alert')).toContainText(INVALID_CREDENTIALS);
    await page.getByRole('button', { name: 'Anmeldelink per E-Mail' }).click();
    await expectCheckInbox(page);
    const signInLink = await mailbox.nextLink(user.email, 'email', SUBJECTS.magicLink);
    await openEmailLink(page, signInLink, 'Anmeldung bestätigen');
    await expect(page).toHaveURL('/');
    await expectHome(page, user.name);
  });

  test('a password chosen before the confirmation does not survive it (E-46)', async ({
    page,
    mailbox,
    newUser,
    supabase,
  }) => {
    // Someone else registers the address directly through the Auth API, with their password.
    const user = newUser('takeover');
    const attacker = createClient(supabase.apiUrl, supabase.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await attacker.auth.signUp({
      email: user.email,
      password: user.password,
      options: { data: { display_name: user.name, locale: 'de' } },
    });
    expect(error).toBeNull();

    // The owner of the address confirms it with the link from that mail.
    const link = await mailbox.nextLink(user.email, 'email', SUBJECTS.confirmation);
    await openEmailLink(page, link, 'Anmeldung bestätigen');
    await expectPasswordSetup(page);
    await page.getByRole('link', { name: 'Überspringen' }).click();
    await expectHome(page, user.name);

    await signOut(page);
    await signInWithPassword(page, user.email, user.password);
    await expect(page.getByRole('alert')).toContainText(INVALID_CREDENTIALS);
    await expect(page).toHaveURL('/login');
  });
});
