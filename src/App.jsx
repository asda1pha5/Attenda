import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import EventEditor from './pages/EventEditor';
import PublicEvent from './pages/PublicEvent';
import ProtectedRoute from './components/ProtectedRoute';
import TopNav from './components/TopNav';
import Upgrade from './pages/Upgrade';
import Landing from './pages/Landing';
import FunnelDashboard from './pages/FunnelDashboard';
import BabyShowerLanding from './pages/BabyShowerLanding';
import Support from './pages/Support';
import ManageRsvp from './pages/ManageRsvp';

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/baby-shower-rsvp" element={<BabyShowerLanding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/help" element={<Support />} />

        <Route path="/e/:slug" element={<PublicEvent />} />
        <Route path="/rsvp/:slug/manage" element={<ManageRsvp />} />

        <Route
          path="/hub"
          element={
            <ProtectedRoute>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hub/new"
          element={
            <ProtectedRoute>
              <EventEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hub/edit/:id"
          element={
            <ProtectedRoute>
              <EventEditor />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/new"
          element={
            <ProtectedRoute requireAdmin>
              <EventEditor />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/funnel"
          element={
            <ProtectedRoute requireAdmin>
              <FunnelDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/hub" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
