import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import KdpLayout from './components/KdpLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Campaigns from './pages/Campaigns';
import Logs from './pages/Logs';
import Help from './pages/Help';
import KdpDashboard from './pages/kdp/KdpDashboard';
import Bookshelf from './pages/kdp/Bookshelf';
import HistoricalStats from './pages/kdp/HistoricalStats';
import BookStats from './pages/kdp/BookStats';
import CountryStats from './pages/kdp/CountryStats';
import MonthComparison from './pages/kdp/MonthComparison';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/help" element={<Help />} />

            {/* KDP Analytics Routes */}
            <Route path="/kdp" element={<KdpLayout />}>
              <Route index element={<Navigate to="/kdp/dashboard" replace />} />
              <Route path="dashboard" element={<KdpDashboard />} />
              <Route path="bookshelf" element={<Bookshelf />} />
              <Route path="analytics">
                <Route path="historical" element={<HistoricalStats />} />
                <Route path="book-stats" element={<BookStats />} />
                <Route path="country" element={<CountryStats />} />
                <Route path="month-comparison" element={<MonthComparison />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
