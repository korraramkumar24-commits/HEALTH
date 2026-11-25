import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: mockUseAuth }));
vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));
import EmergencyContacts from './EmergencyContacts';
import LanguageProvider from '../context/LanguageProvider';
import { listForUser } from '../services/offlineOutbox';

const renderEmergencyContacts = () => render(
  <LanguageProvider>
    <MemoryRouter><EmergencyContacts /></MemoryRouter>
  </LanguageProvider>,
);

describe('EmergencyContacts', () => {
  let testUserId;

  beforeEach(() => {
    localStorage.clear();
    testUserId = `patient-${globalThis.crypto.randomUUID()}`;
    mockUseAuth.mockReturnValue({ user: { id: testUserId, role: 'patient' } });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('saves a contact locally and offers call and text actions', () => {
    renderEmergencyContacts();

    fireEvent.change(screen.getByLabelText('Contact name'), { target: { value: 'Rural Clinic' } });
    fireEvent.change(screen.getByLabelText('Relationship (optional)'), { target: { value: 'Clinic' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+1 (555) 123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a trusted contact' }));

    const contact = screen.getByRole('listitem');
    expect(within(contact).getByText('Rural Clinic')).toBeInTheDocument();
    expect(within(contact).getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+15551234567');
    expect(within(contact).getByRole('link', { name: 'Text' })).toHaveAttribute('href', 'sms:+15551234567');
    expect(JSON.parse(localStorage.getItem('carehub.emergencyContacts.v1'))).toMatchObject([
      { name: 'Rural Clinic', relationship: 'Clinic', phone: '+15551234567' },
    ]);
  });

  it('rejects invalid phone numbers and explains that calling still needs service', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    renderEmergencyContacts();

    fireEvent.change(screen.getByLabelText('Contact name'), { target: { value: 'Caregiver' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: 'call me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a trusted contact' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a phone number');
    expect(screen.getByText('Offline mode')).toBeInTheDocument();
    expect(screen.getByText(/Calls and text messages still need mobile service/)).toBeInTheDocument();
    expect(localStorage.getItem('carehub.emergencyContacts.v1')).toBeNull();
  });

  it('clears an active edit when all device contacts are reset', () => {
    renderEmergencyContacts();
    fireEvent.change(screen.getByLabelText('Contact name'), { target: { value: 'Caregiver' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+14155550123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a trusted contact' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: 'Clear contacts on this device' }));

    expect(screen.getByRole('heading', { name: 'No emergency contacts saved' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a trusted contact' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contact name')).toHaveValue('');
  });

  it('queues an SOS offline and clearly states that it has not been sent yet', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderEmergencyContacts();

    fireEvent.click(screen.getByRole('button', { name: 'Send emergency SOS' }));

    expect(await screen.findByText(/SOS saved on this device; it has NOT been sent yet/)).toBeInTheDocument();
    expect(await listForUser(testUserId)).toMatchObject([
      { kind: 'emergency-sos', status: 'queued', payload: {} },
    ]);
  });
});
