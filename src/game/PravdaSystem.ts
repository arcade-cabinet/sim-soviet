import { getBuildingDef } from '@/data/buildingDefs';
import type { EventCategory, GameEvent } from './EventSystem';
import type { Building, GameState } from './GameState';
import type { GameRng } from './SeedSystem';

// ─────────────────────────────────────────────────────────
//  PRAVDA HEADLINE GENERATOR  --  Procedural Edition
//
//  The official newspaper of the people. All news is good
//  news. Bad news is better news, presented correctly.
//
//  This system generates headlines from compositional
//  grammars rather than fixed strings. Template slots are
//  filled from word pools, producing hundreds of thousands
//  of unique combinations. Headlines react to game state
//  but ALWAYS spin it positive.
//
//  Key design principle: external threats (NATO, CIA,
//  capitalists) are NEVER real gameplay events. They exist
//  ONLY as Pravda propaganda. Real disruptions come from
//  internal failures, but Pravda never acknowledges those.
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
//  PUBLIC TYPES
// ─────────────────────────────────────────────────────────

/** A generated headline with metadata */
export interface PravdaHeadline {
  headline: string;
  subtext: string;
  /** The grim reality behind the headline */
  reality: string;
  category:
    | 'triumph'
    | 'production'
    | 'culture'
    | 'weather'
    | 'editorial'
    | 'threat'
    | 'leader'
    | 'spin';
  timestamp: number;
}

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

/** Module-level RNG reference, set by PravdaSystem constructor */
let _rng: GameRng | null = null;

function pick<T>(arr: readonly T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return _rng ? _rng.int(min, max) : Math.floor(Math.random() * (max - min + 1)) + min;
}

/** A building is a "gulag" if it has negative housing capacity (drains population). */
const isGulag = (b: Building): boolean => (getBuildingDef(b.defId)?.stats.housingCap ?? 0) < 0;

function coinFlip(probability = 0.5): boolean {
  return _rng ? _rng.coinFlip(probability) : Math.random() < probability;
}

/** Generate an absurdly precise fake percentage */
function fakePercent(): string {
  return `${randInt(100, 999)}.${randInt(0, 99).toString().padStart(2, '0')}`;
}

/** Generate an impossibly large production number */
function bigNumber(): string {
  const n = randInt(1, 99) * 10 ** randInt(2, 5);
  return n.toLocaleString();
}

// ─────────────────────────────────────────────────────────
//  WORD POOLS
//
//  Each pool is a set of interchangeable fragments that
//  plug into template slots. Combinatorial explosion
//  ensures near-infinite unique headlines.
// ─────────────────────────────────────────────────────────

// -- SUBJECTS: who the headline is about --

const HERO_SUBJECTS = [
  'HEROIC WORKERS',
  'TIRELESS LABORERS',
  'DEDICATED COMRADES',
  'SELFLESS PROLETARIANS',
  'COURAGEOUS MINERS',
  'PATRIOTIC FARMERS',
  'VIGILANT CITIZENS',
  'REVOLUTIONARY YOUTH',
  'LOYAL PARTY MEMBERS',
  'IRON-WILLED BUILDERS',
  'PEOPLES MILITIA',
  'GLORIOUS FACTORY WORKERS',
  'VOLUNTEER BRIGADES',
  'MODEL CITIZENS',
  'SOCIALIST HEROES',
] as const;

const ENEMY_SUBJECTS = [
  'CIA OPERATIVES',
  'NATO PROVOCATEURS',
  'WALL STREET BANKERS',
  'WESTERN SPIES',
  'CAPITALIST SABOTEURS',
  'IMPERIALIST AGENTS',
  'BOURGEOIS INFILTRATORS',
  'FOREIGN AGITATORS',
  'DECADENT OLIGARCHS',
  'REACTIONARY ELEMENTS',
  'TROTSKYIST WRECKERS',
  'COSMOPOLITAN SUBVERSIVES',
  'PENTAGON WARMONGERS',
  'BRITISH INTELLIGENCE',
  'WEST GERMAN PROVOCATEURS',
  'AMERICAN PROPAGANDISTS',
  'COUNTER-REVOLUTIONARY BANDITS',
  'ZIONIST CONSPIRATORS',
] as const;

const INSTITUTIONS = [
  'THE PARTY',
  'THE CENTRAL COMMITTEE',
  'THE POLITBURO',
  'THE PEOPLES COUNCIL',
  'THE MINISTRY OF PRODUCTION',
  'THE MINISTRY OF TRUTH',
  'THE MINISTRY OF PLENTY',
  'THE PLANNING COMMISSION',
  'THE KGB',
  'THE SUPREME SOVIET',
  'THE ACADEMY OF SCIENCES',
  'THE WORKERS SOVIET',
  'THE YOUTH LEAGUE',
  'THE TRADE UNION',
  'THE COLLECTIVE FARM BUREAU',
] as const;

const LEADER_TITLES = [
  'COMRADE GENERAL SECRETARY',
  'THE BRILLIANT CHAIRMAN',
  'OUR BELOVED LEADER',
  'THE PEOPLES FATHER',
  'THE GREAT HELMSMAN',
  'COMRADE FIRST SECRETARY',
  'THE WISE PREMIER',
  'THE TIRELESS NAVIGATOR',
  'DEAR COMRADE DIRECTOR',
  'THE SUPREME GUIDE',
  'THE ARCHITECT OF PROGRESS',
  'THE IRON GUARDIAN',
] as const;

// -- VERBS: what they did --

const TRIUMPH_VERBS = [
  'EXCEEDED',
  'SURPASSED',
  'OBLITERATED',
  'SHATTERED',
  'DEMOLISHED',
  'ANNIHILATED',
  'CRUSHED',
  'ACHIEVED',
  'FULFILLED',
  'OVERFULFILLED',
  'COMPLETED',
  'ACCOMPLISHED',
  'DOUBLED',
  'TRIPLED',
  'QUADRUPLED',
] as const;

const THREAT_VERBS = [
  'FOILED',
  'THWARTED',
  'EXPOSED',
  'UNMASKED',
  'NEUTRALIZED',
  'INTERCEPTED',
  'DEFEATED',
  'REPELLED',
  'CRUSHED',
  'LIQUIDATED',
  'ROUTED',
  'DISMANTLED',
] as const;

const POSITIVE_VERBS = [
  'CELEBRATED',
  'HONORED',
  'DEMONSTRATED',
  'PROVED',
  'VOLUNTEERED FOR',
  'EMBRACED',
  'RALLIED BEHIND',
  'UNANIMOUSLY ENDORSED',
  'DEVOTED THEMSELVES TO',
  'RENEWED COMMITMENT TO',
] as const;

// -- OBJECTS: what was accomplished/threatened --

const PRODUCTION_OBJECTS = [
  'PRODUCTION QUOTA',
  'FIVE-YEAR PLAN TARGET',
  'OUTPUT RECORD',
  'HARVEST BENCHMARK',
  'INDUSTRIAL MILESTONE',
  'EFFICIENCY STANDARD',
  'LABOR PRODUCTIVITY GOAL',
  'STEEL OUTPUT TARGET',
  'CONCRETE PRODUCTION NORM',
  'TRACTOR ASSEMBLY QUOTA',
  'COAL EXTRACTION RECORD',
  'GRAIN DELIVERY SCHEDULE',
  'VODKA DISTILLATION BENCHMARK',
  'BOOT MANUFACTURING TARGET',
  'TURNIP CULTIVATION QUOTA',
] as const;

const THREAT_OBJECTS = [
  'SABOTAGE OPERATION',
  'ESPIONAGE RING',
  'DESTABILIZATION PLOT',
  'ECONOMIC WARFARE CAMPAIGN',
  'PROPAGANDA OFFENSIVE',
  'INFILTRATION ATTEMPT',
  'SMUGGLING NETWORK',
  'SUBVERSION SCHEME',
  'ASSASSINATION PLOT',
  'DISINFORMATION CAMPAIGN',
  'BIOLOGICAL WARFARE PROGRAM',
  'RADIO JAMMING OPERATION',
] as const;

const CULTURAL_OBJECTS = [
  'REVOLUTIONARY SPIRIT',
  'SOCIALIST IDEALS',
  'COLLECTIVE HARMONY',
  'PROLETARIAN CULTURE',
  'PEOPLES UNITY',
  'WORKERS SOLIDARITY',
  'MARXIST-LENINIST PRINCIPLES',
  'DIALECTICAL PROGRESS',
  'CLASS CONSCIOUSNESS',
  'FRATERNAL COOPERATION',
] as const;

// -- QUALIFIERS: how it was done --

const QUALIFIERS = [
  'AHEAD OF SCHEDULE',
  'UNDER BUDGET',
  'DESPITE CAPITALIST INTERFERENCE',
  'WITH REVOLUTIONARY FERVOR',
  'UNANIMOUSLY',
  'BY POPULAR DEMAND',
  'IN RECORD TIME',
  'WITH IRON DISCIPLINE',
  'THROUGH COLLECTIVE EFFORT',
  'THANKS TO WISE LEADERSHIP',
  'IN THE SPIRIT OF LENIN',
  'WITH BOUNDLESS ENTHUSIASM',
  "UNDER THE PARTY'S GUIDANCE",
  'IN FULFILLMENT OF SACRED DUTY',
  'WITH SELFLESS DEDICATION',
  'BEYOND ALL EXPECTATIONS',
  'TO THE GLORY OF THE MOTHERLAND',
  'IN DEFIANCE OF WESTERN DOUBT',
  'AS MARX PREDICTED',
  'AS THE FIVE-YEAR PLAN DEMANDS',
] as const;

// -- WESTERN FAILURES (for contrast) --

const WESTERN_NOUNS = [
  'UNEMPLOYMENT',
  'INFLATION',
  'HOMELESSNESS',
  'STOCK MARKET CRASH',
  'BANK FAILURE',
  'CORRUPTION SCANDAL',
  'LABOR STRIKE',
  'RACE RIOT',
  'DRUG EPIDEMIC',
  'MORAL DECAY',
  'CONSUMER DEBT CRISIS',
  'HEALTHCARE COLLAPSE',
  'FACTORY CLOSURE',
  'BREAD LINE',
  'POVERTY RATE',
] as const;

const WESTERN_COUNTRIES = [
  'AMERICA',
  'BRITAIN',
  'WEST GERMANY',
  'FRANCE',
  'JAPAN',
  'NATO',
  'THE WEST',
  'THE FREE WORLD',
  'WALL STREET',
  'THE PENTAGON',
  'WASHINGTON',
  'LONDON',
  'BONN',
] as const;

// -- SCIENTIFIC ACHIEVEMENTS (that don't exist) --

const FAKE_DISCOVERIES = [
  'PERPETUAL MOTION TRACTOR',
  'COLD-RESISTANT WHEAT STRAIN',
  'TELEPATHIC CROP MONITORING',
  'NUCLEAR-POWERED SNOW PLOW',
  'CONCRETE THAT HEALS ITSELF',
  'VODKA-BASED ROCKET FUEL',
  'POTATO THAT GROWS IN DARKNESS',
  'INVISIBLE FENCE TECHNOLOGY',
  'ACOUSTIC WALL INSULATION FROM ANTHEM RECORDINGS',
  'IDEOLOGICALLY CORRECT WEATHER PREDICTION',
  'SOCIALIST-REALIST AI',
  'QUANTUM COLLECTIVE FARMING',
  'FASTER-THAN-LIGHT TELEGRAM',
  'SELF-HARVESTING TURNIP',
  'PROLETARIAN COLD FUSION',
  'DIALECTICAL MATERIALS SCIENCE',
] as const;

// -- SPORTS/COMPETITIONS --

const SOVIET_SPORTS = [
  'WEIGHTLIFTING',
  'CHESS',
  'GYMNASTICS',
  'ICE HOCKEY',
  'FIGURE SKATING',
  'WRESTLING',
  'CROSS-COUNTRY SKIING',
  'SHOT PUT',
  'SYNCHRONIZED SWIMMING',
  'MARCHING',
  'POTATO PEELING',
  'QUEUE STANDING',
  'CONCRETE POURING',
  'SNOW SHOVELING',
  'DOCUMENT FILING',
] as const;

// -- EUPHEMISMS (for spinning bad situations) --

const SHORTAGE_EUPHEMISMS = {
  food: [
    'VOLUNTARY CALORIC CONSERVATION PROGRAM',
    'CITIZENS ACHIEVE NEW INTERMITTENT FASTING RECORD',
    'DIETARY OPTIMIZATION INITIATIVE SUCCEEDS',
    'WEIGHT LOSS GOALS EXCEEDED ACROSS ALL SECTORS',
    'AGRICULTURAL OUTPUT REDIRECTED TO STRATEGIC RESERVES',
    'CITIZENS DEMONSTRATE DISCIPLINE IN EATING HABITS',
    'SURPLUS APPETITE REDIRECTED TO PRODUCTIVE LABOR',
  ] as const,
  money: [
    'VOLUNTARY AUSTERITY EMBRACED WITH ENTHUSIASM',
    'CITIZENS DONATE SAVINGS TO STATE DEVELOPMENT FUND',
    'MATERIAL POSSESSIONS DECLARED BOURGEOIS',
    'RUBLE ACHIEVES MAXIMUM THEORETICAL VALUE',
    'TREASURY INVESTS IN FUTURE GENERATIONS',
    'ECONOMIC MINIMALISM TREND SWEEPS NATION',
  ] as const,
  vodka: [
    'SOBRIETY INITIATIVE PROCEEDS AHEAD OF SCHEDULE',
    'CITIZENS DISCOVER JOY OF CLEAR-HEADED LABOR',
    'VODKA RESERVES STRATEGICALLY DEPLOYED TO FRONTLINES',
    'TEMPERANCE MOVEMENT ACHIEVES HISTORIC MILESTONE',
    'WORKERS PROVE ENTHUSIASM NEEDS NO CHEMICAL ASSISTANCE',
    'ANTI-ALCOHOL CAMPAIGN DECLARED OVERWHELMING SUCCESS',
  ] as const,
  power: [
    'SCHEDULED DARKNESS FOR ASTRONOMICAL OBSERVATION',
    'CANDLELIGHT APPRECIATION WEEK ENTERS MONTH FOUR',
    'ENERGY CONSERVATION AWARD WON BY ENTIRE CITY',
    'WORKERS EMBRACE DARKNESS, BOTH LITERAL AND METAPHORICAL',
    'POWER GRID UNDERGOES VOLUNTARY MEDITATION',
    'ELECTRICITY RATIONING BUILDS CHARACTER',
  ] as const,
  pop: [
    'POPULATION OPTIMIZED FOR MAXIMUM EFFICIENCY',
    'WORKFORCE STREAMLINED TO ELIMINATE REDUNDANCY',
    'CITIZENS VOLUNTEER FOR REMOTE AGRICULTURAL ASSIGNMENT',
    'DEMOGRAPHIC ADJUSTMENT COMPLETES ON SCHEDULE',
    'URBAN DENSITY TARGETS ACHIEVED THROUGH NATURAL MIGRATION',
    'POPULATION RIGHT-SIZED PER SCIENTIFIC CALCULATION',
  ] as const,
};

// -- BUILDING COLLAPSE / DESTRUCTION SPINS (used in contextual generators) --

const DESTRUCTION_SPINS = [
  'URBAN RENEWAL ACCELERATES',
  'PLANNED DEMOLITION PROCEEDS FLAWLESSLY',
  'ARCHITECTURAL REFRESH INITIATIVE LAUNCHES',
  'CONSTRUCTION ZONE ESTABLISHED FOR BIGGER, BETTER BUILDING',
  'BUILDING VOLUNTARILY DISASSEMBLES FOR RECYCLING',
  'STRUCTURE RECLASSIFIED AS OPEN-AIR FACILITY',
  'INNOVATIVE DECONSTRUCTIVIST ARCHITECTURE DEBUTS',
  'RUBBLE REPURPOSED AS FOUNDATION FOR PROGRESS',
] as const;

// -- LEADER PRAISE FRAGMENTS --

const LEADER_ACHIEVEMENTS = [
  'WORKS 18-HOUR DAYS',
  'PERSONALLY INSPECTS EVERY POTATO',
  'SLEEPS ONLY WHEN THE PEOPLE SLEEP (NEVER)',
  'READS 400 PAGES OF POLICY DAILY',
  'BENCH-PRESSES 200 KILOGRAMS',
  'WRITES POETRY BETWEEN MEETINGS',
  "HAS MEMORIZED EVERY CITIZEN'S NAME",
  'INVENTED A NEW TYPE OF CONCRETE',
  'PREDICTED THE WEATHER CORRECTLY ONCE',
  'NEGOTIATED FAVORABLE TREATY WITH WINTER',
  'SINGLE-HANDEDLY IMPROVED CROP YIELDS BY STARING AT FIELDS',
  'COMPOSED A SYMPHONY DURING LUNCH BREAK',
  'DESIGNED NEW TRACTOR WITH A PENCIL AND PURE WILLPOWER',
  'ACHIEVED ENLIGHTENMENT BUT REMAINED HUMBLE',
] as const;

const LEADER_QUALITIES = [
  'INFINITE WISDOM',
  'UNMATCHED FORESIGHT',
  'LEGENDARY MODESTY',
  'SUPERHUMAN ENDURANCE',
  'DEEP CONCERN FOR THE MASSES',
  'IRON CONSTITUTION',
  'BRILLIANT STRATEGIC MIND',
  'FLAWLESS JUDGMENT',
  'INEXHAUSTIBLE PATIENCE',
  'RADIANT CHARISMA',
  'ENCYCLOPEDIC KNOWLEDGE',
  'UNWAVERING RESOLVE',
] as const;

const NATURE_CREDITS = [
  'GOOD HARVEST ATTRIBUTED TO WISE AGRICULTURAL POLICY',
  "MILD WINTER CREDITED TO LEADER'S NEGOTIATIONS WITH NATURE",
  'SUNRISE OCCURS ON SCHEDULE THANKS TO PARTY PLANNING',
  'FAVORABLE WINDS BLOW IN DIRECTION OF SOCIALISM',
  'RAIN FALLS PRECISELY ON COLLECTIVE FARMS AS DIRECTED',
  'BIRDS RETURN FROM MIGRATION IN ORDERLY FORMATION',
  'RIVERS FLOW MORE EFFICIENTLY UNDER NEW MANAGEMENT',
  'MOUNTAINS STAND TALLER IN SOLIDARITY WITH THE PEOPLE',
] as const;

// -- REALITY FRAGMENTS (the truth behind the spin) --

const GENERIC_REALITIES = [
  'Source: a clipboard found in a ditch.',
  'Investigation ongoing. Investigator also missing.',
  'Witnesses report seeing nothing. Twice.',
  'Documents confirming this were printed, then eaten.',
  'Statistics verified by the Department of Optimistic Counting.',
  'Three people were asked. Two agreed. The third was reassigned.',
  'The report was written in pencil so it can be corrected later.',
  'A committee has been formed to celebrate this. The committee has also been dissolved.',
  'This information is correct. Incorrectness has been made illegal.',
  'All citizens surveyed responded favorably. Non-favorable citizens were not surveyed.',
  'The numbers are real. Reality has been adjusted to match.',
  'Confirmed by an expert who preferred to remain employed.',
  'This fact has been verified by the Ministry of Facts, which also verified itself.',
  'Any resemblance to actual events is purely ideological.',
] as const;

const THREAT_REALITIES = [
  'The "spy" was a confused tourist with a camera.',
  'The "saboteur" was a pigeon that shorted a transformer.',
  'The "plot" was reconstructed from a torn napkin doodle.',
  'Intelligence sources: a man who talks to pigeons.',
  'Evidence: one (1) suspicious-looking hat.',
  'The "agent" was a radio picking up Polish folk music.',
  'Threat level determined by drawing lots.',
  'The "infiltrator" turned out to be a lost plumber from Sector 3.',
  'CIA involvement confirmed by a ouija board in the KGB basement.',
  'NATO detected using a compass that only points east.',
] as const;

// ─────────────────────────────────────────────────────────
//  TEMPLATE GRAMMAR SYSTEM
//
//  Each generator function produces a headline + subtext +
//  reality triple. Templates use word pools so the same
//  structural pattern yields different text each time.
// ─────────────────────────────────────────────────────────

type HeadlineCategory = PravdaHeadline['category'];

interface GeneratedHeadline {
  headline: string;
  subtext: string;
  reality: string;
  category: HeadlineCategory;
}

type HeadlineGenerator = (gs: GameState) => GeneratedHeadline;

// ── EXTERNAL THREAT generators (never real, always propaganda) ──

const externalThreatGenerators: HeadlineGenerator[] = [
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

// ── INTERNAL TRIUMPH generators (always overstated) ──

const internalTriumphGenerators: HeadlineGenerator[] = [
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

// ── LEADERSHIP PRAISE generators (sycophantic) ──

const leaderPraiseGenerators: HeadlineGenerator[] = [
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

// ── CULTURAL VICTORY generators ──

const culturalVictoryGenerators: HeadlineGenerator[] = [
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

// ── RESOURCE SPIN generators (react to game state) ──

const resourceSpinGenerators: HeadlineGenerator[] = [
  // Food shortage spin
  (gs) => ({
    headline: pick(SHORTAGE_EUPHEMISMS.food),
    subtext: `Current food reserves (${gs.food} units) represent a ${pick(['strategic minimum', 'calculated sufficiency', 'planned threshold', 'optimal level'])} per Ministry guidelines.`,
    reality: `Food reserves at ${gs.food}. Citizens are eating wallpaper paste. The wallpaper is also running out.`,
    category: 'spin',
  }),

  // Money shortage spin
  (gs) => ({
    headline: pick(SHORTAGE_EUPHEMISMS.money),
    subtext: `The treasury's ${gs.money} rubles prove that less is more. More is also more. Everything is more.`,
    reality: `Treasury contains ${gs.money} rubles and an IOU from 1963.`,
    category: 'spin',
  }),

  // Vodka shortage spin
  (gs) => ({
    headline: pick(SHORTAGE_EUPHEMISMS.vodka),
    subtext: `Current reserves of ${gs.vodka} units are ${pick(['"adequate"', '"sufficient"', '"more than enough"', '"not a crisis"'])}, says spokesperson.`,
    reality: `Vodka at ${gs.vodka}. Workers have begun distilling boot polish. Morale: complicated.`,
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

// ── WEATHER/FILLER generators ──

const weatherFillerGenerators: HeadlineGenerator[] = [
  () => ({
    headline: `WEATHER FORECAST: ${pick(['GREY', 'OVERCAST', 'CONCRETE-COLORED', 'IDEOLOGICALLY NEUTRAL'])} WITH ${pick(['PERIODIC GREY', 'SCATTERED GREYNESS', 'A CHANCE OF DARKER GREY', 'CONTINUED ABSENCE OF SUN'])}`,
    subtext: `Extended forecast: ${pick(['more of the same', 'similar but colder', 'grey with a chance of grey', 'the usual'])}. Week ahead: classified.`,
    reality: 'The meteorologist quit. The forecast is now generated by a dart board.',
    category: 'weather',
  }),

  () => ({
    headline: `WINTER ARRIVES ${pick(['ON SCHEDULE', 'AS PREDICTED', 'PER FIVE-YEAR WEATHER PLAN', 'AHEAD OF SCHEDULE (A TRIUMPH)'])}`,
    subtext: `Temperature: -${randInt(15, 45)} degrees. Status: ${pick(['brisk', 'refreshing', 'character-building', 'invigorating', 'survivable'])}`,
    reality: 'Winter arrived in August. The calendar has been amended.',
    category: 'weather',
  }),

  () => ({
    headline: `SPRING PREDICTED FOR ${pick(['NEXT MONTH', 'SOMETIME THIS YEAR', 'THE FORESEEABLE FUTURE', 'EVENTUALLY', 'SOON (REDEFINED)'])}`,
    subtext: 'Citizens advised to remain patient. Patience supplies: adequate.',
    reality:
      'Last spring lasted 2 days. A citizen blinked and missed it. He was counseled for inattention.',
    category: 'weather',
  }),

  () => ({
    headline: `SUN SPOTTED FOR ${randInt(3, 45)} MINUTES. CITIZENS CELEBRATE`,
    subtext: `Solar Committee confirms: this was a planned appearance. The sun is a party member in good standing.`,
    reality: 'It was a searchlight from the border patrol. Citizens celebrated anyway.',
    category: 'weather',
  }),

  // Absurdist filler
  () => ({
    headline: `EDITORIAL: ${pick(['NOTHING HAPPENED TODAY AND THAT IS GOOD', 'EVERYTHING IS FINE (REPEAT UNTIL TRUE)', 'THE STATE OF THE STATE: STATED', 'WHY YESTERDAY WAS THE BEST YESTERDAY YET', 'IN DEFENSE OF CONCRETE: A MANIFESTO'])}`,
    subtext: pick([
      'By the Editor (writing voluntarily, under observation).',
      'Opinions expressed are the only opinions.',
      'Reader feedback: not accepted.',
      'Corrections: there are none. There never are.',
    ]),
    reality: pick(GENERIC_REALITIES),
    category: 'editorial',
  }),

  () => ({
    headline: `CORRECTION: ${pick([
      'YESTERDAY\'S "EXPLOSION" WAS A "PLANNED ACOUSTIC EVENT"',
      'THE "MISSING BUILDING" WAS "RELOCATED FOR STRATEGIC REASONS"',
      'THE "FOOD SHORTAGE" IS A "CALORIC OPPORTUNITY"',
      'THE "POWER OUTAGE" WAS "VOLUNTARY DARKNESS"',
      'THE "CRUMBLING INFRASTRUCTURE" IS "ADAPTIVE ARCHITECTURE"',
      'THE "RAT INFESTATION" IS A "WILDLIFE INTEGRATION PROGRAM"',
      'THE "EMPTY SHELVES" REPRESENT "MINIMALIST RETAIL DESIGN"',
    ])}`,
    subtext: 'Pravda regrets the earlier understatement of how good things are.',
    reality: 'The original report was accurate. The correction is the fiction.',
    category: 'editorial',
  }),

  // Classified ads
  () => ({
    headline: `CLASSIFIED: ${pick([
      `SEEKING ${randInt(50, 500)} VOLUNTEERS FOR "SPECIAL PROJECT." SHOVELS PROVIDED`,
      `LOST: 1 BUILDING. LAST SEEN: STANDING. IF FOUND, CONTACT MINISTRY`,
      `FOR SALE: SLIGHTLY USED TRACTOR. CONDITION: THEORETICAL`,
      `WANTED: CITIZENS WHO CAN SMILE ON COMMAND. COMPETITIVE PAY (IN POTATOES)`,
      `FOUND: ${randInt(3, 30)} LEFT BOOTS. OWNERS PLEASE CLAIM AT WAREHOUSE 7`,
      `SEEKING QUALIFIED PLUMBER. QUALIFICATIONS: ALIVE, WILLING`,
      `FOR TRADE: 1 POTATO FOR 3 POEMS ABOUT TRACTORS. SERIOUS OFFERS ONLY`,
    ])}`,
    subtext:
      'All classified ads reviewed and approved by the Ministry of Commerce (dissolved 1976).',
    reality:
      'The classified section is the only honest part of the newspaper. This concerns everyone.',
    category: 'editorial',
  }),

  // Horoscope
  () => ({
    headline: `DAILY HOROSCOPE: ALL SIGNS PREDICT ${pick(['INCREASED PRODUCTIVITY', 'FAVORABLE QUOTA FULFILLMENT', 'LOYALTY TO THE STATE', 'CONCRETE', 'ANOTHER DAY', 'THE SAME AS YESTERDAY'])}`,
    subtext: `Astrology is bourgeois superstition. This horoscope is scientific socialist prediction.`,
    reality:
      'Horoscope written by the same person who writes the weather forecast. He is also the janitor.',
    category: 'editorial',
  }),

  // Year-in-review / seasonal reference
  (gs) => ({
    headline: `${gs.date.year} ON TRACK TO BE BEST YEAR IN SOVIET HISTORY`,
    subtext: `Previous best year: ${gs.date.year - 1}. Before that: ${gs.date.year - 2}. Pattern: every year is the best.`,
    reality: `${gs.date.year} is indistinguishable from ${gs.date.year - 1}. This is considered a success.`,
    category: 'editorial',
  }),
];

// ─────────────────────────────────────────────────────────
//  CONTEXTUAL HEADLINE GENERATORS
//
//  These react to specific game state conditions.
//  They fire when the game state matches certain thresholds,
//  ALWAYS spinning the situation positively.
// ─────────────────────────────────────────────────────────

interface ContextualGenerator {
  condition: (gs: GameState) => boolean;
  weight: number;
  generate: HeadlineGenerator;
}

const contextualGenerators: ContextualGenerator[] = [
  // Population declining (pop < 20)
  {
    condition: (gs) => gs.pop < 20 && gs.pop > 0,
    weight: 2,
    generate: (gs) => ({
      headline: `INTIMATE COMMUNITY OF ${gs.pop} PROVES SUPERIORITY OF SMALL-SCALE SOCIALISM`,
      subtext: `Every citizen personally known by the state. Privacy: a bourgeois concept anyway.`,
      reality: `Population was 50 last year. Nobody discusses this.`,
      category: 'spin',
    }),
  },

  // No food (food < 10)
  {
    condition: (gs) => gs.food < 10,
    weight: 3,
    generate: (gs) => ({
      headline: `CITIZENS ACHIEVE NEW FASTING RECORD: DAY ${randInt(3, 30)}`,
      subtext: `Health benefits of not eating: extensively documented by the Ministry of ${pick(['Health', 'Nutrition', 'Convenient Explanations'])}.`,
      reality: `Food supply: ${gs.food} units. Citizens spotted eating a poster of food.`,
      category: 'spin',
    }),
  },

  // No money (money < 50)
  {
    condition: (gs) => gs.money < 50,
    weight: 2,
    generate: (gs) => ({
      headline: `POST-MONETARY ECONOMY ACHIEVED: TREASURY AT LEAN ${gs.money} RUBLES`,
      subtext: `Money is a capitalist construct. We have moved beyond it. (We had no choice.)`,
      reality: `The treasury is a tin box with ${gs.money} rubles and a moth.`,
      category: 'spin',
    }),
  },

  // Lots of buildings (> 15)
  {
    condition: (gs) => gs.buildings.length > 15,
    weight: 1,
    generate: (gs) => ({
      headline: `URBAN SKYLINE FEATURES ${gs.buildings.length} MAGNIFICENT STRUCTURES`,
      subtext: `Architectural diversity: rectangles, squares, and the occasional rectangle. All grey.`,
      reality: `${gs.buildings.length} buildings, ${randInt(1, 3)} of which are structurally sound.`,
      category: 'production',
    }),
  },

  // No buildings
  {
    condition: (gs) => gs.buildings.length === 0,
    weight: 3,
    generate: () => ({
      headline: 'MINIMALIST URBAN DESIGN WINS INTERNATIONAL ACCLAIM',
      subtext:
        'Zero buildings represent a bold architectural statement. "Less is more," says nobody.',
      reality: 'There are no buildings. The city is a field. The field is also struggling.',
      category: 'spin',
    }),
  },

  // Population zero
  {
    condition: (gs) => gs.pop === 0,
    weight: 5,
    generate: () => ({
      headline: 'CITY ACHIEVES PERFECT CRIME RATE: 0 CRIMES, 0 CITIZENS',
      subtext: 'Also: 0 complaints, 0 dissent, 0 problems. Utopia achieved.',
      reality: 'Everyone is gone. The newspaper continues to publish. For whom? No one asks.',
      category: 'spin',
    }),
  },

  // High vodka (> 100)
  {
    condition: (gs) => gs.vodka > 100,
    weight: 1.5,
    generate: (gs) => ({
      headline: `VODKA RESERVES AT ${gs.vodka} UNITS: MORALE INFRASTRUCTURE SECURE`,
      subtext: `Ministry of Spirits confirms: nation can withstand ${Math.floor(gs.vodka / gs.pop || 1)}-day morale siege.`,
      reality: `Workers operating at blood-vodka level of ${(gs.vodka / Math.max(1, gs.pop)).toFixed(1)}%. Productivity: debatable.`,
      category: 'production',
    }),
  },

  // No power but has buildings that need it
  {
    condition: (gs) => gs.power === 0 && gs.buildings.length > 0,
    weight: 2.5,
    generate: () => ({
      headline: 'NATIONWIDE LIGHTS-OUT EVENT CELEBRATES EARTH HOUR (EXTENDED INDEFINITELY)',
      subtext:
        'Citizens report improved night vision. Some claim to see in the dark. KGB notes this ability.',
      reality:
        'Power grid collapsed. Engineers "working on it" since last month. The engineers may also have collapsed.',
      category: 'spin',
    }),
  },

  // Many gulags
  {
    condition: (gs) => gs.buildings.filter(isGulag).length >= 2,
    weight: 2,
    generate: (gs) => {
      const gulagCount = gs.buildings.filter(isGulag).length;
      return {
        headline: `${gulagCount} ATTITUDE ADJUSTMENT FACILITIES OPERATING AT FULL CAPACITY`,
        subtext: `Graduates report: "I have never been happier." (Statement certified by facility director.)`,
        reality: `${gulagCount} gulags. Combined capacity: impressive. Combined humanity: debatable.`,
        category: 'editorial',
      };
    },
  },

  // Very large population (> 200)
  {
    condition: (gs) => gs.pop > 200,
    weight: 1,
    generate: (gs) => ({
      headline: `POPULATION BOOM: ${gs.pop} CITIZENS PROVE SOCIALIST PARADISE IS MAGNETS FOR MASSES`,
      subtext: `Immigration office overwhelmed. (It is one man with a stamp. He is very tired.)`,
      reality: `${gs.pop} citizens. Housing for ${gs.buildings.reduce((sum, b) => sum + Math.max(0, getBuildingDef(b.defId)?.stats.housingCap ?? 0), 0)}. The math is not discussed.`,
      category: 'triumph',
    }),
  },

  // Game year > 1990 (late game)
  {
    condition: (gs) => gs.date.year > 1990,
    weight: 1.5,
    generate: (gs) => ({
      headline: `YEAR ${gs.date.year}: ${pick([
        'RUMORS OF REFORM DISMISSED AS WESTERN PROPAGANDA',
        'SYSTEM DECLARED "ETERNAL" FOR 47TH CONSECUTIVE YEAR',
        'REPORT OF "CHANGES" DENIED: NOTHING HAS CHANGED',
        'PERESTROIKA? NEVER HEARD OF IT. SOUNDS CAPITALIST',
        'THE 1990S ARE THE NEW 1950S, DECLARES MINISTRY',
      ])}`,
      subtext: 'The future is certain. It is the past that keeps changing.',
      reality: 'Cracks in the system visible from space. Also visible: the wall. Also cracking.',
      category: 'editorial',
    }),
  },

  // Quota almost due
  {
    condition: (gs) =>
      gs.quota.deadlineYear - gs.date.year <= 1 && gs.quota.current < gs.quota.target,
    weight: 3,
    generate: (gs) => {
      const pct = Math.floor((gs.quota.current / gs.quota.target) * 100);
      return {
        headline: `FIVE-YEAR PLAN ${pct}% COMPLETE WITH ${pick(['MONTHS', 'WEEKS', 'DAYS', 'MOMENTS'])} TO SPARE`,
        subtext: `Remaining ${100 - pct}% to be achieved through ${pick(['a miracle', 'creative accounting', 'redefining the goal', 'sheer willpower', 'retroactive adjustment'])}`,
        reality: `Quota deadline: ${gs.quota.deadlineYear}. Current year: ${gs.date.year}. Current: ${gs.quota.current}/${gs.quota.target}. Someone should panic.`,
        category: 'production',
      };
    },
  },
];

// ─────────────────────────────────────────────────────────
//  SPIN DOCTOR: turn event effects into propaganda subtext
// ─────────────────────────────────────────────────────────

const SPIN_PREFIXES: Record<string, readonly string[]> = {
  money_loss: [
    'VOLUNTARY FISCAL CONTRIBUTION:',
    'ECONOMIC REDISTRIBUTION ACHIEVED:',
    'TREASURY GENEROUSLY SHARES WITH THE PEOPLE:',
    'INVESTMENT IN FUTURE PROSPERITY:',
    'RUBLES LIBERATED FROM BOURGEOIS CONCEPT OF "SAVINGS":',
  ],
  money_gain: [
    'SOCIALIST ECONOMY THRIVES:',
    'RUBLE SURPLUS DISCOVERED:',
    'FINANCIAL MIRACLE IN SECTOR 7G:',
    'MONEY SPONTANEOUSLY APPEARS (AS MARX PREDICTED):',
    'TREASURY SELF-REPLENISHES THROUGH SHEER IDEOLOGY:',
  ],
  food_loss: [
    'DIET PROGRAM SUCCEEDS:',
    'CALORIC INTAKE OPTIMIZED:',
    'CITIZENS EMBRACE INTERMITTENT FASTING:',
    'FOOD INVENTORY STREAMLINED:',
    'AGRICULTURAL OUTPUT STRATEGICALLY REDISTRIBUTED:',
    'SURPLUS APPETITE CHANNELED INTO PRODUCTIVITY:',
  ],
  food_gain: [
    'BOUNTIFUL HARVEST:',
    'AGRICULTURAL TRIUMPH:',
    'POTATO SCIENCE PAYS OFF:',
    'NATURE SUBMITS TO SOCIALIST FARMING:',
    'TURNIPS GROW OUT OF SHEER PATRIOTISM:',
  ],
  pop_loss: [
    'POPULATION STREAMLINED:',
    'WORKFORCE EFFICIENCY IMPROVED:',
    'CITIZENS VOLUNTEER FOR REMOTE ASSIGNMENT:',
    'DEMOGRAPHIC OPTIMIZATION ACHIEVED:',
    'HEADCOUNT CORRECTED PER SCIENTIFIC FORMULA:',
  ],
  pop_gain: [
    'POPULATION BOOM:',
    'SOCIALIST PARADISE ATTRACTS NEW RESIDENTS:',
    'DEMOGRAPHIC VICTORY:',
    'NEW COMRADES ARRIVE DRAWN BY REPORTS OF CONCRETE:',
    'IMMIGRATION SURGE PROVES SUPERIORITY OF SYSTEM:',
  ],
  vodka_loss: [
    'SOBRIETY INITIATIVE PROCEEDS ON SCHEDULE:',
    'VODKA RESERVES STRATEGICALLY DEPLOYED:',
    'CITIZENS DEMONSTRATE RESTRAINT (INVOLUNTARILY):',
    'MORALE FLUID CONSUMED IN SERVICE OF THE PEOPLE:',
    'ESSENTIAL SPIRITS SACRIFICED FOR GREATER GOOD:',
  ],
  vodka_gain: [
    'SPIRITS INDUSTRY FLOURISHES:',
    'MORALE SUPPLY REPLENISHED:',
    'ESSENTIAL FLUID RESERVES BOLSTERED:',
    'VODKA PRODUCTION: THE ONE QUOTA WE ALWAYS MEET:',
    'LIQUID ENTHUSIASM STOCKPILE GROWS:',
  ],
  power_loss: [
    'ENERGY CONSERVATION PROGRAM ACTIVATED:',
    'CANDLELIGHT APPRECIATION WEEK BEGINS:',
    'WORKERS EMBRACE DARKNESS (FIGURATIVELY AND LITERALLY):',
    'POWER GRID ACHIEVES MINIMALIST CONFIGURATION:',
    'ELECTRICITY TAKING WELL-DESERVED REST:',
  ],
  power_gain: [
    'ENERGY ABUNDANCE:',
    'POWER GRID SURGES WITH REVOLUTIONARY ENERGY:',
    'WATTS FLOW LIKE VODKA AT A PARTY CONGRESS:',
  ],
} as const;

function spinKey(key: string): string {
  const options = SPIN_PREFIXES[key];
  return options ? pick(options) : 'STATE UPDATE:';
}

/** Format a single effect value with propaganda spin. */
function spinEffect(
  value: number | undefined,
  key: string,
  lossUnit: string,
  gainUnit: string
): string | null {
  if (!value) return null;
  if (value < 0) return `${spinKey(`${key}_loss`)} ${Math.abs(value)} ${lossUnit}`;
  return `${spinKey(`${key}_gain`)} +${value} ${gainUnit}`;
}

function spinEventEffects(event: GameEvent): string {
  const fx = event.effects;
  const parts = [
    spinEffect(fx.money, 'money', 'rubles invested in future', 'rubles'),
    spinEffect(fx.food, 'food', 'units redistributed', 'units'),
    spinEffect(fx.pop, 'pop', 'citizens reassigned', 'new comrades'),
    spinEffect(fx.vodka, 'vodka', 'units consumed for the people', 'units'),
    spinEffect(fx.power, 'power', 'MW conserved', 'MW unleashed'),
  ].filter((p): p is string => p !== null);

  if (parts.length === 0) {
    return pick([
      'No material changes. The State remains perfect.',
      'All metrics stable. Stability is our greatest product.',
      'Numbers unchanged. Numbers were already ideal.',
      'Status quo maintained. The quo has never been better.',
    ]);
  }

  return parts.join(' | ');
}

// ─────────────────────────────────────────────────────────
//  HEADLINE COMPOSITION ENGINE
//
//  Selects from generator pools with weighted randomness,
//  preferring contextual generators when game state is
//  interesting. Falls back to generic generators otherwise.
// ─────────────────────────────────────────────────────────

const ALL_GENERIC_GENERATORS: { generators: HeadlineGenerator[]; weight: number }[] = [
  { generators: externalThreatGenerators, weight: 2.5 },
  { generators: internalTriumphGenerators, weight: 2.0 },
  { generators: leaderPraiseGenerators, weight: 1.5 },
  { generators: culturalVictoryGenerators, weight: 1.5 },
  { generators: resourceSpinGenerators, weight: 1.0 },
  { generators: weatherFillerGenerators, weight: 1.5 },
];

function generateHeadline(gs: GameState): GeneratedHeadline {
  // First, check contextual generators (state-reactive)
  const eligibleContextual = contextualGenerators.filter((cg) => cg.condition(gs));

  // 40% chance to use a contextual generator if any are eligible
  if (eligibleContextual.length > 0 && coinFlip(0.4)) {
    const totalWeight = eligibleContextual.reduce((sum, cg) => sum + cg.weight, 0);
    let roll = (_rng?.random() ?? Math.random()) * totalWeight;
    for (const cg of eligibleContextual) {
      roll -= cg.weight;
      if (roll <= 0) {
        return cg.generate(gs);
      }
    }
    // Fallback to first eligible
    return eligibleContextual[0]!.generate(gs);
  }

  // Otherwise, pick from generic generator pools
  const totalWeight = ALL_GENERIC_GENERATORS.reduce((sum, g) => sum + g.weight, 0);
  let roll = (_rng?.random() ?? Math.random()) * totalWeight;
  for (const pool of ALL_GENERIC_GENERATORS) {
    roll -= pool.weight;
    if (roll <= 0) {
      return pick(pool.generators)(gs);
    }
  }

  // Ultimate fallback
  return pick(weatherFillerGenerators)(gs);
}

// ─────────────────────────────────────────────────────────
//  EVENT-REACTIVE HEADLINE GENERATOR
//
//  When a game event fires, this generates a Pravda-style
//  headline that reframes the event through propaganda.
//  The event already has a pravdaHeadline field, but this
//  system can also generate a FRESH spin on any event.
// ─────────────────────────────────────────────────────────

function generateEventReactiveHeadline(event: GameEvent, gs: GameState): GeneratedHeadline {
  // For bad events, sometimes generate an external threat headline
  // to distract from internal problems (the classic Pravda move)
  if (event.type === 'bad' && coinFlip(0.35)) {
    const distraction = pick(externalThreatGenerators)(gs);
    return {
      ...distraction,
      // Append a subtle reference to the actual event
      subtext: `${distraction.subtext} (Unrelated: minor ${event.category} adjustment in progress.)`,
    };
  }

  // For disaster events, sometimes spin the destruction as urban renewal
  if (event.category === 'disaster' && coinFlip(0.3)) {
    return {
      headline: pick(DESTRUCTION_SPINS),
      subtext: `${pick(INSTITUTIONS)} confirms: this was always the plan. The plan is flexible.`,
      reality: event.description,
      category: 'triumph',
    };
  }

  // For catastrophic events, ALWAYS distract with external threats
  if (event.severity === 'catastrophic') {
    const distraction = pick(externalThreatGenerators)(gs);
    return {
      ...distraction,
      subtext: `ALERT: ${pick(WESTERN_COUNTRIES)} threatens peace. All domestic matters: handled.`,
      reality: `Meanwhile: ${event.description}`,
    };
  }

  // For good events, amplify the triumph
  if (event.type === 'good') {
    return {
      headline: `${pick(INSTITUTIONS)} CONFIRMS: ${event.pravdaHeadline}`,
      subtext: `${pick(LEADER_TITLES)} personally ensured this outcome ${pick(QUALIFIERS).toLowerCase()}.`,
      reality: event.description,
      category: 'triumph',
    };
  }

  // Default: use the event's built-in headline with generated spin
  return {
    headline: event.pravdaHeadline,
    subtext: spinEventEffects(event),
    reality: event.description,
    category: categoryFromEvent(event.category),
  };
}

function categoryFromEvent(eventCat: EventCategory): HeadlineCategory {
  switch (eventCat) {
    case 'disaster':
      return 'triumph'; // disasters are reframed as triumphs
    case 'political':
      return 'editorial';
    case 'economic':
      return 'production';
    case 'cultural':
      return 'culture';
    case 'absurdist':
      return pick(['editorial', 'weather', 'culture'] as const);
    default:
      return 'editorial';
  }
}

// ─────────────────────────────────────────────────────────
//  PRAVDA SYSTEM CLASS
//
//  Public API is fully backward-compatible with the old
//  hardcoded system. SimulationEngine and EventSystem
//  call the same methods, but now get procedurally
//  generated headlines instead of fixed templates.
// ─────────────────────────────────────────────────────────

export class PravdaSystem {
  private headlineHistory: PravdaHeadline[] = [];
  private lastHeadlineTime = 0;
  private headlineCooldown = 45000; // 45 seconds between ambient headlines
  /** Track recent headline patterns to avoid repetition */
  private recentCategories: HeadlineCategory[] = [];
  private maxCategoryMemory = 6;

  constructor(
    private gameState: GameState,
    rng?: GameRng
  ) {
    if (rng) _rng = rng;
  }

  /**
   * Generate a Pravda headline from a game event.
   * May reframe the event entirely (e.g., catastrophe -> external threat distraction).
   */
  public headlineFromEvent(event: GameEvent): PravdaHeadline {
    const generated = generateEventReactiveHeadline(event, this.gameState);
    const headline: PravdaHeadline = {
      ...generated,
      timestamp: Date.now(),
    };
    this.recordHeadline(headline);
    return headline;
  }

  /**
   * Generate a random ambient headline not tied to a specific event.
   * Called periodically to keep the news ticker alive.
   */
  public generateAmbientHeadline(): PravdaHeadline | null {
    const now = Date.now();
    if (now - this.lastHeadlineTime < this.headlineCooldown) return null;

    // Generate candidates and avoid recent category repetition
    let generated: GeneratedHeadline;
    let attempts = 0;
    do {
      generated = generateHeadline(this.gameState);
      attempts++;
    } while (
      attempts < 5 &&
      this.recentCategories.length >= 2 &&
      this.recentCategories.slice(-2).every((c) => c === generated.category)
    );

    const headline: PravdaHeadline = {
      ...generated,
      timestamp: now,
    };

    this.recordHeadline(headline);
    this.lastHeadlineTime = now;
    return headline;
  }

  /** Get headline history for a scrolling ticker */
  public getRecentHeadlines(count = 10): PravdaHeadline[] {
    return this.headlineHistory.slice(-count);
  }

  /** Get the formatted "newspaper front page" string */
  public formatFrontPage(): string {
    const latest = this.headlineHistory.slice(-3);
    if (latest.length === 0) return 'PRAVDA: NO NEWS IS GOOD NEWS. ALL NEWS IS GOOD NEWS.';

    const lines = latest.map((h) => `\u2605 ${h.headline}`);
    return `PRAVDA | ${this.gameState.date.year}\n${lines.join('\n')}`;
  }

  // ── private ──────────────────────────────────────────

  private recordHeadline(headline: PravdaHeadline): void {
    this.headlineHistory.push(headline);
    this.recentCategories.push(headline.category);
    if (this.recentCategories.length > this.maxCategoryMemory) {
      this.recentCategories.shift();
    }
  }
}
