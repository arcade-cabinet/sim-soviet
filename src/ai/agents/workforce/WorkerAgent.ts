/**
 * @fileoverview WorkerAgent — Yuka agent that owns the WorkerSystem.
 *
 * Wraps WorkerSystem (the authoritative population manager) as a Yuka Vehicle
 * agent, delegating all population management methods. This is the agent-level
 * entry point for worker/population operations in the SimSoviet agent architecture.
 */

import { Vehicle } from 'yuka';
import type { CollectiveFocus } from '../infrastructure/CollectiveAgent';
import type { DvorMember, Entity } from '../../../ecs/world';
import type { GameRng } from '../../../game/SeedSystem';
import type {
  PopulationDrainEvent,
  WorkerDisplayInfo,
  WorkerStats,
  WorkerTickResult,
} from './types';
import {
  WorkerSystem,
  type WorkerStatEntry,
  type WorkerSystemSaveData,
  type WorkerTickContext,
} from './WorkerSystem';

/**
 * WorkerAgent — Yuka Vehicle that owns the WorkerSystem.
 *
 * All population management flows through this agent. External callers
 * access WorkerSystem methods via delegation, or use getWorkerSystem()
 * for backward compatibility.
 */
export class WorkerAgent extends Vehicle {
  private workerSystem: WorkerSystem;

  constructor(rng?: GameRng) {
    super();
    this.workerSystem = new WorkerSystem(rng);
  }

  /** Yuka update hook — reserved for future per-frame agent logic. */
  override update(_delta: number): this {
    // WorkerSystem.tick() is called explicitly by the engine orchestrator,
    // not via Yuka's update loop, to maintain deterministic tick ordering.
    return this;
  }

  /** Get the underlying WorkerSystem for backward compatibility. */
  getWorkerSystem(): WorkerSystem {
    return this.workerSystem;
  }

  /** Replace the internal WorkerSystem (used during deserialization). */
  setWorkerSystem(system: WorkerSystem): void {
    this.workerSystem = system;
  }

  // ── Delegated WorkerSystem API ──────────────────────────

  tick(ctx: WorkerTickContext): WorkerTickResult;
  tick(vodkaAvailable: number, foodAvailable: number, heatingFailing?: boolean): WorkerTickResult;
  tick(ctxOrVodka: WorkerTickContext | number, foodAvailable?: number, heatingFailing?: boolean): WorkerTickResult {
    if (typeof ctxOrVodka === 'number') {
      return this.workerSystem.tick(ctxOrVodka, foodAvailable ?? 0, heatingFailing);
    }
    return this.workerSystem.tick(ctxOrVodka);
  }

  spawnInflowDvor(
    count: number,
    reason: string,
    overrides?: Partial<Pick<WorkerStats, 'morale' | 'loyalty' | 'skill'>>,
  ): Entity[] {
    return this.workerSystem.spawnInflowDvor(count, reason, overrides);
  }

  removeWorkersByCount(count: number, reason: string): void {
    this.workerSystem.removeWorkersByCount(count, reason);
  }

  removeWorkersByCountMaleFirst(count: number, reason: string): number {
    return this.workerSystem.removeWorkersByCountMaleFirst(count, reason);
  }

  removeWorker(entity: Entity, reason: string, skipDvorCleanup?: boolean): void {
    this.workerSystem.removeWorker(entity, reason, skipDvorCleanup);
  }

  removeWorkerByDvorMember(dvorId: string, memberId: string): boolean {
    return this.workerSystem.removeWorkerByDvorMember(dvorId, memberId);
  }

  spawnWorkerFromDvor(member: DvorMember, dvorId: string, homeX?: number, homeY?: number): Entity | null {
    return this.workerSystem.spawnWorkerFromDvor(member, dvorId, homeX, homeY);
  }

  syncPopulationFromDvory(): number {
    return this.workerSystem.syncPopulationFromDvory();
  }

  syncCitizenDvorIds(): void {
    this.workerSystem.syncCitizenDvorIds();
  }

  getPopulation(): number {
    return this.workerSystem.getPopulation();
  }

  getStatsMap(): ReadonlyMap<Entity, WorkerStats> {
    return this.workerSystem.getStatsMap();
  }

  getAverageMorale(): number {
    return this.workerSystem.getAverageMorale();
  }

  getTrudodni(entity: Entity): number {
    return this.workerSystem.getTrudodni(entity);
  }

  resetAnnualTrudodni(): void {
    this.workerSystem.resetAnnualTrudodni();
  }

  isChairmanMeddling(): boolean {
    return this.workerSystem.isChairmanMeddling();
  }

  getOverrideCount(): number {
    return this.workerSystem.getOverrideCount();
  }

  resetOverrideCount(): void {
    this.workerSystem.resetOverrideCount();
  }

  setCollectiveFocus(focus: CollectiveFocus): void {
    this.workerSystem.setCollectiveFocus(focus);
  }

  getCollectiveFocus(): CollectiveFocus {
    return this.workerSystem.getCollectiveFocus();
  }

  arrestWorker(): PopulationDrainEvent | null {
    return this.workerSystem.arrestWorker();
  }

  moscowAssignment() {
    return this.workerSystem.moscowAssignment();
  }

  forcedResettlement() {
    return this.workerSystem.forcedResettlement();
  }

  kolkhozAmalgamation() {
    return this.workerSystem.kolkhozAmalgamation();
  }

  assignWorker(worker: Entity, buildingGridX: number, buildingGridY: number, source?: 'player' | 'forced' | 'auto'): boolean {
    return this.workerSystem.assignWorker(worker, buildingGridX, buildingGridY, source);
  }

  unassignWorker(worker: Entity): void {
    this.workerSystem.unassignWorker(worker);
  }

  clearAllWorkers(): void {
    this.workerSystem.clearAllWorkers();
  }

  restoreWorkerStats(entity: Entity, stats: WorkerStats): void {
    this.workerSystem.restoreWorkerStats(entity, stats);
  }

  /** @deprecated Use spawnInflowDvor() for production code. */
  syncPopulation(targetPopulation: number): void {
    this.workerSystem.syncPopulation(targetPopulation);
  }

  /** @deprecated Use spawnInflowDvor() instead. */
  spawnWorker(
    homeX?: number,
    homeY?: number,
    overrides?: Partial<Pick<WorkerStats, 'morale' | 'loyalty' | 'skill'>>,
  ): Entity {
    return this.workerSystem.spawnWorker(homeX, homeY, overrides);
  }

  getWorkerInfo(entity: Entity): WorkerDisplayInfo | null {
    return this.workerSystem.getWorkerInfo(entity);
  }

  serialize(): WorkerSystemSaveData {
    return this.workerSystem.serialize();
  }
}
