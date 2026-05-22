import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

function generateColors(difficulty: Difficulty) {
  const gridSize = difficulty === 'easy' ? 9 : difficulty === 'medium' ? 16 : 25;
  const hue = Math.floor(Math.random() * 360);
  const sat = 60 + Math.random() * 20;
  const light = 45 + Math.random() * 15;
  const diff = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 18 : 10;
  const oddIndex = Math.floor(Math.random() * gridSize);
  const baseColor = `hsl(${hue}, ${sat}%, ${light}%)`;
  const oddColor = `hsl(${hue}, ${sat}%, ${light + diff}%)`;
  const colors = Array(gridSize).fill(baseColor);
  colors[oddIndex] = oddColor;
  return { colors, oddIndex, gridSize };
}

export default function ColorMatchGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [colors, setColors] = useState<string[]>([]);
  const [oddIndex, setOddIndex] = useState(0);
  const [gridSize, setGridSize] = useState(9);
  const [startTime, setStartTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [result, setResult] = useState<any>(null);

  const maxRounds = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 8 : 12;

  const startGame = () => {
    setPhase('playing'); setRound(0); setScore(0); setCorrect(0); setTotalTime(0);
    newRound();
  };

  const newRound = () => {
    const { colors, oddIndex, gridSize } = generateColors(difficulty);
    setColors(colors); setOddIndex(oddIndex); setGridSize(gridSize);
    setStartTime(Date.now());
  };

  const handleClick = async (index: number) => {
    const elapsed = Date.now() - startTime;
    setTotalTime(t => t + elapsed);
    const isCorrect = index === oddIndex;
    if (isCorrect) {
      const timeBonus = Math.max(0, 100 - Math.floor(elapsed / 50));
      setScore(s => s + timeBonus);
      setCorrect(c => c + 1);
    }
    if (round + 1 >= maxRounds) {
      const finalCorrect = isCorrect ? correct + 1 : correct;
      const rawScore = Math.round((finalCorrect / maxRounds) * 80 + Math.min(20, score / maxRounds));
      const game = await getGameBySlug('color-match');
      if (game) {
        const res = await submitGameScore(game.id, {
          gameSlug: 'color-match', rawScore, timeTaken: totalTime + elapsed,
          accuracy: (finalCorrect / maxRounds) * 100, difficulty,
        });
        setResult({ ...res, rawScore, correct: finalCorrect, total: maxRounds });
      }
      await refreshProfile();
      setPhase('results');
    } else {
      setRound(r => r + 1);
      newRound();
    }
  };

  const cols = Math.round(Math.sqrt(gridSize));

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">🎨 Color Match</h1>
        <p className="page-subtitle">Find the tile with the different color</p>
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
            <div className="game-stat"><div className="game-stat-value">{correct}</div><div className="game-stat-label">Correct</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px', maxWidth: '400px', width: '100%' }}>
            {colors.map((color, i) => (
              <div key={i} onClick={() => handleClick(i)}
                style={{ aspectRatio: '1', borderRadius: 'var(--radius-sm)', background: color, cursor: 'pointer', transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.target as HTMLElement).style.transform = 'scale(1.05)'}
                onMouseLeave={e => (e.target as HTMLElement).style.transform = 'scale(1)'} />
            ))}
          </div>
        </div>
      )}
      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>Game Complete!</h2>
          <div className="results-score">+{result.final_score} pts</div>
          <div className="results-details">
            <div className="game-stat"><div className="game-stat-value">{result.correct}/{result.total}</div><div className="game-stat-label">Correct</div></div>
            <div className="game-stat"><div className="game-stat-value">{result.rawScore}</div><div className="game-stat-label">Raw Score</div></div>
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
