import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '@/test/render-route';
import { resetSupabaseMock, supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

const { auth } = supabaseMock;

async function renderForgot() {
  const user = userEvent.setup();
  renderRoute('/forgot-password');
  await screen.findByRole('heading', { level: 1, name: 'Passwort vergessen' });
  return user;
}

beforeEach(() => {
  resetSupabaseMock();
});

describe('ForgotPasswordPage', () => {
  it('requests a reset link and shows the neutral result', async () => {
    const user = await renderForgot();
    await user.type(screen.getByLabelText('E-Mail'), 'Anna@Example.com');
    await user.click(screen.getByRole('button', { name: 'Link senden' }));

    expect(await screen.findByRole('heading', { name: 'Prüfe dein Postfach' })).toHaveFocus();
    expect(
      screen.getByText(
        'Falls es ein Konto mit anna@example.com gibt, haben wir dir einen Link zum Zurücksetzen geschickt.',
      ),
    ).toBeVisible();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('anna@example.com');
  });

  it('validates the e-mail address', async () => {
    const user = await renderForgot();
    await user.type(screen.getByLabelText('E-Mail'), 'anna');
    await user.click(screen.getByRole('button', { name: 'Link senden' }));
    expect(await screen.findByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeVisible();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('shows rate limits as German text', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: new AuthApiError('Too many requests', 429, 'over_request_rate_limit'),
    });
    const user = await renderForgot();
    await user.type(screen.getByLabelText('E-Mail'), 'anna@example.com');
    await user.click(screen.getByRole('button', { name: 'Link senden' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Zu viele Versuche. Bitte warte kurz und versuche es dann erneut.',
    );
  });

  it('does not blame the connection when the server fails (e.g. mail delivery)', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: new AuthRetryableFetchError('Error sending recovery email', 500),
    });
    const user = await renderForgot();
    await user.type(screen.getByLabelText('E-Mail'), 'anna@example.com');
    await user.click(screen.getByRole('button', { name: 'Link senden' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Dienst ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.',
    );
  });

  it('keeps the e-mail address when going back from the inbox view', async () => {
    const user = await renderForgot();
    await user.type(screen.getByLabelText('E-Mail'), 'anna@example.com');
    await user.click(screen.getByRole('button', { name: 'Link senden' }));
    await user.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Passwort vergessen' }),
    ).toHaveFocus();
    expect(screen.getByLabelText('E-Mail')).toHaveValue('anna@example.com');
  });

  it('links back to the login', async () => {
    await renderForgot();
    expect(screen.getByRole('link', { name: 'Zurück zur Anmeldung' })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
