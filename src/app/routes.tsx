import type { RouteObject } from 'react-router';
import { requireEmailLinkSession, requireGuest, requireSession } from '@/app/guards';
import { AuthLayout } from '@/app/layouts/auth-layout';
import { LoadingScreen } from '@/app/layouts/loading-screen';
import { ProtectedLayout } from '@/app/layouts/protected-layout';
import { RootLayout } from '@/app/layouts/root-layout';
import { AuthConfirmPage } from '@/app/pages/auth-confirm-page';
import { ForgotPasswordPage } from '@/app/pages/forgot-password-page';
import { HomePage } from '@/app/pages/home-page';
import { LoginPage } from '@/app/pages/login-page';
import { NotFoundPage } from '@/app/pages/not-found-page';
import { ResetPasswordPage } from '@/app/pages/reset-password-page';
import { RouteErrorPage } from '@/app/pages/route-error-page';
import { SignupPage } from '@/app/pages/signup-page';

/**
 * Route tree. Middleware makes the root route "need load" on the first render, so the
 * HydrateFallback (loading screen) shows until the session check has finished.
 * Phase 2 adds the organization scope /o/:orgSlug/* with module routes from the registry.
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <LoadingScreen />,
    children: [
      {
        // Guest-only: signed-in users are sent on to `next` or "/".
        middleware: [requireGuest],
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignupPage /> },
        ],
      },
      {
        // Neutral: e-mail links work signed in or out, and signed-in users can request a reset
        // link (e.g. after the "weak password" hint).
        element: <AuthLayout />,
        children: [
          { path: 'auth/confirm', element: <AuthConfirmPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      {
        middleware: [requireSession],
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <HomePage /> },
          {
            element: <AuthLayout />,
            children: [
              {
                path: 'reset-password',
                middleware: [requireEmailLinkSession],
                element: <ResetPasswordPage />,
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
