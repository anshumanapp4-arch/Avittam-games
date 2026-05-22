import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllGames } from '../lib/gameEngine';

export default function GameListPage() {
  const [games, setGames] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();

  useEffect(() => { getAllGames().then(setGames); }, []);

  const categories = ['All', ...new Set(games.map(g => g.category))];
  const filtered = filter === 'All' ? games : games.filter(g => g.category === filter);

  return (
    <div className="page container">
      <h1 className="page-title">🎮 Games Arena</h1>
      <p className="page-subtitle">Choose a game and start training your brain</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {categories.map(c => (
          <button key={c} className={`difficulty-btn ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="games-grid">
        {filtered.map(game => (
          <div key={game.id} className="card card-3d game-card" onClick={() => navigate(`/play/${game.slug}`)}>
            <div className="game-card-header">
              <div className="game-card-icon">{game.icon}</div>
              <div>
                <div className="game-card-title">{game.name}</div>
                <div className="game-card-category">{game.category}</div>
              </div>
            </div>
            <div className="game-card-desc">{game.description}</div>
            <div className="game-card-tags">
              {game.skill_tags?.map((t: string) => (
                <span key={t} className="skill-badge">{t.replace(/-/g, ' ')}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
