/**
 * @module game/political/PoliticalEntitySystem
 *
 * Makes political actors VISIBLE on the game map as entities that interact
 * with workers and buildings.
 *
 * The existing PolitburoSystem handles macro-level political modifiers;
 * this system creates actual entities (politruks, KGB agents, military
 * officers, conscription officers) that occupy grid positions, inspect
 * buildings, and produce gameplay effects each tick.
 */

import type { DialogueContext } from '@/content/dialogue';
import type { GameRng } from '@/game/SeedSystem';
import type { SettlementTier } from '@/game/SettlementSystem';
import {
  calcTargetCount,
  ENTITY_SCALING,
  generateOfficerName,
  getEntityDialogueText,
  HIGH_CORRUPTION_THRESHOLD,
  pickRandomBuildingPosition,
  roleToDialogueCharacter,
  WARTIME_ERAS,
} from './constants';
import { createInvestigation, KGB_REASSIGNMENT_INTERVAL, tickInvestigations } from './kgb';
import { processConscriptionQueue, processOrgnaborQueue, processReturns, WARTIME_CASUALTY_RATE } from './military';
import {
  applyPolitrukTick,
  POLITRUK_MORALE_BOOST,
  POLITRUK_PRODUCTION_PENALTY,
  POLITRUK_ROTATION_INTERVAL,
} from './politruks';
import type {
  ConscriptionEvent,
  KGBInvestigation,
  OrgnaborEvent,
  PoliticalBuildingEffect,
  PoliticalEntitySaveData,
  PoliticalEntityStats,
  PoliticalRole,
  PoliticalTickResult,
} from './types';

export class PoliticalEntitySystem {
  private entities: Map<string, PoliticalEntityStats> = new Map();
  private investigations: KGBInvestigation[] = [];
  private conscriptionQueue: ConscriptionEvent[] = [];
  private orgnaborQueue: OrgnaborEvent[] = [];
  private returnQueue: Array<{ returnTick: number; count: number }> = [];
  private rng: GameRng | null;

  constructor(rng?: GameRng) {
    this.rng = rng ?? null;
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Synchronize political entity counts based on settlement tier, era,
   * and corruption level. Spawns or removes entities to match the
   * target count for each role.
   */
  syncEntities(tier: SettlementTier, era: string, corruption: number): void {
    const rng = this.rng;
    if (!rng) return;

    const isWartime = WARTIME_ERAS.has(era);
    const highCorruption = corruption > HIGH_CORRUPTION_THRESHOLD;
    const scaling = ENTITY_SCALING[tier];

    const roles: PoliticalRole[] = ['politruk', 'kgb_agent', 'military_officer', 'conscription_officer'];

    for (const role of roles) {
      const [min, max] = scaling[role];
      const targetCount = calcTargetCount(rng.int(min, max), max, role, isWartime, highCorruption);
      this.reconcileRole(role, targetCount);
    }
  }

  /**
   * Process one simulation tick for all political entities.
   * @param totalTicks - Current total tick count from the simulation.
   */
  tick(totalTicks: number): PoliticalTickResult {
    const result: PoliticalTickResult = {
      workersConscripted: 0,
      workersReturned: 0,
      newInvestigations: [],
      completedInvestigations: 0,
      blackMarksAdded: 0,
      politrukEffects: [],
      announcements: [],
    };

    // 1. Process returns
    const { returned, remaining } = processReturns(this.returnQueue, totalTicks);
    this.returnQueue = remaining;
    result.workersReturned = returned;

    // 2. Process each entity
    for (const entity of this.entities.values()) {
      entity.ticksRemaining = Math.max(0, entity.ticksRemaining - 1);

      switch (entity.role) {
        case 'politruk':
          this.tickPolitruk(entity, result);
          break;
        case 'kgb_agent':
          this.tickKGB(entity, totalTicks, result);
          break;
        case 'military_officer':
          this.tickMilitary(entity);
          break;
        case 'conscription_officer':
          // Conscription officers are event-driven, not tick-driven
          break;
      }
    }

    // 3. Process active investigations
    this.investigations = tickInvestigations(this.investigations, this.rng, result);

    // 4. Process conscription queue
    const conscriptionReturns = processConscriptionQueue(this.conscriptionQueue, totalTicks, this.rng, result);
    this.returnQueue.push(...conscriptionReturns);

    // 5. Process orgnabor queue
    const orgnaborReturns = processOrgnaborQueue(this.orgnaborQueue, totalTicks, result);
    this.returnQueue.push(...orgnaborReturns);

    return result;
  }

  /** Get the aggregate political effects on a specific building. */
  getBuildingEffects(gridX: number, gridY: number): PoliticalBuildingEffect {
    const effect: PoliticalBuildingEffect = {
      hasPolitruk: false,
      hasKGBAgent: false,
      moraleModifier: 0,
      productionModifier: 0,
      loyaltyModifier: 0,
    };

    for (const entity of this.entities.values()) {
      if (entity.stationedAt.gridX !== gridX || entity.stationedAt.gridY !== gridY) {
        continue;
      }

      if (entity.role === 'politruk') {
        effect.hasPolitruk = true;
        effect.moraleModifier += POLITRUK_MORALE_BOOST;
        effect.productionModifier -= POLITRUK_PRODUCTION_PENALTY;
      }

      if (entity.role === 'kgb_agent') {
        effect.hasKGBAgent = true;
        effect.moraleModifier -= 3; // KGB_MORALE_DROP
        effect.loyaltyModifier += 2; // KGB_LOYALTY_BOOST
      }
    }

    return effect;
  }

  /**
   * Trigger a conscription event. Drafts workers from the settlement.
   * @param count - Number of workers to conscript.
   * @param permanent - If true, workers do not return (wartime).
   */
  triggerConscription(count: number, permanent: boolean): ConscriptionEvent {
    const rng = this.rng;
    const officerName = rng ? generateOfficerName('conscription_officer', rng) : 'Conscription Officer';

    const casualties = permanent ? Math.floor(count * WARTIME_CASUALTY_RATE) : 0;
    const returnTick = permanent ? -1 : 0; // Will be set when processed

    const event: ConscriptionEvent = {
      officerName,
      targetCount: count,
      drafted: 0, // Set when actually processed
      returnTick,
      casualties,
      announcement: `The Motherland needs ${count} workers. This is not a request.`,
    };

    this.conscriptionQueue.push(event);
    return event;
  }

  /**
   * Trigger an orgnabor event. Temporarily borrows workers.
   * @param count - Number of workers to borrow.
   * @param durationTicks - How many ticks before they return.
   * @param purpose - Description of the purpose.
   */
  triggerOrgnabor(count: number, durationTicks: number, purpose: string): OrgnaborEvent {
    const event: OrgnaborEvent = {
      borrowedCount: 0, // Set when processed
      returnTick: 0, // Set when processed
      purpose,
      announcement: `${count} workers are required for ${purpose}. They will be returned. Probably.`,
    };

    // Store the intent; actual processing happens in tick
    this.orgnaborQueue.push({
      ...event,
      borrowedCount: count,
      returnTick: durationTicks, // Temporary; becomes totalTicks + durationTicks in tick()
    });

    return event;
  }

  /** Get all visible political entities for rendering. */
  getVisibleEntities(): PoliticalEntityStats[] {
    return [...this.entities.values()];
  }

  /** Get dialogue for a political entity at a grid position. */
  getEntityDialogue(gridX: number, gridY: number, context: DialogueContext): string | null {
    for (const entity of this.entities.values()) {
      if (entity.stationedAt.gridX !== gridX || entity.stationedAt.gridY !== gridY) {
        continue;
      }

      const character = roleToDialogueCharacter(entity.role);
      if (character) {
        return getEntityDialogueText(character, context);
      }
    }
    return null;
  }

  /** Get the entity count by role. */
  getEntityCounts(): Record<PoliticalRole, number> {
    const counts: Record<PoliticalRole, number> = {
      politruk: 0,
      kgb_agent: 0,
      military_officer: 0,
      conscription_officer: 0,
    };
    for (const entity of this.entities.values()) {
      counts[entity.role]++;
    }
    return counts;
  }

  /** Get all active investigations. */
  getActiveInvestigations(): readonly KGBInvestigation[] {
    return this.investigations;
  }

  /** Get the return queue (for testing). */
  getReturnQueue(): ReadonlyArray<{ returnTick: number; count: number }> {
    return this.returnQueue;
  }

  /** Serialize for save data. */
  serialize(): PoliticalEntitySaveData {
    return {
      entities: [...this.entities.values()],
      investigations: [...this.investigations],
      conscriptionQueue: [...this.conscriptionQueue],
      orgnaborQueue: [...this.orgnaborQueue],
      returnQueue: [...this.returnQueue],
    };
  }

  /** Deserialize from save data. */
  static deserialize(data: PoliticalEntitySaveData, rng?: GameRng): PoliticalEntitySystem {
    const system = new PoliticalEntitySystem(rng);
    for (const entity of data.entities) {
      system.entities.set(entity.id, { ...entity });
    }
    system.investigations = [...data.investigations];
    system.conscriptionQueue = [...data.conscriptionQueue];
    system.orgnaborQueue = [...data.orgnaborQueue];
    system.returnQueue = [...data.returnQueue];
    return system;
  }

  // ── Private: entity lifecycle ──────────────────────────────

  private spawnEntity(role: PoliticalRole): void {
    const rng = this.rng;
    if (!rng) return;

    const id = rng.id();
    const name = generateOfficerName(role, rng);
    const buildingPos = pickRandomBuildingPosition(rng);
    const stationedAt = buildingPos ? { gridX: buildingPos.gridX, gridY: buildingPos.gridY } : { gridX: 0, gridY: 0 };

    const ticksRemaining = this.getInitialTicks(role);

    const entity: PoliticalEntityStats = {
      id,
      role,
      name,
      stationedAt,
      targetBuilding: buildingPos?.defId,
      ticksRemaining,
      effectiveness: rng.int(40, 80),
    };

    this.entities.set(id, entity);
  }

  /** Spawn or remove entities for a single role to match target count. */
  private reconcileRole(role: PoliticalRole, targetCount: number): void {
    const currentOfRole = [...this.entities.values()].filter((e) => e.role === role);
    const diff = targetCount - currentOfRole.length;

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        this.spawnEntity(role);
      }
    } else if (diff < 0) {
      for (let i = 0; i < -diff && i < currentOfRole.length; i++) {
        this.entities.delete(currentOfRole[i]!.id);
      }
    }
  }

  private getInitialTicks(role: PoliticalRole): number {
    const rng = this.rng;
    switch (role) {
      case 'politruk':
        return rng ? rng.int(60, POLITRUK_ROTATION_INTERVAL) : POLITRUK_ROTATION_INTERVAL;
      case 'kgb_agent':
        return rng ? rng.int(10, 30) : 30;
      case 'military_officer':
        return rng ? rng.int(60, 180) : 120;
      case 'conscription_officer':
        return rng ? rng.int(30, 90) : 60;
    }
  }

  // ── Private: per-role tick logic ──────────────────────────

  private tickPolitruk(entity: PoliticalEntityStats, result: PoliticalTickResult): void {
    applyPolitrukTick(entity, result);

    // Rotate to a new building when timer expires
    if (entity.ticksRemaining <= 0) {
      this.reassignToBuilding(entity, POLITRUK_ROTATION_INTERVAL);
    }
  }

  private tickKGB(entity: PoliticalEntityStats, _totalTicks: number, result: PoliticalTickResult): void {
    // Start an investigation when arriving at a new building
    if (entity.ticksRemaining <= 0 && entity.targetBuilding) {
      const rng = this.rng;
      if (rng) {
        const investigation = createInvestigation(entity, rng);
        result.newInvestigations.push(investigation);
        result.announcements.push(`KGB ${entity.name} has begun a ${investigation.intensity} investigation.`);
        this.investigations.push(investigation);
      }
      this.reassignToBuilding(entity, KGB_REASSIGNMENT_INTERVAL);
    }
  }

  private tickMilitary(entity: PoliticalEntityStats): void {
    if (entity.ticksRemaining <= 0) {
      this.reassignToBuilding(entity, this.rng ? this.rng.int(60, 180) : 120);
    }
  }

  private reassignToBuilding(entity: PoliticalEntityStats, newDuration: number): void {
    const rng = this.rng;
    if (!rng) return;

    const buildingPos = pickRandomBuildingPosition(rng);
    if (buildingPos) {
      entity.stationedAt = { gridX: buildingPos.gridX, gridY: buildingPos.gridY };
      entity.targetBuilding = buildingPos.defId;
    }
    entity.ticksRemaining = newDuration;
  }
}
