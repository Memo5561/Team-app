import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/platform/auth/auth-provider';
import { useAuth } from '@/platform/auth/hooks';
import { emitAuthEvent, fakeSession, resetSupabaseMock, supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

function Probe() {
  const { state, signOut } = useAuth();
  return (
    <>
      <p data-testid="state">
        {state.status === 'signedIn'
          ? `signedIn:${state.user.email ?? ''}`
          : state.status === 'signedOut'
            ? `signedOut:${state.reason ?? '-'}:${state.notice ?? '-'}`
            : 'loading'}
      </p>
      <button type="button" onClick={() => void signOut('local')}>
        local
      </button>
      <button type="button" onClick={() => void signOut('global')}>
        global
      </button>
    </>
  );
}

function renderProvider() {
  const queryClient = new QueryClient();
  const clear = vi.spyOn(queryClient, 'clear');
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { clear };
}

const stateText = () => screen.getByTestId('state').textContent;

beforeEach(() => {
  resetSupabaseMock();
});

describe('AuthProvider', () => {
  it('starts loading and follows the initial session', async () => {
    resetSupabaseMock(fakeSession());
    renderProvider();
    expect(stateText()).toBe('loading');
    expect(await screen.findByText('signedIn:anna@example.com')).toBeInTheDocument();
    expect(supabaseMock.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('marks sign-outs not initiated here as ended sessions and clears the cache', async () => {
    resetSupabaseMock(fakeSession());
    const { clear } = renderProvider();
    await screen.findByText('signedIn:anna@example.com');
    clear.mockClear();

    act(() => {
      emitAuthEvent('SIGNED_OUT', null);
    });
    expect(stateText()).toBe('signedOut:sessionEnded:-');
    expect(clear).toHaveBeenCalled();
  });

  it('marks its own sign-out as self-initiated', async () => {
    resetSupabaseMock(fakeSession());
    renderProvider();
    await screen.findByText('signedIn:anna@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'local' }));
    expect(await screen.findByText('signedOut:-:-')).toBeInTheDocument();
    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('notes a global sign-out that failed on the server', async () => {
    resetSupabaseMock(fakeSession());
    supabaseMock.auth.signOut.mockImplementationOnce(() => {
      emitAuthEvent('SIGNED_OUT', null);
      return Promise.resolve({ error: new Error('network') });
    });
    renderProvider();
    await screen.findByText('signedIn:anna@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'global' }));
    expect(await screen.findByText('signedOut:-:globalSignOutIncomplete')).toBeInTheDocument();
  });

  it('clears cached data when another user signs in', async () => {
    resetSupabaseMock(fakeSession());
    const { clear } = renderProvider();
    await screen.findByText('signedIn:anna@example.com');
    clear.mockClear();

    act(() => {
      emitAuthEvent('TOKEN_REFRESHED', fakeSession());
    });
    expect(clear).not.toHaveBeenCalled();

    act(() => {
      emitAuthEvent(
        'SIGNED_IN',
        fakeSession({ id: '00000000-0000-4000-8000-000000000002', email: 'bernd@example.com' }),
      );
    });
    expect(stateText()).toBe('signedIn:bernd@example.com');
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('treats a recovery link session as signed in', async () => {
    renderProvider();
    await screen.findByText('signedOut:-:-');
    act(() => {
      emitAuthEvent('PASSWORD_RECOVERY', fakeSession());
    });
    expect(stateText()).toBe('signedIn:anna@example.com');
  });
});
