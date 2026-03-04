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
 */

import type { GameRng } from '@/game/SeedSystem';
import { applyMeteorImpact, convertCraterToMine, rollMeteorStrike, type MeteorEvent } from './meteorStrike';
import type { PressureDomain } from './pressure/PressureDomains';
import type { CrisisImpact } from './types';

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

// ─── Event Catalog ───────────────────────────────────────────────────────────

const BLACK_SWAN_CATALOG: readonly BlackSwanDef[] = [
  {
    id: 'earthquake',
    name: 'Earthquake',
    probabilityPerTick: 0.0008,
    pressureSpikes: { infrastructure: 0.2, housing: 0.15, health: 0.1, morale: 0.1 },
    generateImpact: (year, rng) => {
      const magnitude = 4 + rng.random() * 4; // 4-8 Richter
      const destructionCount = Math.floor(magnitude - 3);
      return {
        crisisId: `earthquake-${year}`,
        infrastructure: { decayMult: 1.0 + magnitude * 0.15 },
        social: { growthMult: 0.9 },
        workforce: { moraleModifier: -0.2 - magnitude * 0.05 },
        narrative: {
          pravdaHeadlines: [`EARTHQUAKE MAGNITUDE ${magnitude.toFixed(1)} STRIKES REGION`],
          toastMessages: [{ text: `Earthquake! Magnitude ${magnitude.toFixed(1)}`, severity: 'critical' }],
        },
      };
    },
  },
  {
    id: 'solar_storm',
    name: 'Solar Storm',
    probabilityPerTick: 0.0005,
    pressureSpikes: { power: 0.25, infrastructure: 0.1, economic: 0.1 },
    generateImpact: (year, _rng) => ({
      crisisId: `solar-storm-${year}`,
      economy: { productionMult: 0.6 },
      narrative: {
        pravdaHeadlines: ['SOLAR ACTIVITY DISRUPTS ELECTRICAL SYSTEMS — Power grid strained.'],
        toastMessages: [{ text: 'Solar storm! Power grid devastated.', severity: 'critical' }],
      },
    }),
  },
  {
    id: 'nuclear_accident',
    name: 'Nuclear Accident',
    probabilityPerTick: 0.0003,
    minYear: 1954, // post-Obninsk
    pressureSpikes: { health: 0.3, infrastructure: 0.15, morale: 0.2, political: 0.15 },
    generateImpact: (year, _rng) => ({
      crisisId: `nuclear-accident-${year}`,
      social: { diseaseMult: 3.0, growthMult: 0.7 },
      infrastructure: { decayMult: 1.5 },
      workforce: { moraleModifier: -0.4 },
      narrative: {
        pravdaHeadlines: ['NUCLEAR INCIDENT AT POWER FACILITY — Exclusion zone established.'],
        toastMessages: [{ text: 'Nuclear accident! Radiation spreading.', severity: 'critical' }],
      },
    }),
  },
  {
    id: 'supervolcanic_ash',
    name: 'Supervolcanic Ash Cloud',
    probabilityPerTick: 0.0001,
    pressureSpikes: { food: 0.25, health: 0.15, economic: 0.1, morale: 0.1 },
    generateImpact: (year, _rng) => ({
      crisisId: `supervolcanic-ash-${year}`,
      economy: { productionMult: 0.5, foodDelta: -50 },
      social: { diseaseMult: 2.0, growthMult: 0.6 },
      workforce: { moraleModifier: -0.3 },
      narrative: {
        pravdaHeadlines: ['VOLCANIC ASH CLOUD DARKENS SKIES — Crop failure expected.'],
        toastMessages: [{ text: 'Volcanic ash! Global cooling imminent.', severity: 'critical' }],
      },
    }),
  },
];

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
