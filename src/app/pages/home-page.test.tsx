import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUrl, renderRoute } from '@/test/render-route';
import {
  emitAuthEvent,
  fakeSession,
  resetSupabaseMock,
  setProfileRow,
  supabaseMock,
} from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

const { auth } = supabaseMock;

async function renderHome() {
  const user = userEvent.setup();
  const view = renderRoute('/');
  await screen.findByRole('heading', { level: 1, name: 'Hallo, Anna Muster!' });
  return { user, ...view };
}

beforeEach(() => {
  resetSupabaseMock(fakeSession());
});

describe('HomePage', () => {
  it('greets the user and shows the empty state', async () => {
    await renderHome();
    expect(screen.getByText('Angemeldet als anna@example.com')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Noch kein Unternehmen' })).toBeVisible();
    expect(supabaseMock.from).toHaveBeenCalledWith('profiles');
  });

  it('falls back to a plain greeting when the profile cannot be loaded', async () => {
    supabaseMock.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: null, error: { message: 'boom', code: 'XX000' } }),
        }),
      }),
    });
    const user = userEvent.setup();
    renderRoute('/');
    expect(await screen.findByText('Dein Profil konnte nicht geladen werden.')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Hallo!' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hallo, Anna Muster!' }),
    ).toBeVisible();
  });

  it('uses the plain greeting when there is no profile row', async () => {
    setProfileRow(null);
    renderRoute('/');
    expect(await screen.findByText('Angemeldet als anna@example.com')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Hallo!' })).toBeVisible();
  });

  it('signs out on this device and goes to the login', async () => {
    const { user, router } = await renderHome();
    await user.click(screen.getByRole('button', { name: 'Abmelden' }));

    await screen.findByRole('heading', { level: 1, name: 'Anmelden' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(currentUrl(router)).toBe('/login');
    expect(screen.queryByText(/Sitzung ist abgelaufen/)).not.toBeInTheDocument();
  });

  it('signs out everywhere', async () => {
    const { user, router } = await renderHome();
    await user.click(screen.getByRole('button', { name: 'Überall abmelden' }));
    await screen.findByRole('heading', { level: 1, name: 'Anmelden' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(currentUrl(router)).toBe('/login');
  });

  it('warns when signing out everywhere only worked on this device', async () => {
    auth.signOut.mockImplementationOnce(() => {
      emitAuthEvent('SIGNED_OUT', null);
      return Promise.resolve({ error: new AuthRetryableFetchError('Failed to fetch', 0) });
    });
    const { user } = await renderHome();
    await user.click(screen.getByRole('button', { name: 'Überall abmelden' }));
    expect(
      await screen.findByText(
        'Du bist auf diesem Gerät abgemeldet. Andere Geräte können noch bis zu einer Stunde angemeldet bleiben.',
      ),
    ).toBeVisible();
  });

  it('shows an error if the session could not be ended at all', async () => {
    auth.signOut.mockResolvedValueOnce({ error: new AuthApiError('x', 500, 'unexpected_failure') });
    const { user } = await renderHome();
    await user.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Hallo, Anna Muster!' })).toBeVisible();
  });
});
