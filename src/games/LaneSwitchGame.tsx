import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface Obstacle {
  id: number;
  lane: number;
  y: number;
  width: number;
  height: number;
  passed: boolean;
}

export default function LaneSwitchGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [distance, setDistance] = useState(0);
  const [result, setResult] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game state refs for performance in the 60fps loop
  const playerLaneRef = useRef<number>(1); // 0 = Left, 1 = Center, 2 = Right
  const targetLaneRef = useRef<number>(1); // For smooth transition animation
  const playerXRef = useRef<number>(150); // Pixel X for player
  const obstaclesRef = useRef<Obstacle[]>([]);
  const livesRef = useRef<number>(3);
  const scoreRef = useRef<number>(0);
  const distanceRef = useRef<number>(0);
  const isInvincibleRef = useRef<boolean>(false);
  const invincibilityTimeRef = useRef<number>(0);
  
  const gameSpeedRef = useRef<number>(4); // pixels per frame
  const frameCountRef = useRef<number>(0);
  const obstacleIdCounter = useRef<number>(0);
  const requestRef = useRef<number | null>(null);
  const startTime = useRef<number>(Date.now());

  // Input states
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        moveLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        moveLane(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [phase]);

  const moveLane = (dir: number) => {
    const nextLane = Math.min(2, Math.max(0, playerLaneRef.current + dir));
    targetLaneRef.current = nextLane;
    playerLaneRef.current = nextLane;
  };

  const startGame = () => {
    playerLaneRef.current = 1;
    targetLaneRef.current = 1;
    playerXRef.current = 150;
    obstaclesRef.current = [];
    livesRef.current = 3;
    scoreRef.current = 0;
    distanceRef.current = 0;
    isInvincibleRef.current = false;
    invincibilityTimeRef.current = 0;
    
    // Set base speed by difficulty
    gameSpeedRef.current = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5.5 : 7.5;
    frameCountRef.current = 0;
    obstacleIdCounter.current = 0;
    
    setScore(0);
    setLives(3);
    setDistance(0);
    startTime.current = Date.now();
    setPhase('playing');
    
    // Start RAF loop after a small state delay
    setTimeout(() => {
      if (canvasRef.current) {
        requestRef.current = requestAnimationFrame(gameLoop);
      }
    }, 50);
  };

  const gameLoop = () => {
    if (livesRef.current <= 0) {
      finishGame();
      return;
    }

    updatePhysics();
    drawGame();
    
    frameCountRef.current++;
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const updatePhysics = () => {
    // 1. Smoothly interpolate player X coordinates towards target lane X
    const laneWidth = 100;
    const padding = 50;
    const targetX = padding + targetLaneRef.current * laneWidth;
    playerXRef.current += (targetX - playerXRef.current) * 0.25; // lerp

    // 2. Spawn obstacles procedurally
    // Easy: Spawn every 90 frames, Medium: 70, Hard: 50
    const spawnInterval = difficulty === 'easy' ? 95 : difficulty === 'medium' ? 75 : 55;
    if (frameCountRef.current % spawnInterval === 0) {
      spawnProceduralObstacle();
    }

    // 3. Update invincibility timer
    if (isInvincibleRef.current) {
      invincibilityTimeRef.current -= 1;
      if (invincibilityTimeRef.current <= 0) {
        isInvincibleRef.current = false;
      }
    }

    // 4. Move obstacles, check collisions & points
    const nextObstacles: Obstacle[] = [];
    const playerY = 420;
    const playerHeight = 24;

    // Speed slowly accelerates
    gameSpeedRef.current += 0.001;

    obstaclesRef.current.forEach(obs => {
      obs.y += gameSpeedRef.current;

      // Check collision
      const obsY = obs.y;

      const collides = 
        obs.lane === playerLaneRef.current &&
        obsY + obs.height >= playerY - playerHeight / 2 &&
        obsY <= playerY + playerHeight / 2;

      if (collides && !isInvincibleRef.current) {
        // Trigger collision!
        livesRef.current -= 1;
        setLives(livesRef.current);
        
        isInvincibleRef.current = true;
        invincibilityTimeRef.current = 60; // 1 second flash @ 60fps
      }

      // Check if passed player
      if (obs.y > playerY + 30 && !obs.passed) {
        obs.passed = true;
        scoreRef.current += 10;
        setScore(scoreRef.current);
      }

      // Keep if not off-screen
      if (obs.y < 550) {
        nextObstacles.push(obs);
      }
    });

    obstaclesRef.current = nextObstacles;

    // 5. Update distance
    distanceRef.current += gameSpeedRef.current / 10;
    setDistance(Math.round(distanceRef.current));
  };

  const spawnProceduralObstacle = () => {
    // Generate obstacles. NEVER block all 3 lanes at once!
    const activeLanes: number[] = [];
    const possibleLanes = [0, 1, 2];

    const obstaclesToSpawnCount = difficulty === 'easy' ? 1 : Math.random() > 0.4 ? 2 : 1;
    
    // Choose random lanes
    while (activeLanes.length < obstaclesToSpawnCount && activeLanes.length < 2) {
      const l = possibleLanes[Math.floor(Math.random() * possibleLanes.length)];
      if (!activeLanes.includes(l)) {
        activeLanes.push(l);
      }
    }

    activeLanes.forEach(lane => {
      obstaclesRef.current.push({
        id: obstacleIdCounter.current++,
        lane,
        y: -40,
        width: 60,
        height: 20,
        passed: false,
      });
    });
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear Screen
    ctx.fillStyle = '#060713';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Lane Boundaries
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 0); ctx.lineTo(100, canvas.height);
    ctx.moveTo(200, 0); ctx.lineTo(200, canvas.height);
    ctx.stroke();

    // Draw Glowing Lane Lines (Holographic Sci-fi look)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 0); ctx.lineTo(50, canvas.height);
    ctx.moveTo(150, 0); ctx.lineTo(150, canvas.height);
    ctx.moveTo(250, 0); ctx.lineTo(250, canvas.height);
    ctx.stroke();

    // Draw Obstacles (Neon red walls)
    obstaclesRef.current.forEach(obs => {
      const padding = 50;
      const laneWidth = 100;
      const x = padding + obs.lane * laneWidth - obs.width / 2;

      // Draw obstacle body
      ctx.fillStyle = 'rgba(255, 0, 127, 0.15)';
      ctx.fillRect(x, obs.y, obs.width, obs.height);

      // Draw glowing neon border
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff007f';
      ctx.strokeRect(x, obs.y, obs.width, obs.height);
      ctx.shadowBlur = 0; // reset
    });

    // Draw Player Ship (Glowing Cyan Triangle)
    const px = playerXRef.current;
    const py = 420;
    const pSize = 14;

    // Blink effect if invincible
    if (!isInvincibleRef.current || Math.floor(frameCountRef.current / 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(px, py - pSize);
      ctx.lineTo(px - pSize, py + pSize);
      ctx.lineTo(px + pSize, py + pSize);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00f0ff';
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
      
      // Draw details inside ship
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py + pSize / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const finishGame = async () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    const timeTaken = Date.now() - startTime.current;
    
    // Scoring metrics
    const finalScoreValue = scoreRef.current;
    const finalDistance = Math.round(distanceRef.current);
    
    // Accuracy / Reflex rating = score / total seconds elapsed
    const survivalSec = timeTaken / 1000;
    const accuracy = Math.min(100, Math.round((finalScoreValue / Math.max(1, survivalSec)) * 12));
    
    const rawScore = Math.min(100, Math.round((finalScoreValue * 0.4) + (finalDistance * 0.2)));

    const game = await getGameBySlug('lane-switch');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'lane-switch',
        rawScore,
        timeTaken,
        accuracy,
        difficulty,
      });
      setResult({ ...res, rawScore, finalScoreValue, finalDistance, score: finalScoreValue });
    }
    await refreshProfile();
    setPhase('results');
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">🏃 Lane Switch</h1>
        <p className="page-subtitle">Dodge the incoming neural energy blockades. Tap lanes or press Left/Right Arrow keys!</p>
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
            Initiate Warp Drive
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="game-area">
          <div className="game-stats" style={{ marginBottom: '16px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{score}</div>
              <div className="game-stat-label">Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--neon-cyan)' }}>
                {distance}m
              </div>
              <div className="game-stat-label">Distance</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--danger)' }}>
                {'❤️'.repeat(lives)}
                {lives < 3 && <span style={{ opacity: 0.25 }}>{'🖤'.repeat(3 - lives)}</span>}
              </div>
              <div className="game-stat-label">Hull Shields</div>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={300}
            height={500}
            style={{
              background: '#060713',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              display: 'block',
              margin: '0 auto 16px auto',
              width: '300px',
              height: '500px',
            }}
          />

          {/* Quick touch-control buttons for mobile/tablet or mouse users */}
          <div style={{ display: 'flex', gap: '20px', width: '100%', maxWidth: '300px', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px 0', fontSize: '1.2rem', fontWeight: 'bold' }}
              onClick={() => moveLane(-1)}
            >
              ◀ LEFT
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px 0', fontSize: '1.2rem', fontWeight: 'bold' }}
              onClick={() => moveLane(1)}
            >
              RIGHT ▶
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Warp Analysis Completed
          </h2>
          <div className="results-score">+{result.final_score} pts</div>

          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.finalScoreValue}</div>
              <div className="game-stat-label">Avoidance Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--neon-cyan)' }}>
                {result.finalDistance}m
              </div>
              <div className="game-stat-label">Distance Cleared</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.accuracy}%</div>
              <div className="game-stat-label">Reflex Index</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Re-engage Engines
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
