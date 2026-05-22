import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

type SortRule = 'even-odd' | 'threshold' | 'multiple-5';

interface SortRuleDetails {
  type: SortRule;
  labelLeft: string;
  labelRight: string;
  ruleDesc: string;
  test: (num: number) => 'left' | 'right';
}

const RULES: SortRuleDetails[] = [
  {
    type: 'even-odd',
    labelLeft: 'EVEN',
    labelRight: 'ODD',
    ruleDesc: 'Even numbers go Left. Odd numbers go Right.',
    test: (num) => (num % 2 === 0 ? 'left' : 'right'),
  },
  {
    type: 'threshold',
    labelLeft: '< 50',
    labelRight: '≥ 50',
    ruleDesc: 'Numbers less than 50 go Left. 50 or greater go Right.',
    test: (num) => (num < 50 ? 'left' : 'right'),
  },
  {
    type: 'multiple-5',
    labelLeft: 'DIVISIBLE BY 5',
    labelRight: 'OTHER',
    ruleDesc: 'Numbers divisible by 5 go Left. Others go Right.',
    test: (num) => (num % 5 === 0 ? 'left' : 'right'),
  },
];

export default function RapidSortGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [currentRule, setCurrentRule] = useState<SortRuleDetails>(RULES[0]);
  const [currentNumber, setCurrentNumber] = useState<number>(0);
  const [fallingProgress, setFallingProgress] = useState(0); // 0 to 100%
  const [sortDirection, setSortDirection] = useState<'left' | 'right' | null>(null);
  
  const [avgReactionTime, setAvgReactionTime] = useState(0);
  const [hitsCount, setHitsCount] = useState(0);
  const [result, setResult] = useState<any>(null);

  const reactionTimes = useRef<number[]>([]);
  const startTime = useRef(Date.now());
  const roundStartTimeRef = useRef(Date.now());
  
  const gameTimerRef = useRef<any>(null);
  const consecutiveHitsRef = useRef(0);

  // Key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'playing' || sortDirection !== null) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleSort('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleSort('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stopTimer();
    };
  }, [phase, currentNumber, sortDirection, currentRule]);

  const stopTimer = () => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
  };

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setAvgReactionTime(0);
    setHitsCount(0);
    reactionTimes.current = [];
    consecutiveHitsRef.current = 0;
    
    // Choose starting rule
    setCurrentRule(RULES[0]);
    
    startTime.current = Date.now();
    setPhase('playing');
    
    setTimeout(() => {
      spawnNumber(1);
    }, 200);
  };

  const spawnNumber = (lvl: number) => {
    stopTimer();
    setSortDirection(null);
    setFallingProgress(0);

    // Pick a number
    // Easy: 1 to 99. Hard: can include negative or three-digit numbers!
    let nextNum = Math.floor(Math.random() * 90) + 10; // 10 to 99
    if (difficulty === 'hard') {
      nextNum = Math.floor(Math.random() * 200) - 50; // -50 to 149
    }
    
    // Choose rule dynamically based on level
    let ruleIdx = 0;
    if (lvl >= 5) {
      ruleIdx = Math.floor(Math.random() * RULES.length);
    } else if (lvl >= 3) {
      ruleIdx = 1;
    }
    
    setCurrentRule(RULES[ruleIdx]);
    setCurrentNumber(nextNum);
    
    roundStartTimeRef.current = Date.now();

    // Determine fall speed duration
    // Stays longer on easy, shrinks rapidly as level grows
    const duration = Math.max(
      800,
      (difficulty === 'easy' ? 4500 : difficulty === 'medium' ? 3200 : 2200) - lvl * 100
    );

    const intervalStep = 20; // update progress every 20ms
    const totalSteps = duration / intervalStep;
    let currentStep = 0;

    gameTimerRef.current = setInterval(() => {
      currentStep++;
      const progress = (currentStep / totalSteps) * 100;
      setFallingProgress(progress);

      if (progress >= 100) {
        stopTimer();
        handleMiss();
      }
    }, intervalStep);
  };

  const handleMiss = () => {
    setSortDirection(null);
    
    setLives(l => {
      const nextLives = l - 1;
      if (nextLives <= 0) {
        setTimeout(finishGame, 600);
      } else {
        setTimeout(() => spawnNumber(level), 800);
      }
      return nextLives;
    });
  };

  const handleSort = (dir: 'left' | 'right') => {
    if (sortDirection !== null) return;
    stopTimer();
    
    setSortDirection(dir);
    
    const reactionTime = Date.now() - roundStartTimeRef.current;
    reactionTimes.current.push(reactionTime);

    // Average speeds
    const sum = reactionTimes.current.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / reactionTimes.current.length);
    setAvgReactionTime(avg);

    // Test correct answer
    const correctDir = currentRule.test(currentNumber);
    const correct = dir === correctDir;

    if (correct) {
      setHitsCount(h => h + 1);
      
      const duration = Math.max(
        800,
        (difficulty === 'easy' ? 4500 : difficulty === 'medium' ? 3200 : 2200) - level * 100
      );
      const points = Math.max(10, Math.round(((duration - reactionTime) / 20) * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : 2)));
      setScore(s => s + points);

      consecutiveHitsRef.current += 1;
      
      // Level up every 8 successful sorts
      if (consecutiveHitsRef.current >= 8) {
        setLevel(l => l + 1);
        consecutiveHitsRef.current = 0;
      }

      setTimeout(() => spawnNumber(level), 400);
    } else {
      consecutiveHitsRef.current = 0;
      setLives(l => {
        const nextLives = l - 1;
        if (nextLives <= 0) {
          setTimeout(finishGame, 600);
        } else {
          setTimeout(() => spawnNumber(level), 800);
        }
        return nextLives;
      });
    }
  };

  const finishGame = async () => {
    stopTimer();
    const timeTaken = Date.now() - startTime.current;
    
    const misses = 3 - lives;
    const totalCount = hitsCount + misses;
    const accuracy = totalCount > 0 ? Math.round((hitsCount / totalCount) * 100) : 0;
    
    // Cognitive score (max 100)
    const speedFactor = avgReactionTime > 0 ? Math.max(10, 800 - avgReactionTime) / 8 : 10;
    const rawScore = Math.min(100, Math.round((hitsCount * 2 + speedFactor) * (accuracy / 100)));

    const game = await getGameBySlug('rapid-sort');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'rapid-sort',
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
        <h1 className="page-title">🔢 Rapid Sort</h1>
        <p className="page-subtitle">Sort falling numbers into correct category gates. Quick decisions avoid system crashes!</p>
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
            De-fragment Sort Gates
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
                {avgReactionTime > 0 ? `${avgReactionTime}ms` : '---'}
              </div>
              <div className="game-stat-label">Decision Speed</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--danger)' }}>
                {'❤️'.repeat(lives)}
                {lives < 3 && <span style={{ opacity: 0.25 }}>{'🖤'.repeat(3 - lives)}</span>}
              </div>
              <div className="game-stat-label">Core Integrity</div>
            </div>
          </div>

          {/* Active sorting rule details */}
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 204, 0, 0.05)',
              border: '1px dashed var(--gold)',
              color: 'var(--gold)',
              fontSize: '0.9rem',
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: '20px',
              boxShadow: '0 0 10px rgba(255, 204, 0, 0.05)',
            }}
          >
            RULE: {currentRule.ruleDesc}
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '400px',
              height: '350px',
              background: '#04050e',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            {/* Categorization Gates (Left vs Right) */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '120px',
                height: '100%',
                background: 'linear-gradient(to right, rgba(0, 240, 255, 0.05), transparent)',
                borderRight: '1px dashed rgba(0, 240, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  color: 'var(--neon-cyan)',
                  textShadow: '0 0 8px var(--neon-cyan)',
                  transform: 'rotate(-90deg)',
                  whiteSpace: 'nowrap',
                }}
              >
                ◀ {currentRule.labelLeft}
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '120px',
                height: '100%',
                background: 'linear-gradient(to left, rgba(255, 0, 127, 0.05), transparent)',
                borderLeft: '1px dashed rgba(255, 0, 127, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  color: '#ff007f',
                  textShadow: '0 0 8px #ff007f',
                  transform: 'rotate(90deg)',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentRule.labelRight} ▶
              </div>
            </div>

            {/* Falling numeric capsule */}
            {sortDirection === null ? (
              <div
                style={{
                  position: 'absolute',
                  top: `${fallingProgress}%`,
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  padding: '14px 24px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#0e1123',
                  border: '2px solid var(--border)',
                  color: '#ffffff',
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                  transition: 'top 0.03s linear',
                  userSelect: 'none',
                }}
              >
                {currentNumber}
              </div>
            ) : (
              /* Fly off animation */
              <div
                style={{
                  position: 'absolute',
                  top: `${fallingProgress}%`,
                  left: sortDirection === 'left' ? '15%' : '85%',
                  transform: 'translate(-50%, -50%) scale(0.8)',
                  padding: '14px 24px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#0e1123',
                  border: `2px solid ${
                    currentRule.test(currentNumber) === sortDirection ? '#00ff66' : 'var(--danger)'
                  }`,
                  color: '#ffffff',
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                  transition: 'all 0.3s ease-out',
                  opacity: 0,
                  userSelect: 'none',
                }}
              >
                {currentNumber}
              </div>
            )}
          </div>

          {/* User sorting action buttons */}
          <div style={{ display: 'flex', gap: '20px', width: '100%', maxWidth: '400px', marginTop: '16px' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px 0', fontSize: '1.2rem', fontWeight: 'bold' }}
              disabled={sortDirection !== null}
              onClick={() => handleSort('left')}
            >
              ◀ SORT LEFT
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px 0', fontSize: '1.2rem', fontWeight: 'bold' }}
              disabled={sortDirection !== null}
              onClick={() => handleSort('right')}
            >
              SORT RIGHT ▶
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Categorization Sync Done
          </h2>
          <div className="results-score">+{result.final_score} pts</div>

          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.hitsCount}</div>
              <div className="game-stat-label">Sorted Correctly</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--neon-cyan)' }}>
                {result.avgReactionTime}ms
              </div>
              <div className="game-stat-label">Sort Speed</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.accuracy}%</div>
              <div className="game-stat-label">Precision Index</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Re-initialize Sort Gates
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
