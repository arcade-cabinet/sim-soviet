import { getResourceEntity } from '@/ecs/archetypes';
import type { GameState } from './GameState';
import type { GameRng } from './SeedSystem';

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

export type EventSeverity = 'trivial' | 'minor' | 'major' | 'catastrophic';

export type EventCategory = 'disaster' | 'political' | 'economic' | 'cultural' | 'absurdist';

export interface ResourceDelta {
  money?: number;
  food?: number;
  vodka?: number;
  pop?: number;
  power?: number;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  pravdaHeadline: string;
  category: EventCategory;
  severity: EventSeverity;
  effects: ResourceDelta;
  /** Maps to category bucket for UI color */
  type: 'good' | 'bad' | 'neutral';
}

/** Template that can reference current state for dynamic text */
interface EventTemplate {
  id: string;
  title: string;
  description: string | ((gs: GameState) => string);
  pravdaHeadline: string | ((gs: GameState) => string);
  category: EventCategory;
  severity: EventSeverity;
  effects: ResourceDelta | ((gs: GameState) => ResourceDelta);
  /** Only fires when predicate is true */
  condition?: (gs: GameState) => boolean;
  /** Weight for random selection (default 1) */
  weight?: number;
}

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

/** Module-level RNG reference, set by EventSystem constructor */
let _rng: GameRng | null = null;

function pick<T>(arr: T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}

// ─────────────────────────────────────────────────────────
//  THE EVENTS  --  organized by category
// ─────────────────────────────────────────────────────────

const DISASTER_EVENTS: EventTemplate[] = [
  {
    id: 'earthquake_bread',
    title: 'SEISMIC EVENT IN SECTOR 4',
    description:
      'An earthquake destroyed the bread line. Citizens report no change in bread availability.',
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
    description:
      'A sinkhole swallowed the town square. On the bright side, the pothole complaints have stopped.',
    pravdaHeadline: 'NEW UNDERGROUND PARK OPENS SPONTANEOUSLY',
    category: 'disaster',
    severity: 'minor',
    effects: { money: -30 },
  },
  {
    id: 'roof_collapse',
    title: 'STRUCTURAL RECLASSIFICATION',
    description:
      'Tenement roof collapsed. Building reclassified from "housing" to "open-air housing." Rent unchanged.',
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

const POLITICAL_EVENTS: EventTemplate[] = [
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
];

const ECONOMIC_EVENTS: EventTemplate[] = [
  {
    id: 'black_market',
    title: 'BLACK MARKET RAID',
    description: (gs) => {
      const arrested = Math.min(2, gs.pop);
      return `Black market discovered! ${arrested} citizens arrested. ${Math.max(0, gs.pop - arrested)} citizens pretend to be shocked. Confiscated goods: 1 pair of jeans, 3 Beatles records, a suspicious amount of happiness.`;
    },
    pravdaHeadline: 'CAPITALIST CORRUPTION ROOTED OUT; SOCIALIST PURITY RESTORED',
    category: 'economic',
    severity: 'minor',
    effects: { money: 30, food: -5, vodka: -3 },
    condition: (gs) => gs.pop > 5,
  },
  {
    id: 'currency_reform',
    title: 'MONETARY RESTRUCTURING',
    description:
      'Currency reform: old rubles worthless. New rubles also worthless, but officially. The exchange rate is 1:1 despair.',
    pravdaHeadline: 'NEW STRONGER RUBLE REFLECTS STRONGER ECONOMY',
    category: 'economic',
    severity: 'major',
    effects: (gs) => ({ money: -Math.floor(gs.money * 0.15) }),
    condition: (gs) => gs.money > 100,
  },
  {
    id: 'factory_output_report',
    title: 'PRODUCTION REPORT',
    description:
      'Factory output doubled on paper. Actual output: unchanged. Paper output: also doubled. We are now the world\u2019s leading producer of reports about production.',
    pravdaHeadline: 'INDUSTRIAL OUTPUT DOUBLES FOR 17TH CONSECUTIVE QUARTER',
    category: 'economic',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'bread_queue',
    title: 'BREAD LINE UPDATE',
    description:
      'Bread shortage. Citizens form orderly queue. Queue forms its own queue. Second queue achieves class consciousness and demands representation.',
    pravdaHeadline: 'CITIZENS ENJOY SOCIAL GATHERING AT DISTRIBUTION CENTER',
    category: 'economic',
    severity: 'minor',
    effects: { food: -15 },
  },
  {
    id: 'vodka_surplus',
    title: 'VODKA ABUNDANCE',
    description:
      'Vodka plant overproduced! Warehouse full. Workers offered overtime pay in vodka. Workers accept. Workers report this is the best day of their lives. Workers pass out.',
    pravdaHeadline: 'BEVERAGE INDUSTRY EXCEEDS ALL QUOTAS',
    category: 'economic',
    severity: 'minor',
    effects: { vodka: 25, food: -5 },
    condition: (gs) => gs.vodka > 20,
    weight: 0.7,
  },
  {
    id: 'tax_collection',
    title: 'VOLUNTARY CONTRIBUTION',
    description: (gs) => {
      const tax = Math.floor(gs.money * 0.1);
      return `Citizens voluntarily contribute ${tax} rubles to the State. The voluntariness of this contribution is not up for debate.`;
    },
    pravdaHeadline: 'CITIZENS OVERWHELMED WITH DESIRE TO FUND THE STATE',
    category: 'economic',
    severity: 'minor',
    effects: (gs) => ({ money: -Math.floor(gs.money * 0.1) }),
    condition: (gs) => gs.money > 50,
  },
  {
    id: 'supply_chain',
    title: 'LOGISTICS EXCELLENCE',
    description:
      'Supply shipment arrives! Contents: 4,000 left boots. The right boots are in another city. Citizens encouraged to hop.',
    pravdaHeadline: 'GENEROUS FOOTWEAR SHIPMENT ARRIVES ON SCHEDULE',
    category: 'economic',
    severity: 'minor',
    effects: { money: -15, food: 5 },
  },
  {
    id: 'foreign_aid_rejected',
    title: 'INTERNATIONAL RELATIONS',
    description:
      'Western aid package rejected on principle. Package contained: food, medicine, and an insulting amount of hope.',
    pravdaHeadline: 'SOVIET SELF-SUFFICIENCY PROVES SUPERIORITY OVER WESTERN HANDOUTS',
    category: 'economic',
    severity: 'minor',
    effects: { food: -8 },
  },
  {
    id: 'tractor_factory',
    title: 'TRACTOR NEWS',
    description:
      'New tractor produced at great expense. It does not run, but it looks very powerful standing still. Citizens gather to admire it, which counts as recreation.',
    pravdaHeadline: 'MAGNIFICENT TRACTOR ROLLS OFF ASSEMBLY LINE',
    category: 'economic',
    severity: 'trivial',
    effects: { money: -25 },
  },
  {
    id: 'coal_shortage',
    title: 'COAL SUPPLY UPDATE',
    description:
      'Coal supplies running low. Power plants operating at reduced capacity. Workers burn furniture for warmth. Interior design reportedly improves.',
    pravdaHeadline: 'MINIMALIST FURNITURE TREND SWEEPS THE NATION',
    category: 'economic',
    severity: 'major',
    effects: { power: -20, money: -30 },
    condition: (gs) => gs.power > 0,
  },
];

const CULTURAL_EVENTS: EventTemplate[] = [
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

const ABSURDIST_EVENTS: EventTemplate[] = [
  {
    id: 'nothing_happened',
    title: 'DAILY REPORT',
    description:
      'Nothing happened today. Report filed. Report lost. Report about lost report filed. That report also lost. System working as intended.',
    pravdaHeadline: 'STABILITY CONTINUES',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'opinion_corrected',
    title: 'THOUGHT CRIME BULLETIN',
    description:
      'A citizen had an opinion. It has been corrected. The citizen thanks the State for the correction. The gratitude has also been corrected.',
    pravdaHeadline: 'MENTAL HEALTH SERVICES PROVE EFFECTIVE',
    category: 'absurdist',
    severity: 'trivial',
    effects: { pop: -1 },
    condition: (gs) => gs.pop > 3,
    weight: 0.5,
  },
  {
    id: 'grey_weather',
    title: 'METEOROLOGICAL UPDATE',
    description:
      'The weather is grey. This is not news. It has always been grey. The color grey has filed a formal complaint. The complaint is also grey.',
    pravdaHeadline: 'WEATHER REMAINS CONSISTENT WITH FIVE-YEAR WEATHER PLAN',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'someone_smiled',
    title: 'SECURITY ALERT',
    description:
      'Someone smiled. Investigation underway. Witnesses report the smile lasted approximately 0.3 seconds before being replaced by the standard expression.',
    pravdaHeadline: 'SECURITY FORCES RESPOND SWIFTLY TO ANOMALY',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'clock_wrong',
    title: 'TEMPORAL ANOMALY',
    description:
      'The town clock is 3 hours wrong. No one noticed for 2 weeks. Work schedules have been adjusted. The clock has been awarded for creativity.',
    pravdaHeadline: 'INNOVATIVE TIMEKEEPING SYSTEM ADOPTED',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'bird_arrested',
    title: 'WILDLIFE ENFORCEMENT',
    description:
      'A pigeon was arrested for loitering near the Party headquarters. Trial date: pending. The pigeon has been assigned a lawyer. The lawyer is also a pigeon.',
    pravdaHeadline: 'LAW AND ORDER MAINTAINED AT ALL LEVELS OF SOCIETY',
    category: 'absurdist',
    severity: 'trivial',
    effects: { money: -2 },
  },
  {
    id: 'mystery_building',
    title: 'ARCHITECTURAL DISCOVERY',
    description:
      'A building was discovered that no one remembers constructing. It has 4 floors, no doors, and is full of filing cabinets. It has been designated as the new post office.',
    pravdaHeadline: 'MODERN POST OFFICE OPENS TO PUBLIC ACCLAIM',
    category: 'absurdist',
    severity: 'trivial',
    effects: { money: -10 },
  },
  {
    id: 'queue_sentient',
    title: 'SOCIOLOGICAL PHENOMENON',
    description: (gs) =>
      `The queue outside the bread shop has become self-aware. It now has ${Math.max(1, Math.floor(gs.pop / 4))} members and a chairman. It demands recognition as a legal entity.`,
    pravdaHeadline: 'CITIZENS FORM VIBRANT NEW SOCIAL ORGANIZATION',
    category: 'absurdist',
    severity: 'trivial',
    effects: { food: -3 },
    condition: (gs) => gs.pop > 5,
  },
  {
    id: 'map_wrong',
    title: 'CARTOGRAPHIC REVISION',
    description:
      'Official map updated. Your city is no longer on it. This is not considered a problem because the map is always correct. You, however, may need to reconsider your existence.',
    pravdaHeadline: 'NEW MAPS REFLECT LATEST GEOGRAPHIC REALITY',
    category: 'absurdist',
    severity: 'minor',
    effects: { money: -5 },
  },
  {
    id: 'dog_promoted',
    title: 'PERSONNEL CHANGE',
    description:
      'Comrade Dog has been promoted to Assistant Regional Director. His qualifications: loyalty, punctuality, and not asking questions. A model employee.',
    pravdaHeadline: 'MERITOCRACY IN ACTION: DEDICATED WORKER PROMOTED',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'concrete_shortage',
    title: 'MATERIALS REPORT',
    description:
      'Concrete shortage reported. Ironic, given that everything is made of concrete. Investigation reveals: concrete made of other, smaller concrete. It is concrete all the way down.',
    pravdaHeadline: 'CONSTRUCTION MATERIALS UNDERGO QUALITY REVIEW',
    category: 'absurdist',
    severity: 'minor',
    effects: { money: -15 },
  },
  {
    id: 'telephone_works',
    title: 'COMMUNICATIONS MIRACLE',
    description:
      'A telephone worked on the first try. Citizens gathered to witness the miracle. A plaque will be installed. The plaque has been ordered. Estimated arrival: 1997.',
    pravdaHeadline: 'TELECOMMUNICATIONS INFRASTRUCTURE RATED WORLD-CLASS',
    category: 'absurdist',
    severity: 'trivial',
    effects: {},
  },
  {
    id: 'existential_dread',
    title: 'PHILOSOPHICAL EMERGENCY',
    description:
      'Citizens experience collective existential dread. State psychiatrist diagnoses: "normal." Prescribes: vodka. Vodka supply: low. Dread supply: unlimited.',
    pravdaHeadline: 'DEEP THINKERS SHOWCASE SOVIET INTELLECTUAL TRADITION',
    category: 'absurdist',
    severity: 'minor',
    effects: { vodka: -8 },
    condition: (gs) => gs.vodka > 5,
  },
];

// ─────────────────────────────────────────────────────────
//  Bonus: GOOD events (rare, still absurd)
// ─────────────────────────────────────────────────────────

const GOOD_EVENTS: EventTemplate[] = [
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
    id: 'potato_miracle',
    title: 'AGRICULTURAL ANOMALY',
    description:
      'A kolkhoz produced an actual good harvest. Scientists baffled. The potatoes are suspiciously large. One of them may be a turnip. No one dares check.',
    pravdaHeadline: 'SOCIALIST AGRICULTURE PROVES SUPERIORITY OF COLLECTIVE FARMING',
    category: 'economic',
    severity: 'minor',
    effects: { food: 40 },
    weight: 0.4,
  },
  {
    id: 'vodka_discovery',
    title: 'ARCHAEOLOGICAL FIND',
    description:
      'Workers discover hidden vodka cache from 1943 during construction. Quality: better than current production. This is both celebrated and deeply concerning.',
    pravdaHeadline: 'WARTIME RESERVES SUPPLEMENT ALREADY-ADEQUATE SUPPLY',
    category: 'economic',
    severity: 'minor',
    effects: { vodka: 20 },
    weight: 0.4,
  },
  {
    id: 'lost_rubles',
    title: 'FISCAL DISCOVERY',
    description:
      'An accounting error in your favor: 200 rubles discovered in a drawer that everyone forgot existed. The drawer has been promoted.',
    pravdaHeadline: 'METICULOUS BOOKKEEPING REVEALS SURPLUS FUNDS',
    category: 'economic',
    severity: 'minor',
    effects: { money: 200 },
    weight: 0.3,
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

// ─────────────────────────────────────────────────────────
//  ALL TEMPLATES  (exported for PravdaSystem to reference)
// ─────────────────────────────────────────────────────────

export const ALL_EVENT_TEMPLATES: EventTemplate[] = [
  ...DISASTER_EVENTS,
  ...POLITICAL_EVENTS,
  ...ECONOMIC_EVENTS,
  ...CULTURAL_EVENTS,
  ...ABSURDIST_EVENTS,
  ...GOOD_EVENTS,
];

// ─────────────────────────────────────────────────────────
//  EVENT SYSTEM CLASS
// ─────────────────────────────────────────────────────────

export class EventSystem {
  private lastEventTime = 0;
  private eventCooldown = 25000; // 25 seconds between events
  private recentEventIds: string[] = [];
  private maxRecentMemory = 10;
  private eventHistory: GameEvent[] = [];

  constructor(
    private gameState: GameState,
    private onEventCallback: (event: GameEvent) => void,
    rng?: GameRng
  ) {
    if (rng) _rng = rng;
  }

  /** Called every simulation tick */
  public tick(): void {
    const now = Date.now();
    if (now - this.lastEventTime < this.eventCooldown) return;

    // 12% chance per eligible tick
    if ((_rng?.random() ?? Math.random()) < 0.12) {
      const event = this.generateEvent();
      if (event) {
        this.applyEffects(event);
        this.eventHistory.push(event);
        this.recentEventIds.push(event.id);
        if (this.recentEventIds.length > this.maxRecentMemory) {
          this.recentEventIds.shift();
        }
        this.onEventCallback(event);
        this.lastEventTime = now;
      }
    }
  }

  /** Force-trigger a specific event by ID */
  public triggerEvent(eventId: string): void {
    const template = ALL_EVENT_TEMPLATES.find((t) => t.id === eventId);
    if (!template) return;
    const event = this.resolveTemplate(template);
    this.applyEffects(event);
    this.eventHistory.push(event);
    this.onEventCallback(event);
  }

  /** Get the last N events for display */
  public getRecentEvents(count = 5): GameEvent[] {
    return this.eventHistory.slice(-count);
  }

  /** Get the most recent event */
  public getLastEvent(): GameEvent | null {
    return this.eventHistory.length > 0 ? this.eventHistory[this.eventHistory.length - 1]! : null;
  }

  // ── private ──────────────────────────────────────────

  private generateEvent(): GameEvent | null {
    // Filter to eligible events (condition met, not recently fired)
    const eligible = ALL_EVENT_TEMPLATES.filter((t) => {
      if (this.recentEventIds.includes(t.id)) return false;
      if (t.condition && !t.condition(this.gameState)) return false;
      return true;
    });

    if (eligible.length === 0) return null;

    // Weighted random selection
    const totalWeight = eligible.reduce((sum, t) => sum + (t.weight ?? 1), 0);
    let roll = (_rng?.random() ?? Math.random()) * totalWeight;
    for (const template of eligible) {
      roll -= template.weight ?? 1;
      if (roll <= 0) {
        return this.resolveTemplate(template);
      }
    }

    // Fallback
    return this.resolveTemplate(pick(eligible));
  }

  private resolveTemplate(template: EventTemplate): GameEvent {
    const gs = this.gameState;

    const description =
      typeof template.description === 'function' ? template.description(gs) : template.description;

    const pravdaHeadline =
      typeof template.pravdaHeadline === 'function'
        ? template.pravdaHeadline(gs)
        : template.pravdaHeadline;

    const effects =
      typeof template.effects === 'function' ? template.effects(gs) : { ...template.effects };

    // Determine type for UI coloring
    const netImpact =
      (effects.money ?? 0) +
      (effects.food ?? 0) +
      (effects.vodka ?? 0) +
      (effects.pop ?? 0) * 10 +
      (effects.power ?? 0);

    let type: 'good' | 'bad' | 'neutral' = 'neutral';
    if (netImpact > 5) type = 'good';
    else if (netImpact < -5) type = 'bad';

    return {
      id: template.id,
      title: template.title,
      description,
      pravdaHeadline,
      category: template.category,
      severity: template.severity,
      effects,
      type,
    };
  }

  private applyEffects(event: GameEvent): void {
    const fx = event.effects;

    // Apply to the ECS resource store (single source of truth).
    // syncEcsToGameState() copies these values to GameState each tick.
    const store = getResourceEntity();
    if (store) {
      const r = store.resources;
      if (fx.money) r.money = Math.max(0, r.money + fx.money);
      if (fx.food) r.food = Math.max(0, r.food + fx.food);
      if (fx.vodka) r.vodka = Math.max(0, r.vodka + fx.vodka);
      if (fx.pop) r.population = Math.max(0, r.population + fx.pop);
      if (fx.power) r.power = Math.max(0, r.power + fx.power);
    } else {
      // Fallback to GameState if ECS not initialized (e.g. in tests)
      const gs = this.gameState;
      if (fx.money) gs.money = Math.max(0, gs.money + fx.money);
      if (fx.food) gs.food = Math.max(0, gs.food + fx.food);
      if (fx.vodka) gs.vodka = Math.max(0, gs.vodka + fx.vodka);
      if (fx.pop) gs.pop = Math.max(0, gs.pop + fx.pop);
      if (fx.power) gs.power = Math.max(0, gs.power + fx.power);
    }
  }
}
