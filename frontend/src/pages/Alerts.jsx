import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorNotice from '../components/ErrorNotice';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import SeverityBadge from '../components/SeverityBadge';
import Table from '../components/Table';
import Toast from '../components/Toast';
import api from '../services/api';

const Alerts = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [alertToDelete, setAlertToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (user?.role !== 'doctor') return undefined;
    let mounted = true;
    api.get('/patients', { params: { page: 1, limit: 50 } })
      .then((response) => { if (mounted) setPatients(response.data.data.patients); })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load assigned patients.');
      });
    return () => { mounted = false; };
  }, [user?.role, refreshKey]);

  useEffect(() => {
    let mounted = true;
    api.get('/alerts', { params: { severity, status, page, limit: 10 } })
      .then((response) => {
        if (!mounted) return;
        setAlerts(response.data.data.alerts);
        setTotalPages(response.data.data.totalPages);
        setError('');
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load alerts.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [severity, status, page, refreshKey]);

  const updateStatus = async (alert, nextStatus) => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await api.put(`/alerts/${alert._id}`, { status: nextStatus });
      setNotice(`Alert ${nextStatus}.`);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update alert.');
      setLoading(false);
    }
  };

  const createManualAlert = async ({ patientId, type, severity: selectedSeverity }) => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await api.post('/alerts', { patientId, type, severity: selectedSeverity });
      reset();
      setNotice('Manual alert created.');
      setPage(1);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setFormError('root', { message: requestError.response?.data?.message || 'Unable to create the alert.' });
      setLoading(false);
    }
  };

  const deleteSelectedAlert = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/alerts/${alertToDelete._id}`);
      setAlertToDelete(null);
      setNotice('Alert deleted.');
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete alert.');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'severity', label: 'Severity', render: (alert) => <SeverityBadge severity={alert.severity} /> },
    { key: 'type', label: 'Type', render: (alert) => <span className="capitalize">{alert.type === 'bloodSugar' ? 'Blood sugar' : alert.type}</span> },
    { key: 'patient', label: 'Patient', render: (alert) => alert.patientId?.userId?.name || 'Patient' },
    {
      key: 'message',
      label: 'Message',
      render: (alert) => (
        <div className="min-w-48">
          <p>{alert.message}</p>
          {alert.emergencyLocation && (
            <div className="mt-2 text-xs text-slate-700">
              <p>Patient-shared location: {alert.emergencyLocation.latitude.toFixed(5)}, {alert.emergencyLocation.longitude.toFixed(5)}</p>
              <p>Accuracy ±{Math.round(alert.emergencyLocation.accuracy)} m · captured {new Date(alert.emergencyLocation.capturedAt).toLocaleString()}</p>
              <a
                href={`https://www.openstreetmap.org/?mlat=${alert.emergencyLocation.latitude}&mlon=${alert.emergencyLocation.longitude}#map=16/${alert.emergencyLocation.latitude}/${alert.emergencyLocation.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-semibold text-indigo-800 underline"
              >
                Open map (shares coordinates with OpenStreetMap)
              </a>
            </div>
          )}
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (alert) => <span className="capitalize">{alert.status}</span> },
    { key: 'createdAt', label: 'Created', render: (alert) => new Date(alert.createdAt).toLocaleString() },
    {
      key: 'actions',
      label: 'Actions',
      render: (alert) => (
        <div className="flex flex-wrap items-center gap-3">
          {['doctor', 'admin'].includes(user?.role) && alert.status !== 'resolved' && (
            <button
              type="button"
              disabled={loading}
              onClick={() => updateStatus(alert, alert.status === 'unread' ? 'acknowledged' : 'resolved')}
              className="whitespace-nowrap font-semibold text-indigo-800 hover:text-indigo-950 disabled:opacity-60"
            >
              {alert.status === 'unread' ? 'Acknowledge' : 'Resolve'}
            </button>
          )}
          {user?.role === 'admin' && <button type="button" onClick={() => setAlertToDelete(alert)} className="whitespace-nowrap font-semibold text-red-800 hover:text-red-950">Delete</button>}
          {alert.status === 'resolved' && user?.role !== 'admin' ? '—' : null}
        </div>
      ),
    },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8">
      <header className="mb-7">
        <Link to={`/${user?.role}/dashboard`} className="text-sm font-semibold text-indigo-600">← Dashboard</Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Alerts</h1>
        <p className="mt-1 text-slate-500">{user?.role === 'patient' ? 'Alerts related to your readings. These are demo flags, not diagnoses.' : 'Review demo threshold alerts for patients assigned to your care.'}</p>
      </header>
      <ErrorNotice message={error} onRetry={() => { setLoading(true); setError(''); setRefreshKey((key) => key + 1); }} />
      <Toast message={notice} onDismiss={() => setNotice('')} />

      {user?.role === 'doctor' && (
        <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Create manual alert</h2>
          <p className="mt-1 text-sm text-slate-500">Creates neutral review wording for a patient assigned to you.</p>
          <form onSubmit={handleSubmit(createManualAlert)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
            <label className="text-sm font-medium text-slate-700">Patient
              <select defaultValue="" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('patientId', { required: 'Select a patient.' })}>
                <option value="" disabled>Select assigned patient</option>
                {patients.map((patient) => <option key={patient._id} value={patient._id}>{patient.userId?.name || patient._id}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Measurement
              <select defaultValue="manual" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('type', { required: true })}>
                <option value="manual">General review</option>
                <option value="systolic">Systolic</option>
                <option value="diastolic">Diastolic</option>
                <option value="bloodSugar">Blood sugar</option>
                <option value="heartRate">Heart rate</option>
                <option value="weight">Weight</option>
                <option value="oxygenLevel">Oxygen level</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Severity
              <select defaultValue="medium" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('severity', { required: true })}>
                {['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button disabled={isSubmitting || !patients.length} type="submit" className="self-end rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{isSubmitting ? 'Creating...' : 'Create alert'}</button>
          </form>
          {errors.patientId && <p role="alert" className="mt-2 text-sm text-red-600">{errors.patientId.message}</p>}
          {errors.root && <p role="alert" className="mt-2 text-sm text-red-600">{errors.root.message}</p>}
        </section>
      )}

      <section className="mb-4 flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <label className="text-sm font-medium text-slate-700">Severity
          <select value={severity} onChange={(event) => { setLoading(true); setSeverity(event.target.value); setPage(1); }} className="ml-2 rounded-lg border border-slate-300 px-3 py-2">
            <option value="">All</option>
            {['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Status
          <select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }} className="ml-2 rounded-lg border border-slate-300 px-3 py-2">
            <option value="">All</option>
            {['unread', 'acknowledged', 'resolved'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        {loading ? <Loader label="Loading alerts..." /> : alerts.length
          ? <Table columns={columns} rows={alerts} />
          : <EmptyState title="No alerts found" description="New alerts will appear here when readings match demo thresholds." />}
        {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => { setLoading(true); setPage(nextPage); }} />}
      </section>
      <p className="mt-4 text-xs text-slate-500">Demo thresholds are not clinically validated. Alerts are review prompts, not diagnoses or medical advice.</p>
      {alertToDelete && (
        <Modal title="Delete alert" onClose={() => !deleting && setAlertToDelete(null)}>
          <p className="text-slate-700">Delete this alert permanently? This action cannot be undone.</p>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-800">{error}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" disabled={deleting} onClick={() => setAlertToDelete(null)} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-60">Cancel</button>
            <button type="button" disabled={deleting} onClick={deleteSelectedAlert} className="rounded-xl bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60">{deleting ? 'Deleting...' : 'Delete alert'}</button>
          </div>
        </Modal>
      )}
    </main>
  );
};

export default Alerts;
