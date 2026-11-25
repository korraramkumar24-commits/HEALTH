import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useLanguage from '../hooks/useLanguage';
import api from '../services/api';
import {
  enqueue,
  listForUser,
  OUTBOX_UPDATED_EVENT,
  sendOutboxItem,
  syncForUser,
} from '../services/offlineOutbox';

const STORAGE_KEY = 'carehub.emergencyContacts.v1';
const MAX_CONTACTS = 10;

const emptyForm = { name: '', relationship: '', phone: '' };

const readInitialContacts = () => {
  try {
    return { contacts: readContacts(), error: '' };
  } catch {
    return {
      contacts: [],
      error: 'Saved contacts could not be read. Reset this device’s saved contacts to continue.',
    };
  }
};

const readContacts = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed) || parsed.length > MAX_CONTACTS) {
    throw new Error('Saved contact data is not valid.');
  }

  return parsed.map((contact) => {
    if (
      !contact
      || typeof contact.id !== 'string'
      || typeof contact.name !== 'string'
      || typeof contact.phone !== 'string'
      || !/^\+?\d{7,15}$/.test(contact.phone)
    ) {
      throw new Error('Saved contact data is not valid.');
    }
    return {
      id: contact.id,
      name: contact.name.slice(0, 80),
      relationship: typeof contact.relationship === 'string' ? contact.relationship.slice(0, 60) : '',
      phone: contact.phone,
    };
  });
};

const makeId = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const EmergencyContacts = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.id || user?._id;
  const [initialContacts] = useState(readInitialContacts);
  const [contacts, setContacts] = useState(initialContacts.contacts);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [formError, setFormError] = useState('');
  const [storageError, setStorageError] = useState(initialContacts.error);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [shareLocation, setShareLocation] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [sosError, setSosError] = useState('');
  const [queuedSOS, setQueuedSOS] = useState(0);
  const [radiusKm, setRadiusKm] = useState(25);
  const [nearbyWorkers, setNearbyWorkers] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [offlineSupport, setOfflineSupport] = useState(() => {
    if (!import.meta.env.PROD) return 'session';
    return 'serviceWorker' in navigator ? 'checking' : 'unavailable';
  });

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    const markOfflineReady = () => setOfflineSupport('ready');
    const markOfflineUnavailable = () => setOfflineSupport('unavailable');
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('carehub:offline-shell-ready', markOfflineReady);
    window.addEventListener('carehub:offline-shell-error', markOfflineUnavailable);
    const refreshQueuedSOS = async () => {
      if (!userId || user?.role !== 'patient') return;
      try {
        const items = await listForUser(userId);
        setQueuedSOS(items.filter((item) => item.kind === 'emergency-sos').length);
      } catch {
        setSosError('Unable to check saved emergency requests on this device.');
      }
    };
    const syncOutbox = async () => {
      if (!userId || user?.role !== 'patient' || !navigator.onLine) return;
      try {
        const result = await syncForUser(userId, sendOutboxItem);
        await refreshQueuedSOS();
        const sentSOS = result.results.find((item) => item.kind === 'emergency-sos');
        if (sentSOS) {
          setSosMessage(sentSOS.data?.notifiedDoctor
            ? t('emergency.synced')
            : t('emergency.noDoctor'));
        }
      } catch {
        setSosError('Saved items could not be synchronized. They remain on this device.');
      }
    };
    const syncWhenOnline = () => { void syncOutbox(); };
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => markOfflineReady())
        .catch(() => markOfflineUnavailable());
    }
    void refreshQueuedSOS();
    if (navigator.onLine) void syncOutbox();
    window.addEventListener('online', syncWhenOnline);
    window.addEventListener(OUTBOX_UPDATED_EVENT, refreshQueuedSOS);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('carehub:offline-shell-ready', markOfflineReady);
      window.removeEventListener('carehub:offline-shell-error', markOfflineUnavailable);
      window.removeEventListener('online', syncWhenOnline);
      window.removeEventListener(OUTBOX_UPDATED_EVENT, refreshQueuedSOS);
    };
  }, [t, user?.role, userId]);

  const saveContacts = (nextContacts) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextContacts));
      setContacts(nextContacts);
      setStorageError('');
      return true;
    } catch {
      setStorageError('Contacts could not be saved on this device. Check browser storage settings and try again.');
      return false;
    }
  };

  const submitContact = (event) => {
    event.preventDefault();
    setFormError('');

    const name = form.name.trim();
    const phone = form.phone.trim().replace(/[\s().-]/g, '');
    if (!name || name.length > 80) {
      setFormError('Enter a contact name up to 80 characters.');
      return;
    }
    if (!/^\+?\d{7,15}$/.test(phone)) {
      setFormError('Enter a phone number with 7–15 digits, optionally starting with +.');
      return;
    }

    const contact = {
      id: editingId || makeId(),
      name,
      relationship: form.relationship.trim().slice(0, 60),
      phone,
    };
    const nextContacts = editingId
      ? contacts.map((item) => (item.id === editingId ? contact : item))
      : [...contacts, contact];

    if (nextContacts.length > MAX_CONTACTS) {
      setFormError(`You can save up to ${MAX_CONTACTS} contacts on this device.`);
      return;
    }
    if (saveContacts(nextContacts)) {
      setForm(emptyForm);
      setEditingId('');
    }
  };

  const editContact = (contact) => {
    setEditingId(contact.id);
    setForm({ name: contact.name, relationship: contact.relationship, phone: contact.phone });
    setFormError('');
  };

  const deleteContact = (contact) => {
    if (!window.confirm(`Remove ${contact.name} from this device?`)) return;
    saveContacts(contacts.filter((item) => item.id !== contact.id));
    if (editingId === contact.id) {
      setEditingId('');
      setForm(emptyForm);
    }
  };

  const resetContacts = () => {
    if (!window.confirm('Clear all emergency contacts saved on this device?')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      setContacts([]);
      setEditingId('');
      setForm(emptyForm);
      setStorageError('');
      setFormError('');
    } catch {
      setStorageError('Saved contacts could not be cleared. Check browser storage settings and try again.');
    }
  };

  const captureLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        capturedAt: new Date(timestamp).toISOString(),
      }),
      () => reject(new Error('Location permission was unavailable or denied.')),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  });

  const findNearbyWorkers = async () => {
    setNearbyError('');
    setNearbyWorkers([]);
    if (user?.role !== 'patient') {
      setNearbyError(t('workers.signIn'));
      return;
    }
    if (!navigator.onLine) {
      setNearbyError(t('workers.onlineRequired'));
      return;
    }
    setNearbyLoading(true);
    try {
      const location = await captureLocation();
      const response = await api.get('/community-health-workers/nearby', {
        params: { latitude: location.latitude, longitude: location.longitude, radiusKm },
      });
      setNearbyWorkers(response.data.data.workers);
      if (response.data.data.workers.length === 0) setNearbyError(t('workers.none'));
    } catch (requestError) {
      setNearbyError(requestError.response?.data?.message || requestError.message || t('workers.failed'));
    } finally {
      setNearbyLoading(false);
    }
  };

  const sendEmergencySOS = async () => {
    setSosError('');
    setSosMessage('');
    if (user?.role !== 'patient' || !userId) {
      setSosError(t('emergency.signIn'));
      return;
    }
    if (!window.confirm(t('emergency.confirm'))) return;

    setSosBusy(true);
    const payload = {};
    let locationWarning = '';
    if (shareLocation) {
      try {
        payload.location = await captureLocation();
      } catch {
        locationWarning = ` ${t('emergency.locationUnavailable')}`;
      }
    }

    try {
      if (!navigator.onLine) {
        await enqueue({ userId, kind: 'emergency-sos', payload });
        setSosMessage(`${t('emergency.queued')}${locationWarning}`);
      } else {
        const response = await api.post('/alerts/sos', payload, {
          headers: { 'Idempotency-Key': makeId() },
        });
        const { notifiedDoctor } = response.data.data;
        setSosMessage(notifiedDoctor
          ? `${t('emergency.sent')}${locationWarning}`
          : `${t('emergency.noDoctor')}${locationWarning}`);
      }
      if (locationWarning) setShareLocation(false);
    } catch (requestError) {
      if (requestError.response === undefined || !navigator.onLine) {
        try {
          await enqueue({ userId, kind: 'emergency-sos', payload });
          setSosMessage(`${t('emergency.queued')}${locationWarning}`);
        } catch (queueError) {
          setSosError(queueError.message || 'The SOS could not be sent or safely saved offline. Use a saved phone contact.');
        }
      } else {
        setSosError(requestError.response.data?.message || 'The SOS could not be sent. Use a saved phone contact or local emergency number.');
      }
    } finally {
      setSosBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-8">
      <header className="mb-6">
        <Link to="/" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">← Back to app</Link>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-red-700">Emergency access</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{t('emergency.title')}</h1>
        <p className="mt-2 text-slate-700">{t('emergency.subtitle')}</p>
      </header>

      <section aria-live="polite" className={`mb-5 rounded-xl border p-4 ${isOnline ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-400 bg-amber-50 text-amber-950'}`}>
        <p className="font-bold">{isOnline ? 'Internet connection detected' : 'Offline mode'}</p>
        <p className="mt-1 text-sm">
          {isOnline
            ? offlineSupport === 'ready'
              ? 'Offline app shell is ready. Contacts saved in this browser remain available offline.'
              : offlineSupport === 'session'
                ? 'This development session keeps contacts on-device, but refreshing offline requires the production app shell.'
                : offlineSupport === 'unavailable'
                  ? 'Offline app shell could not be prepared. Keep this page open or try again while online.'
                  : 'Preparing offline access. Stay online while the app shell is cached.'
            : t('emergency.offline')}
        </p>
      </section>

      <div role="note" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950">
        {t('emergency.safety')}
        Call or text buttons open your device’s phone or messaging app; you must place the call or send the message yourself.
        Do not rely on this feature as your only emergency plan.
      </div>

      {user?.role === 'patient' && (
        <section aria-labelledby="nearby-workers-heading" className="mb-7 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <h2 id="nearby-workers-heading" className="text-xl font-bold text-slate-950">{t('workers.title')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{t('workers.description')}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{t('workers.privacy')}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold text-slate-800">{t('workers.radius')}
              <input type="number" min="1" max="100" step="1" value={radiusKm} onChange={(event) => setRadiusKm(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="mt-1 block w-32 rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <button type="button" disabled={nearbyLoading || !navigator.onLine} onClick={findNearbyWorkers} className="rounded-xl bg-indigo-700 px-5 py-2.5 font-bold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60">
              {nearbyLoading ? t('workers.searching') : t('workers.find')}
            </button>
          </div>
          {nearbyError && <p role="alert" className="mt-3 text-sm font-semibold text-slate-800">{nearbyError}</p>}
          {nearbyWorkers.length > 0 && (
            <ul className="mt-4 space-y-3">
              {nearbyWorkers.map((worker) => (
                <li key={worker._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div>
                    <h3 className="font-bold text-slate-950">{worker.name}</h3>
                    <p className="text-sm text-slate-700">{worker.serviceArea} · {worker.distanceKm} km</p>
                    {worker.languages.length > 0 && <p className="text-sm text-slate-600">{worker.languages.join(', ')}</p>}
                    <p className="text-sm font-medium text-slate-800" dir="ltr">{worker.phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:${worker.phone.replace(/[\s().-]/g, '')}`} className="rounded-lg bg-indigo-700 px-4 py-2 font-bold text-white hover:bg-indigo-800">{t('emergency.call')}</a>
                    <a href={`sms:${worker.phone.replace(/[\s().-]/g, '')}`} className="rounded-lg border border-indigo-300 px-4 py-2 font-bold text-indigo-900 hover:bg-indigo-50">{t('emergency.text')}</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {user?.role === 'patient' && (
        <section aria-labelledby="sos-heading" className="mb-7 rounded-2xl border-2 border-red-300 bg-white p-5 shadow-sm sm:p-6">
          <h2 id="sos-heading" className="text-xl font-bold text-red-950">{t('emergency.sos')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{t('emergency.sosDescription')}</p>
          <label className="mt-4 flex items-start gap-3 text-sm text-slate-800">
            <input type="checkbox" checked={shareLocation} onChange={(event) => setShareLocation(event.target.checked)} className="mt-1 h-4 w-4" />
            <span>{t('emergency.locationConsent')}</span>
          </label>
          {sosError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-950">{sosError}</p>}
          {sosMessage && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-950">{sosMessage}</p>}
          {queuedSOS > 0 && <p role="status" className="mt-3 text-sm font-bold text-amber-950">{queuedSOS} emergency request(s) are queued on this device and have not yet been confirmed as delivered.</p>}
          <button type="button" onClick={sendEmergencySOS} disabled={sosBusy} className="mt-4 rounded-xl bg-red-800 px-6 py-3 font-bold text-white hover:bg-red-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-950 disabled:cursor-not-allowed disabled:opacity-60">
            {sosBusy ? t('emergency.saving') : t('emergency.send')}
          </button>
        </section>
      )}

      {storageError && (
        <div role="alert" className="mb-5 rounded-xl border border-red-300 bg-white p-4 text-sm text-red-900">
          <p>{storageError}</p>
          <button type="button" onClick={resetContacts} className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-semibold hover:bg-red-50">
            Reset contacts saved on this device
          </button>
        </div>
      )}

      <section className="mb-7 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h2 className="text-xl font-bold text-slate-950">{editingId ? t('emergency.edit') : t('emergency.add')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('emergency.privacy')}</p>
        <form onSubmit={submitContact} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-800">
            {t('emergency.name')}
            <input
              autoComplete="name"
              maxLength={80}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            {t('emergency.relationship')}
            <input
              maxLength={60}
              value={form.relationship}
              onChange={(event) => setForm((current) => ({ ...current, relationship: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            {t('emergency.phone')}
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={24}
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="+country code and number"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
              required
            />
          </label>
          {formError && <p role="alert" className="text-sm font-medium text-red-800">{formError}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={Boolean(storageError)} className="rounded-xl bg-red-700 px-5 py-2.5 font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60">
              {editingId ? t('emergency.save') : t('emergency.add')}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(''); setForm(emptyForm); setFormError(''); }} className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-800 hover:bg-slate-50">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section aria-labelledby="saved-contacts-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="saved-contacts-heading" className="text-xl font-bold text-slate-950">{t('emergency.saved')} ({contacts.length}/{MAX_CONTACTS})</h2>
          {contacts.length > 0 && (
            <button type="button" onClick={resetContacts} className="text-sm font-semibold text-red-800 underline hover:text-red-950">
              Clear contacts on this device
            </button>
          )}
        </div>
        {contacts.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <h3 className="font-bold text-slate-900">No emergency contacts saved</h3>
            <p className="mt-1 text-sm text-slate-600">Add someone you trust, such as a family member, caregiver, or local support person.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {contacts.map((contact) => (
              <li key={contact.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-bold text-slate-950">{contact.name}</h3>
                    {contact.relationship && <p className="text-sm text-slate-600">{contact.relationship}</p>}
                    <p className="mt-1 font-medium text-slate-800" dir="ltr">{contact.phone}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`tel:${contact.phone}`} className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800">{t('emergency.call')}</a>
                    <a href={`sms:${contact.phone}`} className="rounded-lg border border-indigo-300 px-4 py-2 font-bold text-indigo-900 hover:bg-indigo-50">{t('emergency.text')}</a>
                    <button type="button" onClick={() => editContact(contact)} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">Edit</button>
                    <button type="button" aria-label={`Remove ${contact.name}`} onClick={() => deleteContact(contact)} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-7 text-xs leading-5 text-slate-600">
        Privacy: contacts are stored in browser local storage on this device. Anyone who can use this browser profile may be able to view them.
        They are not encrypted, backed up, or synchronized to other devices. On a shared device, clear contacts when you are done.
      </p>
    </main>
  );
};

export default EmergencyContacts;
