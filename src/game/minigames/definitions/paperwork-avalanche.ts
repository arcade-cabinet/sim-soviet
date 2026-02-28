/**
 * @fileoverview Paperwork Avalanche -- Ministry bureaucracy minigame.
 * Triggered by tapping government buildings (ministry-office, government-hq, kgb-office).
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const PAPERWORK_AVALANCHE: MinigameDefinition = {
  id: 'paperwork_avalanche',
  name: 'Paperwork Avalanche',
  description: 'Form 27-B/6 requires Form 14-A/3 which requires Form 27-B/6. The bureaucracy is a perfect circle.',
  triggerType: 'building_tap',
  triggerCondition: 'ministry_tap',
  tickLimit: 20,
  choices: [
    {
      id: 'process_diligently',
      label: 'Process Everything',
      description: 'Fill out every form. In triplicate. With the correct shade of ink.',
      successChance: 0.7,
      onSuccess: {
        resources: { money: 20 },
        commendations: 1,
        announcement: 'All paperwork processed. Moscow is satisfied. Your hand will recover in a week.',
      },
      onFailure: {
        resources: { money: -10 },
        announcement: 'A form was filed in the wrong order. The entire stack must be redone. Starting now.',
        severity: 'warning',
      },
    },
    {
      id: 'rubber_stamp',
      label: 'Rubber Stamp Everything',
      description: 'Approve without reading. Speed is a form of loyalty.',
      successChance: 0.5,
      onSuccess: {
        resources: { money: 10 },
        blat: 1,
        announcement: "All requests approved. Everyone is happy. The consequences are someone else's problem.",
      },
      onFailure: {
        blackMarks: 2,
        announcement:
          'You accidentally approved a transfer of the city treasury to a fictional district. The auditors noticed.',
        severity: 'critical',
      },
    },
    {
      id: 'lose_the_papers',
      label: 'Lose the Papers',
      description: 'An unfortunate fire in the filing cabinet. Very unfortunate. Very convenient.',
      successChance: 0.4,
      onSuccess: {
        blat: 2,
        announcement: 'The papers are lost. The problems they contained are also lost. Temporarily.',
      },
      onFailure: {
        blackMarks: 1,
        resources: { money: -15 },
        announcement: 'The filing cabinet fire spread to the desk. The backup copies survived. Of course they did.',
        severity: 'warning',
      },
    },
  ],
  autoResolve: {
    blackMarks: 1,
    resources: { money: -20 },
    announcement: 'Paperwork ignored. Deadlines missed. Moscow sent a telegram. It was not congratulatory.',
    severity: 'warning',
  },
};
