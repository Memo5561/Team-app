import type { RouteObject } from 'react-router';
import { RootLayout } from '@/app/layouts/root-layout';
import { HomePage } from '@/app/pages/home-page';
import { NotFoundPage } from '@/app/pages/not-found-page';
import { RouteErrorPage } from '@/app/pages/route-error-page';

/**
 * Route tree. Phase 1 adds /login, /signup, /onboarding/*, /invite/:token;
 * Phase 2 adds the organization scope /o/:orgSlug/* with module routes from the registry.
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
