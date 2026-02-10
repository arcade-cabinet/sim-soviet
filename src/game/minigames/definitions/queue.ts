/**
 * @fileoverview The Queue -- Consumer goods distribution minigame.
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const THE_QUEUE: MinigameDefinition = {
  id: 'the_queue',
  name: 'The Queue',
  description: '400 citizens. 200 loaves. Mathematics has never been crueler.',
  triggerType: 'periodic',
  triggerCondition: 'population_60',
  tickLimit: 30,
  choices: [
    {
      id: 'fair_distribution',
      label: 'Fair Distribution',
      description: 'Half a loaf each. Nobody is happy, but nobody riots.',
      successChance: 0.9,
      onSuccess: {
        resources: { food: -10 },
        announcement: 'Bread distributed equally. Citizens equally unsatisfied.',
      },
      onFailure: {
        resources: { food: -15 },
        announcement: 'The queue broke into arguments. Some bread was trampled.',
        severity: 'warning',
      },
    },
    {
      id: 'priority_workers',
      label: 'Priority for Workers',
      description: 'Feed the productive ones first. The rest will understand. Eventually.',
      successChance: 0.7,
      onSuccess: {
        resources: { food: -5 },
        announcement:
          'Workers fed. Production continues. Others write letters of complaint to nobody.',
      },
      onFailure: {
        resources: { food: -10, population: -1 },
        announcement:
          'Workers fed, but the elderly were not. One citizen did not survive the queue.',
        severity: 'warning',
      },
    },
    {
      id: 'sell_surplus',
      label: 'Sell Surplus on Black Market',
      description: 'Divert some bread for profit. The risk is considerable.',
      successChance: 0.4,
      onSuccess: {
        resources: { food: -8, money: 50 },
        blat: 2,
        announcement: 'Black market transaction complete. Nobody saw anything.',
      },
      onFailure: {
        resources: { food: -15 },
        blackMarks: 1,
        announcement: 'Black market deal exposed. The KGB takes notes.',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    resources: { food: -25, population: -1 },
    announcement: 'Chaotic distribution. Bread wasted. One citizen was crushed in the stampede.',
    severity: 'warning',
  },
};
