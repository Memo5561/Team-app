import { randomBytes } from 'node:crypto';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  confirmLink,
  Mailpit,
  type ConfirmLinkType,
  type MailMessage,
} from '../../support/mailpit';
import { readE2eSupabase, type E2eSupabase } from './supabase-env';

/**
 * Fixtures for the @supabase e2e tests (real local Supabase + Mailpit). Every test that imports
 * `test` from here is skipped when the global setup found no usable stack (never in CI).
 */

// `.internal` is reserved for private use (ICANN, 2024) and is not on GoTrue's list of rejected
// test domains (.test, .example, .invalid, .local, .localhost, example.com, …). Mails only ever
// reach the local Mailpit.
const EMAIL_DOMAIN = 'e2e.teampanel.internal';

/** German subjects from supabase/config.toml ([auth.email.template.*]). */
export const SUBJECTS = {
  confirmation: 'Bestätige deine E-Mail-Adresse für TeamPanel',
  magicLink: 'Dein Anmeldelink für TeamPanel',
  recovery: 'Neues Passwort für TeamPanel festlegen',
} as const;

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

/** Mail access for one test: only the test's own addresses, deleted again afterwards. */
export interface Mailbox {
  /** Marks an address as the test's own, so its mails are deleted after the test. */
  track(address: string): void;
  /** Waits for the next not yet consumed e-mail to `address`. */
  next(address: string): Promise<MailMessage>;
  /** Waits for the next e-mail to `address` and returns its /auth/confirm link as in-app path. */
  nextLink(address: string, type: ConfirmLinkType, subject: string): Promise<string>;
}

interface Fixtures {
  supabase: E2eSupabase;
  mailbox: Mailbox;
  /** Fresh credentials with a unique e-mail address (no account yet). */
  newUser: (label: string) => TestUser;
  /**
   * A confirmed account with a password, created through the public Auth API like a real user:
   * sign-up via e-mail link, confirmation, then the password set in that session (E-46).
   */
  registeredUser: (label: string) => Promise<TestUser>;
  /** A second browser context with the same device settings: another device of the same user. */
  newDevice: () => Promise<BrowserContext>;
}

/**
 * The path + query of a mailed link. The templates use {{ .SiteURL }} (dev server :5173); opening
 * the relative path lets the page's baseURL (preview server) supply the origin.
 */
function inAppPath(link: URL): string {
  return `${link.pathname}${link.search}`;
}

export const test = base.extend<Fixtures>({
  supabase: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure.
    async ({}, use, testInfo) => {
      const env = readE2eSupabase();
      testInfo.skip(env === undefined, 'local Supabase not available (see global setup output)');
      if (env !== undefined) await use(env);
    },
    { auto: true },
  ],

  mailbox: async ({ supabase }, use) => {
    const mailpit = new Mailpit(supabase.mailpitUrl);
    const seen = new Map<string, Set<string>>();
    const consumed = (address: string) => {
      const ids = seen.get(address) ?? new Set<string>();
      seen.set(address, ids);
      return ids;
    };
    const next = (address: string) => mailpit.nextMessage(address, consumed(address));
    await use({
      track(address) {
        consumed(address);
      },
      next,
      async nextLink(address, type, subject) {
        const message = await next(address);
        expect(message.subject, `subject of the e-mail to ${address}`).toBe(subject);
        return inAppPath(confirmLink(message, type));
      },
    });
    await mailpit.deleteMessagesTo(seen.keys());
  },

  newUser: async ({ mailbox }, use, testInfo) => {
    await use((label) => {
      const unique = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
      const email = `${label}-${testInfo.project.name}-${unique}@${EMAIL_DOMAIN}`.toLowerCase();
      mailbox.track(email);
      return {
        name: `Erika ${label}`,
        email,
        password: `Pw-${randomBytes(15).toString('base64url')}`,
      };
    });
  },

  registeredUser: async ({ supabase, mailbox, newUser }, use) => {
    await use(async (label) => {
      const user = newUser(label);
      const client = createClient(supabase.apiUrl, supabase.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const signUp = await client.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: true, data: { display_name: user.name, locale: 'de' } },
      });
      if (signUp.error !== null) {
        throw new Error(`sign-up failed: ${String(signUp.error.code)}`);
      }

      const path = await mailbox.nextLink(user.email, 'email', SUBJECTS.confirmation);
      const tokenHash = new URL(path, supabase.apiUrl).searchParams.get('token_hash') ?? '';
      const verify = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
      if (verify.error !== null) {
        throw new Error(`confirmation failed: ${String(verify.error.code)}`);
      }

      // Only a password set after the confirmation is kept (the database drops earlier ones).
      const update = await client.auth.updateUser({ password: user.password });
      if (update.error !== null) {
        throw new Error(`setting the password failed: ${String(update.error.code)}`);
      }
      return user;
    });
  },

  newDevice: async (
    {
      browser,
      baseURL,
      viewport,
      userAgent,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      locale,
      timezoneId,
    },
    use,
  ) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext({
        baseURL,
        viewport,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
        locale,
        timezoneId,
      });
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect };

/** Fills the login form and submits it with the password button. */
export async function signInWithPassword(page: Page, email: string, password: string) {
  await page.getByLabel('E-Mail', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
}

/** Opens an e-mail link and confirms it on /auth/confirm (the token leaves the URL right away). */
export async function openEmailLink(page: Page, path: string, heading: string) {
  await page.goto(path);
  await expect(page).toHaveURL('/auth/confirm');
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Weiter' });
  // The button is busy (and ignores clicks) until the auth state has loaded.
  await expect(confirm).not.toHaveAttribute('aria-busy', 'true');
  await confirm.click();
}

/** The optional "Passwort festlegen" step that follows an account's first confirmation. */
export async function expectPasswordSetup(page: Page) {
  await expect(page).toHaveURL('/reset-password');
  await expect(page.getByRole('heading', { level: 1, name: 'Passwort festlegen' })).toBeVisible();
}

/** Fills the new-password form (reset and setup mode) and saves it. */
export async function saveNewPassword(page: Page, password: string) {
  await page.getByLabel('Neues Passwort', { exact: true }).fill(password);
  await page.getByLabel('Passwort wiederholen', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Passwort speichern' }).click();
}

export async function expectHome(page: Page, name: string) {
  await expect(page.getByRole('heading', { level: 1, name: `Hallo, ${name}!` })).toBeVisible();
}

export async function expectCheckInbox(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Prüfe dein Postfach' })).toBeVisible();
  await expect(
    page.getByText('Keine E-Mail erhalten? Warte eine Minute und versuche es erneut.'),
  ).toBeVisible();
}

/** "Abmelden" on the start page (exact: "Überall abmelden" contains the same word). */
export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
}
