import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

export default function PatternMemoryGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'showing' | 'input' | 'results'>('menu');
  const [gridSize] = useState(16);
  const [pattern, setPattern] = useState<number[]>([]);
  const [userPattern, setUserPattern] = useState<number[]>([]);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [showingIndex, setShowingIndex] = useState(-1);
  const [result, setResult] = useState<any>(null);
  const startTime = useRef(Date.now());



  const startGame = () => {
    setLevel(1); setScore(0); setLives(3);
    startTime.current = Date.now();
    showPattern(1);
  };

  const showPattern = (lvl: number) => {
    const len = (difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5) + lvl - 1;
    const cells: number[] = [];
    while (cells.length < Math.min(len, gridSize)) {
      const c = Math.floor(Math.random() * gridSize);
      if (!cells.includes(c)) cells.push(c);
    }
    setPattern(cells); setUserPattern([]); setPhase('showing');
    let i = 0;
    const interval = setInterval(() => {
      setShowingIndex(cells[i]);
      setTimeout(() => setShowingIndex(-1), 500);
      i++;
      if (i >= cells.length) { clearInterval(interval); setTimeout(() => setPhase('input'), 600); }
    }, 700);
  };

  const handleCellClick = (index: number) => {
    if (phase !== 'input') return;
    const newUserPattern = [...userPattern, index];
    setUserPattern(newUserPattern);
    if (pattern.includes(index)) {
      if (newUserPattern.filter(i => pattern.includes(i)).length === pattern.length) {
        setScore(s => s + pattern.length * 10);
        setLevel(l => l + 1);
        setTimeout(() => showPattern(level + 1), 500);
      }
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) finishGame();
      else setTimeout(() => showPattern(level), 500);
    }
  };

  const finishGame = async () => {
    const rawScore = Math.min(100, Math.round(score / 2));
    const accuracy = score > 0 ? Math.min(100, (level / (level + (3 - lives))) * 100) : 0;
    const game = await getGameBySlug('pattern-memory');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'pattern-memory', rawScore, timeTaken: Date.now() - startTime.current,
        accuracy, difficulty,
      });
      setResult({ ...res, rawScore, level, score });
    }
    await refreshProfile(); setPhase('results');
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">🧩 Pattern Memory</h1>
        <p className="page-subtitle">Memorize the pattern and click the highlighted cells</p>
      </div>
      {phase === 'menu' && (
        <div className="game-area">
          <div className="difficulty-selector">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button key={d} className={`difficulty-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={startGame}>Start Game</button>
        </div>
      )}
      {(phase === 'showing' || phase === 'input') && (
        <div className="game-area">
          <div className="game-stats">
            <div className="game-stat"><div className="game-stat-value">{level}</div><div className="game-stat-label">Level</div></div>
            <div className="game-stat"><div className="game-stat-value">{score}</div><div className="game-stat-label">Score</div></div>
            <div className="game-stat"><div className="game-stat-value">{'❤️'.repeat(lives)}</div><div className="game-stat-label">Lives</div></div>
          </div>
          <p style={{ marginBottom: '16px', color: phase === 'showing' ? 'var(--neon-cyan)' : 'var(--gold)', fontWeight: '600' }}>
            {phase === 'showing' ? 'Watch the pattern...' : 'Now reproduce it!'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxWidth: '320px', width: '100%' }}>
            {Array.from({ length: gridSize }).map((_, i) => (
              <div key={i} onClick={() => handleCellClick(i)}
                style={{
                  aspectRatio: '1', borderRadius: 'var(--radius-xs)', cursor: phase === 'input' ? 'pointer' : 'default',
                  background: showingIndex === i ? 'var(--gold)' : userPattern.includes(i) && pattern.includes(i) ? 'var(--success)' : userPattern.includes(i) ? 'var(--danger)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)', transition: 'all 0.2s',
                }} />
            ))}
          </div>
        </div>
      )}
      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>Game Complete!</h2>
          <div className="results-score">+{result.final_score} pts</div>
          <div className="results-details">
            <div className="game-stat"><div className="game-stat-value">{result.level}</div><div className="game-stat-label">Level Reached</div></div>
            <div className="game-stat"><div className="game-stat-value">{result.score}</div><div className="game-stat-label">Game Score</div></div>
          </div>
          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>Play Again</button>
            <button className="btn btn-secondary" onClick={() => navigate('/games')}>All Games</button>
          </div>
        </div>
      )}
    </div>
  );
}
