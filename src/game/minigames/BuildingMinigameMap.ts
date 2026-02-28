/**
 * @fileoverview Maps building definition IDs to minigame trigger conditions.
 *
 * The MinigameRouter matches `triggerCondition` against `buildingDefId`.
 * Since many building defIds should map to the same minigame (e.g. all factory
 * variants trigger "Production Quotas"), this module provides a mapping from
 * actual building defIds to the abstract trigger condition strings used in
 * minigame definitions.
 *
 * Building defIds not in this map have no associated building-tap minigame.
 */

/**
 * Maps a building definition ID to the minigame trigger condition it fires.
 * Returns the original defId if no mapping exists (for terrain features like
 * 'forest', 'mountain', 'market' which match directly).
 */
export function resolveBuildingTrigger(buildingDefId: string): string {
  return BUILDING_TRIGGER_MAP[buildingDefId] ?? buildingDefId;
}

/**
 * Returns the display name of the minigame associated with a building defId,
 * or null if no minigame is available for that building type.
 */
export function getMinigameNameForBuilding(buildingDefId: string): string | null {
  return BUILDING_MINIGAME_NAME[buildingDefId] ?? null;
}

/**
 * Map from building defId → minigame triggerCondition.
 *
 * Building types → minigame mappings:
 *   factory/industry → 'factory_tap' (Production Quotas)
 *   farm/agriculture → 'farm_tap' (Harvest Campaign)
 *   distillery       → 'distillery_tap' (Quality Control)
 *   gulag            → 'gulag_tap' (Prisoner Reform)
 *   ministry/gov     → 'ministry_tap' (Paperwork Avalanche)
 *   power            → 'power_tap' (Grid Management)
 *   school/culture   → 'school_tap' (Ideological Education)
 *   barracks/military→ 'barracks_tap' (Military Inspection)
 */
const BUILDING_TRIGGER_MAP: Record<string, string> = {
  // Factory / Industry → Production Quotas
  'factory-office': 'factory_tap',
  'bread-factory': 'factory_tap',
  'warehouse': 'factory_tap',

  // Agriculture → Harvest Campaign
  'collective-farm-hq': 'farm_tap',

  // Distillery → Quality Control
  'vodka-distillery': 'distillery_tap',

  // Gulag → Prisoner Reform
  'gulag-admin': 'gulag_tap',

  // Ministry / Government → Paperwork Avalanche
  'ministry-office': 'ministry_tap',
  'government-hq': 'ministry_tap',
  'kgb-office': 'ministry_tap',

  // Power → Grid Management
  'power-station': 'power_tap',
  'cooling-tower': 'power_tap',

  // School / Culture → Ideological Education
  'school': 'school_tap',
  'cultural-palace': 'school_tap',
  'workers-club': 'school_tap',

  // Military → Military Inspection
  'barracks': 'barracks_tap',
  'guard-post': 'barracks_tap',
};

/**
 * Map from building defId → human-readable minigame name for UI display.
 */
const BUILDING_MINIGAME_NAME: Record<string, string> = {
  // Factory / Industry → Production Quotas
  'factory-office': 'Production Quotas',
  'bread-factory': 'Production Quotas',
  'warehouse': 'Production Quotas',

  // Agriculture → Harvest Campaign
  'collective-farm-hq': 'Harvest Campaign',

  // Distillery → Quality Control
  'vodka-distillery': 'Quality Control',

  // Gulag → Prisoner Reform
  'gulag-admin': 'Prisoner Reform',

  // Ministry / Government → Paperwork Avalanche
  'ministry-office': 'Paperwork Avalanche',
  'government-hq': 'Paperwork Avalanche',
  'kgb-office': 'Paperwork Avalanche',

  // Power → Grid Management
  'power-station': 'Grid Management',
  'cooling-tower': 'Grid Management',

  // School / Culture → Ideological Education
  'school': 'Ideological Education',
  'cultural-palace': 'Ideological Education',
  'workers-club': 'Ideological Education',

  // Military → Military Inspection
  'barracks': 'Military Inspection',
  'guard-post': 'Military Inspection',
};
