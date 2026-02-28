/**
 * @fileoverview Factory Emergency -- Equipment malfunction minigame.
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const FACTORY_EMERGENCY: MinigameDefinition = {
  id: 'factory_emergency',
  name: 'Factory Emergency',
  description: 'The boiler is making sounds not found in any engineering manual. Workers are looking at you.',
  triggerType: 'event',
  triggerCondition: 'factory_collapse',
  tickLimit: 30,
  choices: [
    {
      id: 'rush_repair',
      label: 'Rush Repair',
      description: 'Throw resources at the problem. Soviet engineering at its finest.',
      successChance: 0.7,
      onSuccess: {
        resources: { money: -40 },
        announcement: 'Emergency repairs successful. The boiler now makes slightly different sounds.',
      },
      onFailure: {
        resources: { money: -40, population: -1 },
        announcement: 'Repairs failed. One worker was injured by a flying valve. The boiler is unrepentant.',
        severity: 'warning',
      },
    },
    {
      id: 'evacuate_workers',
      label: 'Evacuate Workers',
      description: 'Get everyone out. Lose a day of production. Keep your people.',
      successChance: 0.95,
      onSuccess: {
        resources: { money: -20 },
        announcement: 'Workers evacuated safely. The boiler destroyed itself in private.',
      },
      onFailure: {
        resources: { money: -20, population: -1 },
        announcement: 'Evacuation mostly successful. One worker went back for his lunch.',
        severity: 'warning',
      },
    },
    {
      id: 'keep_working',
      label: 'Keep Working',
      description: 'The quota waits for no boiler. Heroes of labor fear nothing.',
      successChance: 0.3,
      onSuccess: {
        resources: { money: 20 },
        announcement: 'The boiler calmed down on its own. Production continued. The workers are heroes. Probably.',
      },
      onFailure: {
        resources: { population: -3, money: -60 },
        blackMarks: 1,
        announcement: 'The boiler exploded. Three workers lost. Moscow is asking questions.',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    resources: { population: -2, money: -50 },
    blackMarks: 1,
    announcement: 'Nobody gave orders. The boiler exploded. Workers injured. The factory is silent now.',
    severity: 'critical',
  },
};
