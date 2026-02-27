/**
 * @fileoverview The Hunt -- Subsistence foraging minigame.
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const THE_HUNT: MinigameDefinition = {
  id: 'the_hunt',
  name: 'The Hunt',
  description:
    'The forest offers what the State cannot: food that was not planned, allocated, or redistributed.',
  triggerType: 'building_tap',
  triggerCondition: 'forest',
  tickLimit: 25,
  choices: [
    {
      id: 'small_party',
      label: 'Send Small Party',
      description: 'Two hunters. One rifle. Modest expectations.',
      successChance: 0.8,
      onSuccess: {
        resources: { food: 8 },
        announcement: 'Small hunting party returns with rabbits. Not much, but honest.',
      },
      onFailure: {
        resources: { food: 2 },
        announcement:
          'The rabbits were faster than the hunters. A few mushrooms were gathered instead.',
      },
    },
    {
      id: 'large_party',
      label: 'Send Large Party',
      description: 'More hunters, more mouths. But the forest is deep and full of surprises.',
      successChance: 0.55,
      onSuccess: {
        resources: { food: 25 },
        announcement: 'The hunting party returns with a deer. Tonight, the city feasts.',
      },
      onFailure: {
        resources: { food: -5, population: -1 },
        announcement:
          'The forest did not cooperate. One hunter did not return. The bears send their regards.',
        severity: 'warning',
      },
    },
    {
      id: 'poach_state_forests',
      label: 'Poach from State Forests',
      description: 'The best game is in the restricted zone. The risk is equally rich.',
      successChance: 0.45,
      onSuccess: {
        resources: { food: 40 },
        announcement: 'Poaching successful. The elk did not check your permits.',
      },
      onFailure: {
        resources: { food: 5 },
        blackMarks: 1,
        announcement: 'Forest rangers caught your hunters. The elk are now state witnesses.',
        severity: 'warning',
      },
    },
  ],
  autoResolve: {
    resources: { food: -3 },
    announcement:
      'Nobody went hunting. The forest remains indifferent. Dinner is turnip soup. Again.',
  },
};
