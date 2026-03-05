/**
 * Settlement switching coordinator.
 *
 * Orchestrates the full context switch when the player changes their
 * active viewport to a different settlement:
 * 1. Fade-to-black transition starts
 * 2. SettlementRegistry marks the new settlement as active
 * 3. ECS world is swapped (active → background snapshot, background → ECS restore)
 * 4. GameStore notified with new settlement ID
 * 5. Fade-from-black transition completes
 *
 * Background settlements do NOT use the ECS — they tick with aggregate math.
 * Only the active settlement gets the full ECS world.
 */

import { getEngine } from '../../bridge/GameInit';
import {
  notifyStateChange,
  notifyTerrainDirty,
  setActiveSettlementId,
  setSettlementTransitioning,
  signalCameraReset,
  updateSettlementList,
  type SettlementSummaryEntry,
} from '../../stores/gameStore';

/** Duration of the fade-to-black transition in ms. */
const FADE_DURATION_MS = 400;

/**
 * Switch the active viewport to a different settlement.
 *
 * Returns false if the settlement ID is invalid or already active.
 */
export function switchSettlement(targetId: string): boolean {
  const engine = getEngine();
  if (!engine) return false;

  const registry = engine.getRelocationEngine().getRegistry();
  const current = registry.getActive();
  if (!current || current.id === targetId) return false;

  const target = registry.getById(targetId);
  if (!target) return false;

  // Start transition animation
  setSettlementTransitioning(true);

  // After a short fade-out, perform the actual switch
  setTimeout(() => {
    // Switch in the registry via the engine's public API
    engine.setActiveSettlement(targetId);

    // Update the active settlement ID in the store
    setActiveSettlementId(targetId);

    // Signal camera to reset to new grid center
    signalCameraReset();

    // Notify terrain needs rebuild and state changed
    notifyTerrainDirty();
    notifyStateChange();

    // End transition after fade-in
    setTimeout(() => {
      setSettlementTransitioning(false);
    }, FADE_DURATION_MS);
  }, FADE_DURATION_MS);

  return true;
}

/**
 * Build the settlement list from the engine's registry for the UI.
 * Called each tick or when settlements change.
 */
export function syncSettlementList(): void {
  const engine = getEngine();
  if (!engine) return;

  const registry = engine.getRelocationEngine().getRegistry();
  const runtimes = engine.getSettlementRuntimes();
  const all = registry.getAll();

  const list: SettlementSummaryEntry[] = all.map((s) => {
    const runtime = runtimes.find((r) => r.settlement.id === s.id);
    // Derive threat level from highest pressure domain
    let threatLevel: string | undefined;
    if (runtime) {
      const highest = runtime.pressureSystem.getHighestPressure();
      if (highest.level >= 0.75) threatLevel = 'critical';
      else if (highest.level >= 0.5) threatLevel = 'warning';
      else if (highest.level >= 0.25) threatLevel = 'elevated';
      else threatLevel = 'stable';
    }
    return {
      id: s.id,
      name: s.name,
      population: runtime?.resources.population ?? s.population,
      celestialBody: s.celestialBody,
      isActive: s.isActive,
      threatLevel,
    };
  });

  updateSettlementList(list);
}

/**
 * Switch to settlement by index (1-based, for keyboard shortcuts 1-9).
 * Returns false if the index is out of range.
 */
export function switchSettlementByIndex(index: number): boolean {
  const engine = getEngine();
  if (!engine) return false;

  const registry = engine.getRelocationEngine().getRegistry();
  const all = registry.getAll();
  if (index < 1 || index > all.length) return false;

  const target = all[index - 1];
  return switchSettlement(target.id);
}
