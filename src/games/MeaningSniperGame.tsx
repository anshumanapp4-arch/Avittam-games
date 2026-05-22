import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface VocabItem {
  word: string;
  definition: string;
  synonyms: string[];
  category: string;
}

const VOCAB_DATABASE: VocabItem[] = [
  {
    word: 'ephemeral',
    definition: 'Lasting for a very short time; fleeting or temporary.',
    synonyms: ['fleeting', 'transitory', 'brief', 'temporary'],
    category: 'Time & Change',
  },
  {
    word: 'cacophony',
    definition: 'A harsh, discordant mixture of sounds.',
    synonyms: ['noise', 'discord', 'clamor', 'racket'],
    category: 'Energy & Sensation',
  },
  {
    word: 'altruistic',
    definition: 'Showing selfless concern for the well-being of others.',
    synonyms: ['unselfish', 'philanthropic', 'benevolent', 'generous'],
    category: 'Attributes',
  },
  {
    word: 'sagacious',
    definition: 'Having or showing keen mental discernment and good judgment; wise.',
    synonyms: ['wise', 'shrewd', 'astute', 'perceptive'],
    category: 'Intellect',
  },
  {
    word: 'loquacious',
    definition: 'Tending to talk a great deal; extremely talkative.',
    synonyms: ['talkative', 'chatty', 'verbose', 'wordy'],
    category: 'Speech & Sound',
  },
  {
    word: 'capricious',
    definition: 'Given to sudden and unpredictable changes of mood or behavior.',
    synonyms: ['fickle', 'inconstant', 'unpredictable', 'volatile'],
    category: 'Time & Change',
  },
  {
    word: 'malevolent',
    definition: 'Having or showing a wish to do evil to others.',
    synonyms: ['hostile', 'spiteful', 'malicious', 'vindictive'],
    category: 'Attributes',
  },
  {
    word: 'superfluous',
    definition: 'Unnecessary, especially through being more than enough.',
    synonyms: ['redundant', 'excessive', 'unnecessary', 'surplus'],
    category: 'Time & Change',
  },
  {
    word: 'venerable',
    definition: 'Accorded a great deal of respect, especially because of age or wisdom.',
    synonyms: ['respected', 'distinguished', 'esteemed', 'honored'],
    category: 'Intellect',
  },
  {
    word: 'ostentatious',
    definition: 'Pretentious, showy, or designed to impress or attract notice.',
    synonyms: ['showy', 'pretentious', 'flamboyant', 'gaudy'],
    category: 'Energy & Sensation',
  },
  {
    word: 'melancholy',
    definition: 'A deep, pensive, and long-lasting sadness or gloom.',
    synonyms: ['sadness', 'sorrow', 'gloom', 'dejection'],
    category: 'Attributes',
  },
  {
    word: 'jubilant',
    definition: 'Feeling or expressing great happiness and triumph.',
    synonyms: ['joyful', 'ecstatic', 'triumphant', 'elated'],
    category: 'Attributes',
  },
  {
    word: 'taciturn',
    definition: 'Reserved or uncommunicative in speech; saying little.',
    synonyms: ['silent', 'reserved', 'reticent', 'quiet'],
    category: 'Speech & Sound',
  },
  {
    word: 'alacrity',
    definition: 'Brisk and cheerful readiness; eager speed.',
    synonyms: ['eagerness', 'readiness', 'enthusiasm', 'speed'],
    category: 'Energy & Sensation',
  },
  {
    word: 'erudite',
    definition: 'Having or showing great knowledge or learning; scholarly.',
    synonyms: ['scholarly', 'learned', 'academic', 'knowledgeable'],
    category: 'Intellect',
  },
];

interface FloatingTarget {
  id: string;
  word: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isCorrect: boolean;
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

interface LaserBeam {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  life: number;
}

export default function MeaningSniperGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(12);

  const [activeItem, setActiveItem] = useState<VocabItem | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | null>(null);

  const [result, setResult] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const targetsRef = useRef<FloatingTarget[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lasersRef = useRef<LaserBeam[]>([]);

  const startTime = useRef(Date.now());
  const roundStartTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef<any>(null);

  const canvasWidth = 600;
  const canvasHeight = 450;

  // Initialize new sniper round with randomized floating words
  const generateSniperTargets = (lvl: number, currentItem: VocabItem) => {
    const list: FloatingTarget[] = [];
    
    // Choose distractor words
    const distractors = VOCAB_DATABASE.filter(item => item.word !== currentItem.word);
    const shuffledDistractors = [...distractors].sort(() => 0.5 - Math.random());
    
    // Total targets based on difficulty
    let targetCount = 3;
    if (difficulty === 'medium') targetCount = 4;
    else if (difficulty === 'hard') targetCount = 5;

    const chosenWords = [
      { word: currentItem.word, isCorrect: true },
      ...shuffledDistractors.slice(0, targetCount - 1).map(d => ({ word: d.word, isCorrect: false })),
    ].sort(() => 0.5 - Math.random());

    // Generate non-overlapping start coordinates with randomized velocities
    chosenWords.forEach((item, index) => {
      const angle = (index / chosenWords.length) * Math.PI * 2;
      const x = canvasWidth / 2 + Math.cos(angle) * 140;
      const y = canvasHeight / 2 + Math.sin(angle) * 110;

      // Speed scales up with levels
      const speed = (difficulty === 'easy' ? 0.7 : difficulty === 'medium' ? 1.2 : 1.8) + (lvl * 0.05);
      const moveAngle = Math.random() * Math.PI * 2;
      const vx = Math.cos(moveAngle) * speed;
      const vy = Math.sin(moveAngle) * speed;

      list.push({
        id: `target-${index}-${Date.now()}`,
        word: item.word,
        x,
        y,
        vx,
        vy,
        radius: 44, // width of capsule box
        isCorrect: item.isCorrect,
      });
    });

    targetsRef.current = list;
    lasersRef.current = [];
    setFeedback(null);
    roundStartTimeRef.current = Date.now();
  };

  // HTML5 Canvas draw loop
  useEffect(() => {
    if (phase !== 'playing') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.fillStyle = '#04050d';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 1. Draw radar sweep lines in background
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.035)';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.arc(canvasWidth / 2, canvasHeight / 2, 80, 0, Math.PI * 2);
      ctx.arc(canvasWidth / 2, canvasHeight / 2, 160, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(canvasWidth / 2, 0);
      ctx.lineTo(canvasWidth / 2, canvasHeight);
      ctx.moveTo(0, canvasHeight / 2);
      ctx.lineTo(canvasWidth, canvasHeight / 2);
      ctx.stroke();

      // Sweeping radar wedge animation
      const sweepAngle = (Date.now() * 0.001) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvasWidth / 2, canvasHeight / 2);
      ctx.lineTo(
        canvasWidth / 2 + Math.cos(sweepAngle) * 220,
        canvasHeight / 2 + Math.sin(sweepAngle) * 220
      );
      ctx.stroke();

      // 2. Draw active lasers
      lasersRef.current.forEach((laser) => {
        laser.life--;
        ctx.strokeStyle = `rgba(0, 240, 255, ${laser.life / 10})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(laser.startX, laser.startY);
        ctx.lineTo(laser.endX, laser.endY);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 255, 255, ${laser.life / 10})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(laser.startX, laser.startY);
        ctx.lineTo(laser.endX, laser.endY);
        ctx.stroke();
      });
      lasersRef.current = lasersRef.current.filter(l => l.life > 0);

      // 3. Update and draw floating words
      targetsRef.current.forEach(t => {
        // Move target
        t.x += t.vx;
        t.y += t.vy;

        // Bounce off walls
        const borderPadding = 50;
        if (t.x < borderPadding || t.x > canvasWidth - borderPadding) {
          t.vx *= -1;
          t.x = t.x < borderPadding ? borderPadding : canvasWidth - borderPadding;
        }
        if (t.y < borderPadding || t.y > canvasHeight - borderPadding) {
          t.vy *= -1;
          t.y = t.y < borderPadding ? borderPadding : canvasHeight - borderPadding;
        }

        // Draw capsule structure
        const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.04;
        const width = 85 * pulse;
        const height = 28;

        // Capsule boundary glow
        ctx.shadowColor = 'var(--neon-cyan)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(4, 5, 13, 0.85)';
        ctx.strokeStyle = 'var(--neon-cyan)';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.roundRect(t.x - width / 2, t.y - height / 2, width, height, 14);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Tactical Corner ticks
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // top left corner ticks
        ctx.moveTo(t.x - width / 2 - 2, t.y - height / 2 + 5);
        ctx.lineTo(t.x - width / 2 - 2, t.y - height / 2 - 2);
        ctx.lineTo(t.x - width / 2 + 5, t.y - height / 2 - 2);
        // bottom right corner ticks
        ctx.moveTo(t.x + width / 2 + 2, t.y + height / 2 - 5);
        ctx.lineTo(t.x + width / 2 + 2, t.y + height / 2 + 2);
        ctx.lineTo(t.x + width / 2 - 5, t.y + height / 2 + 2);
        ctx.stroke();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.word, t.x, t.y);
      });

      // 4. Update and draw particles
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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [phase, activeItem, difficulty]);

  // Round Timer Countdown Loop
  useEffect(() => {
    if (phase !== 'playing' || feedback !== null) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      return;
    }

    setTimeLeft(12);
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
  }, [phase, activeItem, feedback]);

  const handleTimeout = () => {
    setFeedback('timeout');
    setLives(l => {
      const nextLives = l - 1;
      if (nextLives <= 0) {
        setTimeout(finishGame, 1000);
      } else {
        setTimeout(nextRound, 1000);
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
    
    // Choose initial vocab word
    const initialItem = VOCAB_DATABASE[Math.floor(Math.random() * VOCAB_DATABASE.length)];
    setActiveItem(initialItem);
    generateSniperTargets(1, initialItem);
  };

  const nextRound = () => {
    setFeedback(null);
    const nextItem = VOCAB_DATABASE[Math.floor(Math.random() * VOCAB_DATABASE.length)];
    setActiveItem(nextItem);
    generateSniperTargets(level, nextItem);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing' || feedback !== null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvasHeight;

    // Fire laser from bottom-center
    lasersRef.current.push({
      startX: canvasWidth / 2,
      startY: canvasHeight,
      endX: clickX,
      endY: clickY,
      life: 10,
    });

    // Check click collision with targets
    let hitFound = false;
    targetsRef.current.forEach(t => {
      // Box range collision check (approximate capsule bounds)
      const isInside = Math.abs(clickX - t.x) <= 45 && Math.abs(clickY - t.y) <= 15;

      if (isInside) {
        hitFound = true;
        triggerExplosion(t.x, t.y, t.isCorrect ? '#00f0ff' : '#ff007f');

        if (t.isCorrect) {
          setFeedback('correct');
          const reactionTime = Date.now() - roundStartTimeRef.current;
          const points = Math.max(15, Math.round((12000 - reactionTime) / 100 * (difficulty === 'easy' ? 1.0 : difficulty === 'medium' ? 1.6 : 2.5)));
          setScore(s => s + points);
          setLevel(l => l + 1);

          setTimeout(nextRound, 1000);
        } else {
          setFeedback('wrong');
          setLives(l => {
            const nextLives = l - 1;
            if (nextLives <= 0) {
              setTimeout(finishGame, 1000);
            } else {
              setTimeout(nextRound, 1000);
            }
            return nextLives;
          });
        }
      }
    });

    if (!hitFound) {
      // Clicked raw black empty space -> missed laser fire
      triggerExplosion(clickX, clickY, 'rgba(255,255,255,0.2)');
    }
  };

  const triggerExplosion = (ex: number, ey: number, color: string) => {
    const list = [...particlesRef.current];
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
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

    const game = await getGameBySlug('meaning-sniper');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'meaning-sniper',
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
    <div className="game-container" style={{ maxWidth: '700px' }}>
      <div className="game-header">
        <h1 className="page-title">🎯 Meaning Sniper</h1>
        <p className="page-subtitle">Shoot floating vocabulary capsules that match the active definition under pressure!</p>
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
            <h3 style={{ color: 'var(--neon-cyan)', marginBottom: '8px' }}>Sniper Targeting System:</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Analyze the semantic definition box glowing at the top of the interface.</li>
              <li>Trace floating tech capsules traveling across the radar screen.</li>
              <li>Left-click/Tap on the capsule labeled with the correct matching word.</li>
              <li>Incorrect hits or letting the countdown run dry drains shields.</li>
            </ul>
          </div>
          <button className="btn btn-primary btn-lg" onClick={startNewGame}>
            Synchronize Scopes
          </button>
        </div>
      )}

      {phase === 'playing' && activeItem && (
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
              <div className="game-stat-label">Shield HP</div>
            </div>
          </div>

          {/* Glowing Definition Box */}
          <div
            style={{
              width: '100%',
              background: 'rgba(0, 240, 255, 0.05)',
              border: '1.5px solid var(--border)',
              borderRadius: '8px',
              padding: '14px 20px',
              marginBottom: '16px',
              boxShadow: '0 4px 15px rgba(0,240,255,0.05)',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#ff007f', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>
              TARGET DESCRIPTION INCOMING:
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffffff', textShadow: '0 0 5px rgba(255,255,255,0.5)' }}>
              "{activeItem.definition}"
            </div>
          </div>

          {/* Time Bar */}
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '16px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(timeLeft / 12) * 100}%`,
                height: '100%',
                background: timeLeft > 3 ? 'var(--neon-cyan)' : 'var(--danger)',
                boxShadow: `0 0 8px ${timeLeft > 3 ? 'var(--neon-cyan)' : 'var(--danger)'}`,
                transition: 'width 1s linear',
              }}
            />
          </div>

          {/* Radar Screen Target Range */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '600px',
              aspectRatio: '600/450',
              margin: '0 auto',
              borderRadius: '10px',
              border: '2px solid var(--border)',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
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
                cursor: 'crosshair',
              }}
              onClick={handleCanvasClick}
            />

            {/* Visual Feedback Alerts */}
            {feedback && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background:
                    feedback === 'correct'
                      ? 'rgba(0, 255, 102, 0.12)'
                      : 'rgba(255, 0, 127, 0.18)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  border: feedback === 'correct' ? '3px solid #00ff66' : '3px solid var(--danger)',
                  borderRadius: '8px',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    fontSize: '2.2rem',
                    fontWeight: 'bold',
                    color: feedback === 'correct' ? '#00ff66' : 'var(--danger)',
                    textShadow: `0 0 10px ${feedback === 'correct' ? '#00ff66' : 'var(--danger)'}`,
                  }}
                >
                  {feedback === 'correct' && '🎯 TARGET DESTROYED'}
                  {feedback === 'wrong' && '✗ CORRUPT TARGET HIT'}
                  {feedback === 'timeout' && '⏰ TARGET SYSTEM JAMMED'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Radar Sweep Auditing Completed
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
              <div className="game-stat-label">Precision Rate</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Reload Battery
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
