import { get, set, keys } from 'idb-keyval';

export interface ScoreEntry {
  score: number;
  date: string;
  gameId: string;
  difficulty?: number;
  duration?: number;
}

export interface GameStats {
  bestScore: number;
  totalGames: number;
  totalScore: number;
  recentScores: ScoreEntry[];
  weeklyBest: number;
  lifetimeBest: number;
}

const SCORES_PREFIX = 'scores_';
const STATS_PREFIX = 'stats_';
const FAVOURITES_KEY = 'favourites';
const GAME_SETTINGS_PREFIX = 'gsettings_';

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

export async function saveScore(gameId: string, score: number, duration?: number, difficulty?: number): Promise<void> {
  const entry: ScoreEntry = {
    score,
    date: new Date().toISOString(),
    gameId,
    difficulty,
    duration,
  };

  const scoresKey = `${SCORES_PREFIX}${gameId}`;
  const existing: ScoreEntry[] = (await get(scoresKey)) || [];
  existing.unshift(entry);
  if (existing.length > 100) existing.length = 100;
  await set(scoresKey, existing);

  const statsKey = `${STATS_PREFIX}${gameId}`;
  const stats: GameStats = (await get(statsKey)) || {
    bestScore: 0, totalGames: 0, totalScore: 0,
    recentScores: [], weeklyBest: 0, lifetimeBest: 0,
  };

  stats.totalGames++;
  stats.totalScore += score;
  if (score > stats.lifetimeBest) stats.lifetimeBest = score;
  if (score > stats.bestScore) stats.bestScore = score;

  const weekStart = getWeekStart();
  const weeklyScores = existing.filter(s => s.date >= weekStart);
  stats.weeklyBest = weeklyScores.length > 0 ? Math.max(...weeklyScores.map(s => s.score)) : 0;
  stats.recentScores = existing.slice(0, 10);

  await set(statsKey, stats);
}

export async function getStats(gameId: string): Promise<GameStats> {
  const statsKey = `${STATS_PREFIX}${gameId}`;
  return (await get(statsKey)) || {
    bestScore: 0, totalGames: 0, totalScore: 0,
    recentScores: [], weeklyBest: 0, lifetimeBest: 0,
  };
}

export async function getScores(gameId: string): Promise<ScoreEntry[]> {
  return (await get(`${SCORES_PREFIX}${gameId}`)) || [];
}

export async function getAllGameIds(): Promise<string[]> {
  const allKeys = await keys();
  return [...new Set(
    allKeys
      .filter(k => typeof k === 'string' && k.startsWith(SCORES_PREFIX))
      .map(k => (k as string).replace(SCORES_PREFIX, ''))
  )];
}

// ── Favourites ──
export async function getFavourites(): Promise<string[]> {
  return (await get(FAVOURITES_KEY)) || [];
}

export async function toggleFavourite(gameId: string): Promise<boolean> {
  const favs: string[] = (await get(FAVOURITES_KEY)) || [];
  const idx = favs.indexOf(gameId);
  if (idx >= 0) {
    favs.splice(idx, 1);
    await set(FAVOURITES_KEY, favs);
    return false;
  } else {
    favs.push(gameId);
    await set(FAVOURITES_KEY, favs);
    return true;
  }
}

// ── Per-game settings ──
export interface PerGameSettings {
  lastDifficulty: number; // 0-3
  [key: string]: unknown;
}

export async function getGameSettings(gameId: string): Promise<PerGameSettings> {
  return (await get(`${GAME_SETTINGS_PREFIX}${gameId}`)) || { lastDifficulty: 0 };
}

export async function saveGameSettings(gameId: string, settings: PerGameSettings): Promise<void> {
  await set(`${GAME_SETTINGS_PREFIX}${gameId}`, settings);
}

// ── App settings ──
export interface AppSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  volume: number; // 0-100
  maxFps: number; // 30 or 60
  theme: 'light';
}

const SETTINGS_KEY = 'app_settings';

export async function getSettings(): Promise<AppSettings> {
  return (await get(SETTINGS_KEY)) || {
    soundEnabled: true,
    musicEnabled: true,
    vibrationEnabled: true,
    volume: 80,
    maxFps: 60,
    theme: 'light',
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await set(SETTINGS_KEY, settings);
}
