import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/platform/auth';

interface AppProvidersProps {
  queryClient: QueryClient;
  children: ReactNode;
}

/** AuthProvider sits inside QueryClientProvider: it clears the query cache when the user changes. */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
