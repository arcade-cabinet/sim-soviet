/**
 * @fileoverview Ideological Education -- School curriculum minigame.
 * Triggered by tapping school or cultural buildings (school, cultural-palace, workers-club).
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const IDEOLOGICAL_EDUCATION: MinigameDefinition = {
  id: 'ideological_education',
  name: 'Ideological Education',
  description:
    'The curriculum must be updated. The children are asking questions. Some of these questions have no correct answers.',
  triggerType: 'building_tap',
  triggerCondition: 'school_tap',
  tickLimit: 20,
  choices: [
    {
      id: 'orthodox_curriculum',
      label: 'Strict Party Curriculum',
      description: 'Teach exactly what Moscow prescribes. Creativity is a Western disease.',
      successChance: 0.85,
      onSuccess: {
        commendations: 1,
        announcement:
          'Curriculum approved by the Education Ministry. Students can recite Marx in their sleep. They frequently do.',
      },
      onFailure: {
        announcement:
          'The students passed all exams but learned nothing useful. This is considered acceptable.',
      },
    },
    {
      id: 'practical_skills',
      label: 'Add Practical Skills',
      description: 'Teach them to fix tractors and read blueprints. The factories need workers, not philosophers.',
      successChance: 0.6,
      onSuccess: {
        resources: { money: 15 },
        announcement:
          'Graduates immediately productive in factories. The Party approves of this practical socialism.',
      },
      onFailure: {
        blackMarks: 1,
        announcement:
          'The inspectorate found the curriculum insufficiently ideological. Practical skills are suspect.',
        severity: 'warning',
      },
    },
    {
      id: 'free_thinking',
      label: 'Encourage Free Thinking',
      description: 'Let the children question. Let them wonder. Let them discover. This is either brave or suicidal.',
      successChance: 0.2,
      onSuccess: {
        commendations: 1,
        resources: { money: 20 },
        blat: 1,
        announcement:
          'A student\'s essay impressed a visiting dignitary. Free thinking is temporarily fashionable.',
      },
      onFailure: {
        blackMarks: 2,
        announcement:
          'A student asked why the Party is always right. The teacher had no answer. Neither did you.',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    blackMarks: 1,
    announcement:
      'The school taught nothing for a month. The students learned anyway. This terrifies the authorities.',
    severity: 'warning',
  },
};
