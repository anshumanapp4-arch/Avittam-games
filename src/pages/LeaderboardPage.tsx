import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type Tab = 'global' | 'weekly' | 'game';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('global');
  const [leaders, setLeaders] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('games').select('id, name, icon').then(({ data }) => setGames(data || []));
  }, []);

  useEffect(() => { loadLeaderboard(); }, [tab, selectedGame]);

  useEffect(() => {
    const channel = supabase.channel('leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadLeaderboard())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tab, selectedGame]);

  const loadLeaderboard = async () => {
    setLoading(true);
    if (tab === 'global') {
      const { data } = await supabase.from('profiles').select('id, name, avatar_url, total_points')
        .order('total_points', { ascending: false }).limit(100);
      setLeaders(data || []);
    } else if (tab === 'weekly') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('game_sessions').select('user_id, score, profiles(name, avatar_url)')
        .gte('created_at', weekAgo).order('score', { ascending: false }).limit(100);
      const userScores: Record<string, { name: string; total: number }> = {};
      (data || []).forEach((s: any) => {
        if (!userScores[s.user_id]) userScores[s.user_id] = { name: s.profiles?.name || 'Player', total: 0 };
        userScores[s.user_id].total += s.score;
      });
      const sorted = Object.entries(userScores).map(([id, v]) => ({ id, name: v.name, total_points: v.total }))
        .sort((a, b) => b.total_points - a.total_points).slice(0, 100);
      setLeaders(sorted);
    } else if (tab === 'game' && selectedGame) {
      const { data } = await supabase.from('game_sessions').select('user_id, score, profiles(name, avatar_url)')
        .eq('game_id', selectedGame).order('score', { ascending: false }).limit(100);
      const seen = new Set<string>();
      const unique = (data || []).filter((s: any) => {
        if (seen.has(s.user_id)) return false;
        seen.add(s.user_id); return true;
      });
      setLeaders(unique.map((s: any) => ({ id: s.user_id, name: s.profiles?.name || 'Player', total_points: s.score })));
    }
    setLoading(false);
  };

  const getRankClass = (i: number) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const getRankDisplay = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  return (
    <div className="page container">
      <h1 className="page-title">🏆 Leaderboard</h1>
      <p className="page-subtitle">See how you rank against other players</p>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="leaderboard-tabs">
          {([['global', '🌍 Global'], ['weekly', '📅 Weekly'], ['game', '🎮 By Game']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} className={`leaderboard-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{label}</button>
          ))}
        </div>
        {tab === 'game' && (
          <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)} style={{ maxWidth: '200px' }}>
            <option value="">Select Game</option>
            {games.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
          </select>
        )}
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : leaders.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No data yet</div>
        ) : (
          <table className="leaderboard-table">
            <thead><tr><th>Rank</th><th>Player</th><th style={{ textAlign: 'right' }}>{tab === 'game' ? 'Best Score' : 'Points'}</th></tr></thead>
            <tbody>
              {leaders.map((p, i) => (
                <tr key={p.id} className={p.id === user?.id ? 'leaderboard-highlight' : ''}>
                  <td className={`leaderboard-rank ${getRankClass(i)}`}>{getRankDisplay(i)}</td>
                  <td>
                    <div className="leaderboard-user">
                      <div className="navbar-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
                        {(p.name || 'P').charAt(0).toUpperCase()}
                      </div>
                      <span>{p.name || 'Player'} {p.id === user?.id ? '(You)' : ''}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', color: 'var(--gold)', fontWeight: '600' }}>
                    {p.total_points?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
