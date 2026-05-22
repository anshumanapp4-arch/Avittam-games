import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

interface ClaimedReward {
  milestone: number;
  coupon_code: string;
  claimed_at: string;
}

const DEFAULT_AVATARS = [
  { value: 'emoji:🧠', label: 'Synapse Master', icon: '🧠' },
  { value: 'emoji:🎮', label: 'Arcade Legend', icon: '🎮' },
  { value: 'emoji:🚀', label: 'Cyber Jet', icon: '🚀' },
  { value: 'emoji:👑', label: 'Cyber Royalty', icon: '👑' },
  { value: 'emoji:⚡', label: 'Speed Demon', icon: '⚡' },
  { value: 'emoji:🏆', label: 'Grand Champion', icon: '🏆' },
];

const MILESTONES = [
  { points: 10000, mudras: 149, desc: 'One-time session coupon' },
  { points: 15000, mudras: 249, desc: 'One-time unlimited session' },
  { points: 30000, mudras: 849, desc: '21 days plan' },
];

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const [rank, setRank] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [skills, setSkills] = useState<any[]>([]);
  const [bestScores, setBestScores] = useState<any[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<ClaimedReward[]>([]);

  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Claim States
  const [showReward, setShowReward] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const [dob, setDob] = useState('');
  const [claimResult, setClaimResult] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  useEffect(() => {
    if (profile) {
      setNickname(profile.name || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  const loadProfile = async () => {
    const userId = user!.id;
    const { data: rankData } = await supabase.rpc('get_user_rank');
    setRank(rankData || 0);

    const { count } = await supabase.from('game_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    setTotalGames(count || 0);

    const { data: skillData } = await supabase.from('user_skills').select('*, skills(name, icon)').eq('user_id', userId);
    setSkills((skillData || []).map(s => ({
      name: s.skills?.name || '',
      score: Number(s.score),
      games: s.games_played,
      icon: s.skills?.icon
    })));

    // Best scores per game
    const { data: games } = await supabase.from('games').select('id, name, icon');
    const bests: any[] = [];
    for (const g of games || []) {
      const { data: best } = await supabase.from('game_sessions').select('score')
        .eq('user_id', userId).eq('game_id', g.id).order('score', { ascending: false }).limit(1);
      if (best && best.length > 0) bests.push({ ...g, bestScore: best[0].score });
    }
    setBestScores(bests);

    // Fetch multiple milestone rewards claimed
    const { data: rewards } = await supabase.from('user_rewards').select('*').eq('user_id', userId);
    setClaimedRewards(rewards || []);
  };

  const handleSaveProfile = async () => {
    if (!nickname.trim()) {
      setSaveStatus({ success: false, message: 'Nickname cannot be empty' });
      return;
    }
    setSaveStatus(null);
    const { error } = await supabase
      .from('profiles')
      .update({ name: nickname.trim(), avatar_url: avatarUrl })
      .eq('id', user!.id);

    if (error) {
      setSaveStatus({ success: false, message: error.message });
    } else {
      setSaveStatus({ success: true, message: 'Profile updated successfully!' });
      await refreshProfile();
      setTimeout(() => {
        setIsEditing(false);
        setSaveStatus(null);
      }, 1000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploading(true);
      setSaveStatus(null);

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}-${Math.floor(Math.random() * 100000)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      setSaveStatus({ success: true, message: 'Image uploaded! Click Save to apply changes.' });
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message || 'Error uploading file' });
    } finally {
      setUploading(false);
    }
  };

  const handleClaim = async () => {
    if (!dob.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
      setClaimResult({ success: false, message: 'Enter DOB as DD/MM/YY' });
      return;
    }
    setClaiming(true);
    const { data, error } = await supabase.rpc('claim_reward', {
      p_dob: dob,
      p_milestone: activeMilestone,
    });

    if (error) {
      setClaimResult({ success: false, message: error.message });
    } else {
      const res = data?.[0] || data;
      setClaimResult(res);
      await loadProfile();
      await refreshProfile();
    }
    setClaiming(false);
  };

  const openClaimModal = (milestonePoints: number) => {
    setActiveMilestone(milestonePoints);
    setDob('');
    setClaimResult(null);
    setShowReward(true);
  };

  const renderAvatarContent = (url: string, size = 88) => {
    if (url && url.startsWith('emoji:')) {
      const emoji = url.split(':')[1];
      return (
        <div className="profile-avatar" style={{ width: size, height: size, fontSize: size * 0.45 }}>
          {emoji}
        </div>
      );
    }
    if (url) {
      return (
        <img
          src={url}
          alt="Avatar"
          className="profile-avatar"
          style={{ width: size, height: size, objectFit: 'cover', border: '1px solid var(--border)' }}
        />
      );
    }
    const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';
    return (
      <div className="profile-avatar" style={{ width: size, height: size, fontSize: size * 0.45 }}>
        {initial}
      </div>
    );
  };

  // Determine current active milestone progression percentage
  const currentPoints = profile?.total_points || 0;
  const maxMilestone = 30000;
  const milestoneProgress = Math.min(100, (currentPoints / maxMilestone) * 100);

  return (
    <div className="page container">
      {/* Profile Header */}
      <div className="card profile-header" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', width: '100%' }}>
          {renderAvatarContent(profile?.avatar_url || '')}
          <div className="profile-info" style={{ flex: 1, minWidth: '200px' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {profile?.name || 'Player'}
              <button 
                onClick={() => setIsEditing(!isEditing)} 
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                {isEditing ? 'Cancel Edit' : '✍️ Edit Profile'}
              </button>
            </h1>
            <p>{profile?.email}</p>
            <div className="profile-stats">
              <div className="profile-stat"><div className="profile-stat-value">{profile?.total_points?.toLocaleString()}</div><div className="profile-stat-label">Points</div></div>
              <div className="profile-stat"><div className="profile-stat-value">#{rank}</div><div className="profile-stat-label">Rank</div></div>
              <div className="profile-stat"><div className="profile-stat-value">{totalGames}</div><div className="profile-stat-label">Games</div></div>
              <div className="profile-stat"><div className="profile-stat-value">🔥 {profile?.current_streak || 0}</div><div className="profile-stat-label">Streak</div></div>
            </div>
          </div>
        </div>

        {/* Profile Editor Panel */}
        {isEditing && (
          <div className="profile-editor-drawer" style={{
            width: '100%',
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--gold)' }}>🛠️ Customize Avatar & Nickname</h3>
            
            {saveStatus && (
              <div className={`auth-error ${saveStatus.success ? 'success' : ''}`} style={{
                background: saveStatus.success ? 'rgba(57,255,20,0.1)' : 'rgba(255,64,96,0.1)',
                borderColor: saveStatus.success ? 'var(--success)' : 'var(--danger)',
                color: saveStatus.success ? 'var(--success)' : 'var(--danger)'
              }}>
                {saveStatus.message}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Nickname and Direct URL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Choose Nickname</label>
                  <input 
                    type="text" 
                    value={nickname} 
                    onChange={e => setNickname(e.target.value)} 
                    placeholder="Enter nickname"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Direct Image URL</label>
                  <input 
                    type="text" 
                    value={avatarUrl} 
                    onChange={e => setAvatarUrl(e.target.value)} 
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>

              {/* Preset Avatars & Image Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Or Select Preset Avatar</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '16px' }}>
                  {DEFAULT_AVATARS.map(av => (
                    <button
                      key={av.value}
                      onClick={() => setAvatarUrl(av.value)}
                      style={{
                        fontSize: '1.5rem',
                        padding: '8px',
                        background: avatarUrl === av.value ? 'rgba(240, 192, 64, 0.15)' : 'var(--bg-glass)',
                        border: avatarUrl === av.value ? '1px solid var(--gold)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        transition: '0.2s',
                        boxShadow: avatarUrl === av.value ? '0 0 10px rgba(240,192,64,0.3)' : 'none'
                      }}
                      title={av.label}
                    >
                      {av.icon}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Upload Avatar Image</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ width: '100%' }}
                  >
                    {uploading ? 'Uploading...' : '📁 Choose File & Upload'}
                  </button>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary"
              onClick={handleSaveProfile}
              style={{ alignSelf: 'flex-end', marginTop: '10px' }}
            >
              💾 Save Profile Changes
            </button>
          </div>
        )}
      </div>

      {/* Road to Greatness Progression */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--gold)' }}>🎁 Road to Greatness — Rewards Tracker</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentPoints.toLocaleString()} / 30,000 Pts ({milestoneProgress.toFixed(1)}%)</span>
        </div>
        <div className="milestone-bar" style={{ marginBottom: '24px' }}><div className="milestone-fill" style={{ width: `${milestoneProgress}%` }} /></div>

        {/* Milestone Gift Card Grid */}
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
                  boxShadow: unlocked && !claimed ? '0 0 15px rgba(240,192,64,0.1)' : 'none'
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
                    color: claimed ? 'var(--success)' : unlocked ? 'var(--gold)' : 'var(--text-secondary)'
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
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>YOUR COUPON CODE</span>
                    <strong style={{ fontFamily: 'var(--font-display)', color: 'var(--success)', letterSpacing: '2px', fontSize: '1.1rem' }}>
                      {claimed.coupon_code}
                    </strong>
                  </div>
                ) : unlocked ? (
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
                    onClick={() => openClaimModal(m.points)}
                  >
                    🎁 Get Coupon Code
                  </button>
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

      {/* Reward Modal */}
      {showReward && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.85)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 200,
            backdropFilter: 'blur(8px)'
          }} 
          onClick={() => setShowReward(false)}
        >
          <div className="card reward-card" style={{ maxWidth: '440px', width: '100%', margin: '20px' }} onClick={e => e.stopPropagation()}>
            <h2>🎁 Claim Milestone Reward</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.85rem' }}>
              Confirm your date of birth to unlock your unique coupon code.
            </p>
            {claimResult?.success ? (
              <>
                <p style={{ color: 'var(--success)', fontWeight: '600', marginBottom: '12px' }}>{claimResult.message}</p>
                <div className="coupon-code" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
                  {claimResult.coupon}
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ marginTop: '12px', width: '100%' }}
                  onClick={() => setShowReward(false)}
                >
                  Close Window
                </button>
              </>
            ) : (
              <>
                {claimResult?.message && (
                  <div className="auth-error" style={{ marginBottom: '12px' }}>
                    {claimResult.message}
                  </div>
                )}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', textAlign: 'left' }}>
                    Date of Birth
                  </label>
                  <input 
                    value={dob} 
                    onChange={e => setDob(e.target.value)} 
                    placeholder="DD/MM/YY" 
                    style={{ textAlign: 'center', fontSize: '1.2rem', fontFamily: 'var(--font-display)' }} 
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => setShowReward(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 2 }}
                    onClick={handleClaim} 
                    disabled={claiming}
                  >
                    {claiming ? 'Processing...' : 'Claim Coupon'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="chart-grid">
        {/* Skill Radar */}
        <div className="card chart-card">
          <h3>🧠 Cognitive Skills</h3>
          {skills.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={skills.map(s => ({ ...s, fullMark: Math.max(...skills.map(sk => sk.score), 100) }))}>
                <PolarGrid stroke="rgba(240,192,64,0.15)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: '#8888aa', fontSize: 10 }} />
                <Radar dataKey="score" stroke="#f0c040" fill="rgba(240,192,64,0.2)" strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Play games to build skills</div>
          )}
        </div>

        {/* Best Scores */}
        <div className="card chart-card">
          <h3>🏅 Best Scores</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {bestScores.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No games played yet</p>
            ) : bestScores.map(g => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                <span>{g.icon} {g.name}</span>
                <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', fontWeight: '600' }}>{g.bestScore}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skill Breakdown */}
      {skills.length > 0 && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--gold)', marginBottom: '16px' }}>📊 Skill Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {skills.map(s => (
              <div key={s.name} style={{ padding: '14px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem' }}>{s.icon} {s.name}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--gold)' }}>{Math.round(s.score)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.games} games played</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
