import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface Scenario {
  description: string;
  answer: number;
  emoji: string;
}

/* ── helpers ─────────────────────────────────────────────────── */

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const fmt = (n: number) => n.toLocaleString('en-IN');

/* ── scenario generators ─────────────────────────────────────── */

function generateEasyScenario(): Scenario {
  const generators: (() => Scenario)[] = [
    () => {
      const prices = [200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000];
      const discounts = [10, 20, 25, 50];
      const price = pick(prices);
      const disc = pick(discounts);
      const answer = price - (price * disc) / 100;
      return { description: `₹${fmt(price)} with ${disc}% off`, answer, emoji: '🛒' };
    },
    () => {
      const items = ['shirt', 'book', 'bag', 'headphones', 'toy'];
      const prices = [250, 400, 500, 600, 750, 800, 1000];
      const discounts = [10, 20, 25, 50];
      const item = pick(items);
      const price = pick(prices);
      const disc = pick(discounts);
      const answer = price - (price * disc) / 100;
      return { description: `A ${item} costs ₹${fmt(price)}. What's the price after ${disc}% discount?`, answer, emoji: '🏷️' };
    },
    () => {
      const prices = [100, 200, 300, 400, 500, 600];
      const qty = randInt(2, 5);
      const price = pick(prices);
      const answer = price * qty;
      return { description: `${qty} items at ₹${fmt(price)} each. What's the total?`, answer, emoji: '🧮' };
    },
  ];
  return pick(generators)();
}

function generateMediumScenario(): Scenario {
  const generators: (() => Scenario)[] = [
    // Discount + GST
    () => {
      const prices = [400, 500, 600, 800, 1000, 1200, 1500, 2000];
      const discounts = [10, 15, 20, 25, 30];
      const gstRates = [5, 12, 18];
      const price = pick(prices);
      const disc = pick(discounts);
      const gst = pick(gstRates);
      const discounted = price - (price * disc) / 100;
      const answer = Math.round(discounted + (discounted * gst) / 100);
      return { description: `₹${fmt(price)} with ${disc}% off + ${gst}% GST on discounted price`, answer, emoji: '🧾' };
    },
    // Bill + GST
    () => {
      const bills = [250, 350, 450, 550, 650, 750, 850, 950];
      const gstRates = [5, 12, 18];
      const bill = pick(bills);
      const gst = pick(gstRates);
      const answer = Math.round(bill + (bill * gst) / 100);
      return { description: `Bill: ₹${fmt(bill)} + ${gst}% GST`, answer, emoji: '🧾' };
    },
    // Successive discounts
    () => {
      const prices = [500, 600, 800, 1000, 1200, 1500, 2000];
      const d1Options = [10, 15, 20, 25, 30];
      const d2Options = [5, 10, 15, 20];
      const price = pick(prices);
      const d1 = pick(d1Options);
      const d2 = pick(d2Options);
      const after1 = price - (price * d1) / 100;
      const answer = Math.round(after1 - (after1 * d2) / 100);
      return { description: `₹${fmt(price)} with ${d1}% off, then additional ${d2}% off`, answer, emoji: '🏷️' };
    },
    // Restaurant tip
    () => {
      const bills = [300, 400, 500, 600, 700, 800, 900, 1000];
      const tipPcts = [5, 10, 15];
      const bill = pick(bills);
      const tip = pick(tipPcts);
      const answer = Math.round(bill + (bill * tip) / 100);
      return { description: `Restaurant bill ₹${fmt(bill)} + ${tip}% tip`, answer, emoji: '🍽️' };
    },
  ];
  return pick(generators)();
}

function generateHardScenario(): Scenario {
  const generators: (() => Scenario)[] = [
    // Discount + GST + delivery
    () => {
      const prices = [1000, 1200, 1500, 1800, 2000, 2500, 3000];
      const discounts = [20, 25, 30, 35, 40];
      const gstRates = [5, 12, 18];
      const deliveryFees = [30, 40, 50, 60, 80, 99];
      const price = pick(prices);
      const disc = pick(discounts);
      const gst = pick(gstRates);
      const delivery = pick(deliveryFees);
      const discounted = price - (price * disc) / 100;
      const withGst = discounted + (discounted * gst) / 100;
      const answer = Math.round(withGst + delivery);
      return { description: `₹${fmt(price)} with ${disc}% off + ${gst}% GST on final + ₹${delivery} delivery`, answer, emoji: '📦' };
    },
    // Buy X get 1 at Y% off + GST
    () => {
      const itemPrices = [200, 250, 300, 400, 500];
      const discOnFree = [50, 100]; // 50% off or free
      const gstRates = [5, 12, 18];
      const price = pick(itemPrices);
      const freeDisc = pick(discOnFree);
      const gst = pick(gstRates);
      const qty = 3;
      const fullItems = 2;
      const discItem = price - (price * freeDisc) / 100;
      const subtotal = fullItems * price + discItem;
      const answer = Math.round(subtotal + (subtotal * gst) / 100);
      const freeLabel = freeDisc === 100 ? 'free' : `${freeDisc}% off`;
      return { description: `${qty} items at ₹${fmt(price)} each, buy ${fullItems} get 1 ${freeLabel} + ${gst}% GST`, answer, emoji: '🛍️' };
    },
    // Restaurant bill + service charge + GST
    () => {
      const bills = [800, 1000, 1200, 1500, 1800, 2000, 2500];
      const servicePcts = [5, 7, 10];
      const gstRates = [5, 18];
      const bill = pick(bills);
      const svc = pick(servicePcts);
      const gst = pick(gstRates);
      const serviceCharge = (bill * svc) / 100;
      const gstAmt = (bill * gst) / 100;
      const answer = Math.round(bill + serviceCharge + gstAmt);
      return { description: `Restaurant bill ₹${fmt(bill)} + ${svc}% service charge + ${gst}% GST on subtotal`, answer, emoji: '🍽️' };
    },
    // Successive discounts + GST
    () => {
      const prices = [1000, 1200, 1500, 2000, 2500, 3000];
      const d1Options = [20, 25, 30, 40];
      const d2Options = [5, 10, 15];
      const gstRates = [5, 12, 18];
      const price = pick(prices);
      const d1 = pick(d1Options);
      const d2 = pick(d2Options);
      const gst = pick(gstRates);
      const after1 = price - (price * d1) / 100;
      const after2 = after1 - (after1 * d2) / 100;
      const answer = Math.round(after2 + (after2 * gst) / 100);
      return { description: `₹${fmt(price)} with ${d1}% off, then ${d2}% extra off, + ${gst}% GST`, answer, emoji: '🧾' };
    },
    // Coupon + min purchase threshold
    () => {
      const prices = [1500, 2000, 2500, 3000, 3500];
      const flatOffs = [100, 150, 200, 250, 300];
      const gstRates = [5, 12, 18];
      const price = pick(prices);
      const flat = pick(flatOffs);
      const gst = pick(gstRates);
      const discounted = price - flat;
      const answer = Math.round(discounted + (discounted * gst) / 100);
      return { description: `₹${fmt(price)} with ₹${flat} coupon + ${gst}% GST on remaining`, answer, emoji: '🎟️' };
    },
  ];
  return pick(generators)();
}

function generateScenario(difficulty: Difficulty): Scenario {
  switch (difficulty) {
    case 'easy': return generateEasyScenario();
    case 'medium': return generateMediumScenario();
    case 'hard': return generateHardScenario();
  }
}

/* ── component ───────────────────────────────────────────────── */

export default function DiscountMasterGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  const [scenario, setScenario] = useState<Scenario>({ description: '', answer: 0, emoji: '🛒' });
  const [userAnswer, setUserAnswer] = useState('');
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [result, setResult] = useState<any>(null);
  const timerRef = useRef<any>(null);
  const feedbackTimer = useRef<any>(null);
  const startTime = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const startGame = () => {
    setPhase('playing');
    setRound(0);
    setCorrect(0);
    setFeedback(null);
    const t = difficulty === 'easy' ? 60 : difficulty === 'medium' ? 45 : 30;
    setTimeLeft(t);
    startTime.current = Date.now();
    setScenario(generateScenario(difficulty));
    setUserAnswer('');
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
    const parsed = parseFloat(userAnswer);
    if (isNaN(parsed)) return;

    const isCorrect = Math.abs(parsed - scenario.answer) <= 1;

    clearTimeout(feedbackTimer.current);
    setFeedback(isCorrect ? 'correct' : 'wrong');
    feedbackTimer.current = setTimeout(() => setFeedback(null), 600);

    if (isCorrect) setCorrect(c => c + 1);
    setRound(r => r + 1);
    setScenario(generateScenario(difficulty));
    setUserAnswer('');
  };

  const finishGame = async () => {
    clearInterval(timerRef.current);
    const totalRounds = round || 1;
    const rawScore = Math.min(100, Math.round((correct / Math.max(1, totalRounds)) * 60 + Math.min(40, correct * 5)));
    const game = await getGameBySlug('discount-master');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'discount-master', rawScore, timeTaken: Date.now() - startTime.current,
        accuracy: (correct / Math.max(1, totalRounds)) * 100, difficulty,
      });
      setResult({ ...res, rawScore, correct, total: totalRounds });
    }
    await refreshProfile();
    setPhase('results');
  };

  useEffect(() => () => { clearInterval(timerRef.current); clearTimeout(feedbackTimer.current); }, []);

  /* ── feedback flash style ────────────────────────────────── */
  const feedbackBorder =
    feedback === 'correct' ? '2px solid var(--success)' :
    feedback === 'wrong' ? '2px solid var(--danger)' :
    '2px solid var(--border)';

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">🏷️ Discount Master</h1>
        <p className="page-subtitle">Calculate the final price — discounts, taxes, tips & more!</p>
      </div>

      {/* ── MENU ─────────────────────────────────────────────── */}
      {phase === 'menu' && (
        <div className="game-area">
          <div className="difficulty-selector">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button key={d} className={`difficulty-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ margin: '16px 0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {difficulty === 'easy' && '60 seconds · Simple percentage discounts on round prices'}
            {difficulty === 'medium' && '45 seconds · Discounts + GST, successive discounts, tips'}
            {difficulty === 'hard' && '30 seconds · Multi-step: successive discounts, GST, delivery, combos'}
          </div>
          <button className="btn btn-primary btn-lg" onClick={startGame}>Start Game</button>
        </div>
      )}

      {/* ── PLAYING ──────────────────────────────────────────── */}
      {phase === 'playing' && (
        <div className="game-area">
          <div className="game-stats">
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: timeLeft < 10 ? 'var(--danger)' : 'var(--gold)' }}>{timeLeft}s</div>
              <div className="game-stat-label">Time Left</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{correct}</div>
              <div className="game-stat-label">Correct</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{round}</div>
              <div className="game-stat-label">Round</div>
            </div>
          </div>

          {/* scenario card */}
          <div
            className="card"
            style={{
              padding: '28px 24px',
              margin: '20px auto',
              maxWidth: '520px',
              border: feedbackBorder,
              transition: 'border-color 0.25s ease',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>{scenario.emoji}</div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
            }}>
              {scenario.description}
            </div>
            <div style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              What's the final amount?
            </div>
          </div>

          {/* answer input */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.4rem', color: 'var(--gold)', fontWeight: 700 }}>₹</span>
            <input
              ref={inputRef}
              type="number"
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              style={{
                maxWidth: '180px',
                fontSize: '1.4rem',
                textAlign: 'center',
                fontFamily: 'var(--font-display)',
              }}
              autoFocus
              placeholder="?"
            />
            <button type="submit" className="btn btn-primary">Submit</button>
          </form>

          {feedback && (
            <div style={{
              marginTop: '12px',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: feedback === 'correct' ? 'var(--success)' : 'var(--danger)',
            }}>
              {feedback === 'correct' ? '✓ Correct!' : `✗ Answer: ₹${fmt(scenario.answer)}`}
            </div>
          )}
        </div>
      )}

      {/* ── RESULTS ──────────────────────────────────────────── */}
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
