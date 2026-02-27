/**
 * Directives array with check functions.
 * Faithful port of poc.html lines 373-390.
 */

import { GRID_SIZE } from './GridTypes';
import { gameState } from './GameState';

export interface Directive {
  text: string;
  target: number;
  reward: number;
  check: () => boolean;
}

/** Count cells where zone matches or type matches the given value. */
export function countZoneOrBldg(typeOrZone: string): number {
  return gameState.grid
    .flat()
    .filter((c) => c.zone === typeOrZone || c.type === typeOrZone).length;
}

export const DIRECTIVES: Directive[] = [
  {
    text: 'Zoning: Zone 4 Residential blocks.',
    target: 4,
    reward: 150,
    check: () => countZoneOrBldg('res') >= 4,
  },
  {
    text: 'Utilities: Build Water Pump (on river).',
    target: 1,
    reward: 150,
    check: () => countZoneOrBldg('pump') >= 1,
  },
  {
    text: 'Infrastructure: Connect zones with Pipes.',
    target: 1,
    reward: 100,
    check: () => gameState.waterUsed > 0,
  },
  {
    text: 'Utilities: Build Coal Plant.',
    target: 1,
    reward: 300,
    check: () => countZoneOrBldg('power') >= 1,
  },
  {
    text: 'Industry: Zone 2 Industrial blocks.',
    target: 2,
    reward: 200,
    check: () => countZoneOrBldg('ind') >= 2,
  },
  {
    text: 'Agriculture: Zone 2 Farm blocks.',
    target: 2,
    reward: 150,
    check: () => countZoneOrBldg('farm') >= 2,
  },
  {
    text: 'Logistics: Build 3 Roads.',
    target: 3,
    reward: 50,
    check: () => countZoneOrBldg('road') >= 3,
  },
  {
    text: 'Ensure Loyalty: Build a Gulag.',
    target: 1,
    reward: 200,
    check: () => countZoneOrBldg('gulag') >= 1,
  },
  {
    text: 'Expand the State: Reach 100 Population.',
    target: 100,
    reward: 500,
    check: () => gameState.pop >= 100,
  },
  {
    text: 'Clean Energy: Build a Reactor.',
    target: 1,
    reward: 800,
    check: () => countZoneOrBldg('nuke') >= 1,
  },
  {
    text: 'Conquer the Stars: Build the Cosmodrome.',
    target: 1,
    reward: 1000,
    check: () => countZoneOrBldg('space') >= 1,
  },
  {
    text: 'Awaiting Further Orders...',
    target: 1,
    reward: 0,
    check: () => false,
  },
];
