import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/routes';
import { createQueryClient } from '@/lib/query-client';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/render-route';

describe('app routes', () => {
  it('renders the home page with translated text', () => {
    renderRoute('/');
    expect(screen.getByRole('heading', { level: 1, name: 'TeamPanel' })).toBeInTheDocument();
    expect(screen.getByText('Dein Team-System entsteht gerade.')).toBeInTheDocument();
  });

  it('does not move focus on the initial load, also under StrictMode', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(
      <StrictMode>
        <AppProviders queryClient={createQueryClient()}>
          <RouterProvider router={router} />
        </AppProviders>
      </StrictMode>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'TeamPanel' })).not.toHaveFocus();
  });

  it('renders the 404 page for unknown routes and links back home', async () => {
    renderRoute('/gibt-es-nicht');
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Zur Startseite' }));
    const heading = screen.getByRole('heading', { level: 1, name: 'TeamPanel' });
    expect(heading).toBeInTheDocument();
    // Focus follows client-side navigation to the new page heading.
    expect(heading).toHaveFocus();
  });
});
