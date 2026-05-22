import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface Puzzle {
  numbers: number[];
  oddIndex: number;
  hint: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

function pickOddPosition() {
  return Math.floor(Math.random() * 5);
}

function makeWrong(correct: number, minDelta = 1, maxDelta = 4): number {
  let w = correct;
  while (w === correct) {
    const delta = randInt(minDelta, maxDelta) * (Math.random() < 0.5 ? 1 : -1);
    w = correct + delta;
  }
  return w;
}

// ── Pattern generators ─────────────────────────────────────────────────────

type PatternGen = () => Puzzle;

// --- EASY ---

const easyEvenNumbers: PatternGen = () => {
  const base = randInt(1, 20);
  const evens = Array.from({ length: 5 }, (_, i) => (base + i) * 2);
  const oddPos = pickOddPosition();
  evens[oddPos] = evens[oddPos] + (Math.random() < 0.5 ? 1 : -1); // make odd
  return { numbers: evens, oddIndex: oddPos, hint: 'Pattern: Even numbers' };
};

const easyMultiplesOf5: PatternGen = () => {
  const start = randInt(1, 10);
  const seq = Array.from({ length: 5 }, (_, i) => (start + i) * 5);
  const oddPos = pickOddPosition();
  seq[oddPos] = seq[oddPos] + randInt(1, 4) * (Math.random() < 0.5 ? 1 : -1);
  return { numbers: seq, oddIndex: oddPos, hint: 'Pattern: Multiples of 5' };
};

const easyMultiplesOf3: PatternGen = () => {
  const start = randInt(1, 15);
  const seq = Array.from({ length: 5 }, (_, i) => (start + i) * 3);
  const oddPos = pickOddPosition();
  seq[oddPos] = seq[oddPos] + (randInt(1, 2) * (Math.random() < 0.5 ? 1 : -1));
  return { numbers: seq, oddIndex: oddPos, hint: 'Pattern: Multiples of 3' };
};

const easyAddConstant: PatternGen = () => {
  const step = randInt(2, 6);
  const start = randInt(1, 20);
  const seq = Array.from({ length: 5 }, (_, i) => start + i * step);
  const oddPos = pickOddPosition();
  seq[oddPos] = makeWrong(seq[oddPos], 1, step - 1 || 1);
  return { numbers: seq, oddIndex: oddPos, hint: `Pattern: Adding ${step} each time` };
};

// --- MEDIUM ---

const mediumPowersOf2: PatternGen = () => {
  const startExp = randInt(0, 4);
  const seq = Array.from({ length: 5 }, (_, i) => Math.pow(2, startExp + i));
  const oddPos = pickOddPosition();
  seq[oddPos] = makeWrong(seq[oddPos], 2, 6);
  return { numbers: seq, oddIndex: oddPos, hint: 'Pattern: Powers of 2' };
};

const mediumPerfectSquares: PatternGen = () => {
  const start = randInt(1, 8);
  const seq = Array.from({ length: 5 }, (_, i) => (start + i) * (start + i));
  const oddPos = pickOddPosition();
  seq[oddPos] = makeWrong(seq[oddPos], 1, 5);
  return { numbers: seq, oddIndex: oddPos, hint: 'Pattern: Perfect squares' };
};

const mediumMultiplesOf7: PatternGen = () => {
  const start = randInt(1, 10);
  const seq = Array.from({ length: 5 }, (_, i) => (start + i) * 7);
  const oddPos = pickOddPosition();
  seq[oddPos] = seq[oddPos] + randInt(1, 5) * (Math.random() < 0.5 ? 1 : -1);
  return { numbers: seq, oddIndex: oddPos, hint: 'Pattern: Multiples of 7' };
};

const mediumPrimes: PatternGen = () => {
  const primes: number[] = [];
  let n = 2;
  while (primes.length < 30) { if (isPrime(n)) primes.push(n); n++; }
  const startIdx = randInt(0, primes.length - 5);
  const seq = primes.slice(startIdx, startIdx + 5);
  const oddPos = pickOddPosition();
  let wrong = seq[oddPos] + randInt(1, 4);
  while (isPrime(wrong)) wrong++;
  seq[oddPos] = wrong;
  return { numbers: seq, oddIndex: oddPos, hint: 'Pattern: Prime numbers' };
};

// --- HARD ---

const hardFibonacci: PatternGen = () => {
  const a = randInt(1, 5), b = randInt(1, 5);
  const seq = [a, b];
  for (let i = 2; i < 5; i++) seq.push(seq[i - 1] + seq[i - 2]);
  const oddPos = randInt(2, 4); // avoid first two which define the sequence
  seq[oddPos] = makeWrong(seq[oddPos], 1, 3);
  return { numbers: seq, oddIndex: oddPos, hint: 'Pattern: Fibonacci-like sequence' };
};

const hardCubes: PatternGen = () => {
  const start = randInt(1, 5);
  const seq = Array.from({ length: 5 }, (_, i) => Math.pow(start + i, 3));
  const oddPos = pickOddPosition();
  seq[oddPos] = makeWrong(seq[oddPos], 3, 10);
  return { numbers: seq, oddIndex: oddPos, hint: 'Pattern: Perfect cubes' };
};

const hardTriangularNumbers: PatternGen = () => {
  const start = randInt(1, 8);
  const seq = Array.from({ length: 5 }, (_, i) => {
    const n = start + i;
    return (n * (n + 1)) / 2;
  });
  const oddPos = pickOddPosition();
  seq[oddPos] = makeWrong(seq[oddPos], 1, 4);
  return { numbers: seq, oddIndex: oddPos, hint: 'Pattern: Triangular numbers' };
};

const hardAlternatingOp: PatternGen = () => {
  const base = randInt(2, 6);
  const mult = randInt(2, 3);
  const add = randInt(1, 5);
  const seq = [base];
  for (let i = 1; i < 5; i++) {
    seq.push(i % 2 === 1 ? seq[i - 1] * mult : seq[i - 1] + add);
  }
  const oddPos = randInt(1, 4);
  seq[oddPos] = makeWrong(seq[oddPos], 1, 5);
  return { numbers: seq, oddIndex: oddPos, hint: `Pattern: Alternating ×${mult} and +${add}` };
};

// ── Difficulty → generators map ────────────────────────────────────────────

const generators: Record<Difficulty, PatternGen[]> = {
  easy: [easyEvenNumbers, easyMultiplesOf5, easyMultiplesOf3, easyAddConstant],
  medium: [mediumPowersOf2, mediumPerfectSquares, mediumMultiplesOf7, mediumPrimes],
  hard: [hardFibonacci, hardCubes, hardTriangularNumbers, hardAlternatingOp],
};

function generatePuzzle(difficulty: Difficulty): Puzzle {
  const gens = generators[difficulty];
  return gens[Math.floor(Math.random() * gens.length)]();
}

// ── Component ──────────────────────────────────────────────────────────────

export default function OddOneOutGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  const [puzzle, setPuzzle] = useState<Puzzle>({ numbers: [], oddIndex: 0, hint: '' });
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [result, setResult] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ index: number; correct: boolean; hint: string } | null>(null);
  const timerRef = useRef<any>(null);
  const feedbackTimer = useRef<any>(null);
  const startTime = useRef(Date.now());

  const nextPuzzle = useCallback(() => {
    setFeedback(null);
    setPuzzle(generatePuzzle(difficulty));
  }, [difficulty]);

  const startGame = () => {
    setPhase('playing');
    setRound(0);
    setCorrect(0);
    setFeedback(null);
    const t = difficulty === 'easy' ? 60 : difficulty === 'medium' ? 45 : 30;
    setTimeLeft(t);
    startTime.current = Date.now();
    setPuzzle(generatePuzzle(difficulty));
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const finishGame = useCallback(async (finalRound: number, finalCorrect: number) => {
    clearInterval(timerRef.current);
    clearTimeout(feedbackTimer.current);
    const totalRounds = finalRound || 1;
    const rawScore = Math.min(100, Math.round((finalCorrect / Math.max(1, totalRounds)) * 60 + Math.min(40, finalCorrect * 4)));
    const game = await getGameBySlug('odd-one-out');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'odd-one-out', rawScore, timeTaken: Date.now() - startTime.current,
        accuracy: (finalCorrect / Math.max(1, totalRounds)) * 100, difficulty,
      });
      setResult({ ...res, rawScore, correct: finalCorrect, total: totalRounds });
    }
    await refreshProfile();
    setPhase('results');
  }, [difficulty, refreshProfile]);

  useEffect(() => {
    if (timeLeft === 0 && phase === 'playing') finishGame(round, correct);
  }, [timeLeft, phase]);

  useEffect(() => () => { clearInterval(timerRef.current); clearTimeout(feedbackTimer.current); }, []);

  const handlePick = (index: number) => {
    if (feedback) return; // ignore clicks during feedback
    const isCorrect = index === puzzle.oddIndex;
    const newRound = round + 1;
    const newCorrect = isCorrect ? correct + 1 : correct;
    setRound(newRound);
    if (isCorrect) setCorrect(newCorrect);
    setFeedback({ index, correct: isCorrect, hint: puzzle.hint });

    feedbackTimer.current = setTimeout(() => {
      if (timeLeft > 0) {
        nextPuzzle();
      }
    }, 900);
  };

  const cardStyle = (i: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: '90px',
      height: '90px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.6rem',
      fontWeight: 900,
      fontFamily: 'var(--font-display)',
      borderRadius: '14px',
      cursor: feedback ? 'default' : 'pointer',
      border: '2px solid var(--border)',
      background: 'var(--bg-card)',
      color: 'var(--text-primary)',
      transition: 'all 0.2s',
      userSelect: 'none',
    };
    if (feedback) {
      if (i === puzzle.oddIndex) {
        base.border = '2px solid var(--success)';
        base.background = 'rgba(16,185,129,0.15)';
        base.color = 'var(--success)';
      }
      if (i === feedback.index && !feedback.correct) {
        base.border = '2px solid var(--danger)';
        base.background = 'rgba(239,68,68,0.15)';
        base.color = 'var(--danger)';
      }
    }
    return base;
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">🔢 Odd One Out</h1>
        <p className="page-subtitle">Find the number that doesn't belong</p>
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
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 16px', fontSize: '1rem' }}>
            Tap the number that breaks the pattern
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', margin: '12px 0 20px' }}>
            {puzzle.numbers.map((n, i) => (
              <button key={i} style={cardStyle(i)} onClick={() => handlePick(i)}>
                {n}
              </button>
            ))}
          </div>
          {feedback && (
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.95rem',
              color: feedback.correct ? 'var(--success)' : 'var(--danger)',
              margin: '0',
              minHeight: '24px',
            }}>
              {feedback.correct ? '✓ Correct! ' : '✗ Wrong! '}{feedback.hint}
            </p>
          )}
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
