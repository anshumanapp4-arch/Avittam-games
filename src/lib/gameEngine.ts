/**
 * Avittam Games — Game Engine
 * Client-side score calculation (for preview) + submission via Supabase RPC
 */
import { supabase } from './supabase';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameResult {
  gameSlug: string;
  rawScore: number;
  timeTaken: number; // milliseconds
  accuracy: number;  // 0-100
  difficulty: Difficulty;
}

export interface ScoreSubmissionResult {
  final_score: number;
  points_earned: number;
  fatigue_multiplier: number;
}

const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  easy: 1.0,
  medium: 1.5,
  hard: 2.5,
};

/**
 * Client-side score preview (actual score calculated server-side)
 */
export function previewScore(rawScore: number, difficulty: Difficulty): number {
  return Math.floor(rawScore * DIFFICULTY_MULTIPLIERS[difficulty]);
}

/**
 * Submit a game result to the server
 */
export async function submitGameScore(
  gameId: string,
  result: GameResult
): Promise<ScoreSubmissionResult | null> {
  const { data, error } = await supabase.rpc('submit_game_score', {
    p_game_id: gameId,
    p_raw_score: result.rawScore,
    p_time_taken: result.timeTaken,
    p_accuracy: Math.round(result.accuracy * 100) / 100,
    p_difficulty: result.difficulty,
  });

  if (error) {
    console.error('Score submission error:', error);
    return null;
  }

  return data?.[0] || data;
}

/**
 * Get game ID by slug
 */
export async function getGameBySlug(slug: string) {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Game fetch error:', error);
    return null;
  }
  return data;
}

/**
 * Fetch all games
 */
export async function getAllGames() {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('category');

  if (error) {
    console.error('Games fetch error:', error);
    return [];
  }
  return data || [];
}

/**
 * Get user's best score for a game
 */
export async function getUserBestScore(userId: string, gameId: string) {
  const { data } = await supabase
    .from('game_sessions')
    .select('score')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(1)
    .single();

  return data?.score || 0;
}

/**
 * Get user's game history
 */
export async function getUserGameHistory(userId: string, limit = 20) {
  const { data } = await supabase
    .from('game_sessions')
    .select('*, games(name, slug, icon)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}
