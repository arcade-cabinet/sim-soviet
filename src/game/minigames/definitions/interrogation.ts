/**
 * @fileoverview Interrogation -- KGB questioning minigame.
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const INTERROGATION: MinigameDefinition = {
  id: 'interrogation',
  name: 'Interrogation',
  description: 'The KGB agent smiles warmly. This is not reassuring.',
  triggerType: 'event',
  triggerCondition: 'kgb_inspection',
  tickLimit: 15,
  choices: [
    {
      id: 'cooperate_fully',
      label: 'Cooperate Fully',
      description: 'Answer every question. Name names if asked. Survive.',
      successChance: 1.0,
      onSuccess: {
        resources: { population: -1 },
        commendations: 1,
        announcement: 'You cooperated. A worker was arrested. The KGB commends your loyalty to the State.',
      },
      onFailure: {
        // successChance is 1.0, so this never fires
        announcement: '',
      },
    },
    {
      id: 'deflect_blame',
      label: 'Deflect Blame',
      description: 'Point fingers elsewhere. If it works, you walk away clean.',
      successChance: 0.45,
      onSuccess: {
        announcement: 'The KGB agent follows your lead. Someone else will have a very bad day.',
      },
      onFailure: {
        blackMarks: 2,
        announcement: 'The KGB saw through your deflection. Two black marks. The agent is no longer smiling.',
        severity: 'critical',
      },
    },
    {
      id: 'refuse_to_answer',
      label: 'Refuse to Answer',
      description: 'Say nothing. Protect your people. Accept the consequences.',
      successChance: 1.0,
      onSuccess: {
        blackMarks: 1,
        announcement: 'You said nothing. The KGB adds a mark to your file. Your workers are grateful, quietly.',
        severity: 'warning',
      },
      onFailure: {
        // successChance is 1.0, so this never fires
        announcement: '',
      },
    },
  ],
  autoResolve: {
    resources: { population: -1 },
    blackMarks: 1,
    announcement: 'Silence was taken as guilt. A confession was extracted. A worker was taken. A mark was added.',
    severity: 'critical',
  },
};
