import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface NeonShape {
  id: string;
  type: 'circle' | 'square' | 'triangle' | 'star' | 'diamond';
  color: string;
  size: number;
  rotation: number;
  gridIndex: number; // to prevent overlaps
}

const NEON_COLORS = [
  '#00f0ff', // Cyan
  '#ff007f', // Pink
  '#00ff66', // Green
  '#ffcc00', // Gold
  '#cc00ff', // Purple
  '#ff5500', // Orange
];

const SHAPE_TYPES = ['circle', 'square', 'triangle', 'star', 'diamond'] as const;

export default function SpotChangeGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'showing' | 'transition' | 'guessing' | 'results'>('menu');
  
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [shapes, setShapes] = useState<NeonShape[]>([]);
  const [modifiedShapes, setModifiedShapes] = useState<NeonShape[]>([]);
  const [changedId, setChangedId] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [progress, setProgress] = useState(100);
  const [result, setResult] = useState<any>(null);
  
  const startTime = useRef(Date.now());
  const timerRef = useRef<any>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const generateShapes = (lvl: number) => {
    // Determine grid size and count based on difficulty/level
    const gridCols = 4;
    const gridRows = 4;
    const totalCells = gridCols * gridRows;
    
    let shapeCount = 4 + Math.floor(lvl / 2);
    if (difficulty === 'easy') shapeCount = Math.min(shapeCount, 8);
    else if (difficulty === 'medium') shapeCount = Math.min(shapeCount + 1, 11);
    else shapeCount = Math.min(shapeCount + 2, 14);

    // Pick random unique cell indices
    const cellIndices: number[] = [];
    while (cellIndices.length < shapeCount && cellIndices.length < totalCells) {
      const idx = Math.floor(Math.random() * totalCells);
      if (!cellIndices.includes(idx)) {
        cellIndices.push(idx);
      }
    }

    const generated: NeonShape[] = cellIndices.map((gridIdx, i) => {
      const type = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
      const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
      const size = 32 + Math.floor(Math.random() * 16); // 32 to 48px
      const rotation = Math.floor(Math.random() * 4) * 90; // 0, 90, 180, 270

      return {
        id: `shape-${i}`,
        type,
        color,
        size,
        rotation,
        gridIndex: gridIdx,
      };
    });

    setShapes(generated);
    setSelectedId(null);

    // Create modified version
    const changeIndex = Math.floor(Math.random() * generated.length);
    const targetShape = generated[changeIndex];
    setChangedId(targetShape.id);

    const modified = generated.map(s => {
      if (s.id !== targetShape.id) return { ...s };

      // Apply a change based on difficulty
      const changeType = Math.random();
      let color = s.color;
      let size = s.size;
      let rotation = s.rotation;
      let type = s.type;

      if (difficulty === 'easy') {
        // Obvious changes: color or type
        if (changeType < 0.5) {
          const availableColors = NEON_COLORS.filter(c => c !== s.color);
          color = availableColors[Math.floor(Math.random() * availableColors.length)];
        } else {
          const availableTypes = SHAPE_TYPES.filter(t => t !== s.type);
          type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        }
      } else if (difficulty === 'medium') {
        // Moderate changes: rotation, color, type or size
        if (changeType < 0.3) {
          rotation = (s.rotation + 90) % 360;
        } else if (changeType < 0.6) {
          const availableColors = NEON_COLORS.filter(c => c !== s.color);
          color = availableColors[Math.floor(Math.random() * availableColors.length)];
        } else if (changeType < 0.8) {
          size = s.size + (Math.random() > 0.5 ? 12 : -12);
        } else {
          const availableTypes = SHAPE_TYPES.filter(t => t !== s.type);
          type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        }
      } else {
        // Hard / Subtle changes: slight size change or slight rotation/hue shift
        if (changeType < 0.4) {
          size = s.size + (s.size > 40 ? -6 : 6); // very slight size scale
        } else if (changeType < 0.7) {
          rotation = (s.rotation + 45) % 360; // 45 deg tilt is subtler on squares/stars
        } else {
          // Color shift to another neon color that is close, or standard
          const availableColors = NEON_COLORS.filter(c => c !== s.color);
          color = availableColors[Math.floor(Math.random() * availableColors.length)];
        }
      }

      // If somehow no change was made, force a color change
      if (color === s.color && size === s.size && rotation === s.rotation && type === s.type) {
        const availableColors = NEON_COLORS.filter(c => c !== s.color);
        color = availableColors[Math.floor(Math.random() * availableColors.length)];
      }

      return {
        ...s,
        type,
        color,
        size,
        rotation,
      };
    });

    setModifiedShapes(modified);
  };

  const startGame = () => {
    setLevel(1);
    setScore(0);
    setLives(3);
    startTime.current = Date.now();
    startNewRound(1);
  };

  const startNewRound = (lvl: number) => {
    generateShapes(lvl);
    setPhase('showing');
    setProgress(100);

    const showDuration = Math.max(1500, 3500 - (lvl * 150)); // reduces as level increases
    const startShowTime = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startShowTime;
      const pct = Math.max(0, 100 - (elapsed / showDuration) * 100);
      setProgress(pct);

      if (elapsed >= showDuration) {
        clearInterval(timerRef.current);
        triggerTransition();
      }
    }, 30);
  };

  const triggerTransition = () => {
    setPhase('transition');
    setTimeout(() => {
      setPhase('guessing');
      setProgress(100);
      
      const guessDuration = 8000; // 8 seconds to spot it
      const startGuessTime = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startGuessTime;
        const pct = Math.max(0, 100 - (elapsed / guessDuration) * 100);
        setProgress(pct);

        if (elapsed >= guessDuration) {
          clearInterval(timerRef.current);
          handleTimeout();
        }
      }, 30);
    }, 800); // 800ms scan screen
  };

  const handleTimeout = () => {
    setLives(l => {
      const nextLives = l - 1;
      if (nextLives <= 0) {
        finishGame();
      } else {
        setTimeout(() => startNewRound(level), 1000);
      }
      return nextLives;
    });
  };

  const handleShapeClick = (shapeId: string) => {
    if (phase !== 'guessing' || selectedId !== null) return;
    
    setSelectedId(shapeId);
    if (timerRef.current) clearInterval(timerRef.current);

    if (shapeId === changedId) {
      // Correct!
      const gained = level * 10 + (difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15);
      setScore(s => s + gained);
      setLevel(l => l + 1);
      
      setTimeout(() => {
        startNewRound(level + 1);
      }, 1000);
    } else {
      // Incorrect!
      setLives(l => {
        const nextLives = l - 1;
        if (nextLives <= 0) {
          setTimeout(finishGame, 1000);
        } else {
          setTimeout(() => startNewRound(level), 1200);
        }
        return nextLives;
      });
    }
  };

  const finishGame = async () => {
    const rawScore = Math.min(100, Math.round(score / 1.5));
    const accuracy = score > 0 ? Math.min(100, Math.round((level / (level + (3 - lives))) * 100)) : 0;
    
    const game = await getGameBySlug('spot-change');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'spot-change',
        rawScore,
        timeTaken: Date.now() - startTime.current,
        accuracy,
        difficulty,
      });
      setResult({ ...res, rawScore, level, score });
    }
    await refreshProfile();
    setPhase('results');
  };

  // Helper to render SVG shapes
  const renderSVGShape = (shape: NeonShape, isClickable: boolean, isGuessingPhase: boolean) => {
    const { type, color, size, rotation, id } = shape;
    
    const style: React.CSSProperties = {
      width: '100%',
      height: '100%',
      transform: `rotate(${rotation}deg)`,
      transition: 'transform 0.3s ease',
      cursor: isClickable ? 'pointer' : 'default',
    };

    let strokeWidth = 3;
    let filter = 'drop-shadow(0 0 4px ' + color + ') drop-shadow(0 0 8px ' + color + ')';
    
    // Highlight if selected
    if (isGuessingPhase && selectedId === id) {
      if (id === changedId) {
        filter = 'drop-shadow(0 0 12px #00ff66) drop-shadow(0 0 20px #00ff66)';
      } else {
        filter = 'drop-shadow(0 0 12px #ff007f) drop-shadow(0 0 20px #ff007f)';
      }
    }

    return (
      <svg viewBox="0 0 60 60" style={style} onClick={() => isClickable && handleShapeClick(id)}>
        <g style={{ filter }}>
          {type === 'circle' && (
            <circle cx="30" cy="30" r={size / 2.5} fill="none" stroke={color} strokeWidth={strokeWidth} />
          )}
          {type === 'square' && (
            <rect x={30 - size / 2.5} y={30 - size / 2.5} width={size * 0.8} height={size * 0.8} rx="4" fill="none" stroke={color} strokeWidth={strokeWidth} />
          )}
          {type === 'triangle' && (
            <polygon points="30,12 14,46 46,46" fill="none" stroke={color} strokeWidth={strokeWidth} />
          )}
          {type === 'star' && (
            <polygon points="30,10 36,25 52,25 39,35 44,50 30,40 16,50 21,35 8,25 24,25" fill="none" stroke={color} strokeWidth={strokeWidth} />
          )}
          {type === 'diamond' && (
            <polygon points="30,10 48,30 30,50 12,30" fill="none" stroke={color} strokeWidth={strokeWidth} />
          )}
        </g>
      </svg>
    );
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">👁️ Spot the Change</h1>
        <p className="page-subtitle">Memorize the pattern and spot the subtle change in the shapes!</p>
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
            Start Training
          </button>
        </div>
      )}

      {(phase === 'showing' || phase === 'transition' || phase === 'guessing') && (
        <div className="game-area">
          <div className="game-stats">
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
                {lives < 3 && <span style={{ opacity: 0.3 }}>{'🖤'.repeat(3 - lives)}</span>}
              </div>
              <div className="game-stat-label">Lives</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              height: '6px',
              background: 'var(--bg-secondary)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginBottom: '20px',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: phase === 'showing' ? 'var(--neon-cyan)' : phase === 'guessing' ? 'var(--gold)' : 'transparent',
                transition: 'width 0.03s linear',
                boxShadow: `0 0 8px ${phase === 'showing' ? 'var(--neon-cyan)' : 'var(--gold)'}`,
              }}
            />
          </div>

          <p
            style={{
              marginBottom: '24px',
              fontSize: '1.1rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: phase === 'showing' ? 'var(--neon-cyan)' : phase === 'guessing' ? 'var(--gold)' : 'var(--text-muted)',
            }}
          >
            {phase === 'showing' && '👁️ Memorize the Shape Qualities...'}
            {phase === 'transition' && '⚡ Updating Reality Grid...'}
            {phase === 'guessing' && (selectedId === null ? '👉 Tap the item that changed!' : selectedId === changedId ? '🎉 EXCELLENT SPOT!' : '❌ INCORRECT!')}
          </p>

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '400px',
              aspectRatio: '1',
              background: 'radial-gradient(circle at center, #16182c, #0a0b16)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
              padding: '16px',
            }}
          >
            {/* Hologram lines background */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                backgroundSize: '100% 4px, 6px 100%',
                pointerEvents: 'none',
                opacity: 0.7,
              }}
            />

            {phase === 'transition' ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'var(--neon-cyan)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid transparent',
                    borderTopColor: 'var(--neon-cyan)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '16px',
                  }}
                />
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', textShadow: '0 0 10px var(--neon-cyan)' }}>
                  SCANNING SYSTEM...
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridTemplateRows: 'repeat(4, 1fr)',
                  gap: '12px',
                  width: '100%',
                  height: '100%',
                }}
              >
                {(phase === 'showing' ? shapes : modifiedShapes).map(shape => {
                  // Grid items position themselves into their pre-determined cells
                  const col = shape.gridIndex % 4;
                  const row = Math.floor(shape.gridIndex / 4);

                  return (
                    <div
                      key={shape.id}
                      style={{
                        gridColumnStart: col + 1,
                        gridRowStart: row + 1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                        height: '100%',
                        animation: phase === 'showing' ? 'fadeIn 0.4s ease-out' : 'none',
                      }}
                    >
                      {renderSVGShape(shape, phase === 'guessing', phase === 'guessing')}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Grid Analysis Complete
          </h2>
          <div className="results-score">+{result.final_score} pts</div>
          
          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.level}</div>
              <div className="game-stat-label">Levels Solved</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.score}</div>
              <div className="game-stat-label">Total Game Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.accuracy}%</div>
              <div className="game-stat-label">Accuracy</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Analyze Again
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/games')}>
              Cognitive Arena
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
