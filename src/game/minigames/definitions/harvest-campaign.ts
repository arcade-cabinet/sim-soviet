/**
 * @fileoverview Harvest Campaign -- Kolkhoz agricultural minigame.
 * Triggered by tapping farm/agriculture buildings (collective-farm-hq).
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const HARVEST_CAMPAIGN: MinigameDefinition = {
  id: 'harvest_campaign',
  name: 'Harvest Campaign',
  description:
    'The wheat is ripe. The tractors are mostly functional. The weather has opinions. Comrade, the harvest waits for no one.',
  triggerType: 'building_tap',
  triggerCondition: 'farm_tap',
  tickLimit: 25,
  choices: [
    {
      id: 'mobilize_all',
      label: 'Mobilize Everyone',
      description: 'Pull workers from other duties. Every hand in the field.',
      successChance: 0.7,
      onSuccess: {
        resources: { food: 30 },
        commendations: 1,
        announcement:
          'Record harvest! The grain silos overflow. Pravda will mention this on page seven.',
      },
      onFailure: {
        resources: { food: 10, population: -1 },
        announcement:
          'The harvest was adequate but a worker was injured by the thresher. The thresher shows no remorse.',
        severity: 'warning',
      },
    },
    {
      id: 'normal_harvest',
      label: 'Standard Harvest',
      description: 'Proceed by the book. The book was written in 1923.',
      successChance: 0.85,
      onSuccess: {
        resources: { food: 15 },
        announcement:
          'Harvest completed on schedule. Nobody celebrated. Nobody complained. A Soviet ideal.',
      },
      onFailure: {
        resources: { food: 5 },
        announcement:
          'Rain arrived early. Half the crop rotted in the field. The weather bureau denies responsibility.',
      },
    },
    {
      id: 'divert_to_distillery',
      label: 'Divert Grain to Distillery',
      description: 'Bread feeds the body. Vodka feeds the soul. The soul has been very hungry.',
      successChance: 0.5,
      onSuccess: {
        resources: { food: -5, vodka: 20, money: 15 },
        blat: 2,
        announcement:
          'The grain became vodka. The workers are content. The nutritionists are not consulted.',
      },
      onFailure: {
        resources: { food: -10 },
        blackMarks: 1,
        announcement:
          'The diversion was discovered. The food is gone and the vodka is evidence.',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    resources: { food: -15 },
    announcement:
      'Nobody organized the harvest. The grain rotted. The crows ate well. The people did not.',
    severity: 'warning',
  },
};
