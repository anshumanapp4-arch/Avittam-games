import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div>
      <section className="landing-hero">
        <h1 className="landing-title">
          Train Your <span>Brain</span><br />
          Compete <span>Globally</span>
        </h1>
        <p className="landing-desc">
          Sharpen your cognitive skills through scientifically designed games.
          Track your progress, climb the leaderboard, and earn rewards.
        </p>
        <div style={{ display: 'flex', gap: '16px', position: 'relative' }}>
          <Link to="/signup" className="btn btn-primary btn-lg">Get Started Free</Link>
          <Link to="/login" className="btn btn-secondary btn-lg">Sign In</Link>
        </div>
      </section>

      <section className="landing-features">
        {[
          { icon: '🧠', title: 'Cognitive Training', desc: '7+ scientifically designed games targeting reaction speed, memory, math, vocabulary and more.' },
          { icon: '🏆', title: 'Global Competition', desc: 'Compete on real-time leaderboards. See how you rank globally and by skill category.' },
          { icon: '📊', title: 'Deep Analytics', desc: 'Track every aspect of your cognitive performance with beautiful charts and insights.' },
          { icon: '⚡', title: 'Skill Tracking', desc: '11 cognitive skills tracked across all games. Watch yourself improve over time.' },
          { icon: '🎁', title: 'Earn Rewards', desc: 'Reach 10,000 points to unlock exclusive Avittam Gift Cards.' },
          { icon: '🔥', title: 'Daily Streaks', desc: 'Build consistent habits with streak tracking and daily challenges.' },
        ].map((f, i) => (
          <div key={i} className="card card-3d feature-card">
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <section style={{ textAlign: 'center', padding: '60px 20px', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '16px' }}>
          Ready to train your brain?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Join thousands of players improving their cognitive skills every day.
        </p>
        <Link to="/signup" className="btn btn-primary btn-lg">Start Training Now</Link>
      </section>
    </div>
  );
}
