import { useEffect, useEffectEvent } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { LoadingScreen } from '@/app/layouts/loading-screen';
import { useAuth, type SignedOutReason } from '@/platform/auth';

/**
 * Wraps all protected routes. The `requireSession` middleware checks on navigation; this layout
 * handles the session ending while a page is open: signed out in another tab or on another device,
 * expired (→ /login with reason and way back), or signed out here (→ /login).
 */
export function ProtectedLayout() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectToLogin = useEffectEvent((reason: SignedOutReason | undefined) => {
    if (reason === 'sessionEnded') {
      const params = new URLSearchParams({
        reason: 'signedOut',
        next: `${location.pathname}${location.search}`,
      });
      void navigate(`/login?${params.toString()}`, { replace: true });
    } else {
      void navigate('/login', { replace: true });
    }
  });

  useEffect(() => {
    if (state.status === 'signedOut') redirectToLogin(state.reason);
  }, [state]);

  if (state.status !== 'signedIn') return <LoadingScreen />;
  return <Outlet />;
}
