import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { vi, type Mock } from 'vitest';

/**
 * In-memory stand-in for the Supabase client, used via
 *   vi.mock('@/lib/supabase', async () => (await import('@/test/supabase-mock')).supabaseModule);
 * Auth methods resolve successfully by default and emit the same events as supabase-js.
 * Call resetSupabaseMock() in beforeEach; override single calls with mockResolvedValueOnce().
 */

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
export const TEST_EMAIL = 'anna@example.com';

export function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: TEST_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: TEST_EMAIL,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-10-19T00:00:00Z',
    ...overrides,
  };
}

export function fakeSession(userOverrides: Partial<User> = {}): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: fakeUser(userOverrides),
  };
}

const listeners = new Set<Listener>();
let storedSession: Session | null = null;
let profileRow: { display_name: string; locale: string } | null = {
  display_name: 'Anna Muster',
  locale: 'de',
};

/** Emits an auth event to all subscribers (like supabase-js after a state change). */
export function emitAuthEvent(event: AuthChangeEvent, session: Session | null): void {
  storedSession = session;
  for (const listener of [...listeners]) listener(event, session);
}

/** Sets the session "in storage" without emitting an event. */
export function setStoredSession(session: Session | null): void {
  storedSession = session;
}

export function setProfileRow(row: typeof profileRow): void {
  profileRow = row;
}

const ok = { error: null };

/**
 * Loosely typed async mock: tests may resolve any shape (errors, partial data) without casts.
 * The default implementation is restored by mockReset() in resetSupabaseMock().
 */
function asyncMock(implementation: (...args: never[]) => unknown) {
  return vi.fn<(...args: never[]) => Promise<unknown>>((...args) =>
    Promise.resolve(implementation(...args)),
  );
}

const auth = {
  getSession: asyncMock(() => ({ data: { session: storedSession }, error: null })),
  onAuthStateChange: vi.fn((callback: Listener) => {
    listeners.add(callback);
    // supabase-js emits INITIAL_SESSION asynchronously after subscribing.
    setTimeout(() => {
      if (listeners.has(callback)) callback('INITIAL_SESSION', storedSession);
    }, 0);
    return {
      data: {
        subscription: {
          id: 'test',
          callback,
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
    };
  }),
  signInWithPassword: asyncMock(() => {
    const session = fakeSession();
    emitAuthEvent('SIGNED_IN', session);
    return { data: { user: session.user, session, weakPassword: null }, ...ok };
  }),
  signUp: asyncMock(() => ({ data: { user: fakeUser(), session: null }, ...ok })),
  signInWithOtp: asyncMock(() => ({ data: { user: null, session: null }, ...ok })),
  resend: asyncMock(() => ({ data: { user: null, session: null }, ...ok })),
  resetPasswordForEmail: asyncMock(() => ({ data: {}, ...ok })),
  verifyOtp: asyncMock(({ type }: { type: string }) => {
    const session = fakeSession();
    emitAuthEvent(type === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN', session);
    return { data: { user: session.user, session }, ...ok };
  }),
  updateUser: asyncMock(() => ({ data: { user: fakeUser() }, ...ok })),
  signOut: asyncMock(({ scope }: { scope?: string } = {}) => {
    if (scope !== 'others') emitAuthEvent('SIGNED_OUT', null);
    return ok;
  }),
  mfa: {
    getAuthenticatorAssuranceLevel: asyncMock(() => ({
      data: {
        currentLevel: 'aal1',
        nextLevel: 'aal1',
        currentAuthenticationMethods: [{ method: 'password', timestamp: 0 }],
      },
      error: null,
    })),
  },
};

interface ProfileQuery {
  select: () => ProfileQuery;
  eq: () => ProfileQuery;
  maybeSingle: () => Promise<unknown>;
}

const profileQuery: ProfileQuery = {
  select: vi.fn(() => profileQuery),
  eq: vi.fn(() => profileQuery),
  maybeSingle: asyncMock(() => ({ data: profileRow, error: null })),
};

const client = {
  auth,
  from: vi.fn<(table: string) => unknown>(() => profileQuery),
};

export const supabaseMock = client;

/** Module shape of '@/lib/supabase' for vi.mock. */
export const supabaseModule = { getSupabase: () => client };

const allMocks: Mock[] = [
  auth.getSession,
  auth.onAuthStateChange,
  auth.signInWithPassword,
  auth.signUp,
  auth.signInWithOtp,
  auth.resend,
  auth.resetPasswordForEmail,
  auth.verifyOtp,
  auth.updateUser,
  auth.signOut,
  auth.mfa.getAuthenticatorAssuranceLevel,
  vi.mocked(profileQuery.select),
  vi.mocked(profileQuery.eq),
  vi.mocked(profileQuery.maybeSingle),
  client.from,
];

/** Back to defaults: given stored session, default profile, no call history or queued results. */
export function resetSupabaseMock(session: Session | null = null): void {
  for (const mock of allMocks) mock.mockReset();
  listeners.clear();
  storedSession = session;
  profileRow = { display_name: 'Anna Muster', locale: 'de' };
}
