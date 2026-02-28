/**
 * @fileoverview Quality Control -- Vodka distillery inspection minigame.
 * Triggered by tapping distillery buildings (vodka-distillery).
 */

import type { MinigameDefinition } from '../MinigameTypes';

export const QUALITY_CONTROL: MinigameDefinition = {
  id: 'quality_control',
  name: 'Quality Control',
  description: 'The latest batch smells like victory. Or possibly turpentine. The distinction is ideological.',
  triggerType: 'building_tap',
  triggerCondition: 'distillery_tap',
  tickLimit: 15,
  choices: [
    {
      id: 'strict_standards',
      label: 'Enforce Strict Standards',
      description: 'Reject substandard batches. Quality over quantity. A radical concept.',
      successChance: 0.8,
      onSuccess: {
        resources: { vodka: 10, money: 15 },
        commendations: 1,
        announcement: 'Premium vodka produced. Even the inspector smiled. This batch could earn an export license.',
      },
      onFailure: {
        resources: { vodka: -5, money: -10 },
        announcement: 'Standards were too strict. Most of the batch was rejected. The drain is well-fed.',
      },
    },
    {
      id: 'look_away',
      label: 'Look the Other Way',
      description: 'Ship everything. What the people do not know cannot hurt them. Officially.',
      successChance: 0.6,
      onSuccess: {
        resources: { vodka: 20, money: 10 },
        announcement: 'All bottles shipped. Nobody complained. The hangover statistics remain classified.',
      },
      onFailure: {
        resources: { vodka: 5, population: -1 },
        blackMarks: 1,
        announcement: 'One citizen was hospitalized. The vodka is now evidence. The health inspector has questions.',
        severity: 'warning',
      },
    },
    {
      id: 'sample_extensively',
      label: 'Sample the Product Extensively',
      description: 'Quality control requires thorough personal testing. For science.',
      successChance: 0.4,
      onSuccess: {
        resources: { vodka: 8 },
        blat: 2,
        announcement: 'Testing complete. The vodka is excellent. You are certain of this, though the room is spinning.',
      },
      onFailure: {
        resources: { vodka: -3 },
        announcement: 'Testing went too far. Three hours lost. The lab notes are illegible. The floor is sticky.',
        severity: 'warning',
      },
    },
  ],
  autoResolve: {
    resources: { vodka: -10 },
    announcement: 'Nobody inspected the batch. It was shipped. The complaints arrived before the bottles did.',
    severity: 'warning',
  },
};
