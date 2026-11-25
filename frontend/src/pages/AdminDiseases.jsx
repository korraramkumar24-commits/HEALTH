import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import api from '../services/api';

const AdminDiseases = () => {
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { register, handleSubmit, reset, setError: setFormError, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    let mounted = true;
    api.get('/diseases')
      .then((response) => { if (mounted) setDiseases(response.data.data.diseases); })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load diseases.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [refreshKey]);

  const retryDiseases = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const openForm = (disease = null) => {
    reset({ name: disease?.name || '', description: disease?.description || '' });
    setModal({ mode: disease ? 'edit' : 'create', disease });
    setNotice('');
    setError('');
  };

  const saveDisease = async (values) => {
    try {
      if (modal.mode === 'edit') await api.put(`/diseases/${modal.disease._id}`, values);
      else await api.post('/diseases', values);
      setModal(null);
      setNotice(`Disease ${modal.mode === 'edit' ? 'updated' : 'created'}.`);
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setFormError('root', { message: requestError.response?.data?.message || 'Unable to save the disease.' });
    }
  };

  const deleteDisease = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/diseases/${modal.disease._id}`);
      setModal(null);
      setNotice('Disease deleted.');
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete the disease.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-7 sm:px-5">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">Administration</p><h1 className="mt-1 text-3xl font-bold text-slate-950">Disease catalogue</h1><p className="mt-1 text-slate-600">Manage disease labels available for patient profiles.</p></div>
        <button type="button" onClick={() => openForm()} className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800">Add disease</button>
      </header>
      <Toast message={notice} onDismiss={() => setNotice('')} />
      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900"><span>{error}</span><button type="button" onClick={retryDiseases} className="font-bold underline">Retry list</button></div>}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        {loading ? <Loader label="Loading diseases..." /> : diseases.length ? (
          <ul className="divide-y divide-slate-200">
            {diseases.map((disease) => (
              <li key={disease._id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-1 last:pb-1">
                <div className="min-w-0"><h2 className="font-semibold text-slate-950">{disease.name}</h2><p className="mt-1 break-words text-sm text-slate-600">{disease.description || 'No description provided.'}</p></div>
                <div className="flex shrink-0 gap-3"><button type="button" onClick={() => openForm(disease)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Edit</button><button type="button" onClick={() => { setModal({ mode: 'delete', disease }); setError(''); }} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50">Delete</button></div>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No diseases yet" description="Add disease labels to make them available in patient profiles." />}
      </section>

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={`${modal.mode === 'edit' ? 'Edit' : 'Add'} disease`} onClose={() => setModal(null)}>
          <form className="space-y-4" onSubmit={handleSubmit(saveDisease)}>
            <label className="block text-sm font-semibold text-slate-800">Name
              <input autoFocus className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('name', { required: 'Disease name is required.', maxLength: { value: 100, message: 'Use 100 characters or fewer.' } })} />
              {errors.name && <span className="mt-1 block text-sm text-red-800">{errors.name.message}</span>}
            </label>
            <label className="block text-sm font-semibold text-slate-800">Description
              <textarea rows={3} maxLength={500} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('description', { maxLength: { value: 500, message: 'Use 500 characters or fewer.' } })} />
              {errors.description && <span className="mt-1 block text-sm text-red-800">{errors.description.message}</span>}
            </label>
            {errors.root && <p role="alert" className="text-sm font-medium text-red-800">{errors.root.message}</p>}
            <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold">Cancel</button><button disabled={isSubmitting} type="submit" className="rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Saving…' : 'Save disease'}</button></div>
          </form>
        </Modal>
      )}
      {modal?.mode === 'delete' && (
        <Modal title="Delete disease" onClose={() => !deleting && setModal(null)}>
          <p className="text-slate-700">Delete <strong>{modal.disease.name}</strong>? This cannot be undone. Diseases assigned to patients cannot be deleted.</p>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-800">{error}</p>}
          <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={deleting} onClick={() => setModal(null)} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-60">Cancel</button><button type="button" disabled={deleting} onClick={deleteDisease} className="rounded-xl bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete disease'}</button></div>
        </Modal>
      )}
    </main>
  );
};

export default AdminDiseases;
