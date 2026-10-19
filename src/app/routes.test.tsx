import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUrl, renderRoute } from '@/test/render-route';
import { emitAuthEvent, fakeSession, resetSupabaseMock, supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

beforeEach(() => {
  resetSupabaseMock();
});

describe('app routes', () => {
  it('shows a loading screen while the initial session check runs', async () => {
    renderRoute('/login');
    expect(screen.getByRole('status')).toHaveTextContent('Wird geladen …');
    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  });

  it('renders the 404 page for unknown routes without checking the session', async () => {
    const { router } = renderRoute('/gibt-es-nicht');
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument();
    expect(supabaseMock.auth.getSession).not.toHaveBeenCalled();

    // Back to "/" without a session ends on the login page, which remembers the way back.
    await userEvent.click(screen.getByRole('link', { name: 'Zur Startseite' }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Anmelden' });
    expect(currentUrl(router)).toBe('/login?next=%2F');
    // Focus follows client-side navigation to the new page heading.
    expect(heading).toHaveFocus();
  });

  it('does not move focus on the initial load (StrictMode)', async () => {
    renderRoute('/login');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Anmelden' });
    expect(heading).not.toHaveFocus();
  });

  describe('protected routes', () => {
    it('redirect to /login with the full path as next', async () => {
      const { router } = renderRoute('/reset-password?x=1');
      await screen.findByRole('heading', { level: 1, name: 'Anmelden' });
      expect(currentUrl(router)).toBe('/login?next=%2Freset-password%3Fx%3D1');
    });

    it('render for signed-in users', async () => {
      resetSupabaseMock(fakeSession());
      renderRoute('/');
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hallo, Anna Muster!' }),
      ).toBeVisible();
    });

    it('send users to /login with a reason when the session ends elsewhere', async () => {
      resetSupabaseMock(fakeSession());
      const { router } = renderRoute('/');
      await screen.findByRole('heading', { level: 1, name: 'Hallo, Anna Muster!' });

      emitAuthEvent('SIGNED_OUT', null);

      await screen.findByRole('heading', { level: 1, name: 'Anmelden' });
      expect(currentUrl(router)).toBe('/login?reason=signedOut&next=%2F');
      expect(
        screen.getByText(
          'Deine Sitzung ist abgelaufen oder wurde beendet. Bitte melde dich erneut an.',
        ),
      ).toBeVisible();
    });
  });

  describe('guest-only routes', () => {
    it.each(['/login', '/signup'])(
      'send signed-in users from %s to the start page',
      async (path) => {
        resetSupabaseMock(fakeSession());
        const { router } = renderRoute(path);
        await screen.findByRole('heading', { level: 1, name: 'Hallo, Anna Muster!' });
        expect(currentUrl(router)).toBe('/');
      },
    );

    it('send signed-in users on to a safe next path', async () => {
      resetSupabaseMock(fakeSession());
      const { router } = renderRoute('/login?next=%2Fgibt-es-nicht%3Fa%3D1');
      await screen.findByRole('heading', { name: 'Seite nicht gefunden' });
      expect(currentUrl(router)).toBe('/gibt-es-nicht?a=1');
    });

    it('leave /forgot-password open to signed-in users (reset link for their own address)', async () => {
      resetSupabaseMock(fakeSession());
      const { router } = renderRoute('/forgot-password');
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Passwort vergessen' }),
      ).toBeVisible();
      expect(currentUrl(router)).toBe('/forgot-password');
      expect(await screen.findByRole('link', { name: 'Zurück zur Startseite' })).toHaveAttribute(
        'href',
        '/',
      );
    });

    it('ignore unsafe next values', async () => {
      resetSupabaseMock(fakeSession());
      const { router } = renderRoute('/login?next=%2F%2Fevil.example');
      await screen.findByRole('heading', { level: 1, name: 'Hallo, Anna Muster!' });
      expect(currentUrl(router)).toBe('/');
    });
  });

  it('shows a connection message when the session check fails for network reasons', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { AuthRetryableFetchError } = await import('@supabase/supabase-js');
    supabaseMock.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    });
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Keine Verbindung' })).toBeInTheDocument();
    expect(
      screen.getByText('Bitte prüfe deine Internetverbindung und lade die Seite dann neu.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Seite neu laden' })).toBeVisible();
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });
  });

  it('shows the generic error page when the auth server fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { AuthRetryableFetchError } = await import('@supabase/supabase-js');
    supabaseMock.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: new AuthRetryableFetchError('Service Unavailable', 503),
    });
    renderRoute('/');
    expect(
      await screen.findByRole('heading', { name: 'Etwas ist schiefgelaufen' }),
    ).toBeInTheDocument();
  });
});
