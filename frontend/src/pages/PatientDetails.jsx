import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Chart from '../components/Chart';
import ErrorNotice from '../components/ErrorNotice';
import Loader from '../components/Loader';
import RecommendationsPanel from '../components/RecommendationsPanel';
import MedicationPlanPanel from '../components/MedicationPlanPanel';
import SeverityBadge from '../components/SeverityBadge';
import api from '../services/api';

const METRIC_CARDS = [
  ['Systolic', 'systolic', ' mmHg'],
  ['Diastolic', 'diastolic', ' mmHg'],
  ['Blood sugar', 'bloodSugar', ' mg/dL'],
  ['Heart rate', 'heartRate', ' bpm'],
  ['Weight', 'weight', ' kg'],
  ['Oxygen level', 'oxygenLevel', '%'],
];

const PatientDetails = () => {
  const { id } = useParams();
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    api.get(`/patients/${id}/overview`, { params: { days } })
      .then((response) => {
        if (!mounted) return;
        setOverview(response.data.data);
        setError('');
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load patient overview.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id, days, refreshKey]);

  const retryOverview = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const latestReading = overview?.latestReading;
  const readings = overview?.readings || [];
  const profile = overview?.profile;
  const medicationData = Number.isFinite(overview?.medicationAdherence)
    ? [{ name: 'Medication adherence', adherence: overview.medicationAdherence }]
    : [];

  if (loading && !overview) return <Loader label="Loading patient overview..." />;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8">
      <header className="mb-6">
        <Link to="/doctor/dashboard" className="text-sm font-semibold text-indigo-600">← Doctor dashboard</Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">{profile?.userId?.name || 'Patient overview'}</h1>
        <p className="mt-1 text-slate-500">{profile?.userId?.email || ''} · Patient ID: {profile?._id || id}</p>
      </header>
      <ErrorNotice message={error} onRetry={retryOverview} className="mb-5" />
      {!profile ? null : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Patient profile</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{profile.status}</dd></div>
                <div><dt className="text-slate-500">Disease</dt><dd className="mt-1 font-semibold text-slate-800">{profile.disease?.name || '—'}</dd></div>
                <div><dt className="text-slate-500">Phone</dt><dd className="mt-1 font-semibold text-slate-800">{profile.userId?.phone || '—'}</dd></div>
                <div><dt className="text-slate-500">Assigned doctor</dt><dd className="mt-1 font-semibold text-slate-800">{profile.doctorId?.userId?.name || '—'}</dd></div>
              </dl>
              <Link to={`/patients/${id}/health`} className="mt-5 inline-block text-sm font-semibold text-indigo-600">Open full health history →</Link>
            </article>
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Latest reading</h2>
                  <p className="mt-1 text-sm text-slate-500">{latestReading ? new Date(latestReading.recordedAt).toLocaleString() : 'No health readings recorded'}</p>
                </div>
                <label className="text-sm font-medium text-slate-700">Chart range
                  <select value={days} onChange={(event) => { setLoading(true); setDays(Number(event.target.value)); }} className="ml-2 rounded-lg border border-slate-300 px-3 py-2">
                    {[7, 30, 90].map((range) => <option key={range} value={range}>{range} days</option>)}
                  </select>
                </label>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {METRIC_CARDS.map(([label, key, unit]) => (
                  <div key={key} className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1 text-lg font-bold text-slate-900">{latestReading?.[key] == null ? '—' : `${latestReading[key]}${unit}`}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </section>

          <section className="mt-6 grid gap-5 md:grid-cols-2">
            <Chart title={`Blood sugar · ${days} days`} data={readings} dataKey="bloodSugar" unit="mg/dL" loading={loading} />
            <Chart title={`Blood pressure · ${days} days`} data={readings} dataKeys={['systolic', 'diastolic']} unit="mmHg" loading={loading} />
            <Chart title={`Heart rate · ${days} days`} data={readings} dataKey="heartRate" unit="bpm" loading={loading} />
            <Chart title={`Weight · ${days} days`} data={readings} dataKey="weight" unit="kg" loading={loading} />
          </section>

          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">30-day summary</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 pr-4">Measure</th><th className="py-2 pr-4">Min / max</th><th className="py-2 pr-4">Average</th><th className="py-2">Trend</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {METRIC_CARDS.map(([label, key, unit]) => {
                      const metric = overview.summary30Days[key];
                      return <tr key={key}><td className="py-2 pr-4 font-medium text-slate-800">{label}</td><td className="py-2 pr-4">{metric.count ? `${metric.min} / ${metric.max}${unit}` : '—'}</td><td className="py-2 pr-4">{metric.average == null ? '—' : `${metric.average}${unit}`}</td><td className="py-2 capitalize">{metric.trend}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </article>
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <Chart
                title="Medication adherence"
                type="bar"
                xKey="name"
                data={medicationData}
                dataKey="adherence"
                unit="%"
                emptyMessage="Medication tracking and dose logs are not available yet, so adherence is not calculated."
              />
            </article>
          </section>

          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Unresolved alerts</h2>
            {overview.unresolvedAlerts.length ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {overview.unresolvedAlerts.map((alert) => (
                  <li key={alert._id} className="flex flex-wrap items-center gap-3 py-3">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-sm text-slate-800">{alert.message}</span>
                    <span className="ml-auto text-xs capitalize text-slate-500">{alert.status} · {new Date(alert.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-slate-500">No unresolved alerts.</p>}
          </section>

          <RecommendationsPanel patientId={id} />
          <MedicationPlanPanel patientId={id} />
          <p className="mt-4 text-xs text-slate-500">Charts and demo alert thresholds are for review support only, not diagnosis or treatment guidance. Missing measurements are shown as gaps.</p>
        </>
      )}
    </main>
  );
};

export default PatientDetails;
