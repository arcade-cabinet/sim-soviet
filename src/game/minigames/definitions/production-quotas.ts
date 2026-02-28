/**
 * @fileoverview Production Quotas -- Factory production challenge minigame.
 * Triggered by tapping factory buildings (factory-office, bread-factory, warehouse).
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const PRODUCTION_QUOTAS: MinigameDefinition = {
  id: 'production_quotas',
  name: 'Production Quotas',
  description:
    'Moscow demands numbers. The machines demand maintenance. The workers demand lunch. You have two of these three things.',
  triggerType: 'building_tap',
  triggerCondition: 'factory_tap',
  tickLimit: 20,
  choices: [
    {
      id: 'double_shift',
      label: 'Double Shift',
      description: 'Run the machines through the night. Heroes of labor need no sleep.',
      successChance: 0.6,
      onSuccess: {
        resources: { food: 15, money: 20 },
        commendations: 1,
        announcement:
          'Double shift completed. Production exceeds quota. The machines protest silently.',
      },
      onFailure: {
        resources: { money: -20, population: -1 },
        announcement:
          'A worker collapsed during the night shift. The machines, at least, are fine.',
        severity: 'warning',
      },
    },
    {
      id: 'maintain_equipment',
      label: 'Maintain Equipment',
      description: 'Shut down for repairs. Lose a day. Keep the factory standing.',
      successChance: 0.85,
      onSuccess: {
        resources: { money: -10 },
        announcement:
          'Maintenance complete. The factory will survive another month. Probably.',
      },
      onFailure: {
        resources: { money: -25 },
        announcement:
          'The replacement parts were the wrong size. Soviet standardization at its finest.',
        severity: 'warning',
      },
    },
    {
      id: 'falsify_output',
      label: 'Falsify Output Numbers',
      description: 'The plan says 200%. The reality says 80%. The pen says whatever you tell it.',
      successChance: 0.45,
      onSuccess: {
        resources: { money: 30 },
        blat: 1,
        announcement:
          'Report submitted. Nobody checked. The plan is fulfilled on paper, which is all that matters.',
      },
      onFailure: {
        blackMarks: 2,
        announcement:
          'The auditor actually counted. Your numbers and reality have irreconcilable differences.',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    resources: { money: -15 },
    blackMarks: 1,
    announcement:
      'Nobody managed the factory floor. Production fell. Moscow noticed. Moscow always notices.',
    severity: 'warning',
  },
};
