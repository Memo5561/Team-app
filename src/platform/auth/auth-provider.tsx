import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { signOut as apiSignOut, subscribeToAuthChanges } from '@/platform/auth/api';
import { AuthContext, type AuthContextValue, type AuthState } from '@/platform/auth/auth-context';

/**
 * Holds the auth state for the UI. Subscribes exactly once to supabase-js auth events; multi-tab
 * sync (BroadcastChannel) and token refresh are handled by supabase-js itself.
 *
 * The event callback stays synchronous on purpose: it only updates React state and clears the
 * query cache. Awaiting auth calls inside it can deadlock supabase-js.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const selfInitiatedSignOut = useRef(false);
  const currentUserId = useRef<string | null>(null);

  useEffect(
    () =>
      subscribeToAuthChanges((event, session) => {
        const userId = session?.user.id ?? null;
        // Never let cached data of one user leak into the next session.
        if (event === 'SIGNED_OUT' || userId !== currentUserId.current) queryClient.clear();
        currentUserId.current = userId;

        if (session !== null) {
          // SIGNED_IN, PASSWORD_RECOVERY, TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION
          setState({ status: 'signedIn', session, user: session.user });
          return;
        }
        if (event === 'SIGNED_OUT') {
          const selfInitiated = selfInitiatedSignOut.current;
          selfInitiatedSignOut.current = false;
          setState(
            selfInitiated
              ? { status: 'signedOut' }
              : { status: 'signedOut', reason: 'sessionEnded' },
          );
          return;
        }
        setState({ status: 'signedOut' });
      }),
    [queryClient],
  );

  const signOut = useCallback<AuthContextValue['signOut']>(async (scope) => {
    selfInitiatedSignOut.current = true;
    try {
      const { error } = await apiSignOut(scope);
      if (error !== null && error !== undefined && scope === 'global') {
        setState((current) =>
          current.status === 'signedOut'
            ? { ...current, notice: 'globalSignOutIncomplete' }
            : current,
        );
      }
      return { error };
    } finally {
      selfInitiatedSignOut.current = false;
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ state, signOut }), [state, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}
