import { QueryClient } from '@tanstack/react-query';

/**
 * Shared TanStack Query defaults. V1 refreshes via polling and window focus instead of
 * Realtime subscriptions (decision E-35). Query keys always start with the organization id.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
