import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface CircuitComponent {
  id: string;
  type: 'wire' | 'node' | 'processor' | 'capacitor';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  size: number;
  rotation?: number;
}

const CIRCUIT_COLORS = ['#00f0ff', '#ff007f', '#00ff66', '#ffcc00', '#cc00ff'];

export default function MicroDifferenceGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [components, setComponents] = useState<CircuitComponent[]>([]);
  const [modComponents, setModComponents] = useState<CircuitComponent[]>([]);
  const [changedComponentId, setChangedComponentId] = useState<string>('');
  const [clickFeedback, setClickFeedback] = useState<{ x: number; y: number; correct: boolean } | null>(null);
  
  const [result, setResult] = useState<any>(null);
  const startTime = useRef(Date.now());
  const roundStartTimeRef = useRef(Date.now());

  const generateCircuits = (lvl: number) => {
    // Determine complexity based on level and difficulty
    let compCount = 8 + Math.floor(lvl * 1.5);
    if (difficulty === 'easy') compCount = Math.min(compCount, 15);
    else if (difficulty === 'medium') compCount = Math.min(compCount + 4, 22);
    else compCount = Math.min(compCount + 8, 30);

    const generated: CircuitComponent[] = [];
    
    // 1. Generate processors/chips (large blocks) first to anchor the board
    const processorsCount = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    for (let i = 0; i < processorsCount; i++) {
      generated.push({
        id: `processor-${i}`,
        type: 'processor',
        x1: 25 + Math.random() * 50,
        y1: 25 + Math.random() * 50,
        x2: 0, y2: 0, // unused for box size
        color: '#cc00ff', // Cyber purple
        size: 14 + Math.random() * 8, // 14px to 22px
        rotation: Math.random() > 0.5 ? 90 : 0,
      });
    }

    // 2. Generate capacitors and nodes
    const nodeCount = Math.floor(compCount * 0.4);
    for (let i = 0; i < nodeCount; i++) {
      generated.push({
        id: `node-${i}`,
        type: Math.random() > 0.4 ? 'node' : 'capacitor',
        x1: 15 + Math.random() * 70,
        y1: 15 + Math.random() * 70,
        x2: 0, y2: 0,
        color: CIRCUIT_COLORS[Math.floor(Math.random() * CIRCUIT_COLORS.length)],
        size: 3 + Math.random() * 5, // small dot size
      });
    }

    // 3. Generate connecting wires
    const wireCount = compCount - processorsCount - nodeCount;
    for (let i = 0; i < wireCount; i++) {
      // Connect to existing nodes or random spots
      const source = generated[Math.floor(Math.random() * generated.length)];
      const x1 = source.x1;
      const y1 = source.y1;
      
      // Wire alignment: straight horizontal or vertical looks cleaner and more techy
      const horizontal = Math.random() > 0.5;
      const length = 15 + Math.random() * 30;
      const x2 = horizontal ? Math.min(95, Math.max(5, x1 + (Math.random() > 0.5 ? length : -length))) : x1;
      const y2 = horizontal ? y1 : Math.min(95, Math.max(5, y1 + (Math.random() > 0.5 ? length : -length)));

      generated.push({
        id: `wire-${i}`,
        type: 'wire',
        x1, y1, x2, y2,
        color: CIRCUIT_COLORS[Math.floor(Math.random() * CIRCUIT_COLORS.length)],
        size: 1.5 + Math.random() * 1.5, // wire stroke thickness
      });
    }

    setComponents(generated);

    // 4. Select exactly one component to modify with an EXTREMELY tiny change
    const targetIdx = Math.floor(Math.random() * generated.length);
    const target = generated[targetIdx];
    setChangedComponentId(target.id);

    const modified = generated.map(c => {
      if (c.id !== target.id) return { ...c };

      // Apply a very micro difference depending on difficulty
      let x1 = c.x1;
      let y1 = c.y1;
      let x2 = c.x2;
      let y2 = c.y2;
      let size = c.size;
      let color = c.color;


      if (difficulty === 'easy') {
        // Larger differences
        if (c.type === 'wire') {
          // Remove the wire entirely
          size = 0; 
        } else if (c.type === 'node') {
          // Relocate it noticeably
          x1 = x1 + (x1 > 50 ? -12 : 12);
        } else {
          // Change processor color
          color = '#00ff66';
        }
      } else if (difficulty === 'medium') {
        // Moderate differences
        if (c.type === 'wire') {
          // Shorten the wire
          x2 = x1 + (x2 - x1) * 0.5;
          y2 = y1 + (y2 - y1) * 0.5;
        } else if (c.type === 'node' || c.type === 'capacitor') {
          // Shift position slightly (5-8%)
          x1 = Math.min(95, Math.max(5, x1 + (Math.random() > 0.5 ? 6 : -6)));
        } else {
          // Resize chip slightly
          size = size * 0.75;
        }
      } else {
        // Hard/Pixel-level differences
        if (c.type === 'wire') {
          // Make it slightly thinner (0.5px difference)
          size = Math.max(0.5, size - 0.7);
        } else if (c.type === 'node' || c.type === 'capacitor') {
          // Ultra-micro position shift (2-3 pixels on SVG grid)
          x1 = Math.min(95, Math.max(5, x1 + (Math.random() > 0.5 ? 2.5 : -2.5)));
        } else {
          // Change the rotation slightly or size by a tiny amount
          size = size + 1.5;
        }
      }

      return { ...c, x1, y1, x2, y2, size, color };
    });

    setModComponents(modified);
    setClickFeedback(null);
    roundStartTimeRef.current = Date.now();
  };

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setClickFeedback(null);
    startTime.current = Date.now();
    setPhase('playing');
    generateCircuits(1);
  };

  const handleBoardClick = (e: React.MouseEvent<SVGSVGElement>, _boardType: 'left' | 'right') => {
    if (phase !== 'playing' || clickFeedback !== null) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    // Calculate click coordinates in percentage (0 to 100) to match SVG viewBox
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Find the target component that changed
    const target = components.find(c => c.id === changedComponentId);
    if (!target) return;

    // Check distance between click coordinates and the changed component location
    // Since coordinates are percentage, checking within 6% distance is very fair
    const targetX = target.x1;
    const targetY = target.y1;
    const distance = Math.sqrt(Math.pow(clickX - targetX, 2) + Math.pow(clickY - targetY, 2));

    const isCorrect = distance <= 8.5; // fair pixel click tolerance

    setClickFeedback({ x: clickX, y: clickY, correct: isCorrect });

    if (isCorrect) {
      const reactionTime = Date.now() - roundStartTimeRef.current;
      const points = Math.max(10, Math.round((12000 - reactionTime) / 100 * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : 2)));
      setScore(s => s + points);
      setLevel(l => l + 1);

      setTimeout(() => {
        generateCircuits(level + 1);
      }, 1000);
    } else {
      setLives(l => {
        const nextLives = l - 1;
        if (nextLives <= 0) {
          setTimeout(finishGame, 1000);
        } else {
          setTimeout(() => {
            setClickFeedback(null);
          }, 1000);
        }
        return nextLives;
      });
    }
  };

  const finishGame = async () => {
    const timeTaken = Date.now() - startTime.current;
    const accuracy = score > 0 ? Math.min(100, Math.round((level / (level + (3 - lives))) * 100)) : 0;
    const rawScore = Math.min(100, Math.round((score / 1.5) * (accuracy / 100)));

    const game = await getGameBySlug('micro-difference');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'micro-difference',
        rawScore,
        timeTaken,
        accuracy,
        difficulty,
      });
      setResult({ ...res, rawScore, level, score });
    }
    await refreshProfile();
    setPhase('results');
  };

  const renderCircuitSVG = (comps: CircuitComponent[], onClick: (e: React.MouseEvent<SVGSVGElement>) => void) => {
    return (
      <svg
        viewBox="0 0 100 100"
        style={{
          width: '100%',
          height: '100%',
          background: '#04050d',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'crosshair',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
        }}
        onClick={onClick}
      >
        {/* Dynamic Circuit Paths Grid Pattern background */}
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255, 255, 255, 0.015)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />

        {comps.map(c => {
          if (c.size === 0) return null; // Component deleted/hidden

          let filterGlow = `drop-shadow(0 0 1px ${c.color})`;

          return (
            <g key={c.id} style={{ filter: filterGlow }}>
              {c.type === 'wire' && (
                <line
                  x1={c.x1}
                  y1={c.y1}
                  x2={c.x2}
                  y2={c.y2}
                  stroke={c.color}
                  strokeWidth={c.size / 10}
                  strokeLinecap="round"
                />
              )}
              {c.type === 'node' && (
                <circle
                  cx={c.x1}
                  cy={c.y1}
                  r={c.size / 10}
                  fill={c.color}
                />
              )}
              {c.type === 'capacitor' && (
                <g transform={`translate(${c.x1}, ${c.y1})`}>
                  <circle cx="0" cy="0" r={c.size / 9} fill="none" stroke={c.color} strokeWidth="0.4" />
                  <rect x="-1" y="-0.2" width="2" height="0.4" fill={c.color} />
                </g>
              )}
              {c.type === 'processor' && (
                <rect
                  x={c.x1 - c.size / 2}
                  y={c.y1 - c.size / 2}
                  width={c.size}
                  height={c.size}
                  rx="1"
                  fill="rgba(204, 0, 255, 0.05)"
                  stroke={c.color}
                  strokeWidth="0.5"
                  transform={c.rotation ? `rotate(${c.rotation}, ${c.x1}, ${c.y1})` : undefined}
                />
              )}
            </g>
          );
        })}

        {/* User tap click feedback display */}
        {clickFeedback && (
          <circle
            cx={clickFeedback.x}
            cy={clickFeedback.y}
            r="4.5"
            fill="none"
            stroke={clickFeedback.correct ? '#00ff66' : 'var(--danger)'}
            strokeWidth="0.8"
            style={{
              animation: 'pulseFeedback 0.8s infinite',
              filter: `drop-shadow(0 0 4px ${clickFeedback.correct ? '#00ff66' : 'var(--danger)'})`,
            }}
          />
        )}
      </svg>
    );
  };

  return (
    <div className="game-container" style={{ maxWidth: '900px' }}>
      <div className="game-header">
        <h1 className="page-title">🔍 Micro Difference Hunt</h1>
        <p className="page-subtitle">Symmetrical scanning: find the single microscopic circuit discrepancy on either board!</p>
      </div>

      {phase === 'menu' && (
        <div className="game-area">
          <div className="difficulty-selector" style={{ marginBottom: '24px' }}>
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
          <button className="btn btn-primary btn-lg" onClick={startGame}>
            Initialize Symmetrical Boards
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="game-area">
          <div className="game-stats" style={{ marginBottom: '20px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{level}</div>
              <div className="game-stat-label">Level</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{score}</div>
              <div className="game-stat-label">Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--danger)' }}>
                {'❤️'.repeat(lives)}
                {lives < 3 && <span style={{ opacity: 0.25 }}>{'🖤'.repeat(3 - lives)}</span>}
              </div>
              <div className="game-stat-label">Board Health</div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              width: '100%',
              flexDirection: window.innerWidth < 650 ? 'column' : 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* Left Board (Original) */}
            <div style={{ flex: 1, width: '100%', maxWidth: '380px', aspectRatio: '1' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--neon-cyan)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                BOARD A (ORIGINAL)
              </div>
              {renderCircuitSVG(components, (e) => handleBoardClick(e, 'left'))}
            </div>

            {/* Right Board (Modified) */}
            <div style={{ flex: 1, width: '100%', maxWidth: '380px', aspectRatio: '1' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px', color: '#ff007f', fontSize: '0.9rem', fontWeight: 'bold' }}>
                BOARD B (MODIFIED)
              </div>
              {renderCircuitSVG(modComponents, (e) => handleBoardClick(e, 'right'))}
            </div>
          </div>

          {clickFeedback && (
            <p
              style={{
                marginTop: '20px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                color: clickFeedback.correct ? '#00ff66' : 'var(--danger)',
                textShadow: `0 0 6px ${clickFeedback.correct ? '#00ff66' : 'var(--danger)'}`,
              }}
            >
              {clickFeedback.correct ? '🎉 DISCREPANCY IDENTIFIED!' : '❌ CORE SIGNAL SYMMETRICAL! (MISCLICK)'}
            </p>
          )}
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Grid Auditing Completed
          </h2>
          <div className="results-score">+{result.final_score} pts</div>

          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.level}</div>
              <div className="game-stat-label">Levels Cleared</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.score}</div>
              <div className="game-stat-label">Total Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">
                {Math.round((result.level / (result.level + (3 - lives))) * 100)}%
              </div>
              <div className="game-stat-label">Symmetrical Precision</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Re-audit Boards
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/games')}>
              Cognitive Arena
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseFeedback {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
