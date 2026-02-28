/**
 * @fileoverview The Inspection -- Moscow inspector visits minigame.
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const THE_INSPECTION: MinigameDefinition = {
  id: 'the_inspection',
  name: 'The Inspection',
  description: 'The inspector from Moscow has arrived. He is taking notes. He has a very large notebook.',
  triggerType: 'periodic',
  triggerCondition: 'inspection_180',
  tickLimit: 45,
  choices: [
    {
      id: 'show_honestly',
      label: 'Show Everything Honestly',
      description: 'Transparency is a virtue. Or so you have been told.',
      successChance: 0.5,
      onSuccess: {
        commendations: 1,
        announcement: 'The inspector is impressed by your honesty. This is extremely rare.',
      },
      onFailure: {
        blackMarks: 1,
        announcement: 'The inspector found problems. Your honesty did not help.',
        severity: 'warning',
      },
    },
    {
      id: 'potemkin_village',
      label: 'Potemkin Village',
      description: 'Hide the problems behind fresh paint and smiling workers.',
      successChance: 0.6,
      onSuccess: {
        resources: { money: -20 },
        announcement: 'The inspector saw only what you wanted him to see. The paint is still wet.',
      },
      onFailure: {
        blackMarks: 2,
        resources: { money: -20 },
        announcement: 'The inspector touched the wet paint. He is now very angry and very blue.',
        severity: 'critical',
      },
    },
    {
      id: 'bribe_inspector',
      label: 'Bribe the Inspector',
      description: 'A bottle of good vodka and an envelope of rubles. The traditional method.',
      successChance: 0.75,
      onSuccess: {
        resources: { money: -60, vodka: -5 },
        blat: 1,
        announcement: 'The inspector has written a glowing report. The vodka was excellent.',
      },
      onFailure: {
        blackMarks: 2,
        resources: { money: -60, vodka: -5 },
        announcement: 'The inspector was an honest man. This is the worst possible outcome.',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    blackMarks: 2,
    resources: { money: -30 },
    announcement: 'The inspector found everything. He filled his very large notebook. Twice.',
    severity: 'critical',
  },
};
