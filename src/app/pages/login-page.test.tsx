import { AuthApiError } from '@supabase/supabase-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUrl, renderRoute } from '@/test/render-route';
import { emitAuthEvent, fakeSession, resetSupabaseMock, supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

const { auth } = supabaseMock;
const authError = (code: string, status = 400) => ({
  data: { user: null, session: null },
  error: new AuthApiError('Raw English message', status, code),
});

async function renderLogin(path = '/login') {
  const user = userEvent.setup();
  const view = renderRoute(path);
  await screen.findByRole('heading', { level: 1, name: 'Anmelden' });
  return { user, ...view };
}

beforeEach(() => {
  resetSupabaseMock();
});

describe('LoginPage', () => {
  it('validates before sending anything and focuses the first invalid field', async () => {
    const { user } = await renderLogin();
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByText('Bitte gib deine E-Mail-Adresse ein.')).toBeVisible();
    expect(screen.getByText('Bitte gib dein Passwort ein.')).toBeVisible();
    expect(screen.getByLabelText('E-Mail')).toHaveFocus();
    expect(screen.getByLabelText('E-Mail')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in and continues to the safe next path', async () => {
    const { user, router } = await renderLogin('/login?next=%2Fgibt-es-nicht');
    await user.type(screen.getByLabelText('E-Mail'), ' Anna@Example.com ');
    await user.type(screen.getByLabelText('Passwort'), 'geheim-genug');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    await screen.findByRole('heading', { name: 'Seite nicht gefunden' });
    expect(currentUrl(router)).toBe('/gibt-es-nicht');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'anna@example.com',
      password: 'geheim-genug',
    });
  });

  it('shows a weak-password hint after signing in without blocking', async () => {
    const session = fakeSession();
    auth.signInWithPassword.mockImplementationOnce(() => {
      emitAuthEvent('SIGNED_IN', session);
      return Promise.resolve({
        data: { user: session.user, session, weakPassword: { reasons: ['pwned'], message: '' } },
        error: null,
      });
    });
    const { user, router } = await renderLogin();
    await user.type(screen.getByLabelText('E-Mail'), 'anna@example.com');
    await user.type(screen.getByLabelText('Passwort'), 'passwort123');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('heading', { name: 'Hallo, Anna Muster!' })).toBeVisible();
    const hint =
      'Dein Passwort gilt nicht mehr als sicher. Bitte ändere es bald. Dafür schicken wir dir einen Link per E-Mail.';
    expect(screen.getByText(hint)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Passwort ändern' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    // One-time: the notice leaves the history entry (no repeat on reload) but stays on screen.
    await waitFor(() => {
      expect(router.state.location.state).toBeNull();
    });
    expect(screen.getByText(hint)).toBeVisible();
  });

  it('shows mapped, focused errors and never the raw message', async () => {
    auth.signInWithPassword.mockResolvedValueOnce(authError('invalid_credentials'));
    const { user } = await renderLogin();
    await user.type(screen.getByLabelText('E-Mail'), 'anna@example.com');
    await user.type(screen.getByLabelText('Passwort'), 'falsch');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('E-Mail-Adresse oder Passwort ist falsch.');
    expect(alert).toHaveFocus();
    expect(screen.queryByText('Raw English message')).not.toBeInTheDocument();
  });

  it('offers to resend the confirmation e-mail for unconfirmed accounts', async () => {
    auth.signInWithPassword.mockResolvedValueOnce(authError('email_not_confirmed'));
    const { user } = await renderLogin();
    await user.type(screen.getByLabelText('E-Mail'), 'Anna@example.com');
    await user.type(screen.getByLabelText('Passwort'), 'passwort123');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    await user.click(
      await screen.findByRole('button', { name: 'Bestätigungs-E-Mail erneut senden' }),
    );

    expect(await screen.findByRole('heading', { name: 'Prüfe dein Postfach' })).toHaveFocus();
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'anna@example.com' });
    expect(
      screen.getByText(
        'Falls anna@example.com noch nicht bestätigt ist, haben wir dir eine neue Bestätigungs-E-Mail geschickt.',
      ),
    ).toBeVisible();
  });

  it.each([null, 'otp_disabled', 'over_email_send_rate_limit'])(
    'sends a sign-in link with the same neutral result (error: %s)',
    async (code) => {
      if (code !== null) auth.signInWithOtp.mockResolvedValueOnce(authError(code, 422));
      const { user } = await renderLogin();
      await user.type(screen.getByLabelText('E-Mail'), 'anna@example.com');
      await user.click(screen.getByRole('button', { name: 'Anmeldelink per E-Mail' }));

      expect(await screen.findByRole('heading', { name: 'Prüfe dein Postfach' })).toBeVisible();
      expect(
        screen.getByText(
          'Falls es ein Konto mit anna@example.com gibt, haben wir dir einen Anmeldelink geschickt.',
        ),
      ).toBeVisible();
      expect(
        screen.getByText('Keine E-Mail erhalten? Warte eine Minute und versuche es erneut.'),
      ).toBeVisible();
      expect(auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'anna@example.com',
        options: { shouldCreateUser: false },
      });
    },
  );

  it('needs only the e-mail address for a sign-in link', async () => {
    const { user } = await renderLogin();
    await user.click(screen.getByRole('button', { name: 'Anmeldelink per E-Mail' }));
    expect(await screen.findByText('Bitte gib deine E-Mail-Adresse ein.')).toBeVisible();
    expect(screen.queryByText('Bitte gib dein Passwort ein.')).not.toBeInTheDocument();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('returns from the inbox view to the form', async () => {
    const { user } = await renderLogin();
    await user.type(screen.getByLabelText('E-Mail'), 'anna@example.com');
    await user.click(screen.getByRole('button', { name: 'Anmeldelink per E-Mail' }));
    await user.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toHaveFocus();
    // "Versuche es erneut" must not mean typing the address again.
    expect(screen.getByLabelText('E-Mail')).toHaveValue('anna@example.com');
  });

  it('explains why the user has to sign in again', async () => {
    await renderLogin('/login?reason=signedOut&next=%2F');
    expect(
      screen.getByText(
        'Deine Sitzung ist abgelaufen oder wurde beendet. Bitte melde dich erneut an.',
      ),
    ).toBeVisible();
  });

  it('marks the submit button busy while signing in', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    auth.signInWithPassword.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { user } = await renderLogin();
    await user.type(screen.getByLabelText('E-Mail'), 'anna@example.com');
    await user.type(screen.getByLabelText('Passwort'), 'passwort123');
    const submit = screen.getByRole('button', { name: 'Anmelden' });
    await user.click(submit);
    await waitFor(() => {
      expect(submit).toHaveAttribute('aria-busy', 'true');
    });
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
    resolve(authError('invalid_credentials'));
    expect(await screen.findByRole('alert')).toBeVisible();
  });

  it('offers the sign-in link to accounts without a password', async () => {
    await renderLogin();
    expect(
      screen.getByText(
        'Kein Passwort festgelegt? Wir schicken dir einen Link, mit dem du dich ohne Passwort anmeldest.',
      ),
    ).toBeVisible();
  });

  it('links to sign-up and password reset', async () => {
    await renderLogin();
    expect(screen.getByRole('link', { name: 'Registrieren' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Passwort vergessen?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
