import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

function generateProblem(difficulty: Difficulty) {
  const ops = difficulty === 'easy' ? ['+', '-'] : difficulty === 'medium' ? ['+', '-', '*'] : ['+', '-', '*', '/'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;
  const max = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 50 : 100;
  switch (op) {
    case '+': a = Math.floor(Math.random() * max); b = Math.floor(Math.random() * max); answer = a + b; break;
    case '-': a = Math.floor(Math.random() * max); b = Math.floor(Math.random() * a); answer = a - b; break;
    case '*': a = Math.floor(Math.random() * 12) + 1; b = Math.floor(Math.random() * 12) + 1; answer = a * b; break;
    default: b = Math.floor(Math.random() * 12) + 1; answer = Math.floor(Math.random() * 12) + 1; a = b * answer; break;
  }
  return { question: `${a} ${op} ${b}`, answer };
}

export default function SpeedMathGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  const [problem, setProblem] = useState({ question: '', answer: 0 });
  const [userAnswer, setUserAnswer] = useState('');
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [result, setResult] = useState<any>(null);
  const timerRef = useRef<any>(null);
  const startTime = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const startGame = () => {
    setPhase('playing'); setRound(0); setCorrect(0);
    const t = difficulty === 'easy' ? 60 : difficulty === 'medium' ? 45 : 30;
    setTimeLeft(t); startTime.current = Date.now();
    setProblem(generateProblem(difficulty)); setUserAnswer('');
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (timeLeft === 0 && phase === 'playing') finishGame();
  }, [timeLeft, phase]);

  useEffect(() => {
    if (phase === 'playing' && inputRef.current) inputRef.current.focus();
  }, [round, phase]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isCorrect = parseInt(userAnswer) === problem.answer;
    if (isCorrect) setCorrect(c => c + 1);
    setRound(r => r + 1);
    setProblem(generateProblem(difficulty));
    setUserAnswer('');
  };

  const finishGame = async () => {
    clearInterval(timerRef.current);
    const totalRounds = round || 1;
    const rawScore = Math.min(100, Math.round((correct / Math.max(1, totalRounds)) * 60 + Math.min(40, correct * 4)));
    const game = await getGameBySlug('speed-math');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'speed-math', rawScore, timeTaken: Date.now() - startTime.current,
        accuracy: (correct / Math.max(1, totalRounds)) * 100, difficulty,
      });
      setResult({ ...res, rawScore, correct, total: totalRounds });
    }
    await refreshProfile(); setPhase('results');
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">➕ Speed Math</h1>
        <p className="page-subtitle">Solve as many problems as you can before time runs out</p>
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
            <div className="game-stat"><div className="game-stat-value" style={{ color: timeLeft < 10 ? 'var(--danger)' : 'var(--gold)' }}>{timeLeft}s</div><div className="game-stat-label">Time Left</div></div>
            <div className="game-stat"><div className="game-stat-value">{correct}</div><div className="game-stat-label">Correct</div></div>
            <div className="game-stat"><div className="game-stat-value">{round}</div><div className="game-stat-label">Attempted</div></div>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: '900', color: 'var(--text-primary)', margin: '20px 0' }}>
            {problem.question} = ?
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input ref={inputRef} type="number" value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
              style={{ maxWidth: '160px', fontSize: '1.4rem', textAlign: 'center', fontFamily: 'var(--font-display)' }}
              autoFocus placeholder="?" />
            <button type="submit" className="btn btn-primary">Submit</button>
          </form>
        </div>
      )}
      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>Time's Up!</h2>
          <div className="results-score">+{result.final_score} pts</div>
          <div className="results-details">
            <div className="game-stat"><div className="game-stat-value">{result.correct}/{result.total}</div><div className="game-stat-label">Correct</div></div>
            <div className="game-stat"><div className="game-stat-value">{Math.round((result.correct / Math.max(1, result.total)) * 100)}%</div><div className="game-stat-label">Accuracy</div></div>
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
