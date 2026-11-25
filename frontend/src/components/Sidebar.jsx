import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useLanguage from '../hooks/useLanguage';

const linksByRole = {
  patient: [
    ['Dashboard', '/patient/dashboard'],
    ['Health history', '/health'],
    ['Medications', '/medications'],
    ['Appointments', '/appointments'],
    ['Alerts', '/alerts'],
    ['Emergency contacts', '/emergency'],
    ['Profile', '/patient/profile'],
  ],
  doctor: [
    ['Dashboard', '/doctor/dashboard'],
    ['My patients', '/doctor/patients'],
    ['Appointments', '/appointments'],
    ['Alerts', '/alerts'],
  ],
  admin: [
    ['Dashboard', '/admin/dashboard'],
    ['Users', '/admin/users'],
    ['Doctors', '/admin/doctors'],
    ['Patients', '/admin/patients'],
    ['Diseases', '/admin/diseases'],
    ['Community health workers', '/admin/community-health-workers'],
    ['Alerts', '/alerts'],
    ['Appointments', '/appointments'],
  ],
};

const linkTranslationKeys = {
  Dashboard: 'dashboard',
  'Health history': 'health',
  Medications: 'medications',
  Appointments: 'appointments',
  Alerts: 'alerts',
  'Emergency contacts': 'emergency',
  Profile: 'profile',
  'My patients': 'patients',
  Patients: 'patients',
  Users: 'users',
  Doctors: 'doctors',
  Diseases: 'diseases',
  'Community health workers': 'workers',
};

const Sidebar = ({ open, onClose }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const links = linksByRole[user?.role] || [];

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 cursor-default bg-slate-950/40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        aria-label="Main navigation"
        className={`${user?.role === 'patient' ? 'patient-sidebar' : ''} ${open ? 'visible translate-x-0' : 'invisible -translate-x-full'} fixed bottom-0 left-0 top-[65px] z-40 w-64 overflow-y-auto border-r border-slate-300 bg-slate-900 p-4 transition-transform md:visible md:sticky md:top-[65px] md:block md:h-[calc(100vh-65px)] md:translate-x-0`}
      >
        <div className="mb-3 flex items-center justify-between px-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">{user?.role} menu</p>
          <button type="button" aria-label="Close side navigation" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-800 md:hidden">Close</button>
        </div>
        <nav className="space-y-1">
          {links.map(([label, path]) => (
            <NavLink
              key={label}
              to={path}
              end={path.endsWith('/dashboard')}
              onClick={onClose}
              className={({ isActive }) => `block rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 ${
                isActive ? 'bg-indigo-100 text-indigo-900' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {t(`nav.${linkTranslationKeys[label] || label}`)}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
