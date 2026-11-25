import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Register from './pages/Register';
import ProtectedRoute from './routes/ProtectedRoute';
import Unauthorized from './pages/Unauthorized';
import PatientProfile from './pages/PatientProfile';
import AdminManagement from './pages/AdminManagement';
import HealthHistory from './pages/HealthHistory';
import Alerts from './pages/Alerts';
import PatientDashboard from './pages/PatientDashboard';
import Medications from './pages/Medications';
import Appointments from './pages/Appointments';
import EmergencyContacts from './pages/EmergencyContacts';
import AdminCommunityHealthWorkers from './pages/AdminCommunityHealthWorkers';

const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const PatientDetails = lazy(() => import('./pages/PatientDetails'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminDiseases = lazy(() => import('./pages/AdminDiseases'));

const RoleRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading session...</div>;
  }

  if (!user) {
    return <Home />;
  }

  return <Navigate to={`/${user.role}/dashboard`} replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/emergency" element={<EmergencyContacts />} />
        <Route path="/alerts" element={<ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}><Alerts /></ProtectedRoute>} />
        <Route path="/admin/alerts" element={<ProtectedRoute allowedRoles={['admin']}><Alerts /></ProtectedRoute>} />
        <Route path="/admin/diseases" element={<ProtectedRoute allowedRoles={['admin']}><AdminDiseases /></ProtectedRoute>} />
        <Route path="/admin/community-health-workers" element={<ProtectedRoute allowedRoles={['admin']}><AdminCommunityHealthWorkers /></ProtectedRoute>} />
        <Route path="/appointments" element={<ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}><Appointments /></ProtectedRoute>} />
        <Route path="/medications" element={<ProtectedRoute allowedRoles={['patient']}><Medications /></ProtectedRoute>} />

        <Route
          path="/patient/dashboard"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/patient/profile" element={<ProtectedRoute allowedRoles={['patient']}><PatientProfile /></ProtectedRoute>} />
        <Route path="/health" element={<ProtectedRoute allowedRoles={['patient']}><HealthHistory /></ProtectedRoute>} />

        <Route
          path="/doctor/dashboard"
          element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <Suspense fallback={<div className="p-8 text-center text-slate-600">Loading doctor dashboard...</div>}>
                <DoctorDashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route path="/doctor/patients" element={<Navigate to="/doctor/dashboard" replace />} />
        <Route path="/doctor/patients/:id" element={<ProtectedRoute allowedRoles={['doctor']}><Suspense fallback={<div className="p-8 text-center text-slate-600">Loading patient overview...</div>}><PatientDetails /></Suspense></ProtectedRoute>} />

        <Route path="/patients/:id" element={<ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}><PatientProfile /></ProtectedRoute>} />
        <Route path="/patients/:id/health" element={<ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}><HealthHistory /></ProtectedRoute>} />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<div className="p-8 text-center text-slate-700" role="status">Loading admin dashboard...</div>}>
                <AdminDashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminManagement type="users" /></ProtectedRoute>} />
        <Route path="/admin/doctors" element={<ProtectedRoute allowedRoles={['admin']}><AdminManagement type="doctors" /></ProtectedRoute>} />
        <Route path="/admin/patients" element={<ProtectedRoute allowedRoles={['admin']}><AdminManagement type="patients" /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
