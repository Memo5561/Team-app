import { QueryClient } from '@tanstack/react-query';

/** Polling interval for live views (presence, notifications) instead of Realtime (decision E-35). */
export const POLL_INTERVAL_MS = 30_000;

/**
 * Shared TanStack Query defaults: short staleness plus refetch on window focus. Live views opt into
 * polling per query via `refetchInterval: POLL_INTERVAL_MS`. Query keys always start with the
 * organization id.
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
