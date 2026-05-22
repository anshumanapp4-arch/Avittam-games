import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

interface ClaimedReward {
  milestone: number;
  coupon_code: string;
}

const MILESTONES = [
  { points: 10000, mudras: 149, desc: 'One-time session coupon' },
  { points: 15000, mudras: 249, desc: 'One-time unlimited session' },
  { points: 30000, mudras: 849, desc: '21 days plan' },
];

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const [rank, setRank] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [skillData, setSkillData] = useState<any[]>([]);
  const [pointsHistory, setPointsHistory] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<number[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<ClaimedReward[]>([]);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    const userId = user!.id;

    // Rank
    const { data: rankData } = await supabase.rpc('get_user_rank');
    setRank(rankData || 0);

    // Recent sessions
    const { data: sessions } = await supabase
      .from('game_sessions').select('*, games(name, icon)')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
    setRecentSessions(sessions || []);

    // Total games count
    const { count } = await supabase.from('game_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    setTotalGames(count || 0);

    // Skills — normalize scores so the radar chart looks meaningful
    const { data: skills } = await supabase
      .from('user_skills').select('*, skills(name, icon)')
      .eq('user_id', userId);
    const skillsList = (skills || []).map(s => ({
      name: s.skills?.name || '',
      score: Number(s.score),
    }));
    const maxSkillScore = Math.max(...skillsList.map(s => s.score), 100);
    setSkillData(skillsList.map(s => ({ ...s, fullMark: maxSkillScore })));

    // Points history (from analytics events — cumulative growth curve)
    const { data: events } = await supabase
      .from('analytics_events').select('metadata, created_at')
      .eq('user_id', userId).eq('event_type', 'game_played')
      .order('created_at', { ascending: true }).limit(100);

    let cumulative = 100; // signup bonus
    const dayMap: Record<string, number> = {};
    (events || []).forEach((e: any) => {
      cumulative += (e.metadata?.score || 0);
      const day = new Date(e.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
      dayMap[day] = cumulative;
    });
    const history = Object.entries(dayMap).map(([date, points]) => ({ date, points }));
    setPointsHistory(history.length > 0 ? history : [{ date: 'Start', points: 100 }]);

    // Heatmap (last 56 days)
    const { data: heatEvents } = await supabase
      .from('game_sessions').select('created_at')
      .eq('user_id', userId).gte('created_at', new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString());
    const dayCounts: Record<string, number> = {};
    (heatEvents || []).forEach((e: any) => {
      const d = new Date(e.created_at).toISOString().split('T')[0];
      dayCounts[d] = (dayCounts[d] || 0) + 1;
    });
    const heat: number[] = [];
    for (let i = 55; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const c = dayCounts[d] || 0;
      heat.push(c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : c <= 8 ? 3 : 4);
    }
    setHeatmapData(heat);

    // Claimed rewards
    const { data: rewards } = await supabase.from('user_rewards').select('*').eq('user_id', userId);
    setClaimedRewards(rewards || []);
  };

  const currentPoints = profile?.total_points || 0;
  const milestoneProgress = Math.min(100, (currentPoints / 30000) * 100);

  return (
    <div className="page container">
      <h1 className="page-title">📊 Dashboard</h1>
      <p className="page-subtitle">Welcome back, {profile?.name || 'Player'}!</p>

      {/* Quick Stats */}
      <div className="dashboard-grid">
        <div className="card stat-card">
          <div className="stat-card-value">{profile?.total_points?.toLocaleString() || 0}</div>
          <div className="stat-card-label">Total Points</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-value">#{rank || '—'}</div>
          <div className="stat-card-label">Global Rank</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-value">{totalGames}</div>
          <div className="stat-card-label">Games Played</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-value">🔥 {profile?.current_streak || 0}</div>
          <div className="stat-card-label">Day Streak</div>
        </div>
      </div>

      {/* Road to Greatness — Rewards Tracker */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--gold)' }}>🎁 Road to Greatness — Rewards Tracker</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentPoints.toLocaleString()} / 30,000 Pts ({milestoneProgress.toFixed(1)}%)</span>
        </div>
        <div className="milestone-bar" style={{ marginBottom: '24px' }}><div className="milestone-fill" style={{ width: `${milestoneProgress}%` }} /></div>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--gold)', marginBottom: '16px' }}>🛍️ Claimable Milestone Rewards</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {MILESTONES.map(m => {
            const claimed = claimedRewards.find(r => r.milestone === m.points);
            const unlocked = currentPoints >= m.points;

            return (
              <div
                key={m.points}
                className="card"
                style={{
                  padding: '20px',
                  borderColor: claimed ? 'var(--success)' : unlocked ? 'var(--gold)' : 'var(--border)',
                  background: claimed ? 'rgba(57,255,20,0.02)' : unlocked ? 'rgba(240,192,64,0.02)' : 'var(--bg-card)',
                  boxShadow: unlocked && !claimed ? '0 0 15px rgba(240,192,64,0.1)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--gold)' }}>
                    ✨ {m.points.toLocaleString()} Points Milestone
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: claimed ? 'rgba(57,255,20,0.12)' : unlocked ? 'rgba(240,192,64,0.12)' : 'rgba(255,255,255,0.05)',
                    color: claimed ? 'var(--success)' : unlocked ? 'var(--gold)' : 'var(--text-secondary)',
                  }}>
                    {claimed ? '✅ CLAIMED' : unlocked ? '🎁 UNLOCKED' : '🔒 LOCKED'}
                  </span>
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#fff', margin: '4px 0' }}>
                  🎫 {m.mudras} Mudras
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {m.desc}
                </p>

                {claimed ? (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(57,255,20,0.05)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--success)',
                    textAlign: 'center',
                  }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>YOUR COUPON CODE</span>
                    <strong style={{ fontFamily: 'var(--font-display)', color: 'var(--success)', letterSpacing: '2px', fontSize: '1.1rem' }}>
                      {claimed.coupon_code}
                    </strong>
                  </div>
                ) : unlocked ? (
                  <Link
                    to="/profile"
                    className="btn btn-primary"
                    style={{ width: '100%', fontSize: '0.85rem', padding: '10px', textAlign: 'center' }}
                  >
                    🎁 Go to Profile to Claim
                  </Link>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Earn {(m.points - currentPoints).toLocaleString()} more points to unlock this gift card
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="card chart-card">
          <h3>📈 Points Growth</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={pointsHistory}>
              <defs><linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0c040" stopOpacity={0.3}/><stop offset="100%" stopColor="#f0c040" stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="date" tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(240,192,64,0.2)', borderRadius: '8px', color: '#f0f0f5' }} />
              <Area type="monotone" dataKey="points" stroke="#f0c040" fill="url(#goldGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h3>🧠 Skill Radar</h3>
          {skillData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={skillData}>
                <PolarGrid stroke="rgba(240,192,64,0.15)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: '#8888aa', fontSize: 10 }} />
                <Radar dataKey="score" stroke="#f0c040" fill="rgba(240,192,64,0.2)" strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Play games to build your skill profile
            </div>
          )}
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--gold)', marginBottom: '16px' }}>🗓️ Activity (Last 8 Weeks)</h3>
        <div className="heatmap">
          {heatmapData.map((level, i) => (
            <div key={i} className={`heatmap-cell ${level > 0 ? `l${level}` : ''}`} title={`${level} games`} />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--gold)', marginBottom: '16px' }}>🕐 Recent Games</h3>
        {recentSessions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No games played yet. <Link to="/games" style={{ color: 'var(--gold)' }}>Start playing!</Link></p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentSessions.map((s: any) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{s.games?.icon}</span>
                  <span style={{ fontWeight: '500' }}>{s.games?.name}</span>
                  <span className="skill-badge">{s.difficulty}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(s.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', fontWeight: '600' }}>+{s.score}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
