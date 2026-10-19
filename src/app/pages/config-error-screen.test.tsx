import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfigErrorScreen } from '@/app/pages/config-error-screen';

describe('ConfigErrorScreen', () => {
  it('lists every configuration issue', () => {
    render(<ConfigErrorScreen issues={['VITE_SUPABASE_URL is missing (see .env.example)']} />);
    expect(screen.getByRole('heading', { name: 'Konfigurationsfehler' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('VITE_SUPABASE_URL is missing');
  });
});
