/**
 * @fileoverview Collective Directives — Named Presets.
 *
 * Maps the CollectiveFocus values to GDD-described named directives
 * with risk levels and advisor quotes. These presets give the player
 * meaningful choices about how the collective prioritizes work.
 */

import type { CollectiveFocus } from './governor';

// ── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'none' | 'low' | 'medium';

export interface CollectiveDirective {
  name: string;
  description: string;
  focus: CollectiveFocus;
  risk: RiskLevel;
  advisorQuote: string;
}

// ── Directive Presets ────────────────────────────────────────────────────────

export const COLLECTIVE_DIRECTIVES: CollectiveDirective[] = [
  {
    name: 'Balanced Operations',
    description: 'The collective operates normally. Workers self-organize by priority.',
    focus: 'balanced',
    risk: 'none',
    advisorQuote: 'The collective continues as planned, Comrade Chairman.',
  },
  {
    name: 'All Hands to the Harvest',
    description: 'Prioritize food production above all else. Construction slows.',
    focus: 'food',
    risk: 'low',
    advisorQuote: 'The fields need every hand. Construction will wait.',
  },
  {
    name: 'Fulfill the Plan!',
    description: 'Rush construction of mandated buildings. Food production may suffer.',
    focus: 'construction',
    risk: 'medium',
    advisorQuote: 'Moscow demands results. The workers will build day and night.',
  },
  {
    name: 'Maximize Output',
    description: 'Push production quotas. Workers prioritize factories and farms.',
    focus: 'production',
    risk: 'low',
    advisorQuote: 'Every worker to their station. The plan must be exceeded.',
  },
];

// ── Lookup ───────────────────────────────────────────────────────────────────

export function getDirectiveByFocus(focus: CollectiveFocus): CollectiveDirective | undefined {
  return COLLECTIVE_DIRECTIVES.find((d) => d.focus === focus);
}
