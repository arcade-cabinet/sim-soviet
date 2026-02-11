/**
 * TransportSystem — road quality progression with condition degradation.
 *
 * Class-based subsystem matching the SettlementSystem / EconomySystem archetype.
 *
 * Computes a composite transport score from operational transport buildings,
 * settlement tier, and era bonuses. The resulting RoadQuality level mitigates
 * rasputitsa's buildCostMultiplier penalty: good roads = faster construction
 * during mud season.
 *
 * New: road condition (0-100) degrades each tick based on season and recovers
 * via timber maintenance. Poor condition can downgrade effective quality.
 * Score recalculation is throttled (every 30 ticks).
 */

import { getBuildingDef } from '@/data/buildingDefs';
import type { Entity } from '@/ecs/world';
import type { SeasonProfile } from './Chronology';
import type { GameRng } from './SeedSystem';
import type { SettlementTier } from './SettlementSystem';

// ── Road Quality Enum ────────────────────────────────────────────────────

export enum RoadQuality {
  NONE = 'none',
  DIRT = 'dirt',
  GRAVEL = 'gravel',
  PAVED = 'paved',
  HIGHWAY = 'highway',
}

export const ROAD_QUALITY_LABELS: Record<RoadQuality, string> = {
  [RoadQuality.NONE]: 'No Roads',
  [RoadQuality.DIRT]: 'Dirt Tracks',
  [RoadQuality.GRAVEL]: 'Gravel Roads',
  [RoadQuality.PAVED]: 'Paved Roads',
  [RoadQuality.HIGHWAY]: 'Highway Network',
};

/** Ordered list for numeric downgrade operations. */
const QUALITY_ORDER: RoadQuality[] = [
  RoadQuality.NONE,
  RoadQuality.DIRT,
  RoadQuality.GRAVEL,
  RoadQuality.PAVED,
  RoadQuality.HIGHWAY,
];

// ── Score Tables ─────────────────────────────────────────────────────────

/** Transport score contributed by each building defId. */
const BUILDING_SCORES: Record<string, number> = {
  'dirt-path': 1,
  'road-depot': 3,
  'train-station': 4,
  'motor-pool': 4,
  'rail-depot': 5,
};

/** Bonus score from settlement tier (Party attention). */
const TIER_BONUS: Record<SettlementTier, number> = {
  selo: 0,
  posyolok: 2,
  pgt: 5,
  gorod: 8,
};

/** Bonus score from historical era (technology/investment). */
const ERA_BONUS: Record<string, number> = {
  war_communism: 0,
  first_plans: 1,
  great_patriotic: 0,
  reconstruction: 3,
  thaw: 5,
  stagnation: 4,
  perestroika: 2,
  eternal_soviet: 3,
};

// ── Mitigation Table ─────────────────────────────────────────────────────

/** Fraction of rasputitsa penalty absorbed by each road quality. */
const MITIGATION: Record<RoadQuality, number> = {
  [RoadQuality.NONE]: 0.0,
  [RoadQuality.DIRT]: 0.1,
  [RoadQuality.GRAVEL]: 0.3,
  [RoadQuality.PAVED]: 0.6,
  [RoadQuality.HIGHWAY]: 0.85,
};

// ── Pure Functions (module-level exports for direct testing) ─────────────

/**
 * Compute the aggregate transport score from building IDs, tier, and era.
 */
export function computeTransportScore(
  transportBuildingIds: readonly string[],
  tier: SettlementTier,
  eraId: string
): number {
  let score = 0;
  for (const id of transportBuildingIds) {
    score += BUILDING_SCORES[id] ?? 0;
  }
  score += TIER_BONUS[tier] ?? 0;
  score += ERA_BONUS[eraId] ?? 0;
  return score;
}

/**
 * Map a numeric transport score to a RoadQuality level.
 */
export function scoreToQuality(score: number): RoadQuality {
  if (score >= 16) return RoadQuality.HIGHWAY;
  if (score >= 9) return RoadQuality.PAVED;
  if (score >= 4) return RoadQuality.GRAVEL;
  if (score >= 1) return RoadQuality.DIRT;
  return RoadQuality.NONE;
}

/** Get the mitigation factor for a given road quality. */
export function getRasputitsaMitigation(quality: RoadQuality): number {
  return MITIGATION[quality];
}

/**
 * Apply road-quality mitigation to a raw seasonal build cost multiplier.
 *
 * Formula: 1.0 + (rawMult - 1.0) * (1.0 - mitigation)
 *
 * When rawMult <= 1.0 (no penalty), returns rawMult unchanged.
 */
export function applyMitigation(rawMult: number, quality: RoadQuality): number {
  if (rawMult <= 1.0) return rawMult;
  const mitigation = MITIGATION[quality];
  return 1.0 + (rawMult - 1.0) * (1.0 - mitigation);
}

// ── Tick Result ──────────────────────────────────────────────────────────

export interface TransportTickResult {
  /** Current effective road quality level (may be downgraded by poor condition). */
  quality: RoadQuality;
  /** Road condition 0-100 (100 = pristine). Affects effective quality. */
  condition: number;
  /** Seasonal build cost multiplier after road mitigation. */
  seasonBuildMult: number;
  /** Whether score was recalculated this tick (vs cached). */
  recalculated: boolean;
}

// ── Save Data ────────────────────────────────────────────────────────────

export interface TransportSaveData {
  quality: RoadQuality;
  rawScore?: number;
  condition?: number;
  nextRecalcTick?: number;
  eraId?: string;
}

// ── Legacy compat (old saves with just { quality }) ──────────────────────

export function serializeTransport(quality: RoadQuality): TransportSaveData {
  return { quality };
}

export function deserializeTransport(data: TransportSaveData): RoadQuality {
  const valid = Object.values(RoadQuality) as string[];
  return valid.includes(data.quality) ? data.quality : RoadQuality.NONE;
}

// ── Season helpers ───────────────────────────────────────────────────────

const RASPUTITSA_SEASONS: Set<string> = new Set(['rasputitsa_spring', 'rasputitsa_autumn']);

// ── Class ────────────────────────────────────────────────────────────────

export class TransportSystem {
  // ── Private state ──
  private quality: RoadQuality = RoadQuality.NONE;
  private rawScore = 0;
  private _condition = 100;
  private nextRecalcTick = 0;
  private eraId: string;
  // ── Constants ──
  /** Recalculate transport score every 30 ticks (~10 days). */
  static readonly RECALC_INTERVAL = 30;
  /** Condition decay per tick during rasputitsa (mud destroys roads). */
  static readonly RASPUTITSA_DECAY = 0.15;
  /** Condition decay per tick during winter (frost + snow). */
  static readonly WINTER_DECAY = 0.08;
  /** Condition decay per tick baseline (normal wear). */
  static readonly BASELINE_DECAY = 0.02;
  /** Condition recovery per maintenance tick (timber spent). */
  static readonly MAINTENANCE_RECOVERY = 2.0;
  /** Timber cost per maintenance recovery application. */
  static readonly MAINTENANCE_TIMBER_COST = 1;

  constructor(eraId = 'war_communism') {
    this.eraId = eraId;
  }

  // ── Lifecycle hooks ──

  setRng(_rng: GameRng): void {
    // Lifecycle hook — stored for future stochastic road events.
  }

  setEra(eraId: string): void {
    this.eraId = eraId;
  }

  // ── Tick ──

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: tick has 5 sequential steps (recalc, decay, maintenance, downgrade, mitigation)
  tick(
    operationalEntities: readonly Entity[],
    tier: SettlementTier,
    totalTicks: number,
    season: SeasonProfile,
    resources?: { timber: number }
  ): TransportTickResult {
    // 1. THROTTLED SCORE RECALC
    let recalculated = false;
    if (totalTicks >= this.nextRecalcTick) {
      const transportIds: string[] = [];
      for (const entity of operationalEntities) {
        if (!entity.building) continue;
        const def = getBuildingDef(entity.building.defId);
        if (def?.role === 'transport') {
          transportIds.push(entity.building.defId);
        }
      }
      this.rawScore = computeTransportScore(transportIds, tier, this.eraId);
      this.quality = scoreToQuality(this.rawScore);
      this.nextRecalcTick = totalTicks + TransportSystem.RECALC_INTERVAL;
      recalculated = true;
    }

    // 2. CONDITION DECAY
    const seasonKey = season.season as string;
    let decayRate: number;
    if (RASPUTITSA_SEASONS.has(seasonKey)) {
      decayRate = TransportSystem.RASPUTITSA_DECAY;
    } else if (seasonKey === 'winter') {
      decayRate = TransportSystem.WINTER_DECAY;
    } else {
      decayRate = TransportSystem.BASELINE_DECAY;
    }
    this._condition = Math.max(0, this._condition - decayRate);

    // 3. MAINTENANCE (auto-repair when condition < 80 and timber available)
    if (
      this._condition < 80 &&
      resources &&
      resources.timber >= TransportSystem.MAINTENANCE_TIMBER_COST
    ) {
      resources.timber -= TransportSystem.MAINTENANCE_TIMBER_COST;
      this._condition = Math.min(100, this._condition + TransportSystem.MAINTENANCE_RECOVERY);
    }

    // 4. EFFECTIVE QUALITY (condition-adjusted)
    let effectiveQuality = this.quality;
    if (this._condition < 25) {
      const idx = QUALITY_ORDER.indexOf(effectiveQuality);
      const downgrade = this._condition < 10 ? 2 : 1;
      effectiveQuality = QUALITY_ORDER[Math.max(0, idx - downgrade)]!;
    }

    // 5. SEASONAL BUILD MULT (encapsulated — engine doesn't check isRasputitsa)
    const seasonBuildMult = applyMitigation(season.buildCostMultiplier, effectiveQuality);

    return {
      quality: effectiveQuality,
      condition: this._condition,
      seasonBuildMult,
      recalculated,
    };
  }

  // ── Accessors ──

  getQuality(): RoadQuality {
    return this.quality;
  }

  getCondition(): number {
    return this._condition;
  }

  getRawScore(): number {
    return this.rawScore;
  }

  // ── Serialization ──

  serialize(): TransportSaveData {
    return {
      quality: this.quality,
      rawScore: this.rawScore,
      condition: this._condition,
      nextRecalcTick: this.nextRecalcTick,
      eraId: this.eraId,
    };
  }

  static deserialize(data: TransportSaveData): TransportSystem {
    const valid = Object.values(RoadQuality) as string[];
    const sys = new TransportSystem(data.eraId ?? 'war_communism');
    sys.quality = valid.includes(data.quality) ? data.quality : RoadQuality.NONE;
    sys.rawScore = data.rawScore ?? 0;
    sys._condition = data.condition ?? 100;
    sys.nextRecalcTick = data.nextRecalcTick ?? 0;
    return sys;
  }
}
