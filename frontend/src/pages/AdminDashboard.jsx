import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Chart from '../components/Chart';
import EmptyState from '../components/EmptyState';
import Loader from '../components/Loader';
import api from '../services/api';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [appointmentCount, setAppointmentCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const retryDashboard = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get('/dashboard/admin'),
      api.get('/doctors'),
      api.get('/appointments'),
    ])
      .then(([dashboardResponse, doctorResponse, appointmentResponse]) => {
        if (!mounted) return;
        setData(dashboardResponse.data.data);
        setDoctors(doctorResponse.data.data.doctors);
        setAppointmentCount(appointmentResponse.data.data.appointments.length);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load the admin dashboard.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [refreshKey]);

  if (loading && !data) return <Loader label="Loading admin dashboard..." />;

  if (error && !data) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
          <p className="font-semibold text-red-900">{error}</p>
          <button type="button" onClick={retryDashboard} className="mt-3 rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900">Retry</button>
        </section>
      </main>
    );
  }

  const criticalAlerts = (data?.alerts.bySeverity || [])
    .find(({ severity }) => severity === 'critical')?.count || 0;
  const statCards = [
    { label: 'Appointments', value: appointmentCount ?? 0, icon: 'calendar', tone: 'blue' },
    { label: 'Patient accounts', value: data?.usersByRole.patient || 0, icon: 'patients', tone: 'violet' },
    { label: 'Critical alerts', value: criticalAlerts, icon: 'alerts', tone: 'rose' },
    { label: 'Care providers', value: doctors.length, icon: 'providers', tone: 'green' },
  ];
  const statusData = (data?.alerts.byStatus || []).map(({ status, count }) => ({ status, value: count }));
  const totalPatients = (data?.patientsPerDoctor || []).reduce((total, item) => total + item.patientCount, 0);
  const assignedPatients = (data?.patientsPerDoctor || [])
    .filter((item) => item.doctorName !== 'Unassigned')
    .reduce((total, item) => total + item.patientCount, 0);
  const assignmentPercent = totalPatients ? Math.round((assignedPatients / totalPatients) * 100) : 0;
  const alertTotal = (data?.alerts.byStatus || []).reduce((total, item) => total + item.count, 0);

  return (
    <main className="admin-dashboard min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="admin-dashboard-inner">
        <header className="admin-dashboard-header">
          <div>
            <p className="admin-dashboard-eyebrow">CAREHUB · ADMIN OVERVIEW</p>
            <h1>Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
            <p className="admin-dashboard-subtitle">Here’s what’s happening across your care network.</p>
          </div>
          <div className="admin-dashboard-actions">
            <span className="admin-dashboard-date">Live overview</span>
            <Link to="/admin/alerts" className="admin-dashboard-button admin-dashboard-button-secondary">View alerts</Link>
            <Link to="/admin/doctors" className="admin-dashboard-button admin-dashboard-button-primary">Manage providers</Link>
          </div>
        </header>

        {error && <div className="admin-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={retryDashboard}>Retry</button></div>}
        {loading && data && <p className="admin-dashboard-refresh" role="status">Refreshing dashboard…</p>}

        <section aria-label="Healthcare overview" className="admin-stat-grid">
          {statCards.map(({ label, value, icon, tone }) => (
            <article className="admin-stat-card" key={label}>
              <div className={`admin-stat-icon ${tone}`} aria-hidden="true">
                {icon === 'calendar' && <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17M8 13h3m2.5 0H16M8 16h3" /></svg>}
                {icon === 'patients' && <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.4-3 2.2-4.5 5.5-4.5s5.1 1.5 5.5 4.5M16 5.5a3 3 0 0 1 0 5.8m1 3c2.2.5 3.4 2 3.6 4.7" /></svg>}
                {icon === 'alerts' && <svg viewBox="0 0 24 24"><path d="M12 3.5 21 20H3z" /><path d="M12 9v4.5m0 3h.01" /></svg>}
                {icon === 'providers' && <svg viewBox="0 0 24 24"><path d="M9 4h6a2 2 0 0 1 2 2v14H7V6a2 2 0 0 1 2-2Z" /><path d="M10 4V2.5h4V4m-2 4v6m-3-3h6" /></svg>}
              </div>
              <div className="admin-stat-copy">
                <p>{label}</p>
                <strong>{value.toLocaleString()}</strong>
                <span>{label === 'Critical alerts' ? 'Across all alert statuses' : 'Current system total'}</span>
              </div>
              <span className={`admin-stat-decoration ${tone}`} aria-hidden="true">↗</span>
            </article>
          ))}
        </section>

        <section className="admin-dashboard-content">
          <div className="admin-dashboard-main-column">
            <Chart
              title="Operational insights"
              data={data?.readingsSubmittedPerDay || []}
              dataKey="count"
              type="line"
              xKey="date"
              unit=" readings"
              emptyMessage="Daily reading activity will appear here."
            />

            <section className="admin-dashboard-panel admin-provider-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Healthcare providers</h2>
                  <p>{doctors.length} provider{doctors.length === 1 ? '' : 's'} in your network</p>
                </div>
                <Link to="/admin/doctors" className="admin-provider-action">View all <span aria-hidden="true">→</span></Link>
              </div>
              {doctors.length ? (
                <div className="admin-provider-table-wrap">
                  <table className="admin-provider-table">
                    <thead><tr><th>Provider</th><th>Specialty</th><th>Contact</th><th>Status</th></tr></thead>
                    <tbody>
                      {doctors.slice(0, 5).map((doctor) => (
                        <tr key={doctor._id}>
                          <td>
                            <span className="admin-provider-avatar" aria-hidden="true">
                              {(doctor.userId?.name || 'D').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                            <span className="admin-provider-name">{doctor.userId?.name || 'Care provider'}</span>
                          </td>
                          <td>{doctor.specialization || 'General care'}</td>
                          <td>{doctor.userId?.email || '—'}</td>
                          <td><span className={`admin-provider-status ${doctor.userId?.isActive ? 'available' : 'inactive'}`}><span />{doctor.userId?.isActive ? 'Active' : 'Inactive'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No providers yet" description="Create a doctor account to add a provider to your network." />
              )}
            </section>
          </div>

          <aside className="admin-dashboard-side-column">
            <section className="admin-dashboard-panel admin-patient-flow">
              <div className="admin-panel-heading">
                <div><h2>Patient flow</h2><p>Care team assignment</p></div>
                <Link to="/admin/patients" aria-label="View patients">↗</Link>
              </div>
              <div className="admin-flow-gauge" style={{ '--flow-percent': `${assignmentPercent}%` }} role="img" aria-label={`${assignmentPercent}% of patients have an assigned care provider`}>
                <div className="admin-flow-gauge-center">
                  <strong>{totalPatients.toLocaleString()}</strong>
                  <span>Total patients</span>
                </div>
              </div>
              <div className="admin-flow-legend">
                <div><span className="admin-flow-dot assigned" /><span>Assigned to provider</span><strong>{assignedPatients}</strong></div>
                <div><span className="admin-flow-dot unassigned" /><span>Needs assignment</span><strong>{Math.max(totalPatients - assignedPatients, 0)}</strong></div>
              </div>
              <div className="admin-flow-progress" aria-hidden="true"><span style={{ width: `${assignmentPercent}%` }} /></div>
              <p className="admin-flow-caption">{assignmentPercent}% of patient profiles are connected to a care provider.</p>
            </section>

            <section className="admin-dashboard-panel admin-alert-summary">
              <div className="admin-panel-heading">
                <div><h2>Alert overview</h2><p>{alertTotal} recorded alerts</p></div>
                <Link to="/admin/alerts" aria-label="Manage alerts">↗</Link>
              </div>
              {statusData.length ? (
                <ul>
                  {statusData.map(({ status, value }) => (
                    <li key={status}><span className={`admin-alert-dot ${status}`} /><span className="capitalize">{status}</span><strong>{value}</strong></li>
                  ))}
                </ul>
              ) : <EmptyState title="No alerts yet" description="Alert activity will appear here when alerts are created." />}
              <Link className="admin-alert-link" to="/admin/alerts">Review alerts <span aria-hidden="true">→</span></Link>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
};

export default AdminDashboard;
