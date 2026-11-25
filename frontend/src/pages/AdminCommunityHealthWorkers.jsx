import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState';
import ErrorNotice from '../components/ErrorNotice';
import Loader from '../components/Loader';
import Toast from '../components/Toast';
import api from '../services/api';
import useLanguage from '../hooks/useLanguage';

const blankForm = {
  name: '',
  phone: '',
  serviceArea: '',
  languages: '',
  latitude: '',
  longitude: '',
};

const AdminCommunityHealthWorkers = () => {
  const { t } = useLanguage();
  const [workers, setWorkers] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadWorkers = async () => {
    try {
      const response = await api.get('/community-health-workers');
      setWorkers(response.data.data.workers);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load the worker directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkers(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const editWorker = (worker) => {
    setEditingId(worker._id);
    setForm({
      name: worker.name,
      phone: worker.phone,
      serviceArea: worker.serviceArea,
      languages: worker.languages.join(', '),
      latitude: String(worker.location.coordinates[1]),
      longitude: String(worker.location.coordinates[0]),
    });
    setNotice('');
  };

  const submitWorker = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      name: form.name,
      phone: form.phone,
      serviceArea: form.serviceArea,
      languages: form.languages.split(',').map((value) => value.trim()).filter(Boolean),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
    };
    try {
      if (editingId) {
        await api.put(`/community-health-workers/${editingId}`, payload);
        setNotice('Community health worker updated.');
      } else {
        await api.post('/community-health-workers', payload);
        setNotice('Community health worker added.');
      }
      setForm(blankForm);
      setEditingId('');
      await loadWorkers();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this worker.');
    } finally {
      setSaving(false);
    }
  };

  const deactivateWorker = async (worker) => {
    if (!window.confirm(`Deactivate ${worker.name} in the nearby directory?`)) return;
    setError('');
    setNotice('');
    try {
      await api.delete(`/community-health-workers/${worker._id}`);
      setNotice('Community health worker deactivated.');
      await loadWorkers();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to deactivate this worker.');
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">{t('admin.directory')}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{t('admin.workers')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Only add worker contact details verified by your organization. Patients share their current coordinates with this service only when they press “Find nearby workers”; exact worker coordinates are not returned to patients.
        </p>
      </header>

      <ErrorNotice message={error} onRetry={() => { setLoading(true); void loadWorkers(); }} />
      <Toast message={notice} onDismiss={() => setNotice('')} />

      <section className="mb-7 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h2 className="text-xl font-bold text-slate-950">{editingId ? 'Edit directory entry' : 'Add verified worker'}</h2>
        <form onSubmit={submitWorker} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Name
            <input required minLength={2} maxLength={100} value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="text-sm font-semibold">Phone number
            <input required type="tel" inputMode="tel" value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="text-sm font-semibold">Service area
            <input required maxLength={160} value={form.serviceArea} onChange={(event) => updateForm('serviceArea', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="text-sm font-semibold">Languages (comma separated)
            <input value={form.languages} onChange={(event) => updateForm('languages', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Telugu, English" />
          </label>
          <label className="text-sm font-semibold">Service location latitude
            <input required type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => updateForm('latitude', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="text-sm font-semibold">Service location longitude
            <input required type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => updateForm('longitude', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-xl bg-indigo-700 px-5 py-2.5 font-bold text-white hover:bg-indigo-800 disabled:opacity-60">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add worker'}
            </button>
            {editingId && <button type="button" onClick={() => { setEditingId(''); setForm(blankForm); }} className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold">Cancel</button>}
          </div>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-xl font-bold">Directory entries ({workers.length})</h2>
        {loading ? <Loader label="Loading community health worker directory…" /> : workers.length === 0 ? (
          <EmptyState title="No directory entries" description="An administrator must add and verify local worker contacts before nearby search can return results." />
        ) : (
          <ul className="space-y-3">
            {workers.map((worker) => (
              <li key={worker._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div>
                  <h3 className="font-bold">{worker.name} {!worker.isActive && <span className="text-xs font-medium text-slate-600">(inactive)</span>}</h3>
                  <p className="text-sm text-slate-700">{worker.phone} · {worker.serviceArea}</p>
                  {worker.languages.length > 0 && <p className="text-sm text-slate-600">{worker.languages.join(', ')}</p>}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => editWorker(worker)} className="font-semibold text-indigo-800 underline">Edit</button>
                  {worker.isActive && <button type="button" onClick={() => deactivateWorker(worker)} className="font-semibold text-red-800 underline">Deactivate</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default AdminCommunityHealthWorkers;
