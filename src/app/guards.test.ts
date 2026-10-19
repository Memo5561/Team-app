import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireEmailLinkSession, requireGuest, requireSession } from '@/app/guards';
import { fakeSession, resetSupabaseMock, supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);

type Middleware = typeof requireSession;

/** Runs a middleware for a URL; resolves with the redirect location or null. */
async function run(middleware: Middleware, href: string): Promise<string | null> {
  const url = new URL(href, 'http://localhost');
  try {
    await middleware(
      {
        request: new Request(url),
        url,
        pattern: url.pathname,
        params: {},
        context: new RouterContextProvider(),
      },
      () => Promise.resolve(undefined),
    );
    return null;
  } catch (thrown) {
    if (thrown instanceof Response) return thrown.headers.get('Location');
    throw thrown;
  }
}

beforeEach(() => {
  resetSupabaseMock();
});

describe('requireSession', () => {
  it('lets signed-in users through', async () => {
    resetSupabaseMock(fakeSession());
    await expect(run(requireSession, '/')).resolves.toBeNull();
  });

  it('redirects guests to /login with path and query as next', async () => {
    await expect(run(requireSession, '/')).resolves.toBe('/login?next=%2F');
    await expect(run(requireSession, '/reset-password?a=1&b=2')).resolves.toBe(
      '/login?next=%2Freset-password%3Fa%3D1%26b%3D2',
    );
  });
});

describe('requireGuest', () => {
  it('lets guests through', async () => {
    await expect(run(requireGuest, '/login?next=%2Fx')).resolves.toBeNull();
  });

  it.each([
    ['/login', '/'],
    ['/login?next=%2Fo%2Fdemo%3Fa%3D1', '/o/demo?a=1'],
    ['/signup?next=%2F%2Fevil.com', '/'],
    ['/login?next=https%3A%2F%2Fevil.com', '/'],
    ['/login?next=%2Flogin', '/'],
    ['/signup?next=%2Fauth%2Fconfirm', '/'],
  ])('sends signed-in users from %s to %s', async (href, location) => {
    resetSupabaseMock(fakeSession());
    await expect(run(requireGuest, href)).resolves.toBe(location);
  });
});

describe('requireEmailLinkSession', () => {
  const amr = (method: string) => ({
    data: {
      currentLevel: 'aal1',
      nextLevel: 'aal1',
      currentAuthenticationMethods: [{ method, timestamp: 1 }],
    },
    error: null,
  });

  it('allows sessions from an e-mail link', async () => {
    supabaseMock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce(amr('otp'));
    await expect(run(requireEmailLinkSession, '/reset-password')).resolves.toBeNull();
  });

  it('sends password sessions home', async () => {
    supabaseMock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce(amr('password'));
    await expect(run(requireEmailLinkSession, '/reset-password')).resolves.toBe('/');
  });
});
