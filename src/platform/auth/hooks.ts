import { useQuery } from '@tanstack/react-query';
import { use } from 'react';
import { profileQueryOptions } from '@/platform/auth/api';
import { AuthContext, type AuthContextValue } from '@/platform/auth/auth-context';

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (context === null) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** The signed-in user's own profile; idle while signed out. */
export function useProfile() {
  const { state } = useAuth();
  const userId = state.status === 'signedIn' ? state.user.id : undefined;
  return useQuery({
    ...profileQueryOptions(userId ?? ''),
    enabled: userId !== undefined,
  });
}
