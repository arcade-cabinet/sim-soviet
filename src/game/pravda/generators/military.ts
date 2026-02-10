import { coinFlip, fakePercent, pick, randInt } from '../helpers';
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

// ── EXTERNAL THREAT generators (never real, always propaganda) ──

export const externalThreatGenerators: HeadlineGenerator[] = [
  // Pattern: ENEMY PLOT foiled by HERO
  (gs) => ({
    headline: `${pick(ENEMY_SUBJECTS)} ${pick(THREAT_OBJECTS)} ${pick(THREAT_VERBS)} BY ${pick(HERO_SUBJECTS)}`,
    subtext: `${pick(INSTITUTIONS)} confirms all ${gs.pop} citizens are safe. Vigilance rewarded.`,
    reality: pick(THREAT_REALITIES),
    category: 'threat',
  }),

  // Pattern: WESTERN noun PROVES inferiority
  () => ({
    headline: `${pick(WESTERN_COUNTRIES)} ${pick(WESTERN_NOUNS)} PROVES INFERIORITY OF CAPITALIST SYSTEM`,
    subtext: `Analysts report: ${pick(WESTERN_COUNTRIES)} now ${randInt(40, 99)}% worse than last quarter.`,
    reality: 'Analysts have no data. Analysts have no desks. Analysts may not exist.',
    category: 'threat',
  }),

  // Pattern: NUMBER spies arrested
  () => {
    const count = randInt(3, 47);
    return {
      headline: `${count} ${pick(ENEMY_SUBJECTS)} ARRESTED IN HEROIC STING OPERATION`,
      subtext: `KGB reports ${count} confessions obtained in record time of ${randInt(1, 4)} hours.`,
      reality: `The "spies" were ${count} tourists who asked for directions. Their maps were confiscated as evidence.`,
      category: 'threat',
    };
  },

  // Pattern: WESTERN country COLLAPSES under own FAILURE
  () => ({
    headline: `${pick(WESTERN_COUNTRIES)} ON BRINK OF COLLAPSE DUE TO ${pick(WESTERN_NOUNS)}`,
    subtext: `Our correspondents report long faces and short bread lines. Wait \u2014 they have bread lines too?`,
    reality: 'Correspondent has never left the building. Reports are based on a 1974 magazine.',
    category: 'threat',
  }),

  // Pattern: IMPERIALIST plot to VERB our NOUN foiled
  () => ({
    headline: `IMPERIALIST PLOT TO UNDERMINE SOVIET ${pick(PRODUCTION_OBJECTS)} ${pick(THREAT_VERBS)}`,
    subtext: `${pick(INSTITUTIONS)} assures: the ${pick(PRODUCTION_OBJECTS).toLowerCase()} was never in danger. The plot was in danger.`,
    reality: 'There was no plot. The quota was missed. Someone needed to be blamed.',
    category: 'threat',
  }),

  // Pattern: COUNTRY caught DOING BAD THING near our borders
  () => ({
    headline: `${pick(WESTERN_COUNTRIES)} CAUGHT CONDUCTING ${pick(THREAT_OBJECTS)} NEAR BORDER`,
    subtext: `Border guards increased to ${randInt(200, 5000)}. Citizens are ${fakePercent()}% safer.`,
    reality: 'A bird flew over the border. It was a suspicious bird. It has been detained.',
    category: 'threat',
  }),

  // Pattern: Western radio interference
  () => ({
    headline: `${pick(WESTERN_COUNTRIES)} RADIO PROPAGANDA JAMMED SUCCESSFULLY FOR ${randInt(100, 999)}TH DAY`,
    subtext:
      'Citizens report: "We cannot hear the lies." (They also cannot hear the weather forecast.)',
    reality: 'The jamming equipment broke. Radio silence achieved by power outage instead.',
    category: 'threat',
  }),

  // Pattern: Attempted defection prevented
  () => ({
    headline: `${pick(ENEMY_SUBJECTS)} FAIL TO LURE LOYAL CITIZENS WITH PROMISES OF ${pick(['BLUE JEANS', 'CHEWING GUM', 'ROCK MUSIC', 'COLOR TELEVISION', 'BANANA', 'UNEMPLOYMENT'])}`,
    subtext: `Citizens unanimously declare: "We have everything we need." (Statement written for them.)`,
    reality: 'Seven citizens found near the border "bird watching." Binoculars pointed west.',
    category: 'threat',
  }),

  // Pattern: Diplomatic triumph over enemy
  () => ({
    headline: `SOVIET DELEGATION HUMILIATES ${pick(WESTERN_COUNTRIES)} AT ${pick(['UN SUMMIT', 'TRADE TALKS', 'ARMS NEGOTIATION', 'CULTURAL EXCHANGE', 'CHESS TOURNAMENT', 'SCIENTIFIC CONFERENCE'])}`,
    subtext: `Western delegates seen weeping. Soviet delegate seen smiling (approved smile #3).`,
    reality:
      'The Soviet delegation arrived at the wrong building. This was declared a strategic maneuver.',
    category: 'threat',
  }),

  // Pattern: Military superiority claim
  () => ({
    headline: `NEW SOVIET ${pick(['TANK', 'MISSILE', 'SUBMARINE', 'SATELLITE', 'AIRCRAFT', 'RADAR SYSTEM'])} RENDERS ${pick(WESTERN_COUNTRIES)} DEFENSES OBSOLETE`,
    subtext: `Technical specifications: classified. Performance: classified. Existence: ${coinFlip() ? 'classified' : 'also classified'}.`,
    reality: 'The weapon is a cardboard mockup photographed from a flattering angle.',
    category: 'threat',
  }),
];
