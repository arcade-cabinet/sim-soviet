import type { EventTemplate } from '../types';

export const POLITICAL_EVENTS: EventTemplate[] = [
  {
    id: 'kgb_inspection',
    title: 'KGB INSPECTION',
    description:
      'All citizens report 100% satisfaction. Dissatisfied citizens not found. KGB reports search was thorough.',
    pravdaHeadline: 'CITIZEN SATISFACTION REACHES UNPRECEDENTED 100%',
    category: 'political',
    severity: 'minor',
    effects: { money: -25, vodka: -5 },
  },
  {
    id: 'party_official_visit',
    title: 'DISTINGUISHED VISITOR',
    description:
      'Party official visits. All potholes have been reclassified as "decorative features." Three stray dogs promoted to honorary citizens to boost population figures.',
    pravdaHeadline: 'OFFICIAL PRAISES CITY\u2019S RUSTIC CHARM',
    category: 'political',
    severity: 'minor',
    effects: { money: -40 },
  },
  {
    id: 'five_year_plan_deadline',
    title: 'FIVE-YEAR PLAN UPDATE',
    description:
      'Five-Year Plan deadline approaching. Comrade, the numbers can be adjusted. They have always been adjustable. The Plan is eternal.',
    pravdaHeadline: 'FIVE-YEAR PLAN ON TRACK (TRACK HAS BEEN SHORTENED)',
    category: 'political',
    severity: 'trivial',
    effects: {},
    eraFilter: ['collectivization', 'industrialization', 'reconstruction', 'thaw_and_freeze', 'stagnation'],
  },
  {
    id: 'agricultural_record',
    title: 'AGRICULTURAL BULLETIN',
    description: (gs) =>
      `Radio announces new agricultural record. Turnip harvest: ${Math.max(3, Math.floor(gs.food / 50))}. Previous record: also ${Math.max(3, Math.floor(gs.food / 50))}. Coincidence.`,
    pravdaHeadline: (gs) =>
      `HARVEST YIELDS ${Math.max(3, Math.floor(gs.food / 50))}00% OF TARGET (TARGET REVISED DOWNWARD)`,
    category: 'political',
    severity: 'trivial',
    effects: { food: 3 },
  },
  {
    id: 'propaganda_contest',
    title: 'POSTER CONTEST',
    description:
      'Propaganda poster contest. Winner receives extra potato ration. Second place: two extra shifts. Third place: a conversation with the KGB.',
    pravdaHeadline: 'ARTISTIC ENTHUSIASM OVERFLOWS AT POSTER COMPETITION',
    category: 'political',
    severity: 'trivial',
    effects: { food: -1 },
  },
  {
    id: 'defection_attempt',
    title: 'BORDER INCIDENT',
    description: (gs) => {
      const lost = Math.min(5, Math.floor(gs.pop * 0.05));
      return `${lost} citizens attempted to reach the West. They have been relocated to a place with no borders. Or walls. Or anything, really.`;
    },
    pravdaHeadline: 'CITIZENS VOLUNTEER FOR REMOTE AGRICULTURAL PROGRAM',
    category: 'political',
    severity: 'major',
    effects: (gs) => ({ pop: -Math.min(5, Math.floor(gs.pop * 0.05)) }),
    condition: (gs) => gs.pop > 10,
    eraFilter: ['thaw_and_freeze', 'stagnation'],
  },
  {
    id: 'name_change',
    title: 'TOPONYMIC REVISION',
    description:
      'The city has been renamed for the 4th time this year. Citizens are issued new stationery. Old stationery to be used as fuel.',
    pravdaHeadline: 'GLORIOUS NEW NAME REFLECTS GLORIOUS NEW ERA',
    category: 'political',
    severity: 'trivial',
    effects: { money: -10 },
  },
  {
    id: 'election_day',
    title: 'ELECTION RESULTS',
    description:
      'Elections held. The approved candidate won with 103% of the vote. The extra 3% attributed to "enthusiasm."',
    pravdaHeadline: 'DEMOCRACY TRIUMPHS: PEOPLE\u2019S CHOICE ELECTED UNANIMOUSLY',
    category: 'political',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'purge_rumor',
    title: 'PERSONNEL OPTIMIZATION',
    description:
      'Rumors of a purge sweep the city. Productivity increases 200%. Citizens voluntarily report their own crimes to save time.',
    pravdaHeadline: 'WORKER PRODUCTIVITY REACHES ALL-TIME HIGH',
    category: 'political',
    severity: 'minor',
    effects: { food: 10, vodka: 5, pop: -1 },
    condition: (gs) => gs.pop > 5,
    eraFilter: ['revolution', 'collectivization', 'industrialization', 'great_patriotic'],
  },
  {
    id: 'bureaucracy_achievement',
    title: 'ADMINISTRATIVE TRIUMPH',
    description:
      'A form was successfully processed in only 11 months. The clerk responsible has been awarded a certificate. The certificate requires 3 forms to process.',
    pravdaHeadline: 'BUREAUCRATIC EFFICIENCY IMPROVES BY 0.003%',
    category: 'political',
    severity: 'trivial',
    effects: { money: -5 },
  },
  // ── Good political events ──
  {
    id: 'hero_award',
    title: 'HERO OF SOVIET LABOR',
    description:
      'Your management has been recognized! You receive the Hero of Soviet Labor medal. It is made of tin. The tin was requisitioned from a hospital. You are asked not to think about this.',
    pravdaHeadline: 'OUTSTANDING DIRECTOR AWARDED HIGHEST HONOR',
    category: 'political',
    severity: 'minor',
    effects: { money: 100 },
    weight: 0.5,
  },
  {
    id: 'propaganda_boost',
    title: 'PROPAGANDA SUCCESS',
    description:
      'State radio broadcasts boost morale. 3 new citizens arrive, apparently attracted by the promise of "adequate concrete." They will learn.',
    pravdaHeadline: 'POPULATION GROWS AS WORD OF PARADISE SPREADS',
    category: 'political',
    severity: 'minor',
    effects: { pop: 3 },
    weight: 0.5,
  },
  {
    id: 'western_spy_caught',
    title: 'COUNTERINTELLIGENCE WIN',
    description:
      'Western spy caught! He was easy to identify: he was smiling and his shoes matched. Confiscated items include: chocolate, optimism.',
    pravdaHeadline: 'KGB VIGILANCE PROTECTS THE MOTHERLAND',
    category: 'political',
    severity: 'trivial',
    effects: { money: 50 },
    weight: 0.5,
  },
];
