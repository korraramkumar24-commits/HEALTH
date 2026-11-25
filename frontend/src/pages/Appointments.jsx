import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorNotice from '../components/ErrorNotice';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import Loader from '../components/Loader';
import api from '../services/api';

const localDateTimeInput = (date = new Date(Date.now() + 60 * 60 * 1000)) => {
  const value = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return value.toISOString().slice(0, 16);
};

const Appointments = () => {
  const { user } = useAuth();
  const [initialTimes] = useState(() => {
    const now = Date.now();
    return {
      now: localDateTimeInput(new Date(now)),
      startsAt: localDateTimeInput(new Date(now + 60 * 60 * 1000)),
      endsAt: localDateTimeInput(new Date(now + 90 * 60 * 1000)),
    };
  });
  const referenceTime = new Date(initialTimes.now).getTime();
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [filter, setFilter] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      startsAt: initialTimes.startsAt,
      endsAt: initialTimes.endsAt,
    },
  });

  useEffect(() => {
    let mounted = true;
    api.get('/appointments')
      .then((response) => { if (mounted) setAppointments(response.data.data.appointments); })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load appointments.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [refreshKey]);

  useEffect(() => {
    if (!['doctor', 'admin'].includes(user?.role)) return undefined;
    let mounted = true;
    const requests = [api.get('/patients', { params: { page: 1, limit: 50 } })];
    if (user.role === 'admin') requests.push(api.get('/doctors'));
    Promise.all(requests)
      .then(([patientResponse, doctorResponse]) => {
        if (!mounted) return;
        setPatients(patientResponse.data.data.patients);
        if (doctorResponse) setDoctors(doctorResponse.data.data.doctors);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load appointment options.');
      });
    return () => { mounted = false; };
  }, [user?.role, refreshKey]);

  const createAppointment = async (values) => {
    setNotice('');
    setError('');
    try {
      await api.post('/appointments', {
        patientId: values.patientId,
        ...(user?.role === 'admin' ? { doctorId: values.doctorId } : {}),
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: new Date(values.endsAt).toISOString(),
        reason: values.reason || '',
      });
      const nextStart = referenceTime;
      reset({
        startsAt: localDateTimeInput(new Date(nextStart + 60 * 60 * 1000)),
        endsAt: localDateTimeInput(new Date(nextStart + 90 * 60 * 1000)),
      });
      setNotice('Appointment scheduled.');
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setFormError('root', { message: requestError.response?.data?.message || 'Unable to schedule appointment.' });
    }
  };

  const cancelAppointment = async () => {
    if (!appointmentToCancel) return;
    setCancelling(true);
    setError('');
    try {
      await api.put(`/appointments/${appointmentToCancel._id}/cancel`);
      setAppointmentToCancel(null);
      setNotice('Appointment cancelled.');
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to cancel appointment.');
    } finally {
      setCancelling(false);
    }
  };

  const retryAppointments = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const visibleAppointments = appointments.filter((appointment) => {
    if (filter === 'upcoming') return appointment.status === 'scheduled' && new Date(appointment.startsAt).getTime() >= referenceTime;
    if (filter === 'past') return new Date(appointment.startsAt).getTime() < referenceTime || appointment.status === 'completed';
    return appointment.status === 'cancelled';
  });

  if (loading) return <Loader label="Loading appointments..." />;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8">
      <header className="mb-7">
        <Link to={`/${user?.role}/dashboard`} className="text-sm font-semibold text-indigo-600">← Dashboard</Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Appointments</h1>
        <p className="mt-1 text-slate-500">{user?.role === 'patient' ? 'Upcoming visits and appointment history.' : 'Schedule visits for patients in your care.'}</p>
      </header>
      <ErrorNotice message={error} onRetry={retryAppointments} />
      <Toast message={notice} onDismiss={() => setNotice('')} />

      {['doctor', 'admin'].includes(user?.role) && (
        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Schedule appointment</h2>
          <form onSubmit={handleSubmit(createAppointment)} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Patient
              <select defaultValue="" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('patientId', { required: 'Select a patient.' })}>
                <option value="" disabled>Select patient</option>
                {patients.map((patient) => <option key={patient._id} value={patient._id}>{patient.userId?.name || patient._id}</option>)}
              </select>
              {errors.patientId && <span role="alert" className="mt-1 block text-sm text-red-600">{errors.patientId.message}</span>}
            </label>
            {user.role === 'admin' && <label className="text-sm font-medium text-slate-700">Assigned doctor
              <select defaultValue="" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('doctorId', { required: 'Select a doctor.' })}>
                <option value="" disabled>Select doctor</option>
                {doctors.map((doctor) => <option key={doctor._id} value={doctor._id}>{doctor.userId?.name || doctor._id}</option>)}
              </select>
              {errors.doctorId && <span role="alert" className="mt-1 block text-sm text-red-600">{errors.doctorId.message}</span>}
            </label>}
            <label className="text-sm font-medium text-slate-700">Starts
              <input type="datetime-local" min={initialTimes.now} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('startsAt', {
                required: 'Start time is required.',
                validate: (value) => new Date(value).getTime() > referenceTime || 'Start time must be in the future.',
              })} />
            </label>
            <label className="text-sm font-medium text-slate-700">Ends
              <input type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('endsAt', {
                required: 'End time is required.',
                validate: (value) => new Date(value) > new Date(getValues('startsAt')) || 'End time must be after start time.',
              })} />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Reason
              <textarea rows="2" maxLength="500" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('reason')} />
            </label>
            {errors.root && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{errors.root.message}</p>}
            <button disabled={isSubmitting} type="submit" className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 sm:col-span-2">{isSubmitting ? 'Scheduling...' : 'Schedule appointment'}</button>
          </form>
          <p className="mt-3 text-xs text-slate-500">A doctor can have only one scheduled appointment starting at a given time.</p>
        </section>
      )}

      <section className="mb-4 flex flex-wrap gap-2">
        {['upcoming', 'past', 'cancelled'].map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${filter === value ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{value}</button>
        ))}
      </section>
      <section className="space-y-3">
        {visibleAppointments.length ? visibleAppointments.map((appointment) => (
          <article key={appointment._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div>
              <h2 className="font-bold text-slate-900">{new Date(appointment.startsAt).toLocaleString()}</h2>
              <p className="mt-1 text-sm text-slate-600">{user?.role === 'patient' ? `Dr. ${appointment.doctorId?.userId?.name || 'Assigned doctor'}` : appointment.patientId?.userId?.name || 'Patient'}</p>
              {appointment.reason && <p className="mt-1 text-sm text-slate-500">{appointment.reason}</p>}
              <p className="mt-1 text-xs capitalize text-slate-500">{appointment.status} · Ends {new Date(appointment.endsAt).toLocaleTimeString()}</p>
            </div>
            {appointment.status === 'scheduled' && (
              <button type="button" onClick={() => { setError(''); setAppointmentToCancel(appointment); }} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-50">Cancel appointment</button>
            )}
          </article>
        )) : <EmptyState title={`No ${filter} appointments`} description="Appointments for this section will appear here." />}
      </section>
      {appointmentToCancel && (
        <Modal title="Cancel appointment" onClose={() => !cancelling && setAppointmentToCancel(null)}>
          <p className="text-slate-700">Cancel the appointment scheduled for <strong>{new Date(appointmentToCancel.startsAt).toLocaleString()}</strong>? This cannot be undone.</p>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-900">{error}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" disabled={cancelling} onClick={() => setAppointmentToCancel(null)} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-60">Keep appointment</button>
            <button type="button" disabled={cancelling} onClick={cancelAppointment} className="rounded-xl bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60">{cancelling ? 'Cancelling...' : 'Confirm cancellation'}</button>
          </div>
        </Modal>
      )}
    </main>
  );
};

export default Appointments;
