/**
 * @fileoverview Military Inspection -- Barracks readiness minigame.
 * Triggered by tapping military buildings (barracks, guard-post).
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const MILITARY_INSPECTION: MinigameDefinition = {
  id: 'military_inspection',
  name: 'Military Inspection',
  description:
    'The garrison commander is conducting a readiness inspection. The boots are polished. The rifles are oiled. The truth is flexible.',
  triggerType: 'building_tap',
  triggerCondition: 'barracks_tap',
  tickLimit: 15,
  choices: [
    {
      id: 'parade_formation',
      label: 'Full Parade Formation',
      description: 'Line everyone up. Shine everything. Impress through presentation.',
      successChance: 0.75,
      onSuccess: {
        commendations: 1,
        resources: { money: -10 },
        announcement:
          'The commander was impressed. The parade was magnificent. The fact that nobody can shoot straight is irrelevant.',
      },
      onFailure: {
        resources: { money: -10 },
        blackMarks: 1,
        announcement:
          'A soldier fainted during inspection. The commander was not impressed. Heat stroke is no excuse.',
        severity: 'warning',
      },
    },
    {
      id: 'combat_readiness',
      label: 'Demonstrate Combat Readiness',
      description: 'Live-fire exercise. Real ammunition. Real consequences.',
      successChance: 0.5,
      onSuccess: {
        commendations: 1,
        resources: { money: 15 },
        announcement:
          'Combat exercise successful. All targets destroyed. No friendly casualties. A genuine miracle.',
      },
      onFailure: {
        resources: { population: -1, money: -20 },
        announcement:
          'The exercise did not go to plan. One soldier forgot which end of the rifle to point away.',
        severity: 'warning',
      },
    },
    {
      id: 'bribe_commander',
      label: 'Bribe the Commander',
      description: 'Good vodka and a hunting rifle. The traditional military-civilian exchange.',
      successChance: 0.65,
      onSuccess: {
        resources: { vodka: -5, money: -15 },
        blat: 2,
        announcement:
          'The commander wrote a glowing report. He also took the hunting rifle. Everyone wins.',
      },
      onFailure: {
        blackMarks: 2,
        resources: { vodka: -5, money: -15 },
        announcement:
          'The commander reported the bribe attempt. He kept the vodka as evidence.',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    blackMarks: 1,
    resources: { money: -10 },
    announcement:
      'Nobody prepared for the inspection. The commander found dust on the rifles and despair in the barracks.',
    severity: 'warning',
  },
};
