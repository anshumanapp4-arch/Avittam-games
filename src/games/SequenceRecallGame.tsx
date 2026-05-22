import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];
const FREQS = [261, 329, 392, 523];

function playTone(freq: number, duration = 300) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(); osc.stop(ctx.currentTime + duration / 1000);
  } catch (e) {}
}

export default function SequenceRecallGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'showing' | 'input' | 'results'>('menu');
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSeq, setUserSeq] = useState<number[]>([]);
  const [activeBtn, setActiveBtn] = useState(-1);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [result, setResult] = useState<any>(null);
  const startTime = useRef(Date.now());

  const startGame = () => {
    setLevel(1); setLives(3); startTime.current = Date.now();
    const startLen = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
    playSequence(Array.from({ length: startLen }, () => Math.floor(Math.random() * 4)));
  };

  const playSequence = (seq: number[]) => {
    setSequence(seq); setUserSeq([]); setPhase('showing');
    let i = 0;
    const interval = setInterval(() => {
      setActiveBtn(seq[i]);
      playTone(FREQS[seq[i]]);
      setTimeout(() => setActiveBtn(-1), 400);
      i++;
      if (i >= seq.length) { clearInterval(interval); setTimeout(() => setPhase('input'), 500); }
    }, 600);
  };

  const handlePress = (btnIndex: number) => {
    if (phase !== 'input') return;
    playTone(FREQS[btnIndex], 200);
    setActiveBtn(btnIndex);
    setTimeout(() => setActiveBtn(-1), 200);
    const newUserSeq = [...userSeq, btnIndex];
    setUserSeq(newUserSeq);
    const pos = newUserSeq.length - 1;
    if (sequence[pos] !== btnIndex) {
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) finishGame(level);
      else playSequence(sequence);
    } else if (newUserSeq.length === sequence.length) {
      setLevel(l => l + 1);
      const next = [...sequence, Math.floor(Math.random() * 4)];
      setTimeout(() => playSequence(next), 800);
    }
  };

  const finishGame = async (finalLevel: number) => {
    const rawScore = Math.min(100, finalLevel * 12);
    const game = await getGameBySlug('sequence-recall');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'sequence-recall', rawScore, timeTaken: Date.now() - startTime.current,
        accuracy: Math.min(100, finalLevel * 15), difficulty,
      });
      setResult({ ...res, rawScore, level: finalLevel });
    }
    await refreshProfile(); setPhase('results');
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">🎵 Sequence Recall</h1>
        <p className="page-subtitle">Watch the sequence, then repeat it from memory</p>
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
            <div className="game-stat"><div className="game-stat-value">{sequence.length}</div><div className="game-stat-label">Sequence</div></div>
            <div className="game-stat"><div className="game-stat-value">{'❤️'.repeat(lives)}</div><div className="game-stat-label">Lives</div></div>
          </div>
          <p style={{ marginBottom: '24px', color: phase === 'showing' ? 'var(--neon-cyan)' : 'var(--gold)', fontWeight: '600' }}>
            {phase === 'showing' ? 'Watch the sequence...' : `Your turn! (${userSeq.length}/${sequence.length})`}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxWidth: '280px', width: '100%' }}>
            {COLORS.map((color, i) => (
              <div key={i} onClick={() => handlePress(i)}
                style={{
                  aspectRatio: '1', borderRadius: 'var(--radius)', background: color,
                  opacity: activeBtn === i ? 1 : 0.4, cursor: phase === 'input' ? 'pointer' : 'default',
                  transition: 'all 0.15s', transform: activeBtn === i ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: activeBtn === i ? `0 0 30px ${color}` : 'none',
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
