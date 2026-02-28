import type { EventTemplate } from '../types';

export const CULTURAL_EVENTS: EventTemplate[] = [
  {
    id: 'mandatory_parade',
    title: 'MANDATORY PARADE DAY',
    description:
      'Mandatory parade day. Enthusiasm levels: compulsory. Flags have been distributed. Smiles have been distributed. Deviation from distributed smile will be noted.',
    pravdaHeadline: 'SPONTANEOUS CELEBRATION ERUPTS ACROSS THE CITY',
    category: 'cultural',
    severity: 'trivial',
    effects: { money: -10, vodka: -3 },
  },
  {
    id: 'lenin_statue',
    title: 'STATUE DEDICATION',
    description:
      'New Lenin statue dedicated. Old Lenin statue promoted to Senior Lenin Statue. Both point in different directions. Citizens unsure which way to go. This is by design.',
    pravdaHeadline: 'GLORIOUS NEW MONUMENT INSPIRES WORKERS',
    category: 'cultural',
    severity: 'trivial',
    effects: { money: -35 },
  },
  {
    id: 'anthem_repeat',
    title: 'RADIO BULLETIN',
    description:
      'State radio plays the anthem for the 47th time today. Citizens hum along involuntarily. Several report the tune playing in their dreams. This is considered a success.',
    pravdaHeadline: 'BELOVED ANTHEM ENJOYS RECORD AIRPLAY',
    category: 'cultural',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'vanya_birthday',
    title: 'BIRTHDAY NOTICE',
    description:
      'Comrade Vanya\u2019s birthday. The State acknowledges his continued existence. A cake was requisitioned. The cake did not arrive. Vanya\u2019s existence continues regardless.',
    pravdaHeadline: 'STATE CELEBRATES LOYAL CITIZEN\u2019S MILESTONE',
    category: 'cultural',
    severity: 'trivial',
    effects: { food: -2 },
  },
  {
    id: 'theater_production',
    title: 'CULTURAL ACHIEVEMENT',
    description:
      'The People\u2019s Theater presents "The Tractor That Could." 4-hour runtime. Standing ovation (the seats were confiscated). Critics rate it: mandatory.',
    pravdaHeadline: 'THEATRICAL MASTERPIECE MOVES AUDIENCES TO THEIR FEET',
    category: 'cultural',
    severity: 'trivial',
    effects: { money: -5 },
  },
  {
    id: 'chess_tournament',
    title: 'INTELLECTUAL COMPETITION',
    description:
      'City chess tournament. Winner plays against the State. The State always wins. The board is rigged. The pieces know it. They do not complain.',
    pravdaHeadline: 'SOVIET CHESS MASTERY DEMONSTRATED ONCE AGAIN',
    category: 'cultural',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'poetry_reading',
    title: 'LITERARY EVENT',
    description:
      'Mandatory poetry reading. Poem: "Ode to Concrete." 47 stanzas. Each stanza: "Concrete." Audience weeps. It is unclear why.',
    pravdaHeadline: 'PROLETARIAN LITERATURE REACHES NEW HEIGHTS',
    category: 'cultural',
    severity: 'trivial',
    effects: { vodka: -2 },
  },
  {
    id: 'museum_opening',
    title: 'MUSEUM OF ACHIEVEMENTS',
    description:
      'Museum of Soviet Achievements opens. Exhibits include: a potato, a photograph of a different potato, and a painting of the first potato by the second potato.',
    pravdaHeadline: 'WORLD-CLASS MUSEUM SHOWCASES NATIONAL TREASURES',
    category: 'cultural',
    severity: 'trivial',
    effects: { money: -20 },
  },
  {
    id: 'dance_competition',
    title: 'RECREATIONAL NOTICE',
    description:
      'State-approved dance competition. Approved moves: 1. The Shuffle of Compliance. 2. The Nod of Agreement. 3. Standing Still (advanced). Winner: everyone, equally.',
    pravdaHeadline: 'CITIZENS CELEBRATE WITH APPROVED PHYSICAL EXPRESSION',
    category: 'cultural',
    severity: 'trivial',
    effects: { vodka: -2 },
  },
];
