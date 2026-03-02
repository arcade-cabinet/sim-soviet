/**
 * @fileoverview Mining Expedition -- Mountain resource extraction minigame.
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const MINING_EXPEDITION: MinigameDefinition = {
  id: 'mining_expedition',
  name: 'Mining Expedition',
  description: 'The mountain holds iron and stone. It also holds grudges.',
  triggerType: 'building_tap',
  triggerCondition: 'mountain',
  tickLimit: 75,
  choices: [
    {
      id: 'surface_mining',
      label: 'Surface Mining',
      description: 'Shallow quarrying. Safe. The ore is thin but reliable.',
      successChance: 0.85,
      onSuccess: {
        resources: { money: 15 },
        announcement: 'Surface quarry yields modest stone and iron. The mountain permits it.',
      },
      onFailure: {
        resources: { money: 3 },
        announcement: 'Rock face crumbled. Tools damaged. The geologist shrugs.',
      },
    },
    {
      id: 'deep_shaft',
      label: 'Dig Deep Shaft',
      description: 'Rich veins lie below. So do cave-ins.',
      successChance: 0.5,
      onSuccess: {
        resources: { money: 40 },
        announcement: 'Deep shaft strikes iron ore vein. The plan approves of your initiative.',
      },
      onFailure: {
        resources: { money: -5, population: -1 },
        announcement: 'Shaft collapse. One miner did not emerge. The mountain keeps what it takes.',
        severity: 'warning',
      },
    },
    {
      id: 'dynamite_blast',
      label: 'Use Dynamite',
      description: 'Requisitioned from military stocks. Effective but conspicuous.',
      successChance: 0.4,
      onSuccess: {
        resources: { money: 60 },
        blat: 1,
        announcement: 'Controlled blast reveals a rich deposit. The military does not ask where the dynamite went.',
      },
      onFailure: {
        resources: { population: -2 },
        blackMarks: 1,
        announcement:
          'Uncontrolled blast. Two workers buried. Military auditors are asking questions about missing explosives.',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    resources: { money: -2 },
    announcement: 'Nobody ventured into the mountains. The iron remains theoretical. The plan remains unfulfilled.',
  },
};
