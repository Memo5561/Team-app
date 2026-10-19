import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { inject } from 'vitest';
import type { LocalSupabase } from '../../../scripts/supabase-env.mjs';
import type { Database } from '../../../src/types/database';
import { Mailpit } from '../../support/mailpit';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Local stack from `supabase status` (vitest.integration.config.ts). */
    supabase: LocalSupabase;
  }
}

export type Client = SupabaseClient<Database>;

/** Every client is an isolated "device": no storage, no background refresh, no URL parsing. */
const AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

/** German subjects from supabase/config.toml ([auth.email.template.*]). */
export const SUBJECTS = {
  confirmation: 'Bestätige deine E-Mail-Adresse für TeamPanel',
  recovery: 'Neues Passwort für TeamPanel festlegen',
} as const;

// `.internal` is reserved for private use (ICANN, 2024) and is not on GoTrue's list of rejected
// test domains (.test, .example, .invalid, .local, .localhost, example.com, …). Mails only ever
// reach the local Mailpit.
const EMAIL_DOMAIN = 'integration.teampanel.internal';

export function stack(): LocalSupabase {
  return inject('supabase');
}

/** A client like the browser app uses it: publishable key, RLS applies. */
export function publicClient(): Client {
  const { apiUrl, publishableKey } = stack();
  return createClient<Database>(apiUrl, publishableKey, { auth: AUTH_OPTIONS });
}

/** Server-side client with the local secret key (bypasses RLS). Never used in app code. */
export function adminClient(): Client {
  const { apiUrl, secretKey } = stack();
  return createClient<Database>(apiUrl, secretKey, { auth: AUTH_OPTIONS });
}

export function mailpit(): Mailpit {
  return new Mailpit(stack().mailpitUrl);
}

/** Unique, lower-case address per call. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}@${EMAIL_DOMAIN}`;
}

/** A random password that satisfies the app's rules (≥ 10 characters, ≤ 72 bytes). */
export function newPassword(): string {
  return `Pw-${randomBytes(15).toString('base64url')}`;
}

export interface TestAccount {
  id: string;
  email: string;
  password: string;
}

/** Confirmed account created through the Admin API (no e-mail is sent). */
export async function createConfirmedUser(displayName: string): Promise<TestAccount> {
  const email = uniqueEmail('confirmed');
  const password = newPassword();
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, locale: 'de' },
  });
  if (error !== null) throw error;
  return { id: data.user.id, email, password };
}

/** Looks up an auth user by e-mail via the Admin API (the local test stack holds few users). */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error !== null) throw error;
  return data.users.find((user) => user.email === email);
}

/** Signs in on a fresh client ("device") with e-mail and password. */
export async function signedInClient(account: TestAccount): Promise<Client> {
  const client = publicClient();
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error !== null) throw error;
  return client;
}

/** Profile row of a user, read with the secret key (bypasses RLS); null if there is none. */
export async function profileOf(
  userId: string,
): Promise<{ display_name: string; locale: string } | null> {
  const { data, error } = await adminClient()
    .from('profiles')
    .select('display_name, locale')
    .eq('id', userId)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

/** Removes test users (their profiles cascade) and the mails sent to them. */
export async function cleanUp(emails: Iterable<string>): Promise<void> {
  const addresses = [...emails];
  const admin = adminClient();
  for (const email of addresses) {
    const user = await findUserByEmail(email);
    if (user !== undefined) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error !== null) throw error;
    }
  }
  await mailpit().deleteMessagesTo(addresses);
}
