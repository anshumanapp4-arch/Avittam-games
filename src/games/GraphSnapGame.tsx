import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

/* ─── Types ──────────────────────────────────────────────────────── */

type Shape = 'linearUp' | 'linearDown' | 'vShape' | 'hill' | 'valley' | 'zigzag' | 'exponential';

interface GraphData {
  points: number[];   // y-values at x = 0,1,2,...
  shape: Shape;
}

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
}

interface Round {
  graph: GraphData;
  question: Question;
}

/* ─── Graph Generation ───────────────────────────────────────────── */

function randInt(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function generateGraph(): GraphData {
  const shapes: Shape[] = ['linearUp', 'linearDown', 'vShape', 'hill', 'valley', 'zigzag', 'exponential'];
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  const n = randInt(5, 8);
  let pts: number[] = [];

  switch (shape) {
    case 'linearUp': {
      const start = randInt(1, 4);
      const slope = randInt(1, 3);
      pts = Array.from({ length: n }, (_, i) => start + slope * i);
      break;
    }
    case 'linearDown': {
      const start = randInt(12, 18);
      const slope = randInt(1, 3);
      pts = Array.from({ length: n }, (_, i) => start - slope * i);
      break;
    }
    case 'vShape': {
      const mid = Math.floor(n / 2);
      const base = randInt(1, 3);
      const depth = randInt(6, 10);
      pts = Array.from({ length: n }, (_, i) => {
        const dist = Math.abs(i - mid);
        return base + Math.round((dist / mid) * depth);
      });
      break;
    }
    case 'hill': {
      const mid = Math.floor(n / 2);
      const base = randInt(1, 3);
      const height = randInt(8, 14);
      pts = Array.from({ length: n }, (_, i) => {
        const norm = 1 - ((i - mid) / mid) ** 2;
        return base + Math.round(norm * height);
      });
      break;
    }
    case 'valley': {
      const mid = Math.floor(n / 2);
      const top = randInt(10, 16);
      const depth = randInt(6, 10);
      pts = Array.from({ length: n }, (_, i) => {
        const norm = ((i - mid) / mid) ** 2;
        return top - Math.round((1 - norm) * depth);
      });
      break;
    }
    case 'zigzag': {
      pts = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? randInt(2, 6) : randInt(10, 16)));
      break;
    }
    case 'exponential': {
      const base = randInt(1, 2);
      pts = Array.from({ length: n }, (_, i) => Math.round(base * Math.pow(1.5 + Math.random() * 0.3, i)));
      break;
    }
  }

  // Clamp values to 0-20 range for nice display
  pts = pts.map(v => Math.max(0, Math.min(20, v)));

  return { points: pts, shape };
}

/* ─── Question Generation ────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDistractors(correct: number, count: number, lo: number, hi: number): number[] {
  const set = new Set<number>([correct]);
  let attempts = 0;
  while (set.size < count + 1 && attempts < 100) {
    const d = correct + randInt(-4, 4);
    if (d >= lo && d <= hi && d !== correct) set.add(d);
    attempts++;
  }
  // fill remaining if needed
  while (set.size < count + 1) set.add(correct + set.size);
  const arr = [...set].filter(v => v !== correct);
  return arr.slice(0, count);
}

function generateQuestion(graph: GraphData, difficulty: Difficulty): Question {
  const pts = graph.points;
  const n = pts.length;
  const maxY = Math.max(...pts);
  const minY = Math.min(...pts);
  const maxXIndex = pts.indexOf(maxY);
  const overallDiff = pts[n - 1] - pts[0];
  const isLinear = graph.shape === 'linearUp' || graph.shape === 'linearDown';

  type QGen = () => Question;

  const easyQuestions: QGen[] = [
    () => {
      const increasing = overallDiff > 0;
      return {
        text: 'Is this graph increasing or decreasing overall?',
        options: ['Increasing', 'Decreasing'],
        correctIndex: increasing ? 0 : 1,
      };
    },
    () => {
      const distractors = makeDistractors(maxY, 3, minY, maxY + 4);
      const options = shuffle([maxY, ...distractors].map(String));
      return {
        text: 'What is the highest Y value?',
        options,
        correctIndex: options.indexOf(String(maxY)),
      };
    },
  ];

  const mediumQuestions: QGen[] = [
    ...easyQuestions,
    () => {
      const positive = overallDiff >= 0;
      return {
        text: 'Is the slope positive or negative?',
        options: ['Positive', 'Negative'],
        correctIndex: positive ? 0 : 1,
      };
    },
    () => {
      const distractors = makeDistractors(maxXIndex, 3, 0, n - 1);
      const options = shuffle([maxXIndex, ...distractors].map(String));
      return {
        text: 'At what X value is the maximum?',
        options,
        correctIndex: options.indexOf(String(maxXIndex)),
      };
    },
    () => {
      const xQuery = Math.min(3, n - 1);
      const yAtX = pts[xQuery];
      const threshold = 5;
      const above = yAtX >= threshold;
      return {
        text: `Is the function value at X=${xQuery} above or below ${threshold}?`,
        options: ['Above', 'Below'],
        correctIndex: above ? 0 : 1,
      };
    },
  ];

  const hardQuestions: QGen[] = [
    ...mediumQuestions,
    () => ({
      text: 'Is this a linear or curved graph?',
      options: ['Linear', 'Curved'],
      correctIndex: isLinear ? 0 : 1,
    }),
    () => {
      // estimate slope as (last - first) / (n-1) rounded to 1 decimal
      const slope = Math.round(((pts[n - 1] - pts[0]) / (n - 1)) * 10) / 10;
      const distractors = [slope + 1, slope - 1, slope + 2].filter(v => v !== slope).map(v => Math.round(v * 10) / 10);
      const options = shuffle([slope, ...distractors.slice(0, 3)].map(String));
      return {
        text: 'Estimate the average slope of this graph (rise/run):',
        options,
        correctIndex: options.indexOf(String(slope)),
      };
    },
  ];

  const pool = difficulty === 'easy' ? easyQuestions : difficulty === 'medium' ? mediumQuestions : hardQuestions;
  return pool[Math.floor(Math.random() * pool.length)]();
}

/* ─── SVG Renderer ───────────────────────────────────────────────── */

function GraphSVG({ points }: { points: number[] }) {
  const pad = { top: 20, right: 20, bottom: 30, left: 35 };
  const w = 300, h = 200;
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const maxY = Math.max(...points, 1);
  const n = points.length;

  const toX = (i: number) => pad.left + (i / (n - 1)) * plotW;
  const toY = (v: number) => pad.top + plotH - (v / maxY) * plotH;

  const polylinePoints = points.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');

  // Grid lines
  const yTicks = 5;
  const gridLines: React.ReactNode[] = [];
  for (let i = 0; i <= yTicks; i++) {
    const yVal = (maxY / yTicks) * i;
    const y = toY(yVal);
    gridLines.push(
      <line key={`gy${i}`} x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="#333" strokeWidth={0.5} />,
    );
    gridLines.push(
      <text key={`gyt${i}`} x={pad.left - 5} y={y + 3} fill="#888" fontSize="8" textAnchor="end">
        {Math.round(yVal)}
      </text>,
    );
  }

  const xLabels: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    xLabels.push(
      <text key={`xl${i}`} x={toX(i)} y={h - pad.bottom + 14} fill="#888" fontSize="8" textAnchor="middle">
        {i}
      </text>,
    );
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: 420, display: 'block', margin: '0 auto' }}>
      {/* Background */}
      <rect x={0} y={0} width={w} height={h} fill="#111" rx={6} />

      {/* Grid */}
      {gridLines}

      {/* Axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={h - pad.bottom} stroke="#555" strokeWidth={1} />
      <line x1={pad.left} y1={h - pad.bottom} x2={w - pad.right} y2={h - pad.bottom} stroke="#555" strokeWidth={1} />

      {/* X labels */}
      {xLabels}

      {/* Data line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#f0c040"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data dots */}
      {points.map((v, i) => (
        <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill="#f0c040" />
      ))}
    </svg>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

export default function GraphSnapGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');

  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [showingGraph, setShowingGraph] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const [roundNum, setRoundNum] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [result, setResult] = useState<any>(null);

  const timerRef = useRef<any>(null);
  const flashTimerRef = useRef<any>(null);
  const feedbackTimerRef = useRef<any>(null);
  const startTime = useRef(Date.now());
  const gameActive = useRef(false);

  const flashDuration = difficulty === 'easy' ? 3000 : difficulty === 'medium' ? 2000 : 1500;

  /* ── helpers ── */

  const nextRound = useCallback(() => {
    const graph = generateGraph();
    const question = generateQuestion(graph, difficulty);
    setCurrentRound({ graph, question });
    setShowingGraph(true);
    setFeedback(null);

    flashTimerRef.current = setTimeout(() => {
      setShowingGraph(false);
    }, flashDuration);
  }, [difficulty, flashDuration]);

  const startGame = () => {
    setPhase('playing');
    setRoundNum(0);
    setCorrect(0);
    setResult(null);
    gameActive.current = true;
    const t = difficulty === 'easy' ? 60 : difficulty === 'medium' ? 45 : 30;
    setTimeLeft(t);
    startTime.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // kick off first round
    const graph = generateGraph();
    const question = generateQuestion(graph, difficulty);
    setCurrentRound({ graph, question });
    setShowingGraph(true);
    flashTimerRef.current = setTimeout(() => setShowingGraph(false), flashDuration);
  };

  /* ── finish ── */

  const finishGame = useCallback(async () => {
    if (!gameActive.current) return;
    gameActive.current = false;
    clearInterval(timerRef.current);
    clearTimeout(flashTimerRef.current);
    clearTimeout(feedbackTimerRef.current);

    const totalRounds = roundNum || 1;
    const rawScore = Math.min(100, Math.round((correct / Math.max(1, totalRounds)) * 60 + Math.min(40, correct * 4)));
    const game = await getGameBySlug('graph-snap');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'graph-snap',
        rawScore,
        timeTaken: Date.now() - startTime.current,
        accuracy: (correct / Math.max(1, totalRounds)) * 100,
        difficulty,
      });
      setResult({ ...res, rawScore, correct, total: totalRounds });
    }
    await refreshProfile();
    setPhase('results');
  }, [roundNum, correct, difficulty, refreshProfile]);

  /* ── time-out trigger ── */

  useEffect(() => {
    if (timeLeft === 0 && phase === 'playing') finishGame();
  }, [timeLeft, phase, finishGame]);

  /* ── cleanup ── */

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearTimeout(flashTimerRef.current);
    clearTimeout(feedbackTimerRef.current);
  }, []);

  /* ── answer handler ── */

  const handleAnswer = (selectedIndex: number) => {
    if (!currentRound || feedback) return;
    const isCorrect = selectedIndex === currentRound.question.correctIndex;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setCorrect(c => c + 1);
    setRoundNum(r => r + 1);

    feedbackTimerRef.current = setTimeout(() => {
      if (gameActive.current) nextRound();
    }, 700);
  };

  /* ─── Render ───────────────────────────────────────────────── */

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">📈 Graph Snap</h1>
        <p className="page-subtitle">Memorise the graph, then answer the question!</p>
      </div>

      {/* ── Menu ── */}
      {phase === 'menu' && (
        <div className="game-area">
          <div className="difficulty-selector">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button
                key={d}
                className={`difficulty-btn ${difficulty === d ? 'active' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.95rem', textAlign: 'center' }}>
            {difficulty === 'easy' && '60 seconds · Simple questions · 3 s graph flash'}
            {difficulty === 'medium' && '45 seconds · Tougher questions · 2 s graph flash'}
            {difficulty === 'hard' && '30 seconds · Complex questions · 1.5 s graph flash'}
          </div>
          <button className="btn btn-primary btn-lg" onClick={startGame}>Start Game</button>
        </div>
      )}

      {/* ── Playing ── */}
      {phase === 'playing' && currentRound && (
        <div className="game-area">
          <div className="game-stats">
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: timeLeft < 10 ? 'var(--danger)' : 'var(--gold)' }}>
                {timeLeft}s
              </div>
              <div className="game-stat-label">Time Left</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{correct}</div>
              <div className="game-stat-label">Correct</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{roundNum + 1}</div>
              <div className="game-stat-label">Round</div>
            </div>
          </div>

          {/* Graph / Question area */}
          <div
            className="card"
            style={{
              padding: '20px',
              minHeight: 230,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              position: 'relative',
            }}
          >
            {showingGraph ? (
              <>
                <GraphSVG points={currentRound.graph.points} />
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Memorise this graph…
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.25rem',
                    color: 'var(--text-primary)',
                    textAlign: 'center',
                    marginBottom: 20,
                  }}
                >
                  {currentRound.question.text}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    justifyContent: 'center',
                  }}
                >
                  {currentRound.question.options.map((opt, idx) => {
                    let bg = 'var(--bg-card)';
                    let borderColor = 'var(--border)';
                    if (feedback) {
                      if (idx === currentRound.question.correctIndex) {
                        bg = 'rgba(34,197,94,0.2)';
                        borderColor = 'var(--success)';
                      } else if (feedback === 'wrong' && idx !== currentRound.question.correctIndex) {
                        // leave default
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={!!feedback}
                        onClick={() => handleAnswer(idx)}
                        style={{
                          padding: '12px 28px',
                          fontSize: '1.1rem',
                          fontFamily: 'var(--font-display)',
                          borderRadius: 8,
                          border: `2px solid ${borderColor}`,
                          background: bg,
                          color: 'var(--text-primary)',
                          cursor: feedback ? 'default' : 'pointer',
                          transition: 'all 0.15s',
                          minWidth: 100,
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {feedback && (
                  <div
                    style={{
                      marginTop: 16,
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      color: feedback === 'correct' ? 'var(--success)' : 'var(--danger)',
                    }}
                  >
                    {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong!'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>Time's Up!</h2>
          <div className="results-score">+{result.final_score} pts</div>
          <div className="results-details">
            <div className="game-stat">
              <div className="game-stat-value">
                {result.correct}/{result.total}
              </div>
              <div className="game-stat-label">Correct</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">
                {Math.round((result.correct / Math.max(1, result.total)) * 100)}%
              </div>
              <div className="game-stat-label">Accuracy</div>
            </div>
          </div>
          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Play Again
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/games')}>
              All Games
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
