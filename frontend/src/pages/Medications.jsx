import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from '../components/Chart';
import EmptyState from '../components/EmptyState';
import ErrorNotice from '../components/ErrorNotice';
import Loader from '../components/Loader';
import Table from '../components/Table';
import api from '../services/api';

const Medications = () => {
  const [medications, setMedications] = useState([]);
  const [logsByMedication, setLogsByMedication] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyLoading, setHistoryLoading] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    api.get('/medications')
      .then((response) => { if (mounted) setMedications(response.data.data.medications); })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load medications.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [refreshKey]);

  const retryMedications = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const loadHistory = async (medicationId) => {
    setHistoryLoading(medicationId);
    setError('');
    try {
      const response = await api.get(`/medications/${medicationId}/logs`);
      setLogsByMedication((current) => ({ ...current, [medicationId]: response.data.data.logs }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load dose history.');
    } finally {
      setHistoryLoading('');
    }
  };

  const allLogs = Object.values(logsByMedication).flat();
  const adherenceChart = medications.map((medication) => ({
    name: medication.name,
    adherence: medication.adherence30Days?.percentage,
  })).filter((item) => Number.isFinite(item.adherence));

  const logColumns = [
    { key: 'scheduledFor', label: 'Scheduled for', render: (log) => new Date(log.scheduledFor).toLocaleString() },
    { key: 'status', label: 'Status', render: (log) => <span className="font-semibold capitalize">{log.status}</span> },
    { key: 'loggedAt', label: 'Logged at', render: (log) => new Date(log.loggedAt).toLocaleString() },
  ];

  if (loading) return <Loader label="Loading medications..." />;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8">
      <header className="mb-7">
        <Link to="/patient/dashboard" className="text-sm font-semibold text-indigo-600">← Dashboard</Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Medications</h1>
        <p className="mt-1 text-slate-500">Plans and dose history entered by your care team.</p>
      </header>
      <ErrorNotice message={error} onRetry={retryMedications} />

      <section className="mb-6">
        <Chart
          title="Medication adherence · last 30 days"
          type="bar"
          xKey="name"
          data={adherenceChart}
          dataKey="adherence"
          unit="%"
          emptyMessage="Adherence is calculated after doses have been scheduled and logged."
        />
        <p className="mt-2 text-xs text-slate-500">Percentage is the number of logged taken doses divided by scheduled doses to date in the last 30 days. It is a recordkeeping summary, not treatment advice.</p>
      </section>

      <section className="space-y-4">
        {medications.length ? medications.map((medication) => (
          <article key={medication._id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{medication.name}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${medication.activeToday ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{medication.activeToday ? 'Active today' : medication.isActive ? 'Not active today' : 'Inactive'}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{medication.instructions}</p>
                <p className="mt-2 text-sm text-slate-500">Dose times: {medication.scheduledTimes.join(', ')}</p>
                <p className="mt-1 text-xs text-slate-500">Plan: {new Date(medication.startsAt).toLocaleDateString()} – {medication.endsAt ? new Date(medication.endsAt).toLocaleDateString() : 'ongoing'}</p>
                {medication.adherence30Days?.percentage != null && <p className="mt-2 text-sm font-semibold text-indigo-700">30-day record: {medication.adherence30Days.percentage}% ({medication.adherence30Days.takenDoses}/{medication.adherence30Days.scheduledDoses} doses taken)</p>}
              </div>
              <button type="button" disabled={historyLoading === medication._id} onClick={() => loadHistory(medication._id)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{historyLoading === medication._id ? 'Loading...' : logsByMedication[medication._id] ? 'Refresh history' : 'Load dose history'}</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {medication.todayDoses?.length ? medication.todayDoses.map((dose) => (
                <span key={dose.time} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{dose.time}: {dose.status}</span>
              )) : <span className="text-xs text-slate-500">No doses due today.</span>}
            </div>
            {logsByMedication[medication._id] && (
              <div className="mt-4">
                {logsByMedication[medication._id].length
                  ? <Table columns={logColumns} rows={logsByMedication[medication._id]} />
                  : <EmptyState title="No dose history" description="Logged doses will appear here." />}
              </div>
            )}
          </article>
        )) : <EmptyState title="No medication plans" description="Your care team can add medication instructions to your patient record." />}
      </section>
      {allLogs.length > 0 && <p className="mt-4 text-xs text-slate-500">Showing dose history loaded for {Object.keys(logsByMedication).length} medication plan(s).</p>}
      <p className="mt-5 text-xs text-slate-500">This app does not suggest medication, dosage, or changes to your care plan. Follow the instructions from your clinician.</p>
    </main>
  );
};

export default Medications;
