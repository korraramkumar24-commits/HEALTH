import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorNotice from '../components/ErrorNotice';
import Loader from '../components/Loader';
import Toast from '../components/Toast';
import api from '../services/api';
import RecommendationsPanel from '../components/RecommendationsPanel';

const toDateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';

const PatientProfile = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [diseases, setDiseases] = useState([]);
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
  const editable = user?.role !== 'doctor';

  useEffect(() => {
    let mounted = true;
    const patientRequest = id ? api.get(`/patients/${id}`) : api.get('/patients/me');
    Promise.all([patientRequest, api.get('/diseases')])
      .then(([patientResponse, diseaseResponse]) => {
        if (!mounted) return;
        const record = patientResponse.data.data.patient;
        setPatient(record);
        setDiseases(diseaseResponse.data.data.diseases);
        reset({
          name: record.userId?.name || '',
          email: record.userId?.email || '',
          phone: record.userId?.phone || '',
          dateOfBirth: toDateInput(record.dateOfBirth),
          gender: record.gender || '',
          disease: record.disease?._id || '',
          emergencyName: record.emergencyContact?.name || '',
          emergencyPhone: record.emergencyContact?.phone || '',
        });
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load patient profile.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id, reset, refreshKey]);

  const retryProfile = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const onSubmit = async (values) => {
    setNotice('');
    setError('');
    try {
      const response = await api.put(`/patients/${patient._id}`, {
        name: values.name,
        email: values.email,
        phone: values.phone,
        dateOfBirth: values.dateOfBirth || null,
        gender: values.gender,
        disease: values.disease || null,
        emergencyContact: { name: values.emergencyName, phone: values.emergencyPhone },
      });
      setPatient(response.data.data.patient);
      setNotice('Patient profile saved.');
    } catch (requestError) {
      setFormError('root', { message: requestError.response?.data?.message || 'Unable to save this profile.' });
    }
  };

  if (loading) return <Loader label="Loading patient profile..." />;
  if (!patient) {
    return <main className="mx-auto max-w-3xl px-5 py-10"><ErrorNotice message={error} onRetry={retryProfile} />{!error && <EmptyState title="Patient profile not found" description="The requested profile could not be found." />}</main>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-8">
      <header className="mb-7">
        <Link to={user?.role === 'doctor' ? '/doctor/patients' : `/${user?.role}/dashboard`} className="text-sm font-semibold text-indigo-600">← Back</Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Patient Profile</h1>
        <p className="mt-1 text-slate-500">Patient ID: {patient._id}</p>
        <Link to={`/patients/${patient._id}/health`} className="mt-3 inline-block text-sm font-semibold text-indigo-600">View health history →</Link>
      </header>
      <ErrorNotice message={error} onRetry={retryProfile} />
      <Toast message={notice} onDismiss={() => setNotice('')} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Full name<input disabled={!editable} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Use at least 2 characters.' } })} /></label>
          <label className="text-sm font-medium text-slate-700">Email<input disabled={!editable} type="email" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email.' } })} /></label>
          <label className="text-sm font-medium text-slate-700">Phone<input disabled={!editable} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('phone')} /></label>
          <label className="text-sm font-medium text-slate-700">Date of birth<input disabled={!editable} type="date" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('dateOfBirth')} /></label>
          <label className="text-sm font-medium text-slate-700">Gender<input disabled={!editable} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('gender')} /></label>
          <label className="text-sm font-medium text-slate-700">Disease<select disabled={!editable} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('disease')}><option value="">None</option>{diseases.map((disease) => <option key={disease._id} value={disease._id}>{disease.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Emergency contact name<input disabled={!editable} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('emergencyName')} /></label>
          <label className="text-sm font-medium text-slate-700">Emergency contact phone<input disabled={!editable} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('emergencyPhone')} /></label>
        </div>
        {Object.values(errors).filter((item) => item?.message).map((item) => <p key={item.message} className="text-sm text-red-600">{item.message}</p>)}
        {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}
        {editable && <button disabled={isSubmitting} type="submit" className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{isSubmitting ? 'Saving...' : 'Save profile'}</button>}
      </form>
      <RecommendationsPanel patientId={patient._id} />
    </main>
  );
};

export default PatientProfile;
