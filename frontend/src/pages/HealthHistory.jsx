import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import useLanguage from '../hooks/useLanguage';
import EmptyState from '../components/EmptyState';
import ErrorNotice from '../components/ErrorNotice';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import Table from '../components/Table';
import Toast from '../components/Toast';
import api from '../services/api';
import {
  enqueue,
  listForUser,
  OUTBOX_UPDATED_EVENT,
  removeItem,
  sendOutboxItem,
  syncForUser,
} from '../services/offlineOutbox';

const measurements = [
  { name: 'systolic', label: 'Systolic (mmHg)', min: 50, max: 250 },
  { name: 'diastolic', label: 'Diastolic (mmHg)', min: 30, max: 150 },
  { name: 'bloodSugar', label: 'Blood sugar (mg/dL)', min: 20, max: 800 },
  { name: 'heartRate', label: 'Heart rate (bpm)', min: 20, max: 250 },
  { name: 'weight', label: 'Weight (kg)', min: 1, max: 500 },
  { name: 'oxygenLevel', label: 'Oxygen level (%)', min: 50, max: 100 },
];

const asLocalDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : '—';

const isWithinEditWindow = (record, now) =>
  now - Date.parse(record.createdAt) <= 24 * 60 * 60 * 1000;

const HealthHistory = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.id || user?._id;
  const [resolvedPatientId, setResolvedPatientId] = useState(() => {
    if (!userId) return '';
    try {
      return localStorage.getItem(`carehub.patient-id.${userId}`) || '';
    } catch {
      return '';
    }
  });
  const patientId = id || resolvedPatientId;
  const [initialNow] = useState(() => new Date());
  const currentTime = initialNow.getTime();
  const currentDateTime = asLocalDateTime(initialNow);
  const today = initialNow.toISOString().slice(0, 10);
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [outbox, setOutbox] = useState([]);
  const [outboxError, setOutboxError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const {
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { recordedAt: asLocalDateTime() } });

  useEffect(() => {
    if (id) return;
    if (user?.role !== 'patient') return;

    let mounted = true;
    api.get('/patients/me')
      .then((response) => {
        if (mounted) setResolvedPatientId(response.data.data.patient._id);
        if (mounted && userId) {
          try {
            localStorage.setItem(`carehub.patient-id.${userId}`, response.data.data.patient._id);
          } catch {
            setOutboxError('This browser could not cache the patient profile ID for offline use.');
          }
        }
      })
      .catch((requestError) => {
        if (mounted) {
          setError(requestError.response?.data?.message || 'Unable to load your patient profile.');
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [id, user?.role, userId, refreshKey]);

  useEffect(() => {
    if (user?.role !== 'patient' || !userId) return undefined;
    let mounted = true;
    const refreshOutbox = async () => {
      try {
        const items = await listForUser(userId);
        if (mounted) {
          setOutbox(items);
          setOutboxError('');
        }
      } catch (queueError) {
        if (mounted) setOutboxError(queueError.message || 'Unable to read offline health records.');
      }
    };
    const flushOutbox = async () => {
      if (!navigator.onLine) return;
      setSyncing(true);
      try {
        await syncForUser(userId, sendOutboxItem);
        await refreshOutbox();
        setRefreshKey((key) => key + 1);
      } catch (queueError) {
        setOutboxError(queueError.message || 'Unable to synchronize saved offline items.');
      } finally {
        setSyncing(false);
      }
    };

    void refreshOutbox();
    if (navigator.onLine) void flushOutbox();
    window.addEventListener('online', flushOutbox);
    window.addEventListener(OUTBOX_UPDATED_EVENT, refreshOutbox);
    return () => {
      mounted = false;
      window.removeEventListener('online', flushOutbox);
      window.removeEventListener(OUTBOX_UPDATED_EVENT, refreshOutbox);
    };
  }, [user?.role, userId]);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  useEffect(() => {
    if (!patientId) return undefined;
    let mounted = true;
    const params = { page, limit: 10 };
    if (id || user?.role === 'admin') params.patientId = patientId;
    if (from) params.from = from;
    if (to) params.to = to;

    api.get('/health-records', { params })
      .then((response) => {
        if (!mounted) return;
        setRecords(response.data.data.records);
        setTotalPages(response.data.data.totalPages);
        setError('');
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load health history.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [patientId, from, to, page, id, user?.role, refreshKey]);

  const beginEdit = (record) => {
    setEditing(record);
    setToast('');
    reset({
      ...Object.fromEntries(measurements.map(({ name }) => [name, record[name] ?? ''])),
      recordedAt: asLocalDateTime(record.recordedAt),
      notes: record.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    reset({ recordedAt: asLocalDateTime(), notes: '' });
  };

  const retryHistory = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const submitReading = async (values) => {
    setToast('');
    const payload = Object.fromEntries(
      measurements
        .filter(({ name }) => Number.isFinite(values[name]))
        .map(({ name }) => [name, values[name]]),
    );
    if (!Object.keys(payload).length) {
      setFormError('root', { message: 'Enter at least one measurement.' });
      return;
    }

    payload.recordedAt = new Date(values.recordedAt).toISOString();
    payload.notes = values.notes || '';
    try {
      if (editing) {
        await api.put(`/health-records/${editing._id}`, payload);
        setToast('Reading updated successfully.');
      } else {
        await api.post('/health-records', payload);
        setToast('Reading added successfully.');
      }
      cancelEdit();
      setLoading(true);
      setPage(1);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      if (!editing && (requestError.response === undefined || !isOnline)) {
        try {
          await enqueue({ userId, kind: 'health-record', payload });
          setToast('Reading saved on this device. It will sync when a connection is available.');
          cancelEdit();
          return;
        } catch (queueError) {
          setFormError('root', { message: queueError.message || 'Unable to save this reading offline.' });
          return;
        }
      }
      const responseErrors = requestError.response?.data?.errors || {};
      for (const [field, message] of Object.entries(responseErrors)) {
        setFormError(field === 'measurements' ? 'root' : field, { message });
      }
      if (!Object.keys(responseErrors).length) {
        setFormError('root', {
          message: requestError.response?.data?.message || 'Unable to save this reading.',
        });
      }
    }
  };

  const deleteReading = async () => {
    if (!recordToDelete) return;
    setDeleting(true);
    setDeleteError('');
    setToast('');
    try {
      await api.delete(`/health-records/${recordToDelete._id}`);
      setRecordToDelete(null);
      setToast('Reading deleted successfully.');
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setDeleteError(requestError.response?.data?.message || 'Unable to delete this reading.');
    } finally {
      setDeleting(false);
    }
  };

  const removeFailedOfflineItem = async (itemId) => {
    try {
      await removeItem(itemId);
      setOutbox((items) => items.filter((item) => item.id !== itemId));
      setOutboxError('');
    } catch (queueError) {
      setOutboxError(queueError.message || 'Unable to remove this failed offline item.');
    }
  };

  const columns = [
    { key: 'recordedAt', label: 'Date and time', render: (record) => formatDate(record.recordedAt) },
    { key: 'bloodPressure', label: 'Blood pressure', render: (record) => record.systolic != null || record.diastolic != null ? `${record.systolic ?? '—'} / ${record.diastolic ?? '—'}` : '—' },
    { key: 'bloodSugar', label: 'Blood sugar', render: (record) => record.bloodSugar == null ? '—' : `${record.bloodSugar} mg/dL` },
    { key: 'heartRate', label: 'Heart rate', render: (record) => record.heartRate == null ? '—' : `${record.heartRate} bpm` },
    { key: 'weight', label: 'Weight', render: (record) => record.weight == null ? '—' : `${record.weight} kg` },
    { key: 'oxygenLevel', label: 'Oxygen', render: (record) => record.oxygenLevel == null ? '—' : `${record.oxygenLevel}%` },
    { key: 'notes', label: 'Notes', render: (record) => record.notes || '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (record) => {
        const canEdit = user?.role === 'patient' &&
          String(record.patientId) === String(patientId) &&
          isWithinEditWindow(record, currentTime);
        const canDelete = canEdit || user?.role === 'admin';
        if (!canEdit && !canDelete) return '—';
        return (
          <div className="flex gap-3">
            {canEdit && <button type="button" onClick={() => beginEdit(record)} className="font-semibold text-indigo-600">Edit</button>}
            {canDelete && <button type="button" onClick={() => { setDeleteError(''); setRecordToDelete(record); }} className="font-semibold text-red-800 hover:text-red-950">Delete</button>}
          </div>
        );
      },
    },
  ];

  const backLink = user?.role === 'patient'
    ? '/patient/dashboard'
    : user?.role === 'doctor'
      ? '/doctor/patients'
      : '/admin/dashboard';

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8">
      <header className="health-history-heading mb-7">
        <Link to={backLink} className="text-sm font-semibold text-indigo-600">← Back</Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">{t('health.title')}</h1>
        <p className="mt-1 text-slate-500">Health readings and measurements recorded over time.</p>
      </header>

      <ErrorNotice message={error} onRetry={retryHistory} />
      <Toast message={toast} onDismiss={() => setToast('')} />
      {user?.role === 'patient' && (
        <section aria-live="polite" className={`mb-6 rounded-2xl border p-4 ${isOnline ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-400 bg-amber-50 text-amber-950'}`}>
          <h2 className="font-bold">{isOnline ? t('health.onlineHeading') : t('health.offlineHeading')}</h2>
          <p className="mt-1 text-sm">{isOnline
            ? syncing ? t('health.syncing') : t('health.onlineDescription')
            : t('health.offlineDescription')}</p>
          {outboxError && <p role="alert" className="mt-2 text-sm font-semibold">{outboxError}</p>}
          {outbox.length > 0 && (
            <ul className="mt-3 space-y-2">
              {outbox.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm">
                  <span>
                    <strong>{item.kind === 'health-record' ? 'Health reading' : 'Emergency SOS'}</strong>
                    {' · '}
                    {item.status === 'failed' ? `Needs attention: ${item.error}` : item.status === 'syncing' ? 'Syncing…' : 'Waiting to sync'}
                    {' · '}
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                  {item.status === 'failed' && <button type="button" onClick={() => removeFailedOfflineItem(item.id)} className="font-semibold underline">Remove</button>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs">Offline readings are stored in this browser’s local database until synced. They are not encrypted or available on other devices.</p>
        </section>
      )}

      {user?.role === 'patient' && (
        <section className="mb-7 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">{editing ? t('health.edit') : t('health.add')}</h2>
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t('health.validationNote')}</p>
          <form onSubmit={handleSubmit(submitReading)} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {measurements.map(({ name, label, min, max }) => (
                <label key={name} className="text-sm font-medium text-slate-700">
                  {t(`health.measure.${name}`) || label}
                  <input
                    type="number"
                    step="any"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    aria-invalid={Boolean(errors[name])}
                    {...register(name, {
                      valueAsNumber: true,
                      validate: (value) => !Number.isFinite(value) || (value >= min && value <= max) || `Enter a value from ${min} to ${max}.`,
                    })}
                  />
                  {errors[name] && <span role="alert" className="mt-1 block text-sm text-red-600">{errors[name].message}</span>}
                </label>
              ))}
              <label className="text-sm font-medium text-slate-700">
                {t('health.dateTime')}
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  aria-invalid={Boolean(errors.recordedAt)}
                  {...register('recordedAt', {
                    required: 'Date and time are required.',
                    validate: (value) => value <= currentDateTime || 'Date and time cannot be in the future.',
                  })}
                />
                {errors.recordedAt && <span role="alert" className="mt-1 block text-sm text-red-600">{errors.recordedAt.message}</span>}
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
                {t('health.notes')}
                <textarea rows="3" maxLength="2000" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('notes')} />
                {errors.notes && <span role="alert" className="mt-1 block text-sm text-red-600">{errors.notes.message}</span>}
              </label>
            </div>
            {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}
            <div className="flex gap-3">
              <button disabled={isSubmitting || (user?.role !== 'patient' && !patientId)} type="submit" className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
                {isSubmitting ? t('health.saving') : editing ? t('health.saveChanges') : t('health.add')}
              </button>
              {editing && <button type="button" onClick={cancelEdit} className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700">Cancel</button>}
            </div>
          </form>
        </section>
      )}

      <section className="mb-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-slate-700">{t('health.from')}
          <input type="date" value={from} max={to || undefined} onChange={(event) => { setLoading(true); setFrom(event.target.value); setPage(1); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">{t('health.to')}
          <input type="date" value={to} min={from || undefined} max={today} onChange={(event) => { setLoading(true); setTo(event.target.value); setPage(1); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <button type="button" onClick={() => { setLoading(true); setFrom(''); setTo(''); setPage(1); }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Clear dates</button>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        {loading ? <Loader label="Loading health history..." /> : records.length
          ? <Table columns={columns} rows={records} />
          : <EmptyState title="No readings found" description="Readings for this date range will appear here." />}
        {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => { setLoading(true); setPage(nextPage); }} />}
      </section>
      {recordToDelete && (
        <Modal title="Delete health reading" onClose={() => !deleting && setRecordToDelete(null)}>
          <p className="text-slate-700">Delete the reading from <strong>{formatDate(recordToDelete.recordedAt)}</strong>? This cannot be undone.</p>
          {deleteError && <p role="alert" className="mt-3 text-sm font-medium text-red-900">{deleteError}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" disabled={deleting} onClick={() => setRecordToDelete(null)} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-60">Keep reading</button>
            <button type="button" disabled={deleting} onClick={deleteReading} className="rounded-xl bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60">{deleting ? 'Deleting...' : 'Delete reading'}</button>
          </div>
        </Modal>
      )}
    </main>
  );
};

export default HealthHistory;
