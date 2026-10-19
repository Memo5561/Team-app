import '@/styles/index.css';
import '@/i18n';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ConfigErrorScreen } from '@/app/pages/config-error-screen';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/routes';
import { getEnv } from '@/lib/env';
import { EnvError } from '@/lib/env-schema';
import { createQueryClient } from '@/lib/query-client';

function bootstrap(): ReactNode {
  try {
    getEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(error.message);
      return <ConfigErrorScreen issues={error.issues} />;
    }
    throw error;
  }

  const router = createBrowserRouter(routes);
  return (
    <AppProviders queryClient={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(<StrictMode>{bootstrap()}</StrictMode>);
