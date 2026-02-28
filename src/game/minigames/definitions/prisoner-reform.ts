/**
 * @fileoverview Prisoner Reform -- Gulag management minigame.
 * Triggered by tapping gulag buildings (gulag-admin).
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const PRISONER_REFORM: MinigameDefinition = {
  id: 'prisoner_reform',
  name: 'Prisoner Reform',
  description: 'The prisoners request better conditions. Through labor, salvation. Through paperwork, madness.',
  triggerType: 'building_tap',
  triggerCondition: 'gulag_tap',
  tickLimit: 50,
  choices: [
    {
      id: 'increase_rations',
      label: 'Increase Rations',
      description: 'Feed them better. Productive prisoners build faster roads.',
      successChance: 0.75,
      onSuccess: {
        resources: { food: -10, money: 25 },
        announcement: 'Prisoner productivity increased 40%. The road to the mine is now paved. With good intentions.',
      },
      onFailure: {
        resources: { food: -10 },
        announcement: 'Prisoners ate better but worked the same. The economics of compassion remain theoretical.',
      },
    },
    {
      id: 'harsh_discipline',
      label: 'Enforce Harsh Discipline',
      description: 'The lash encourages. The cold motivates. Results are guaranteed.',
      successChance: 0.65,
      onSuccess: {
        resources: { money: 30 },
        announcement: "Output increased through discipline. The prisoners' morale is not measured in the reports.",
      },
      onFailure: {
        resources: { population: -2 },
        blackMarks: 1,
        announcement: 'Two prisoners did not survive the new regime. Moscow asks uncomfortable questions.',
        severity: 'critical',
      },
    },
    {
      id: 'amnesty_proposal',
      label: 'Propose Amnesty',
      description: 'Release model prisoners to the workforce. A radical act of faith.',
      successChance: 0.35,
      onSuccess: {
        resources: { population: 3 },
        commendations: 1,
        announcement:
          'Released prisoners integrated as workers. Productivity rose. The Party considers you progressive.',
      },
      onFailure: {
        resources: { population: -1 },
        blackMarks: 1,
        announcement: 'A released prisoner fled. Another caused trouble. The experiment is deemed a failure.',
        severity: 'warning',
      },
    },
  ],
  autoResolve: {
    resources: { population: -1 },
    blackMarks: 1,
    announcement: 'The gulag ran itself. A prisoner died. Nobody filed a report. The silence is noted.',
    severity: 'critical',
  },
};
