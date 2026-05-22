import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path ? 'active' : '';
  const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';

  const renderNavbarAvatar = () => {
    const url = profile?.avatar_url;
    if (url && url.startsWith('emoji:')) {
      const emoji = url.split(':')[1];
      return <div className="navbar-avatar" style={{ fontSize: '1.2rem' }}>{emoji}</div>;
    }
    if (url) {
      return (
        <img
          src={url}
          alt="Avatar"
          className="navbar-avatar"
          style={{ objectFit: 'cover', border: '1px solid var(--border)' }}
        />
      );
    }
    return <div className="navbar-avatar">{initial}</div>;
  };

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">AVITTAM GAMES</Link>
      <div className="navbar-links">
        <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
        <Link to="/games" className={isActive('/games')}>Games</Link>
        <Link to="/leaderboard" className={isActive('/leaderboard')}>Leaderboard</Link>
        <Link to="/profile" className={isActive('/profile')}>Profile</Link>
      </div>
      <div className="navbar-user">
        <span className="navbar-points">⚡ {profile?.total_points?.toLocaleString() || 0}</span>
        {renderNavbarAvatar()}
        <button onClick={signOut} className="btn btn-sm btn-secondary">Logout</button>
      </div>
    </nav>
  );
}
