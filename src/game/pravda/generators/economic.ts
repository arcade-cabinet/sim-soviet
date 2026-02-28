import { bigNumber, fakePercent, pick, randInt } from '../helpers';
import type { HeadlineGenerator } from '../types';
import {
  CULTURAL_OBJECTS,
  GENERIC_REALITIES,
  HERO_SUBJECTS,
  POSITIVE_VERBS,
  PRODUCTION_OBJECTS,
  QUALIFIERS,
  SHORTAGE_EUPHEMISMS,
  TRIUMPH_VERBS,
} from '../wordPools';

// ── INTERNAL TRIUMPH generators (always overstated) ──

export const internalTriumphGenerators: HeadlineGenerator[] = [
  // Pattern: HEROES VERB OBJECT QUALIFIER
  () => ({
    headline: `${pick(HERO_SUBJECTS)} ${pick(TRIUMPH_VERBS)} ${pick(PRODUCTION_OBJECTS)} ${pick(QUALIFIERS)}`,
    subtext: `Achievement rate: ${fakePercent()}%. Previous record: also ${fakePercent()}%.`,
    reality: pick(GENERIC_REALITIES),
    category: 'triumph',
  }),

  // Pattern: Production number brag
  () => ({
    headline: `FACTORY OUTPUT REACHES ${bigNumber()} METRIC TONS ${pick(QUALIFIERS)}`,
    subtext: `Quality of output: not measured. Quantity of measurement: also not measured.`,
    reality: `Output consisted of ${randInt(2, 8)} left boots and a commemorative paperweight.`,
    category: 'production',
  }),

  // Pattern: Satisfaction survey absurdity
  (gs) => {
    const pct = randInt(101, 147);
    return {
      headline: `CITIZEN SATISFACTION SURVEY: ${pct}% APPROVAL RATING`,
      subtext: `The extra ${pct - 100}% attributed to citizens who approved twice out of enthusiasm.`,
      reality: `Survey conducted at gunpoint. Sample size: ${Math.max(1, Math.floor(gs.pop / 10))}. Margin of error: irrelevant.`,
      category: 'triumph',
    };
  },

  // Pattern: Record broken that shouldn't be a record
  () => ({
    headline: `NEW RECORD: ${randInt(47, 999)} CONSECUTIVE DAYS WITHOUT ${pick(['COMPLAINT', 'DEFECTION', 'UNSANCTIONED OPINION', 'UNAUTHORIZED SMILE', 'DEVIATION FROM PLAN', 'INDEPENDENT THOUGHT'])}`,
    subtext: `Previous record: ${randInt(2, 10)} days. Improvement methodology: classified.`,
    reality: 'Complaints office relocated to an address that does not exist.',
    category: 'triumph',
  }),

  // Pattern: Impossible infrastructure claim
  () => ({
    headline: `${randInt(10, 500)} NEW ${pick(['TENEMENTS', 'FACTORIES', 'SCHOOLS', 'HOSPITALS', 'MONUMENTS', 'CONCRETE STRUCTURES'])} COMPLETED THIS MONTH`,
    subtext: `Each one a masterpiece of Soviet architecture (i.e., rectangular and grey).`,
    reality:
      'One building was completed. It has no plumbing. The plumbing is in a different building that has no walls.',
    category: 'production',
  }),

  // Pattern: POP citizens celebrate THING
  (gs) => ({
    headline: `ALL ${gs.pop} CITIZENS ${pick(POSITIVE_VERBS)} ${pick(CULTURAL_OBJECTS)}`,
    subtext: `Celebration was ${pick(['spontaneous', 'mandatory', 'spontaneously mandatory', 'mandatorily spontaneous'])}.`,
    reality: 'Attendance verified by headcount. Non-attendees counted as "attending in spirit."',
    category: 'triumph',
  }),

  // Pattern: Productivity miracle
  () => {
    const multiplier = randInt(3, 50);
    return {
      headline: `WORKER PRODUCTIVITY UP ${multiplier}00% SINCE LAST ${pick(['TUESDAY', 'PURGE', 'QUOTA REVISION', 'LEADERSHIP SPEECH', 'ANTHEM BROADCAST'])}`,
      subtext: `Methodology: counting faster.`,
      reality: `Productivity measured in "units of progress." Nobody knows what a unit of progress is, including the inventor of the unit.`,
      category: 'production',
    };
  },

  // Pattern: Five-year plan success
  () => ({
    headline: `FIVE-YEAR PLAN COMPLETED IN ${randInt(3, 4)} YEARS ${randInt(7, 11)} MONTHS`,
    subtext: `Remaining ${randInt(1, 14)} months to be used for celebration and re-planning.`,
    reality: `The plan was shortened to match actual completion date. This is the 4th time.`,
    category: 'triumph',
  }),

  // Pattern: Election results
  () => {
    const pct = randInt(97, 103);
    return {
      headline: `ELECTIONS HELD: APPROVED CANDIDATE WINS WITH ${pct}% OF VOTE`,
      subtext:
        pct > 100
          ? `The extra ${pct - 100}% attributed to "revolutionary enthusiasm."`
          : `The missing ${100 - pct}% under investigation.`,
      reality:
        'Ballot had one name. Instructions said "mark X for yes." There was no option for no.',
      category: 'editorial',
    };
  },
];

// ── RESOURCE SPIN generators (react to game state) ──

export const resourceSpinGenerators: HeadlineGenerator[] = [
  // Food shortage spin
  (gs) => ({
    headline: pick(SHORTAGE_EUPHEMISMS.food),
    subtext: `Current food reserves (${Math.round(gs.food)} units) represent a ${pick(['strategic minimum', 'calculated sufficiency', 'planned threshold', 'optimal level'])} per Ministry guidelines.`,
    reality: `Food reserves at ${Math.round(gs.food)}. Citizens are eating wallpaper paste. The wallpaper is also running out.`,
    category: 'spin',
  }),

  // Money shortage spin
  (gs) => ({
    headline: pick(SHORTAGE_EUPHEMISMS.money),
    subtext: `The treasury's ${Math.round(gs.money)} rubles prove that less is more. More is also more. Everything is more.`,
    reality: `Treasury contains ${Math.round(gs.money)} rubles and an IOU from 1963.`,
    category: 'spin',
  }),

  // Vodka shortage spin
  (gs) => ({
    headline: pick(SHORTAGE_EUPHEMISMS.vodka),
    subtext: `Current reserves of ${Math.round(gs.vodka)} units are ${pick(['"adequate"', '"sufficient"', '"more than enough"', '"not a crisis"'])}, says spokesperson.`,
    reality: `Vodka at ${Math.round(gs.vodka)}. Workers have begun distilling boot polish. Morale: complicated.`,
    category: 'spin',
  }),

  // Power shortage spin
  (gs) => ({
    headline: pick(SHORTAGE_EUPHEMISMS.power),
    subtext: `Power usage: ${gs.powerUsed}MW of ${gs.power}MW. The ${Math.max(0, gs.power - gs.powerUsed)}MW surplus proves abundance.`,
    reality: `Surplus power is theoretical. The surplus is being used to calculate the surplus.`,
    category: 'spin',
  }),

  // Population decline spin
  (gs) => ({
    headline: pick(SHORTAGE_EUPHEMISMS.pop),
    subtext: `Current population of ${gs.pop} is the ${pick(['ideal', 'optimal', 'scientifically perfect', 'historically justified', 'committee-approved'])} number.`,
    reality: `Population was ${gs.pop + randInt(5, 30)} last month. Nobody is asking where they went.`,
    category: 'spin',
  }),

  // Building count spin
  (gs) => {
    const count = gs.buildings.length;
    return {
      headline: `URBAN DEVELOPMENT INDEX: ${count} STRUCTURES AND GROWING`,
      subtext: `Each one a testament to Soviet engineering (rectangular, grey, standing... mostly).`,
      reality: `${count} buildings. ${randInt(0, Math.max(1, Math.floor(count / 3)))} have functional plumbing. The rest have "character."`,
      category: 'production',
    };
  },

  // Quota spin
  (gs) => {
    const pct = gs.quota.target > 0 ? Math.floor((gs.quota.current / gs.quota.target) * 100) : 0;
    return {
      headline: `FIVE-YEAR PLAN ${pct >= 100 ? 'EXCEEDED' : 'ON TRACK'}: ${gs.quota.type.toUpperCase()} AT ${pct}% OF TARGET`,
      subtext:
        pct >= 100
          ? 'Overachievement attributed to party guidance and creative mathematics.'
          : `Remaining ${100 - pct}% to be completed in a burst of revolutionary energy.`,
      reality:
        pct >= 100
          ? 'Target was quietly reduced last Thursday.'
          : `At current rate, plan will be completed ${randInt(2, 7)} years late. Calendar will be adjusted.`,
      category: 'production',
    };
  },
];
