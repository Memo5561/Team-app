import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/render-route';

describe('app routes', () => {
  it('renders the home page with translated text', () => {
    renderRoute('/');
    expect(screen.getByRole('heading', { level: 1, name: 'TeamPanel' })).toBeInTheDocument();
    expect(screen.getByText('Dein Team-System entsteht gerade.')).toBeInTheDocument();
  });

  it('renders the 404 page for unknown routes and links back home', async () => {
    renderRoute('/gibt-es-nicht');
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Zur Startseite' }));
    expect(screen.getByRole('heading', { level: 1, name: 'TeamPanel' })).toBeInTheDocument();
  });
});
