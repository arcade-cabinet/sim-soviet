import { fakePercent, pick, randInt } from '../helpers';
import type { HeadlineGenerator } from '../types';
import {
  LEADER_ACHIEVEMENTS,
  LEADER_QUALITIES,
  LEADER_TITLES,
  NATURE_CREDITS,
  WESTERN_COUNTRIES,
} from '../wordPools';

// ── LEADERSHIP PRAISE generators (sycophantic) ──

export const leaderPraiseGenerators: HeadlineGenerator[] = [
  // Pattern: Leader achieves personal feat
  () => ({
    headline: `${pick(LEADER_TITLES)} ${pick(LEADER_ACHIEVEMENTS)}`,
    subtext: `Witnesses confirm: ${pick(LEADER_QUALITIES).toLowerCase()} on full display.`,
    reality: 'Witnesses were not present. Their testimony was prepared in advance.',
    category: 'leader',
  }),

  // Pattern: Leader credited with natural phenomenon
  () => ({
    headline: `${pick(NATURE_CREDITS)}`,
    subtext: `${pick(LEADER_TITLES)} personally approved the weather. Citizens express gratitude.`,
    reality: 'The weather was terrible. The definition of "good weather" was updated.',
    category: 'leader',
  }),

  // Pattern: Leader's birthday/workday celebration
  () => {
    const hours = randInt(16, 23);
    return {
      headline: `${pick(LEADER_TITLES)} COMPLETES ${hours}-HOUR WORKDAY, ASKS FOR MORE`,
      subtext: `Doctors report leader's health at ${fakePercent()}%. Leader reports doctors at ${fakePercent()}%.`,
      reality: `Leader was seen napping at 2pm. The nap was reclassified as "strategic meditation."`,
      category: 'leader',
    };
  },

  // Pattern: Leader's wisdom solves problem
  () => ({
    headline: `${pick(LEADER_TITLES)}'S BRILLIANT ${pick(['SPEECH', 'MEMO', 'FIVE-POINT PLAN', 'DECREE', 'OBSERVATION', 'BREAKFAST REMARK'])} SOLVES ${pick(['HUNGER', 'HOUSING CRISIS', 'ENERGY SHORTAGE', 'MORALE DEFICIT', 'PRODUCTION SLUMP', 'EVERYTHING'])}`,
    subtext: `Solution: ${pick(['work harder', 'believe more', 'complain less', 'build more concrete', 'eat less', 'sleep less'])}. Citizens: "Why didn't we think of that?"`,
    reality: 'The problem was not solved. The problem was reclassified as a feature.',
    category: 'leader',
  }),

  // Pattern: Leader receives impossible honor
  () => {
    const count = randInt(3, 12);
    return {
      headline: `${pick(LEADER_TITLES)} AWARDED ${count} MEDALS IN SINGLE CEREMONY`,
      subtext: `Medal count now exceeds body surface area. Additional medals hung from hat.`,
      reality: `${count - 1} of the medals were previously awarded to other people who no longer need them.`,
      category: 'leader',
    };
  },

  // Pattern: Foreign leaders praise our leader
  () => ({
    headline: `FOREIGN LEADERS EXPRESS ENVY OF ${pick(LEADER_TITLES)}'S ${pick(LEADER_QUALITIES)}`,
    subtext: `${pick(WESTERN_COUNTRIES)} reportedly "in awe." Source: ourselves.`,
    reality: 'No foreign leaders were contacted. The quote was invented over lunch.',
    category: 'leader',
  }),

  // Pattern: Leader's childhood story
  () => ({
    headline: `NEWLY DISCOVERED DOCUMENTS REVEAL ${pick(LEADER_TITLES)} COULD READ AT AGE ${randInt(1, 3)}`,
    subtext: `First words: reportedly "${pick(['"FORWARD"', '"QUOTA"', '"CONCRETE"', '"PRODUCTION"', '"FOR THE PEOPLE"'])}"`,
    reality: 'Documents discovered by an archivist who enjoys continued employment.',
    category: 'leader',
  }),
];
