import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const statsByRole = {
  patient: [
    { label: 'Today readings', value: '4' },
    { label: 'Avg blood sugar', value: '118 mg/dL' },
    { label: 'Medication adherence', value: '92%' },
  ],
  doctor: [
    { label: 'Assigned patients', value: '18' },
    { label: 'Alerts this week', value: '6' },
    { label: 'Follow-ups due', value: '3' },
  ],
  admin: [
    { label: 'Active patients', value: '142' },
    { label: 'Doctors', value: '24' },
    { label: 'Open alerts', value: '11' },
  ],
};

const Dashboard = ({ role }) => {
  const { user } = useAuth();
  const stats = statsByRole[role] || statsByRole.patient;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600">Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Hello, {user?.name || 'Care team'}</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 capitalize">{role}</span>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Overview</h2>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Latest focus</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">
                  {role === 'patient' && 'Your blood pressure trend is stable this week.'}
                  {role === 'doctor' && 'Two patients need review for elevated blood sugar readings.'}
                  {role === 'admin' && 'System health check is normal with 4 critical alerts resolved.'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {role === 'patient' && <>
                  <Link to="/patient/profile" className="rounded-2xl bg-indigo-600 p-4 text-white shadow-sm hover:bg-indigo-500">View or edit profile</Link>
                  <Link to="/health" className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 hover:bg-slate-50">Add a reading / health history</Link>
                  <Link to="/alerts" className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 hover:bg-slate-50 sm:col-span-2">View alerts and doctor recommendations</Link>
                </>}
                {role === 'doctor' && <>
                  <Link to="/doctor/patients" className="rounded-2xl bg-indigo-600 p-4 text-white shadow-sm hover:bg-indigo-500">View my patients</Link>
                  <Link to="/alerts" className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 hover:bg-slate-50">Review alerts</Link>
                </>}
                {role === 'admin' && <>
                  <Link to="/admin/users" className="rounded-2xl bg-indigo-600 p-4 text-white shadow-sm hover:bg-indigo-500">Manage users</Link>
                  <Link to="/admin/doctors" className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 hover:bg-slate-50">Manage doctors</Link>
                  <Link to="/admin/patients" className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 hover:bg-slate-50 sm:col-span-2">Manage patients</Link>
                </>}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Quick actions</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="rounded-xl bg-slate-50 p-3">Review weekly readings</li>
              <li className="rounded-xl bg-slate-50 p-3">Check medication schedule</li>
              <li className="rounded-xl bg-slate-50 p-3">Share patient recommendations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
