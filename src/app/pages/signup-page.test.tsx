import { AuthApiError } from '@supabase/supabase-js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '@/test/render-route';
import { resetSupabaseMock, supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

const { auth } = supabaseMock;
const NEUTRAL_TEXT =
  'Wir haben dir eine E-Mail an anna@example.com geschickt. Öffne den Link darin, um fortzufahren.';
const HINT =
  'Wir schicken dir einen Link zur Bestätigung. Danach kannst du ein Passwort festlegen oder dich weiter per E-Mail-Link anmelden.';

async function renderSignup() {
  const user = userEvent.setup();
  const view = renderRoute('/signup');
  await screen.findByRole('heading', { level: 1, name: 'Konto erstellen' });
  return { user, ...view };
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), '  Anna   Muster ');
  await user.type(screen.getByLabelText('E-Mail'), 'Anna@Example.com');
  await user.click(screen.getByRole('button', { name: 'Konto erstellen' }));
}

beforeEach(() => {
  resetSupabaseMock();
});

describe('SignupPage', () => {
  it('asks for name and e-mail only and explains the next steps', async () => {
    const { user } = await renderSignup();
    expect(screen.queryByLabelText(/Passwort/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Konto erstellen' })).toHaveAccessibleDescription(
      HINT,
    );

    await user.click(screen.getByRole('button', { name: 'Konto erstellen' }));
    expect(await screen.findByText('Bitte gib deinen Namen ein.')).toBeVisible();
    expect(screen.getByText('Bitte gib deine E-Mail-Adresse ein.')).toBeVisible();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('always creates the account via e-mail link, never with a password', async () => {
    const { user } = await renderSignup();
    await fillForm(user);
    expect(await screen.findByRole('heading', { name: 'Prüfe dein Postfach' })).toHaveFocus();
    expect(screen.getByText(NEUTRAL_TEXT)).toBeVisible();
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'anna@example.com',
      options: { shouldCreateUser: true, data: { display_name: 'Anna Muster', locale: 'de' } },
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('keeps name and e-mail when going back from the inbox view', async () => {
    const { user } = await renderSignup();
    await fillForm(user);
    await user.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Konto erstellen' })).toHaveFocus();
    expect(screen.getByLabelText('Name')).toHaveValue('Anna Muster');
    expect(screen.getByLabelText('E-Mail')).toHaveValue('anna@example.com');
  });

  it.each(['user_already_exists', 'email_exists', 'otp_disabled', 'over_email_send_rate_limit'])(
    'shows the identical neutral result for %s',
    async (code) => {
      auth.signInWithOtp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new AuthApiError('User already registered', 422, code),
      });
      const { user } = await renderSignup();
      await fillForm(user);
      await screen.findByRole('heading', { name: 'Prüfe dein Postfach' });
      expect(screen.getByText(NEUTRAL_TEXT)).toBeVisible();
      expect(
        screen.getByText('Keine E-Mail erhalten? Warte eine Minute und versuche es erneut.'),
      ).toBeVisible();
      expect(screen.queryByText('User already registered')).not.toBeInTheDocument();
    },
  );

  it('shows other server errors as German text', async () => {
    auth.signInWithOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new AuthApiError('Email address not authorized', 400, 'email_address_not_authorized'),
    });
    const { user } = await renderSignup();
    await fillForm(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An diese E-Mail-Adresse können wir gerade keine E-Mails senden. Bitte verwende eine andere.',
    );
    expect(screen.queryByRole('heading', { name: 'Prüfe dein Postfach' })).not.toBeInTheDocument();
  });
});
