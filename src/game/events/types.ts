import type { GameView } from '../GameView';

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

export type EventSeverity = 'trivial' | 'minor' | 'major' | 'catastrophic';

export type EventCategory = 'disaster' | 'political' | 'economic' | 'cultural' | 'absurdist';

export interface ResourceDelta {
  money?: number;
  food?: number;
  vodka?: number;
  pop?: number;
  power?: number;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  pravdaHeadline: string;
  category: EventCategory;
  severity: EventSeverity;
  effects: ResourceDelta;
  /** Maps to category bucket for UI color */
  type: 'good' | 'bad' | 'neutral';
}

/** Template that can reference current state for dynamic text */
export interface EventTemplate {
  id: string;
  title: string;
  description: string | ((gs: GameView) => string);
  pravdaHeadline: string | ((gs: GameView) => string);
  category: EventCategory;
  severity: EventSeverity;
  effects: ResourceDelta | ((gs: GameView) => ResourceDelta);
  /** Only fires when predicate is true */
  condition?: (gs: GameView) => boolean;
  /** Weight for random selection (default 1) */
  weight?: number;
  /** If set, this event only fires during these eras */
  eraFilter?: string[];
}
