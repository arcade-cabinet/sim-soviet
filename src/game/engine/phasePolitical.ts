/**
 * phasePolitical — tick steps 16, 17, 18, 19, 20, 21, 22, 23
 *
 * Loyalty, trudodni, collective construction, chairman meddling,
 * decay, gulag, settlement, era conditions, political entities,
 * KGB morale sampling.
 */

import { accrueTrudodni } from '../../ai/agents/economy/EconomyAgent';
import { buildingsLogic, citizens } from '../../ecs/archetypes';
import { world } from '../../ecs/world';
import { decaySystem, quotaSystem } from '../../ecs/systems';
import { evaluateArcologies } from '../../game/arcology/ArcologySystem';
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
    collective: collectiveAgent,
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
  collectiveAgent.tickAutonomous({
    totalTicks: chronology.getDate().totalTicks,
    rng,
    mandateState: ctx.state.mandateState,
    eraId: politicalAgent.getCurrentEraId(),
    callbacks: callbacks as Parameters<typeof collectiveAgent.tickAutonomous>[0]['callbacks'],
    recordBuildingForMandates: (defId: string) => {
      politicalAgent.recordBuildingPlaced(defId);
    },
    terrainTiles: ctx.state.terrainTiles,
    gridSize: ctx.grid.getSize(),
    arcologies: ctx.state.arcologies,
  });

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

  // ── 21b. Arcology evaluation (yearly — expensive flood-fill, pop >= 50K) ──
  if (tickResult.newYear) {
    tickArcologies(ctx);
  }

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

  // ── 23b. KGB morale sampling ──
  {
    const totalTicks = chronology.getDate().totalTicks;
    const samples = collectMoraleSamples(ctx);
    if (samples.length > 0) {
      kgbAgent.sampleMorale(samples, totalTicks);
    }
  }

  // ── 23c. MegaCity law enforcement (crime, sectors, iso-cubes) ──
  {
    const eraId = politicalAgent.getCurrentEraId();
    const pop = storeRef.resources.population;
    const gridSize = ctx.grid.getSize();
    const gridArea = gridSize * gridSize;
    // Approximate density pressure: pop / (grid area) normalized
    const approxDensity = gridArea > 0 ? Math.min(1, (pop / gridArea) / 500) : 0;
    // Infrastructure pressure: approximate from decay modifier
    const approxInfraPressure = Math.max(0, Math.min(1, (ctx.modifiers.eraMods.decayMult - 1) * 2));
    kgbAgent.tickLawEnforcement({
      era: eraId,
      population: pop,
      habitableArea: Math.max(1, gridArea * 0.01), // grid units to km^2
      employmentRate: 0.85, // assume reasonable employment baseline
      morale: 50, // neutral default — real morale is on per-building basis
      inequalityIndex: 0, // placeholder — no inequality model yet
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

// ── Arcology Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate arcology merges and auto-assign domes.
 *
 * Runs the pure evaluateArcologies function with the Miniplex ECS world,
 * then handles dome auto-placement and notifications for new merges.
 */
function tickArcologies(ctx: TickContext): void {
  const { storeRef, callbacks } = ctx;
  const population = storeRef.resources.population;

  const result = evaluateArcologies({
    world,
    population,
    arcologies: ctx.state.arcologies,
  });

  // Notify on new arcology formations
  for (const merge of result.newMerges) {
    const buildingCount = merge.componentEntityIds.length;
    callbacks.onToast(
      `ARCOLOGY FORMED: ${buildingCount} ${merge.mergeGroup} buildings merged into mega-structure`,
    );
  }

  // Auto-assign domes to eligible arcologies (containment >= 0.8, pop >= domeStart)
  if (result.domeThresholdReached) {
    for (const arc of result.arcologies) {
      if (!arc.hasDome && arc.containment >= 0.8) {
        arc.hasDome = true;
        callbacks.onToast(
          `DOME CONSTRUCTED: Atmospheric containment dome covers ${arc.mergeGroup} arcology`,
        );
      }
    }
  }

  ctx.state.arcologies = result.arcologies;
}
