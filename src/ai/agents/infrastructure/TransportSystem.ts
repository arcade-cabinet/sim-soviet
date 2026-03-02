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

import { infrastructure } from '@/config';
import { getBuildingDef } from '@/data/buildingDefs';
import type { Entity } from '@/ecs/world';
import type { SeasonProfile } from '../../../game/Chronology';
import type { GameRng } from '../../../game/SeedSystem';
import type { SettlementTier } from './SettlementSystem';

const tcfg = infrastructure.transport;

// ── Road Quality Enum ────────────────────────────────────────────────────

/** Road infrastructure quality level affecting rasputitsa mitigation. */
export enum RoadQuality {
  NONE = 'none',
  DIRT = 'dirt',
  GRAVEL = 'gravel',
  PAVED = 'paved',
  HIGHWAY = 'highway',
}

/** Human-readable display labels for each road quality level. */
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
const BUILDING_SCORES: Record<string, number> = tcfg.buildingScores;

/** Bonus score from settlement tier (Party attention). */
const TIER_BONUS: Record<SettlementTier, number> = tcfg.tierBonus as Record<SettlementTier, number>;

/** Bonus score from historical era (technology/investment). */
const ERA_BONUS: Record<string, number> = tcfg.eraBonus;

// ── Mitigation Table ─────────────────────────────────────────────────────

/** Fraction of rasputitsa penalty absorbed by each road quality. */
const MITIGATION: Record<RoadQuality, number> = tcfg.mitigation as Record<RoadQuality, number>;

// ── Pure Functions (module-level exports for direct testing) ─────────────

/**
 * Compute the aggregate transport score from building IDs, tier, and era.
 */
export function computeTransportScore(
  transportBuildingIds: readonly string[],
  tier: SettlementTier,
  eraId: string,
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
  const t = tcfg.scoreToQualityThresholds;
  if (score >= t.highway) return RoadQuality.HIGHWAY;
  if (score >= t.paved) return RoadQuality.PAVED;
  if (score >= t.gravel) return RoadQuality.GRAVEL;
  if (score >= t.dirt) return RoadQuality.DIRT;
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

/** Result of a transport system tick: quality, condition, and build cost multiplier. */
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

/** Serializable snapshot of transport system state for save/load. */
export interface TransportSaveData {
  quality: RoadQuality;
  rawScore?: number;
  condition?: number;
  nextRecalcTick?: number;
  eraId?: string;
}

// ── Legacy compat (old saves with just { quality }) ──────────────────────

/** Legacy serialization helper for old saves that only stored quality. */
export function serializeTransport(quality: RoadQuality): TransportSaveData {
  return { quality };
}

/** Legacy deserialization helper: extracts quality with validation fallback. */
export function deserializeTransport(data: TransportSaveData): RoadQuality {
  const valid = Object.values(RoadQuality) as string[];
  return valid.includes(data.quality) ? data.quality : RoadQuality.NONE;
}

// ── Season helpers ───────────────────────────────────────────────────────

const RASPUTITSA_SEASONS: Set<string> = new Set(['rasputitsa_spring', 'rasputitsa_autumn']);

// ── Class ────────────────────────────────────────────────────────────────

/**
 * Road quality progression with condition degradation, seasonal rasputitsa
 * mitigation, and throttled score recalculation from transport buildings.
 */
export class TransportSystem {
  // ── Private state ──
  private quality: RoadQuality = RoadQuality.NONE;
  private rawScore = 0;
  private _condition = 100;
  private nextRecalcTick = 0;
  private eraId: string;
  // ── Constants (from config/infrastructure.json) ──
  /** Recalculate transport score every N ticks. */
  static readonly RECALC_INTERVAL = tcfg.recalcInterval;
  /** Condition decay per tick during rasputitsa (mud destroys roads). */
  static readonly RASPUTITSA_DECAY = tcfg.rasputitsaDecay;
  /** Condition decay per tick during winter (frost + snow). */
  static readonly WINTER_DECAY = tcfg.winterDecay;
  /** Condition decay per tick baseline (normal wear). */
  static readonly BASELINE_DECAY = tcfg.baselineDecay;
  /** Condition recovery per maintenance tick (timber spent). */
  static readonly MAINTENANCE_RECOVERY = tcfg.maintenanceRecovery;
  /** Timber cost per maintenance recovery application. */
  static readonly MAINTENANCE_TIMBER_COST = tcfg.maintenanceTimberCost;

  constructor(eraId = 'revolution') {
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

  tick(
    operationalEntities: readonly Entity[],
    tier: SettlementTier,
    totalTicks: number,
    season: SeasonProfile,
    resources?: { timber: number },
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

    // 3. MAINTENANCE (auto-repair when condition < threshold and timber available)
    if (this._condition < tcfg.conditionThresholds.maintenanceTrigger && resources && resources.timber >= TransportSystem.MAINTENANCE_TIMBER_COST) {
      resources.timber -= TransportSystem.MAINTENANCE_TIMBER_COST;
      this._condition = Math.min(100, this._condition + TransportSystem.MAINTENANCE_RECOVERY);
    }

    // 4. EFFECTIVE QUALITY (condition-adjusted)
    let effectiveQuality = this.quality;
    if (this._condition < tcfg.conditionThresholds.downgradeOne) {
      const idx = QUALITY_ORDER.indexOf(effectiveQuality);
      const downgrade = this._condition < tcfg.conditionThresholds.downgradeTwo ? 2 : 1;
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
    const sys = new TransportSystem(data.eraId ?? 'revolution');
    sys.quality = valid.includes(data.quality) ? data.quality : RoadQuality.NONE;
    sys.rawScore = data.rawScore ?? 0;
    sys._condition = data.condition ?? 100;
    sys.nextRecalcTick = data.nextRecalcTick ?? 0;
    return sys;
  }
}
