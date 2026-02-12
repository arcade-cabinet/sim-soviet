import { type GameDifficulty } from '@/game/SeedSystem';
import { createCitizen, createDvor, createMetaStore, createResourceStore } from './index';
import { citizens, dvory, world } from '../archetypes';

// Re-export strict types for use in other components
export type { GameDifficulty };

/**
 * Creates the initial population for a new game.
 * @param difficulty - The game difficulty setting (affects starting resources/pop).
 */
export function initializeSettlementPopulation(difficulty: GameDifficulty = 'comrade') {
  // Clear existing entities if any (safety check)
  for (const c of citizens) world.remove(c);
  for (const d of dvory) world.remove(d);

  // Create global meta store if missing
  const meta = world.with('meta').first;
  if (!meta) {
    createMetaStore();
  }

  // Create global resource store if missing
  const res = world.with('resources').first;
  if (!res) {
    createResourceStore();
  }

  // Starting population based on difficulty
  let workerCount = 12;
  let childCount = 4;
  let elderCount = 2;

  if (difficulty === 'partizan') {
    workerCount = 8;
    childCount = 2;
    elderCount = 1;
  } else if (difficulty === 'hero') {
    workerCount = 6;
    childCount = 0;
    elderCount = 0;
  }

  // Create initial Dvor (housing)
  const dvorId = createDvor(15, 15); // Center-ish of 32x32

  // Create workers
  for (let i = 0; i < workerCount; i++) {
    createCitizen({
      age: 20 + Math.floor(Math.random() * 20), // 20-40
      gender: Math.random() > 0.5 ? 'male' : 'female',
      dvorId
    });
  }

  // Create children
  for (let i = 0; i < childCount; i++) {
    createCitizen({
      age: 1 + Math.floor(Math.random() * 12), // 1-13
      gender: Math.random() > 0.5 ? 'male' : 'female',
      dvorId
    });
  }

  // Create elders
  for (let i = 0; i < elderCount; i++) {
    createCitizen({
      age: 60 + Math.floor(Math.random() * 15), // 60-75
      gender: Math.random() > 0.5 ? 'male' : 'female',
      dvorId
    });
  }

  console.log(`Initialized settlement with ${workerCount} workers, ${childCount} children, ${elderCount} elders.`);
}
