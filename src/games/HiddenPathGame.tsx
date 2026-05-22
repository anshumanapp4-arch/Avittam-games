import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

export default function HiddenPathGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'memorizing' | 'tracing' | 'results'>('menu');
  
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gridSize, setGridSize] = useState(5); // 5x5, 6x6, 7x7
  const [path, setPath] = useState<number[]>([]);
  const [userPath, setUserPath] = useState<number[]>([]);
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  
  const [memoTimer, setMemoTimer] = useState(3.5);
  const [result, setResult] = useState<any>(null);
  
  const startTime = useRef(Date.now());
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const generateProceduralPath = (lvl: number, size: number) => {
    // Generate target path length based on level and difficulty
    const targetLength = Math.min(
      size * size - 2,
      (difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 8) + Math.floor(lvl / 2)
    );

    let generatedPath: number[] = [];
    let attempts = 0;

    while (generatedPath.length < targetLength && attempts < 150) {
      attempts++;
      const currentPath: number[] = [];
      
      // Place start on the outer boundary for a nicer layout
      let startIdx = 0;
      const boundary = Math.random();
      if (boundary < 0.25) {
        // Top row
        startIdx = Math.floor(Math.random() * size);
      } else if (boundary < 0.5) {
        // Bottom row
        startIdx = (size - 1) * size + Math.floor(Math.random() * size);
      } else if (boundary < 0.75) {
        // Left column
        startIdx = Math.floor(Math.random() * size) * size;
      } else {
        // Right column
        startIdx = Math.floor(Math.random() * size) * size + (size - 1);
      }

      currentPath.push(startIdx);
      let current = startIdx;

      for (let step = 1; step < targetLength; step++) {
        const cx = current % size;
        const cy = Math.floor(current / size);
        const neighbors: number[] = [];

        // UP
        if (cy > 0) neighbors.push(current - size);
        // DOWN
        if (cy < size - 1) neighbors.push(current + size);
        // LEFT
        if (cx > 0) neighbors.push(current - 1);
        // RIGHT
        if (cx < size - 1) neighbors.push(current + 1);

        // Filter out visited cells
        const unvisited = neighbors.filter(n => !currentPath.includes(n));
        
        if (unvisited.length === 0) {
          break; // stuck, break and try again
        }

        const next = unvisited[Math.floor(Math.random() * unvisited.length)];
        currentPath.push(next);
        current = next;
      }

      if (currentPath.length === targetLength) {
        generatedPath = currentPath;
      }
    }

    // Fallback if failed to generate ideal length: use whatever we have
    if (generatedPath.length === 0) {
      generatedPath = [0, 1, 2, 3, 4];
    }

    setPath(generatedPath);
    setUserPath([generatedPath[0]]); // user starts at start cell
    setWrongCell(null);
  };

  const startGame = () => {
    setLevel(1);
    setScore(0);
    setLives(3);
    
    const size = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 6 : 7;
    setGridSize(size);
    
    startTime.current = Date.now();
    startNewLevel(1, size);
  };

  const startNewLevel = (lvl: number, size: number) => {
    generateProceduralPath(lvl, size);
    setPhase('memorizing');
    setWrongCell(null);

    // Memorization countdown: 3.5 seconds
    setMemoTimer(3.5);
    if (timerRef.current) clearInterval(timerRef.current);

    const startMemoTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startMemoTime) / 1000;
      const remaining = Math.max(0, 3.5 - elapsed);
      setMemoTimer(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setPhase('tracing');
      }
    }, 50);
  };

  const handleCellClick = (index: number) => {
    if (phase !== 'tracing' || wrongCell !== null) return;
    
    // Ignore start cell click since they are already standing on it
    if (index === path[0] && userPath.length === 1) return;

    // Check if clicked cell is the next step in user's tracing
    const currentStepIndex = userPath.length;
    const correctNextCell = path[currentStepIndex];

    if (index === correctNextCell) {
      // Correct step!
      const nextUserPath = [...userPath, index];
      setUserPath(nextUserPath);

      // Check if complete path reached
      if (nextUserPath.length === path.length) {
        // Correctly completed path!
        const pointsAwarded = level * 15 + (difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30);
        setScore(s => s + pointsAwarded);
        setLevel(l => l + 1);

        setTimeout(() => {
          startNewLevel(level + 1, gridSize);
        }, 1200);
      }
    } else {
      // Wrong step!
      setWrongCell(index);
      
      setLives(l => {
        const nextLives = l - 1;
        if (nextLives <= 0) {
          setTimeout(finishGame, 1200);
        } else {
          // Reset trace after 1s so they can try tracing this path again
          setTimeout(() => {
            setUserPath([path[0]]);
            setWrongCell(null);
          }, 1000);
        }
        return nextLives;
      });
    }
  };

  const finishGame = async () => {
    const rawScore = Math.min(100, Math.round(score / 1.8));
    const accuracy = score > 0 ? Math.min(100, Math.round((level / (level + (3 - lives))) * 100)) : 0;

    const game = await getGameBySlug('hidden-path');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'hidden-path',
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

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">🧩 Hidden Path Recall</h1>
        <p className="page-subtitle">Memorize the glowing path in the grid, then trace it from start to end!</p>
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
            Initialize Maze Grid
          </button>
        </div>
      )}

      {(phase === 'memorizing' || phase === 'tracing') && (
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

          {/* Memorization Timer indicator */}
          {phase === 'memorizing' ? (
            <div
              style={{
                width: '100%',
                maxWidth: '350px',
                textAlign: 'center',
                marginBottom: '16px',
                color: 'var(--neon-cyan)',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                fontFamily: 'var(--font-display)',
                textShadow: '0 0 10px var(--neon-cyan)',
              }}
            >
              MEMORIZE: {memoTimer.toFixed(1)}s
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                maxWidth: '350px',
                textAlign: 'center',
                marginBottom: '16px',
                color: 'var(--gold)',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              {wrongCell !== null
                ? '⚡ SYSTEM CALIBRATION FAILURE!'
                : userPath.length === path.length
                ? '🎉 PATH SYNCHRONIZED!'
                : '👉 Trace from Start (S) to End (E)'}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gap: '8px',
              width: '100%',
              maxWidth: gridSize === 5 ? '340px' : gridSize === 6 ? '380px' : '420px',
              background: '#0d0f1e',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
              const isStart = idx === path[0];
              const isEnd = idx === path[path.length - 1];
              const isPath = path.includes(idx);
              const isUserTraced = userPath.includes(idx);
              const isIncorrect = wrongCell === idx;

              // Color determination
              let bg = '#13162b';
              let borderColor = 'var(--border)';
              let glow = 'none';
              let cursor = 'default';
              let cellLabel = '';

              if (phase === 'memorizing') {
                if (isStart) {
                  bg = 'rgba(0, 255, 102, 0.15)';
                  borderColor = '#00ff66';
                  glow = '0 0 10px rgba(0, 255, 102, 0.4)';
                  cellLabel = 'S';
                } else if (isEnd) {
                  bg = 'rgba(255, 0, 127, 0.15)';
                  borderColor = '#ff007f';
                  glow = '0 0 10px rgba(255, 0, 127, 0.4)';
                  cellLabel = 'E';
                } else if (isPath) {
                  bg = 'rgba(204, 0, 255, 0.2)';
                  borderColor = '#cc00ff';
                  glow = '0 0 8px rgba(204, 0, 255, 0.4)';
                }
              } else {
                // Tracing phase
                cursor = 'pointer';
                if (isStart) {
                  bg = 'rgba(0, 255, 102, 0.25)';
                  borderColor = '#00ff66';
                  glow = '0 0 12px rgba(0, 255, 102, 0.6)';
                  cellLabel = 'S';
                } else if (isEnd && isUserTraced) {
                  bg = 'rgba(0, 255, 102, 0.25)';
                  borderColor = '#00ff66';
                  glow = '0 0 12px rgba(0, 255, 102, 0.6)';
                  cellLabel = 'E';
                } else if (isEnd) {
                  bg = 'rgba(255, 0, 127, 0.15)';
                  borderColor = '#ff007f';
                  glow = '0 0 8px rgba(255, 0, 127, 0.3)';
                  cellLabel = 'E';
                } else if (isIncorrect) {
                  bg = 'rgba(255, 0, 127, 0.35)';
                  borderColor = '#ff007f';
                  glow = '0 0 15px rgba(255, 0, 127, 0.7)';
                } else if (isUserTraced) {
                  bg = 'rgba(0, 240, 255, 0.25)';
                  borderColor = '#00f0ff';
                  glow = '0 0 12px rgba(0, 240, 255, 0.5)';
                }
              }

              return (
                <div
                  key={idx}
                  onClick={() => phase === 'tracing' && handleCellClick(idx)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 'var(--radius-xs)',
                    background: bg,
                    border: `1px solid ${borderColor}`,
                    boxShadow: glow,
                    cursor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    color: isStart ? '#00ff66' : isEnd ? '#ff007f' : '#ffffff',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isIncorrect ? 'scale(0.95)' : isUserTraced && !isStart ? 'scale(1.05)' : 'none',
                    userSelect: 'none',
                  }}
                >
                  {cellLabel}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Spatial Mapping Completed
          </h2>
          <div className="results-score">+{result.final_score} pts</div>

          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.level}</div>
              <div className="game-stat-label">Mazes Traced</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.score}</div>
              <div className="game-stat-label">Total Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.accuracy}%</div>
              <div className="game-stat-label">Mapping Accuracy</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Reinitialize Maze
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
