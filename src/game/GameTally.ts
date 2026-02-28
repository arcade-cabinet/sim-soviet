/**
 * GameTally -- aggregates all end-game data into a civilization-style summary.
 *
 * This is a pure data module: it reads from ScoringSystem, AchievementTracker,
 * and current ECS state to produce a single immutable `TallyData` object.
 * The UI layer (GameOverModal) consumes this to render the end-game screen.
 *
 * Sections:
 *   1. Verdict     -- victory/defeat + reason + satirical judgement
 *   2. Score       -- breakdown + final score with difficulty multiplier
 *   3. Statistics  -- peak pop, year reached, buildings, events, etc.
 *   4. Medals      -- awarded satirical medals
 *   5. Achievements -- unlocked + progress toward locked
 *   6. Timeline    -- key moments from the playthrough
 */

import { ACHIEVEMENTS } from '@/content/worldbuilding';
import type { AchievementStats, AchievementTracker } from './AchievementTracker';
import type { ConsequenceLevel, DifficultyLevel, Medal, ScoreBreakdown, ScoringSystem } from './ScoringSystem';

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

/** Satirical verdict based on outcome and performance. */
export interface TallyVerdict {
  victory: boolean;
  reason: string;
  /** Satirical title assigned to the player. */
  title: string;
  /** Satirical summary paragraph. */
  summary: string;
}

/** Statistics block for the summary screen. */
export interface TallyStatistics {
  yearReached: number;
  yearsPlayed: number;
  playTimeSeconds: number;
  peakPopulation: number;
  finalPopulation: number;
  buildingsPlaced: number;
  finalBuildingCount: number;
  buildingCollapses: number;
  uniqueBuildingTypes: number;
  quotasMet: number;
  quotasMissed: number;
  erasCompleted: number;
  totalEvents: number;
  totalDisasters: number;
  renameCount: number;
  maxMoney: number;
  maxVodka: number;
  finalMoney: number;
  finalFood: number;
  finalVodka: number;
  blackMarks: number;
  commendations: number;
  settlementTier: string;
}

/** A single achievement entry for the tally screen. */
export interface TallyAchievement {
  id: string;
  name: string;
  description: string;
  subtext: string;
  hidden: boolean;
  unlocked: boolean;
}

/** Complete end-game tally data for the summary screen. */
export interface TallyData {
  verdict: TallyVerdict;
  difficulty: DifficultyLevel;
  consequence: ConsequenceLevel;
  scoreBreakdown: ScoreBreakdown;
  finalScore: number;
  statistics: TallyStatistics;
  medals: Medal[];
  achievements: TallyAchievement[];
  achievementsUnlocked: number;
  achievementsTotal: number;
}

/** Current game state snapshot needed by the tally function. */
export interface TallyGameState {
  victory: boolean;
  reason: string;
  currentYear: number;
  startYear: number;
  population: number;
  buildingCount: number;
  money: number;
  food: number;
  vodka: number;
  blackMarks: number;
  commendations: number;
  settlementTier: string;
  /** Number of quota deadlines missed (from SimulationEngine). */
  quotaFailures: number;
}

// ─────────────────────────────────────────────────────────
//  VERDICT GENERATION
// ─────────────────────────────────────────────────────────

const VICTORY_TITLES = [
  'Hero of the Soviet Union (Pending Paperwork)',
  'Distinguished Builder of Socialism',
  'Comrade Chairman, First Class',
  'Glorious Architect of the Five-Year Plan',
  'Bearer of the Order of Red Concrete',
];

const DEFEAT_TITLES = [
  'Former Comrade (Status: Revoked)',
  'Disgraced Apparatchik',
  'Ex-Chairman (Personnel File: Sealed)',
  'Footnote in the Classified Archives',
  'Unnamed Individual (File Redacted)',
];

const VICTORY_SUMMARIES = [
  'Your service to the State has been noted, filed, and placed in a cabinet that will not be opened for 50 years. You are thanked. The thanks are also filed.',
  'The Politburo has reviewed your record and found it acceptable. "Acceptable" is the highest compliment the committee was authorized to issue.',
  'Your city endures. Its citizens endure. Everything endures. Endurance is the only metric that matters.',
  'Against all probability, you have succeeded. The probability itself has been arrested for pessimism.',
];

const DEFEAT_SUMMARIES = [
  'Your personnel file has been transferred to the Archive of Unfortunate Decisions. It joins many others. You are not special in your failure.',
  'The State thanks you for your service. The State also thanks itself for discovering your incompetence before further damage could occur.',
  'History will not remember you. The committee has ensured this. Your name has been removed from all documents. You are now a blank space.',
  'Your failure has been recorded, analyzed, and used as a cautionary example in the training manual for your replacement.',
];

function generateVerdict(state: TallyGameState, stats: AchievementStats): TallyVerdict {
  const titlePool = state.victory ? VICTORY_TITLES : DEFEAT_TITLES;
  const summaryPool = state.victory ? VICTORY_SUMMARIES : DEFEAT_SUMMARIES;

  // Deterministic selection based on game state
  const titleIdx = (state.currentYear + stats.buildingsPlaced) % titlePool.length;
  const summaryIdx = (state.currentYear + stats.totalEvents) % summaryPool.length;

  return {
    victory: state.victory,
    reason: state.reason,
    title: titlePool[titleIdx]!,
    summary: summaryPool[summaryIdx]!,
  };
}

// ─────────────────────────────────────────────────────────
//  TALLY BUILDER
// ─────────────────────────────────────────────────────────

/**
 * Produces a complete end-game tally from the scoring system,
 * achievement tracker, and current game state.
 *
 * This is a pure function with no side effects.
 */
export function createGameTally(
  scoring: ScoringSystem,
  achievements: AchievementTracker,
  state: TallyGameState,
): TallyData {
  const stats = achievements.getStats();
  const unlockedIds = achievements.getUnlockedIds();

  const verdict = generateVerdict(state, stats);

  const scoreBreakdown = scoring.getScoreBreakdown();

  const statistics: TallyStatistics = {
    yearReached: state.currentYear,
    yearsPlayed: state.currentYear - state.startYear,
    playTimeSeconds: stats.playTimeSeconds,
    peakPopulation: stats.maxPopulation,
    finalPopulation: state.population,
    buildingsPlaced: stats.buildingsPlaced,
    finalBuildingCount: state.buildingCount,
    buildingCollapses: stats.buildingCollapses,
    uniqueBuildingTypes: stats.uniqueBuildingTypes.length,
    quotasMet: scoring.getTotalQuotasMet(),
    quotasMissed: state.quotaFailures,
    erasCompleted: scoring.getErasCompleted(),
    totalEvents: stats.totalEvents,
    totalDisasters: stats.totalDisasters,
    renameCount: stats.renameCount,
    maxMoney: stats.maxMoney,
    maxVodka: stats.maxVodka,
    finalMoney: state.money,
    finalFood: state.food,
    finalVodka: state.vodka,
    blackMarks: state.blackMarks,
    commendations: state.commendations,
    settlementTier: state.settlementTier,
  };

  // Build achievement list: show visible ones + unlocked hidden ones
  const tallyAchievements: TallyAchievement[] = ACHIEVEMENTS.filter((a) => !a.hidden || unlockedIds.has(a.id)).map(
    (a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      subtext: a.subtext,
      hidden: a.hidden,
      unlocked: unlockedIds.has(a.id),
    }),
  );

  return {
    verdict,
    difficulty: scoring.getDifficulty(),
    consequence: scoring.getConsequence(),
    scoreBreakdown,
    finalScore: scoring.getFinalScore(),
    statistics,
    medals: scoring.getAwardedMedals(),
    achievements: tallyAchievements,
    achievementsUnlocked: unlockedIds.size,
    achievementsTotal: ACHIEVEMENTS.length,
  };
}
