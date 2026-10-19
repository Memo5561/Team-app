import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentSession,
  isEmailLinkSession,
  requestPasswordReset,
  resendConfirmation,
  sendMagicLink,
  signInWithPassword,
  signOut,
  signUp,
  verifyEmailLink,
} from '@/platform/auth/api';
import { fakeSession, resetSupabaseMock, supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

const { auth } = supabaseMock;
const apiError = (code: string, status = 400) => ({
  data: { user: null, session: null },
  error: new AuthApiError('English server message', status, code),
});

beforeEach(() => {
  resetSupabaseMock();
});

describe('signUp', () => {
  it('always creates the account via e-mail link with profile metadata, never with a password', async () => {
    await expect(signUp({ displayName: 'Anna Muster', email: 'anna@example.com' })).resolves.toBe(
      undefined,
    );
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'anna@example.com',
      options: { shouldCreateUser: true, data: { display_name: 'Anna Muster', locale: 'de' } },
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe('verifyEmailLink', () => {
  it('reports a first confirmation from the server timestamps', async () => {
    const session = fakeSession({
      confirmation_sent_at: '2026-10-19T10:00:00.000001Z',
      email_confirmed_at: '2026-10-19T10:05:00.000001Z',
      last_sign_in_at: '2026-10-19T10:05:00.020001Z',
    });
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: session.user, session }, error: null });
    await expect(verifyEmailLink('hash', 'email')).resolves.toEqual({ firstConfirmation: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash', type: 'email' });
  });

  it('reports later sign-ins as not first', async () => {
    const session = fakeSession({
      email_confirmed_at: '2026-10-01T08:00:00Z',
      recovery_sent_at: '2026-10-19T10:04:00Z',
      last_sign_in_at: '2026-10-19T10:05:00Z',
    });
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: session.user, session }, error: null });
    await expect(verifyEmailLink('hash', 'email')).resolves.toEqual({ firstConfirmation: false });
  });

  it('throws auth errors', async () => {
    auth.verifyOtp.mockResolvedValueOnce(apiError('otp_expired', 403));
    await expect(verifyEmailLink('hash', 'email')).rejects.toMatchObject({ code: 'otp_expired' });
  });
});

describe('neutral outcomes (no account enumeration)', () => {
  it.each(['user_already_exists', 'email_exists', 'otp_disabled', 'over_email_send_rate_limit'])(
    'treats %s like success for every e-mail request',
    async (code) => {
      auth.signInWithOtp.mockResolvedValue(apiError(code, 422));
      auth.resend.mockResolvedValueOnce(apiError(code, 422));
      auth.resetPasswordForEmail.mockResolvedValueOnce(apiError(code, 422));

      await expect(signUp({ displayName: 'A', email: 'a@b.at' })).resolves.toBeUndefined();
      await expect(sendMagicLink('a@b.at')).resolves.toBeUndefined();
      await expect(resendConfirmation('a@b.at')).resolves.toBeUndefined();
      await expect(requestPasswordReset('a@b.at')).resolves.toBeUndefined();
    },
  );

  it('still throws other errors', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce(apiError('over_request_rate_limit', 429));
    await expect(requestPasswordReset('a@b.at')).rejects.toMatchObject({
      code: 'over_request_rate_limit',
    });
  });

  it('sends magic links only to existing accounts and confirmation mails as type signup', async () => {
    await sendMagicLink('a@b.at');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.at',
      options: { shouldCreateUser: false },
    });
    await resendConfirmation('a@b.at');
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.at' });
    await requestPasswordReset('a@b.at');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.at');
  });
});

describe('signInWithPassword', () => {
  it('reports a weak password as a hint only', async () => {
    const session = fakeSession();
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: session.user,
        session,
        weakPassword: { reasons: ['pwned'], message: 'x' },
      },
      error: null,
    });
    await expect(signInWithPassword({ email: 'a@b.at', password: 'x' })).resolves.toEqual({
      weakPassword: true,
    });
  });

  it('throws auth errors', async () => {
    auth.signInWithPassword.mockResolvedValueOnce(apiError('invalid_credentials'));
    await expect(signInWithPassword({ email: 'a@b.at', password: 'x' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });
});

describe('getCurrentSession', () => {
  it('returns the stored session or null', async () => {
    await expect(getCurrentSession()).resolves.toBeNull();
    const session = fakeSession();
    resetSupabaseMock(session);
    await expect(getCurrentSession()).resolves.toBe(session);
  });

  it('treats a failed refresh as signed out, but rethrows network failures', async () => {
    auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: new AuthApiError('x', 400, 'refresh_token_not_found'),
    });
    await expect(getCurrentSession()).resolves.toBeNull();

    auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    });
    await expect(getCurrentSession()).rejects.toBeInstanceOf(AuthRetryableFetchError);
  });
});

describe('isEmailLinkSession', () => {
  const aal = (currentAuthenticationMethods: unknown[]) => ({
    data: { currentLevel: 'aal1', nextLevel: 'aal1', currentAuthenticationMethods },
    error: null,
  });

  it.each([
    [[{ method: 'otp', timestamp: 1 }]],
    [[{ method: 'recovery', timestamp: 1 }]],
    [[{ method: 'magiclink', timestamp: 1 }]],
    [['otp']],
  ])('accepts sessions from e-mail links (%j)', async (methods) => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce(aal(methods));
    await expect(isEmailLinkSession()).resolves.toBe(true);
  });

  it.each([
    [[{ method: 'password', timestamp: 1 }]],
    [['password']],
    [[{ method: 'email/signup', timestamp: 1 }]],
    [[{ method: 'oauth', timestamp: 1 }]],
    [[]],
  ])('rejects other sessions (%j)', async (methods) => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce(aal(methods));
    await expect(isEmailLinkSession()).resolves.toBe(false);
  });

  it('rejects when the check fails', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce({
      data: null,
      error: new AuthApiError('x', 401, 'bad_jwt'),
    });
    await expect(isEmailLinkSession()).resolves.toBe(false);
  });
});

describe('signOut', () => {
  it('never throws', async () => {
    auth.signOut.mockRejectedValueOnce(new Error('boom'));
    await expect(signOut('global')).resolves.toEqual({ error: new Error('boom') });
  });
});
