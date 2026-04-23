import { coinFlip, fakePercent, pick, randInt, securityServiceForYear } from '../helpers';
import type { HeadlineGenerator } from '../types';
import {
  ENEMY_SUBJECTS,
  HERO_SUBJECTS,
  INSTITUTIONS,
  PRODUCTION_OBJECTS,
  THREAT_OBJECTS,
  THREAT_REALITIES,
  THREAT_VERBS,
  WESTERN_COUNTRIES,
  WESTERN_NOUNS,
} from '../wordPools';

const PRE_COLD_WAR_ENEMIES = [
  'WHITE GUARD AGENTS',
  'FOREIGN INTERVENTIONISTS',
  'BRITISH INTELLIGENCE',
  'CAPITALIST SABOTEURS',
  'IMPERIALIST AGENTS',
  'BOURGEOIS INFILTRATORS',
  'FOREIGN AGITATORS',
  'REACTIONARY ELEMENTS',
  'TROTSKYIST WRECKERS',
  'COUNTER-REVOLUTIONARY BANDITS',
] as const;

const PRE_COLD_WAR_ADVERSARIES = [
  'AMERICA',
  'BRITAIN',
  'FRANCE',
  'JAPAN',
  'WALL STREET',
  'WASHINGTON',
  'LONDON',
  'FOREIGN INTERVENTIONISTS',
  'WHITE EMIGRES',
  'IMPERIALIST POWERS',
] as const;

const EARLY_INSTITUTIONS = [
  'THE PARTY',
  'THE CENTRAL COMMITTEE',
  'THE PEOPLES COUNCIL',
  'THE REVOLUTIONARY COMMITTEE',
  'THE CHEKA',
  'THE WORKERS SOVIET',
  'THE TRADE UNION',
] as const;

const EARLY_WEAPONS = ['ARMORED TRAIN', 'FIELD GUN', 'TANK', 'ARMORED CAR', 'RADIO SET'] as const;
const INDUSTRIAL_WEAPONS = ['TANK', 'SUBMARINE', 'AIRCRAFT', 'RADAR SYSTEM', 'ARTILLERY SYSTEM'] as const;
const SPACE_AGE_WEAPONS = ['TANK', 'MISSILE', 'SUBMARINE', 'SATELLITE', 'AIRCRAFT', 'RADAR SYSTEM'] as const;

const PRE_UN_VENUES = [
  'TRADE TALKS',
  'ARMS NEGOTIATION',
  'CULTURAL EXCHANGE',
  'CHESS TOURNAMENT',
  'SCIENTIFIC CONFERENCE',
  'RAILWAY CONFERENCE',
] as const;
const POSTWAR_VENUES = [
  'UN SUMMIT',
  'TRADE TALKS',
  'ARMS NEGOTIATION',
  'CULTURAL EXCHANGE',
  'CHESS TOURNAMENT',
  'SCIENTIFIC CONFERENCE',
] as const;
const PRE_COLD_WAR_THREAT_REALITIES = THREAT_REALITIES.filter((reality) => !/\b(CIA|NATO|KGB)\b/.test(reality));
const PRE_COLD_WAR_LURES = [
  'PRIVATE SHOPKEEPING',
  'FOREIGN CURRENCY',
  'A TRAIN TICKET',
  'BLACK-MARKET FLOUR',
  'A WARM APARTMENT',
] as const;
const COLD_WAR_LURES = [
  'BLUE JEANS',
  'CHEWING GUM',
  'ROCK MUSIC',
  'COLOR TELEVISION',
  'BANANA',
  'UNEMPLOYMENT',
] as const;

export function enemySubjectsForYear(year: number): readonly string[] {
  if (year < 1947) return PRE_COLD_WAR_ENEMIES;
  if (year < 1949) return ENEMY_SUBJECTS.filter((subject) => subject !== 'NATO PROVOCATEURS');
  return ENEMY_SUBJECTS;
}

export function adversariesForYear(year: number): readonly string[] {
  if (year < 1949) return PRE_COLD_WAR_ADVERSARIES;
  return WESTERN_COUNTRIES;
}

export { securityServiceForYear } from '../helpers';

export function institutionsForYear(year: number): readonly string[] {
  if (year < 1954) return EARLY_INSTITUTIONS;
  return INSTITUTIONS;
}

function weaponsForYear(year: number): readonly string[] {
  if (year < 1930) return EARLY_WEAPONS;
  if (year < 1957) return INDUSTRIAL_WEAPONS;
  return SPACE_AGE_WEAPONS;
}

function diplomaticVenuesForYear(year: number): readonly string[] {
  if (year < 1945) return PRE_UN_VENUES;
  return POSTWAR_VENUES;
}

function threatRealitiesForYear(year: number): readonly string[] {
  if (year < 1949) return PRE_COLD_WAR_THREAT_REALITIES;
  return THREAT_REALITIES;
}

function defectionLuresForYear(year: number): readonly string[] {
  if (year < 1945) return PRE_COLD_WAR_LURES;
  return COLD_WAR_LURES;
}

// ── EXTERNAL THREAT generators (never real, always propaganda) ──

/** External threat headline generators (fictitious enemies foiled by Soviet heroes). */
export const externalThreatGenerators: HeadlineGenerator[] = [
  // Pattern: ENEMY PLOT foiled by HERO
  (gs) => ({
    headline: `${pick(enemySubjectsForYear(gs.date.year))} ${pick(THREAT_OBJECTS)} ${pick(THREAT_VERBS)} BY ${pick(HERO_SUBJECTS)}`,
    subtext: `${pick(institutionsForYear(gs.date.year))} confirms all ${gs.pop} citizens are safe. Vigilance rewarded.`,
    reality: pick(threatRealitiesForYear(gs.date.year)),
    category: 'threat',
  }),

  // Pattern: WESTERN noun PROVES inferiority
  (gs) => ({
    headline: `${pick(adversariesForYear(gs.date.year))} ${pick(WESTERN_NOUNS)} PROVES INFERIORITY OF CAPITALIST SYSTEM`,
    subtext: `Analysts report: ${pick(adversariesForYear(gs.date.year))} now ${randInt(40, 99)}% worse than last quarter.`,
    reality: 'Analysts have no data. Analysts have no desks. Analysts may not exist.',
    category: 'threat',
  }),

  // Pattern: NUMBER spies arrested
  (gs) => {
    const count = randInt(3, 47);
    return {
      headline: `${count} ${pick(enemySubjectsForYear(gs.date.year))} ARRESTED IN HEROIC STING OPERATION`,
      subtext: `${securityServiceForYear(gs.date.year)} reports ${count} confessions obtained in record time of ${randInt(1, 4)} hours.`,
      reality: `The "spies" were ${count} tourists who asked for directions. Their maps were confiscated as evidence.`,
      category: 'threat',
    };
  },

  // Pattern: WESTERN country COLLAPSES under own FAILURE
  (gs) => ({
    headline: `${pick(adversariesForYear(gs.date.year))} ON BRINK OF COLLAPSE DUE TO ${pick(WESTERN_NOUNS)}`,
    subtext: `Our correspondents report long faces and short bread lines. Wait \u2014 they have bread lines too?`,
    reality: 'Correspondent has never left the building. Reports are based on a 1974 magazine.',
    category: 'threat',
  }),

  // Pattern: IMPERIALIST plot to VERB our NOUN foiled
  (gs) => ({
    headline: `IMPERIALIST PLOT TO UNDERMINE SOVIET ${pick(PRODUCTION_OBJECTS)} ${pick(THREAT_VERBS)}`,
    subtext: `${pick(institutionsForYear(gs.date.year))} assures: the ${pick(PRODUCTION_OBJECTS).toLowerCase()} was never in danger. The plot was in danger.`,
    reality: 'There was no plot. The quota was missed. Someone needed to be blamed.',
    category: 'threat',
  }),

  // Pattern: COUNTRY caught DOING BAD THING near our borders
  (gs) => ({
    headline: `${pick(adversariesForYear(gs.date.year))} CAUGHT CONDUCTING ${pick(THREAT_OBJECTS)} NEAR BORDER`,
    subtext: `Border guards increased to ${randInt(200, 5000)}. Citizens are ${fakePercent()}% safer.`,
    reality: 'A bird flew over the border. It was a suspicious bird. It has been detained.',
    category: 'threat',
  }),

  // Pattern: Western radio interference
  (gs) => ({
    headline:
      gs.date.year < 1930
        ? `${pick(adversariesForYear(gs.date.year))} LEAFLET PROPAGANDA CONFISCATED FOR ${randInt(10, 99)}TH DAY`
        : `${pick(adversariesForYear(gs.date.year))} RADIO PROPAGANDA JAMMED SUCCESSFULLY FOR ${randInt(100, 999)}TH DAY`,
    subtext: 'Citizens report: "We cannot hear the lies." (They also cannot hear the weather forecast.)',
    reality: 'The jamming equipment broke. Radio silence achieved by power outage instead.',
    category: 'threat',
  }),

  // Pattern: Attempted defection prevented
  (gs) => ({
    headline: `${pick(enemySubjectsForYear(gs.date.year))} FAIL TO LURE LOYAL CITIZENS WITH PROMISES OF ${pick(defectionLuresForYear(gs.date.year))}`,
    subtext: `Citizens unanimously declare: "We have everything we need." (Statement written for them.)`,
    reality: 'Seven citizens found near the border "bird watching." Binoculars pointed west.',
    category: 'threat',
  }),

  // Pattern: Diplomatic triumph over enemy
  (gs) => ({
    headline: `SOVIET DELEGATION HUMILIATES ${pick(adversariesForYear(gs.date.year))} AT ${pick(diplomaticVenuesForYear(gs.date.year))}`,
    subtext: `Western delegates seen weeping. Soviet delegate seen smiling (approved smile #3).`,
    reality: 'The Soviet delegation arrived at the wrong building. This was declared a strategic maneuver.',
    category: 'threat',
  }),

  // Pattern: Military superiority claim
  (gs) => ({
    headline: `NEW SOVIET ${pick(weaponsForYear(gs.date.year))} RENDERS ${pick(adversariesForYear(gs.date.year))} DEFENSES OBSOLETE`,
    subtext: `Technical specifications: classified. Performance: classified. Existence: ${coinFlip() ? 'classified' : 'also classified'}.`,
    reality: 'The weapon is a cardboard mockup photographed from a flattering angle.',
    category: 'threat',
  }),
];
