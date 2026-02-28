/**
 * @fileoverview Grid Management -- Power station crisis minigame.
 * Triggered by tapping power buildings (power-station, cooling-tower).
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const GRID_MANAGEMENT: MinigameDefinition = {
  id: 'grid_management',
  name: 'Grid Management',
  description:
    'The power grid is operating at 147% of rated capacity. The engineers say this is fine. The sparking wires disagree.',
  triggerType: 'building_tap',
  triggerCondition: 'power_tap',
  tickLimit: 15,
  choices: [
    {
      id: 'rolling_blackouts',
      label: 'Rolling Blackouts',
      description: 'Rotate power between districts. Everyone suffers equally. The socialist way.',
      successChance: 0.8,
      onSuccess: {
        resources: { money: -5 },
        announcement: 'Blackouts managed. No district was dark for more than two hours. The citizens adapted.',
      },
      onFailure: {
        resources: { money: -15 },
        announcement: 'The rotation schedule confused the operators. Three districts went dark simultaneously.',
        severity: 'warning',
      },
    },
    {
      id: 'overload_grid',
      label: 'Push Through at Full Power',
      description: 'The transformers can take it. The manual says otherwise, but manuals are bourgeois.',
      successChance: 0.4,
      onSuccess: {
        resources: { money: 25 },
        commendations: 1,
        announcement: 'Full power maintained. The grid held. The engineers are surprised and the Party is pleased.',
      },
      onFailure: {
        resources: { money: -40, population: -1 },
        blackMarks: 1,
        announcement: 'Transformer explosion. One worker electrocuted. The lights went out in a very dramatic fashion.',
        severity: 'critical',
      },
    },
    {
      id: 'borrow_from_neighbors',
      label: 'Borrow from Neighboring Grid',
      description: 'Their surplus is your necessity. Inter-district cooperation at its finest.',
      successChance: 0.6,
      onSuccess: {
        resources: { money: -15 },
        blat: 1,
        announcement: 'Neighboring district shared power. You owe them a favor. This is how the Soviet system works.',
      },
      onFailure: {
        resources: { money: -15 },
        announcement: 'The neighboring district had no surplus. They lied on their reports too. Solidarity.',
      },
    },
  ],
  autoResolve: {
    resources: { money: -30 },
    blackMarks: 1,
    announcement: 'The grid failed without intervention. A citywide blackout lasted 6 hours. The darkness was total.',
    severity: 'critical',
  },
};
