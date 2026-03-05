/**
 * @module ai/agents/crisis/BlackSwanSystem
 *
 * Tier 3 events: truly rare, no artificial gates.
 *
 * NO minimum intervals. NO "once per era" rules. Just incredibly low
 * per-tick probability. If two meteors hit in consecutive years, that happened.
 *
 * Absorbs meteor strike logic from FreeformGovernor and adds additional
 * black swan events: earthquakes, solar storms, nuclear accidents,
 * supervolcanic ash.
 *
 * Static catalog data sourced from src/config/blackSwans.json.
 * Impact generation functions remain in TypeScript (require RNG + dynamic logic).
 */

import type { GameRng } from '@/game/SeedSystem';
import { applyMeteorImpact, convertCraterToMine, rollMeteorStrike, type MeteorEvent } from './meteorStrike';
import type { PressureDomain } from './pressure/PressureDomains';
import type { CrisisImpact } from './types';
import blackSwansData from '@/config/blackSwans.json';

// ─── Black Swan Definition ───────────────────────────────────────────────────

export interface BlackSwanDef {
  id: string;
  name: string;
  /** Probability per tick. */
  probabilityPerTick: number;
  /** Minimum year before this event can occur. */
  minYear?: number;
  /** Pressure spikes across domains. */
  pressureSpikes: Partial<Record<PressureDomain, number>>;
  /** Generate the crisis impact (may need RNG for parameters). */
  generateImpact: (year: number, rng: GameRng) => CrisisImpact;
}

// ─── Raw JSON shape ──────────────────────────────────────────────────────────

interface RawBlackSwan {
  id: string;
  name: string;
  probabilityPerTick: number;
  minYear?: number;
  pressureSpikes: Record<string, number>;
  impactTemplate: Record<string, unknown>;
}

// ─── Impact Generators ───────────────────────────────────────────────────────

/** Build generateImpact functions keyed by event ID, using imported template data. */
function buildImpactGenerators(raw: readonly RawBlackSwan[]): Map<string, (year: number, rng: GameRng) => CrisisImpact> {
  const generators = new Map<string, (year: number, rng: GameRng) => CrisisImpact>();

  for (const entry of raw) {
    const t = entry.impactTemplate;

    switch (entry.id) {
      case 'earthquake':
        generators.set(entry.id, (year, rng) => {
          const magnitudeMin = t.magnitudeMin as number;
          const magnitudeMax = t.magnitudeMax as number;
          const magnitude = magnitudeMin + rng.random() * (magnitudeMax - magnitudeMin);
          return {
            crisisId: `earthquake-${year}`,
            infrastructure: { decayMult: (t.infrastructureDecayBase as number) + magnitude * (t.infrastructureDecayPerMagnitude as number) },
            social: { growthMult: t.socialGrowthMult as number },
            workforce: { moraleModifier: (t.baseMoraleModifier as number) + magnitude * (t.moralePerMagnitude as number) },
            narrative: {
              pravdaHeadlines: [(t.headlineTemplate as string).replace('{magnitude}', magnitude.toFixed(1))],
              toastMessages: [{ text: (t.toastTemplate as string).replace('{magnitude}', magnitude.toFixed(1)), severity: t.toastSeverity as 'critical' }],
            },
          };
        });
        break;

      case 'solar_storm':
        generators.set(entry.id, (year, _rng) => ({
          crisisId: `solar-storm-${year}`,
          economy: { productionMult: t.productionMult as number },
          narrative: {
            pravdaHeadlines: [t.headline as string],
            toastMessages: [{ text: t.toast as string, severity: t.toastSeverity as 'critical' }],
          },
        }));
        break;

      case 'nuclear_accident':
        generators.set(entry.id, (year, _rng) => ({
          crisisId: `nuclear-accident-${year}`,
          social: { diseaseMult: t.diseaseMult as number, growthMult: t.socialGrowthMult as number },
          infrastructure: { decayMult: t.infrastructureDecayMult as number },
          workforce: { moraleModifier: t.moraleModifier as number },
          narrative: {
            pravdaHeadlines: [t.headline as string],
            toastMessages: [{ text: t.toast as string, severity: t.toastSeverity as 'critical' }],
          },
        }));
        break;

      case 'supervolcanic_ash':
        generators.set(entry.id, (year, _rng) => ({
          crisisId: `supervolcanic-ash-${year}`,
          economy: { productionMult: t.productionMult as number, foodDelta: t.foodDelta as number },
          social: { diseaseMult: t.diseaseMult as number, growthMult: t.socialGrowthMult as number },
          workforce: { moraleModifier: t.moraleModifier as number },
          narrative: {
            pravdaHeadlines: [t.headline as string],
            toastMessages: [{ text: t.toast as string, severity: t.toastSeverity as 'critical' }],
          },
        }));
        break;
    }
  }

  return generators;
}

// ─── Event Catalog ───────────────────────────────────────────────────────────

const rawCatalog = blackSwansData as unknown as RawBlackSwan[];
const impactGenerators = buildImpactGenerators(rawCatalog);

const BLACK_SWAN_CATALOG: readonly BlackSwanDef[] = rawCatalog.map((entry) => {
  const generator = impactGenerators.get(entry.id);
  if (!generator) throw new Error(`No impact generator for black swan: ${entry.id}`);

  return {
    id: entry.id,
    name: entry.name,
    probabilityPerTick: entry.probabilityPerTick,
    minYear: entry.minYear,
    pressureSpikes: entry.pressureSpikes as Partial<Record<PressureDomain, number>>,
    generateImpact: generator,
  };
});

// ─── BlackSwanSystem ─────────────────────────────────────────────────────────

/** Result of a black swan evaluation. */
export interface BlackSwanResult {
  impacts: CrisisImpact[];
  pressureSpikes: Partial<Record<PressureDomain, number>>;
  meteorEvent: MeteorEvent | null;
}

/**
 * Rolls all black swan events each tick. NO artificial gates.
 * Low probability is the only limiter.
 */
export class BlackSwanSystem {
  /**
   * Roll all black swan events for this tick.
   *
   * @param year - Current game year
   * @param rng - Seeded RNG
   * @param gridSize - Current grid size (for meteor impact)
   */
  roll(year: number, rng: GameRng, gridSize: number): BlackSwanResult {
    const impacts: CrisisImpact[] = [];
    const aggregateSpikes: Partial<Record<PressureDomain, number>> = {};
    let meteorEvent: MeteorEvent | null = null;

    // ── Meteor strike (existing logic, relocated from FreeformGovernor) ──
    const meteor = rollMeteorStrike(rng, year);
    if (meteor) {
      meteorEvent = meteor;
      const impact = applyMeteorImpact(meteor.targetX, meteor.targetY, gridSize);
      const mine = convertCraterToMine(impact);

      impacts.push({
        crisisId: `meteor-${year}`,
        infrastructure: { decayMult: 1.0 + impact.damageRadius * 0.1 },
        social: { growthMult: 0.95 },
        narrative: {
          pravdaHeadlines: [`METEORITE STRIKES NEAR (${meteor.targetX}, ${meteor.targetY})! ${impact.resourceDeposit} deposit discovered.`],
          toastMessages: [{ text: `Meteor impact! ${impact.resourceDeposit} deposit found.`, severity: 'critical' }],
        },
      });

      // Pressure spikes from meteor
      aggregateSpikes.infrastructure = (aggregateSpikes.infrastructure ?? 0) + 0.15;
      aggregateSpikes.morale = (aggregateSpikes.morale ?? 0) + 0.1;
    }

    // ── Other black swans ──
    for (const event of BLACK_SWAN_CATALOG) {
      if (event.minYear && year < event.minYear) continue;

      // Era scaling for nuclear accidents
      let p = event.probabilityPerTick;
      if (event.id === 'nuclear_accident') {
        const yearsSinceNuclear = year - 1954;
        p *= Math.min(3, 1 + yearsSinceNuclear / 50); // increases with age of nuclear program
      }

      if (rng.random() < p) {
        impacts.push(event.generateImpact(year, rng));

        for (const [domain, spike] of Object.entries(event.pressureSpikes)) {
          const d = domain as PressureDomain;
          aggregateSpikes[d] = (aggregateSpikes[d] ?? 0) + spike;
        }
      }
    }

    return { impacts, pressureSpikes: aggregateSpikes, meteorEvent };
  }
}
