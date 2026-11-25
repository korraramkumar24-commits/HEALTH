import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
import api from '../services/api';
import { AuthProvider, useAuth } from './AuthContext';

const CurrentUser = () => {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading session</p>;
  return <p>{user ? `${user.name}:${user.role}` : 'Signed out'}</p>;
};

describe('offline session restoration', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.clearAllMocks();
  });

  it('restores a validated cached patient profile when offline profile lookup fails', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    localStorage.setItem('token', 'cached-token');
    localStorage.setItem('user', JSON.stringify({
      id: 'patient-id',
      name: 'Offline Patient',
      email: 'patient@example.test',
      role: 'patient',
    }));
    api.get.mockRejectedValue(new Error('Network unavailable'));

    render(<AuthProvider><CurrentUser /></AuthProvider>);

    expect(await screen.findByText('Offline Patient:patient')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('cached-token');
  });

  it('does not restore malformed cached user data while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    localStorage.setItem('token', 'cached-token');
    localStorage.setItem('user', JSON.stringify({ id: 'patient-id', role: 'admin' }));
    api.get.mockRejectedValue(new Error('Network unavailable'));

    render(<AuthProvider><CurrentUser /></AuthProvider>);

    expect(await screen.findByText('Signed out')).toBeInTheDocument();
  });

  it('clears cached authentication when the profile request fails online', async () => {
    localStorage.setItem('token', 'cached-token');
    localStorage.setItem('user', JSON.stringify({
      id: 'patient-id',
      name: 'Offline Patient',
      role: 'patient',
    }));
    api.get.mockRejectedValue(new Error('Server rejected the session'));

    render(<AuthProvider><CurrentUser /></AuthProvider>);

    await waitFor(() => expect(screen.getByText('Signed out')).toBeInTheDocument());
    expect(localStorage.getItem('token')).toBeNull();
  });
});
