import { getMetaEntity } from '@/ecs/archetypes';
import type { GameEvent } from '../events';
import { createGameView } from '../GameView';
import type { GameRng } from '../SeedSystem';
import { generateEventReactiveHeadline, generateHeadline } from './generators';
import { setPravdaRng } from './helpers';
import type { GeneratedHeadline, HeadlineCategory, PravdaHeadline } from './types';

/** Save data for PravdaSystem. */
export interface PravdaSaveData {
  headlineHistory: PravdaHeadline[];
  lastHeadlineTime: number;
  headlineCooldown: number;
  recentCategories: HeadlineCategory[];
}

// ─────────────────────────────────────────────────────────
//  PRAVDA SYSTEM CLASS
//
//  Public API is fully backward-compatible with the old
//  hardcoded system. SimulationEngine and EventSystem
//  call the same methods, but now get procedurally
//  generated headlines instead of fixed templates.
// ─────────────────────────────────────────────────────────

export class PravdaSystem {
  private headlineHistory: PravdaHeadline[] = [];
  private lastHeadlineTime = 0;
  private headlineCooldown = 90000; // 90 seconds between ambient headlines
  /** Track recent headline patterns to avoid repetition */
  private recentCategories: HeadlineCategory[] = [];
  private maxCategoryMemory = 6;

  constructor(rng?: GameRng) {
    if (rng) setPravdaRng(rng);
  }

  /**
   * Generate a Pravda headline from a game event.
   * May reframe the event entirely (e.g., catastrophe -> external threat distraction).
   */
  public headlineFromEvent(event: GameEvent): PravdaHeadline {
    const generated = generateEventReactiveHeadline(event, createGameView());
    const headline: PravdaHeadline = {
      ...generated,
      timestamp: Date.now(),
    };
    this.recordHeadline(headline);
    return headline;
  }

  /**
   * Generate a random ambient headline not tied to a specific event.
   * Called periodically to keep the news ticker alive.
   */
  public generateAmbientHeadline(): PravdaHeadline | null {
    const now = Date.now();
    if (now - this.lastHeadlineTime < this.headlineCooldown) return null;

    // Generate candidates and avoid recent category repetition
    let generated: GeneratedHeadline;
    let attempts = 0;
    do {
      generated = generateHeadline(createGameView());
      attempts++;
    } while (
      attempts < 5 &&
      this.recentCategories.length >= 2 &&
      this.recentCategories.slice(-2).every((c) => c === generated.category)
    );

    const headline: PravdaHeadline = {
      ...generated,
      timestamp: now,
    };

    this.recordHeadline(headline);
    this.lastHeadlineTime = now;
    return headline;
  }

  /** Get headline history for a scrolling ticker */
  public getRecentHeadlines(count = 10): PravdaHeadline[] {
    return this.headlineHistory.slice(-count);
  }

  /** Get the formatted "newspaper front page" string */
  public formatFrontPage(): string {
    const latest = this.headlineHistory.slice(-3);
    if (latest.length === 0) return 'PRAVDA: NO NEWS IS GOOD NEWS. ALL NEWS IS GOOD NEWS.';

    const lines = latest.map((h) => `\u2605 ${h.headline}`);
    return `PRAVDA | ${getMetaEntity()?.gameMeta.date.year ?? 1922}\n${lines.join('\n')}`;
  }

  // ── Serialization ────────────────────────────────────

  /** Serialize system state for save/load. */
  serialize(): PravdaSaveData {
    return {
      headlineHistory: [...this.headlineHistory],
      lastHeadlineTime: this.lastHeadlineTime,
      headlineCooldown: this.headlineCooldown,
      recentCategories: [...this.recentCategories],
    };
  }

  /** Restore system state from save data. */
  static deserialize(data: PravdaSaveData, rng?: GameRng): PravdaSystem {
    const system = new PravdaSystem(rng);
    system.headlineHistory = [...data.headlineHistory];
    system.lastHeadlineTime = data.lastHeadlineTime;
    system.headlineCooldown = data.headlineCooldown;
    system.recentCategories = [...data.recentCategories];
    return system;
  }

  // ── private ──────────────────────────────────────────

  private recordHeadline(headline: PravdaHeadline): void {
    this.headlineHistory.push(headline);
    this.recentCategories.push(headline.category);
    if (this.recentCategories.length > this.maxCategoryMemory) {
      this.recentCategories.shift();
    }
  }
}
