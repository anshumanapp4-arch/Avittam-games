import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

function generateGrid(difficulty: Difficulty) {
  const size = difficulty === 'easy' ? 16 : difficulty === 'medium' ? 25 : 36;
  const target = Math.floor(Math.random() * 99) + 1;
  const numbers = new Set<number>();
  numbers.add(target);
  while (numbers.size < size) numbers.add(Math.floor(Math.random() * 99) + 1);
  const arr = Array.from(numbers).sort(() => Math.random() - 0.5);
  return { numbers: arr, target, cols: Math.round(Math.sqrt(size)) };
}

export default function FindNumberGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [grid, setGrid] = useState<{ numbers: number[]; target: number; cols: number }>({ numbers: [], target: 0, cols: 4 });
  const [startTime, setStartTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [result, setResult] = useState<any>(null);

  const maxRounds = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 8 : 10;

  const startGame = () => {
    setPhase('playing'); setRound(0); setCorrect(0); setTotalTime(0);
    const g = generateGrid(difficulty);
    setGrid(g); setStartTime(Date.now());
  };

  const handleClick = async (num: number) => {
    const elapsed = Date.now() - startTime;
    setTotalTime(t => t + elapsed);
    const isCorrect = num === grid.target;
    const newCorrect = isCorrect ? correct + 1 : correct;
    if (isCorrect) setCorrect(c => c + 1);

    if (round + 1 >= maxRounds) {
      const rawScore = Math.round((newCorrect / maxRounds) * 70 + Math.min(30, 30 * (3000 / Math.max(1, (totalTime + elapsed) / maxRounds)) / 3000));
      const game = await getGameBySlug('find-number');
      if (game) {
        const res = await submitGameScore(game.id, {
          gameSlug: 'find-number', rawScore, timeTaken: totalTime + elapsed,
          accuracy: (newCorrect / maxRounds) * 100, difficulty,
        });
        setResult({ ...res, rawScore, correct: newCorrect, total: maxRounds });
      }
      await refreshProfile(); setPhase('results');
    } else {
      setRound(r => r + 1);
      const g = generateGrid(difficulty);
      setGrid(g); setStartTime(Date.now());
    }
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">🔢 Find the Number</h1>
        <p className="page-subtitle">Find the target number in the grid as fast as you can</p>
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
      {phase === 'playing' && (
        <div className="game-area">
          <div className="game-stats">
            <div className="game-stat"><div className="game-stat-value">{round + 1}/{maxRounds}</div><div className="game-stat-label">Round</div></div>
            <div className="game-stat"><div className="game-stat-value" style={{ fontSize: '1.8rem' }}>Find: {grid.target}</div><div className="game-stat-label">Target</div></div>
            <div className="game-stat"><div className="game-stat-value">{correct}</div><div className="game-stat-label">Found</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${grid.cols}, 1fr)`, gap: '8px', maxWidth: '420px', width: '100%' }}>
            {grid.numbers.map((n, i) => (
              <button key={i} onClick={() => handleClick(n)}
                style={{ padding: '14px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>Game Complete!</h2>
          <div className="results-score">+{result.final_score} pts</div>
          <div className="results-details">
            <div className="game-stat"><div className="game-stat-value">{result.correct}/{result.total}</div><div className="game-stat-label">Found</div></div>
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
