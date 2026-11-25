import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import LanguageProvider from '../context/LanguageProvider';

const { authState } = vi.hoisted(() => ({ authState: { user: null, loading: false } }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

const CurrentPath = () => <p>Current path: {useLocation().pathname}</p>;

const renderProtected = (user) => {
  authState.user = user;
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/private" element={<ProtectedRoute allowedRoles={['admin']}><p>Private content</p></ProtectedRoute>} />
          <Route path="/login" element={<CurrentPath />} />
          <Route path="/unauthorized" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
};

describe('ProtectedRoute', () => {
  it('redirects unauthenticated visitors to login', () => {
    renderProtected(null);
    expect(screen.getByText('Current path: /login')).toBeInTheDocument();
  });

  it('redirects authenticated users without the allowed role', () => {
    renderProtected({ _id: 'patient-1', role: 'patient' });
    expect(screen.getByText('Current path: /unauthorized')).toBeInTheDocument();
  });

  it('renders allowed users inside the application shell', () => {
    renderProtected({ _id: 'admin-1', name: 'Demo Admin', role: 'admin' });
    expect(screen.getByText('Private content')).toBeInTheDocument();
    expect(screen.getByText('Demo application - not for medical use')).toBeInTheDocument();
  });
});
