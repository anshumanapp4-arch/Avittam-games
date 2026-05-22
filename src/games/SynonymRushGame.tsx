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

interface GridWord {
  word: string;
  isSynonym: boolean;
  selected: boolean;
}

export default function SynonymRushGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(12);

  const [activeItem, setActiveItem] = useState<VocabItem | null>(null);
  const [gridWords, setGridWords] = useState<GridWord[]>([]);
  const [correctSynonymsCount, setCorrectSynonymsCount] = useState(0);
  const [foundCount, setFoundCount] = useState(0);
  
  const [feedback, setFeedback] = useState<'success' | 'wrong' | 'timeout' | null>(null);
  const [result, setResult] = useState<any>(null);

  const startTime = useRef(Date.now());
  const roundStartTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef<any>(null);

  // Initialize a matching round grid
  const generateRushGrid = (currentItem: VocabItem) => {
    // Determine grid layout based on difficulty
    // Easy: 3x3 grid (9 choices, 2-3 synonyms)
    // Medium: 4x3 grid (12 choices, 3 synonyms)
    // Hard: 4x4 grid (16 choices, 3-4 synonyms)
    let size = 9;
    if (difficulty === 'medium') size = 12;
    else if (difficulty === 'hard') size = 16;

    // Pick 2-4 synonyms from current item
    const allSynonyms = [...currentItem.synonyms];
    const synonymCount = Math.min(allSynonyms.length, difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4);
    const chosenSynonyms = allSynonyms.sort(() => 0.5 - Math.random()).slice(0, synonymCount);

    // Pick distractors
    const chosenDistractors: string[] = [];
    const otherItems = VOCAB_DATABASE.filter(item => item.word !== currentItem.word);
    
    // Gather all synonyms of other words to use as distractors
    const allDistractorWords: string[] = [];
    otherItems.forEach(item => {
      allDistractorWords.push(...item.synonyms);
    });
    
    // De-duplicate distractors
    const uniqueDistractors = Array.from(new Set(allDistractorWords)).filter(word => !currentItem.synonyms.includes(word));
    const shuffledDistractors = uniqueDistractors.sort(() => 0.5 - Math.random());
    
    const distractorCount = size - synonymCount;
    chosenDistractors.push(...shuffledDistractors.slice(0, distractorCount));

    // Compile and shuffle
    const compiledGrid: GridWord[] = [
      ...chosenSynonyms.map(word => ({ word, isSynonym: true, selected: false })),
      ...chosenDistractors.map(word => ({ word, isSynonym: false, selected: false })),
    ].sort(() => 0.5 - Math.random());

    setGridWords(compiledGrid);
    setCorrectSynonymsCount(synonymCount);
    setFoundCount(0);
    setFeedback(null);
    roundStartTimeRef.current = Date.now();
  };

  // Timer loop
  useEffect(() => {
    if (phase !== 'playing' || feedback !== null) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      return;
    }

    const roundDuration = difficulty === 'easy' ? 12 : difficulty === 'medium' ? 9 : 6;
    setTimeLeft(roundDuration);

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

    const initialItem = VOCAB_DATABASE[Math.floor(Math.random() * VOCAB_DATABASE.length)];
    setActiveItem(initialItem);
    generateRushGrid(initialItem);
  };

  const nextRound = () => {
    setFeedback(null);
    const nextItem = VOCAB_DATABASE[Math.floor(Math.random() * VOCAB_DATABASE.length)];
    setActiveItem(nextItem);
    generateRushGrid(nextItem);
  };

  const handleWordSelect = (index: number) => {
    if (phase !== 'playing' || feedback !== null) return;
    if (gridWords[index].selected) return; // already clicked

    const updatedGrid = [...gridWords];
    updatedGrid[index].selected = true;
    setGridWords(updatedGrid);

    const target = updatedGrid[index];

    if (target.isSynonym) {
      const nextFound = foundCount + 1;
      setFoundCount(nextFound);

      if (nextFound === correctSynonymsCount) {
        // Clear round successfully!
        setFeedback('success');
        const reactionTime = Date.now() - roundStartTimeRef.current;
        const maxRoundTime = (difficulty === 'easy' ? 12 : difficulty === 'medium' ? 9 : 6) * 1000;
        const speedBonus = Math.max(10, Math.round((maxRoundTime - reactionTime) / 100 * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : 2.5)));
        setScore(s => s + speedBonus);
        setLevel(l => l + 1);

        setTimeout(nextRound, 1000);
      }
    } else {
      // Wrong synonym clicked!
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
  };

  const finishGame = async () => {
    const timeTaken = Date.now() - startTime.current;
    const accuracy = score > 0 ? Math.min(100, Math.round((level / (level + (3 - lives))) * 100)) : 0;
    const rawScore = Math.min(100, Math.round((score / 1.7) * (accuracy / 100)));

    const game = await getGameBySlug('synonym-rush');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'synonym-rush',
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

  const maxDuration = difficulty === 'easy' ? 12 : difficulty === 'medium' ? 9 : 6;

  return (
    <div className="game-container" style={{ maxWidth: '600px' }}>
      <div className="game-header">
        <h1 className="page-title">⚡ Synonym Rush</h1>
        <p className="page-subtitle">Semantic speed match: identify and tap all valid synonyms on the cyber grid before time expires!</p>
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
            <h3 style={{ color: 'var(--neon-cyan)', marginBottom: '8px' }}>Synonym Grid Protocol:</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Study the central cyan target keyword.</li>
              <li>Scan the word button grid generated underneath.</li>
              <li>Tap/Click ALL genuine synonyms representing that keyword.</li>
              <li>Tapping a distractor or letting the timer lapse severs grid synchronization.</li>
            </ul>
          </div>
          <button className="btn btn-primary btn-lg" onClick={startNewGame}>
            Sync Neural Grid
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
              <div className="game-stat-label">Lives</div>
            </div>
          </div>

          {/* Central Target Keyword Panel */}
          <div
            style={{
              width: '100%',
              background: '#04050d',
              border: '2px solid var(--border)',
              borderRadius: '12px',
              padding: '18px 24px',
              marginBottom: '16px',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '4px' }}>
              CORE SYNONYM KEYWORD:
            </div>
            <div
              style={{
                fontSize: '2.2rem',
                fontWeight: '900',
                color: '#ffffff',
                textShadow: '0 0 10px var(--neon-cyan)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '2px',
              }}
            >
              {activeItem.word.toUpperCase()}
            </div>
            <div style={{ marginTop: '8px', color: '#ffcc00', fontSize: '0.9rem', fontWeight: 'bold' }}>
              SYNONYMS FOUND: {foundCount} / {correctSynonymsCount}
            </div>
          </div>

          {/* Time Bar */}
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '20px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(timeLeft / maxDuration) * 100}%`,
                height: '100%',
                background: timeLeft > 2 ? 'var(--neon-cyan)' : 'var(--danger)',
                boxShadow: `0 0 8px ${timeLeft > 2 ? 'var(--neon-cyan)' : 'var(--danger)'}`,
                transition: 'width 1s linear',
              }}
            />
          </div>

          {/* Matching Word Grid */}
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: `repeat(${difficulty === 'easy' ? 3 : 4}, 1fr)`,
              gap: '10px',
              width: '100%',
              margin: '0 auto',
            }}
          >
            {gridWords.map((item, idx) => {
              let btnClass = 'btn-secondary';
              let extraStyle: React.CSSProperties = {};

              if (item.selected) {
                if (item.isSynonym) {
                  extraStyle = {
                    background: 'rgba(0, 255, 102, 0.15)',
                    borderColor: '#00ff66',
                    color: '#00ff66',
                    boxShadow: '0 0 10px rgba(0, 255, 102, 0.3)',
                  };
                } else {
                  extraStyle = {
                    background: 'rgba(255, 0, 127, 0.15)',
                    borderColor: 'var(--danger)',
                    color: 'var(--danger)',
                    boxShadow: '0 0 10px rgba(255, 0, 127, 0.3)',
                  };
                }
              }

              return (
                <button
                  key={idx}
                  className={`btn ${btnClass}`}
                  disabled={feedback !== null}
                  onClick={() => handleWordSelect(idx)}
                  style={{
                    padding: '20px 8px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    wordBreak: 'break-all',
                    ...extraStyle,
                  }}
                >
                  {item.word}
                </button>
              );
            })}

            {/* Visual Feedback Alerts Overlay */}
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
                    feedback === 'success'
                      ? 'rgba(0, 255, 102, 0.15)'
                      : feedback === 'wrong'
                      ? 'rgba(255, 0, 127, 0.18)'
                      : 'rgba(255, 204, 0, 0.15)',
                  pointerEvents: 'none',
                  border:
                    feedback === 'success'
                      ? '3px solid #00ff66'
                      : feedback === 'wrong'
                      ? '3px solid var(--danger)'
                      : '3px solid var(--gold)',
                  borderRadius: '10px',
                }}
              >
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color:
                      feedback === 'success'
                        ? '#00ff66'
                        : feedback === 'wrong'
                        ? 'var(--danger)'
                        : 'var(--gold)',
                    textShadow: `0 0 10px ${
                      feedback === 'success'
                        ? '#00ff66'
                        : feedback === 'wrong'
                        ? 'var(--danger)'
                        : 'var(--gold)'
                    }`,
                  }}
                >
                  {feedback === 'success' && '✓ SYNCS CLEARED'}
                  {feedback === 'wrong' && '✗ CORRUPT GATE HIT'}
                  {feedback === 'timeout' && '⏰ SYSTEM EXPIRY'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Grid Matching Terminated
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
              <div className="game-stat-label">Accuracy Rating</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Reset Synonym Grid
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
