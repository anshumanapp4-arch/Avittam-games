import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

type Phase = 'menu' | 'waiting' | 'ready' | 'clicked' | 'results' | 'too-early';

export default function ReactionGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<Phase>('menu');
  const [times, setTimes] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [reactionTime, setReactionTime] = useState(0);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<any>(null);

  const maxRounds = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 7;

  const startRound = useCallback(() => {
    setPhase('waiting');
    const delay = 1000 + Math.random() * 4000;
    timerRef.current = setTimeout(() => {
      setStartTime(Date.now());
      setPhase('ready');
    }, delay);
  }, []);

  const handleClick = () => {
    if (phase === 'waiting') {
      clearTimeout(timerRef.current);
      setPhase('too-early');
    } else if (phase === 'ready') {
      const rt = Date.now() - startTime;
      setReactionTime(rt);
      setTimes(prev => [...prev, rt]);
      setPhase('clicked');
    }
  };

  const nextRound = () => {
    if (round + 1 >= maxRounds) {
      finishGame([...times]);
    } else {
      setRound(r => r + 1);
      startRound();
    }
  };

  const finishGame = async (allTimes: number[]) => {
    setSubmitting(true);
    const avgTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
    // Score: faster = higher. 100 for <150ms, 0 for >800ms
    const rawScore = Math.max(0, Math.min(100, Math.round((800 - avgTime) / 6.5)));
    const accuracy = (allTimes.filter(t => t < 400).length / allTimes.length) * 100;
    const game = await getGameBySlug('reaction-time');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'reaction-time', rawScore, timeTaken: Math.round(avgTime),
        accuracy, difficulty,
      });
      setResult({ ...res, avgTime: Math.round(avgTime), rawScore });
    }
    await refreshProfile();
    setPhase('results');
    setSubmitting(false);
  };

  const reset = () => {
    setPhase('menu'); setTimes([]); setRound(0); setResult(null);
  };

  useEffect(() => { return () => clearTimeout(timerRef.current); }, []);

  const bgColor = phase === 'waiting' ? '#dc2626' : phase === 'ready' ? '#16a34a' : phase === 'too-early' ? '#ea580c' : 'var(--bg-card)';

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">⚡ Reaction Time</h1>
        <p className="page-subtitle">Click as fast as you can when the color changes to green</p>
      </div>

      {phase === 'menu' && (
        <div className="game-area">
          <div className="difficulty-selector">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button key={d} className={`difficulty-btn ${difficulty === d ? 'active' : ''}`}
                onClick={() => setDifficulty(d)}>
                {d.charAt(0).toUpperCase() + d.slice(1)} ({d === 'easy' ? 3 : d === 'medium' ? 5 : 7} rounds)
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => { setRound(0); startRound(); }}>
            Start Game
          </button>
        </div>
      )}

      {(phase === 'waiting' || phase === 'ready' || phase === 'too-early') && (
        <div className="game-area" onClick={handleClick}
          style={{ background: bgColor, cursor: 'pointer', minHeight: '350px', transition: 'background 0.15s' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: 'white', textAlign: 'center' }}>
            {phase === 'waiting' && <><p style={{ fontSize: '2rem' }}>🔴</p><p>Wait for green...</p></>}
            {phase === 'ready' && <><p style={{ fontSize: '2rem' }}>🟢</p><p>CLICK NOW!</p></>}
            {phase === 'too-early' && (
              <>
                <p style={{ fontSize: '2rem' }}>⚠️</p>
                <p>Too early! Click to retry</p>
                <button className="btn btn-secondary" style={{ marginTop: '16px' }}
                  onClick={(e) => { e.stopPropagation(); startRound(); }}>Retry Round</button>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'clicked' && (
        <div className="game-area">
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Round {round + 1} / {maxRounds}
          </p>
          <div className="results-score">{reactionTime}ms</div>
          <p style={{ color: reactionTime < 250 ? 'var(--success)' : reactionTime < 400 ? 'var(--gold)' : 'var(--danger)' }}>
            {reactionTime < 200 ? 'Incredible!' : reactionTime < 300 ? 'Great!' : reactionTime < 400 ? 'Good' : 'Keep practicing'}
          </p>
          <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={nextRound}>
            {round + 1 >= maxRounds ? (submitting ? 'Calculating...' : 'See Results') : 'Next Round'}
          </button>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>Game Complete!</h2>
          <div className="results-score">+{result.final_score} pts</div>
          <div className="results-details">
            <div className="game-stat"><div className="game-stat-value">{result.avgTime}ms</div><div className="game-stat-label">Avg Time</div></div>
            <div className="game-stat"><div className="game-stat-value">{result.rawScore}</div><div className="game-stat-label">Raw Score</div></div>
            <div className="game-stat"><div className="game-stat-value">{Math.round((result.fatigue_multiplier || 1) * 100)}%</div><div className="game-stat-label">Multiplier</div></div>
          </div>
          <div className="results-actions">
            <button className="btn btn-primary" onClick={reset}>Play Again</button>
            <button className="btn btn-secondary" onClick={() => navigate('/games')}>All Games</button>
          </div>
        </div>
      )}
    </div>
  );
}
