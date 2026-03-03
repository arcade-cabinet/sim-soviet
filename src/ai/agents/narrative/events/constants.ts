import { narrative } from '@/config';

const ecfg = narrative.events;

/** Minimum ticks between events (~2 game-months) */
export const EVENT_COOLDOWN_TICKS = ecfg.cooldownTicks;

/** Base probability per eligible tick */
export const EVENT_BASE_PROBABILITY = ecfg.baseProbability;

/** Maximum number of recent event IDs to remember for dedup */
export const MAX_RECENT_MEMORY = ecfg.maxRecentMemory;
