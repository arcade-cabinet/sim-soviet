/**
 * Serialization helpers -- extracted from SimulationEngine.
 *
 * Handles serializing and restoring all subsystem state to/from
 * a SubsystemSaveData blob for save/load persistence.
 */

import { buildingsLogic, citizens, dvory, getResourceEntity } from '@/ecs/archetypes';
import type { QuotaState } from '@/ecs/systems';
import { world } from '@/ecs/world';
import type { AchievementTracker } from '../../ai/agents/meta/AchievementTracker';
import { AchievementTracker as AchievementTrackerClass } from '../../ai/agents/meta/AchievementTracker';
import type { ChronologySystem } from '../../ai/agents/core/ChronologyAgent';
import { ChronologySystem as ChronologySystemClass } from '../../ai/agents/core/ChronologyAgent';
import type { CompulsoryDeliveries } from '../../ai/agents/political/CompulsoryDeliveries';
import { CompulsoryDeliveries as CompulsoryDeliveriesClass } from '../../ai/agents/political/CompulsoryDeliveries';
import type { EraId as EconomyEraId, EconomySystem } from '../../ai/agents/economy/EconomyAgent';
import { EconomySystem as EconomySystemClass } from '../../ai/agents/economy/EconomyAgent';
import type { EraSystem } from '../era';
import { EraSystem as EraSystemClass } from '../era';
import type { EventSystem, GameEvent } from '../../ai/agents/narrative/events';
import { EventSystem as EventSystemClass } from '../../ai/agents/narrative/events';
import type { FireSystem } from '../../ai/agents/social/DefenseAgent';
import { FireSystem as FireSystemClass } from '../../ai/agents/social/DefenseAgent';
import type { MinigameRouter } from '../../ai/agents/meta/minigames/MinigameRouter';
import { MinigameRouter as MinigameRouterClass } from '../../ai/agents/meta/minigames/MinigameRouter';
import type { PersonnelFile } from '../../ai/agents/political/KGBAgent';
import { PersonnelFile as PersonnelFileClass } from '../../ai/agents/political/KGBAgent';
import type { PlanMandateState } from '../../ai/agents/political/PoliticalAgent';
import type { PolitburoSystem } from '../../ai/agents/narrative/politburo';
import { PolitburoSystem as PolitburoSystemClass } from '../../ai/agents/narrative/politburo';
import type { PoliticalEntitySystem } from '../../ai/agents/political/PoliticalEntitySystem';
import { PoliticalEntitySystem as PoliticalEntitySystemClass } from '../../ai/agents/political/PoliticalEntitySystem';
import type { PravdaSystem } from '../../ai/agents/narrative/pravda';
import { PravdaSystem as PravdaSystemClass } from '../../ai/agents/narrative/pravda';
import type { ScoringSystem } from '../../ai/agents/political/ScoringSystem';
import { ScoringSystem as ScoringSystemClass } from '../../ai/agents/political/ScoringSystem';
import type { GameRng } from '../SeedSystem';
import type { SettlementSystem } from '../../ai/agents/infrastructure/SettlementSystem';
import { SettlementSystem as SettlementSystemClass } from '../../ai/agents/infrastructure/SettlementSystem';
import type {
  BuildingWorkforceSaveEntry,
  DvorSaveEntry,
  RaionPoolSaveData,
  SubsystemSaveData,
  WorkerStatSaveEntry,
} from './types';
import type { TransportSystem } from '../../ai/agents/infrastructure/TransportSystem';
import { TransportSystem as TransportSystemClass } from '../../ai/agents/infrastructure/TransportSystem';
import type { TutorialSystem } from '../../ai/agents/meta/TutorialSystem';
import { TutorialSystem as TutorialSystemClass } from '../../ai/agents/meta/TutorialSystem';
import type { WorkerSystem } from '../../ai/agents/workforce/WorkerSystem';
import { DIFFICULTY_MULTIPLIERS } from '../../ai/agents/economy/economy-core';

/** Maps game EraSystem IDs to EconomySystem EraIds (needed for fallback on restore). */
const GAME_ERA_TO_ECONOMY_ERA: Record<string, EconomyEraId> = {
  revolution: 'revolution',
  collectivization: 'industrialization',
  industrialization: 'industrialization',
  great_patriotic: 'wartime',
  reconstruction: 'reconstruction',
  thaw_and_freeze: 'thaw',
  stagnation: 'stagnation',
  the_eternal: 'eternal',
};

/** All mutable subsystem references that serialization reads/writes. */
export interface SerializableEngine {
  chronology: ChronologySystem;
  eraSystem: EraSystem;
  economySystem: EconomySystem;
  eventSystem: EventSystem;
  pravdaSystem: PravdaSystem;
  politburo: PolitburoSystem;
  personnelFile: PersonnelFile;
  deliveries: CompulsoryDeliveries;
  settlement: SettlementSystem;
  politicalEntities: PoliticalEntitySystem;
  minigameRouter: MinigameRouter;
  scoring: ScoringSystem;
  tutorial: TutorialSystem;
  achievements: AchievementTracker;
  mandateState: PlanMandateState | null;
  transport: TransportSystem;
  fireSystem: FireSystem;
  workerSystem: WorkerSystem;
  quota: QuotaState;
  consecutiveQuotaFailures: number;
  pripiskiCount: number;
  lastSeason: string;
  lastWeather: string;
  lastDayPhase: string;
  lastThreatLevel: string;
  pendingReport: boolean;
  pendingReportSinceTick: number;
  ended: boolean;
  lastInflowYear: Record<string, number>;
  evacueeInfluxFired: boolean;
  rng: GameRng;
  eventHandler: (event: GameEvent) => void;
  politburoEventHandler: (event: GameEvent) => void;
  syncSystemsToMeta: () => void;
}

/**
 * Serialize all subsystem state into a single blob for save persistence.
 */
export function serializeSubsystems(engine: SerializableEngine): SubsystemSaveData {
  // Determine population mode from resource store
  const store = getResourceEntity();
  const isAggregate = store?.resources.raion != null;

  const base: SubsystemSaveData = {
    era: engine.eraSystem.serialize(),
    personnel: engine.personnelFile.serialize(),
    settlement: engine.settlement.serialize(),
    scoring: engine.scoring.serialize(),
    deliveries: engine.deliveries.serialize(),
    quota: {
      type: engine.quota.type,
      target: engine.quota.target,
      current: engine.quota.current,
      deadlineYear: engine.quota.deadlineYear,
    },
    consecutiveQuotaFailures: engine.consecutiveQuotaFailures,
    // Extended subsystems
    chronology: engine.chronology.serialize(),
    economy: engine.economySystem.serialize(),
    events: engine.eventSystem.serialize(),
    pravda: engine.pravdaSystem.serialize(),
    politburo: engine.politburo.serialize(),
    politicalEntities: engine.politicalEntities.serialize(),
    minigames: engine.minigameRouter.serialize(),
    tutorial: engine.tutorial.serialize(),
    achievements: engine.achievements.serialize(),
    mandates: engine.mandateState ?? undefined,
    transport: engine.transport.serialize(),
    fire: engine.fireSystem.serialize(),
    engineState: {
      lastSeason: engine.lastSeason,
      lastWeather: engine.lastWeather,
      lastDayPhase: engine.lastDayPhase,
      lastThreatLevel: engine.lastThreatLevel,
      pendingReport: engine.pendingReport,
      pendingReportSinceTick: engine.pendingReportSinceTick,
      ended: engine.ended,
      pripiskiCount: engine.pripiskiCount,
      lastInflowYear: { ...engine.lastInflowYear },
      evacueeInfluxFired: engine.evacueeInfluxFired,
    },
    populationMode: isAggregate ? 'aggregate' : 'entity',
  };

  if (isAggregate) {
    // ── Aggregate mode: save RaionPool + per-building workforce ──
    const raion = store!.resources.raion!;
    base.raionPool = serializeRaionPool(raion);
    base.buildingWorkforce = serializeBuildingWorkforce();
  } else {
    // ── Entity mode: save dvor households + per-worker stats ──
    base.dvory = [...dvory].map(
      (entity): DvorSaveEntry => ({
        id: entity.dvor.id,
        surname: entity.dvor.surname,
        members: entity.dvor.members.map((m) => ({ ...m })),
        headOfHousehold: entity.dvor.headOfHousehold,
        privatePlotSize: entity.dvor.privatePlotSize,
        privateLivestock: { ...entity.dvor.privateLivestock },
        joinedTick: entity.dvor.joinedTick,
        loyaltyToCollective: entity.dvor.loyaltyToCollective,
        nextMemberId: entity.dvor.nextMemberId,
      }),
    );
    base.workers = [...citizens]
      .filter((c) => c.citizen.dvorId && c.citizen.dvorMemberId)
      .reduce<WorkerStatSaveEntry[]>((acc, c) => {
        const stats = engine.workerSystem.getStatsMap().get(c);
        if (stats) {
          acc.push({
            dvorId: c.citizen.dvorId!,
            dvorMemberId: c.citizen.dvorMemberId!,
            citizenClass: c.citizen.class,
            stats: { ...stats },
          });
        }
        return acc;
      }, []);
  }

  return base;
}

/** Serialize RaionPool into a plain-object snapshot. */
function serializeRaionPool(raion: import('@/ecs/world').RaionPool): RaionPoolSaveData {
  return {
    totalPopulation: raion.totalPopulation,
    totalHouseholds: raion.totalHouseholds,
    maleAgeBuckets: [...raion.maleAgeBuckets],
    femaleAgeBuckets: [...raion.femaleAgeBuckets],
    classCounts: { ...raion.classCounts },
    birthsThisYear: raion.birthsThisYear,
    deathsThisYear: raion.deathsThisYear,
    totalBirths: raion.totalBirths,
    totalDeaths: raion.totalDeaths,
    pregnancyWaves: [...raion.pregnancyWaves],
    laborForce: raion.laborForce,
    assignedWorkers: raion.assignedWorkers,
    idleWorkers: raion.idleWorkers,
    avgMorale: raion.avgMorale,
    avgLoyalty: raion.avgLoyalty,
    avgSkill: raion.avgSkill,
  };
}

/** Serialize per-building workforce data from all building entities. */
function serializeBuildingWorkforce(): BuildingWorkforceSaveEntry[] {
  return [...buildingsLogic].map(
    (entity): BuildingWorkforceSaveEntry => ({
      gridX: entity.position.gridX,
      gridY: entity.position.gridY,
      defId: entity.building.defId,
      workerCount: entity.building.workerCount,
      residentCount: entity.building.residentCount,
      avgMorale: entity.building.avgMorale,
      avgSkill: entity.building.avgSkill,
      avgLoyalty: entity.building.avgLoyalty,
      avgVodkaDep: entity.building.avgVodkaDep,
      trudodniAccrued: entity.building.trudodniAccrued,
      householdCount: entity.building.householdCount,
    }),
  );
}

/**
 * Restore all subsystem state from a deserialized save blob.
 * Replaces internal system instances with deserialized versions.
 */
export function restoreSubsystems(engine: SerializableEngine, data: SubsystemSaveData): void {
  // Restore Era System
  engine.eraSystem = EraSystemClass.deserialize(data.era);

  // Restore Personnel File
  engine.personnelFile = PersonnelFileClass.deserialize(data.personnel);

  // Restore Settlement System
  engine.settlement = SettlementSystemClass.deserialize(data.settlement);

  // Restore Scoring System
  engine.scoring = ScoringSystemClass.deserialize(data.scoring);

  // Restore Compulsory Deliveries (with difficulty multiplier from scoring system)
  const restoredDifficulty = engine.scoring.getDifficulty();
  const restoredDeliveryMult = DIFFICULTY_MULTIPLIERS[restoredDifficulty]?.deliveryRate ?? 1.0;
  engine.deliveries = CompulsoryDeliveriesClass.deserialize(data.deliveries, restoredDeliveryMult);
  engine.deliveries.setRng(engine.rng);

  // Restore quota state
  engine.quota.type = data.quota.type as 'food' | 'vodka';
  engine.quota.target = data.quota.target;
  engine.quota.current = data.quota.current;
  engine.quota.deadlineYear = data.quota.deadlineYear;

  // Restore engine-level state
  engine.consecutiveQuotaFailures = data.consecutiveQuotaFailures;

  // -- Extended subsystems (optional -- old saves won't have these) --

  if (data.chronology) {
    engine.chronology = ChronologySystemClass.deserialize(data.chronology, engine.rng);
  }

  if (data.economy) {
    engine.economySystem = EconomySystemClass.deserialize(data.economy);
    engine.economySystem.setRng(engine.rng);
  }

  if (data.events) {
    engine.eventSystem = EventSystemClass.deserialize(data.events, engine.eventHandler, engine.rng);
  }

  if (data.pravda) {
    engine.pravdaSystem = PravdaSystemClass.deserialize(data.pravda, engine.rng);
  }

  if (data.politburo) {
    engine.politburo = PolitburoSystemClass.deserialize(data.politburo, engine.politburoEventHandler, engine.rng);
  }

  if (data.politicalEntities) {
    engine.politicalEntities = PoliticalEntitySystemClass.deserialize(data.politicalEntities, engine.rng);
  }

  if (data.minigames) {
    engine.minigameRouter = MinigameRouterClass.deserialize(data.minigames, engine.rng);
  }

  if (data.tutorial) {
    engine.tutorial = TutorialSystemClass.deserialize(data.tutorial);
  }

  if (data.achievements) {
    engine.achievements = AchievementTrackerClass.deserialize(data.achievements);
  }

  if (data.mandates) {
    engine.mandateState = data.mandates;
  }

  if (data.transport) {
    engine.transport = TransportSystemClass.deserialize(data.transport);
    engine.transport.setRng(engine.rng);
  }

  if (data.fire) {
    engine.fireSystem = FireSystemClass.deserialize(data.fire, engine.rng);
  }

  if (data.engineState) {
    engine.lastSeason = data.engineState.lastSeason;
    engine.lastWeather = data.engineState.lastWeather;
    engine.lastDayPhase = data.engineState.lastDayPhase;
    engine.lastThreatLevel = data.engineState.lastThreatLevel;
    engine.pendingReport = data.engineState.pendingReport;
    engine.pendingReportSinceTick = data.engineState.pendingReportSinceTick ?? 0;
    engine.ended = data.engineState.ended;
    engine.pripiskiCount = data.engineState.pripiskiCount ?? 0;
    engine.lastInflowYear = data.engineState.lastInflowYear ?? {};
    engine.evacueeInfluxFired = data.engineState.evacueeInfluxFired ?? false;
  }

  // Update economy system to match restored era (fallback for saves without economy data)
  if (!data.economy) {
    const economyEra = GAME_ERA_TO_ECONOMY_ERA[engine.eraSystem.getCurrentEraId()] ?? 'revolution';
    engine.economySystem.setEra(economyEra);
  }

  // ── Population mode detection (default to 'entity' for backward compat) ──
  const populationMode = data.populationMode ?? 'entity';

  if (populationMode === 'aggregate' && data.raionPool) {
    // ── Restore aggregate population mode ──
    const store = getResourceEntity();
    if (store) {
      store.resources.raion = restoreRaionPool(data.raionPool);
      store.resources.population = data.raionPool.totalPopulation;
    }

    // Restore per-building workforce data
    if (data.buildingWorkforce) {
      restoreBuildingWorkforce(data.buildingWorkforce);
    }
  } else {
    // ── Restore entity population mode (existing behavior) ──
    if (data.dvory && data.dvory.length > 0) {
      // 1. Clear all existing citizen entities and worker stats
      engine.workerSystem.clearAllWorkers();

      // 2. Clear all existing dvor entities
      for (const d of [...dvory]) {
        world.remove(d);
      }

      // 3. Re-create dvor entities from saved data
      for (const saved of data.dvory) {
        world.add({
          isDvor: true as const,
          dvor: {
            id: saved.id,
            surname: saved.surname,
            members: saved.members.map((m) => ({ ...m })),
            headOfHousehold: saved.headOfHousehold,
            privatePlotSize: saved.privatePlotSize,
            privateLivestock: { ...saved.privateLivestock },
            joinedTick: saved.joinedTick,
            loyaltyToCollective: saved.loyaltyToCollective,
            nextMemberId: saved.nextMemberId,
          },
        });
      }

      // 4. Re-create citizen entities from restored dvory
      engine.workerSystem.syncPopulationFromDvory();

      // 5. Restore per-worker stats from save (overwrite defaults)
      if (data.workers) {
        const allCitizens = [...citizens];
        for (const saved of data.workers) {
          const match = allCitizens.find(
            (c) => c.citizen.dvorId === saved.dvorId && c.citizen.dvorMemberId === saved.dvorMemberId,
          );
          if (match) {
            engine.workerSystem.restoreWorkerStats(match, saved.stats);
          }
        }
      }

      // 6. Sync resource store population count to match actual citizens
      const store = getResourceEntity();
      if (store) {
        store.resources.population = engine.workerSystem.getPopulation();
      }
    }
  }

  // Sync restored state to ECS gameMeta
  engine.syncSystemsToMeta();
}

/** Restore a RaionPool from serialized data. */
function restoreRaionPool(saved: RaionPoolSaveData): import('@/ecs/world').RaionPool {
  return {
    totalPopulation: saved.totalPopulation,
    totalHouseholds: saved.totalHouseholds,
    maleAgeBuckets: [...saved.maleAgeBuckets],
    femaleAgeBuckets: [...saved.femaleAgeBuckets],
    classCounts: { ...saved.classCounts },
    birthsThisYear: saved.birthsThisYear,
    deathsThisYear: saved.deathsThisYear,
    totalBirths: saved.totalBirths,
    totalDeaths: saved.totalDeaths,
    pregnancyWaves: [...saved.pregnancyWaves],
    laborForce: saved.laborForce,
    assignedWorkers: saved.assignedWorkers,
    idleWorkers: saved.idleWorkers,
    avgMorale: saved.avgMorale,
    avgLoyalty: saved.avgLoyalty,
    avgSkill: saved.avgSkill,
  };
}

/** Restore per-building workforce fields from serialized entries. */
function restoreBuildingWorkforce(entries: BuildingWorkforceSaveEntry[]): void {
  const allBuildings = [...buildingsLogic];
  for (const entry of entries) {
    const match = allBuildings.find(
      (b) => b.position.gridX === entry.gridX && b.position.gridY === entry.gridY,
    );
    if (match) {
      match.building.workerCount = entry.workerCount;
      match.building.residentCount = entry.residentCount;
      match.building.avgMorale = entry.avgMorale;
      match.building.avgSkill = entry.avgSkill;
      match.building.avgLoyalty = entry.avgLoyalty;
      match.building.avgVodkaDep = entry.avgVodkaDep;
      match.building.trudodniAccrued = entry.trudodniAccrued;
      match.building.householdCount = entry.householdCount;
    }
  }
}
