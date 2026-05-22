import { useParams } from 'react-router-dom';
import ReactionGame from '../games/ReactionGame';
import ColorMatchGame from '../games/ColorMatchGame';
import FindNumberGame from '../games/FindNumberGame';
import PatternMemoryGame from '../games/PatternMemoryGame';
import SequenceRecallGame from '../games/SequenceRecallGame';
import SpeedMathGame from '../games/SpeedMathGame';
import WordScrambleGame from '../games/WordScrambleGame';
import RapidComparisonGame from '../games/RapidComparisonGame';
import DiscountMasterGame from '../games/DiscountMasterGame';
import OddOneOutGame from '../games/OddOneOutGame';
import GraphSnapGame from '../games/GraphSnapGame';

import SpotChangeGame from '../games/SpotChangeGame';
import CardMatchGame from '../games/CardMatchGame';
import HiddenPathGame from '../games/HiddenPathGame';

import HitTargetGame from '../games/HitTargetGame';
import LaneSwitchGame from '../games/LaneSwitchGame';
import ClashTestGame from '../games/ClashTestGame';
import RapidSortGame from '../games/RapidSortGame';

import MicroDifferenceGame from '../games/MicroDifferenceGame';
import NoiseFilterGame from '../games/NoiseFilterGame';
import FlowFieldGame from '../games/FlowFieldGame';

import MeaningSniperGame from '../games/MeaningSniperGame';
import SynonymRushGame from '../games/SynonymRushGame';
import WordGravityGame from '../games/WordGravityGame';
import WordMazeGame from '../games/WordMazeGame';

const GAME_MAP: Record<string, React.FC> = {
  'reaction-time': ReactionGame,
  'color-match': ColorMatchGame,
  'find-number': FindNumberGame,
  'pattern-memory': PatternMemoryGame,
  'sequence-recall': SequenceRecallGame,
  'speed-math': SpeedMathGame,
  'word-scramble': WordScrambleGame,
  'rapid-comparison': RapidComparisonGame,
  'discount-master': DiscountMasterGame,
  'odd-one-out': OddOneOutGame,
  'graph-snap': GraphSnapGame,
  'spot-change': SpotChangeGame,
  'card-match': CardMatchGame,
  'hidden-path': HiddenPathGame,
  'hit-target': HitTargetGame,
  'lane-switch': LaneSwitchGame,
  'clash-test': ClashTestGame,
  'rapid-sort': RapidSortGame,
  'micro-difference': MicroDifferenceGame,
  'noise-filter': NoiseFilterGame,
  'flow-field': FlowFieldGame,
  'meaning-sniper': MeaningSniperGame,
  'synonym-rush': SynonymRushGame,
  'word-gravity': WordGravityGame,
  'word-maze': WordMazeGame,
};

export default function GamePlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const GameComponent = slug ? GAME_MAP[slug] : null;

  if (!GameComponent) {
    return (
      <div className="game-container">
        <div className="game-area">
          <h2 style={{ color: 'var(--danger)' }}>Game not found</h2>
        </div>
      </div>
    );
  }

  return <GameComponent />;
}
