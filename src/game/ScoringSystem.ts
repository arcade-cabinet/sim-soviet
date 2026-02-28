/**
 * ScoringSystem -- Civ-style score accumulation, difficulty configs,
 * consequence configs, and era multipliers.
 *
 * Score is accumulated at era boundaries using discrete game events
 * (workers alive, quotas met, buildings standing, marks, KGB losses, etc.).
 * The final score is scaled by a difficulty x consequence multiplier.
 *
 * Difficulty levels and consequence levels are defined by the design doc
 * (docs/design/scoring.md) and exported for NewGameFlow and other UI.
 */

import { ERA_ORDER } from './era';

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

export type DifficultyLevel = 'worker' | 'comrade' | 'tovarish';

export type ConsequenceLevel = 'forgiving' | 'permadeath' | 'harsh';

/**
 * Difficulty configuration -- controls simulation parameters.
 *
 * Worker: The state is lenient. Quotas are gentle. Growth is encouraged.
 * Comrade: Standard Soviet experience. Expect hardship.
 * Tovarish: Maximum authentic suffering. The Party demands excellence.
 */
export interface DifficultyConfig {
  /** Display label for UI */
  label: string;
  /** Quota target multiplier (lower = easier) */
  quotaMultiplier: number;
  /** Ticks between automatic black mark decay (lower = faster decay = easier) */
  markDecayTicks: number;
  /** 1 politruk per N citizens (higher N = fewer politruks = easier) */
  politrukRatio: number;
  /** KGB investigation frequency */
  kgbAggression: 'low' | 'medium' | 'high';
  /** Population growth rate multiplier */
  growthMultiplier: number;
  /** Winter duration modifier */
  winterModifier: 'shorter' | 'standard' | 'longer';
  /** Building decay rate multiplier (lower = slower decay = easier) */
  decayMultiplier: number;
  /** Starting resources multiplier */
  resourceMultiplier: number;
}

/**
 * Consequence configuration -- what happens when arrested.
 *
 * Forgiving: "Replaced by an Idiot" -- return after 1 year with penalties.
 * Permadeath: "The File Is Closed" -- game over, restart era, score x1.5.
 * Harsh: "The Village Is Evacuated" -- return after 3 years, severe penalties.
 */
export interface ConsequenceConfig {
  /** Display label for UI */
  label: string;
  /** Satirical subtitle */
  subtitle: string;
  /** Years before the player can return (0 = permadeath/restart) */
  returnDelayYears: number;
  /** Fraction of buildings that survive (0-1) */
  buildingSurvival: number;
  /** Fraction of workers that survive (0-1) */
  workerSurvival: number;
  /** Fraction of resources that survive (0-1) */
  resourceSurvival: number;
  /** Black marks reset to this value */
  marksReset: number;
  /** Points deducted from score on arrest */
  scorePenalty: number;
  /** If true, game ends permanently on arrest */
  permadeath: boolean;
  /** Permadeath grants a global score multiplier to all points earned */
  permadeathScoreMultiplier: number;
}

/** Score breakdown for a single era. */
export interface EraScoreBreakdown {
  eraIndex: number;
  eraName: string;
  /** Workers alive at era end, x2 each */
  workersAlive: number;
  workersAlivePoints: number;
  /** Quotas met during era, x50 each */
  quotasMet: number;
  quotasMetPoints: number;
  /** Quotas exceeded during era, x25 each */
  quotasExceeded: number;
  quotasExceededPoints: number;
  /** Buildings standing at era end, x5 each */
  buildingsStanding: number;
  buildingsStandingPoints: number;
  /** Commendations on file at era end, x30 each */
  commendations: number;
  commendationsPoints: number;
  /** Black marks on file at era end, x-40 each */
  blackMarks: number;
  blackMarksPoints: number;
  /** Workers lost to KGB/purge during era, x-10 each */
  kgbLosses: number;
  kgbLossesPoints: number;
  /** Workers conscripted during era, x-5 each */
  conscripted: number;
  conscriptedPoints: number;
  /** +100 if era completed without investigation, 0 otherwise */
  cleanEraBonus: number;
  /** Sum of all component scores before era multiplier */
  rawTotal: number;
  /** Era multiplier (1.0 for era 1, up to 3.0 for era 8) */
  eraMultiplier: number;
  /** rawTotal * eraMultiplier */
  eraTotal: number;
}

/** Complete score breakdown across all eras. */
export interface ScoreBreakdown {
  eras: EraScoreBreakdown[];
  /** Sum of all era totals (post era-multiplier, pre difficulty multiplier) */
  subtotal: number;
  /** Difficulty x consequence multiplier */
  settingsMultiplier: number;
  /** subtotal * settingsMultiplier, floored */
  finalScore: number;
}

/** Satirical Soviet medal awarded at milestones. */
export interface Medal {
  id: string;
  name: string;
  description: string;
  tier: 'tin' | 'copper' | 'bronze' | 'iron' | 'concrete';
  requirement: string;
}

/** Serializable snapshot for save/load. */
export interface ScoringSystemSaveData {
  difficulty: DifficultyLevel;
  consequence: ConsequenceLevel;
  eraScores: EraScoreBreakdown[];
  currentEraQuotasMet: number;
  currentEraQuotasExceeded: number;
  currentEraKGBLosses: number;
  currentEraConscripted: number;
  currentEraInvestigated: boolean;
  awardedMedalIds: string[];
}

// ─────────────────────────────────────────────────────────
//  CONSTANTS: DIFFICULTY PRESETS
// ─────────────────────────────────────────────────────────

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyConfig> = {
  worker: {
    label: 'Worker',
    quotaMultiplier: 0.6,
    markDecayTicks: 360, // 1/year
    politrukRatio: 40, // 1:40
    kgbAggression: 'low',
    growthMultiplier: 1.5,
    winterModifier: 'shorter',
    decayMultiplier: 0.7,
    resourceMultiplier: 1.5,
  },
  comrade: {
    label: 'Comrade',
    quotaMultiplier: 1.0,
    markDecayTicks: 720, // 1/2 years
    politrukRatio: 20, // 1:20
    kgbAggression: 'medium',
    growthMultiplier: 1.0,
    winterModifier: 'standard',
    decayMultiplier: 1.0,
    resourceMultiplier: 1.0,
  },
  tovarish: {
    label: 'Tovarish',
    quotaMultiplier: 1.5,
    markDecayTicks: 1440, // 1/4 years
    politrukRatio: 8, // 1:8
    kgbAggression: 'high',
    growthMultiplier: 0.7,
    winterModifier: 'longer',
    decayMultiplier: 1.5,
    resourceMultiplier: 0.7,
  },
};

// ─────────────────────────────────────────────────────────
//  CONSTANTS: CONSEQUENCE PRESETS
// ─────────────────────────────────────────────────────────

export const CONSEQUENCE_PRESETS: Record<ConsequenceLevel, ConsequenceConfig> = {
  forgiving: {
    label: 'Forgiving',
    subtitle: 'Replaced by an Idiot',
    returnDelayYears: 1,
    buildingSurvival: 0.9,
    workerSurvival: 0.8,
    resourceSurvival: 0.5,
    marksReset: 1,
    scorePenalty: 100,
    permadeath: false,
    permadeathScoreMultiplier: 1.0,
  },
  permadeath: {
    label: 'Permadeath',
    subtitle: 'The File Is Closed',
    returnDelayYears: 0,
    buildingSurvival: 0,
    workerSurvival: 0,
    resourceSurvival: 0,
    marksReset: 0,
    scorePenalty: 0,
    permadeath: true,
    permadeathScoreMultiplier: 1.5,
  },
  harsh: {
    label: 'Harsh',
    subtitle: 'The Village Is Evacuated',
    returnDelayYears: 3,
    buildingSurvival: 0.4,
    workerSurvival: 0.25,
    resourceSurvival: 0.1,
    marksReset: 2,
    scorePenalty: 300,
    permadeath: false,
    permadeathScoreMultiplier: 1.0,
  },
};

// ─────────────────────────────────────────────────────────
//  CONSTANTS: SCORE MULTIPLIER MATRIX
// ─────────────────────────────────────────────────────────

/**
 * Final score multiplier based on difficulty x consequence combination.
 * Higher = more rewarding. Permadeath always pays the most.
 */
export const SCORE_MULTIPLIER_MATRIX: Record<DifficultyLevel, Record<ConsequenceLevel, number>> = {
  worker: {
    forgiving: 0.5,
    permadeath: 1.0,
    harsh: 0.7,
  },
  comrade: {
    forgiving: 0.8,
    permadeath: 1.5,
    harsh: 1.2,
  },
  tovarish: {
    forgiving: 1.0,
    permadeath: 2.0,
    harsh: 1.8,
  },
};

// ─────────────────────────────────────────────────────────
//  CONSTANTS: SCORE POINT VALUES
// ─────────────────────────────────────────────────────────

const POINTS = {
  workersAlive: 2,
  quotaMet: 50,
  quotaExceeded: 25,
  buildingStanding: 5,
  commendation: 30,
  blackMark: -40,
  kgbLoss: -10,
  conscripted: -5,
  cleanEra: 100,
} as const;

// ─────────────────────────────────────────────────────────
//  CONSTANTS: MEDALS
// ─────────────────────────────────────────────────────────

export const MEDALS: Medal[] = [
  {
    id: 'red_potato',
    name: 'Order of the Red Potato',
    description:
      'Awarded for surviving a famine without losing the will to plant more potatoes. The potato salutes you.',
    tier: 'copper',
    requirement: 'Survive a famine event',
  },
  {
    id: 'socialist_paperwork',
    name: 'Hero of Socialist Paperwork',
    description: 'For processing 1,000 quota ticks without a single paper cut. The filing cabinet weeps with pride.',
    tier: 'iron',
    requirement: 'Accumulate 1,000 ticks of quota tracking',
  },
  {
    id: 'distinguished_standing',
    name: 'Medal for Distinguished Standing in Lines',
    description:
      'Had 100+ population with 0 food. Everyone queued with dignity. The queue was for nothing. The dignity was also for nothing.',
    tier: 'tin',
    requirement: '100+ population with 0 food',
  },
  {
    id: 'concrete_enthusiasm',
    name: 'Order of Concrete Enthusiasm',
    description: 'Built 20 buildings. Each one a monument to ambition. Most of them leak. All of them are grey.',
    tier: 'concrete',
    requirement: 'Place 20 buildings',
  },
  {
    id: 'eternal_optimist',
    name: 'Medal of Eternal Optimism',
    description:
      'Survived 50 ticks with negative resource trends and still kept building. Delusion or dedication? Both.',
    tier: 'bronze',
    requirement: 'Survive 50 ticks while resources decline',
  },
  {
    id: 'iron_curtain',
    name: 'Iron Curtain Achievement Award',
    description:
      'Completed an entire era without a single positive event. The curtain held. Nothing got in. Nothing got out.',
    tier: 'iron',
    requirement: 'Complete an era with zero positive events',
  },
  {
    id: 'peoples_architect',
    name: "The People's Architect (Posthumous)",
    description: 'Had 5 buildings collapse in a single game. Architectural vision exceeded structural reality.',
    tier: 'tin',
    requirement: '5 building collapses',
  },
  {
    id: 'vodka_diplomat',
    name: 'Order of the Vodka Diplomat',
    description:
      'Maintained maximum vodka reserves for 20 consecutive ticks. International relations have never been smoother.',
    tier: 'copper',
    requirement: 'Max vodka for 20 ticks',
  },
  {
    id: 'five_year_hero',
    name: 'Five-Year Plan Hero (First Class)',
    description: 'Completed 3 consecutive quota plans. The planning committee is suspicious of your competence.',
    tier: 'bronze',
    requirement: 'Complete 3 consecutive quotas',
  },
  {
    id: 'gulag_warden',
    name: 'Distinguished Warden of Corrective Labour',
    description:
      'Operated 3 gulags simultaneously. Rehabilitation rates are excellent. Nobody checks what "rehabilitation" means.',
    tier: 'iron',
    requirement: '3 active gulags',
  },
  {
    id: 'millennium_survivor',
    name: 'Centennial Survival Medal',
    description: 'Reached the year 2000. The computers failed. You did not. The State endures.',
    tier: 'concrete',
    requirement: 'Reach year 2000',
  },
  {
    id: 'population_champion',
    name: 'Medal for Demographic Excellence',
    description: 'Reached 500 population. Housing is a suggestion. Personal space is bourgeois.',
    tier: 'bronze',
    requirement: 'Reach 500 population',
  },
];

// ─────────────────────────────────────────────────────────
//  ERA MULTIPLIER
// ─────────────────────────────────────────────────────────

/**
 * Returns the era score multiplier for a given era index (0-based).
 * Era 1 (index 0): x1.0, Era 8 (index 7): x3.0.
 * Linear interpolation between.
 */
export function getEraMultiplier(eraIndex: number): number {
  const clamped = Math.max(0, Math.min(eraIndex, 7));
  return 1.0 + (clamped * 2.0) / 7;
}

/**
 * Returns the score settings multiplier for a difficulty + consequence combo.
 */
export function getSettingsMultiplier(difficulty: DifficultyLevel, consequence: ConsequenceLevel): number {
  return SCORE_MULTIPLIER_MATRIX[difficulty][consequence];
}

// ─────────────────────────────────────────────────────────
//  SCORING SYSTEM
// ─────────────────────────────────────────────────────────

export class ScoringSystem {
  private difficulty: DifficultyLevel;
  private consequence: ConsequenceLevel;

  /** Completed era scores. */
  private eraScores: EraScoreBreakdown[] = [];

  /** Counters for the current (in-progress) era. */
  private currentEraQuotasMet = 0;
  private currentEraQuotasExceeded = 0;
  private currentEraKGBLosses = 0;
  private currentEraConscripted = 0;
  private currentEraInvestigated = false;

  /** Medals awarded during the game. */
  private awardedMedalIds: Set<string> = new Set();

  constructor(difficulty: DifficultyLevel = 'comrade', consequence: ConsequenceLevel = 'permadeath') {
    this.difficulty = difficulty;
    this.consequence = consequence;
  }

  // ── Event Hooks (called by SimulationEngine) ────────

  /** Called when a quota is successfully met. */
  onQuotaMet(): void {
    this.currentEraQuotasMet++;
  }

  /** Called when a quota is exceeded (>110% of target). */
  onQuotaExceeded(): void {
    this.currentEraQuotasExceeded++;
  }

  /** Called when workers are lost to KGB/purge/gulag. */
  onKGBLoss(count: number): void {
    this.currentEraKGBLosses += count;
  }

  /** Called when workers are conscripted. */
  onConscription(count: number): void {
    this.currentEraConscripted += count;
  }

  /** Called when the player is investigated (personnel file reaches 'investigated' or worse). */
  onInvestigation(): void {
    this.currentEraInvestigated = true;
  }

  /**
   * Called at era transition. Tallies the completed era's score.
   *
   * @param eraIndex        0-based index of the completed era
   * @param eraName         Display name of the completed era
   * @param workersAlive    Workers alive at era end
   * @param buildingsStanding Buildings standing at era end
   * @param commendations   Commendations on file at era end
   * @param blackMarks      Black marks on file at era end
   */
  onEraEnd(
    eraIndex: number,
    eraName: string,
    workersAlive: number,
    buildingsStanding: number,
    commendations: number,
    blackMarks: number,
  ): void {
    const workersAlivePoints = workersAlive * POINTS.workersAlive;
    const quotasMetPoints = this.currentEraQuotasMet * POINTS.quotaMet;
    const quotasExceededPoints = this.currentEraQuotasExceeded * POINTS.quotaExceeded;
    const buildingsStandingPoints = buildingsStanding * POINTS.buildingStanding;
    const commendationsPoints = commendations * POINTS.commendation;
    const blackMarksPoints = blackMarks * POINTS.blackMark;
    const kgbLossesPoints = this.currentEraKGBLosses * POINTS.kgbLoss;
    const conscriptedPoints = this.currentEraConscripted * POINTS.conscripted;
    const cleanEraBonus = this.currentEraInvestigated ? 0 : POINTS.cleanEra;

    const rawTotal =
      workersAlivePoints +
      quotasMetPoints +
      quotasExceededPoints +
      buildingsStandingPoints +
      commendationsPoints +
      blackMarksPoints +
      kgbLossesPoints +
      conscriptedPoints +
      cleanEraBonus;

    const eraMultiplier = getEraMultiplier(eraIndex);

    this.eraScores.push({
      eraIndex,
      eraName,
      workersAlive,
      workersAlivePoints,
      quotasMet: this.currentEraQuotasMet,
      quotasMetPoints,
      quotasExceeded: this.currentEraQuotasExceeded,
      quotasExceededPoints,
      buildingsStanding,
      buildingsStandingPoints,
      commendations,
      commendationsPoints,
      blackMarks,
      blackMarksPoints,
      kgbLosses: this.currentEraKGBLosses,
      kgbLossesPoints,
      conscripted: this.currentEraConscripted,
      conscriptedPoints,
      cleanEraBonus,
      rawTotal,
      eraMultiplier,
      eraTotal: Math.floor(rawTotal * eraMultiplier),
    });

    // Reset per-era counters
    this.currentEraQuotasMet = 0;
    this.currentEraQuotasExceeded = 0;
    this.currentEraKGBLosses = 0;
    this.currentEraConscripted = 0;
    this.currentEraInvestigated = false;
  }

  // ── Score Queries ───────────────────────────────────

  /** Get the full score breakdown across all completed eras. */
  getScoreBreakdown(): ScoreBreakdown {
    const subtotal = this.eraScores.reduce((sum, era) => sum + era.eraTotal, 0);
    const settingsMultiplier = getSettingsMultiplier(this.difficulty, this.consequence);

    return {
      eras: [...this.eraScores],
      subtotal,
      settingsMultiplier,
      finalScore: Math.floor(subtotal * settingsMultiplier),
    };
  }

  /** Get the final score (shorthand). */
  getFinalScore(): number {
    return this.getScoreBreakdown().finalScore;
  }

  /** Get the current difficulty level. */
  getDifficulty(): DifficultyLevel {
    return this.difficulty;
  }

  /** Get the current consequence level. */
  getConsequence(): ConsequenceLevel {
    return this.consequence;
  }

  /** Get the difficulty config for the current level. */
  getDifficultyConfig(): DifficultyConfig {
    return { ...DIFFICULTY_PRESETS[this.difficulty] };
  }

  /** Get the consequence config for the current level. */
  getConsequenceConfig(): ConsequenceConfig {
    return { ...CONSEQUENCE_PRESETS[this.consequence] };
  }

  /** Get the settings multiplier for the current difficulty + consequence. */
  getSettingsMultiplier(): number {
    return getSettingsMultiplier(this.difficulty, this.consequence);
  }

  /** Get the number of completed eras. */
  getErasCompleted(): number {
    return this.eraScores.length;
  }

  /** Get the total quotas met across all completed eras + current. */
  getTotalQuotasMet(): number {
    return this.eraScores.reduce((sum, era) => sum + era.quotasMet, 0) + this.currentEraQuotasMet;
  }

  /**
   * Produce a partial era score for the current (in-progress) era.
   * Used by the end-game tally when the game ends mid-era.
   */
  getCurrentEraPartialScore(
    eraIndex: number,
    eraName: string,
    workersAlive: number,
    buildingsStanding: number,
    commendations: number,
    blackMarks: number,
  ): EraScoreBreakdown {
    const workersAlivePoints = workersAlive * POINTS.workersAlive;
    const quotasMetPoints = this.currentEraQuotasMet * POINTS.quotaMet;
    const quotasExceededPoints = this.currentEraQuotasExceeded * POINTS.quotaExceeded;
    const buildingsStandingPoints = buildingsStanding * POINTS.buildingStanding;
    const commendationsPoints = commendations * POINTS.commendation;
    const blackMarksPoints = blackMarks * POINTS.blackMark;
    const kgbLossesPoints = this.currentEraKGBLosses * POINTS.kgbLoss;
    const conscriptedPoints = this.currentEraConscripted * POINTS.conscripted;
    const cleanEraBonus = this.currentEraInvestigated ? 0 : POINTS.cleanEra;

    const rawTotal =
      workersAlivePoints +
      quotasMetPoints +
      quotasExceededPoints +
      buildingsStandingPoints +
      commendationsPoints +
      blackMarksPoints +
      kgbLossesPoints +
      conscriptedPoints +
      cleanEraBonus;

    const eraMultiplier = getEraMultiplier(eraIndex);

    return {
      eraIndex,
      eraName,
      workersAlive,
      workersAlivePoints,
      quotasMet: this.currentEraQuotasMet,
      quotasMetPoints,
      quotasExceeded: this.currentEraQuotasExceeded,
      quotasExceededPoints,
      buildingsStanding,
      buildingsStandingPoints,
      commendations,
      commendationsPoints,
      blackMarks,
      blackMarksPoints,
      kgbLosses: this.currentEraKGBLosses,
      kgbLossesPoints,
      conscripted: this.currentEraConscripted,
      conscriptedPoints,
      cleanEraBonus,
      rawTotal,
      eraMultiplier,
      eraTotal: Math.floor(rawTotal * eraMultiplier),
    };
  }

  // ── Medals ──────────────────────────────────────────

  /** Award a medal by ID. Returns true if newly awarded. */
  awardMedal(medalId: string): boolean {
    if (this.awardedMedalIds.has(medalId)) return false;
    this.awardedMedalIds.add(medalId);
    return true;
  }

  /** Get the set of awarded medal IDs. */
  getAwardedMedalIds(): ReadonlySet<string> {
    return this.awardedMedalIds;
  }

  /** Get full Medal objects for all awarded medals. */
  getAwardedMedals(): Medal[] {
    return MEDALS.filter((m) => this.awardedMedalIds.has(m.id));
  }

  // ── Serialization ───────────────────────────────────

  serialize(): ScoringSystemSaveData {
    return {
      difficulty: this.difficulty,
      consequence: this.consequence,
      eraScores: [...this.eraScores],
      currentEraQuotasMet: this.currentEraQuotasMet,
      currentEraQuotasExceeded: this.currentEraQuotasExceeded,
      currentEraKGBLosses: this.currentEraKGBLosses,
      currentEraConscripted: this.currentEraConscripted,
      currentEraInvestigated: this.currentEraInvestigated,
      awardedMedalIds: [...this.awardedMedalIds],
    };
  }

  static deserialize(data: ScoringSystemSaveData): ScoringSystem {
    const sys = new ScoringSystem(data.difficulty, data.consequence);
    sys.eraScores = [...data.eraScores];
    sys.currentEraQuotasMet = data.currentEraQuotasMet;
    sys.currentEraQuotasExceeded = data.currentEraQuotasExceeded;
    sys.currentEraKGBLosses = data.currentEraKGBLosses;
    sys.currentEraConscripted = data.currentEraConscripted;
    sys.currentEraInvestigated = data.currentEraInvestigated;
    sys.awardedMedalIds = new Set(data.awardedMedalIds);
    return sys;
  }
}

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Resolve an era ID to its 0-based index in ERA_ORDER.
 * Returns 0 if not found.
 */
export function eraIdToIndex(eraId: string): number {
  const idx = ERA_ORDER.indexOf(eraId as (typeof ERA_ORDER)[number]);
  return idx >= 0 ? idx : 0;
}
