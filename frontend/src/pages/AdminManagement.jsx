import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import ErrorNotice from '../components/ErrorNotice';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import Table from '../components/Table';
import Toast from '../components/Toast';
import api from '../services/api';

const PAGE_SIZE = 10;

const AdminManagement = ({ type }) => {
  const title = type[0].toUpperCase() + type.slice(1);
  const [records, setRecords] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState(false);
  const [assigningPatientId, setAssigningPatientId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [referenceRefreshKey, setReferenceRefreshKey] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm();
  const creatingRole = watch('role');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = type === 'users' ? '/users' : type === 'doctors' ? '/doctors' : '/patients';
      const params = type === 'patients' ? { limit: 50, search } : { search };
      const response = await api.get(endpoint, { params });
      const key = type;
      setRecords(response.data.data[key] || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to load ${type}.`);
    } finally {
      setLoading(false);
    }
  }, [type, search]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.get('/doctors'), api.get('/diseases')])
      .then(([doctorResponse, diseaseResponse]) => {
        if (!mounted) return;
        setDoctors(doctorResponse.data.data.doctors);
        setDiseases(diseaseResponse.data.data.diseases);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load reference data.');
      });
    return () => { mounted = false; };
  }, [referenceRefreshKey]);

  const openCreate = () => {
    reset({ role: 'patient', status: 'active', isActive: true });
    setModal({ mode: 'create' });
  };

  const openEdit = (record) => {
    const user = type === 'users' ? record : record.userId || {};
    reset({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      isActive: Boolean(user.isActive),
      specialization: record.specialization || '',
      licenseNumber: record.licenseNumber || '',
      status: record.status || 'active',
      dateOfBirth: record.dateOfBirth ? new Date(record.dateOfBirth).toISOString().slice(0, 10) : '',
      gender: record.gender || '',
      disease: record.disease?._id || '',
    });
    setModal({ mode: 'edit', record });
  };

  const submitForm = async (values) => {
    try {
      if (modal.mode === 'create') {
        const endpoint = type === 'doctors' || (type === 'users' && values.role === 'doctor')
          ? '/doctors'
          : '/patients';
        const payload = { ...values };
        delete payload.role;
        await api.post(endpoint, payload);
      } else if (type === 'users') {
        await api.put(`/users/${modal.record._id}`, values);
      } else if (type === 'doctors') {
        await api.put(`/doctors/${modal.record._id}`, values);
      } else {
        await api.put(`/patients/${modal.record._id}`, {
          name: values.name,
          email: values.email,
          phone: values.phone,
          dateOfBirth: values.dateOfBirth || null,
          gender: values.gender,
          disease: values.disease || null,
          status: values.status,
        });
      }
      setModal(null);
      setNotice(`${title.slice(0, -1)} ${modal.mode === 'create' ? 'created' : 'updated'}.`);
      await loadRecords();
    } catch (requestError) {
      setFormError('root', {
        message: requestError.response?.data?.message || `Unable to save ${type.slice(0, -1)}.`,
      });
    }
  };

  const removeRecord = async () => {
    setRemoving(true);
    setError('');
    try {
      await api.delete(`/${type}/${modal.record._id}`);
      setModal(null);
      setNotice(`${title.slice(0, -1)} deactivated.`);
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to deactivate ${type.slice(0, -1)}.`);
    } finally {
      setRemoving(false);
    }
  };

  const assignDoctor = async (patient, doctorId) => {
    setAssigningPatientId(patient._id);
    setError('');
    try {
      await api.put(`/patients/${patient._id}/assign-doctor`, { doctorId: doctorId || null });
      setNotice('Doctor assignment updated.');
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to assign doctor.');
    } finally {
      setAssigningPatientId('');
    }
  };

  const retryManagement = () => {
    loadRecords();
    setReferenceRefreshKey((key) => key + 1);
  };

  const visibleRecords = useMemo(() => {
    const filtered = records;
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [records, page]);
  const pageCount = Math.ceil(records.length / PAGE_SIZE);

  const columns = [
    { key: 'name', label: 'Name', render: (record) => (type === 'users' ? record.name : record.userId?.name) || '—' },
    { key: 'email', label: 'Email', render: (record) => (type === 'users' ? record.email : record.userId?.email) || '—' },
    ...(type === 'users' ? [{ key: 'role', label: 'Role', render: (record) => <span className="capitalize">{record.role}</span> }] : []),
    ...(type === 'doctors' ? [
      { key: 'specialization', label: 'Specialization' },
      { key: 'licenseNumber', label: 'License' },
    ] : []),
    ...(type === 'patients' ? [
      { key: 'disease', label: 'Disease', render: (record) => record.disease?.name || '—' },
      { key: 'status', label: 'Status', render: (record) => <span className="capitalize">{record.status}</span> },
      {
        key: 'doctorId',
        label: 'Assigned doctor',
        render: (record) => (
          <select
            aria-label={`Assign doctor to ${record.userId?.name || 'patient'}`}
            disabled={assigningPatientId === record._id}
            className="max-w-48 rounded-lg border border-slate-300 px-2 py-1.5"
            onChange={(event) => assignDoctor(record, event.target.value)}
            value={record.doctorId?._id || ''}
          >
            <option value="">Unassigned</option>
            {doctors.map((doctor) => <option key={doctor._id} value={doctor._id}>{doctor.userId?.name || 'Doctor'}</option>)}
          </select>
        ),
      },
    ] : []),
    {
      key: 'actions',
      label: 'Actions',
      render: (record) => (
        <div className="flex items-center gap-3">
          {type === 'patients' && <Link className="font-semibold text-indigo-600" to={`/patients/${record._id}`}>View</Link>}
          <button type="button" onClick={() => openEdit(record)} className="font-semibold text-slate-700 hover:text-indigo-600">Edit</button>
          <button type="button" onClick={() => setModal({ mode: 'delete', record })} className="font-semibold text-red-600 hover:text-red-700">Deactivate</button>
        </div>
      ),
    },
  ];

  const showDoctorFields = type === 'doctors' || (type === 'users' && modal?.mode === 'create' && creatingRole === 'doctor');
  const showPatientFields = type === 'patients' || (type === 'users' && modal?.mode === 'create' && creatingRole === 'patient');

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-8">
      <header className="mb-7">
        <Link to="/admin/dashboard" className="text-sm font-semibold text-indigo-600">← Dashboard</Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-3xl font-bold text-slate-900">Manage {title}</h1><p className="mt-1 text-slate-500">Create, update, and deactivate records.</p></div>
          <button type="button" onClick={openCreate} className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-500">Create {type === 'users' ? 'user' : type.slice(0, -1)}</button>
        </div>
      </header>
      <Toast message={notice} onDismiss={() => setNotice('')} />
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <input
          aria-label={`Search ${type}`}
          className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 sm:max-w-md"
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder={`Search ${type} by name or email`}
          value={search}
        />
        <ErrorNotice message={error} onRetry={retryManagement} />
        {loading ? <Loader label={`Loading ${type}...`} /> : records.length
          ? <Table columns={columns} rows={visibleRecords} />
          : <EmptyState title={`No ${type} found`} description="Create a record or change your search." />}
        {!loading && <Pagination page={page} totalPages={pageCount} onPageChange={setPage} />}
      </section>

      {modal?.mode === 'delete' && (
        <Modal title={`Deactivate ${type.slice(0, -1)}`} onClose={() => !removing && setModal(null)}>
          <p className="text-slate-600">This is a soft delete. The record will remain stored but the account will be inactive where applicable.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" disabled={removing} onClick={() => setModal(null)} className="rounded-xl border border-slate-300 px-4 py-2 disabled:opacity-60">Cancel</button>
            <button type="button" disabled={removing} onClick={removeRecord} className="rounded-xl bg-red-800 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{removing ? 'Deactivating...' : 'Deactivate'}</button>
          </div>
        </Modal>
      )}

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={`${modal.mode === 'create' ? 'Create' : 'Edit'} ${type === 'users' ? 'user' : type.slice(0, -1)}`} onClose={() => setModal(null)}>
          <form className="space-y-4" onSubmit={handleSubmit(submitForm)}>
            {type === 'users' && modal.mode === 'create' && (
              <label className="block text-sm font-medium text-slate-700">Account type
                <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('role', { required: true })}>
                  <option value="patient">Patient</option><option value="doctor">Doctor</option>
                </select>
              </label>
            )}
            {[
              ['name', 'Full name', 'text', true],
              ['email', 'Email', 'email', true],
              ...(modal.mode === 'create' ? [['password', 'Temporary password', 'password', true]] : []),
              ['phone', 'Phone', 'tel', false],
            ].map(([field, label, inputType, required]) => (
              <label key={field} className="block text-sm font-medium text-slate-700">{label}
                <input type={inputType} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register(field, { required: required ? `${label} is required` : false, ...(field === 'email' ? { pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email.' } } : {}), ...(field === 'password' ? { minLength: { value: 8, message: 'Use at least 8 characters.' } } : {}) })} />
                {errors[field] && <span className="mt-1 block text-xs text-red-600">{errors[field].message}</span>}
              </label>
            ))}
            {showDoctorFields && <>
              <label className="block text-sm font-medium text-slate-700">Specialization<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('specialization')} /></label>
              <label className="block text-sm font-medium text-slate-700">License number<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('licenseNumber')} /></label>
            </>}
            {showPatientFields && <>
              <label className="block text-sm font-medium text-slate-700">Date of birth<input type="date" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('dateOfBirth')} /></label>
              <label className="block text-sm font-medium text-slate-700">Gender<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('gender')} /></label>
              <label className="block text-sm font-medium text-slate-700">Disease<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('disease')}><option value="">None</option>{diseases.map((disease) => <option key={disease._id} value={disease._id}>{disease.name}</option>)}</select></label>
            </>}
            {modal.mode === 'edit' && type === 'patients' && (
              <label className="block text-sm font-medium text-slate-700">Status<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            )}
            {modal.mode === 'edit' && (type === 'users' || type === 'doctors') && (
              <label className="block text-sm font-medium text-slate-700">Account status<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" {...register('isActive', { setValueAs: (value) => value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></label>
            )}
            {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-300 px-4 py-2">Cancel</button>
              <button disabled={isSubmitting} type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{isSubmitting ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
};

export default AdminManagement;
