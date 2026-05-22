import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import GameListPage from './pages/GameListPage';
import GamePlayPage from './pages/GamePlayPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import './index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (user) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/games" element={<ProtectedRoute><GameListPage /></ProtectedRoute>} />
        <Route path="/play/:slug" element={<ProtectedRoute><GamePlayPage /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
