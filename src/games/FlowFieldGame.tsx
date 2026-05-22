import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface Waypoint {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  isPathParticle: boolean;
  pathSegmentIndex?: number;
}

export default function FlowFieldGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [isTracing, setIsTracing] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  const [result, setResult] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTime = useRef(Date.now());
  const roundStartTimeRef = useRef(Date.now());

  // Path data
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0); // waypoint the player has reached
  const [userTrail, setUserTrail] = useState<Waypoint[]>([]);

  const canvasWidth = 500;
  const canvasHeight = 500;

  // Mathematically check point-to-segment distance
  const getDistanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) {
      return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    }
    let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t)); // clamp projection to segment bounds
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  };

  // Find minimum distance of user finger to completed segments or current active segment
  const getMinDistanceToActivePath = (px: number, py: number) => {
    if (waypoints.length < 2) return 0;
    
    let minDist = Infinity;
    // Check segments up to the current waypoint index + 1 (the one currently being traced)
    const limit = Math.min(waypoints.length - 1, currentWaypointIndex + 1);
    for (let i = 0; i < limit; i++) {
      const dist = getDistanceToSegment(px, py, waypoints[i].x, waypoints[i].y, waypoints[i + 1].x, waypoints[i + 1].y);
      if (dist < minDist) {
        minDist = dist;
      }
    }
    return minDist;
  };

  // Generate winding path from left to right procedural
  const generatePath = (lvl: number) => {
    const generated: Waypoint[] = [];
    
    // Number of waypoints scales slightly with level
    let count = 4 + Math.floor(lvl * 0.4);
    if (difficulty === 'easy') count = Math.min(count, 5);
    else if (difficulty === 'medium') count = Math.min(count + 1, 7);
    else count = Math.min(count + 2, 9);

    const startX = 60;
    const endX = canvasWidth - 60;
    const stepX = (endX - startX) / (count - 1);

    for (let i = 0; i < count; i++) {
      const x = startX + i * stepX;
      
      // Winding amplitude
      let maxOffset = 130;
      if (difficulty === 'easy') maxOffset = 90;
      else if (difficulty === 'hard') maxOffset = 160;

      // Ensure start and end portals are roughly vertical center
      let y = canvasHeight / 2;
      if (i > 0 && i < count - 1) {
        // Procedural sine-wave variation mixed with random offset
        const rawY = canvasHeight / 2 + (Math.random() - 0.5) * maxOffset * 2;
        y = Math.min(canvasHeight - 60, Math.max(60, rawY));
      }
      
      generated.push({ x, y });
    }

    setWaypoints(generated);
    setCurrentWaypointIndex(0);
    setUserTrail([]);
    setTraceError(null);
    setIsTracing(false);
    roundStartTimeRef.current = Date.now();
  };

  // Particle dynamics simulator loop
  useEffect(() => {
    if (phase !== 'playing' || waypoints.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Build particle array
    const particles: Particle[] = [];
    const maxParticles = 160;

    const spawnParticle = (forcePath = false): Particle => {
      const isPath = forcePath || Math.random() > 0.4;
      
      if (isPath && waypoints.length > 1) {
        // Spawn path-following particle at a random segment
        const segIdx = Math.floor(Math.random() * (waypoints.length - 1));
        const segStart = waypoints[segIdx];
        const segEnd = waypoints[segIdx + 1];
        
        // Random interpolation along the segment
        const ratio = Math.random();
        const px = segStart.x + (segEnd.x - segStart.x) * ratio;
        const py = segStart.y + (segEnd.y - segStart.y) * ratio;

        // Path direction vector
        const dx = segEnd.x - segStart.x;
        const dy = segEnd.y - segStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        // Speed parameters based on difficulty
        const speed = (difficulty === 'easy' ? 1.4 : difficulty === 'medium' ? 2.0 : 2.7) + Math.random() * 0.5;
        const vx = (dx / len) * speed;
        const vy = (dy / len) * speed;

        return {
          x: px,
          y: py,
          vx,
          vy,
          life: 0,
          maxLife: 60 + Math.random() * 40,
          color: difficulty === 'easy' ? 'rgba(0, 240, 255, 0.75)' : difficulty === 'medium' ? 'rgba(0, 255, 102, 0.65)' : 'rgba(255, 204, 0, 0.55)',
          size: 1.5 + Math.random() * 2,
          isPathParticle: true,
          pathSegmentIndex: segIdx,
        };
      } else {
        // Ambient background drifting noise particle
        return {
          x: Math.random() * canvasWidth,
          y: Math.random() * canvasHeight,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          life: 0,
          maxLife: 100 + Math.random() * 80,
          color: 'rgba(204, 0, 255, 0.15)', // dim purple
          size: 1.0 + Math.random() * 1.5,
          isPathParticle: false,
        };
      }
    };

    // Pre-populate particles
    for (let i = 0; i < maxParticles; i++) {
      particles.push(spawnParticle());
    }

    const loop = () => {
      // Clear with micro-trace fading transparent black for gorgeous neon motion trails
      ctx.fillStyle = 'rgba(4, 5, 13, 0.18)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Render winding grid guidelines faintly
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvasWidth; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y < canvasHeight; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }

      // Draw faint underlying path track for EASY difficulty, but hide it in HARD
      if (difficulty !== 'hard') {
        ctx.strokeStyle = difficulty === 'easy' ? 'rgba(0, 240, 255, 0.06)' : 'rgba(0, 255, 102, 0.03)';
        ctx.lineWidth = difficulty === 'easy' ? 12 : 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
          ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        ctx.stroke();
      }

      // Update and draw particles
      particles.forEach((p, idx) => {
        p.life++;
        
        if (p.isPathParticle && p.pathSegmentIndex !== undefined && waypoints.length > 1) {
          const segEnd = waypoints[p.pathSegmentIndex + 1];
          // Genuinely nudge particles toward the next waypoint vector flow
          const dx = segEnd.x - p.x;
          const dy = segEnd.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 10) {
            // Transition to next segment or respawn
            const nextIdx = (p.pathSegmentIndex + 1) % (waypoints.length - 1);
            p.pathSegmentIndex = nextIdx;
            const newStart = waypoints[nextIdx];
            p.x = newStart.x;
            p.y = newStart.y;
            
            const nextEnd = waypoints[nextIdx + 1];
            const ndx = nextEnd.x - newStart.x;
            const ndy = nextEnd.y - newStart.y;
            const nlen = Math.sqrt(ndx * ndx + ndy * ndy);
            const speed = (difficulty === 'easy' ? 1.4 : difficulty === 'medium' ? 2.0 : 2.7) + Math.random() * 0.5;
            p.vx = (ndx / nlen) * speed;
            p.vy = (ndy / nlen) * speed;
          }
        }

        // Apply velocities
        p.x += p.vx;
        p.y += p.vy;

        // Draw particle
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Respawn if expired
        if (p.life >= p.maxLife || p.x < 0 || p.x > canvasWidth || p.y < 0 || p.y > canvasHeight) {
          particles[idx] = spawnParticle(p.isPathParticle);
        }
      });

      // Draw Portals
      const startPortal = waypoints[0];
      const endPortal = waypoints[waypoints.length - 1];

      const drawPortal = (wp: Waypoint, glowColor: string, label: string) => {
        const pulse = 12 + Math.sin(Date.now() * 0.007) * 3;
        
        // Glow layer
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(4,5,13,0.85)';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, pulse - 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Inner glowing core
        ctx.shadowBlur = 6;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, wp.x, wp.y - pulse - 6);
      };

      drawPortal(startPortal, '#00f0ff', 'START PORTAL');
      drawPortal(endPortal, '#ff007f', 'END PORTAL');

      // Draw user's active trace path
      if (isTracing && userTrail.length > 0) {
        ctx.strokeStyle = 'var(--gold)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'var(--gold)';
        ctx.shadowBlur = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(userTrail[0].x, userTrail[0].y);
        userTrail.forEach(pt => {
          ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [phase, waypoints, isTracing, userTrail, difficulty]);

  const handleStartGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setResult(null);
    setTraceError(null);
    setIsTracing(false);
    startTime.current = Date.now();
    setPhase('playing');
    generatePath(1);
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Waypoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * canvasWidth;
    const y = ((clientY - rect.top) / rect.height) * canvasHeight;

    return { x, y };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing' || waypoints.length === 0 || traceError) return;

    const pt = getCanvasCoords(e);
    if (!pt) return;

    // Verify user clicked start portal
    const startPortal = waypoints[0];
    const distToStart = Math.sqrt((pt.x - startPortal.x) ** 2 + (pt.y - startPortal.y) ** 2);

    if (distToStart <= 30) {
      setIsTracing(true);
      setCurrentWaypointIndex(0);
      setUserTrail([pt]);
      setTraceError(null);
    } else {
      setTraceError('calibration');
      setTimeout(() => setTraceError(null), 1000);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isTracing || phase !== 'playing' || waypoints.length === 0) return;

    const pt = getCanvasCoords(e);
    if (!pt) return;

    // Track path alignment offset limits
    let allowedOffset = 30; // Easy
    if (difficulty === 'medium') allowedOffset = 22;
    else if (difficulty === 'hard') allowedOffset = 14;

    const minSegmentDist = getMinDistanceToActivePath(pt.x, pt.y);

    if (minSegmentDist > allowedOffset) {
      // Dropped/Strayed too far from active stream current
      setIsTracing(false);
      setUserTrail([]);
      setTraceError('strayed');
      
      setLives(l => {
        const nextLives = l - 1;
        if (nextLives <= 0) {
          setTimeout(finishGame, 1000);
        } else {
          setTimeout(() => setTraceError(null), 1200);
        }
        return nextLives;
      });
      return;
    }

    // Capture trail point
    setUserTrail(t => [...t, pt]);

    // Check if next waypoint is cleared
    const nextWaypointIdx = currentWaypointIndex + 1;
    if (nextWaypointIdx < waypoints.length) {
      const target = waypoints[nextWaypointIdx];
      const distToTarget = Math.sqrt((pt.x - target.x) ** 2 + (pt.y - target.y) ** 2);

      if (distToTarget <= 28) {
        setCurrentWaypointIndex(nextWaypointIdx);

        // If this is the last waypoint, round is cleared!
        if (nextWaypointIdx === waypoints.length - 1) {
          handleSuccess();
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (!isTracing) return;
    setIsTracing(false);

    // If released before reaching the end, reset trace
    if (currentWaypointIndex < waypoints.length - 1) {
      setUserTrail([]);
    }
  };

  const handleSuccess = () => {
    setIsTracing(false);
    setUserTrail([]);

    const reactionTime = Date.now() - roundStartTimeRef.current;
    const points = Math.max(20, Math.round((14000 - reactionTime) / 100 * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.7 : 2.6)));
    
    setScore(s => s + points);
    setLevel(l => l + 1);
    
    setTraceError('success');
    setTimeout(() => {
      generatePath(level + 1);
    }, 1000);
  };

  const finishGame = async () => {
    setIsTracing(false);
    setUserTrail([]);

    const timeTaken = Date.now() - startTime.current;
    const accuracy = score > 0 ? Math.min(100, Math.round((level / (level + (3 - lives))) * 100)) : 0;
    const rawScore = Math.min(100, Math.round((score / 1.7) * (accuracy / 100)));

    const game = await getGameBySlug('flow-field');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'flow-field',
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
    <div className="game-container" style={{ maxWidth: '650px' }}>
      <div className="game-header">
        <h1 className="page-title">🌊 Flow Field Navigator</h1>
        <p className="page-subtitle">Trace fluid vector streams: Click and drag start-to-end matching path currents!</p>
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
            <h3 style={{ color: 'var(--neon-cyan)', marginBottom: '8px' }}>Navigation System Manual:</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Press and hold down cursor or finger inside the cyan <strong style={{ color: '#00f0ff' }}>START PORTAL</strong>.</li>
              <li>Carefully follow the flowing cyan vector particles to navigate the invisible path stream.</li>
              <li>Reach the pink <strong style={{ color: '#ff007f' }}>END PORTAL</strong> without drifting off the current vector.</li>
              <li>Releasing your touch or drifting too far will sever link alignment.</li>
            </ul>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleStartGame}>
            Synchronize Nav Sensors
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
              <div className="game-stat-label">Vector Calibration</div>
            </div>
          </div>

          {/* Navigator Interactive Board */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '420px',
              aspectRatio: '1',
              margin: '0 auto',
              borderRadius: '12px',
              border: '2px solid var(--border)',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
              userSelect: 'none',
              touchAction: 'none', // Prevents screen dragging on mobile
            }}
          >
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                cursor: isTracing ? 'grabbing' : 'grab',
              }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />

            {/* Error / Success Overlay */}
            {traceError && (
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
                  background:
                    traceError === 'success'
                      ? 'rgba(0, 255, 102, 0.15)'
                      : traceError === 'strayed'
                      ? 'rgba(255, 0, 127, 0.2)'
                      : 'rgba(255, 204, 0, 0.15)',
                  pointerEvents: 'none',
                  border:
                    traceError === 'success'
                      ? '3px solid #00ff66'
                      : traceError === 'strayed'
                      ? '3px solid var(--danger)'
                      : '3px solid var(--gold)',
                  borderRadius: '10px',
                }}
              >
                <div
                  style={{
                    fontSize: '1.8rem',
                    fontWeight: 'bold',
                    color:
                      traceError === 'success'
                        ? '#00ff66'
                        : traceError === 'strayed'
                        ? 'var(--danger)'
                        : 'var(--gold)',
                    textShadow: `0 0 10px ${
                      traceError === 'success'
                        ? '#00ff66'
                        : traceError === 'strayed'
                        ? 'var(--danger)'
                        : 'var(--gold)'
                    }`,
                    textAlign: 'center',
                    padding: '16px',
                  }}
                >
                  {traceError === 'success' && '✓ VECTOR STABILIZED'}
                  {traceError === 'strayed' && '✗ CONNECTION SEVERED\nDRIFT TOO HIGH'}
                  {traceError === 'calibration' && '⚠️ ACTIVATE FROM START PORTAL'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Grid Drift Audit Complete
          </h2>
          <div className="results-score">+{result.final_score} pts</div>

          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.level}</div>
              <div className="game-stat-label">Streams Cleared</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.score}</div>
              <div className="game-stat-label">Total Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">
                {Math.round((result.level / (result.level + (3 - lives))) * 100)}%
              </div>
              <div className="game-stat-label">Navigator Synced</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Trace New Fields
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
