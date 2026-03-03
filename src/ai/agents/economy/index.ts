/**
 * @module ai/agents/economy
 *
 * Economic agents: planned economy, food production, vodka, and storage.
 */

export type { EconomyMode } from './EconomyAgent';
export { EconomyAgent } from './EconomyAgent';
export type { FoodAgentSaveData, FoodState } from './FoodAgent';
export { FoodAgent } from './FoodAgent';
export type { StorageState } from './StorageAgent';
export { StorageAgent } from './StorageAgent';
export type { VodkaAgentSnapshot, VodkaResourceView, VodkaUpdateResult } from './VodkaAgent';
export { GRAIN_TO_VODKA_RATIO, VODKA_MORALE_BONUS, VodkaAgent } from './VodkaAgent';
