import { AuthApiError, AuthRetryableFetchError, type User } from '@supabase/supabase-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUrl, renderRoute } from '@/test/render-route';
import { emitAuthEvent, fakeSession, resetSupabaseMock, supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

const { auth } = supabaseMock;
const otpSession = {
  data: {
    currentLevel: 'aal1',
    nextLevel: 'aal1',
    currentAuthenticationMethods: [{ method: 'otp', timestamp: 1 }],
  },
  error: null,
};

/** Server timestamps of the user that POST /verify returns. */
const firstConfirmation = {
  confirmation_sent_at: '2026-10-19T10:00:00.000001Z',
  email_confirmed_at: '2026-10-19T10:05:00.000001Z',
  last_sign_in_at: '2026-10-19T10:05:00.020001Z',
};
const magicLinkSignIn = {
  confirmation_sent_at: '2026-10-19T10:00:00.000001Z',
  email_confirmed_at: '2026-10-19T10:05:00.000001Z',
  recovery_sent_at: '2026-10-19T10:05:20.000001Z',
  last_sign_in_at: '2026-10-19T10:05:30.000001Z',
};

/** The next verifyOtp call signs in a user with these timestamps. */
function verifiedAs(timestamps: Partial<User>) {
  auth.verifyOtp.mockImplementationOnce(({ type }: { type: string }) => {
    const session = fakeSession(timestamps);
    emitAuthEvent(type === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN', session);
    return Promise.resolve({ data: { user: session.user, session }, error: null });
  });
}

beforeEach(() => {
  resetSupabaseMock();
});

describe('AuthConfirmPage', () => {
  it('removes the token from the URL and waits for an explicit click', async () => {
    const { router } = renderRoute('/auth/confirm?token_hash=abc123&type=email');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Anmeldung bestätigen' }),
    ).toBeVisible();
    await waitFor(() => {
      expect(currentUrl(router)).toBe('/auth/confirm');
    });
    expect(router.state.historyAction).toBe('REPLACE');
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('goes home after a sign-in link of an already confirmed account', async () => {
    verifiedAs(magicLinkSignIn);
    const user = userEvent.setup();
    const { router } = renderRoute('/auth/confirm?token_hash=abc123&type=email');
    await user.click(await screen.findByRole('button', { name: 'Weiter' }));

    expect(await screen.findByRole('heading', { name: 'Hallo, Anna Muster!' })).toBeVisible();
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'email' });
    expect(currentUrl(router)).toBe('/');
  });

  it('offers the optional password step after the first confirmation', async () => {
    verifiedAs(firstConfirmation);
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(otpSession);
    const user = userEvent.setup();
    const { router } = renderRoute('/auth/confirm?token_hash=abc123&type=email');
    await user.click(await screen.findByRole('button', { name: 'Weiter' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Passwort festlegen' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Überspringen' })).toBeVisible();
    expect(currentUrl(router)).toBe('/reset-password');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('continues a recovery link to the new-password form', async () => {
    // A recovery link may confirm an account as well; it still leads to the reset form.
    verifiedAs(firstConfirmation);
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(otpSession);
    const user = userEvent.setup();
    const { router } = renderRoute('/auth/confirm?token_hash=abc123&type=recovery');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Passwort zurücksetzen' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(await screen.findByRole('heading', { name: 'Neues Passwort festlegen' })).toBeVisible();
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'recovery' });
    expect(currentUrl(router)).toBe('/reset-password');
  });

  it.each([
    '/auth/confirm',
    '/auth/confirm?type=email',
    '/auth/confirm?token_hash=abc123',
    '/auth/confirm?token_hash=abc123&type=signup',
    '/auth/confirm?token_hash=abc123&type=email_change',
  ])('shows the invalid-link state for %s', async (path) => {
    renderRoute(path);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Link ungültig oder abgelaufen' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Zur Anmeldung' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Passwort zurücksetzen' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('shows the invalid-link state for used or expired links', async () => {
    auth.verifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new AuthApiError('Email link is invalid or has expired', 403, 'otp_expired'),
    });
    const user = userEvent.setup();
    renderRoute('/auth/confirm?token_hash=used&type=email');
    await user.click(await screen.findByRole('button', { name: 'Weiter' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Link ungültig oder abgelaufen' }),
    ).toHaveFocus();
    expect(screen.queryByText('Email link is invalid or has expired')).not.toBeInTheDocument();
  });

  it('keeps the link usable after a network error', async () => {
    auth.verifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    });
    const user = userEvent.setup();
    renderRoute('/auth/confirm?token_hash=abc123&type=email');
    await user.click(await screen.findByRole('button', { name: 'Weiter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Keine Verbindung. Bitte prüfe deine Internetverbindung.',
    );
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByRole('heading', { name: 'Hallo, Anna Muster!' })).toBeVisible();
    expect(auth.verifyOtp).toHaveBeenCalledTimes(2);
  });

  it('signs out an existing session before verifying', async () => {
    resetSupabaseMock(fakeSession({ email: 'bernd@example.com' }));
    const user = userEvent.setup();
    renderRoute('/auth/confirm?token_hash=abc123&type=email');
    expect(
      await screen.findByText(
        'Du bist als bernd@example.com angemeldet. Wenn du fortfährst, wirst du abgemeldet.',
      ),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    await screen.findByRole('heading', { name: 'Hallo, Anna Muster!' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      auth.verifyOtp.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
