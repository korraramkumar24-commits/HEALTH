import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HealthHistory from './HealthHistory';
import api from '../services/api';
import LanguageProvider from '../context/LanguageProvider';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'patient-user-1', role: 'patient' } }),
}));
vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

describe('Add Reading form', () => {
  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path === '/patients/me') return Promise.resolve({ data: { data: { patient: { _id: 'patient-1' } } } });
      if (path === '/health-records') return Promise.resolve({ data: { data: { records: [], totalPages: 0 } } });
      return Promise.reject(new Error('Unexpected request'));
    });
  });

  it('displays a form error when no measurement is entered', async () => {
    render(<LanguageProvider><MemoryRouter><HealthHistory /></MemoryRouter></LanguageProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Reading' }));
    expect(await screen.findByText('Enter at least one measurement.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows inline range errors for out-of-range measurements', async () => {
    render(<LanguageProvider><MemoryRouter><HealthHistory /></MemoryRouter></LanguageProvider>);
    const systolicInput = await screen.findByLabelText('Systolic (mmHg)');
    fireEvent.change(systolicInput, { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Reading' }));
    expect(await screen.findByText('Enter a value from 50 to 250.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
