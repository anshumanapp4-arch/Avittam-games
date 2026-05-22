import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

type Comparison = '>' | '<' | '=';

interface ExpressionPair {
  leftExpr: string;
  rightExpr: string;
  leftValue: number;
  rightValue: number;
  answer: Comparison;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEasyExpression(): { expr: string; value: number } {
  const ops = ['+', '-'];
  const op = ops[randInt(0, ops.length - 1)];
  let a: number, b: number, value: number;
  if (op === '+') {
    a = randInt(1, 50);
    b = randInt(1, 50);
    value = a + b;
  } else {
    a = randInt(5, 50);
    b = randInt(1, a);
    value = a - b;
  }
  return { expr: `${a} ${op === '-' ? '−' : '+'} ${b}`, value };
}

function generateMediumExpression(): { expr: string; value: number } {
  const ops = ['×', '÷'];
  const op = ops[randInt(0, ops.length - 1)];
  let a: number, b: number, value: number;
  if (op === '×') {
    a = randInt(2, 100);
    b = randInt(2, 20);
    value = a * b;
  } else {
    b = randInt(2, 12);
    value = randInt(2, 50);
    a = b * value;
  }
  return { expr: `${a} ${op} ${b}`, value };
}

function generateHardExpression(): { expr: string; value: number } {
  const type = randInt(0, 3);
  let expr: string, value: number;
  switch (type) {
    case 0: {
      const a = randInt(2, 30);
      const b = randInt(2, 20);
      const c = randInt(1, 50);
      const inner = a * b;
      const addOrSub = randInt(0, 1);
      if (addOrSub === 0) {
        value = inner + c;
        expr = `(${a} × ${b}) + ${c}`;
      } else {
        value = inner - c;
        expr = `(${a} × ${b}) − ${c}`;
      }
      break;
    }
    case 1: {
      const base = randInt(2, 20);
      value = base * base;
      const offset = randInt(0, 1);
      if (offset === 0) {
        expr = `${base}²`;
      } else {
        const adj = randInt(1, 30);
        const addOrSub = randInt(0, 1);
        if (addOrSub === 0) {
          value = base * base + adj;
          expr = `${base}² + ${adj}`;
        } else {
          value = base * base - adj;
          expr = `${base}² − ${adj}`;
        }
      }
      break;
    }
    case 2: {
      const a = randInt(10, 200);
      const b = randInt(10, 200);
      const op = randInt(0, 1);
      if (op === 0) {
        value = a + b;
        expr = `${a} + ${b}`;
      } else {
        value = a - b;
        expr = `${a} − ${b}`;
      }
      break;
    }
    default: {
      const a = randInt(2, 15);
      const b = randInt(2, 15);
      const c = randInt(2, 15);
      const d = randInt(2, 15);
      value = (a + b) * (c - Math.min(c - 1, d));
      const d2 = Math.min(c - 1, d);
      expr = `(${a} + ${b}) × (${c} − ${d2})`;
      break;
    }
  }
  return { expr, value };
}

function generatePair(difficulty: Difficulty): ExpressionPair {
  const genExpr = difficulty === 'easy' ? generateEasyExpression
    : difficulty === 'medium' ? generateMediumExpression
    : generateHardExpression;

  // Decide the relationship first to ensure balanced distribution
  const rel = randInt(0, 2); // 0 = equal, 1 = left > right, 2 = left < right
  let left = genExpr();
  let right = genExpr();

  // For equal: regenerate right until values match, or force it
  if (rel === 0) {
    // Generate right expression that evaluates to same value as left
    // Simple approach: keep left, generate right that matches
    let attempts = 0;
    while (right.value !== left.value && attempts < 20) {
      right = genExpr();
      attempts++;
    }
    if (right.value !== left.value) {
      // Force equality by creating matching expression
      if (difficulty === 'easy') {
        const diff = randInt(0, left.value);
        right = { expr: `${diff} + ${left.value - diff}`, value: left.value };
      } else if (difficulty === 'medium') {
        right = { expr: `${left.value} × 1`, value: left.value };
      } else {
        right = { expr: `${left.value} + 0`, value: left.value };
      }
    }
  }
  // For > and <, just let random generation handle it; swap if needed
  if (rel === 1 && left.value <= right.value) {
    [left, right] = [right, left];
  }
  if (rel === 2 && left.value >= right.value) {
    [left, right] = [right, left];
  }
  // If they're accidentally equal when we don't want that, nudge
  if (rel !== 0 && left.value === right.value) {
    right = genExpr();
    if (left.value === right.value) {
      // force difference
      const extra = randInt(1, 10);
      right = { expr: `${right.value + extra} + 0`, value: right.value + extra };
    }
    if (rel === 1 && left.value <= right.value) [left, right] = [right, left];
    if (rel === 2 && left.value >= right.value) [left, right] = [right, left];
  }

  const answer: Comparison = left.value > right.value ? '>' : left.value < right.value ? '<' : '=';
  return { leftExpr: left.expr, rightExpr: right.expr, leftValue: left.value, rightValue: right.value, answer };
}

export default function RapidComparisonGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  const [pair, setPair] = useState<ExpressionPair>({ leftExpr: '', rightExpr: '', leftValue: 0, rightValue: 0, answer: '=' });
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [result, setResult] = useState<any>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const timerRef = useRef<any>(null);
  const feedbackRef = useRef<any>(null);
  const startTime = useRef(Date.now());
  const roundRef = useRef(0);
  const correctRef = useRef(0);

  const startGame = () => {
    setPhase('playing');
    setRound(0); setCorrect(0);
    roundRef.current = 0; correctRef.current = 0;
    const t = difficulty === 'easy' ? 60 : difficulty === 'medium' ? 45 : 30;
    setTimeLeft(t);
    startTime.current = Date.now();
    setPair(generatePair(difficulty));
    setFeedback(null);
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

  const handleChoice = (choice: Comparison) => {
    if (feedback !== null) return; // ignore clicks during feedback
    const isCorrect = choice === pair.answer;
    const newRound = roundRef.current + 1;
    roundRef.current = newRound;
    setRound(newRound);
    if (isCorrect) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    }
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    clearTimeout(feedbackRef.current);
    feedbackRef.current = setTimeout(() => {
      setFeedback(null);
      setPair(generatePair(difficulty));
    }, 200);
  };

  const finishGame = async () => {
    clearInterval(timerRef.current);
    clearTimeout(feedbackRef.current);
    const totalRounds = roundRef.current || 1;
    const c = correctRef.current;
    const rawScore = Math.min(100, Math.round((c / Math.max(1, totalRounds)) * 60 + Math.min(40, c * 3)));
    const game = await getGameBySlug('rapid-comparison');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'rapid-comparison', rawScore, timeTaken: Date.now() - startTime.current,
        accuracy: (c / Math.max(1, totalRounds)) * 100, difficulty,
      });
      setResult({ ...res, rawScore, correct: c, total: totalRounds });
    }
    await refreshProfile();
    setPhase('results');
  };

  useEffect(() => () => { clearInterval(timerRef.current); clearTimeout(feedbackRef.current); }, []);

  const feedbackBorder = feedback === 'correct'
    ? '3px solid var(--success)'
    : feedback === 'incorrect'
    ? '3px solid var(--danger)'
    : '3px solid transparent';

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">⚖️ Rapid Comparison</h1>
        <p className="page-subtitle">Compare two expressions — which side is greater?</p>
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
            <div className="game-stat"><div className="game-stat-value">{round}</div><div className="game-stat-label">Round</div></div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px',
            margin: '28px 0', border: feedbackBorder, borderRadius: '16px', padding: '24px',
            transition: 'border-color 0.1s',
          }}>
            <div style={{
              flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)',
              fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-primary)',
              padding: '16px', minWidth: 0, wordBreak: 'break-word',
            }}>
              {pair.leftExpr}
            </div>
            <div style={{
              fontSize: '2.5rem', fontWeight: '900', color: 'var(--gold)',
              fontFamily: 'var(--font-display)', flexShrink: 0,
            }}>
              ?
            </div>
            <div style={{
              flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)',
              fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-primary)',
              padding: '16px', minWidth: 0, wordBreak: 'break-word',
            }}>
              {pair.rightExpr}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            {(['<', '=', '>'] as Comparison[]).map(c => (
              <button
                key={c}
                className="btn btn-primary btn-lg"
                onClick={() => handleChoice(c)}
                style={{
                  fontSize: '2rem', minWidth: '80px', fontWeight: '900',
                  fontFamily: 'var(--font-display)', padding: '12px 28px',
                }}
              >
                {c}
              </button>
            ))}
          </div>
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
