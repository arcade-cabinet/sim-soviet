/**
 * @module game/SettlementSystem
 *
 * Tracks the settlement's classification tier based on the real Soviet
 * settlement hierarchy: село → рабочий посёлок → посёлок городского типа → город.
 *
 * Each tick evaluates whether the settlement qualifies for promotion or
 * demotion based on population, building composition, and non-agricultural
 * worker percentage. Tier changes require sustained performance over
 * multiple consecutive ticks.
 */

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

export type SettlementTier = 'selo' | 'posyolok' | 'pgt' | 'gorod';

export interface TierDefinition {
  tier: SettlementTier;
  /** Russian name: село, рабочий посёлок, посёлок городского типа, город */
  russian: string;
  /** Player's title at this tier */
  title: string;
  /** Minimum workers */
  populationReq: number;
  /** % workers in non-agricultural buildings (0-100) */
  nonAgriPercent: number;
  /** Required building roles (at least one from each) */
  buildingReqs: string[];
  /** Consecutive ticks meeting all reqs before upgrade */
  upgradeTicks: number;
  /** Consecutive ticks below population before downgrade */
  downgradeTicks: number;
}

export interface SettlementMetrics {
  population: number;
  buildings: Array<{ defId: string; role: string }>;
  totalWorkers: number;
  /** For now, just count non-farm buildings x their staffCap */
  nonAgriculturalWorkers: number;
}

export type SettlementEventType = 'upgrade' | 'downgrade';

export interface SettlementEvent {
  type: SettlementEventType;
  fromTier: SettlementTier;
  toTier: SettlementTier;
  /** e.g., "DECREE OF THE SUPREME SOVIET" */
  title: string;
  /** Flavor text */
  description: string;
}

export interface SettlementSaveData {
  currentTier: SettlementTier;
  consecutiveUpgradeTicks: number;
  consecutiveDowngradeTicks: number;
}

// ─────────────────────────────────────────────────────────
//  TIER DEFINITIONS
// ─────────────────────────────────────────────────────────

/** Minimum distinct building roles required for gorod tier. */
export const GOROD_MIN_DISTINCT_ROLES = 5;

export const TIER_ORDER: readonly SettlementTier[] = ['selo', 'posyolok', 'pgt', 'gorod'];

export const TIER_DEFINITIONS: Readonly<Record<SettlementTier, TierDefinition>> = {
  selo: {
    tier: 'selo',
    russian: 'село',
    title: 'Collective Farm Chairman',
    populationReq: 0,
    nonAgriPercent: 0,
    buildingReqs: [],
    upgradeTicks: 0,
    downgradeTicks: 0,
  },
  posyolok: {
    tier: 'posyolok',
    russian: 'рабочий посёлок',
    title: 'Settlement Director',
    populationReq: 50,
    nonAgriPercent: 0,
    buildingReqs: ['industry'],
    upgradeTicks: 30,
    downgradeTicks: 60,
  },
  pgt: {
    tier: 'pgt',
    russian: 'посёлок городского типа',
    title: 'Urban-Type Settlement Administrator',
    populationReq: 150,
    nonAgriPercent: 50,
    buildingReqs: ['education', 'medical'],
    upgradeTicks: 30,
    downgradeTicks: 60,
  },
  gorod: {
    tier: 'gorod',
    russian: 'город',
    title: 'City Soviet Chairman',
    populationReq: 400,
    nonAgriPercent: 85,
    buildingReqs: [],
    upgradeTicks: 30,
    downgradeTicks: 60,
  },
};

// ─────────────────────────────────────────────────────────
//  UPGRADE / DOWNGRADE FLAVOR TEXT
// ─────────────────────────────────────────────────────────

const UPGRADE_FLAVOR: Record<string, { title: string; description: string }> = {
  'selo\u2192posyolok': {
    title: 'DECREE OF THE PRESIDIUM',
    description:
      "By order of the Presidium, the selo is hereby reclassified as a WORKERS' SETTLEMENT. Industrial production has been noted. Citizens are cautiously optimistic, which is itself noted.",
  },
  'posyolok\u2192pgt': {
    title: 'CENTRAL COMMITTEE RECOGNITION',
    description:
      'The Central Committee recognizes the settlement as an URBAN-TYPE SETTLEMENT. Educational and medical facilities have been deemed adequate. A parade is mandatory.',
  },
  'pgt\u2192gorod': {
    title: 'SUPREME SOVIET DECLARATION',
    description:
      'The Supreme Soviet declares the settlement a CITY of the Soviet Union! Multiple districts with diverse productive capacity have been acknowledged. Glory to the workers who made this possible. Their names will be filed.',
  },
};

const DOWNGRADE_FLAVOR: Record<string, { title: string; description: string }> = {
  'posyolok\u2192selo': {
    title: 'ADMINISTRATIVE RECLASSIFICATION',
    description:
      "Due to insufficient productive capacity, the workers' settlement has been reclassified as a selo. The Presidium expresses disappointment. Citizens express nothing, as expressions have been reclassified as well.",
  },
  'pgt\u2192posyolok': {
    title: 'COMMITTEE FOR STATE PLANNING DECREE',
    description:
      "The urban-type settlement has failed to maintain required population levels. Reclassified as a workers' settlement. Educational and medical staff have been reassigned to more productive roles.",
  },
  'gorod\u2192pgt': {
    title: 'COUNCIL OF MINISTERS CORRECTION',
    description:
      'The city designation has been revoked due to population decline. The settlement is reclassified as an urban-type settlement. The city sign has been confiscated and will be awarded to a more deserving collective.',
  },
};

// ─────────────────────────────────────────────────────────
//  SYSTEM
// ─────────────────────────────────────────────────────────

export class SettlementSystem {
  private currentTier: SettlementTier;
  private consecutiveUpgradeTicks = 0;
  private consecutiveDowngradeTicks = 0;

  constructor(initialTier: SettlementTier = 'selo') {
    this.currentTier = initialTier;
  }

  /** Call each simulation tick with current game metrics. */
  tick(metrics: SettlementMetrics): SettlementEvent | null {
    const tierIndex = TIER_ORDER.indexOf(this.currentTier);

    // ── Upgrade check ──────────────────────────────────────
    if (tierIndex < TIER_ORDER.length - 1) {
      const nextTier = TIER_ORDER[tierIndex + 1]!;
      const nextDef = TIER_DEFINITIONS[nextTier];

      if (this.meetsUpgradeRequirements(nextDef, metrics)) {
        this.consecutiveUpgradeTicks++;
        if (this.consecutiveUpgradeTicks >= nextDef.upgradeTicks) {
          const event = this.buildEvent('upgrade', this.currentTier, nextTier);
          this.currentTier = nextTier;
          this.consecutiveUpgradeTicks = 0;
          this.consecutiveDowngradeTicks = 0;
          return event;
        }
      } else {
        this.consecutiveUpgradeTicks = 0;
      }
    }

    // ── Downgrade check ────────────────────────────────────
    if (tierIndex > 0) {
      const currentDef = TIER_DEFINITIONS[this.currentTier];
      if (metrics.population < currentDef.populationReq) {
        this.consecutiveDowngradeTicks++;
        if (this.consecutiveDowngradeTicks >= currentDef.downgradeTicks) {
          const prevTier = TIER_ORDER[tierIndex - 1]!;
          const event = this.buildEvent('downgrade', this.currentTier, prevTier);
          this.currentTier = prevTier;
          this.consecutiveDowngradeTicks = 0;
          this.consecutiveUpgradeTicks = 0;
          return event;
        }
      } else {
        this.consecutiveDowngradeTicks = 0;
      }
    }

    return null;
  }

  getCurrentTier(): SettlementTier {
    return this.currentTier;
  }

  getTierDefinition(): TierDefinition {
    return TIER_DEFINITIONS[this.currentTier];
  }

  /** Returns 0-1 progress toward next tier change. */
  getProgress(): { toUpgrade: number; toDowngrade: number } {
    const tierIndex = TIER_ORDER.indexOf(this.currentTier);

    let toUpgrade = 0;
    if (tierIndex < TIER_ORDER.length - 1) {
      const nextTier = TIER_ORDER[tierIndex + 1]!;
      const nextDef = TIER_DEFINITIONS[nextTier];
      toUpgrade =
        nextDef.upgradeTicks > 0 ? this.consecutiveUpgradeTicks / nextDef.upgradeTicks : 0;
    }

    let toDowngrade = 0;
    if (tierIndex > 0) {
      const currentDef = TIER_DEFINITIONS[this.currentTier];
      toDowngrade =
        currentDef.downgradeTicks > 0
          ? this.consecutiveDowngradeTicks / currentDef.downgradeTicks
          : 0;
    }

    return { toUpgrade, toDowngrade };
  }

  serialize(): SettlementSaveData {
    return {
      currentTier: this.currentTier,
      consecutiveUpgradeTicks: this.consecutiveUpgradeTicks,
      consecutiveDowngradeTicks: this.consecutiveDowngradeTicks,
    };
  }

  static deserialize(data: SettlementSaveData): SettlementSystem {
    const system = new SettlementSystem(data.currentTier);
    system.consecutiveUpgradeTicks = data.consecutiveUpgradeTicks;
    system.consecutiveDowngradeTicks = data.consecutiveDowngradeTicks;
    return system;
  }

  // ── Private helpers ──────────────────────────────────────

  private meetsUpgradeRequirements(tierDef: TierDefinition, metrics: SettlementMetrics): boolean {
    // Population check
    if (metrics.population < tierDef.populationReq) return false;

    // Non-agricultural percentage check
    if (tierDef.nonAgriPercent > 0) {
      const percent =
        metrics.totalWorkers > 0
          ? (metrics.nonAgriculturalWorkers / metrics.totalWorkers) * 100
          : 0;
      if (percent < tierDef.nonAgriPercent) return false;
    }

    // Building role requirements: need at least one building of each required role
    for (const requiredRole of tierDef.buildingReqs) {
      if (!metrics.buildings.some((b) => b.role === requiredRole)) {
        return false;
      }
    }

    // Gorod special check: need 5+ distinct building roles
    if (tierDef.tier === 'gorod') {
      const distinctRoles = new Set(metrics.buildings.map((b) => b.role));
      if (distinctRoles.size < GOROD_MIN_DISTINCT_ROLES) return false;
    }

    return true;
  }

  private buildEvent(
    type: SettlementEventType,
    fromTier: SettlementTier,
    toTier: SettlementTier
  ): SettlementEvent {
    const key = `${fromTier}\u2192${toTier}`;
    const flavorMap = type === 'upgrade' ? UPGRADE_FLAVOR : DOWNGRADE_FLAVOR;
    const flavor = flavorMap[key] ?? {
      title: type === 'upgrade' ? 'ADMINISTRATIVE UPGRADE' : 'ADMINISTRATIVE DOWNGRADE',
      description:
        type === 'upgrade'
          ? 'The settlement has been upgraded by decree.'
          : 'The settlement has been downgraded due to insufficient capacity.',
    };

    return {
      type,
      fromTier,
      toTier,
      title: flavor.title,
      description: flavor.description,
    };
  }
}
