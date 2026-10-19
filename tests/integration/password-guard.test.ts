import { isAuthApiError } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmLink } from '../support/mailpit';
import {
  cleanUp,
  createConfirmedUser,
  mailpit,
  newPassword,
  profileOf,
  publicClient,
  signedInClient,
  SUBJECTS,
  uniqueEmail,
  type Client,
} from './support/supabase';

// E-46 against the real Auth server: a password chosen before the first e-mail confirmation does not
// survive it (trigger on_auth_user_first_confirmation, supabase/migrations/…_clear_password_before_
// first_confirmation.sql; pgTAP: supabase/tests/database/020_auth_users_password_guard.test.sql).
// Admin-created accounts and passwords set after the confirmation keep working.

const emails = new Set<string>();
function email(label: string): string {
  const address = uniqueEmail(label);
  emails.add(address);
  return address;
}

afterAll(async () => {
  await cleanUp(emails);
});

/** GoTrue sends at most one confirmation mail per address per `max_frequency` (config.toml: 1 s). */
const MAIL_INTERVAL_MS = 1_100;

/** Mails whose /auth/confirm link confirms a still unconfirmed account. */
const CONFIRMING_MAILS = {
  confirmation: { subject: SUBJECTS.confirmation, type: 'email' },
  recovery: { subject: SUBJECTS.recovery, type: 'recovery' },
} as const;

/**
 * Opens the /auth/confirm link of the next mail to `address` (a confirmation mail unless stated
 * otherwise) the way the app does: verifyOtp with the token hash on a fresh client ("the device of
 * whoever reads the mailbox").
 */
async function confirmFromMailbox(
  address: string,
  seen: Set<string>,
  mail: keyof typeof CONFIRMING_MAILS = 'confirmation',
): Promise<Client> {
  const { subject, type } = CONFIRMING_MAILS[mail];
  const message = await mailpit().nextMessage(address, seen);
  expect(message.subject).toBe(subject);
  const tokenHash = confirmLink(message, type).searchParams.get('token_hash') ?? '';

  const client = publicClient();
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
  expect(error).toBeNull();
  expect(data.session).not.toBeNull();
  expect(data.user?.email_confirmed_at).toEqual(expect.any(String));
  return client;
}

async function expectPasswordRejected(address: string, password: string): Promise<void> {
  const { data, error } = await publicClient().auth.signInWithPassword({
    email: address,
    password,
  });
  expect(data.session).toBeNull();
  expect(isAuthApiError(error)).toBe(true);
  expect(error?.code).toBe('invalid_credentials');
}

async function expectOwnProfileVisible(client: Client, userId: string): Promise<void> {
  const { data, error } = await client.from('profiles').select('id');
  expect(error).toBeNull();
  expect(data).toEqual([{ id: userId }]);
}

/**
 * The attack: sign-up with someone else's address and the attacker's password, by a direct API call
 * (the app has no password field on sign-up). Returns the new, unconfirmed user's id.
 */
async function signUpAsAttacker(address: string, attackerPassword: string): Promise<string> {
  const signUp = await publicClient().auth.signUp({
    email: address,
    password: attackerPassword,
    options: { data: { display_name: 'Mallory Angreifer', locale: 'de' } },
  });
  expect(signUp.error).toBeNull();
  const userId = signUp.data.user?.id ?? '';
  expect(userId).not.toBe('');
  return userId;
}

describe('password chosen before the e-mail confirmation (E-46)', () => {
  // Each case reaches GoTrue's User.Confirm through a different code path. Together with the pgTAP
  // replay they fail if a new Auth version confirms in a way the trigger no longer recognises.

  it('does not survive the confirmation mail the attacker triggered', async () => {
    const address = email('preaccount');
    const attackerPassword = newPassword();
    const userId = await signUpAsAttacker(address, attackerPassword);

    const owner = await confirmFromMailbox(address, new Set());

    await expectPasswordRejected(address, attackerPassword);
    const { data, error } = await owner.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(userId);
    await expectOwnProfileVisible(owner, userId);
    // Accepted residual (E-46): the name from the attacker's sign-up stays until the profile screen
    // exists.
    expect(await profileOf(userId)).toEqual({ display_name: 'Mallory Angreifer', locale: 'de' });
  });

  it("does not survive when the address owner signs up later and confirms that sign-up's mail", async () => {
    const address = email('preaccount-later');
    const attackerPassword = newPassword();
    const seen = new Set<string>();
    const userId = await signUpAsAttacker(address, attackerPassword);
    await mailpit().nextMessage(address, seen); // the attacker's mail, never opened
    await new Promise((resolve) => setTimeout(resolve, MAIL_INTERVAL_MS));

    // The owner registers like the app's /signup does. GoTrue leaves the existing unconfirmed account
    // as it is and only sends a new confirmation mail.
    const otp = await publicClient().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, data: { display_name: 'Anna Echt', locale: 'de' } },
    });
    expect(otp.error).toBeNull();
    const owner = await confirmFromMailbox(address, seen);

    await expectPasswordRejected(address, attackerPassword);
    await expectOwnProfileVisible(owner, userId);
    expect(await profileOf(userId)).toEqual({ display_name: 'Mallory Angreifer', locale: 'de' });
  });

  it('does not survive the sign-in link from /login (shouldCreateUser: false)', async () => {
    const address = email('preaccount-login-link');
    const attackerPassword = newPassword();
    const seen = new Set<string>();
    const userId = await signUpAsAttacker(address, attackerPassword);
    await mailpit().nextMessage(address, seen); // the attacker's mail, never opened
    await new Promise((resolve) => setTimeout(resolve, MAIL_INTERVAL_MS));

    // Like the app's /login link. For an unconfirmed account GoTrue runs the sign-up again
    // (Otp → MagicLink → Signup) and resends the confirmation mail instead of a magic link.
    const otp = await publicClient().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false },
    });
    expect(otp.error).toBeNull();
    const owner = await confirmFromMailbox(address, seen);

    await expectPasswordRejected(address, attackerPassword);
    await expectOwnProfileVisible(owner, userId);
  });

  it('does not survive a "Passwort vergessen" link that confirms the account', async () => {
    const address = email('preaccount-recovery');
    const attackerPassword = newPassword();
    const seen = new Set<string>();
    const userId = await signUpAsAttacker(address, attackerPassword);
    await mailpit().nextMessage(address, seen); // the attacker's mail, never opened

    // Like the app's "Passwort vergessen" (no redirectTo). Recovery mails have their own interval
    // (recovery_sent_at), so no wait is needed. Opening the link runs recoverVerify: Recover(), then
    // Confirm() of the still unconfirmed account.
    const recover = await publicClient().auth.resetPasswordForEmail(address);
    expect(recover.error).toBeNull();
    const owner = await confirmFromMailbox(address, seen, 'recovery');

    await expectPasswordRejected(address, attackerPassword);
    const { data, error } = await owner.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(userId);
    await expectOwnProfileVisible(owner, userId);
  });
});

describe('passwords that are kept', () => {
  it('an account created with admin.createUser (email_confirm) signs in with its password', async () => {
    const account = await createConfirmedUser('Ada Admin');
    emails.add(account.email);

    const client = await signedInClient(account);

    await expectOwnProfileVisible(client, account.id);
    expect(await profileOf(account.id)).toEqual({ display_name: 'Ada Admin', locale: 'de' });
  });

  it('a password set after the confirmation of a sign-up by e-mail link works', async () => {
    const address = email('signup-then-password');
    const signUp = await publicClient().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, data: { display_name: 'Paula Passwort', locale: 'de' } },
    });
    expect(signUp.error).toBeNull();
    const client = await confirmFromMailbox(address, new Set());
    const { data: confirmed } = await client.auth.getUser();
    const userId = confirmed.user?.id ?? '';
    expect(userId).not.toBe('');

    // The optional "Passwort festlegen" step right after the first confirmation.
    const password = newPassword();
    const update = await client.auth.updateUser({ password });
    expect(update.error).toBeNull();
    const signOut = await client.auth.signOut();
    expect(signOut.error).toBeNull();

    const again = await signedInClient({ id: userId, email: address, password });
    await expectOwnProfileVisible(again, userId);
    expect(await profileOf(userId)).toEqual({ display_name: 'Paula Passwort', locale: 'de' });
  });
});
