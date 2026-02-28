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
 *
 * Also manages the Raikom (district committee) and doctrine mechanics.
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
import { type DoctrineContext, evaluateDoctrineMechanics } from './doctrine';
import {
  createInformant,
  createInvestigation,
  KGB_REASSIGNMENT_INTERVAL,
  tickInformants,
  tickInvestigations,
} from './kgb';
import { processConscriptionQueue, processOrgnaborQueue, processReturns, WARTIME_CASUALTY_RATE } from './military';
import {
  applyPolitrukTick,
  calcPolitrukCount,
  POLITRUK_MORALE_BOOST,
  POLITRUK_ROTATION_INTERVAL,
  rollPolitrukPersonality,
} from './politruks';
import { generateRaikom, offerBlat, tickRaikom } from './raikom';
import type {
  ConscriptionEvent,
  KGBInformant,
  KGBInvestigation,
  OrgnaborEvent,
  PoliticalBuildingEffect,
  PoliticalEntitySaveData,
  PoliticalEntityStats,
  PoliticalRole,
  PoliticalTickResult,
  RaikomState,
} from './types';

/** How many workers are at a given building (estimated from building size). */
function estimateBuildingWorkers(defId: string | undefined): number {
  if (!defId) return 5;
  // Rough estimates based on building type
  if (defId.includes('factory') || defId.includes('bread')) return 15;
  if (defId.includes('apartment') || defId.includes('house')) return 8;
  if (defId.includes('power')) return 10;
  if (defId.includes('farm') || defId.includes('collective')) return 12;
  if (defId.includes('warehouse')) return 6;
  return 5;
}

export class PoliticalEntitySystem {
  private entities: Map<string, PoliticalEntityStats> = new Map();
  private investigations: KGBInvestigation[] = [];
  private informants: KGBInformant[] = [];
  private conscriptionQueue: ConscriptionEvent[] = [];
  private orgnaborQueue: OrgnaborEvent[] = [];
  private returnQueue: Array<{ returnTick: number; count: number }> = [];
  private raikom: RaikomState | null = null;
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

    // Initialize Raikom if not yet created (once settlement is at least posyolok)
    if (!this.raikom && tier !== 'selo') {
      this.raikom = generateRaikom(rng, 0);
    }
  }

  /**
   * Synchronize politruk count based on population (1:20 ratio).
   * Called separately from syncEntities because it depends on population,
   * not just settlement tier.
   */
  syncPolitruksByPopulation(population: number, doctrineMult: number, difficultyMult: number): void {
    const target = calcPolitrukCount(population, doctrineMult, difficultyMult);
    this.reconcileRole('politruk', target);
  }

  /**
   * Process one simulation tick for all political entities.
   * @param totalTicks - Current total tick count from the simulation.
   * @param doctrineCtx - Optional doctrine context for era mechanics.
   */
  tick(totalTicks: number, doctrineCtx?: DoctrineContext): PoliticalTickResult {
    const result: PoliticalTickResult = {
      workersConscripted: 0,
      workersReturned: 0,
      workersArrested: 0,
      newInvestigations: [],
      completedInvestigations: 0,
      blackMarksAdded: 0,
      politrukEffects: [],
      ideologySessions: [],
      announcements: [],
      raikomDirectives: [],
      doctrineMechanicEffects: [],
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

    // 4. Tick informant network
    tickInformants(this.informants, totalTicks, this.rng, result);

    // 5. Process conscription queue
    const conscriptionReturns = processConscriptionQueue(this.conscriptionQueue, totalTicks, this.rng, result);
    this.returnQueue.push(...conscriptionReturns);

    // 6. Process orgnabor queue
    const orgnaborReturns = processOrgnaborQueue(this.orgnaborQueue, totalTicks, result);
    this.returnQueue.push(...orgnaborReturns);

    // 7. Tick Raikom
    if (this.raikom && this.rng) {
      tickRaikom(this.raikom, totalTicks, this.rng, result);
    }

    // 8. Evaluate doctrine mechanics
    if (doctrineCtx) {
      const doctrineEffects = evaluateDoctrineMechanics(doctrineCtx);
      result.doctrineMechanicEffects.push(...doctrineEffects);
    }

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
        // Production penalty now comes from session disruption via PolitrukEffect,
        // not a flat modifier here
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
   * @param deadlineTicks - Optional deadline for player response (0 = immediate).
   */
  triggerConscription(count: number, permanent: boolean, deadlineTicks?: number): ConscriptionEvent {
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
      playerResponded: deadlineTicks === undefined || deadlineTicks === 0,
      responseDedlineTick: deadlineTicks ? deadlineTicks : undefined,
    };

    this.conscriptionQueue.push(event);
    return event;
  }

  /**
   * Player responds to a conscription order.
   * @param accept - Whether the player accepts the conscription.
   * @returns marks incurred if rejected.
   */
  respondToConscription(accept: boolean): number {
    // Find the first pending conscription
    const pending = this.conscriptionQueue.find((e) => !e.playerResponded);
    if (!pending) return 0;

    pending.playerResponded = true;

    if (!accept) {
      // Rejecting costs marks
      pending.targetCount = 0;
      pending.announcement = 'Conscription order rejected by the Mayor. Moscow has been notified.';
      return 2; // 2 marks for rejecting
    }

    return 0;
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

  /** Offer blat to the Raikom. Returns favor gained. */
  offerBlatToRaikom(blatAmount: number): number {
    if (!this.raikom) return 0;
    return offerBlat(this.raikom, blatAmount);
  }

  /** Get the current Raikom state (for UI). */
  getRaikom(): Readonly<RaikomState> | null {
    return this.raikom;
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

  /** Get all informants (for testing). */
  getInformants(): readonly KGBInformant[] {
    return this.informants;
  }

  /** Serialize for save data. */
  serialize(): PoliticalEntitySaveData {
    return {
      entities: [...this.entities.values()],
      investigations: [...this.investigations],
      informants: [...this.informants],
      conscriptionQueue: [...this.conscriptionQueue],
      orgnaborQueue: [...this.orgnaborQueue],
      returnQueue: [...this.returnQueue],
      raikom: this.raikom ? { ...this.raikom, activeDirectives: [...this.raikom.activeDirectives] } : null,
    };
  }

  /** Deserialize from save data. */
  static deserialize(data: PoliticalEntitySaveData, rng?: GameRng): PoliticalEntitySystem {
    const system = new PoliticalEntitySystem(rng);
    for (const entity of data.entities) {
      system.entities.set(entity.id, { ...entity });
    }
    system.investigations = [...data.investigations];
    system.informants = data.informants ? [...data.informants] : [];
    system.conscriptionQueue = [...data.conscriptionQueue];
    system.orgnaborQueue = [...data.orgnaborQueue];
    system.returnQueue = [...data.returnQueue];
    system.raikom = data.raikom ? { ...data.raikom, activeDirectives: [...data.raikom.activeDirectives] } : null;
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

    // Assign personality for politruks
    if (role === 'politruk') {
      entity.personality = rollPolitrukPersonality(rng);
    }

    this.entities.set(id, entity);

    // KGB agents spawn with an informant at their first building
    if (role === 'kgb_agent' && buildingPos) {
      this.informants.push(createInformant(buildingPos, rng));
    }
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
    const buildingWorkers = estimateBuildingWorkers(entity.targetBuilding);
    applyPolitrukTick(entity, result, this.rng, buildingWorkers);

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
        // Pass prior marks for escalation (use flagged worker count as proxy)
        const priorFlags = this.investigations.reduce((sum, inv) => sum + inv.flaggedWorkers, 0);
        const investigation = createInvestigation(entity, rng, priorFlags);
        result.newInvestigations.push(investigation);
        result.announcements.push(`KGB ${entity.name} has begun a ${investigation.intensity} investigation.`);
        this.investigations.push(investigation);

        // Plant a new informant at investigated buildings
        if (rng.coinFlip(0.3)) {
          this.informants.push(createInformant(entity.stationedAt, rng));
        }
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
