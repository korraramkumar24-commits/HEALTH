import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard from './AdminDashboard';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Admin Example' } }),
}));

vi.mock('../services/api', () => ({
  default: { get: getMock },
}));

vi.mock('../components/Chart', () => ({
  default: ({ title }) => <section>{title}</section>,
}));

describe('AdminDashboard', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockImplementation((path) => {
      const responses = {
        '/dashboard/admin': {
          data: {
            data: {
              usersByRole: { patient: 12, doctor: 1, admin: 1 },
              alerts: {
                bySeverity: [{ severity: 'critical', count: 2 }],
                byStatus: [{ status: 'unread', count: 3 }, { status: 'resolved', count: 4 }],
              },
              patientsPerDoctor: [
                { doctorName: 'Dr Ada', patientCount: 9 },
                { doctorName: 'Unassigned', patientCount: 3 },
              ],
              readingsSubmittedPerDay: [],
            },
          },
        },
        '/doctors': {
          data: {
            data: {
              doctors: [{
                _id: 'doctor-1',
                specialization: 'Cardiology',
                userId: { name: 'Dr Ada Lovelace', email: 'ada@example.test', isActive: true },
              }],
            },
          },
        },
        '/appointments': { data: { data: { appointments: [{ _id: 'a1' }, { _id: 'a2' }] } } },
      };
      return Promise.resolve(responses[path]);
    });
  });

  it('shows the real admin overview totals and provider list', async () => {
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Welcome back, Admin' })).toBeInTheDocument();
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
    expect(screen.getByText('Dr Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Patient flow')).toBeInTheDocument();
    expect(screen.getByText('Alert overview')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(3);
  });
});
