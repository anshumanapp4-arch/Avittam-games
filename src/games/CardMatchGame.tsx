import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

interface Card {
  id: number;
  symbol: string;
  isFlipped: boolean;
  isMatched: boolean;
  color: string;
}

const COSMIC_EMOJIS = ['🌟', '🌀', '⚡', '🪐', '🛸', '🔮', '👾', '🛡️', '🧬', '🚀'];
const NEON_CARD_COLORS = [
  '#00f0ff', // Cyan
  '#ff007f', // Pink
  '#00ff66', // Green
  '#ffcc00', // Gold
  '#cc00ff', // Purple
  '#ff5500', // Orange
  '#00ffff', // Electric Cyan
  '#ff00ff', // Magenta
  '#ffff00', // Neon Yellow
  '#33ff33', // Neon Green
];

export default function CardMatchGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [maxPairs, setMaxPairs] = useState(6);
  const [result, setResult] = useState<any>(null);
  
  const startTime = useRef(Date.now());
  const matchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
    };
  }, []);

  const initializeGame = () => {
    let pairsCount = 6; // Easy (3x4 = 12 cards)
    if (difficulty === 'medium') pairsCount = 8; // Medium (4x4 = 16 cards)
    else if (difficulty === 'hard') pairsCount = 10; // Hard (4x5 = 20 cards)
    
    setMaxPairs(pairsCount);
    
    // Slice the cosmic symbols and color schemes
    const selectedSymbols = COSMIC_EMOJIS.slice(0, pairsCount);
    
    // Create card pairs
    const deck: Card[] = [];
    selectedSymbols.forEach((sym, idx) => {
      const color = NEON_CARD_COLORS[idx % NEON_CARD_COLORS.length];
      
      // Card 1
      deck.push({
        id: idx * 2,
        symbol: sym,
        isFlipped: false,
        isMatched: false,
        color,
      });
      // Card 2
      deck.push({
        id: idx * 2 + 1,
        symbol: sym,
        isFlipped: false,
        isMatched: false,
        color,
      });
    });

    // Shuffle the deck using Fisher-Yates
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    setCards(deck);
    setSelectedIndices([]);
    setScore(0);
    setMoves(0);
    setMatches(0);
    startTime.current = Date.now();
    setPhase('playing');
  };

  const handleCardClick = (index: number) => {
    if (phase !== 'playing') return;
    if (cards[index].isFlipped || cards[index].isMatched) return;
    if (selectedIndices.length >= 2) return;

    // Flip the clicked card
    const updatedCards = [...cards];
    updatedCards[index].isFlipped = true;
    setCards(updatedCards);

    const nextSelected = [...selectedIndices, index];
    setSelectedIndices(nextSelected);

    if (nextSelected.length === 2) {
      setMoves(m => m + 1);
      const [firstIdx, secondIdx] = nextSelected;
      const card1 = cards[firstIdx];
      const card2 = cards[secondIdx];

      if (card1.symbol === card2.symbol) {
        // MATCH FOUND!
        matchTimeoutRef.current = setTimeout(() => {
          const matchedDeck = [...cards];
          matchedDeck[firstIdx].isMatched = true;
          matchedDeck[secondIdx].isMatched = true;
          setCards(matchedDeck);
          setSelectedIndices([]);
          
          const nextMatches = matches + 1;
          setMatches(nextMatches);
          
          // Award points (more points for early matches)
          const pointsEarned = Math.max(10, 50 - moves * 2);
          setScore(s => s + pointsEarned);

          if (nextMatches === maxPairs) {
            finishGame();
          }
        }, 500);
      } else {
        // MISMATCH! Flip them back
        matchTimeoutRef.current = setTimeout(() => {
          const resetDeck = [...cards];
          resetDeck[firstIdx].isFlipped = false;
          resetDeck[secondIdx].isFlipped = false;
          setCards(resetDeck);
          setSelectedIndices([]);
          // Minor penalty for mismatch to prevent random clicking
          setScore(s => Math.max(0, s - 2));
        }, 1000);
      }
    }
  };

  const finishGame = async () => {
    const timeTaken = Date.now() - startTime.current;
    
    // Scoring Algorithm:
    // Perfect moves would be equal to maxPairs (6, 8, 10)
    // Efficiency = (maxPairs / moves) * 100
    const efficiency = Math.round((maxPairs / Math.max(maxPairs, moves)) * 100);
    const rawScore = Math.min(100, Math.round((score + (maxPairs * 15)) * (efficiency / 100)));
    
    const game = await getGameBySlug('card-match');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'card-match',
        rawScore,
        timeTaken,
        accuracy: efficiency,
        difficulty,
      });
      setResult({ ...res, rawScore, moves, timeTaken, score });
    }
    await refreshProfile();
    setPhase('results');
  };

  // Compute Grid Styling
  const getGridTemplate = () => {
    if (difficulty === 'easy') {
      return {
        gridTemplateColumns: 'repeat(3, 1fr)',
        maxWidth: '340px',
      };
    } else if (difficulty === 'medium') {
      return {
        gridTemplateColumns: 'repeat(4, 1fr)',
        maxWidth: '420px',
      };
    } else {
      return {
        gridTemplateColumns: 'repeat(4, 1fr)',
        maxWidth: '420px',
      };
    }
  };

  return (
    <div className="game-container">
      {/* Self-contained CSS Styles for Card Flipping and animations */}
      <style>{`
        .card-scene {
          perspective: 800px;
          aspect-ratio: 0.8;
          width: 100%;
        }
        .card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
          transform-style: preserve-3d;
          border-radius: var(--radius-sm);
          cursor: pointer;
        }
        .card-inner.is-flipped {
          transform: rotateY(180deg);
        }
        .card-front, .card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
        }
        .card-back {
          background: linear-gradient(135deg, #0e101f, #1b1e38);
          color: var(--gold);
          box-shadow: inset 0 0 15px rgba(212, 175, 55, 0.1);
        }
        .card-back::after {
          content: '🎴';
          font-size: 1.8rem;
          opacity: 0.55;
          filter: drop-shadow(0 0 6px var(--gold));
          transition: transform 0.3s;
        }
        .card-inner:hover .card-back::after {
          transform: scale(1.15) rotate(5deg);
        }
        .card-front {
          background: #0f1123;
          transform: rotateY(180deg);
        }
        .card-inner.is-matched {
          animation: pulseMatched 0.5s ease-out;
        }
        @keyframes pulseMatched {
          0% { transform: rotateY(180deg) scale(1); }
          50% { transform: rotateY(180deg) scale(1.1); box-shadow: 0 0 20px currentColor; }
          100% { transform: rotateY(180deg) scale(1); }
        }
      `}</style>

      <div className="game-header">
        <h1 className="page-title">🎴 Card Match</h1>
        <p className="page-subtitle">Match pairs of glowing cosmic elements in minimum moves!</p>
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
          <button className="btn btn-primary btn-lg" onClick={initializeGame}>
            Start Flip Training
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="game-area">
          <div className="game-stats" style={{ marginBottom: '20px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{moves}</div>
              <div className="game-stat-label">Moves</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{score}</div>
              <div className="game-stat-label">Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{matches} / {maxPairs}</div>
              <div className="game-stat-label">Pairs Matched</div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '12px',
              width: '100%',
              ...getGridTemplate(),
            }}
          >
            {cards.map((card, idx) => {
              const isFlipped = card.isFlipped || card.isMatched;
              const shadowGlow = card.isMatched
                ? `0 0 12px ${card.color}`
                : isFlipped
                ? `0 0 8px ${card.color}`
                : '0 4px 12px rgba(0,0,0,0.3)';

              return (
                <div key={card.id} className="card-scene">
                  <div
                    className={`card-inner ${isFlipped ? 'is-flipped' : ''} ${card.isMatched ? 'is-matched' : ''}`}
                    style={{
                      boxShadow: shadowGlow,
                      color: card.color,
                      border: card.isMatched ? `2px solid ${card.color}` : 'none',
                    }}
                    onClick={() => handleCardClick(idx)}
                  >
                    <div className="card-back" style={{ border: `1px solid var(--border)` }} />
                    <div className="card-front">
                      <span
                        style={{
                          fontSize: difficulty === 'hard' ? '2rem' : '2.4rem',
                          filter: `drop-shadow(0 0 8px ${card.color})`,
                        }}
                      >
                        {card.symbol}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            Grid Synced Successfully
          </h2>
          <div className="results-score">+{result.final_score} pts</div>

          <div className="results-details" style={{ marginBottom: '24px' }}>
            <div className="game-stat">
              <div className="game-stat-value">{result.moves}</div>
              <div className="game-stat-label">Moves Taken</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{result.score}</div>
              <div className="game-stat-label">Base Score</div>
            </div>
            <div className="game-stat">
              <div className="game-stat-value">{Math.round(result.timeTaken / 1000)}s</div>
              <div className="game-stat-label">Completion Time</div>
            </div>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>
              Reset Training Deck
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
