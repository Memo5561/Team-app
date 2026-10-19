import { isAuthApiError } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { confirmLink } from '../support/mailpit';
import {
  cleanUp,
  createConfirmedUser,
  findUserByEmail,
  mailpit,
  newPassword,
  profileOf,
  publicClient,
  signedInClient,
  SUBJECTS,
  uniqueEmail,
} from './support/supabase';

// Sign-up and session behaviour of the real Auth server with this project's configuration
// (supabase/config.toml: confirmations on, minimum password length 10) and the profiles trigger.
// Nothing here asserts behaviour that differs between local and hosted Supabase on purpose
// (e.g. responses for already registered addresses).

const emails = new Set<string>();
function email(label: string): string {
  const address = uniqueEmail(label);
  emails.add(address);
  return address;
}

afterAll(async () => {
  await cleanUp(emails);
});

describe('sign-up', () => {
  // The app signs up by e-mail link only (E-46); the API still accepts a password. What happens to
  // that password at the confirmation: password-guard.test.ts.
  it('with a password creates the user and a normalized profile, without a session', async () => {
    const address = email('signup-password');
    const { data, error } = await publicClient().auth.signUp({
      email: address,
      password: newPassword(),
      options: { data: { display_name: '  Erika \t  Muster\n', locale: 'de' } },
    });

    expect(error).toBeNull();
    // E-mail confirmation is required: no session until the link is used.
    expect(data.session).toBeNull();
    const userId = data.user?.id;
    expect(userId).toEqual(expect.any(String));
    expect(await profileOf(userId ?? '')).toEqual({ display_name: 'Erika Muster', locale: 'de' });

    const message = await mailpit().nextMessage(address, new Set());
    expect(message.subject).toBe(SUBJECTS.confirmation);
    expect(confirmLink(message, 'email').pathname).toBe('/auth/confirm');
  });

  it('without a password (e-mail link) creates the user and the profile', async () => {
    const address = email('signup-link');
    const { error } = await publicClient().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, data: { display_name: 'Otto Link', locale: 'de' } },
    });

    expect(error).toBeNull();
    const user = await findUserByEmail(address);
    expect(user).toBeDefined();
    expect(user?.email_confirmed_at ?? null).toBeNull();
    expect(await profileOf(user?.id ?? '')).toEqual({ display_name: 'Otto Link', locale: 'de' });

    // A new user gets the confirmation template (not the magic-link one); its wording covers both.
    const message = await mailpit().nextMessage(address, new Set());
    expect(message.subject).toBe(SUBJECTS.confirmation);
    confirmLink(message, 'email');
  });

  it('refuses password sign-in until the e-mail address is confirmed', async () => {
    const address = email('unconfirmed');
    const password = newPassword();
    const client = publicClient();
    const signUp = await client.auth.signUp({
      email: address,
      password,
      options: { data: { display_name: 'Noch Nicht', locale: 'de' } },
    });
    expect(signUp.error).toBeNull();

    const { data, error } = await client.auth.signInWithPassword({ email: address, password });

    expect(data.session).toBeNull();
    expect(isAuthApiError(error)).toBe(true);
    expect(error?.code).toBe('email_not_confirmed');
  });
});

describe('sign-out', () => {
  it('global sign-out ends the sessions on other devices', async () => {
    const account = await createConfirmedUser('Gerda Global');
    emails.add(account.email);
    const thisDevice = await signedInClient(account);
    const otherDevice = await signedInClient(account);

    const { error } = await thisDevice.auth.signOut({ scope: 'global' });
    expect(error).toBeNull();

    const refreshed = await otherDevice.auth.refreshSession();
    expect(refreshed.data.session).toBeNull();
    expect(isAuthApiError(refreshed.error)).toBe(true);
    expect(['refresh_token_not_found', 'session_not_found']).toContain(refreshed.error?.code);
  });

  it('local sign-out keeps the sessions on other devices', async () => {
    const account = await createConfirmedUser('Lena Lokal');
    emails.add(account.email);
    const thisDevice = await signedInClient(account);
    const otherDevice = await signedInClient(account);

    const { error } = await thisDevice.auth.signOut({ scope: 'local' });
    expect(error).toBeNull();

    const refreshed = await otherDevice.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect(refreshed.data.session?.user.id).toBe(account.id);
  });
});
