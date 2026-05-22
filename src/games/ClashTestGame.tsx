import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

type Rule = 'voice' | 'arrow';
type Direction = 'left' | 'right';

export default function ClashTestGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [currentRule, setCurrentRule] = useState<Rule>('arrow');
  const [arrowDir, setArrowDir] = useState<Direction>('left');
  const [voiceDir, setVoiceDir] = useState<Direction>('right');
  const [isRuleChanging, setIsRuleChanging] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  const [avgReactionTime, setAvgReactionTime] = useState(0);
  const [hitsCount, setHitsCount] = useState(0);
  const [result, setResult] = useState<any>(null);

  const reactionTimes = useRef<number[]>([]);
  const startTime = useRef(Date.now());
  const roundStartTimeRef = useRef(Date.now());
  const roundTimerRef = useRef<any>(null);
  const consecutiveRoundsRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'playing' || answered || isRuleChanging) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleResponse('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleResponse('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    };
  }, [phase, answered, isRuleChanging, arrowDir, voiceDir, currentRule]);

  const speakWord = (word: string) => {
    try {
      if ('speechSynthesis' in window) {
        // Cancel ongoing speech to prevent overlapping sounds
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.rate = 1.3; // speak slightly faster for responsiveness
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("Speech synthesis not supported or failed", e);
    }
  };

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setAvgReactionTime(0);
    setHitsCount(0);
    reactionTimes.current = [];
    consecutiveRoundsRef.current = 0;
    
    // Choose starting rule
    setCurrentRule(Math.random() > 0.5 ? 'voice' : 'arrow');
    
    startTime.current = Date.now();
    setPhase('playing');
    
    setTimeout(() => {
      startNewRound(true);
    }, 200);
  };

  const startNewRound = (forceRuleNotice = false) => {
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);

    setAnswered(false);
    setIsCorrect(null);

    // Determine if we switch rules
    // Rule changes every 4-6 rounds
    const roundsLimit = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 5 : 4;
    let shouldChangeRule = forceRuleNotice || (consecutiveRoundsRef.current >= roundsLimit);

    if (shouldChangeRule && !forceRuleNotice) {
      setCurrentRule(prev => (prev === 'voice' ? 'arrow' : 'voice'));
      consecutiveRoundsRef.current = 0;
    }

    if (shouldChangeRule) {
      setIsRuleChanging(true);
      const nextRule = forceRuleNotice ? currentRule : (currentRule === 'voice' ? 'arrow' : 'voice');
      speakWord(`Rule: Follow the ${nextRule}`);
      
      setTimeout(() => {
        setIsRuleChanging(false);
        runRoundAction();
      }, 1600); // Wait 1.6s to display the rule change banner
    } else {
      consecutiveRoundsRef.current += 1;
      runRoundAction();
    }
  };

  const runRoundAction = () => {
    // Generate directions
    const nextArrow = Math.random() > 0.5 ? 'left' : 'right';
    // Clash 60% of the time, align 40%
    const clashing = Math.random() > 0.4;
    const nextVoice = clashing ? (nextArrow === 'left' ? 'right' : 'left') : nextArrow;

    setArrowDir(nextArrow);
    setVoiceDir(nextVoice);
    
    speakWord(nextVoice);
    
    roundStartTimeRef.current = Date.now();

    // Round duration (decreases as level increases)
    const roundDuration = Math.max(
      650,
      (difficulty === 'easy' ? 2200 : difficulty === 'medium' ? 1700 : 1200) - level * 40
    );

    roundTimerRef.current = setTimeout(() => {
      handleTimeout();
    }, roundDuration);
  };

  const handleTimeout = () => {
    setAnswered(true);
    setIsCorrect(false);
    
    setLives(l => {
      const nextLives = l - 1;
      if (nextLives <= 0) {
        setTimeout(finishGame, 800);
      } else {
        setTimeout(() => startNewRound(), 1000);
      }
      return nextLives;
    });
  };

  const handleResponse = (userDir: Direction) => {
    if (answered || isRuleChanging) return;
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    
    setAnswered(true);

    const reactionTime = Date.now() - roundStartTimeRef.current;
    reactionTimes.current.push(reactionTime);
    
    // Average speeds
    const sum = reactionTimes.current.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / reactionTimes.current.length);
    setAvgReactionTime(avg);

    // Verify answer
    const expectedDir = currentRule === 'voice' ? voiceDir : arrowDir;
    const correct = userDir === expectedDir;
    setIsCorrect(correct);

    if (correct) {
      setHitsCount(h => h + 1);
      // Score: faster speeds yield higher points
      const roundLimit = (difficulty === 'easy' ? 2200 : difficulty === 'medium' ? 1700 : 1200) - level * 40;
      const points = Math.max(10, Math.round(((roundLimit - reactionTime) / 10) * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : 2)));
      setScore(s => s + points);

      // Level up every 6 hits
      setHitsCount(h => {
        if (h > 0 && h % 6 === 0) {
          setLevel(l => l + 1);
        }
        return h;
      });

      setTimeout(() => startNewRound(), 800);
    } else {
      setLives(l => {
        const nextLives = l - 1;
        if (nextLives <= 0) {
          setTimeout(finishGame, 800);
        } else {
          setTimeout(() => startNewRound(), 1000);
        }
        return nextLives;
      });
    }
  };

  const finishGame = async () => {
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    const timeTaken = Date.now() - startTime.current;
    
    // Accuracy calculation
    const misses = 3 - lives;
    const totalCount = hitsCount + misses;
    const accuracy = totalCount > 0 ? Math.round((hitsCount / totalCount) * 100) : 0;
    
    // Cognitive score
    const speedFactor = avgReactionTime > 0 ? Math.max(10, 600 - avgReactionTime) / 6 : 10;
    const rawScore = Math.min(100, Math.round((hitsCount * 3 + speedFactor) * (accuracy / 100)));

    const game = await getGameBySlug('clash-test');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'clash-test',
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
        <h1 className="page-title">🎧 Sound vs Visual Clash</h1>
        <p className="page-subtitle">Conflict Training: follow either the spoken command or arrow, depending on active rules!</p>
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
            De-inhibit Neural Paths
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="game-area" style={{ position: 'relative' }}>
          <div className="game-stats" style={{ marginBottom: '20px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{score}</div>
              <div className="game-stat-label">Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--neon-cyan)' }}>
                {avgReactionTime > 0 ? `${avgReactionTime}ms` : '---'}
              </div>
              <div className="game-stat-label">Response Speed</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--danger)' }}>
                {'❤️'.repeat(lives)}
                {lives < 3 && <span style={{ opacity: 0.25 }}>{'🖤'.repeat(3 - lives)}</span>}
              </div>
              <div className="game-stat-label">Lives</div>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '420px',
              aspectRatio: '1.2',
              background: '#090b16',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              padding: '20px',
            }}
          >
            {/* Hologram sweep lines background */}
            <div
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                background: 'linear-gradient(to bottom, transparent 95%, rgba(0, 240, 255, 0.05) 5%)',
                backgroundSize: '100% 24px',
                pointerEvents: 'none',
              }}
            />

            {isRuleChanging ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  animation: 'pulseNotice 1.5s infinite',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚡</div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.6rem',
                    fontWeight: 'bold',
                    color: 'var(--gold)',
                    textShadow: '0 0 10px var(--gold)',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  RULE CHANGE
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.4rem',
                    color: '#ffffff',
                    fontWeight: '600',
                    marginTop: '8px',
                  }}
                >
                  FOLLOW THE {currentRule === 'voice' ? '📣 VOICE' : '👁️ ARROW'}
                </div>
              </div>
            ) : (
              <>
                {/* Active Rule Indicator Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: '16px',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    background: currentRule === 'voice' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 0, 127, 0.15)',
                    border: `1px solid ${currentRule === 'voice' ? 'var(--neon-cyan)' : '#ff007f'}`,
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    boxShadow: `0 0 10px ${currentRule === 'voice' ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 0, 127, 0.2)'}`,
                  }}
                >
                  Active: Follow the {currentRule === 'voice' ? '📣 VOICE' : '👁️ ARROW'}
                </div>

                {/* Conflict Elements */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    gap: '24px',
                    marginTop: '20px',
                  }}
                >
                  {/* Spoken indicator waveform */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '4px', height: '24px', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((h, i) => (
                        <div
                          key={i}
                          style={{
                            width: '3px',
                            height: answered ? '4px' : `${h * (answered ? 1 : 4)}px`,
                            background: 'var(--neon-cyan)',
                            borderRadius: '2px',
                            boxShadow: '0 0 6px var(--neon-cyan)',
                            transition: 'height 0.15s ease',
                          }}
                        />
                      ))}
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 'bold',
                        letterSpacing: '1px',
                      }}
                    >
                      {answered ? 'Silent' : `[ VOICE SAYS: "${voiceDir}" ]`}
                    </span>
                  </div>

                  {/* Visual Arrow Indicator */}
                  <div
                    style={{
                      fontSize: '4.5rem',
                      color: '#ffffff',
                      filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))',
                      transition: 'all 0.2s',
                      transform: arrowDir === 'left' ? 'scaleX(-1)' : 'none',
                    }}
                  >
                    {answered ? '🔘' : '➔'}
                  </div>
                </div>

                {/* Feedback Indicator */}
                {answered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '24px',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      color: isCorrect ? '#00ff66' : 'var(--danger)',
                      textShadow: `0 0 8px ${isCorrect ? '#00ff66' : 'var(--danger)'}`,
                    }}
                  >
                    {isCorrect ? '✓ CORRECT SYNC' : isCorrect === false ? '❌ INCORRECT / TIMEOUT' : ''}
                  </div>
                )}
              </>
            )}

            <style>{`
              @keyframes pulseNotice {
                0% { transform: scale(1); opacity: 0.9; }
                50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 8px var(--gold)); }
                100% { transform: scale(1); opacity: 0.9; }
              }
            `}</style>
          </div>

          {/* Action Trigger Buttons for manual mouse clicking */}
          <div style={{ display: 'flex', gap: '20px', width: '100%', maxWidth: '420px', marginTop: '16px' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px 0', fontSize: '1.2rem', fontWeight: 'bold' }}
              disabled={answered || isRuleChanging}
              onClick={() => handleResponse('left')}
            >
              ◀ GO LEFT
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px 0', fontSize: '1.2rem', fontWeight: 'bold' }}
              disabled={answered || isRuleChanging}
              onClick={() => handleResponse('right')}
            >
              GO RIGHT ▶
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Synapse Conflict Analysis
          </h2>
          <div className="results-score">+{result.final_score} pts</div>

          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.hitsCount}</div>
              <div className="game-stat-label">Correct Switches</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value" style={{ color: 'var(--neon-cyan)' }}>
                {result.avgReactionTime}ms
              </div>
              <div className="game-stat-label">Avg Decisional Speed</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.accuracy}%</div>
              <div className="game-stat-label">Congruency accuracy</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Re-initialize Synapse
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
