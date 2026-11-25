import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import EmptyState from './EmptyState';
import ErrorNotice from './ErrorNotice';
import Loader from './Loader';
import Toast from './Toast';
import api from '../services/api';

const RecommendationsPanel = ({ patientId }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    let mounted = true;
    api.get('/notes', { params: { patientId } })
      .then((response) => { if (mounted) setNotes(response.data.data.notes); })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load doctor recommendations.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [patientId, refreshKey]);

  const retryNotes = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const addRecommendation = async ({ content }) => {
    setNotice('');
    setError('');
    try {
      const response = await api.post('/notes', { patientId, content });
      setNotes((current) => [response.data.data.note, ...current]);
      reset();
      setNotice('Recommendation added.');
    } catch (requestError) {
      setFormError('root', { message: requestError.response?.data?.message || 'Unable to save recommendation.' });
    }
  };

  return (
    <section className="mt-7 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-bold text-slate-900">{user?.role === 'patient' ? 'Doctor Recommendations' : 'Notes and recommendations'}</h2>
      <p className="mt-1 text-sm text-slate-500">Recommendations from the assigned care team.</p>
      <ErrorNotice message={error} onRetry={retryNotes} className="mt-3" />
      <Toast message={notice} onDismiss={() => setNotice('')} />

      {user?.role === 'doctor' && (
        <form onSubmit={handleSubmit(addRecommendation)} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Recommendation
            <textarea rows="3" maxLength="4000" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('content', { required: 'Enter a recommendation.', maxLength: { value: 4000, message: 'Maximum 4000 characters.' } })} />
          </label>
          {errors.content && <p role="alert" className="text-sm text-red-600">{errors.content.message}</p>}
          {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}
          <button disabled={isSubmitting} type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{isSubmitting ? 'Saving...' : 'Add recommendation'}</button>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {loading ? <Loader label="Loading recommendations..." /> : notes.length ? notes.map((note) => (
          <article key={note._id} className="rounded-xl border border-slate-200 p-4">
            <p className="whitespace-pre-wrap text-sm text-slate-800">{note.content}</p>
            <p className="mt-2 text-xs text-slate-500">
              {note.doctorId?.userId?.name ? `Dr. ${note.doctorId.userId.name} · ` : ''}
              {new Date(note.createdAt).toLocaleString()}
            </p>
          </article>
        )) : <EmptyState title="No recommendations yet" description="Recommendations from the assigned doctor will appear here." />}
      </div>
      <p className="mt-4 text-xs text-slate-500">Recommendations are not a substitute for urgent care or an in-person clinical assessment.</p>
    </section>
  );
};

export default RecommendationsPanel;
