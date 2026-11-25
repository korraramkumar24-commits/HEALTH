import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: loginMock }),
}));

describe('Login form', () => {
  beforeEach(() => loginMock.mockReset());

  it('shows required and malformed email validation before submitting', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    await waitFor(() => expect(loginMock).not.toHaveBeenCalled());
  });
});
