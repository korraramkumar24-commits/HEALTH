import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import EmptyState from '../components/EmptyState';
import ErrorNotice from '../components/ErrorNotice';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import Table from '../components/Table';

const MyPatients = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [disease, setDisease] = useState('');
  const [status, setStatus] = useState('');
  const [diseases, setDiseases] = useState([]);
  const [patients, setPatients] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    api.get('/diseases')
      .then((response) => setDiseases(response.data.data.diseases))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load diseases.'));
  }, [refreshKey]);

  useEffect(() => {
    let mounted = true;
    api.get('/patients', { params: { search, disease, status, page, limit: 10 } })
      .then((response) => {
        if (!mounted) return;
        setPatients(response.data.data.patients);
        setTotalPages(response.data.data.totalPages);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load patients.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [search, disease, status, page, refreshKey]);

  const retryPatients = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const columns = [
    { key: 'name', label: 'Patient', render: (patient) => patient.userId?.name || 'Unknown' },
    { key: 'email', label: 'Email', render: (patient) => patient.userId?.email || '—' },
    { key: 'disease', label: 'Disease', render: (patient) => patient.disease?.name || '—' },
    { key: 'status', label: 'Status', render: (patient) => <span className="capitalize">{patient.status}</span> },
    {
      key: 'health',
      label: '',
      render: (patient) => (
        <Link className="font-semibold text-indigo-600 hover:text-indigo-800" to={`/patients/${patient._id}/health`}>
          Health history
        </Link>
      ),
    },
    {
      key: 'view',
      label: '',
      render: (patient) => (
        <Link className="font-semibold text-indigo-600 hover:text-indigo-800" to={`/patients/${patient._id}`}>
          View profile
        </Link>
      ),
    },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8">
      <header className="mb-7">
        <Link to="/doctor/dashboard" className="text-sm font-semibold text-indigo-600">← Dashboard</Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">My Patients</h1>
        <p className="mt-1 text-slate-500">Patients assigned to your care.</p>
      </header>
      <section className="mb-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:grid-cols-[1fr_220px_180px]">
        <input
          aria-label="Search patients"
          className="rounded-xl border border-slate-300 px-3 py-2"
          onChange={(event) => {
            const value = event.target.value;
            setSearchInput(value);
            if (value.trim() !== search) setLoading(true);
            setError('');
            setPage(1);
          }}
          placeholder="Search name, email, or patient ID"
          value={searchInput}
        />
        <select aria-label="Filter by disease" className="rounded-xl border border-slate-300 px-3 py-2" onChange={(event) => { setDisease(event.target.value); setLoading(true); setError(''); setPage(1); }} value={disease}>
          <option value="">All diseases</option>
          {diseases.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
        </select>
        <select aria-label="Filter by status" className="rounded-xl border border-slate-300 px-3 py-2" onChange={(event) => { setStatus(event.target.value); setLoading(true); setError(''); setPage(1); }} value={status}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </section>
      <ErrorNotice message={error} onRetry={retryPatients} />
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        {loading ? <Loader label="Loading patients..." /> : patients.length
          ? <Table columns={columns} rows={patients} />
          : <EmptyState title="No assigned patients" description="Patients assigned to you will appear here." />}
        {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={(value) => { setPage(value); setLoading(true); }} />}
      </section>
    </main>
  );
};

export default MyPatients;
