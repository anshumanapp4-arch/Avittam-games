import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameBySlug, submitGameScore, type Difficulty } from '../lib/gameEngine';
import { useAuth } from '../contexts/AuthContext';

const WORDS: Record<string, string[]> = {
  easy: ['apple', 'house', 'brain', 'light', 'water', 'happy', 'music', 'earth', 'green', 'smile', 'cloud', 'stone', 'dance', 'flame', 'dream'],
  medium: ['puzzle', 'memory', 'bottle', 'rocket', 'garden', 'bridge', 'silver', 'forest', 'island', 'planet', 'frozen', 'jungle', 'castle', 'python', 'quartz'],
  hard: ['cognition', 'algorithm', 'brilliant', 'challenge', 'discovery', 'elaborate', 'frequency', 'gymnasium', 'hypnotize', 'intellect', 'knowledge', 'labyrinth'],
};

function scramble(word: string): string {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join('');
  return result === word ? scramble(word) : result;
}

export default function WordScrambleGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'results'>('menu');
  const [word, setWord] = useState('');
  const [scrambled, setScrambled] = useState('');
  const [guess, setGuess] = useState('');
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState('');
  const [result, setResult] = useState<any>(null);
  const timerRef = useRef<any>(null);
  const startTime = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const usedWords = useRef<Set<string>>(new Set());

  const newWord = () => {
    const pool = WORDS[difficulty].filter(w => !usedWords.current.has(w));
    if (pool.length === 0) usedWords.current.clear();
    const w = (pool.length > 0 ? pool : WORDS[difficulty])[Math.floor(Math.random() * (pool.length > 0 ? pool : WORDS[difficulty]).length)];
    usedWords.current.add(w);
    setWord(w); setScrambled(scramble(w)); setGuess(''); setFeedback('');
  };

  const startGame = () => {
    setPhase('playing'); setRound(0); setCorrect(0); usedWords.current.clear();
    const t = difficulty === 'easy' ? 60 : difficulty === 'medium' ? 50 : 40;
    setTimeLeft(t); startTime.current = Date.now(); newWord();
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { clearInterval(timerRef.current); return 0; } return prev - 1; });
    }, 1000);
  };

  useEffect(() => { if (timeLeft === 0 && phase === 'playing') finishGame(); }, [timeLeft, phase]);
  useEffect(() => { if (phase === 'playing' && inputRef.current) inputRef.current.focus(); }, [round, phase]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guess.toLowerCase().trim() === word) {
      setCorrect(c => c + 1); setFeedback('✅ Correct!');
    } else {
      setFeedback(`❌ It was "${word}"`);
    }
    setRound(r => r + 1);
    setTimeout(() => newWord(), 800);
  };

  const finishGame = async () => {
    clearInterval(timerRef.current);
    const totalRounds = round || 1;
    const rawScore = Math.min(100, Math.round((correct / Math.max(1, totalRounds)) * 60 + Math.min(40, correct * 5)));
    const game = await getGameBySlug('word-scramble');
    if (game) {
      const res = await submitGameScore(game.id, {
        gameSlug: 'word-scramble', rawScore, timeTaken: Date.now() - startTime.current,
        accuracy: (correct / Math.max(1, totalRounds)) * 100, difficulty,
      });
      setResult({ ...res, rawScore, correct, total: totalRounds });
    }
    await refreshProfile(); setPhase('results');
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="page-title">📝 Word Scramble</h1>
        <p className="page-subtitle">Unscramble the letters to form the correct word</p>
      </div>
      {phase === 'menu' && (
        <div className="game-area">
          <div className="difficulty-selector">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button key={d} className={`difficulty-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={startGame}>Start Game</button>
        </div>
      )}
      {phase === 'playing' && (
        <div className="game-area">
          <div className="game-stats">
            <div className="game-stat"><div className="game-stat-value" style={{ color: timeLeft < 10 ? 'var(--danger)' : 'var(--gold)' }}>{timeLeft}s</div><div className="game-stat-label">Time Left</div></div>
            <div className="game-stat"><div className="game-stat-value">{correct}</div><div className="game-stat-label">Solved</div></div>
          </div>
          <div style={{ display: 'flex', gap: '10px', margin: '20px 0', justifyContent: 'center' }}>
            {scrambled.split('').map((c, i) => (
              <div key={i} style={{ width: '48px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-xs)', background: 'rgba(240,192,64,0.12)', border: '1px solid var(--border-glow)', fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: '700', color: 'var(--gold)', textTransform: 'uppercase' }}>
                {c}
              </div>
            ))}
          </div>
          {feedback && <p style={{ color: feedback.startsWith('✅') ? 'var(--success)' : 'var(--danger)', fontWeight: '600', marginBottom: '12px' }}>{feedback}</p>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input ref={inputRef} type="text" value={guess} onChange={e => setGuess(e.target.value)}
              style={{ maxWidth: '200px', fontSize: '1.2rem', textAlign: 'center', textTransform: 'lowercase' }}
              autoFocus placeholder="Your answer" />
            <button type="submit" className="btn btn-primary">Submit</button>
          </form>
        </div>
      )}
      {phase === 'results' && result && (
        <div className="game-area results-screen">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>Time's Up!</h2>
          <div className="results-score">+{result.final_score} pts</div>
          <div className="results-details">
            <div className="game-stat"><div className="game-stat-value">{result.correct}/{result.total}</div><div className="game-stat-label">Solved</div></div>
          </div>
          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => { setPhase('menu'); setResult(null); }}>Play Again</button>
            <button className="btn btn-secondary" onClick={() => navigate('/games')}>All Games</button>
          </div>
        </div>
      )}
    </div>
  );
}
