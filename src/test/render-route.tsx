import { render, type RenderResult } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/routes';
import { createQueryClient } from '@/lib/query-client';

type TestRouter = ReturnType<typeof createMemoryRouter>;

/**
 * Renders the real route tree at the given URL (or history entry, e.g. with navigation state) with
 * all app providers (under StrictMode, like main.tsx). Tests that touch auth must mock
 * '@/lib/supabase' (see src/test/supabase-mock.ts).
 */
export function renderRoute(entry: InitialEntry): RenderResult & { router: TestRouter } {
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const result = render(
    <StrictMode>
      <AppProviders queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
  return Object.assign(result, { router });
}

/** Current path + search of a test router. */
export function currentUrl(router: TestRouter): string {
  const { pathname, search } = router.state.location;
  return `${pathname}${search}`;
}
