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
    category: 'Sensation',
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
    category: 'Sensation',
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
    category: 'Sensation',
  },
  {
    word: 'erudite',
    definition: 'Having or showing great knowledge or learning; scholarly.',
    synonyms: ['scholarly', 'learned', 'academic', 'knowledgeable'],
    category: 'Intellect',
  },
];

interface MazeNode {
  x: number; // grid x
  y: number; // grid y
  isVisited: boolean;
  label?: string; // word displayed on connecting line
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

export default function WordMazeGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);

  const [mazeSize, setMazeSize] = useState(3); // 3x3 grid size
  const [pathSteps, setPathSteps] = useState<MazeNode[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [activeItem, setActiveItem] = useState<VocabItem | null>(null);
  const [adjacentOptions, setAdjacentOptions] = useState<{ node: MazeNode; word: string; isCorrect: boolean }[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'victory' | null>(null);

  const [result, setResult] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  const startTime = useRef(Date.now());
  const roundStartTimeRef = useRef(Date.now());

  const canvasWidth = 460;
  const canvasHeight = 460;

  // Build grid layout and linear winding path to the exit
  const generateMazePath = () => {
    // Grid size depends on difficulty
    const size = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5;
    setMazeSize(size);

    // Generate procedural stair-step path from (0, 0) to (size - 1, size - 1)
    const steps: MazeNode[] = [{ x: 0, y: 0, isVisited: true }];
    let cx = 0;
    let cy = 0;

    while (cx < size - 1 || cy < size - 1) {
      const moveRight = Math.random() > 0.5;

      if (moveRight && cx < size - 1) {
        cx++;
      } else if (cy < size - 1) {
        cy++;
      } else {
        cx++;
      }
      steps.push({ x: cx, y: cy, isVisited: false });
    }

    setPathSteps(steps);
    setCurrentStepIndex(0);
    loadNextJunction(0, steps, size);
  };

  // Compile valid directions and assign synonyms or distractors to paths
  const loadNextJunction = (stepIdx: number, stepsList: MazeNode[], size: number) => {
    const currentNode = stepsList[stepIdx];
    const nextNode = stepsList[stepIdx + 1]; // correct node along solution path

    // Load a new vocabulary word
    const nextVocabItem = VOCAB_DATABASE[Math.floor(Math.random() * VOCAB_DATABASE.length)];
    setActiveItem(nextVocabItem);

    // Pick a correct synonym
    const synonym = nextVocabItem.synonyms[Math.floor(Math.random() * nextVocabItem.synonyms.length)];

    // Fetch distractor words
    const otherItems = VOCAB_DATABASE.filter(item => item.word !== nextVocabItem.word);
    const distractorWords: string[] = [];
    otherItems.forEach(item => distractorWords.push(...item.synonyms));
    const shuffledDistractors = Array.from(new Set(distractorWords))
      .filter(w => !nextVocabItem.synonyms.includes(w))
      .sort(() => 0.5 - Math.random());

    // Check adjacent directions in grid (Up, Down, Left, Right)
    const options: { node: MazeNode; word: string; isCorrect: boolean }[] = [];
    const directions = [
      { dx: 1, dy: 0 },  // Right
      { dx: 0, dy: 1 },  // Down
      { dx: -1, dy: 0 }, // Left
      { dx: 0, dy: -1 }, // Up
    ];

    let distractorIdx = 0;

    directions.forEach(dir => {
      const nx = currentNode.x + dir.dx;
      const ny = currentNode.y + dir.dy;

      // Inside grid boundaries
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        // Is this the correct next node?
        if (nextNode && nx === nextNode.x && ny === nextNode.y) {
          options.push({
            node: { x: nx, y: ny, isVisited: false },
            word: synonym,
            isCorrect: true,
          });
        } else {
          // Verify it's not a previously visited path
          const isVisited = stepsList.slice(0, stepIdx + 1).some(s => s.x === nx && s.y === ny);
          if (!isVisited) {
            options.push({
              node: { x: nx, y: ny, isVisited: false },
              word: shuffledDistractors[distractorIdx] || 'brief',
              isCorrect: false,
            });
            distractorIdx++;
          }
        }
      }
    });

    setAdjacentOptions(options);
    setFeedback(null);
    roundStartTimeRef.current = Date.now();
  };

  // Canvas Render loop
  useEffect(() => {
    if (phase !== 'playing' || pathSteps.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      ctx.fillStyle = '#04050d';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const margin = 50;
      const spacing = (canvasWidth - margin * 2) / (mazeSize - 1);

      // Helper to convert grid coords to canvas pixels
      const getPixelCoords = (gx: number, gy: number) => ({
        px: margin + gx * spacing,
        py: margin + gy * spacing,
      });

      // 1. Draw structural grid lines connecting all adjacent nodes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      for (let i = 0; i < mazeSize; i++) {
        const startH = getPixelCoords(0, i);
        const endH = getPixelCoords(mazeSize - 1, i);
        ctx.beginPath();
        ctx.moveTo(startH.px, startH.py);
        ctx.lineTo(endH.px, endH.py);
        ctx.stroke();

        const startV = getPixelCoords(i, 0);
        const endV = getPixelCoords(i, mazeSize - 1);
        ctx.beginPath();
        ctx.moveTo(startV.px, startV.py);
        ctx.lineTo(endV.px, endV.py);
        ctx.stroke();
      }

      // 2. Draw explored path segments
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let i = 0; i <= currentStepIndex; i++) {
        const pt = getPixelCoords(pathSteps[i].x, pathSteps[i].y);
        if (i === 0) ctx.moveTo(pt.px, pt.py);
        else ctx.lineTo(pt.px, pt.py);
      }
      ctx.stroke();

      // 3. Draw adjacent option paths with neon text labels
      adjacentOptions.forEach(opt => {
        const startPt = getPixelCoords(pathSteps[currentStepIndex].x, pathSteps[currentStepIndex].y);
        const endPt = getPixelCoords(opt.node.x, opt.node.y);

        // Path glow link
        ctx.strokeStyle = feedback === null ? 'rgba(255, 204, 0, 0.35)' : 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startPt.px, startPt.py);
        ctx.lineTo(endPt.px, endPt.py);
        ctx.stroke();

        // Label box background
        const midX = (startPt.px + endPt.px) / 2;
        const midY = (startPt.py + endPt.py) / 2;
        const textW = ctx.measureText(opt.word).width + 8;
        
        ctx.fillStyle = '#04050d';
        ctx.fillRect(midX - textW / 2, midY - 9, textW, 18);

        // Word Label
        ctx.fillStyle = feedback === null ? '#ffcc00' : 'rgba(255, 255, 255, 0.15)';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opt.word, midX, midY);
      });

      // 4. Draw Maze Nodes
      for (let gx = 0; gx < mazeSize; gx++) {
        for (let gy = 0; gy < mazeSize; gy++) {
          const pt = getPixelCoords(gx, gy);
          
          // Verify if inside visited path
          const isVisited = pathSteps.slice(0, currentStepIndex + 1).some(s => s.x === gx && s.y === gy);
          const isExitNode = gx === mazeSize - 1 && gy === mazeSize - 1;

          ctx.shadowBlur = isVisited ? 6 : 0;
          ctx.shadowColor = isExitNode ? '#ff007f' : 'var(--neon-cyan)';

          ctx.fillStyle = isVisited 
            ? 'var(--neon-cyan)' 
            : isExitNode 
            ? 'rgba(255, 0, 127, 0.25)' 
            : 'rgba(255,255,255,0.06)';
          
          ctx.beginPath();
          ctx.arc(pt.px, pt.py, isExitNode ? 10 : 6, 0, Math.PI * 2);
          ctx.fill();

          if (isExitNode) {
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.shadowBlur = 0; // reset
        }
      }

      // 5. Draw active glowing user ship token
      const currentPt = getPixelCoords(pathSteps[currentStepIndex].x, pathSteps[currentStepIndex].y);
      const pulse = 9 + Math.sin(Date.now() * 0.008) * 2;
      
      ctx.shadowColor = 'var(--gold)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'var(--gold)';
      ctx.beginPath();
      ctx.arc(currentPt.px, currentPt.py, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      // 6. Update and draw particles
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

      animationRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [phase, pathSteps, currentStepIndex, adjacentOptions, mazeSize, feedback]);

  const handleStartGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setResult(null);
    setFeedback(null);
    startTime.current = Date.now();
    setPhase('playing');
    generateMazePath();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing' || feedback !== null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvasHeight;

    const margin = 50;
    const spacing = (canvasWidth - margin * 2) / (mazeSize - 1);

    // Check click distance to adjacent nodes
    adjacentOptions.forEach(opt => {
      const nodeX = margin + opt.node.x * spacing;
      const nodeY = margin + opt.node.y * spacing;
      const dist = Math.sqrt((clickX - nodeX) ** 2 + (clickY - nodeY) ** 2);

      if (dist <= 30) {
        // Tapped this option path!
        if (opt.isCorrect) {
          handleCorrectMove(opt.node);
        } else {
          handleWrongMove(nodeX, nodeY);
        }
      }
    });
  };

  const handleCorrectMove = (nextNode: MazeNode) => {
    const updatedSteps = [...pathSteps];
    const nextIdx = currentStepIndex + 1;
    updatedSteps[nextIdx].isVisited = true;
    setPathSteps(updatedSteps);
    setCurrentStepIndex(nextIdx);

    const margin = 50;
    const spacing = (canvasWidth - margin * 2) / (mazeSize - 1);
    const px = margin + nextNode.x * spacing;
    const py = margin + nextNode.y * spacing;
    triggerExplosion(px, py, 'rgba(0, 240, 255, 0.7)');

    // Check if reached exit portal
    if (nextIdx === pathSteps.length - 1) {
      handleMazeVictory();
    } else {
      setFeedback('correct');
      setTimeout(() => {
        loadNextJunction(nextIdx, updatedSteps, mazeSize);
      }, 800);
    }
  };

  const handleWrongMove = (px: number, py: number) => {
    setFeedback('wrong');
    triggerExplosion(px, py, 'rgba(255, 0, 127, 0.8)');

    setLives(l => {
      const nextLives = l - 1;
      if (nextLives <= 0) {
        setTimeout(finishGame, 1000);
      } else {
        setTimeout(() => {
          setFeedback(null);
        }, 1000);
      }
      return nextLives;
    });
  };

  const handleMazeVictory = () => {
    setFeedback('victory');
    const reactionTime = Date.now() - roundStartTimeRef.current;
    const points = Math.max(30, Math.round((24000 - reactionTime) / 100 * (difficulty === 'easy' ? 1.0 : difficulty === 'medium' ? 1.7 : 2.7)));
    
    setScore(s => s + points);
    setLevel(l => l + 1);

    setTimeout(() => {
      generateMazePath();
    }, 1000);
  };

  const triggerExplosion = (ex: number, ey: number, color: string) => {
    const list = [...particlesRef.current];
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.5;
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
    const rawScore = Math.min(100, Math.round((score / 1.8) * (accuracy / 100)));

    const game = await getGameBySlug('word-maze');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'word-maze',
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
        <h1 className="page-title">🧩 Word Maze Escape</h1>
        <p className="page-subtitle">Navigate the neon network: choose adjacent pathway lines representing correct synonyms to escape the grid!</p>
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
            <h3 style={{ color: 'var(--neon-cyan)', marginBottom: '8px' }}>Labyrinth Exit Protocols:</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Find your location: you are the glowing gold orb token.</li>
              <li>Read the target concept panel to see the active keyword definition.</li>
              <li>Tapping adjacent nodes chooses a connecting pathway direction.</li>
              <li>Only paths labeled with authentic synonyms lead forward. Distractors trigger firewall alarms.</li>
            </ul>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleStartGame}>
            Synchronize Exit Nav
          </button>
        </div>
      )}

      {phase === 'playing' && activeItem && (
        <div className="game-area">
          <div className="game-stats" style={{ marginBottom: '16px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{level}</div>
              <div className="game-stat-label">Levels Cleared</div>
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

          {/* Central Target Keyword Panel */}
          <div
            style={{
              width: '100%',
              background: '#04050d',
              border: '2px solid var(--border)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '16px',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '4px' }}>
              ACTIVE SYNONYM KEYWORD:
            </div>
            <div
              style={{
                fontSize: '1.8rem',
                fontWeight: '900',
                color: '#ffffff',
                textShadow: '0 0 8px var(--neon-cyan)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '1px',
              }}
            >
              {activeItem.word.toUpperCase()}
            </div>
            <div style={{ marginTop: '6px', color: '#ff007f', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px' }}>
              DEFINED AS: "{activeItem.definition}"
            </div>
          </div>

          {/* Interactive Labyrinth Board */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '430px',
              aspectRatio: '1',
              margin: '0 auto',
              borderRadius: '12px',
              border: '2px solid var(--border)',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
              userSelect: 'none',
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
                cursor: feedback === null ? 'pointer' : 'default',
              }}
              onClick={handleCanvasClick}
            />

            {/* Error / Success Overlay alerts */}
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
                    feedback === 'victory'
                      ? 'rgba(0, 255, 102, 0.15)'
                      : feedback === 'correct'
                      ? 'rgba(0, 240, 255, 0.08)'
                      : 'rgba(255, 0, 127, 0.18)',
                  pointerEvents: 'none',
                  border:
                    feedback === 'victory'
                      ? '3px solid #00ff66'
                      : feedback === 'correct'
                      ? '3px solid var(--neon-cyan)'
                      : '3px solid var(--danger)',
                  borderRadius: '10px',
                }}
              >
                <div
                  style={{
                    fontSize: '1.8rem',
                    fontWeight: 'bold',
                    color:
                      feedback === 'victory'
                        ? '#00ff66'
                        : feedback === 'correct'
                        ? 'var(--neon-cyan)'
                        : 'var(--danger)',
                    textShadow: `0 0 10px ${
                      feedback === 'victory'
                        ? '#00ff66'
                        : feedback === 'correct'
                        ? 'var(--neon-cyan)'
                        : 'var(--danger)'
                    }`,
                    textAlign: 'center',
                    padding: '16px',
                  }}
                >
                  {feedback === 'victory' && '🎉 EXIT PORTAL BREACHED\nMAZE ESCAPED'}
                  {feedback === 'correct' && '✓ ROUTE STABILIZED'}
                  {feedback === 'wrong' && '✗ PATH CORRUPTED\nFIREWALL COLLISION'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Labyrinth Session Completed
          </h2>
          <div className="results-score">+{result.final_score} pts</div>

          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.level}</div>
              <div className="game-stat-label">Mazes Cleared</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.score}</div>
              <div className="game-stat-label">Total Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">
                {Math.round((result.level / (result.level + (3 - lives))) * 100)}%
              </div>
              <div className="game-stat-label">Calibration Prec</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Trace New Maze
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
