import type { GameView } from '../GameView';

// ─────────────────────────────────────────────────────────
//  PUBLIC TYPES
// ─────────────────────────────────────────────────────────

/** A generated headline with metadata */
export interface PravdaHeadline {
  headline: string;
  subtext: string;
  /** The grim reality behind the headline */
  reality: string;
  category: 'triumph' | 'production' | 'culture' | 'weather' | 'editorial' | 'threat' | 'leader' | 'spin';
  timestamp: number;
}

/** Union of valid headline categories for repetition avoidance. */
export type HeadlineCategory = PravdaHeadline['category'];

/** Raw headline output from a generator (before timestamp assignment). */
export interface GeneratedHeadline {
  headline: string;
  subtext: string;
  reality: string;
  category: HeadlineCategory;
}

/** Function that produces a headline from the current game view. */
export type HeadlineGenerator = (gs: GameView) => GeneratedHeadline;

/** A weighted headline generator that only fires when its condition is met. */
export interface ContextualGenerator {
  condition: (gs: GameView) => boolean;
  weight: number;
  generate: HeadlineGenerator;
}
