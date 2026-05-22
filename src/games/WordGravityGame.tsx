import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface VocabItem {
  word: string;
  definition: string;
  synonyms: string[];
  category: 'emotion-pos' | 'emotion-neg' | 'wisdom' | 'speech' | 'change';
  categoryLabel: string;
}

const VOCAB_DATABASE: VocabItem[] = [
  {
    word: 'ephemeral',
    definition: 'Lasting for a very short time; fleeting or temporary.',
    synonyms: ['fleeting', 'transitory', 'brief', 'temporary'],
    category: 'change',
    categoryLabel: 'Time & Change',
  },
  {
    word: 'cacophony',
    definition: 'A harsh, discordant mixture of sounds.',
    synonyms: ['noise', 'discord', 'clamor', 'racket'],
    category: 'change', // general sensation
    categoryLabel: 'Sensation & State',
  },
  {
    word: 'altruistic',
    definition: 'Showing selfless concern for the well-being of others.',
    synonyms: ['unselfish', 'philanthropic', 'benevolent', 'generous'],
    category: 'emotion-pos',
    categoryLabel: 'Positive Attributes',
  },
  {
    word: 'sagacious',
    definition: 'Having or showing keen mental discernment and good judgment; wise.',
    synonyms: ['wise', 'shrewd', 'astute', 'perceptive'],
    category: 'wisdom',
    categoryLabel: 'Intellect & Wisdom',
  },
  {
    word: 'loquacious',
    definition: 'Tending to talk a great deal; extremely talkative.',
    synonyms: ['talkative', 'chatty', 'verbose', 'wordy'],
    category: 'speech',
    categoryLabel: 'Speech & Sound',
  },
  {
    word: 'capricious',
    definition: 'Given to sudden and unpredictable changes of mood or behavior.',
    synonyms: ['fickle', 'inconstant', 'unpredictable', 'volatile'],
    category: 'change',
    categoryLabel: 'Time & Change',
  },
  {
    word: 'malevolent',
    definition: 'Having or showing a wish to do evil to others.',
    synonyms: ['hostile', 'spiteful', 'malicious', 'vindictive'],
    category: 'emotion-neg',
    categoryLabel: 'Negative Attributes',
  },
  {
    word: 'superfluous',
    definition: 'Unnecessary, especially through being more than enough.',
    synonyms: ['redundant', 'excessive', 'unnecessary', 'surplus'],
    category: 'change',
    categoryLabel: 'Time & Change',
  },
  {
    word: 'venerable',
    definition: 'Accorded a great deal of respect, especially because of age or wisdom.',
    synonyms: ['respected', 'distinguished', 'esteemed', 'honored'],
    category: 'wisdom',
    categoryLabel: 'Intellect & Wisdom',
  },
  {
    word: 'ostentatious',
    definition: 'Pretentious, showy, or designed to impress or attract notice.',
    synonyms: ['showy', 'pretentious', 'flamboyant', 'gaudy'],
    category: 'change',
    categoryLabel: 'Sensation & State',
  },
  {
    word: 'melancholy',
    definition: 'A deep, pensive, and long-lasting sadness or gloom.',
    synonyms: ['sadness', 'sorrow', 'gloom', 'dejection'],
    category: 'emotion-neg',
    categoryLabel: 'Negative Attributes',
  },
  {
    word: 'jubilant',
    definition: 'Feeling or expressing great happiness and triumph.',
    synonyms: ['joyful', 'ecstatic', 'triumphant', 'elated'],
    category: 'emotion-pos',
    categoryLabel: 'Positive Attributes',
  },
  {
    word: 'taciturn',
    definition: 'Reserved or uncommunicative in speech; saying little.',
    synonyms: ['silent', 'reserved', 'reticent', 'quiet'],
    category: 'speech',
    categoryLabel: 'Speech & Sound',
  },
  {
    word: 'alacrity',
    definition: 'Brisk and cheerful readiness; eager speed.',
    synonyms: ['eagerness', 'readiness', 'enthusiasm', 'speed'],
    category: 'change',
    categoryLabel: 'Sensation & State',
  },
  {
    word: 'erudite',
    definition: 'Having or showing great knowledge or learning; scholarly.',
    synonyms: ['scholarly', 'learned', 'academic', 'knowledgeable'],
    category: 'wisdom',
    categoryLabel: 'Intellect & Wisdom',
  },
];

interface FallingCapsule {
  word: string;
  category: string;
  categoryLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

interface MeaningZone {
  category: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  life: number;
}

export default function WordGravityGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);

  const [activeCapsule, setActiveCapsule] = useState<FallingCapsule | null>(null);
  const [zones, setZones] = useState<MeaningZone[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'crash' | null>(null);

  const [result, setResult] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);

  const startTime = useRef(Date.now());
  const capsuleSpawnTimeRef = useRef(Date.now());

  const canvasWidth = 500;
  const canvasHeight = 550;



  // Spawn a falling word capsule
  const spawnCapsule = (lvl: number, activeZones: MeaningZone[]) => {
    // Pick vocabulary item belonging to one of the active landing zones
    const zoneCategories = activeZones.map(z => z.category);
    const validItems = VOCAB_DATABASE.filter(item => zoneCategories.includes(item.category));
    
    const chosen = validItems[Math.floor(Math.random() * validItems.length)];
    
    // Scale gravity slide speed
    const baseSpeed = difficulty === 'easy' ? 0.75 : difficulty === 'medium' ? 1.35 : 2.15;
    const speed = baseSpeed + (lvl * 0.05);

    const capsule: FallingCapsule = {
      word: chosen.word,
      category: chosen.category,
      categoryLabel: chosen.categoryLabel,
      x: canvasWidth / 2,
      y: 40,
      width: 110,
      height: 32,
      speed,
    };

    setActiveCapsule(capsule);
    setFeedback(null);
    capsuleSpawnTimeRef.current = Date.now();
  };

  // Main frame loop
  useEffect(() => {
    if (phase !== 'playing') {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#04050d';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Grid backdrop lines
      ctx.strokeStyle = 'rgba(255,255,255,0.015)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvasWidth; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }

      // Draw Critical Shield boundary line
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.2)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, canvasHeight - 90);
      ctx.lineTo(canvasWidth, canvasHeight - 90);
      ctx.stroke();

      // Faint warning label
      ctx.fillStyle = 'rgba(255, 0, 127, 0.35)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('WARNING: SHIELD THRESHOLD', canvasWidth - 15, canvasHeight - 96);

      // Draw Meaning zones at the bottom
      zones.forEach(z => {
        ctx.shadowColor = z.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(4, 5, 13, 0.9)';
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.roundRect(z.x, z.y, z.width, z.height, 8);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Draw Category Label Inside
        ctx.fillStyle = z.color;
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LANDING BAY', z.x + z.width / 2, z.y + 18);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(z.label, z.x + z.width / 2, z.y + 36);
      });

      // Update and Draw active capsule falling
      if (activeCapsule) {
        // Fall down if not dragging
        if (!isDraggingRef.current && !feedback) {
          activeCapsule.y += activeCapsule.speed;

          // Check if capsule crashed past critical boundary
          if (activeCapsule.y >= canvasHeight - 110) {
            handleCapsuleCrash();
          }
        }

        // Draw capsule
        const pulse = 1 + Math.sin(Date.now() * 0.007) * 0.03;
        const w = activeCapsule.width * pulse;
        const h = activeCapsule.height;

        ctx.shadowColor = '#cc00ff';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(204, 0, 255, 0.12)';
        ctx.strokeStyle = '#cc00ff';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        ctx.roundRect(activeCapsule.x - w / 2, activeCapsule.y - h / 2, w, h, 16);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Glowing core lines
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(activeCapsule.x - w / 2 + 10, activeCapsule.y);
        ctx.lineTo(activeCapsule.x + w / 2 - 10, activeCapsule.y);
        ctx.stroke();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeCapsule.word, activeCapsule.x, activeCapsule.y);
      }

      // Update and draw particles
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.alpha = Math.max(0, p.life / 30);

        ctx.fillStyle = p.color.replace(')', `, ${p.alpha})`).replace('rgb', 'rgba');
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [phase, activeCapsule, zones, feedback]);

  const handleCapsuleCrash = () => {
    if (!activeCapsule) return;
    setFeedback('crash');
    triggerExplosion(activeCapsule.x, activeCapsule.y, 'rgba(255, 0, 127, 0.8)');
    
    setLives(l => {
      const nextLives = l - 1;
      if (nextLives <= 0) {
        setTimeout(finishGame, 1000);
      } else {
        setTimeout(() => {
          spawnCapsule(level, zones);
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
    
    // Setup landing categories
    const list: MeaningZone[] = [
      {
        category: 'emotion-pos',
        label: 'POSITIVE ATTRIB',
        x: 10,
        y: canvasHeight - 75,
        width: 150,
        height: 60,
        color: '#00ff66',
      },
      {
        category: 'wisdom',
        label: 'INTELLECT / WISDOM',
        x: 175,
        y: canvasHeight - 75,
        width: 150,
        height: 60,
        color: '#00f0ff',
      },
      {
        category: 'emotion-neg',
        label: 'NEGATIVE ATTRIB',
        x: 340,
        y: canvasHeight - 75,
        width: 150,
        height: 60,
        color: '#ff007f',
      },
    ];

    const currentZones = difficulty === 'easy' ? [list[0], list[2]] : list;
    if (difficulty === 'easy') {
      currentZones[0].width = 230;
      currentZones[1].x = 260;
      currentZones[1].width = 230;
    }
    setZones(currentZones);
    spawnCapsule(1, currentZones);
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

    return {
      x: ((clientX - rect.left) / rect.width) * canvasWidth,
      y: ((clientY - rect.top) / rect.height) * canvasHeight,
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing' || !activeCapsule || feedback) return;

    const pt = getCanvasCoords(e);
    if (!pt) return;

    // Check click collision with active falling capsule
    const dx = Math.abs(pt.x - activeCapsule.x);
    const dy = Math.abs(pt.y - activeCapsule.y);

    if (dx <= activeCapsule.width / 2 && dy <= activeCapsule.height / 2) {
      isDraggingRef.current = true;
      dragOffsetRef.current = {
        x: pt.x - activeCapsule.x,
        y: pt.y - activeCapsule.y,
      };
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !activeCapsule || phase !== 'playing' || feedback) return;

    const pt = getCanvasCoords(e);
    if (!pt) return;

    const nextX = pt.x - dragOffsetRef.current.x;
    const nextY = pt.y - dragOffsetRef.current.y;

    // Clamp inside canvas boundary limits
    activeCapsule.x = Math.max(activeCapsule.width / 2, Math.min(canvasWidth - activeCapsule.width / 2, nextX));
    activeCapsule.y = Math.max(activeCapsule.height / 2, Math.min(canvasHeight - 40, nextY));
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current || !activeCapsule) return;
    isDraggingRef.current = false;

    // Verify if released inside a matching meaning zone
    let hitZone: MeaningZone | null = null;
    zones.forEach(z => {
      const insideX = activeCapsule.x >= z.x && activeCapsule.x <= z.x + z.width;
      const insideY = activeCapsule.y >= z.y && activeCapsule.y <= z.y + z.height;
      if (insideX && insideY) {
        hitZone = z;
      }
    });

    if (hitZone) {
      const zone: MeaningZone = hitZone;
      
      if (activeCapsule.category === zone.category) {
        // Correct classification!
        setFeedback('correct');
        triggerExplosion(activeCapsule.x, activeCapsule.y, zone.color);
        
        const reactionTime = Date.now() - capsuleSpawnTimeRef.current;
        const points = Math.max(20, Math.round((14000 - reactionTime) / 100 * (difficulty === 'easy' ? 1.0 : difficulty === 'medium' ? 1.6 : 2.5)));
        setScore(s => s + points);
        setLevel(l => l + 1);

        setTimeout(() => {
          spawnCapsule(level + 1, zones);
        }, 1000);
      } else {
        // Mismatched category!
        setFeedback('wrong');
        triggerExplosion(activeCapsule.x, activeCapsule.y, 'rgba(255, 0, 127, 0.8)');
        
        setLives(l => {
          const nextLives = l - 1;
          if (nextLives <= 0) {
            setTimeout(finishGame, 1000);
          } else {
            setTimeout(() => {
              spawnCapsule(level, zones);
            }, 1000);
          }
          return nextLives;
        });
      }
    }
  };

  const triggerExplosion = (ex: number, ey: number, color: string) => {
    const list = [...particlesRef.current];
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 3.8;
      list.push({
        x: ex,
        y: ey,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color.includes('rgb') ? color : hexToRgb(color),
        alpha: 1,
        life: 20 + Math.random() * 15,
      });
    }
    particlesRef.current = list;
  };

  const hexToRgb = (hex: string): string => {
    if (hex.startsWith('rgba')) return hex;
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return `rgb(${r}, ${g}, ${b})`;
  };

  const finishGame = async () => {
    const timeTaken = Date.now() - startTime.current;
    const accuracy = score > 0 ? Math.min(100, Math.round((level / (level + (3 - lives))) * 100)) : 0;
    const rawScore = Math.min(100, Math.round((score / 1.7) * (accuracy / 100)));

    const game = await getGameBySlug('word-gravity');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'word-gravity',
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
        <h1 className="page-title">🧠 Word Gravity</h1>
        <p className="page-subtitle">Decelerate falling terminology: drag vocabulary capsules into their correct semantic landing bays before impact!</p>
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
            <h3 style={{ color: 'var(--neon-cyan)', marginBottom: '8px' }}>Gravity Chamber Protocols:</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Study the descending word capsule falling from the top.</li>
              <li>Press and hold down cursor or finger to pick it up.</li>
              <li>Drag the capsule into the correct semantic meaning zone at the bottom grid.</li>
              <li>Allowing capsules to cross the lower red shield boundary severs synchronization.</li>
            </ul>
          </div>
          <button className="btn btn-primary btn-lg" onClick={startNewGame}>
            Charge Gravity Core
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="game-area">
          <div className="game-stats" style={{ marginBottom: '16px' }}>
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
              <div className="game-stat-label">Core Integrity</div>
            </div>
          </div>

          {/* Interactive Gravity Canvas */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '450px',
              aspectRatio: '450/500',
              margin: '0 auto',
              borderRadius: '10px',
              border: '2px solid var(--border)',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
              userSelect: 'none',
              touchAction: 'none',
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
              }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />

            {/* Error / Success / Crash Overlays */}
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
                  background:
                    feedback === 'correct'
                      ? 'rgba(0, 255, 102, 0.12)'
                      : feedback === 'wrong'
                      ? 'rgba(255, 0, 127, 0.18)'
                      : 'rgba(255, 0, 127, 0.25)',
                  pointerEvents: 'none',
                  border:
                    feedback === 'correct'
                      ? '3px solid #00ff66'
                      : '3px solid var(--danger)',
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: '1.8rem',
                    fontWeight: 'bold',
                    color: feedback === 'correct' ? '#00ff66' : 'var(--danger)',
                    textShadow: `0 0 10px ${feedback === 'correct' ? '#00ff66' : 'var(--danger)'}`,
                    textAlign: 'center',
                  }}
                >
                  {feedback === 'correct' && '✓ CORE CALIBRATED'}
                  {feedback === 'wrong' && '✗ CORRUPT DISCHARGE'}
                  {feedback === 'crash' && '💥 SHIELD SHATTERS\nCAPSULE IMPACT'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Gravity Fields Stabilized
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
              <div className="game-stat-label">Categorize Precision</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Re-ignite Gravity Core
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
