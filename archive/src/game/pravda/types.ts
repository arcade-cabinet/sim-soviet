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
  category:
    | 'triumph'
    | 'production'
    | 'culture'
    | 'weather'
    | 'editorial'
    | 'threat'
    | 'leader'
    | 'spin';
  timestamp: number;
}

export type HeadlineCategory = PravdaHeadline['category'];

export interface GeneratedHeadline {
  headline: string;
  subtext: string;
  reality: string;
  category: HeadlineCategory;
}

export type HeadlineGenerator = (gs: GameView) => GeneratedHeadline;

export interface ContextualGenerator {
  condition: (gs: GameView) => boolean;
  weight: number;
  generate: HeadlineGenerator;
}
