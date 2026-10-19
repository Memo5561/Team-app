import { AuthApiError } from '@supabase/supabase-js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUrl, renderRoute } from '@/test/render-route';
import { fakeSession, resetSupabaseMock, supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

const { auth } = supabaseMock;
const aal = (method: string) => ({
  data: {
    currentLevel: 'aal1',
    nextLevel: 'aal1',
    currentAuthenticationMethods: [{ method, timestamp: 1 }],
  },
  error: null,
});

async function renderReset() {
  const user = userEvent.setup();
  const view = renderRoute('/reset-password');
  await screen.findByRole('heading', { level: 1, name: 'Neues Passwort festlegen' });
  return { user, ...view };
}

async function submitPasswords(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirm = password,
) {
  await user.type(screen.getByLabelText('Neues Passwort'), password);
  await user.type(screen.getByLabelText('Passwort wiederholen'), confirm);
  await user.click(screen.getByRole('button', { name: 'Passwort speichern' }));
}

beforeEach(() => {
  resetSupabaseMock(fakeSession());
  auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('otp'));
});

describe('ResetPasswordPage', () => {
  it('is only available for sessions from an e-mail link', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('password'));
    const { router } = renderRoute('/reset-password');
    expect(await screen.findByRole('heading', { name: 'Hallo, Anna Muster!' })).toBeVisible();
    expect(currentUrl(router)).toBe('/');
  });

  it('requires a session at all', async () => {
    resetSupabaseMock();
    const { router } = renderRoute('/reset-password');
    await screen.findByRole('heading', { level: 1, name: 'Anmelden' });
    expect(currentUrl(router)).toBe('/login?next=%2Freset-password');
  });

  it('validates length and repetition', async () => {
    const { user } = await renderReset();
    await submitPasswords(user, 'kurz');
    expect(
      await screen.findByText('Das Passwort muss mindestens 10 Zeichen lang sein.'),
    ).toBeVisible();

    await user.clear(screen.getByLabelText('Neues Passwort'));
    await user.clear(screen.getByLabelText('Passwort wiederholen'));
    await submitPasswords(user, 'neues Passwort 1', 'neues Passwort 2');
    expect(await screen.findByText('Die Passwörter stimmen nicht überein.')).toBeVisible();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('saves the password, signs out other devices and goes home', async () => {
    const { user, router } = await renderReset();
    await submitPasswords(user, 'neues Passwort 1');

    expect(
      await screen.findByText('Dein Passwort wurde geändert. Andere Geräte wurden abgemeldet.'),
    ).toBeVisible();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'neues Passwort 1' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(currentUrl(router)).toBe('/');
  });

  it('tells the user when other devices could not be signed out', async () => {
    auth.signOut.mockResolvedValueOnce({ error: new AuthApiError('x', 500, 'unexpected_failure') });
    const { user } = await renderReset();
    await submitPasswords(user, 'neues Passwort 1');
    expect(
      await screen.findByText(
        'Dein Passwort wurde geändert. Andere Geräte können noch bis zu einer Stunde angemeldet bleiben.',
      ),
    ).toBeVisible();
  });

  const newLinkText =
    'Aus Sicherheitsgründen brauchst du einen neuen Link. Fordere ihn über „Passwort vergessen“ an.';

  it.each([
    ['same_password', 'Das neue Passwort muss sich vom bisherigen unterscheiden.', false],
    ['weak_password', 'Dieses Passwort ist zu unsicher. Bitte wähle ein anderes.', false],
    ['reauthentication_needed', newLinkText, true],
    ['current_password_required', newLinkText, true],
  ])('maps %s', async (code, text, offersNewLink) => {
    auth.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: new AuthApiError('Raw message', 422, code),
    });
    const { user } = await renderReset();
    await submitPasswords(user, 'neues Passwort 1');
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(auth.signOut).not.toHaveBeenCalled();
    // "Passwort vergessen" is open to signed-in users, so the hint leads somewhere.
    expect(screen.queryAllByRole('link', { name: 'Neuen Link anfordern' })).toHaveLength(
      offersNewLink ? 1 : 0,
    );
  });
});

describe('ResetPasswordPage in setup mode (after the first confirmation)', () => {
  const setupEntry = { pathname: '/reset-password', state: { passwordSetup: true } };

  async function renderSetup() {
    const user = userEvent.setup();
    const view = renderRoute(setupEntry);
    await screen.findByRole('heading', { level: 1, name: 'Passwort festlegen' });
    return { user, ...view };
  }

  it('explains that the password is optional', async () => {
    await renderSetup();
    expect(
      screen.getByText(
        'Deine E-Mail-Adresse ist bestätigt. Wenn du dich auch mit Passwort anmelden möchtest, leg jetzt eines mit mindestens 10 Zeichen fest.',
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Das ist freiwillig: Du kannst dich weiter per E-Mail-Link anmelden und ein Passwort später über „Passwort vergessen“ festlegen.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Passwort speichern' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Abbrechen' })).not.toBeInTheDocument();
  });

  it('can be skipped without any request', async () => {
    const { user, router } = await renderSetup();
    await user.click(screen.getByRole('link', { name: 'Überspringen' }));

    expect(await screen.findByRole('heading', { name: 'Hallo, Anna Muster!' })).toBeVisible();
    expect(currentUrl(router)).toBe('/');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('saves the password with the same rules and goes home', async () => {
    const { user, router } = await renderSetup();
    await submitPasswords(user, 'kurz');
    expect(
      await screen.findByText('Das Passwort muss mindestens 10 Zeichen lang sein.'),
    ).toBeVisible();
    expect(auth.updateUser).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Neues Passwort'));
    await user.clear(screen.getByLabelText('Passwort wiederholen'));
    await submitPasswords(user, 'neues Passwort 1');
    expect(
      await screen.findByText(
        'Passwort festgelegt. Du kannst dich ab jetzt auch mit E-Mail-Adresse und Passwort anmelden.',
      ),
    ).toBeVisible();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'neues Passwort 1' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(currentUrl(router)).toBe('/');
  });

  it('does not open the gate: sessions without an e-mail link still go home', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('password'));
    const { router } = renderRoute(setupEntry);
    expect(await screen.findByRole('heading', { name: 'Hallo, Anna Muster!' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Passwort festlegen' })).not.toBeInTheDocument();
    expect(currentUrl(router)).toBe('/');
  });

  it.each([{ passwordSetup: 'true' }, { passwordSetup: 1 }, 'passwordSetup', null])(
    'ignores other history state (%j) and stays in reset mode',
    async (state) => {
      renderRoute({ pathname: '/reset-password', state });
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Neues Passwort festlegen' }),
      ).toBeVisible();
      expect(screen.queryByRole('link', { name: 'Überspringen' })).not.toBeInTheDocument();
    },
  );
});
