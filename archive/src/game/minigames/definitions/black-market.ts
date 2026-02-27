/**
 * @fileoverview Black Market -- Underground trading minigame.
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const BLACK_MARKET: MinigameDefinition = {
  id: 'black_market',
  name: 'Black Market',
  description:
    'A man in a long coat approaches. He has goods. You have needs. The State has opinions about both.',
  triggerType: 'building_tap',
  triggerCondition: 'market',
  tickLimit: 15,
  choices: [
    {
      id: 'trade_cautiously',
      label: 'Trade Cautiously',
      description: 'Small quantities. Plausible deniability.',
      successChance: 0.85,
      onSuccess: {
        resources: { food: 10, money: -15 },
        blat: 1,
        announcement: 'A small but profitable exchange. Nobody noticed.',
      },
      onFailure: {
        resources: { money: -15 },
        announcement: 'The goods were confiscated at a checkpoint. Money lost.',
        severity: 'warning',
      },
    },
    {
      id: 'trade_aggressively',
      label: 'Trade Aggressively',
      description: 'Large shipment. Large profit. Large risk.',
      successChance: 0.4,
      onSuccess: {
        resources: { food: 30, vodka: 10, money: -40 },
        blat: 3,
        announcement:
          'A windfall of goods arrives under cover of darkness. The people eat well tonight.',
      },
      onFailure: {
        resources: { money: -40 },
        blackMarks: 2,
        announcement: 'KGB raid. The entire shipment seized. Your name is in a new file.',
        severity: 'critical',
      },
    },
    {
      id: 'report_market',
      label: 'Report the Market',
      description: 'Inform the authorities. Earn a commendation. Lose a connection forever.',
      successChance: 1.0,
      onSuccess: {
        commendations: 1,
        blat: -3,
        announcement:
          'You reported the black market. The KGB is pleased. Your former contacts are not.',
      },
      onFailure: {
        // successChance is 1.0, so this never fires
        announcement: '',
      },
    },
  ],
  autoResolve: {
    announcement: 'The man in the long coat left. The opportunity vanished like warmth in January.',
  },
};
