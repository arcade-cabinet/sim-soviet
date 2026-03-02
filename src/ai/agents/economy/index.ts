/**
 * @module ai/agents/economy
 *
 * Economic agents: planned economy, food production, vodka, and storage.
 */
export { EconomyAgent } from './EconomyAgent';
export type { EconomyMode } from './EconomyAgent';
export { FoodAgent } from './FoodAgent';
export type { FoodState, FoodAgentSaveData } from './FoodAgent';
export { VodkaAgent, GRAIN_TO_VODKA_RATIO, VODKA_MORALE_BONUS } from './VodkaAgent';
export type { VodkaResourceView, VodkaUpdateResult, VodkaAgentSnapshot } from './VodkaAgent';
export { StorageAgent } from './StorageAgent';
export type { StorageState } from './StorageAgent';
