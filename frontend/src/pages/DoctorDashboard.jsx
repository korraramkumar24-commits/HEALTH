import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from '../components/Chart';
import EmptyState from '../components/EmptyState';
import ErrorNotice from '../components/ErrorNotice';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import SeverityBadge from '../components/SeverityBadge';
import Table from '../components/Table';
import api from '../services/api';

const DoctorDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [diseases, setDiseases] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [disease, setDisease] = useState('');
  const [status, setStatus] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let mounted = true;
    api.get('/diseases')
      .then((response) => { if (mounted) setDiseases(response.data.data.diseases); })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load diseases.');
      });
    return () => { mounted = false; };
  }, [refreshKey]);

  useEffect(() => {
    let mounted = true;
    api.get('/dashboard/doctor', {
      params: { search, disease, status, alertSeverity, page, limit: 10 },
    })
      .then((response) => {
        if (!mounted) return;
        setDashboard(response.data.data);
        setError('');
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load doctor dashboard.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [search, disease, status, alertSeverity, page, refreshKey]);

  const retryDashboard = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const columns = [
    {
      key: 'patient',
      label: 'Patient',
      render: (patient) => (
        <Link to={`/doctor/patients/${patient._id}`} className="font-semibold text-indigo-700 hover:text-indigo-900">
          {patient.userId?.name || 'Patient'}
          <span className="block text-xs font-normal text-slate-500">{patient.userId?.email || ''}</span>
        </Link>
      ),
    },
    { key: 'disease', label: 'Disease', render: (patient) => patient.disease?.name || '—' },
    {
      key: 'latestReading',
      label: 'Latest Reading',
      render: (patient) => patient.latestReading
        ? <span className="whitespace-nowrap">
          {patient.latestReading.systolic != null || patient.latestReading.diastolic != null
            ? `BP ${patient.latestReading.systolic ?? '—'}/${patient.latestReading.diastolic ?? '—'} · `
            : ''}
          {patient.latestReading.bloodSugar != null ? `Sugar ${patient.latestReading.bloodSugar} mg/dL · ` : ''}
          {new Date(patient.latestReading.recordedAt).toLocaleDateString()}
        </span>
        : 'No readings',
    },
    {
      key: 'status',
      label: 'Status',
      render: (patient) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${patient.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{patient.status}</span>,
    },
    {
      key: 'alert',
      label: 'Alert',
      render: (patient) => patient.needsAttention
        ? <SeverityBadge severity={patient.highestAlertSeverity || 'high'} />
        : <span className="text-slate-500">—</span>,
    },
  ];
  const stats = [
    ['Total Patients', dashboard?.totalPatients ?? 0],
    ['Active Patients', dashboard?.activePatients ?? 0],
    ['Needs Attention', dashboard?.needsAttention ?? 0],
    ['Critical Alerts', dashboard?.criticalAlerts ?? 0],
  ];
  const breakdown = ['normal', 'warning', 'critical'].map((name) => ({
    name,
    value: dashboard?.readingsStatusBreakdown?.[name] ?? 0,
  }));

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8">
      <header className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Care overview</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Doctor Dashboard</h1>
        <p className="mt-1 text-slate-500">Assigned patients and readings that may need review.</p>
      </header>
      <ErrorNotice message={error} onRetry={retryDashboard} />
      {loading && !dashboard ? <Loader label="Loading doctor dashboard..." /> : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(([label, value]) => (
              <article key={label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Assigned patients</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <input
                  aria-label="Search patients"
                  value={searchInput}
                  onChange={(event) => { setSearchInput(event.target.value); setPage(1); setLoading(true); }}
                  placeholder="Search name, email, or patient ID"
                  className="rounded-xl border border-slate-300 px-3 py-2 sm:col-span-2 xl:col-span-1"
                />
                <select aria-label="Filter by disease" value={disease} onChange={(event) => { setDisease(event.target.value); setPage(1); setLoading(true); }} className="rounded-xl border border-slate-300 px-3 py-2">
                  <option value="">All diseases</option>
                  {diseases.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                </select>
                <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setLoading(true); }} className="rounded-xl border border-slate-300 px-3 py-2">
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select aria-label="Filter by alert severity" value={alertSeverity} onChange={(event) => { setAlertSeverity(event.target.value); setPage(1); setLoading(true); }} className="rounded-xl border border-slate-300 px-3 py-2">
                  <option value="">All alert severities</option>
                  {['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="mt-4">
                {loading && !dashboard ? <Loader label="Loading patients..." /> : dashboard?.patients?.length
                  ? <Table columns={columns} rows={dashboard.patients} />
                  : <EmptyState title="No assigned patients found" description="Try adjusting the search or filters." />}
                <Pagination page={page} totalPages={dashboard?.totalPages || 0} onPageChange={(nextPage) => { setPage(nextPage); setLoading(true); }} />
              </div>
            </div>
            <Chart
              title="Reading status · last 7 days"
              type="pie"
              data={breakdown}
              dataKey="value"
              nameKey="name"
              loading={loading && !dashboard}
              emptyMessage="No health readings were recorded during the last 7 days."
            />
          </section>

          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Recent alerts</h2>
                <p className="mt-1 text-sm text-slate-500">Demo review prompts, not diagnoses.</p>
              </div>
              <Link to="/alerts" className="font-semibold text-indigo-600 hover:text-indigo-800">View all alerts →</Link>
            </div>
            {dashboard?.recentAlerts?.length ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {dashboard.recentAlerts.map((alert) => (
                  <li key={alert._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-sm font-medium text-slate-800">{alert.patientId?.userId?.name || 'Patient'} · {alert.message}</span>
                    </div>
                    <span className="text-xs capitalize text-slate-500">{alert.status} · {new Date(alert.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No recent alerts" description="New review prompts will appear here." />}
          </section>
          <p className="mt-4 text-xs text-slate-500">Alert thresholds and reading classifications are demo-only and are not clinically validated.</p>
        </>
      )}
    </main>
  );
};

export default DoctorDashboard;
