/**
 * phaseSocial — tick steps 12, 13, 14, 15
 *
 * Disease, population growth, worker system tick, demographics.
 */

import type { InflowScheduleEntry } from '@/config';
import { political } from '@/config';
import { buildingsLogic, citizens } from '../../ecs/archetypes';
import { populationSystem } from '../../ecs/systems';
import { decayTraffic, extractDesirePaths, recordCommute } from '../../growth/DesirePathSystem';
import { getDefensePosture } from '../../stores/gameStore';
import { getPostureEffects } from '../../ui/hq-tabs/MilitaryTab';
import type { TickContext } from './tickContext';

/**
 * Run social phase: disease, population growth, workers, demographics.
 *
 * Steps 12-15 of the tick loop.
 */
export function phaseSocial(ctx: TickContext): void {
  const { tickResult, storeRef, callbacks, rng } = ctx;
  const { chronology, defense: defenseAgent, demographic: demographicAgent, political: politicalAgent } = ctx.agents;
  const { workerSystem } = ctx.systems;
  const { eraMods, politburoMods } = ctx.modifiers;
  const diffConfig = ctx.diffConfig;

  // ── 12. Disease ──
  defenseAgent.tickDiseaseFull({
    totalTicks: chronology.getDate().totalTicks,
    month: chronology.getDate().month,
    workers: workerSystem,
    callbacks,
    rng,
  });

  // ── 13. Population growth (yearly immigration) ──
  if (tickResult.newYear) {
    const growthResult = populationSystem(
      rng,
      politburoMods.populationGrowthMult * eraMods.populationGrowthMult * diffConfig.growthMultiplier,
      chronology.getDate().month,
    );
    if (growthResult.growthCount > 0) {
      workerSystem.spawnInflowDvor(growthResult.growthCount, 'growth');
    }

    // ── Scheduled era-specific population inflows ──
    processScheduledInflows(ctx);
  }

  // Monthly emergency immigration — the Party sends reinforcements
  // when the settlement is at risk of complete collapse
  if (tickResult.newMonth && !tickResult.newYear) {
    const emergencyPop = storeRef.resources.population;
    if (emergencyPop > 0 && emergencyPop < 20) {
      const reinforcements = rng.int(5, 12);
      workerSystem.spawnInflowDvor(reinforcements, 'emergency_resettlement');
    } else if (emergencyPop >= 20 && emergencyPop < 40) {
      const reinforcements = rng.int(3, 8);
      workerSystem.spawnInflowDvor(reinforcements, 'emergency_resettlement');
    }
  }

  // ── 13b. Defense posture conscription + morale (monthly) ──
  if (tickResult.newMonth) {
    const postureEffects = getPostureEffects(getDefensePosture());
    // Conscript workers based on posture percentage (male-first, historically accurate)
    if (postureEffects.conscriptionPercent > 0) {
      const pop = storeRef.resources.population;
      const conscriptCount = Math.floor((pop * postureEffects.conscriptionPercent) / 100);
      if (conscriptCount > 0) {
        workerSystem.removeWorkersByCountMaleFirst(conscriptCount, 'conscription');
      }
    }
    // Apply morale penalty from posture (negative values reduce morale)
    if (postureEffects.moralePenalty < 0) {
      workerSystem.applyGlobalMoraleDelta(postureEffects.moralePenalty);
    }
  }

  // ── 14. Worker system tick ──
  const workerResult = workerSystem.tick({
    vodkaAvailable: storeRef.resources.vodka,
    foodAvailable: storeRef.resources.food,
    heatingFailing: ctx.agents.economy.getHeating().failing,
    month: chronology.getDate().month,
    eraId: politicalAgent.getCurrentEra().id,
    totalTicks: chronology.getDate().totalTicks,
    trudodniRatio: ctx.agents.economy.getTrudodniRatio(),
  });

  // Emit drain events
  for (const drain of workerResult.drains) {
    if (drain.reason === 'migration') {
      callbacks.onToast(`WORKER FLED: ${drain.name} has abandoned the collective`, 'warning');
      callbacks.onPravda('TRAITOR ABANDONS GLORIOUS COLLECTIVE — GOOD RIDDANCE');
    } else if (drain.reason === 'youth_flight') {
      callbacks.onToast(`YOUTH DEPARTED: ${drain.name} has left for the city`, 'warning');
    } else if (drain.reason === 'workplace_accident') {
      callbacks.onToast(`WORKPLACE ACCIDENT: ${drain.name} killed in industrial incident`, 'critical');
      callbacks.onPravda('HEROIC WORKER MARTYRED IN SERVICE OF PRODUCTION');
    } else if (drain.reason === 'defection') {
      callbacks.onToast(`DEFECTION: ${drain.name} has defected`, 'warning');
    }
  }

  if (workerResult.averageMorale < 30 && chronology.getDate().totalTicks % 60 === 0) {
    callbacks.onAdvisor(
      'Comrade Predsedatel! Workers are deeply unhappy. If conditions do not improve, they WILL flee!',
    );
  }

  // ── 14b. Desire-path traffic recording (every 10 ticks in entity mode) ──
  recordDesirePathTraffic(ctx);

  // ── 15. Demographics ──
  const effectivePop = ctx.raion?.totalPopulation ?? workerResult.population;
  let normalizedFood = Math.min(1, storeRef.resources.food / Math.max(1, effectivePop * 2));
  if (!Number.isFinite(normalizedFood)) normalizedFood = 0;
  const demoResult = demographicAgent.onTick(
    chronology.getDate().totalTicks,
    rng,
    normalizedFood,
    politicalAgent.getCurrentEraId(),
  );

  for (const dead of demoResult.deadMembers) {
    workerSystem.removeWorkerByDvorMember(dead.dvorId, dead.memberId);
  }
  for (const ref of demoResult.agedIntoWorking) {
    workerSystem.spawnWorkerFromDvor(ref.member, ref.dvorId);
  }
  if (demoResult.newDvory > 0) {
    workerSystem.syncCitizenDvorIds();
  }
  if (tickResult.newYear) {
    workerSystem.resetAnnualTrudodni();
    // Annual entity GC sweeps — only needed in entity mode
    if (!ctx.raion) {
      workerSystem.sweepOrphanCitizens();
      demographicAgent.sweepEmptyDvory();
    }
  }
}

// ── Scheduled Population Inflows ────────────────────────────────────────────

/**
 * Process scheduled population inflows based on the current era.
 * Called on year boundaries to provide era-appropriate workforce reinforcements.
 */
function processScheduledInflows(ctx: TickContext): void {
  const { callbacks, rng } = ctx;
  const { political: politicalAgent, chronology } = ctx.agents;
  const { workerSystem } = ctx.systems;

  const currentEraId = politicalAgent.getCurrentEra().id;
  const currentYear = chronology.getDate().year;
  const schedule = political.doctrine.inflowSchedule as Record<string, InflowScheduleEntry>;
  const entry = schedule[currentEraId];
  if (!entry) return;

  // Handle one-shot inflows (great_patriotic evacuee influx)
  if (entry.once) {
    if (ctx.state.evacueeInfluxFired) return;
    const [minCount, maxCount] = entry.count ?? [10, 30];
    const count = rng.int(minCount, maxCount);
    workerSystem.spawnInflowDvor(count, 'evacuee_influx', { morale: 25, loyalty: 40 });
    ctx.state.evacueeInfluxFired = true;
    callbacks.onToast(`War evacuees arrive: ${count} displaced persons seeking refuge.`, 'warning');
    return;
  }

  // Interval-based inflows
  const intervalYears = entry.intervalYears ?? 3;
  const lastYear = ctx.state.lastInflowYear[currentEraId] ?? 0;
  if (lastYear > 0 && currentYear - lastYear < intervalYears) return;

  ctx.state.lastInflowYear[currentEraId] = currentYear;

  switch (entry.type) {
    case 'forced_resettlement': {
      const result = workerSystem.forcedResettlement();
      callbacks.onToast(`${result.count} families forcibly resettled to your settlement.`, 'warning');
      break;
    }
    case 'moscow_assignment': {
      const result = workerSystem.moscowAssignment();
      callbacks.onToast(`Moscow sends ${result.count} new workers to the collective.`, 'warning');
      break;
    }
    case 'veteran_return': {
      const [minCount, maxCount] = entry.count ?? [5, 20];
      const count = rng.int(minCount, maxCount);
      workerSystem.spawnInflowDvor(count, 'veteran_return', { morale: 35, skill: 40 });
      callbacks.onToast(`Veterans return from the front: ${count} scarred workers rejoin.`, 'warning');
      break;
    }
    case 'algorithmic_assignment': {
      const [minCount, maxCount] = entry.count ?? [1, 50];
      const count = rng.int(minCount, maxCount);
      workerSystem.spawnInflowDvor(count, 'algorithmic');
      callbacks.onToast(`The Algorithm assigns ${count} new workers to your sector.`, 'warning');
      break;
    }
    default:
      break;
  }
}

// ── Desire-Path Traffic Recording ──────────────────────────────────────────

/** Throttle interval: record commutes every N ticks to reduce overhead. */
const TRAFFIC_RECORD_INTERVAL = 10;

/**
 * Record worker commutes to build desire-path traffic patterns.
 *
 * In entity mode: iterate assigned citizens with homes, find their workplace
 * building positions, and record Manhattan commutes on the traffic grid.
 * Decay traffic every tick. Extract formed roads monthly.
 */
function recordDesirePathTraffic(ctx: TickContext): void {
  const { tickResult } = ctx;
  const totalTicks = ctx.agents.chronology.getDate().totalTicks;
  const grid = ctx.state.trafficGrid;

  // Decay traffic every tick (lightweight — just a Map iteration)
  decayTraffic(grid);

  // Record commutes only every N ticks (entity mode only)
  if (ctx.popMode === 'entity' && totalTicks % TRAFFIC_RECORD_INTERVAL === 0) {
    // Build defId→position lookup for occupied buildings
    const buildingPositions = new Map<string, Array<{ x: number; z: number }>>();
    for (const b of buildingsLogic.entities) {
      const defId = b.building.defId;
      let arr = buildingPositions.get(defId);
      if (!arr) {
        arr = [];
        buildingPositions.set(defId, arr);
      }
      arr.push({ x: b.position.gridX, z: b.position.gridY });
    }

    // Record commute for each assigned citizen with a home
    for (const c of citizens.entities) {
      if (!c.citizen.home || !c.citizen.assignment) continue;
      const homeX = c.citizen.home.gridX;
      const homeZ = c.citizen.home.gridY;
      const workPositions = buildingPositions.get(c.citizen.assignment);
      if (!workPositions || workPositions.length === 0) continue;

      // Find nearest matching workplace
      let nearest = workPositions[0]!;
      let bestDist = Math.abs(homeX - nearest.x) + Math.abs(homeZ - nearest.z);
      for (let i = 1; i < workPositions.length; i++) {
        const wp = workPositions[i]!;
        const dist = Math.abs(homeX - wp.x) + Math.abs(homeZ - wp.z);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = wp;
        }
      }

      recordCommute(grid, homeX, homeZ, nearest.x, nearest.z);
    }
  }

  // Extract desire-path roads monthly
  if (tickResult.newMonth) {
    const occupied = new Set<string>();
    for (const b of buildingsLogic.entities) {
      occupied.add(`${b.position.gridX},${b.position.gridY}`);
    }
    ctx.state.desirePaths = extractDesirePaths(grid, occupied);
  }
}
