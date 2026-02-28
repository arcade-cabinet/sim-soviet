/**
 * @module game/TutorialSystem
 *
 * TUTORIAL SYSTEM — Era 1 Progressive Disclosure
 * ================================================
 * SimSoviet 2000 — Guided introduction via Comrade Krupnik
 *
 * Era 1 (War Communism, 1922-1928) doubles as the tutorial. Buildings,
 * UI elements, and game mechanics are progressively revealed through
 * 14 milestones. Krupnik, a weary-but-helpful advisor, delivers
 * sardonic guidance at each step.
 *
 * The TutorialSystem is a pure query/gate system — it does NOT mutate
 * ECS state. The SimulationEngine and UI read from it to determine
 * what buildings can be placed and which HUD elements are visible.
 *
 * When the tutorial is inactive (skipped or era >= 2), all gates
 * are open — `isBuildingUnlocked` and `isUIRevealed` return true.
 */

import type { GameMeta, Resources } from '@/ecs/world';

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

/** UI elements that can be progressively revealed during the tutorial. */
export type UIElement =
  | 'build_button'
  | 'resource_bar'
  | 'speed_controls'
  | 'quota_display'
  | 'hamburger_menu'
  | 'pravda_ticker'
  | 'settlement_badge'
  | 'personnel_file';

/**
 * A single tutorial milestone — triggers when both `triggerTick` is
 * reached and the optional `condition` evaluates to true.
 */
export interface TutorialMilestone {
  /** Unique identifier for this milestone. */
  id: string;
  /** Tick at which this milestone becomes eligible (condition must also pass). */
  triggerTick: number;
  /** Optional additional condition beyond tick count. */
  condition?: (meta: GameMeta, resources: Resources, buildingCount: number) => boolean;
  /** Krupnik dialogue for this milestone. */
  dialogue: string;
  /** Building defIds unlocked at this milestone. */
  unlockedBuildings?: string[];
  /** UI elements revealed at this milestone. */
  revealedUI?: UIElement[];
  /** Whether this milestone pauses the simulation. */
  pauseOnTrigger: boolean;
}

/** Serialized TutorialSystem state for save/load. */
export interface TutorialSaveData {
  completedMilestones: string[];
  active: boolean;
}

// ─────────────────────────────────────────────────────────
//  SEASON HELPER
// ─────────────────────────────────────────────────────────

/** Derives the simplified 3-season key from a calendar month (1-12). */
function getSimpleSeason(month: number): 'winter' | 'mud' | 'summer' {
  if (month === 11 || month === 12 || month <= 3) return 'winter';
  if (month === 4 || month === 10) return 'mud';
  return 'summer';
}

// ─────────────────────────────────────────────────────────
//  MILESTONE DEFINITIONS
// ─────────────────────────────────────────────────────────

/**
 * The 14 milestones of the Era 1 tutorial, ordered chronologically.
 * Milestones are checked in sequence — only the first eligible
 * uncompleted milestone triggers per tick.
 */
export const TUTORIAL_MILESTONES: readonly TutorialMilestone[] = [
  // 1. Welcome — game start
  {
    id: 'welcome',
    triggerTick: 0,
    dialogue:
      'Welcome, Comrade. I am Krupnik. I have been assigned to assist you. ' +
      'This is not a reward for either of us. Build a farm — your people ' +
      'will need food before they need anything else.',
    unlockedBuildings: ['collective-farm-hq'],
    revealedUI: ['build_button'],
    pauseOnTrigger: true,
  },

  // 2. First building placed
  {
    id: 'first_building',
    triggerTick: 0,
    condition: (_meta, _resources, buildingCount) => buildingCount > 0,
    dialogue:
      'You built something. It probably will not collapse. Probably. ' +
      'I have learned not to make promises about Soviet construction.',
    revealedUI: ['resource_bar'],
    pauseOnTrigger: false,
  },

  // 3. Build a farm — gentle nudge after 30 ticks (~1 month)
  {
    id: 'build_farm',
    triggerTick: 30,
    dialogue:
      'Your people need food. The soil is... optimistic. The farmers are not. ' +
      'A collective farm will produce enough to survive, if you are lucky. ' +
      'Luck is not a plan, but it is all we have.',
    pauseOnTrigger: false,
  },

  // 4. First harvest — condition: food > 50
  {
    id: 'first_harvest',
    triggerTick: 0,
    condition: (_meta, resources) => resources.food > 50,
    dialogue:
      'You have food. Not enough food, but food. In Soviet planning, ' +
      'this counts as abundance. Write it down before someone revises ' +
      'the definition.',
    revealedUI: ['speed_controls'],
    pauseOnTrigger: false,
  },

  // 5. Build housing — tick ~90 (~3 months)
  {
    id: 'build_housing',
    triggerTick: 90,
    dialogue:
      'Your citizens are sleeping outdoors. This builds character. ' +
      'Unfortunately, it also builds resentment. Give them walls. ' +
      'The walls do not need to be thick. They will not notice.',
    unlockedBuildings: ['workers-house-a', 'workers-house-b'],
    pauseOnTrigger: true,
  },

  // 6. Power — tick ~180 (~6 months)
  {
    id: 'power',
    triggerTick: 180,
    dialogue:
      'Darkness has its charm, but production requires electricity. ' +
      'Build a power station. The smoke is a feature, not a flaw. ' +
      'Everything here is a feature.',
    unlockedBuildings: ['power-station'],
    pauseOnTrigger: true,
  },

  // 7. First winter — condition-based (month enters 11, 12, or 1-3)
  {
    id: 'first_winter',
    triggerTick: 0,
    condition: (meta) => getSimpleSeason(meta.date.month) === 'winter',
    dialogue:
      'Ah, winter. The great equalizer. Everything freezes — the pipes, ' +
      'the soil, the optimism. Farms produce nothing. Heating costs rise. ' +
      'Bundle up. Not that bundling helps.',
    pauseOnTrigger: false,
  },

  // 8. Vodka economy — tick ~360 (~1 year)
  {
    id: 'vodka_economy',
    triggerTick: 360,
    dialogue:
      'Your workers have discovered that vodka makes the cold bearable ' +
      'and the quotas less terrifying. Build a distillery. It is not ' +
      'optional. I speak from experience.',
    unlockedBuildings: ['vodka-distillery'],
    pauseOnTrigger: true,
  },

  // 9. The quota — condition: quota target > 0 and some production exists
  {
    id: 'the_quota',
    triggerTick: 300,
    condition: (meta) => meta.quota.target > 0,
    dialogue:
      'Moscow has expectations. They call them quotas. The targets are ' +
      'ambitious. "Ambitious" is what we say when we mean "impossible." ' +
      'Meet them anyway. The alternative is worse.',
    revealedUI: ['quota_display'],
    pauseOnTrigger: false,
  },

  // 10. Infrastructure — tick ~540 (~18 months)
  {
    id: 'infrastructure',
    triggerTick: 540,
    dialogue:
      'Your settlement is growing. It needs structure. Fences, guard posts, ' +
      'a school for the children. Education is mandatory. The curriculum ' +
      'has already been written. The answers have already been decided.',
    unlockedBuildings: ['fence', 'fence-low', 'guard-post', 'concrete-block', 'school'],
    revealedUI: ['hamburger_menu', 'pravda_ticker'],
    pauseOnTrigger: true,
  },

  // 11. First year complete — tick 360 = 1 game year
  {
    id: 'first_year_complete',
    triggerTick: 360,
    condition: (meta) => meta.date.year > 1922,
    dialogue:
      'You survived a year. This is not as common as you would think. ' +
      'Take a moment. The moment is over. Back to work.',
    revealedUI: ['settlement_badge', 'personnel_file'],
    pauseOnTrigger: false,
  },

  // 12. Government buildings — tick ~720 (~2 years)
  {
    id: 'government_buildings',
    triggerTick: 720,
    dialogue:
      'Moscow wants to see loyalty. Build something impressive. Something ' +
      'with a flag. The flag does not need to be new. Reuse is patriotic.',
    unlockedBuildings: ['government-hq', 'factory-office'],
    pauseOnTrigger: true,
  },

  // 13. Cultural progress — tick ~1080 (~3 years)
  {
    id: 'cultural_progress',
    triggerTick: 1080,
    dialogue:
      'The people need culture. Approved culture. Build a Cultural Palace. ' +
      'The ballet schedule has been pre-determined. So has the applause.',
    unlockedBuildings: ['cultural-palace', 'workers-club'],
    pauseOnTrigger: false,
  },

  // 14. Era transition — condition: year >= 1928
  {
    id: 'era_transition',
    triggerTick: 2000,
    condition: (meta) => meta.date.year >= 1928,
    dialogue:
      'The era is changing. New plans. New quotas. New ways to fail. ' +
      'But you are still here, Comrade. That counts for something. ' +
      'I think.',
    pauseOnTrigger: true,
  },
];

// ─────────────────────────────────────────────────────────
//  UI REVEAL SCHEDULE
// ─────────────────────────────────────────────────────────

/**
 * Maps milestone IDs to the UI elements they reveal.
 * Derived from the milestone definitions for quick reference.
 */
export const UI_REVEAL_SCHEDULE: Readonly<Record<string, UIElement[]>> = {
  welcome: ['build_button'],
  first_building: ['resource_bar'],
  first_harvest: ['speed_controls'],
  the_quota: ['quota_display'],
  infrastructure: ['hamburger_menu', 'pravda_ticker'],
  first_year_complete: ['settlement_badge', 'personnel_file'],
};

// ─────────────────────────────────────────────────────────
//  TUTORIAL SYSTEM
// ─────────────────────────────────────────────────────────

/**
 * Manages the Era 1 tutorial progression.
 *
 * The system tracks completed milestones, unlocked buildings, and
 * revealed UI elements. Each tick, it checks whether the next
 * uncompleted milestone should trigger based on tick count and
 * optional conditions.
 *
 * When inactive (skipped or after era transition), all gates are open.
 */
export class TutorialSystem {
  private milestones: readonly TutorialMilestone[];
  private completedMilestones: Set<string>;
  private unlockedBuildings: Set<string>;
  private revealedUI: Set<UIElement>;
  private active: boolean;
  private currentGuidance: string | null;

  constructor() {
    this.milestones = TUTORIAL_MILESTONES;
    this.completedMilestones = new Set();
    this.unlockedBuildings = new Set();
    this.revealedUI = new Set();
    this.active = true;
    this.currentGuidance = null;
  }

  /** Returns true if the tutorial is currently active. */
  isActive(): boolean {
    return this.active;
  }

  /** Disables the tutorial — all building and UI gates open immediately. */
  skip(): void {
    this.active = false;
  }

  /**
   * Called each simulation tick. Checks the next uncompleted milestone
   * and triggers it if conditions are met.
   *
   * @returns The triggered milestone, or null if nothing triggered.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: tutorial checks 14 milestone conditions sequentially
  tick(
    totalTicks: number,
    meta: GameMeta,
    resources: Resources,
    buildingCount: number
  ): TutorialMilestone | null {
    if (!this.active) return null;

    for (const milestone of this.milestones) {
      if (this.completedMilestones.has(milestone.id)) continue;

      // Check tick threshold
      if (totalTicks < milestone.triggerTick) continue;

      // Check optional condition
      if (milestone.condition && !milestone.condition(meta, resources, buildingCount)) {
        continue;
      }

      // Trigger this milestone
      this.completedMilestones.add(milestone.id);
      this.currentGuidance = milestone.dialogue;

      // Unlock buildings
      if (milestone.unlockedBuildings) {
        for (const defId of milestone.unlockedBuildings) {
          this.unlockedBuildings.add(defId);
        }
      }

      // Reveal UI elements
      if (milestone.revealedUI) {
        for (const element of milestone.revealedUI) {
          this.revealedUI.add(element);
        }
      }

      // Deactivate tutorial on era transition
      if (milestone.id === 'era_transition') {
        this.active = false;
      }

      return milestone;
    }

    return null;
  }

  /**
   * Returns true if a building defId is available for placement.
   * When the tutorial is inactive, all buildings are allowed.
   */
  isBuildingUnlocked(defId: string): boolean {
    if (!this.active) return true;
    return this.unlockedBuildings.has(defId);
  }

  /**
   * Returns true if a UI element should be visible.
   * When the tutorial is inactive, all UI elements are shown.
   */
  isUIRevealed(element: UIElement): boolean {
    if (!this.active) return true;
    return this.revealedUI.has(element);
  }

  /** Returns all currently unlocked building defIds. */
  getUnlockedBuildings(): string[] {
    if (!this.active) return [];
    return [...this.unlockedBuildings];
  }

  /** Returns Krupnik's most recent guidance dialogue, or null if none yet. */
  getCurrentGuidance(): string | null {
    return this.currentGuidance;
  }

  /** Returns the set of completed milestone IDs. */
  getCompletedMilestones(): ReadonlySet<string> {
    return this.completedMilestones;
  }

  /**
   * Returns tutorial completion as a fraction (0.0 to 1.0).
   * Based on the number of completed milestones vs total milestones.
   */
  getProgress(): number {
    if (this.milestones.length === 0) return 1;
    return this.completedMilestones.size / this.milestones.length;
  }

  // ── Serialization ────────────────────────────────────

  /** Serialize to a plain object for save/load. */
  serialize(): TutorialSaveData {
    return {
      completedMilestones: [...this.completedMilestones],
      active: this.active,
    };
  }

  /** Restore a TutorialSystem from saved data. */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: restoring tutorial state from many fields
  static deserialize(data: TutorialSaveData): TutorialSystem {
    const system = new TutorialSystem();
    system.active = data.active;

    for (const id of data.completedMilestones) {
      system.completedMilestones.add(id);
    }

    // Rebuild derived state from completed milestones
    for (const milestone of TUTORIAL_MILESTONES) {
      if (system.completedMilestones.has(milestone.id)) {
        if (milestone.unlockedBuildings) {
          for (const defId of milestone.unlockedBuildings) {
            system.unlockedBuildings.add(defId);
          }
        }
        if (milestone.revealedUI) {
          for (const element of milestone.revealedUI) {
            system.revealedUI.add(element);
          }
        }
        // Track the last completed milestone's dialogue as current guidance
        system.currentGuidance = milestone.dialogue;
      }
    }

    return system;
  }
}
