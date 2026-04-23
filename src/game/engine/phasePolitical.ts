/**
 * phasePolitical — tick steps 16, 17, 18, 19, 20, 21, 22, 23
 *
 * Loyalty, trudodni, collective construction, chairman meddling,
 * decay, gulag, settlement, era conditions, political entities,
 * KGB morale sampling.
 */

import { accrueTrudodni } from '../../ai/agents/economy/EconomyAgent';
import { buildingsLogic, citizens } from '../../ecs/archetypes';
import { decaySystem, quotaSystem } from '../../ecs/systems';
import type { TickContext } from './tickContext';

/**
 * Run political phase: loyalty, trudodni, construction, decay, gulag, settlement,
 * era conditions, political entities.
 *
 * Steps 16-23 of the tick loop.
 */
export function phasePolitical(ctx: TickContext): void {
  const { tickResult, storeRef, callbacks, rng } = ctx;
  const {
    chronology,
    political: politicalAgent,
    kgb: kgbAgent,
    loyalty: loyaltyAgent,
    defense: defenseAgent,
  } = ctx.agents;
  const { settlement, politicalEntities, workerSystem, scoring, politburo } = ctx.systems;
  const { eraMods, politburoMods } = ctx.modifiers;
  const diffConfig = ctx.diffConfig;

  // ── 16. Monthly: loyalty + trudodni ──
  if (tickResult.newMonth) {
    const currentEraId = politicalAgent.getCurrentEraId();
    const pop = storeRef.resources.population;
    const foodLevel = pop > 0 ? Math.min(1, storeRef.resources.food / (pop * 2)) : 1;
    const quotaMet = ctx.state.quota.current >= ctx.state.quota.target;
    loyaltyAgent.setFoodLevel(foodLevel);
    const loyaltyResult = loyaltyAgent.tickLoyalty(currentEraId, quotaMet);

    if (loyaltyResult.sabotageCount > 0) {
      const penalty = Math.max(0.5, 1 - loyaltyResult.sabotageCount * 0.05);
      storeRef.resources.food *= penalty;
      storeRef.resources.vodka *= penalty;
      if (loyaltyResult.sabotageCount >= 2) {
        callbacks.onToast('SABOTAGE: Disloyal elements are destroying collective property!', 'warning');
      }
    }

    if (loyaltyResult.flightCount > 0) {
      workerSystem.removeWorkersByCount(loyaltyResult.flightCount, 'loyalty_flight');
      callbacks.onToast(`${loyaltyResult.flightCount} worker(s) fled the collective due to disloyalty`, 'warning');
    }

    accrueTrudodni();
  }

  // ── 17. Collective autonomous construction ──
  // Now handled autonomously via Yuka Telegrams (MSG.NEW_TICK) in DvorNeedsAgent and CollectiveAgent.
  // The agents will detect needs, request land grants if necessary, and place buildings.

  // ── 18. Chairman meddling ──
  if (workerSystem.isChairmanMeddling() && chronology.getDate().totalTicks % 60 === 0) {
    callbacks.onAdvisor(
      'Comrade, the workers notice your constant meddling. They whisper that the chairman does not trust the collective.',
    );
    if (rng.random() < 0.05) {
      kgbAgent.addMark(
        'excessive_intervention',
        chronology.getDate().totalTicks,
        'Chairman interfered excessively with collective operations',
      );
      callbacks.onToast('BLACK MARK: Excessive interference with collective operations', 'warning');
    }
  }

  // ── 19. Decay + quota ──
  decaySystem(politburoMods.infrastructureDecayMult * eraMods.decayMult * diffConfig.decayMultiplier);
  quotaSystem(ctx.state.quota);

  // ── 20. Gulag effect ──
  defenseAgent.processGulagEffect({
    population: storeRef.resources.population,
    rng,
    workers: workerSystem,
    scoring,
    kgb: kgbAgent,
    callbacks,
    totalTicks: chronology.getDate().totalTicks,
  });

  // ── 21. Settlement ──
  settlement.tickWithCallbacks(callbacks as Parameters<typeof settlement.tickWithCallbacks>[0]);

  // ── 22. Era conditions ──
  politicalAgent.checkConditions({
    totalTicks: chronology.getDate().totalTicks,
    callbacks,
    endGame: (v, r) => ctx.endGame(v, r),
  });

  // ── 23. Political entities ──
  politicalAgent.tickEntitiesFull({
    politicalEntities,
    workers: workerSystem,
    kgb: kgbAgent,
    scoring,
    callbacks,
    settlement,
    politburo,
    quota: ctx.state.quota,
    rng,
    chronologyTotalTicks: chronology.getDate().totalTicks,
  });

  const moraleSamples = collectMoraleSamples(ctx);

  // ── 23b. KGB morale sampling ──
  {
    const totalTicks = chronology.getDate().totalTicks;
    if (moraleSamples.length > 0) {
      kgbAgent.sampleMorale(moraleSamples, totalTicks);
    }
  }

  // ── 23c. Historical local law enforcement ──
  {
    const eraId = politicalAgent.getCurrentEraId();
    const pop = storeRef.resources.population;
    const gridSize = ctx.grid.getSize();
    const gridArea = gridSize * gridSize;
    const approxDensity = gridArea > 0 ? Math.min(1, pop / gridArea / 500) : 0;
    const approxInfraPressure = Math.max(0, Math.min(1, (ctx.modifiers.eraMods.decayMult - 1) * 2));
    const morale = deriveAverageMorale(ctx, moraleSamples);
    kgbAgent.tickLawEnforcement({
      era: eraId,
      population: pop,
      habitableArea: Math.max(1, gridArea * 0.01), // grid units to km^2
      employmentRate: deriveEmploymentRate(ctx),
      morale,
      inequalityIndex: derivePrivilegePressure(ctx, pop),
      densityPressure: approxDensity,
      infrastructurePressure: approxInfraPressure,
    });
  }
}

// ── KGB Morale Sampling ─────────────────────────────────────────────────────

/**
 * Collect per-building morale readings for KGB intelligence.
 *
 * Entity mode (pop < 200): groups citizens by their home building, averages happiness.
 * Aggregate mode (pop >= 200): reads avgMorale directly from building components.
 */
function collectMoraleSamples(
  ctx: TickContext,
): Array<{ sectorId: { gridX: number; gridY: number }; avgMorale: number }> {
  const samples: Array<{ sectorId: { gridX: number; gridY: number }; avgMorale: number }> = [];

  if (ctx.popMode === 'entity') {
    // Group citizen happiness by home building position
    const buildingMorale = new Map<string, { sum: number; count: number; gridX: number; gridY: number }>();
    for (const c of citizens) {
      const home = c.citizen.home;
      if (!home) continue;
      const key = `${home.gridX},${home.gridY}`;
      const entry = buildingMorale.get(key);
      if (entry) {
        entry.sum += c.citizen.happiness;
        entry.count++;
      } else {
        buildingMorale.set(key, { sum: c.citizen.happiness, count: 1, gridX: home.gridX, gridY: home.gridY });
      }
    }
    for (const entry of buildingMorale.values()) {
      samples.push({
        sectorId: { gridX: entry.gridX, gridY: entry.gridY },
        avgMorale: entry.sum / entry.count,
      });
    }
  } else {
    // Aggregate mode: read avgMorale from building components
    for (const entity of buildingsLogic) {
      if (entity.building.workerCount > 0 || entity.building.residentCount > 0) {
        samples.push({
          sectorId: { gridX: entity.position.gridX, gridY: entity.position.gridY },
          avgMorale: entity.building.avgMorale,
        });
      }
    }
  }

  return samples;
}

function deriveAverageMorale(
  ctx: TickContext,
  samples: Array<{ sectorId: { gridX: number; gridY: number }; avgMorale: number }>,
): number {
  if (samples.length === 0) return clamp(ctx.systems.workerSystem.getAverageMorale(), 0, 100);
  const total = samples.reduce((sum, sample) => sum + sample.avgMorale, 0);
  return clamp(total / samples.length, 0, 100);
}

function deriveEmploymentRate(ctx: TickContext): number {
  const raion = ctx.raion;
  if (raion) {
    const laborForce = finiteNonNegative(raion.laborForce);
    if (laborForce <= 0) return 1;
    return clamp01(finiteNonNegative(raion.assignedWorkers) / laborForce);
  }

  let laborForce = 0;
  let assigned = 0;
  for (const entity of citizens) {
    const age = entity.citizen.age;
    if (age != null && (age < 16 || age > 64)) continue;
    laborForce++;
    if (entity.citizen.assignment != null) assigned++;
  }

  return laborForce > 0 ? clamp01(assigned / laborForce) : 1;
}

function derivePrivilegePressure(ctx: TickContext, population: number): number {
  const blatPressure = clamp01(((ctx.storeRef.resources.blat ?? 0) - 15) / 85);
  const officialShare = deriveOfficialShare(ctx, population);
  const hierarchyPressure = clamp01(officialShare / 0.08);
  return clamp01(blatPressure * 0.75 + hierarchyPressure * 0.25);
}

function deriveOfficialShare(ctx: TickContext, population: number): number {
  const pop = finiteNonNegative(population);
  if (pop <= 0) return 0;

  const raion = ctx.raion;
  if (raion) {
    return clamp01(finiteNonNegative(raion.classCounts.party_official ?? 0) / pop);
  }

  let partyOfficials = 0;
  for (const entity of citizens) {
    if (entity.citizen.class === 'party_official') partyOfficials++;
  }
  return clamp01(partyOfficials / pop);
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
