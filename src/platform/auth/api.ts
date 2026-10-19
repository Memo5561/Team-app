import {
  isAuthRetryableFetchError,
  type AuthChangeEvent,
  type AuthError,
  type Session,
} from '@supabase/supabase-js';
import { queryOptions } from '@tanstack/react-query';
import { getAuthErrorCode } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { isFirstEmailConfirmation } from '@/platform/auth/first-confirmation';

/**
 * The only place that talks to `supabase.auth` (plus the own-profile query). Functions throw the
 * raw error; callers map it with getErrorMessageKey() and never show its message.
 *
 * No call passes emailRedirectTo/redirectTo: every e-mail template links to
 * {{ .SiteURL }}/auth/confirm?token_hash=…&type=…, which is verified there after an explicit click.
 */

/** Profile locale sent as sign-up metadata; the `profiles` trigger only accepts supported ones. */
const PROFILE_LOCALE = 'de';

/**
 * Outcomes that must look exactly like success: anything else would tell a visitor whether an
 * account exists for an address (or how many mails it got). The UI always shows the same neutral
 * "check your inbox" state with a "try again in a minute" hint.
 */
const NEUTRAL_ERROR_CODES = new Set([
  'user_already_exists',
  'email_exists',
  'otp_disabled',
  'over_email_send_rate_limit',
]);

function throwUnlessNeutral(error: AuthError | null): void {
  if (error === null) return;
  const code = getAuthErrorCode(error);
  if (code !== undefined && NEUTRAL_ERROR_CODES.has(code)) return;
  throw error;
}

/**
 * AMR methods of sessions that were created from an e-mail link. Mirrors GoTrue's
 * `AuthenticationMethod.IsRecovery()` (otp, magiclink, recovery): only those sessions may set a
 * new password without the current one. Verifying a token_hash (POST /verify) records `otp`.
 */
const EMAIL_LINK_AMR_METHODS = new Set(['otp', 'magiclink', 'recovery']);

export type EmailLinkType = 'email' | 'recovery';
export type SignOutScope = 'local' | 'global' | 'others';

/**
 * The current session from storage (refreshed if expired). A network failure while refreshing is
 * thrown, because the stored session is still valid; any other failure means "signed out".
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error !== null && isAuthRetryableFetchError(error)) throw error;
  return data.session;
}

/** Subscribes to auth events. The callback must stay synchronous (no awaits, no auth calls). */
export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data } = getSupabase().auth.onAuthStateChange(callback);
  return () => {
    data.subscription.unsubscribe();
  };
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<{ weakPassword: boolean }> {
  const { data, error } = await getSupabase().auth.signInWithPassword(input);
  if (error) throw error;
  return { weakPassword: Boolean(data.weakPassword) };
}

/**
 * Creates an account via e-mail link (E-46): never with a password, because a password chosen
 * before the address is confirmed may belong to someone else (pre-account takeover). The link in
 * the confirmation e-mail confirms the address and signs in; a password can be set right after.
 * For an existing address the server sends a new confirmation mail (unconfirmed account) or a
 * sign-in link (confirmed account); the caller always shows the same neutral "check your inbox".
 */
export async function signUp(input: { displayName: string; email: string }): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email: input.email,
    options: {
      shouldCreateUser: true,
      data: { display_name: input.displayName, locale: PROFILE_LOCALE },
    },
  });
  throwUnlessNeutral(error);
}

/** Sends a sign-in link to an existing account. */
export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  throwUnlessNeutral(error);
}

export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resend({ type: 'signup', email });
  throwUnlessNeutral(error);
}

/** Also works for accounts without a password: the link lets them set a first one. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email);
  throwUnlessNeutral(error);
}

/**
 * Verifies an e-mail link (token_hash) and establishes a session. `firstConfirmation` is true if
 * this link confirmed the account for the first time (see isFirstEmailConfirmation).
 */
export async function verifyEmailLink(
  tokenHash: string,
  type: EmailLinkType,
): Promise<{ firstConfirmation: boolean }> {
  const { data, error } = await getSupabase().auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) throw error;
  return { firstConfirmation: isFirstEmailConfirmation(data.user) };
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw error;
}

/** Signs out. Never throws: with `local`/`global` the local session is removed even on errors. */
export async function signOut(scope: SignOutScope): Promise<{ error: unknown }> {
  try {
    const { error } = await getSupabase().auth.signOut({ scope });
    return { error };
  } catch (error) {
    return { error };
  }
}

function amrMethod(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object' && entry !== null && 'method' in entry) {
    return typeof entry.method === 'string' ? entry.method : undefined;
  }
  return undefined;
}

/** True if the current session was established via an e-mail link (see EMAIL_LINK_AMR_METHODS). */
export async function isEmailLinkSession(): Promise<boolean> {
  const { data, error } = await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return false;
  const methods: readonly unknown[] = data.currentAuthenticationMethods;
  return methods.some((entry) => EMAIL_LINK_AMR_METHODS.has(amrMethod(entry) ?? ''));
}

export interface Profile {
  displayName: string;
  locale: string;
}

/** Own profile (RLS: only the own row is visible). Null if the row does not exist. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('display_name, locale')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data === null ? null : { displayName: data.display_name, locale: data.locale };
}

export function profileQueryOptions(userId: string) {
  return queryOptions({
    queryKey: ['auth', 'profile', userId] as const,
    queryFn: () => fetchProfile(userId),
  });
}
