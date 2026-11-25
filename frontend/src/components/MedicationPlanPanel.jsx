import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import EmptyState from './EmptyState';
import ErrorNotice from './ErrorNotice';
import Loader from './Loader';
import Toast from './Toast';
import api from '../services/api';

const dateInputToIso = (value) => value ? new Date(value).toISOString() : null;

const MedicationPlanPanel = ({ patientId }) => {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const {
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { startsAt: today } });

  useEffect(() => {
    let mounted = true;
    api.get('/medications', { params: { patientId } })
      .then((response) => { if (mounted) setMedications(response.data.data.medications); })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load medication plans.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [patientId, refreshKey]);

  const retryPlans = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const createPlan = async (values) => {
    setNotice('');
    setError('');
    const scheduledTimes = values.scheduledTimes
      .split(',')
      .map((time) => time.trim())
      .filter(Boolean);
    try {
      const response = await api.post('/medications', {
        patientId,
        name: values.name,
        instructions: values.instructions,
        scheduledTimes,
        startsAt: dateInputToIso(values.startsAt) || dateInputToIso(today),
        endsAt: dateInputToIso(values.endsAt),
      });
      setMedications((current) => [response.data.data.medication, ...current]);
      reset();
      setNotice('Medication plan saved.');
    } catch (requestError) {
      setFormError('root', { message: requestError.response?.data?.message || 'Unable to save medication plan.' });
    }
  };

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-bold text-slate-900">Medication plans</h2>
      <p className="mt-1 text-sm text-slate-500">Enter instructions and times exactly as directed by the clinician. This tool does not calculate or recommend medication or dosage.</p>
      <ErrorNotice message={error} onRetry={retryPlans} className="mt-3" />
      <Toast message={notice} onDismiss={() => setNotice('')} />
      <form onSubmit={handleSubmit(createPlan)} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Medication name
          <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('name', { required: 'Medication name is required.' })} />
          {errors.name && <span role="alert" className="mt-1 block text-sm text-red-600">{errors.name.message}</span>}
        </label>
        <label className="text-sm font-medium text-slate-700">Scheduled dose times (24-hour, comma-separated)
          <input placeholder="08:00, 20:00" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('scheduledTimes', { required: 'Enter at least one dose time.' })} />
          {errors.scheduledTimes && <span role="alert" className="mt-1 block text-sm text-red-600">{errors.scheduledTimes.message}</span>}
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Clinician-entered instructions
          <textarea rows="3" maxLength="1000" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('instructions', { required: 'Enter clinician instructions.' })} />
          {errors.instructions && <span role="alert" className="mt-1 block text-sm text-red-600">{errors.instructions.message}</span>}
        </label>
        <label className="text-sm font-medium text-slate-700">Starts on
          <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('startsAt')} />
        </label>
        <label className="text-sm font-medium text-slate-700">Ends on (optional)
          <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('endsAt')} />
        </label>
        {errors.root && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{errors.root.message}</p>}
        <button disabled={isSubmitting} type="submit" className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 sm:col-span-2">{isSubmitting ? 'Saving...' : 'Add medication plan'}</button>
      </form>
      <div className="mt-5">
        {loading ? <Loader label="Loading medication plans..." /> : medications.length ? (
          <ul className="divide-y divide-slate-100">
            {medications.map((medication) => (
              <li key={medication._id} className="py-3">
                <p className="font-semibold text-slate-900">{medication.name} · {medication.scheduledTimes.join(', ')}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{medication.instructions}</p>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No medication plans" description="Clinician-entered plans will appear here." />}
      </div>
    </section>
  );
};

export default MedicationPlanPanel;
