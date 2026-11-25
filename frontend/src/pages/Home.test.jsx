import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Home from './Home';

describe('Home page', () => {
  it('introduces chronic care remote monitoring and offers sign-in and registration links', () => {
    render(<MemoryRouter><Home /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Chronic disease remote monitoring.' })).toBeInTheDocument();
    expect(screen.getByText(/Remote monitoring for chronic conditions/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /get started/i })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
