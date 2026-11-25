import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from '../components/Chart';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import Loader from '../components/Loader';
import SeverityBadge from '../components/SeverityBadge';
import Table from '../components/Table';
import api from '../services/api';
import useLanguage from '../hooks/useLanguage';

const MEASUREMENTS = [
  { label: 'Blood sugar', key: 'bloodSugar', unit: 'mg/dL' },
  { label: 'Systolic', key: 'systolic', unit: 'mmHg' },
  { label: 'Diastolic', key: 'diastolic', unit: 'mmHg' },
  { label: 'Heart rate', key: 'heartRate', unit: 'bpm' },
  { label: 'Weight', key: 'weight', unit: 'kg' },
  { label: 'Oxygen level', key: 'oxygenLevel', unit: '%' },
];

const metricValue = (reading, key, unit) =>
  reading?.[key] == null ? '—' : `${reading[key]} ${unit}`;

const PatientDashboard = () => {
  const { t } = useLanguage();
  const [dashboard, setDashboard] = useState(null);
  const [measurement, setMeasurement] = useState('bloodSugar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doseErrors, setDoseErrors] = useState({});
  const [submittingDose, setSubmittingDose] = useState('');
  const [doseNotice, setDoseNotice] = useState('');

  const loadDashboard = async () => {
    try {
      const response = await api.get('/dashboard/patient');
      setDashboard(response.data.data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    api.get('/dashboard/patient')
      .then((response) => { if (mounted) setDashboard(response.data.data); })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load your dashboard.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const logDose = async (medicationId, dose, status) => {
    const key = `${medicationId}:${dose.time}`;
    setSubmittingDose(key);
    setDoseErrors((current) => ({ ...current, [key]: '' }));
    try {
      await api.post(`/medications/${medicationId}/log`, {
        status,
        scheduledFor: new Date(dose.scheduledFor).toISOString(),
      });
      setDoseNotice(`Dose marked as ${status}.`);
      await loadDashboard();
    } catch (requestError) {
      setDoseErrors((current) => ({
        ...current,
        [key]: requestError.response?.data?.message || 'Unable to log this dose.',
      }));
    } finally {
      setSubmittingDose('');
    }
  };

  if (loading) return <Loader label="Loading your dashboard..." />;

  const latest = dashboard?.latestReading;
  const measurementInfo = MEASUREMENTS.find((item) => item.key === measurement);
  const chartData = (dashboard?.readings7Days || [])
    .map((reading) => ({
      recordedAt: reading.recordedAt,
      [measurement]: reading[measurement] ?? null,
    }));
  const readings = dashboard?.recentReadings || [];
  const columns = [
    { key: 'recordedAt', label: 'Date and time', render: (record) => new Date(record.recordedAt).toLocaleString() },
    { key: 'bloodPressure', label: 'Blood pressure', render: (record) => record.systolic != null || record.diastolic != null ? `${record.systolic ?? '—'} / ${record.diastolic ?? '—'} mmHg` : '—' },
    { key: 'bloodSugar', label: 'Blood sugar', render: (record) => metricValue(record, 'bloodSugar', 'mg/dL') },
    { key: 'heartRate', label: 'Heart rate', render: (record) => metricValue(record, 'heartRate', 'bpm') },
    { key: 'weight', label: 'Weight', render: (record) => metricValue(record, 'weight', 'kg') },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8">
      <header className="patient-dashboard-heading mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">{t('dashboard.overview')}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{t('dashboard.patientTitle')}</h1>
          <p className="mt-1 text-slate-500">{t('dashboard.patientDescription')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/health" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">{t('health.add')}</Link>
          <Link to="/medications" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Medications</Link>
          <Link to="/appointments" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Appointments</Link>
          <Link to="/emergency" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-900 hover:bg-red-100">{t('nav.emergency')}</Link>
          <Link to="/patient/profile" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">My profile</Link>
        </div>
      </header>
      <Toast message={doseNotice} onDismiss={() => setDoseNotice('')} />
      {error && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); void loadDashboard(); }} className="font-semibold underline">Retry</button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t('dashboard.latestBP'), latest?.systolic != null || latest?.diastolic != null ? `${latest?.systolic ?? '—'} / ${latest?.diastolic ?? '—'} mmHg` : '—'],
          [t('health.measure.bloodSugar'), metricValue(latest, 'bloodSugar', 'mg/dL')],
          [t('health.measure.heartRate'), metricValue(latest, 'heartRate', 'bpm')],
          [t('health.measure.weight'), metricValue(latest, 'weight', 'kg')],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
            {latest && <p className="mt-1 text-xs text-slate-500">{new Date(latest.recordedAt).toLocaleDateString()}</p>}
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            Chart measurement
            <select value={measurement} onChange={(event) => setMeasurement(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
              {MEASUREMENTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <Chart
            title={`${measurementInfo.label} · last 7 days`}
            data={chartData}
            dataKey={measurement}
            unit={measurementInfo.unit}
            emptyMessage={`No ${measurementInfo.label.toLowerCase()} readings in the last 7 days.`}
          />
        </div>
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Next appointment</h2>
              <p className="mt-1 text-sm text-slate-500">Your next scheduled visit</p>
            </div>
            <Link to="/appointments" className="text-sm font-semibold text-indigo-600">All appointments</Link>
          </div>
          {dashboard?.nextAppointment ? (
            <div className="mt-4 rounded-xl bg-indigo-50 p-4">
              <p className="font-semibold text-slate-900">{new Date(dashboard.nextAppointment.startsAt).toLocaleString()}</p>
              <p className="mt-1 text-sm text-slate-600">Dr. {dashboard.nextAppointment.doctorId?.userId?.name || 'Assigned doctor'}</p>
              {dashboard.nextAppointment.reason && <p className="mt-2 text-sm text-slate-600">{dashboard.nextAppointment.reason}</p>}
            </div>
          ) : <EmptyState title="No upcoming appointment" description="Scheduled appointments will appear here." />}
          {dashboard?.latestRecommendation && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">Latest doctor recommendation</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{dashboard.latestRecommendation.content}</p>
              <Link to="/patient/profile" className="mt-2 inline-block text-sm font-semibold text-indigo-600">View recommendations</Link>
            </div>
          )}
        </section>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Today's medications</h2>
              <p className="mt-1 text-sm text-slate-500">Follow the instructions entered by your care team.</p>
            </div>
            <Link to="/medications" className="text-sm font-semibold text-indigo-600">History</Link>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard?.medications?.length ? dashboard.medications.flatMap((medication) => (
              medication.todayDoses.map((dose) => {
                const key = `${medication._id}:${dose.time}`;
                return (
                  <article key={key} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{medication.name} · {dose.time}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{medication.instructions}</p>
                        <p className="mt-1 text-xs capitalize text-slate-500">Status: {dose.status}</p>
                      </div>
                      {dose.status === 'pending' ? (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={submittingDose === key} onClick={() => logDose(medication._id, dose, 'taken')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60">Taken</button>
                          <button type="button" disabled={submittingDose === key} onClick={() => logDose(medication._id, dose, 'missed')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Missed</button>
                          <button type="button" disabled={submittingDose === key} onClick={() => logDose(medication._id, dose, 'skipped')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Skipped</button>
                        </div>
                      ) : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{dose.status}</span>}
                    </div>
                    {doseErrors[key] && <p role="alert" className="mt-2 text-sm text-red-600">{doseErrors[key]}</p>}
                  </article>
                );
              })
            )) : <EmptyState title="No doses scheduled today" description="Active dose schedules from your care team will appear here." />}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent alerts</h2>
              <p className="mt-1 text-sm text-slate-500">{dashboard?.unreadAlertsCount || 0} unresolved</p>
            </div>
            <Link to="/alerts" className="text-sm font-semibold text-indigo-600">View alerts</Link>
          </div>
          {dashboard?.alerts?.length ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {dashboard.alerts.map((alert) => (
                <li key={alert._id} className="flex items-start gap-3 py-3">
                  <SeverityBadge severity={alert.severity} />
                  <div>
                    <p className="text-sm text-slate-800">{alert.message}</p>
                    <p className="mt-1 text-xs capitalize text-slate-500">{alert.status} · {new Date(alert.createdAt).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No alerts" description="If there are alerts, they will appear here for review." />}
          <p className="mt-3 text-xs text-slate-500">Demo alerts are not diagnoses or medical advice.</p>
        </section>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent measurements</h2>
            <p className="mt-1 text-sm text-slate-500">Latest health readings recorded on your account.</p>
          </div>
          <Link to="/health" className="text-sm font-semibold text-indigo-600">Full history →</Link>
        </div>
        {readings.length ? <Table columns={columns} rows={readings} /> : <EmptyState title="No readings yet" description="Add a reading to start your health history." />}
      </section>
      <p className="mt-5 text-center text-xs text-slate-500">Demo application — not for medical use. Health readings and demo alerts are not diagnoses.</p>
    </main>
  );
};

export default PatientDashboard;
