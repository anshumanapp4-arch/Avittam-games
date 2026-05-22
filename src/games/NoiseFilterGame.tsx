import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

type ShapeType = 'circle' | 'triangle' | 'square' | 'star';

const SHAPES: ShapeType[] = ['circle', 'triangle', 'square', 'star'];

export default function NoiseFilterGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [currentShape, setCurrentShape] = useState<ShapeType>('circle');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [timeLeft, setTimeLeft] = useState(10); // 10 seconds per round

  const [result, setResult] = useState<any>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const offscreenDataRef = useRef<Uint8ClampedArray | null>(null);
  const startTime = useRef(Date.now());
  const roundStartTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef<any>(null);

  const canvasWidth = 150;
  const canvasHeight = 150;

  // Draws a shape on an offscreen canvas to act as a pixel-perfect mask
  const generateShapeMask = (shape: ShapeType) => {
    const offscreen = document.createElement('canvas');
    offscreen.width = canvasWidth;
    offscreen.height = canvasHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // Background is transparent/black (0 alpha)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    
    // Vary size slightly per level for extra visual intrigue
    const sizeOffset = Math.sin(level) * 4;
    const r = 38 + sizeOffset; // base size

    ctx.fillStyle = '#ffffff';

    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
    } else if (shape === 'square') {
      ctx.beginPath();
      ctx.rect(cx - r, cy - r, r * 2, r * 2);
      ctx.fill();
    } else if (shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      // Equilateral points
      ctx.lineTo(cx + r * Math.cos(Math.PI / 6), cy + r * Math.sin(Math.PI / 6));
      ctx.lineTo(cx - r * Math.cos(Math.PI / 6), cy + r * Math.sin(Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'star') {
      const spikes = 5;
      const outerRadius = r + 4;
      const innerRadius = (r / 2) - 2;
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fill();
    }

    const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    offscreenDataRef.current = imgData.data;
  };

  // Noise animation rendering frame loop
  useEffect(() => {
    if (phase !== 'playing') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localFrame = 0;

    const renderNoise = () => {
      const maskData = offscreenDataRef.current;
      if (!maskData) {
        animationRef.current = requestAnimationFrame(renderNoise);
        return;
      }

      const imgData = ctx.createImageData(canvasWidth, canvasHeight);
      const data = imgData.data;

      // Adjust signal parameters depending on difficulty
      let opacityOffset = 9;
      let rTint = 0;
      let gTint = 0;
      let bTint = 0;

      if (difficulty === 'easy') {
        opacityOffset = 22;
        rTint = -10;
        gTint = 12;
        bTint = 25; // Cyan blue shift
      } else if (difficulty === 'medium') {
        opacityOffset = 13;
        rTint = -4;
        gTint = 4;
        bTint = 14;
      } else {
        // Hard mode: extremely low offset, relies on hyper contrast recognition
        opacityOffset = 7;
        rTint = -2;
        gTint = 2;
        bTint = 6;
      }

      // Generate animated waves or pulse internally
      localFrame++;
      const waveShift = Math.sin(localFrame * 0.08) * (opacityOffset * 0.25);

      for (let i = 0; i < data.length; i += 4) {
        // Core grain generator
        let val = Math.floor(Math.random() * 256);

        // Check if inside shape mask
        const isMasked = maskData[i] > 128; // red channel value in offscreen mask

        if (isMasked) {
          // Adjust contrast/brightness
          const dynamicOffset = opacityOffset + waveShift;
          val = Math.min(255, Math.max(0, val + dynamicOffset));

          data[i] = Math.min(255, Math.max(0, val + rTint));
          data[i + 1] = Math.min(255, Math.max(0, val + gTint));
          data[i + 2] = Math.min(255, Math.max(0, val + bTint));
        } else {
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
        data[i + 3] = 255; // Alpha
      }

      ctx.putImageData(imgData, 0, 0);
      animationRef.current = requestAnimationFrame(renderNoise);
    };

    renderNoise();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [phase, currentShape, difficulty, level]);

  // Game timer loop
  useEffect(() => {
    if (phase !== 'playing' || feedback !== null) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      return;
    }

    setTimeLeft(10);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [phase, currentShape, feedback]);

  const handleTimeout = () => {
    setFeedback('timeout');
    setLives(l => {
      const nextLives = l - 1;
      if (nextLives <= 0) {
        setTimeout(finishGame, 1000);
      } else {
        setTimeout(() => {
          nextRound();
        }, 1000);
      }
      return nextLives;
    });
  };

  const startNewGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setFeedback(null);
    startTime.current = Date.now();
    setPhase('playing');
    
    // Choose random shape and generate
    const initialShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    setCurrentShape(initialShape);
    generateShapeMask(initialShape);
    roundStartTimeRef.current = Date.now();
  };

  const nextRound = () => {
    setFeedback(null);
    const nextShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    setCurrentShape(nextShape);
    generateShapeMask(nextShape);
    roundStartTimeRef.current = Date.now();
  };

  const handleGuess = (guess: ShapeType) => {
    if (feedback !== null || phase !== 'playing') return;

    if (guess === currentShape) {
      setFeedback('correct');
      const reactionTime = Date.now() - roundStartTimeRef.current;
      const points = Math.max(15, Math.round((10000 - reactionTime) / 100 * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.6 : 2.5)));
      setScore(s => s + points);
      setLevel(l => l + 1);

      setTimeout(() => {
        nextRound();
      }, 1000);
    } else {
      setFeedback('wrong');
      setLives(l => {
        const nextLives = l - 1;
        if (nextLives <= 0) {
          setTimeout(finishGame, 1000);
        } else {
          setTimeout(() => {
            nextRound();
          }, 1000);
        }
        return nextLives;
      });
    }
  };

  const finishGame = async () => {
    const timeTaken = Date.now() - startTime.current;
    const accuracy = score > 0 ? Math.min(100, Math.round((level / (level + (3 - lives))) * 100)) : 0;
    const rawScore = Math.min(100, Math.round((score / 1.6) * (accuracy / 100)));

    const game = await getGameBySlug('noise-filter');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'noise-filter',
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

  return (
    <div className="game-container" style={{ maxWidth: '600px' }}>
      <div className="game-header">
        <h1 className="page-title">🧠 Visual Noise Filter</h1>
        <p className="page-subtitle">Decamouflage signal: Filter out animated white noise static to identify the hidden central glyph!</p>
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
          <div className="instructions-card" style={{ marginBottom: '24px', textAlign: 'left', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: 'var(--neon-cyan)', marginBottom: '8px' }}>Scanning Manual:</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>An electronic camouflage mask is overlaying a geometric pattern.</li>
              <li>Filter the static using visual motion integration to deduce what shape is hidden.</li>
              <li>Tap/click the matching glyph before the core diagnostics timer reaches 0.</li>
            </ul>
          </div>
          <button className="btn btn-primary btn-lg" onClick={startNewGame}>
            Initialize Decoder Canvas
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
              <div className="game-stat-label">Lives</div>
            </div>
          </div>

          {/* Time Bar */}
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '20px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(timeLeft / 10) * 100}%`,
                height: '100%',
                background: timeLeft > 3 ? 'var(--neon-cyan)' : 'var(--danger)',
                boxShadow: `0 0 8px ${timeLeft > 3 ? 'var(--neon-cyan)' : 'var(--danger)'}`,
                transition: 'width 1s linear',
              }}
            />
          </div>

          {/* Screen Terminal Frame */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '300px',
              aspectRatio: '1',
              margin: '0 auto 24px auto',
              background: '#04050d',
              border: '2px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(0, 240, 255, 0.1)',
              overflow: 'hidden',
              padding: '8px',
            }}
          >
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              style={{
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated',
                borderRadius: '6px',
                display: 'block',
              }}
            />

            {/* Futuristic overlay lines */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                backgroundSize: '100% 4px, 6px 100%',
                opacity: 0.85,
              }}
            />

            {/* Flash Feedback visual effect */}
            {feedback && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: feedback === 'correct' ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 0, 127, 0.2)',
                  pointerEvents: 'none',
                  transition: 'background 0.2s ease',
                  border: feedback === 'correct' ? '3px solid #00ff66' : '3px solid var(--danger)',
                  borderRadius: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: feedback === 'correct' ? '#00ff66' : 'var(--danger)',
                    textShadow: `0 0 10px ${feedback === 'correct' ? '#00ff66' : 'var(--danger)'}`,
                  }}
                >
                  {feedback === 'correct' && '✓ DECODED'}
                  {feedback === 'wrong' && '✗ CORRUPTED'}
                  {feedback === 'timeout' && '⏰ TIME EXPIRED'}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Decamouflage Option Buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              width: '100%',
              maxWidth: '300px',
              margin: '0 auto',
            }}
          >
            {SHAPES.map(shape => {
              const label = shape.charAt(0).toUpperCase() + shape.slice(1);
              let icon = '🔴';
              if (shape === 'triangle') icon = '🔺';
              if (shape === 'square') icon = '⬜';
              if (shape === 'star') icon = '⭐';

              return (
                <button
                  key={shape}
                  className="btn btn-secondary"
                  onClick={() => handleGuess(shape)}
                  disabled={feedback !== null}
                  style={{
                    padding: '16px',
                    fontSize: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    borderColor: 'var(--border)',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Decoded Diagnostic Finished
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
              <div className="game-stat-label">Decoder Precision</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Decode New Signal
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
