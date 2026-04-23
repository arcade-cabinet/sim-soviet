/**
 * @module ai/agents/core/WorldAgent
 *
 * Models the external world the settlement exists within.
 * Russia never existed in a vacuum — from Kievan Rus' through the Cold War,
 * external context shaped everything.
 *
 * Updates once per year (slow-moving backdrop). Era transitions drive
 * major state shifts. Computes per-domain pressure modifiers that feed
 * into the PressureSystem.
 *
 * After 1991, it continues as grounded local pressure rather than alternate
 * history expansion.
 */

import { Vehicle } from 'yuka';
import type { GameRng } from '@/game/SeedSystem';
import type { PressureDomain } from '../crisis/pressure/PressureDomains';
import {
  computeMergeProbability,
  computeSplitProbability,
  createInitialSpheres,
  type Sphere,
  tickSphere,
} from './sphereDynamics';
import { type Country, ERA_WORLD_PROFILES, SPHERE_IDS, type SphereId, STARTING_COUNTRIES } from './worldCountries';

// ─── World State ─────────────────────────────────────────────────────────────

export interface WorldState {
  spheres: Record<SphereId, Sphere>;
  /** Countries still tracked individually (before merge year). */
  countries: Country[];
  /** Global tension (0-1): Cold War=0.6, détente=0.3, hot war=0.9. */
  globalTension: number;
  /** Border threat from neighboring hostility (0-1). */
  borderThreat: number;
  /** Trade access (0=blockade, 1=open). */
  tradeAccess: number;
  /** Commodity price index multiplier (oil boom=1.5, crash=0.5). */
  commodityIndex: number;
  /** Central planning efficiency (1.0=normal, stagnation drops). */
  centralPlanningEfficiency: number;
  /** Multi-year climate trend (-1 cooling, +1 warming). */
  climateTrend: number;
  /** Remaining ticks in current climate cycle. */
  climateCycleRemaining: number;
  /** Moscow scrutiny level (0-1). */
  moscowAttention: number;
  /** Ideological rigidity (0-1). */
  ideologyRigidity: number;
  /** Technology level (0-1, unlocks efficiency bonuses). */
  techLevel: number;
}

// ─── Save Data ───────────────────────────────────────────────────────────────

export interface WorldStateSaveData {
  spheres: Record<SphereId, Sphere>;
  countries: Country[];
  globalTension: number;
  borderThreat: number;
  tradeAccess: number;
  commodityIndex: number;
  centralPlanningEfficiency: number;
  climateTrend: number;
  climateCycleRemaining: number;
  moscowAttention: number;
  ideologyRigidity: number;
  techLevel: number;
}

// ─── WorldAgent ──────────────────────────────────────────────────────────────

/**
 * Yuka Vehicle agent that models the geopolitical context.
 * Every agent in the settlement responds to these world conditions.
 */
export class WorldAgent extends Vehicle {
  private state: WorldState;
  private rng: GameRng | null = null;
  private currentEraId = 'revolution';

  constructor() {
    super();
    this.name = 'WorldAgent';
    this.state = createDefaultWorldState();
  }

  /** Set the seeded RNG (required for stochastic sphere dynamics). */
  setRng(rng: GameRng): void {
    this.rng = rng;
  }

  /** Notify WorldAgent of an era transition. */
  setEra(eraId: string): void {
    this.currentEraId = eraId;
    this.applyEraProfile(eraId);
  }

  /**
   * Yearly tick — advance sphere dynamics, merge countries, update world state.
   * Called once per game year from phaseChronology.
   */
  tickYear(year: number): void {
    if (!this.rng) return;

    // Merge countries past their merge year
    this.mergeCountries(year);

    // Advance sphere dynamics
    for (const sphereId of SPHERE_IDS) {
      this.state.spheres[sphereId] = tickSphere(this.state.spheres[sphereId], this.state.techLevel, this.rng);
    }

    // Check sphere splits/merges (yearly)
    this.evaluateSphereDynamics();

    // Advance climate cycle
    this.advanceClimate();

    // Advance tech level (slow linear + era-based)
    this.advanceTech(year);

    // Advance commodity index (random walk)
    this.advanceCommodityIndex();

    // Advance central planning efficiency
    this.advanceCentralPlanning();

    // Recompute border threat from sphere hostility
    this.recomputeBorderThreat();
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Get the full world state (read-only). */
  getState(): Readonly<WorldState> {
    return this.state;
  }

  /** Get climate trend (-1 to +1). */
  getClimateTrend(): number {
    return this.state.climateTrend;
  }

  /**
   * Compute per-domain pressure modifiers from world state.
   * Returns multipliers (1.0 = neutral, >1.0 = amplifies pressure).
   */
  computePressureModifiers(): Partial<Record<PressureDomain, number>> {
    const { globalTension, borderThreat, tradeAccess, moscowAttention, ideologyRigidity, climateTrend } = this.state;

    return {
      food: 1.0 + Math.max(0, -tradeAccess + 0.5) * 0.4 + Math.max(0, climateTrend) * 0.3,
      morale: 1.0 + globalTension * 0.3 + (1 - tradeAccess) * 0.2,
      loyalty: 1.0 + ideologyRigidity * 0.3 + moscowAttention * 0.2,
      housing: 1.0, // housing pressure is mostly internal
      political: 1.0 + moscowAttention * 0.4 + ideologyRigidity * 0.3,
      power: 1.0 + borderThreat * 0.2,
      infrastructure: 1.0 + borderThreat * 0.3 + globalTension * 0.2,
      demographic: 1.0 + globalTension * 0.2 + borderThreat * 0.3,
      health: 1.0 + Math.max(0, climateTrend) * 0.2,
      economic: 1.0 + (1 - tradeAccess) * 0.3 + (1 - this.state.centralPlanningEfficiency) * 0.3,
    };
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  serialize(): WorldStateSaveData {
    return { ...this.state, countries: [...this.state.countries] };
  }

  restore(data: WorldStateSaveData): void {
    this.state = { ...data, countries: [...data.countries] };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private applyEraProfile(eraId: string): void {
    const profile = ERA_WORLD_PROFILES[eraId];
    if (!profile) return;

    // Apply start values (will interpolate over era)
    this.state.globalTension = profile.globalTension[0];
    this.state.borderThreat = profile.borderThreat[0];
    this.state.tradeAccess = profile.tradeAccess;
    this.state.moscowAttention = profile.moscowAttention;
    this.state.ideologyRigidity = profile.ideologyRigidity;
  }

  private mergeCountries(year: number): void {
    this.state.countries = this.state.countries.filter((c) => {
      if (c.mergeYear && year >= c.mergeYear) {
        // Aggregate into sphere
        const sphere = this.state.spheres[c.sphere];
        if (sphere) {
          sphere.aggregateHostility = (sphere.aggregateHostility + c.hostility) / 2;
          sphere.aggregateTrade = (sphere.aggregateTrade + c.tradeVolume) / 2;
          sphere.aggregateMilitary = Math.max(sphere.aggregateMilitary, c.militaryStrength);
        }
        return false; // remove from individual tracking
      }
      return true;
    });
  }

  private evaluateSphereDynamics(): void {
    if (!this.rng) return;

    for (const sphereId of SPHERE_IDS) {
      const sphere = this.state.spheres[sphereId];
      const splitP = computeSplitProbability(sphere);
      if (splitP > 0 && this.rng.random() < splitP) {
        // Sphere fragmentation — reset cycle phases (new founding)
        this.state.spheres[sphereId] = {
          ...sphere,
          khaldunPhase: 0.05,
          turchinPhase: sphere.turchinPhase * 0.5,
          aggregateMilitary: sphere.aggregateMilitary * 0.6,
          aggregateTrade: sphere.aggregateTrade * 0.7,
        };
      }
    }

    // Check merges between sphere pairs
    const ids = [...SPHERE_IDS];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = this.state.spheres[ids[i]!];
        const b = this.state.spheres[ids[j]!];
        const mergeP = computeMergeProbability(a, b);
        if (mergeP > 0 && this.rng.random() < mergeP) {
          // A absorbs B's strength
          this.state.spheres[ids[i]!] = {
            ...a,
            aggregateMilitary: Math.min(1, a.aggregateMilitary + b.aggregateMilitary * 0.3),
            aggregateTrade: Math.min(1, a.aggregateTrade + b.aggregateTrade * 0.2),
          };
          // B loses strength
          this.state.spheres[ids[j]!] = {
            ...b,
            aggregateMilitary: b.aggregateMilitary * 0.5,
            aggregateTrade: b.aggregateTrade * 0.7,
          };
        }
      }
    }
  }

  private advanceClimate(): void {
    if (!this.rng) return;

    this.state.climateCycleRemaining--;
    if (this.state.climateCycleRemaining <= 0) {
      // New climate cycle: 3-7 year duration, random trend
      this.state.climateCycleRemaining = this.rng.int(3, 7);
      this.state.climateTrend = (this.rng.random() - 0.5) * 2; // -1 to +1
    }
  }

  private advanceTech(_year: number): void {
    // Slow linear advancement + era-specific rates
    const baseRate = 0.003; // ~0.3% per year
    let eraBoost = 0;
    switch (this.currentEraId) {
      case 'industrialization':
        eraBoost = 0.005;
        break;
    }
    this.state.techLevel = Math.min(1, this.state.techLevel + baseRate + eraBoost);
  }

  private advanceCommodityIndex(): void {
    if (!this.rng) return;
    // Random walk around 1.0 with mean reversion
    const drift = (1.0 - this.state.commodityIndex) * 0.1; // mean reversion
    const shock = (this.rng.random() - 0.5) * 0.2;
    this.state.commodityIndex = Math.max(0.3, Math.min(2.0, this.state.commodityIndex + drift + shock));
  }

  private advanceCentralPlanning(): void {
    // Efficiency degrades in stagnation, improves in reform eras
    let delta = 0;
    switch (this.currentEraId) {
      case 'stagnation':
        delta = -0.005;
        break;
      case 'thaw_and_freeze':
        delta = 0.002;
        break;
    }
    this.state.centralPlanningEfficiency = Math.max(0.3, Math.min(1.0, this.state.centralPlanningEfficiency + delta));
  }

  private recomputeBorderThreat(): void {
    // Average hostility from neighboring spheres (European + Eurasian + Sinosphere)
    const neighbors = ['european', 'eurasian', 'sinosphere'] as const;
    let totalHostility = 0;
    for (const id of neighbors) {
      totalHostility += this.state.spheres[id].aggregateHostility;
    }
    // Also factor in individual country hostility for countries still tracked
    for (const country of this.state.countries) {
      if (['european', 'eurasian', 'sinosphere'].includes(country.sphere)) {
        totalHostility += country.hostility * 0.3;
      }
    }
    this.state.borderThreat = Math.min(1, totalHostility / (neighbors.length + this.state.countries.length * 0.3));
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create default world state for 1917. */
export function createDefaultWorldState(): WorldState {
  return {
    spheres: createInitialSpheres(),
    countries: [...STARTING_COUNTRIES],
    globalTension: 0.7,
    borderThreat: 0.6,
    tradeAccess: 0.2,
    commodityIndex: 1.0,
    centralPlanningEfficiency: 0.8,
    climateTrend: 0,
    climateCycleRemaining: 5,
    moscowAttention: 0.5,
    ideologyRigidity: 0.9,
    techLevel: 0.05,
  };
}
