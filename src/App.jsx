import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import EventEditor from './pages/EventEditor';
import PublicEvent from './pages/PublicEvent';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/hub" replace />} />
        <Route path="/login" element={<Login />} />

        <Route path="/e/:slug" element={<PublicEvent />} />

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
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/hub" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
