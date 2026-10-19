import type { Session, User } from '@supabase/supabase-js';
import { createContext } from 'react';

/** Why the user is signed out: `sessionEnded` = not initiated by this tab (expired, other device). */
export type SignedOutReason = 'sessionEnded';
/** A global sign-out removed the local session, but other sessions may live until they expire. */
export type SignedOutNotice = 'globalSignOutIncomplete';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedIn'; session: Session; user: User }
  | { status: 'signedOut'; reason?: SignedOutReason; notice?: SignedOutNotice };

export interface AuthContextValue {
  state: AuthState;
  /**
   * Signs out on this device (`local`) or on all devices (`global`) and marks the resulting
   * SIGNED_OUT as self-initiated. Resolves with the error, if any; never rejects.
   */
  signOut: (scope: 'local' | 'global') => Promise<{ error: unknown }>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
