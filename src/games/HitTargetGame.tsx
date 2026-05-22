import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface Target {
  id: string;
  x: number; // percentage left
  y: number; // percentage top
  size: number;
  spawnTime: number;
  duration: number;
}

interface FloatingScore {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export default function HitTargetGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [targets, setTargets] = useState<Target[]>([]);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const [avgReactionTime, setAvgReactionTime] = useState(0);
  const [hitsCount, setHitsCount] = useState(0);
  const [result, setResult] = useState<any>(null);

  const reactionTimes = useRef<number[]>([]);
  const nextTargetId = useRef(0);
  const startTime = useRef(Date.now());
  const gameIntervalRef = useRef<any>(null);
  const targetCheckIntervalRef = useRef<any>(null);
  
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      stopLoops();
    };
  }, []);

  const stopLoops = () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    if (targetCheckIntervalRef.current) clearInterval(targetCheckIntervalRef.current);
  };

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setTargets([]);
    setFloatingScores([]);
    setAvgReactionTime(0);
    setHitsCount(0);
    reactionTimes.current = [];
    nextTargetId.current = 0;
    startTime.current = Date.now();
    setPhase('playing');
    
    startSpawning();
  };

  const startSpawning = () => {
    stopLoops();

    // Determine target duration and spawn rates
    let spawnRate = 1200; // ms
    if (difficulty === 'medium') spawnRate = 900;
    else if (difficulty === 'hard') spawnRate = 700;

    // Periodically spawn targets
    gameIntervalRef.current = setInterval(() => {
      spawnTarget();
    }, spawnRate);

    // Periodically check for expired targets
    targetCheckIntervalRef.current = setInterval(() => {
      checkExpiredTargets();
    }, 50);
  };

  const spawnTarget = () => {
    setTargets(prev => {
      // Limit simultaneous targets to avoid crowding
      if (prev.length >= 4) return prev;

      const size = difficulty === 'easy' ? 56 : difficulty === 'medium' ? 44 : 32;
      const duration = Math.max(
        400,
        (difficulty === 'easy' ? 1600 : difficulty === 'medium' ? 1100 : 750) - level * 25
      );

      // Keep targets slightly off the extreme edges
      const x = 10 + Math.random() * 80;
      const y = 10 + Math.random() * 80;
      const id = `target-${nextTargetId.current++}`;

      return [...prev, { id, x, y, size, spawnTime: Date.now(), duration }];
    });
  };

  const checkExpiredTargets = () => {
    const now = Date.now();
    
    setTargets(prev => {
      const active: Target[] = [];
      let missedCount = 0;

      prev.forEach(t => {
        if (now - t.spawnTime >= t.duration) {
          missedCount++;
        } else {
          active.push(t);
        }
      });

      if (missedCount > 0) {
        setLives(l => {
          const nextLives = l - missedCount;
          if (nextLives <= 0) {
            stopLoops();
            setTimeout(finishGame, 100);
          }
          return Math.max(0, nextLives);
        });
      }

      return active;
    });
  };

  const handleTargetClick = (target: Target, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const reactionTime = Date.now() - target.spawnTime;
    reactionTimes.current.push(reactionTime);
    
    // Calculate new average reaction time
    const sum = reactionTimes.current.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / reactionTimes.current.length);
    setAvgReactionTime(avg);
    setHitsCount(h => h + 1);

    // Score: faster clicks yield up to 150 points, slower yields less, base 10 points
    const pointsGained = Math.max(10, Math.round((target.duration - reactionTime) / 10 * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : 2)));
    setScore(s => s + pointsGained);

    // Create floating score
    if (areaRef.current) {
      const rect = areaRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      setFloatingScores(prev => [
        ...prev,
        {
          id: `float-${Date.now()}-${Math.random()}`,
          x: clickX,
          y: clickY,
          text: `+${pointsGained} (${reactionTime}ms)`,
          color: reactionTime < 300 ? '#00ff66' : reactionTime < 500 ? '#00f0ff' : '#ffcc00',
        },
      ]);
    }

    // Remove the hit target
    setTargets(prev => prev.filter(t => t.id !== target.id));

    // Dynamic Level Up
    setHitsCount(h => {
      const nextHits = h + 1;
      if (nextHits % 10 === 0) {
        setLevel(l => {
          const nextLvl = l + 1;
          // Spawn updates speed automatically
          return nextLvl;
        });
      }
      return h;
    });
  };

  const handleMissClick = (e: React.MouseEvent) => {
    if (phase !== 'playing') return;
    
    // Small penalty for random/missed clicks
    setScore(s => Math.max(0, s - 5));

    if (areaRef.current) {
      const rect = areaRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      setFloatingScores(prev => [
        ...prev,
        {
          id: `float-${Date.now()}-${Math.random()}`,
          x: clickX,
          y: clickY,
          text: 'MISS (-5)',
          color: 'var(--danger)',
        },
      ]);
    }
  };

  // Clean up floating scores after animation completes
  useEffect(() => {
    if (floatingScores.length === 0) return;
    const timer = setTimeout(() => {
      setFloatingScores(prev => prev.slice(1));
    }, 800);
    return () => clearTimeout(timer);
  }, [floatingScores]);

  const finishGame = async () => {
    stopLoops();
    const timeTaken = Date.now() - startTime.current;
    
    // Accuracy = hits / total targets spawned (hits + lives lost from starting)
    const misses = 3 - lives;
    const totalCount = hitsCount + misses;
    const accuracy = totalCount > 0 ? Math.round((hitsCount / totalCount) * 100) : 0;
    
    // Calculate raw cognitive score (max 100)
    // Weighted heavily on reaction speed and hits
    const speedFactor = avgReactionTime > 0 ? Math.max(10, 450 - avgReactionTime) / 4.5 : 10;
    const rawScore = Math.min(100, Math.round((hitsCount * 2.5 + speedFactor) * (accuracy / 100)));

    const game = await getGameBySlug('hit-target');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'hit-target',
        rawScore,
        timeTaken,
        accuracy,
        difficulty,
      });
      setResult({ ...res, rawScore, hitsCount, avgReactionTime, score });
    }
    await refreshProfile();
    setPhase('results');
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">🎯 Hit the Target</h1>
        <p className="page-subtitle">Tap the glowing tactical targets before they vanish. Speed is everything!</p>
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
            Initialize Radar Screen
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="game-area" style={{ position: 'relative' }}>
          <div className="game-stats" style={{ marginBottom: '16px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{score}</div>
              <div className="game-stat-label">Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--neon-cyan)' }}>
                {avgReactionTime > 0 ? `${avgReactionTime}ms` : '---'}
              </div>
              <div className="game-stat-label">Avg Speed</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--danger)' }}>
                {'❤️'.repeat(lives)}
                {lives < 3 && <span style={{ opacity: 0.25 }}>{'🖤'.repeat(3 - lives)}</span>}
              </div>
              <div className="game-stat-label">Shields</div>
            </div>
          </div>

          <div
            ref={areaRef}
            onClick={handleMissClick}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '500px',
              aspectRatio: '1.2',
              background: 'radial-gradient(circle at center, #0f1225, #04050e)',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), inset 0 0 30px rgba(0, 240, 255, 0.05)',
              overflow: 'hidden',
              cursor: 'crosshair',
            }}
          >
            {/* Grid overlay for radar look */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                pointerEvents: 'none',
              }}
            />

            {/* Circular sweep line */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '100%',
                height: '100%',
                borderRight: '1px solid rgba(0, 240, 255, 0.06)',
                borderRadius: '50%',
                transformOrigin: 'top left',
                animation: 'radar-sweep 4s linear infinite',
                pointerEvents: 'none',
              }}
            />
            <style>{`
              @keyframes radar-sweep {
                from { transform: rotate(0deg) scale(1.4) translate(-50%, -50%); }
                to { transform: rotate(360deg) scale(1.4) translate(-50%, -50%); }
              }
              @keyframes float-up {
                0% { transform: translateY(0) scale(0.9); opacity: 1; }
                100% { transform: translateY(-40px) scale(1.1); opacity: 0; }
              }
              @keyframes shrink-ring {
                from { transform: scale(1.6); opacity: 0.6; }
                to { transform: scale(1); opacity: 0.9; }
              }
            `}</style>

            {/* Floating Point Indicators */}
            {floatingScores.map(fs => (
              <div
                key={fs.id}
                style={{
                  position: 'absolute',
                  left: fs.x,
                  top: fs.y,
                  color: fs.color,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  pointerEvents: 'none',
                  textShadow: `0 0 6px ${fs.color}`,
                  transform: 'translate(-50%, -50%)',
                  animation: 'float-up 0.8s forwards ease-out',
                }}
              >
                {fs.text}
              </div>
            ))}

            {/* Spawned Targets */}
            {targets.map(t => {
              const borderNeon = '#ff007f'; // tactical warning red-pink

              return (
                <div
                  key={t.id}
                  onClick={(e) => handleTargetClick(t, e)}
                  style={{
                    position: 'absolute',
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: `${t.size}px`,
                    height: `${t.size}px`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* Outer shrinking timer ring */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      border: `1.5px solid ${borderNeon}`,
                      boxShadow: `0 0 8px ${borderNeon}`,
                      animation: `shrink-ring ${t.duration}ms linear forwards`,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Inner Target Core */}
                  <svg viewBox="0 0 40 40" style={{ width: '100%', height: '100%', filter: `drop-shadow(0 0 5px ${borderNeon})` }}>
                    <circle cx="20" cy="20" r="16" fill="rgba(255, 0, 127, 0.08)" stroke={borderNeon} strokeWidth="1.5" />
                    <circle cx="20" cy="20" r="6" fill={borderNeon} />
                    <line x1="20" y1="2" x2="20" y2="10" stroke={borderNeon} strokeWidth="2" />
                    <line x1="20" y1="30" x2="20" y2="38" stroke={borderNeon} strokeWidth="2" />
                    <line x1="2" y1="20" x2="10" y2="20" stroke={borderNeon} strokeWidth="2" />
                    <line x1="30" y1="20" x2="38" y2="20" stroke={borderNeon} strokeWidth="2" />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Combat Radar Results
          </h2>
          <div className="results-score">+{result.final_score} pts</div>

          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.hitsCount}</div>
              <div className="game-stat-label">Targets Hit</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--neon-cyan)' }}>
                {result.avgReactionTime}ms
              </div>
              <div className="game-stat-label">Avg Latency</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.accuracy}%</div>
              <div className="game-stat-label">Accuracy</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Re-initialize Grid
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
