import { pick, randInt } from '../helpers';
import type { HeadlineGenerator } from '../types';
import { FAKE_DISCOVERIES, SOVIET_SPORTS } from '../wordPools';

// ── CULTURAL VICTORY generators ──

export const culturalVictoryGenerators: HeadlineGenerator[] = [
  // Pattern: Soviet wins competition
  () => ({
    headline: `SOVIET ${pick(SOVIET_SPORTS).toUpperCase()} TEAM WINS ${pick(['GOLD', 'ALL MEDALS', 'EVERY CATEGORY', 'BY DEFAULT'])} AT ${pick(['INTERNATIONAL', 'WORLD', 'OLYMPIC', 'INTER-BLOC', 'FRIENDLY NATIONS'])} ${pick(['CHAMPIONSHIP', 'TOURNAMENT', 'COMPETITION', 'GAMES'])}`,
    subtext: `Opponents ${pick(['withdrew citing "personal reasons"', 'failed to arrive', 'were disqualified for capitalism', 'conceded after viewing our warm-up', 'got lost en route'])}. A formality.`,
    reality: 'Competition was held in our gymnasium. We were the only team. We still almost lost.',
    category: 'culture',
  }),

  // Pattern: Scientific breakthrough (fake)
  () => ({
    headline: `ACADEMY OF SCIENCES ANNOUNCES ${pick(FAKE_DISCOVERIES)}`,
    subtext: `Western scientists: "impossible." Our scientists: "watch us." (They cannot \u2014 it's classified.)`,
    reality:
      'The discovery was a clerical error. The scientist responsible has been promoted to avoid embarrassment.',
    category: 'culture',
  }),

  // Pattern: Art/cultural event
  () => ({
    headline: `${pick(['PEOPLES ORCHESTRA', 'STATE BALLET', 'YOUTH CHOIR', 'REVOLUTIONARY THEATER COMPANY', 'PROLETARIAN POETRY CIRCLE'])} ACHIEVES ${pick(['STANDING OVATION', 'RECORD ATTENDANCE', 'CRITICAL ACCLAIM', '11-HOUR PERFORMANCE', 'EMOTIONAL BREAKTHROUGH'])}`,
    subtext: `Audience response: ${pick(['weeping', 'cheering', 'standing', 'sitting very still', 'awake'])} (all approved responses).`,
    reality:
      'The performance was 4 hours of patriotic marching music. The seats were removed to prevent sleeping.',
    category: 'culture',
  }),

  // Pattern: Film/book success
  () => ({
    headline: `FILM "${pick(['THE GLORIOUS TRACTOR', 'COMRADE BEAR SAVES THE HARVEST', 'CONCRETE: A LOVE STORY', 'THE QUEUE THAT COULD', 'MY BEAUTIFUL KOLKHOZ', 'SIX HOURS IN THE BOOT FACTORY'])}" WINS ALL ${randInt(3, 17)} AWARDS`,
    subtext: `There were ${randInt(1, 3)} categories. Additional categories created to accommodate film's excellence.`,
    reality: 'Film was mandatory viewing. Audience who slept through it counted as "deeply moved."',
    category: 'culture',
  }),

  // Pattern: Education triumph
  () => ({
    headline: `LITERACY RATE REACHES ${randInt(99, 104)}% FOLLOWING NEW PROGRAM`,
    subtext: `Program: replacing difficult words with easier words. Eventually all words will be "comrade."`,
    reality: 'Literacy measured by ability to read one specific poster. The poster says "WORK."',
    category: 'culture',
  }),

  // Pattern: Soviet art supremacy
  () => ({
    headline: `WESTERN ${pick(['ART', 'MUSIC', 'LITERATURE', 'CINEMA', 'DANCE', 'ARCHITECTURE'])} DECLARED "DECADENT AND DYING" BY MINISTRY OF CULTURE`,
    subtext: `In contrast, Soviet ${pick(['concrete sculptures', 'patriotic ballads', 'productivity reports', 'queue management', 'weather endurance'])} flourish.`,
    reality:
      'Ministry of Culture has one employee. He has seen no Western art. He remains confident.',
    category: 'culture',
  }),
];
