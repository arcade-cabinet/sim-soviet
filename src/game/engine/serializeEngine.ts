/**
 * Serialization helpers -- extracted from SimulationEngine.
 *
 * Handles serializing and restoring all subsystem state to/from
 * a SubsystemSaveData blob for save/load persistence.
 */

import type { QuotaState } from '@/ecs/systems';
import type { AchievementTracker } from '../AchievementTracker';
import { AchievementTracker as AchievementTrackerClass } from '../AchievementTracker';
import type { ChronologySystem } from '../ChronologySystem';
import { ChronologySystem as ChronologySystemClass } from '../ChronologySystem';
import type { CompulsoryDeliveries } from '../CompulsoryDeliveries';
import { CompulsoryDeliveries as CompulsoryDeliveriesClass } from '../CompulsoryDeliveries';
import type { EraId as EconomyEraId, EconomySystem } from '../economy';
import { EconomySystem as EconomySystemClass } from '../economy';
import type { EraSystem } from '../era';
import { EraSystem as EraSystemClass } from '../era';
import type { EventSystem, GameEvent } from '../events';
import { EventSystem as EventSystemClass } from '../events';
import type { FireSystem } from '../FireSystem';
import { FireSystem as FireSystemClass } from '../FireSystem';
import type { MinigameRouter } from '../minigames/MinigameRouter';
import { MinigameRouter as MinigameRouterClass } from '../minigames/MinigameRouter';
import type { PersonnelFile } from '../PersonnelFile';
import { PersonnelFile as PersonnelFileClass } from '../PersonnelFile';
import type { PlanMandateState } from '../PlanMandates';
import type { PolitburoSystem } from '../politburo';
import { PolitburoSystem as PolitburoSystemClass } from '../politburo';
import type { PoliticalEntitySystem } from '../political';
import { PoliticalEntitySystem as PoliticalEntitySystemClass } from '../political';
import type { PravdaSystem } from '../pravda';
import { PravdaSystem as PravdaSystemClass } from '../pravda';
import type { ScoringSystem } from '../ScoringSystem';
import { ScoringSystem as ScoringSystemClass } from '../ScoringSystem';
import type { GameRng } from '../SeedSystem';
import type { SettlementSystem } from '../SettlementSystem';
import { SettlementSystem as SettlementSystemClass } from '../SettlementSystem';
import type { SubsystemSaveData } from '../SimulationEngine';
import type { TransportSystem } from '../TransportSystem';
import { TransportSystem as TransportSystemClass } from '../TransportSystem';
import type { TutorialSystem } from '../TutorialSystem';
import { TutorialSystem as TutorialSystemClass } from '../TutorialSystem';

/** Maps game EraSystem IDs to EconomySystem EraIds (needed for fallback on restore). */
const GAME_ERA_TO_ECONOMY_ERA: Record<string, EconomyEraId> = {
  war_communism: 'revolution',
  first_plans: 'industrialization',
  great_patriotic: 'wartime',
  reconstruction: 'reconstruction',
  thaw: 'thaw',
  stagnation: 'stagnation',
  perestroika: 'perestroika',
  eternal_soviet: 'eternal',
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
  quota: QuotaState;
  consecutiveQuotaFailures: number;
  lastSeason: string;
  lastWeather: string;
  lastDayPhase: string;
  lastThreatLevel: string;
  pendingReport: boolean;
  ended: boolean;
  rng: GameRng | undefined;
  eventHandler: (event: GameEvent) => void;
  politburoEventHandler: (event: GameEvent) => void;
  syncSystemsToMeta: () => void;
}

/**
 * Serialize all subsystem state into a single blob for save persistence.
 */
export function serializeSubsystems(engine: SerializableEngine): SubsystemSaveData {
  return {
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
      ended: engine.ended,
    },
  };
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

  // Restore Compulsory Deliveries
  engine.deliveries = CompulsoryDeliveriesClass.deserialize(data.deliveries);
  if (engine.rng) engine.deliveries.setRng(engine.rng);

  // Restore quota state
  engine.quota.type = data.quota.type as 'food' | 'vodka';
  engine.quota.target = data.quota.target;
  engine.quota.current = data.quota.current;
  engine.quota.deadlineYear = data.quota.deadlineYear;

  // Restore engine-level state
  engine.consecutiveQuotaFailures = data.consecutiveQuotaFailures;

  // -- Extended subsystems (optional -- old saves won't have these) --

  if (data.chronology) {
    engine.chronology = ChronologySystemClass.deserialize(
      data.chronology,
      engine.rng ??
        ({
          random: () => Math.random(),
          int: (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1)),
          pick: <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!,
        } as GameRng),
    );
  }

  if (data.economy) {
    engine.economySystem = EconomySystemClass.deserialize(data.economy);
    if (engine.rng) engine.economySystem.setRng(engine.rng);
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
    if (engine.rng) engine.transport.setRng(engine.rng);
  }

  if (data.fire) {
    engine.fireSystem = FireSystemClass.deserialize(data.fire, engine.rng ?? undefined);
  }

  if (data.engineState) {
    engine.lastSeason = data.engineState.lastSeason;
    engine.lastWeather = data.engineState.lastWeather;
    engine.lastDayPhase = data.engineState.lastDayPhase;
    engine.lastThreatLevel = data.engineState.lastThreatLevel;
    engine.pendingReport = data.engineState.pendingReport;
    engine.ended = data.engineState.ended;
  }

  // Update economy system to match restored era (fallback for saves without economy data)
  if (!data.economy) {
    const economyEra = GAME_ERA_TO_ECONOMY_ERA[engine.eraSystem.getCurrentEraId()] ?? 'revolution';
    engine.economySystem.setEra(economyEra);
  }

  // Sync restored state to ECS gameMeta
  engine.syncSystemsToMeta();
}
