/**
 * @fileoverview Ideology Session -- Political loyalty test minigame.
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const IDEOLOGY_SESSION: MinigameDefinition = {
  id: 'ideology_session',
  name: 'Ideology Session',
  description: 'The politruk has arrived. He has questions. The correct answers are the ones he already knows.',
  triggerType: 'event',
  triggerCondition: 'party_official_visit',
  tickLimit: 50,
  choices: [
    {
      id: 'enthusiastic',
      label: 'Enthusiastic Participation',
      description: 'Dedicate the full workday to ideological purity. Production stops.',
      successChance: 0.95,
      onSuccess: {
        commendations: 1,
        announcement: 'Ideology session: all participants passed. The politruk is pleased.',
      },
      onFailure: {
        announcement: 'Despite enthusiasm, one worker quoted Trotsky by accident.',
        severity: 'warning',
      },
    },
    {
      id: 'go_through_motions',
      label: 'Go Through the Motions',
      description: 'Nod at appropriate intervals. Think about lunch.',
      successChance: 0.8,
      onSuccess: {
        announcement: 'Session completed. Nobody learned anything. This was the expected outcome.',
      },
      onFailure: {
        blackMarks: 1,
        announcement: 'The politruk noticed insufficient enthusiasm. A note has been made.',
        severity: 'warning',
      },
    },
    {
      id: 'question_doctrine',
      label: 'Question the Doctrine',
      description: 'Ask the politruk an honest question. This is either brave or foolish.',
      successChance: 0.2,
      onSuccess: {
        commendations: 1,
        announcement: 'Your question impressed the politruk. He calls it "dialectical engagement." You are a hero.',
      },
      onFailure: {
        blackMarks: 2,
        announcement: 'Your question did not impress the politruk. He calls it "counter-revolutionary thought."',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    blackMarks: 1,
    announcement: 'Workers skipped the ideology session. The politruk adds a black mark to your file.',
    severity: 'warning',
  },
};
