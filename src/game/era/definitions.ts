/**
 * @module game/era/definitions
 *
 * ERA_DEFINITIONS and ERA_ORDER — the complete configuration for all
 * 8 historical eras of the Soviet campaign.
 *
 * Data is loaded from config/eras.json. Condition functions (victory/failure
 * checks) are expressed as declarative rules in JSON and evaluated here.
 */

import type { GameMeta, Resources } from '@/ecs/world';
import type { SettlementTier } from '../../ai/agents/infrastructure/SettlementSystem';
import { getBuildingTierRequirement, tierMeetsRequirement } from './tiers';
import type { EraCondition, EraDefinition, EraId } from './types';

import eraData from '../../config/eras.json';

// ─── Rule Evaluator ─────────────────────────────────────────────────────────

/**
 * Declarative condition rule from JSON. Evaluates against GameMeta + Resources.
 * Supports: { resource, op, value }, { meta, op, value }, { and: [...] }, { or: [...] }
 */
type ConditionRule =
  | { resource: string; op: string; value: number }
  | { meta: string; op: string; value: string | number }
  | { and: ConditionRule[] }
  | { or: ConditionRule[] };

function evaluateRule(rule: ConditionRule, meta: GameMeta, resources: Resources): boolean {
  if ('and' in rule) {
    return rule.and.every((r) => evaluateRule(r, meta, resources));
  }
  if ('or' in rule) {
    return rule.or.some((r) => evaluateRule(r, meta, resources));
  }
  if ('resource' in rule) {
    const val = (resources as unknown as Record<string, number>)[rule.resource] ?? 0;
    return compareOp(val, rule.op, rule.value);
  }
  if ('meta' in rule) {
    let val: string | number;
    if (rule.meta === 'year') {
      val = meta.date.year;
    } else if (rule.meta === 'settlementTier') {
      val = meta.settlementTier;
    } else {
      val = (meta as Record<string, any>)[rule.meta] ?? 0;
    }
    return compareOp(val, rule.op, rule.value);
  }
  return false;
}

function compareOp(left: string | number, op: string, right: string | number): boolean {
  switch (op) {
    case '<=':
      return left <= right;
    case '>=':
      return left >= right;
    case '<':
      return left < right;
    case '>':
      return left > right;
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    default:
      return false;
  }
}

// ─── Build Condition from JSON Rule ─────────────────────────────────────────

function buildCondition(
  jsonCondition: { description: string; rule: ConditionRule } | undefined,
): EraCondition | undefined {
  if (!jsonCondition) return undefined;
  return {
    description: jsonCondition.description,
    check: (meta: GameMeta, resources: Resources) => evaluateRule(jsonCondition.rule, meta, resources),
  };
}

// ─── Load from JSON ─────────────────────────────────────────────────────────

/** Eras in chronological order. */
export const ERA_ORDER: readonly EraId[] = eraData.eraOrder as EraId[];

/** Every building defId in the game, used to validate era assignments. */
export const ALL_BUILDING_IDS: readonly string[] = eraData.allBuildingIds;

/** Complete definitions for all 8 historical eras: modifiers, buildings, doctrine, and flavor. */
export const ERA_DEFINITIONS: Readonly<Record<EraId, EraDefinition>> = (() => {
  const result = {} as Record<EraId, EraDefinition>;
  for (const [eraId, raw] of Object.entries(eraData.eras)) {
    const era = raw as any;
    result[eraId as EraId] = {
      id: era.id,
      name: era.name,
      startYear: era.startYear,
      endYear: era.endYear,
      doctrine: era.doctrine,
      deliveryRates: era.deliveryRates,
      quotaEscalation: era.quotaEscalation,
      unlockedBuildings: era.unlockedBuildings,
      modifiers: era.modifiers,
      constructionMethod: era.constructionMethod,
      constructionTimeMult: era.constructionTimeMult,
      victoryCondition: buildCondition(era.victoryCondition),
      failureCondition: buildCondition(era.failureCondition),
      introTitle: era.introTitle,
      introText: era.introText,
      briefingFlavor: era.briefingFlavor,
    };
  }
  return result;
})();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the era index in ERA_ORDER for a given year.
 * Searches backwards so later eras take priority.
 */
export function eraIndexForYear(year: number): number {
  for (let i = ERA_ORDER.length - 1; i >= 0; i--) {
    const eraId = ERA_ORDER[i]!;
    const def = ERA_DEFINITIONS[eraId];
    if (year >= def.startYear) return i;
  }
  return 0;
}

/**
 * Pure utility: returns all building defIds available for a given year and
 * optional settlement tier. Used by the RadialBuildMenu to filter options
 * without needing an EraSystem instance.
 */
export function getAvailableBuildingsForYear(year: number, tier?: SettlementTier): string[] {
  const currentIdx = eraIndexForYear(year);
  const available: string[] = [];

  for (let i = 0; i <= currentIdx; i++) {
    const eraId = ERA_ORDER[i]!;
    const def = ERA_DEFINITIONS[eraId];
    available.push(...def.unlockedBuildings);
  }

  if (tier == null) return available;

  return available.filter((defId) => tierMeetsRequirement(tier, getBuildingTierRequirement(defId)));
}
