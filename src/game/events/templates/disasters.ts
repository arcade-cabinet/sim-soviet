import type { EventTemplate } from '../types';

export const DISASTER_EVENTS: EventTemplate[] = [
  {
    id: 'earthquake_bread',
    title: 'SEISMIC EVENT IN SECTOR 4',
    description: 'An earthquake destroyed the bread line. Citizens report no change in bread availability.',
    pravdaHeadline: 'GEOLOGICAL ACTIVITY PROVES STRENGTH OF SOVIET FOUNDATION',
    category: 'disaster',
    severity: 'major',
    effects: { food: -15 },
  },
  {
    id: 'cultural_palace_fire',
    title: 'CULTURAL PALACE ABLAZE',
    description:
      'Fire at the Cultural Palace. The mandatory attendance requirement has been temporarily lifted. Citizens unsure how to feel \u2014 attendance at feelings has also been suspended.',
    pravdaHeadline: 'HEROIC FIRE CLEANSES PALACE OF BOURGEOIS DECOR',
    category: 'disaster',
    severity: 'minor',
    effects: { money: -50 },
  },
  {
    id: 'power_station_explosion',
    title: 'POWER STATION INCIDENT',
    description:
      'The power station exploded. Workers praised for exceeding their destruction quota ahead of schedule. Remaining workers offered commemorative hard hats.',
    pravdaHeadline: 'WORKERS ACHIEVE 500% OF ENERGY RELEASE TARGET',
    category: 'disaster',
    severity: 'catastrophic',
    effects: { power: -30, money: -100 },
    condition: (gs) => gs.power > 0,
  },
  {
    id: 'blizzard_burial',
    title: 'BLIZZARD ADVISORY',
    description:
      'Blizzard buried 3 buildings. Citizens too cold to notice. In related news, citizens too cold to report being too cold.',
    pravdaHeadline: 'RECORD SNOWFALL: NATURE INSULATES BUILDINGS FOR FREE',
    category: 'disaster',
    severity: 'major',
    effects: { food: -10, vodka: -5 },
  },
  {
    id: 'chemical_leak',
    title: 'ROUTINE CHEMICAL EMISSION',
    description:
      'Chemical leak from the factory. Water reportedly tastes the same. Several fish found walking on land. Scientists called it "evolution."',
    pravdaHeadline: 'FACTORY ENRICHES LOCAL WATER SUPPLY WITH MINERALS',
    category: 'disaster',
    severity: 'minor',
    effects: { pop: -2 },
    condition: (gs) => gs.pop > 10,
  },
  {
    id: 'sinkhole',
    title: 'GEOLOGICAL OPPORTUNITY',
    description: 'A sinkhole swallowed the town square. On the bright side, the pothole complaints have stopped.',
    pravdaHeadline: 'NEW UNDERGROUND PARK OPENS SPONTANEOUSLY',
    category: 'disaster',
    severity: 'minor',
    effects: { money: -30 },
  },
  {
    id: 'roof_collapse',
    title: 'STRUCTURAL RECLASSIFICATION',
    description: 'Tenement roof collapsed. Building reclassified from "housing" to "open-air housing." Rent unchanged.',
    pravdaHeadline: 'INNOVATIVE SKYLIGHT DESIGN IMPROVES WORKER MORALE',
    category: 'disaster',
    severity: 'major',
    effects: { pop: -3 },
    condition: (gs) => gs.pop > 5,
  },
  {
    id: 'pipe_burst',
    title: 'PLUMBING LIBERATION',
    description:
      'Main water pipe burst. The frozen pipe pieces have been repurposed as modern art. Citizens now appreciate both the art and the dehydration.',
    pravdaHeadline: 'PUBLIC FOUNTAIN OPENS AHEAD OF SCHEDULE',
    category: 'disaster',
    severity: 'minor',
    effects: { money: -20 },
  },
  {
    id: 'rat_invasion',
    title: 'FAUNA REDISTRIBUTION',
    description: (gs) =>
      `Rat population has exceeded human population. At ${gs.pop} citizens vs. an estimated ${gs.pop * 3} rats, the rats have formed a workers\u2019 council.`,
    pravdaHeadline: 'LOCAL WILDLIFE THRIVES UNDER SOCIALIST MANAGEMENT',
    category: 'disaster',
    severity: 'minor',
    effects: { food: -20 },
    condition: (gs) => gs.food > 20,
  },
  {
    id: 'factory_collapse',
    title: 'INDUSTRIAL COMPACTION',
    description:
      'Factory collapsed into itself. Engineers say it was "always meant to be one story." The one story is: everything is fine.',
    pravdaHeadline: 'FACTORY ACHIEVES MAXIMUM SPACE EFFICIENCY',
    category: 'disaster',
    severity: 'major',
    effects: { money: -80, food: -10 },
    condition: (gs) => gs.buildings.length > 3,
  },
];
