/**
 * @fileoverview Conscription Selection -- Choose workers for military minigame.
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const CONSCRIPTION_SELECTION: MinigameDefinition = {
  id: 'conscription_selection',
  name: 'Conscription Selection',
  description: 'The army needs bodies. Your city has bodies. The math is simple. The choice is not.',
  triggerType: 'event',
  triggerCondition: 'conscription_wave',
  tickLimit: 50,
  choices: [
    {
      id: 'send_volunteers',
      label: 'Send Volunteers',
      description: 'Ask for volunteers. Hope enough step forward.',
      successChance: 0.7,
      onSuccess: {
        resources: { population: -3 },
        announcement: 'Volunteers sent. They went willingly. Mostly.',
      },
      onFailure: {
        resources: { population: -5 },
        announcement: 'Not enough volunteers. The rest were voluntold.',
        severity: 'warning',
      },
    },
    {
      id: 'send_troublemakers',
      label: 'Send the Troublemakers',
      description: 'Send the ones who ask too many questions. Two problems, one solution.',
      successChance: 0.8,
      onSuccess: {
        resources: { population: -2 },
        announcement: 'The troublemakers have been sent to defend the Motherland. Morale improves immediately.',
      },
      onFailure: {
        resources: { population: -2 },
        blackMarks: 1,
        announcement: 'One of the "troublemakers" turned out to be a party official\'s nephew.',
        severity: 'warning',
      },
    },
    {
      id: 'resist_order',
      label: 'Resist the Order',
      description: 'Claim your workers are essential. This requires extraordinary courage.',
      successChance: 0.15,
      onSuccess: {
        commendations: 1,
        announcement: 'Your argument was so compelling that the conscription order was waived. A bureaucratic miracle.',
      },
      onFailure: {
        resources: { population: -5 },
        blackMarks: 2,
        announcement: 'Your resistance has been noted. Extra workers conscripted as punishment.',
        severity: 'critical',
      },
    },
  ],
  autoResolve: {
    resources: { population: -6 },
    blackMarks: 1,
    announcement: 'Random citizens conscripted. Families separated. The army does not send thank-you notes.',
    severity: 'warning',
  },
};
