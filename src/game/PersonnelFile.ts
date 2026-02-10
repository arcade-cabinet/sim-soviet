/**
 * PersonnelFile -- the central game-over mechanic for SimSoviet 2000.
 *
 * The player's personnel file accumulates black marks (bad) and
 * commendations (good). Too many effective marks = arrest = game over.
 *
 * Effective marks = blackMarks - commendations (minimum 0).
 * Threshold effects escalate from normal operations to arrest at 7+.
 * Marks decay over time if no new marks are added (rate depends on difficulty).
 */

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

export type Difficulty = 'worker' | 'comrade' | 'tovarish';

export type MarkSource =
  | 'worker_arrested'
  | 'quota_missed_minor'
  | 'quota_missed_major'
  | 'quota_missed_catastrophic'
  | 'construction_mandate'
  | 'conscription_failed'
  | 'black_market'
  | 'lying_to_kgb'
  | 'stakhanovite_fraud'
  | 'blat_noticed'
  | 'suppressing_news';

export type CommendationSource =
  | 'quota_exceeded'
  | 'stakhanovite_celebrated'
  | 'inspection_passed'
  | 'ideology_session_passed';

export interface FileEntry {
  tick: number;
  type: 'mark' | 'commendation';
  source: string;
  amount: number;
  description: string;
}

export type ThreatLevel =
  | 'safe'
  | 'watched'
  | 'warned'
  | 'investigated'
  | 'reviewed'
  | 'arrested';

export interface PersonnelFileSaveData {
  difficulty: Difficulty;
  blackMarks: number;
  commendations: number;
  lastMarkAddedTick: number;
  lastDecayTick: number;
  history: FileEntry[];
}

// ─────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────

const MARK_AMOUNTS: Record<MarkSource, number> = {
  worker_arrested: 1,
  quota_missed_minor: 1,
  quota_missed_major: 2,
  quota_missed_catastrophic: 3,
  construction_mandate: 1,
  conscription_failed: 2,
  black_market: 2,
  lying_to_kgb: 2,
  stakhanovite_fraud: 1,
  blat_noticed: 1,
  suppressing_news: 1,
};

const COMMENDATION_AMOUNTS: Record<CommendationSource, number> = {
  quota_exceeded: 1,
  stakhanovite_celebrated: 1,
  inspection_passed: 0.5,
  ideology_session_passed: 0.5,
};

const DECAY_INTERVALS: Record<Difficulty, number> = {
  worker: 360,
  comrade: 720,
  tovarish: 1440,
};

const DEFAULT_MARK_DESCRIPTIONS: Record<MarkSource, string> = {
  worker_arrested: 'Worker arrested for disloyalty',
  quota_missed_minor: 'Production quota missed (10-30%)',
  quota_missed_major: 'Production quota missed (30-60%)',
  quota_missed_catastrophic: 'Production quota catastrophically missed (>60%)',
  construction_mandate: 'Construction mandate not met',
  conscription_failed: 'Conscription quota not met',
  black_market: 'Black market activity detected',
  lying_to_kgb: 'Caught providing false information to KGB',
  stakhanovite_fraud: 'Stakhanovite hero exposed as fraud',
  blat_noticed: 'Unauthorized blat transaction noticed',
  suppressing_news: 'Suppressing news from central committee',
};

const DEFAULT_COMMENDATION_DESCRIPTIONS: Record<CommendationSource, string> = {
  quota_exceeded: 'Production quota exceeded',
  stakhanovite_celebrated: 'Stakhanovite worker celebrated',
  inspection_passed: 'Passed official inspection',
  ideology_session_passed: 'Ideology session: all participants passed',
};

const ARREST_THRESHOLD = 7;

// ─────────────────────────────────────────────────────────
//  PERSONNEL FILE
// ─────────────────────────────────────────────────────────

export class PersonnelFile {
  private difficulty: Difficulty;
  private blackMarks: number;
  private commendations: number;
  private lastMarkAddedTick: number;
  private lastDecayTick: number;
  private history: FileEntry[];

  constructor(difficulty: Difficulty = 'comrade') {
    this.difficulty = difficulty;
    this.blackMarks = 0;
    this.commendations = 0;
    this.lastMarkAddedTick = -Infinity;
    this.lastDecayTick = 0;
    this.history = [];
  }

  /** Add black marks. Returns the current threat level after adding. */
  addMark(source: MarkSource, tick: number, description?: string): ThreatLevel {
    const amount = MARK_AMOUNTS[source];
    this.blackMarks += amount;
    this.lastMarkAddedTick = tick;

    this.history.push({
      tick,
      type: 'mark',
      source,
      amount,
      description: description ?? DEFAULT_MARK_DESCRIPTIONS[source],
    });

    return this.getThreatLevel();
  }

  /** Add commendation. */
  addCommendation(
    source: CommendationSource,
    tick: number,
    description?: string,
  ): void {
    const amount = COMMENDATION_AMOUNTS[source];
    this.commendations += amount;

    this.history.push({
      tick,
      type: 'commendation',
      source,
      amount,
      description: description ?? DEFAULT_COMMENDATION_DESCRIPTIONS[source],
    });
  }

  /** Call each tick to handle mark decay. */
  tick(currentTick: number): void {
    const decayInterval = DECAY_INTERVALS[this.difficulty];

    if (
      currentTick - this.lastDecayTick >= decayInterval &&
      this.lastMarkAddedTick < this.lastDecayTick &&
      this.blackMarks > 0
    ) {
      this.blackMarks = Math.max(0, this.blackMarks - 1);
      this.lastDecayTick = currentTick;
    }
  }

  /** Get current effective marks (marks - commendations, min 0) */
  getEffectiveMarks(): number {
    return Math.max(0, this.blackMarks - this.commendations);
  }

  /** Get raw black mark count */
  getBlackMarks(): number {
    return this.blackMarks;
  }

  /** Get raw commendation count */
  getCommendations(): number {
    return this.commendations;
  }

  /** Get current threat level based on effective marks */
  getThreatLevel(): ThreatLevel {
    const effective = this.getEffectiveMarks();
    if (effective >= 7) return 'arrested';
    if (effective >= 6) return 'reviewed';
    if (effective >= 5) return 'investigated';
    if (effective >= 4) return 'warned';
    if (effective >= 3) return 'watched';
    return 'safe';
  }

  /** Check if game over (effective marks >= 7) */
  isArrested(): boolean {
    return this.getEffectiveMarks() >= ARREST_THRESHOLD;
  }

  /** Get the full file history */
  getHistory(): ReadonlyArray<FileEntry> {
    return this.history;
  }

  /** Reset marks to 2 (era transition) */
  resetForNewEra(): void {
    this.blackMarks = 2;
    this.commendations = 0;
    this.lastMarkAddedTick = -Infinity;
    this.lastDecayTick = 0;

    this.history.push({
      tick: 0,
      type: 'mark',
      source: 'era_transition',
      amount: 2,
      description: 'File transferred to new era -- marks reset to 2',
    });
  }

  /** Serialize for save data */
  serialize(): PersonnelFileSaveData {
    return {
      difficulty: this.difficulty,
      blackMarks: this.blackMarks,
      commendations: this.commendations,
      lastMarkAddedTick: this.lastMarkAddedTick,
      lastDecayTick: this.lastDecayTick,
      history: [...this.history],
    };
  }

  /** Deserialize from save data */
  static deserialize(data: PersonnelFileSaveData): PersonnelFile {
    const file = new PersonnelFile(data.difficulty);
    file.blackMarks = data.blackMarks;
    file.commendations = data.commendations;
    file.lastMarkAddedTick = data.lastMarkAddedTick;
    file.lastDecayTick = data.lastDecayTick;
    file.history = [...data.history];
    return file;
  }
}
