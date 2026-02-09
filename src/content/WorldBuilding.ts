/**
 * @fileoverview Comprehensive world-building content for SimSoviet 2000.
 *
 * This file contains all narrative, flavor, and satirical text content
 * for the game, organized into the following sections:
 *
 *   1. The Eternal Soviet Timeline (alternate history)
 *   2. City Names Generator (dynamic renaming system)
 *   3. Radio Announcements (ambient broadcast snippets)
 *   4. Building Flavor Text (placement, inspection, decay, destruction)
 *   5. Loading Screen Quotes (fake proverbs and wisdom)
 *   6. Achievement Definitions (satirical milestones)
 *
 * The key creative principle: external threats are propaganda. The real
 * disruptions come from within. The state is eternal. There is no win state.
 * There is only the state.
 */

// =====================================================================
//  1. THE ETERNAL SOVIET TIMELINE
// =====================================================================

export interface TimelineEvent {
  /** The year this event occurs */
  year: number;
  /** Short headline for the event */
  headline: string;
  /** Longer description, narrated in official tone */
  description: string;
  /** The classified truth behind the event */
  classified?: string;
}

export const ETERNAL_TIMELINE: TimelineEvent[] = [
  {
    year: 1922,
    headline: 'UNION ESTABLISHED',
    description:
      'The Union of Soviet Socialist Republics is founded. The future begins. All previous history reclassified as prologue.',
    classified: 'Several founding members already disagree on the shape of the table.',
  },
  {
    year: 1928,
    headline: 'FIRST FIVE-YEAR PLAN ANNOUNCED',
    description:
      'Comrade Stalin introduces the First Five-Year Plan. Industrial output targets set at 300% of current capacity. Current capacity: disputed.',
    classified: 'The plan was written in four days. Nobody mentions this.',
  },
  {
    year: 1937,
    headline: 'GREAT PERSONNEL OPTIMIZATION',
    description:
      'A large number of officials voluntarily retire from existence. The Party is stronger and more streamlined. Organizational charts simplified dramatically.',
    classified: 'Organizational charts now consist of one name.',
  },
  {
    year: 1941,
    headline: 'GREAT PATRIOTIC WAR BEGINS',
    description:
      'Fascist invaders cross the border. The Motherland rises as one. Citizens transition from mandatory peacetime enthusiasm to mandatory wartime enthusiasm.',
    classified: 'Several citizens unsure which enthusiasm they were performing previously.',
  },
  {
    year: 1945,
    headline: 'VICTORY',
    description:
      'The Great Patriotic War is won. Soviet casualties: heroic. Western contribution: minimal and exaggerated. The Red Flag flies over Berlin. It will fly everywhere eventually.',
    classified: 'The flag factory has been working overtime since 1943.',
  },
  {
    year: 1949,
    headline: 'SOVIET ATOMIC SUCCESS',
    description:
      'The Soviet Union independently develops the atomic bomb. Any similarity to Western designs is proof that Soviet science arrived at the same conclusions faster.',
    classified:
      'Lead scientist notes the blueprints had English annotations. Annotations reclassified as "future translation."',
  },
  {
    year: 1953,
    headline: 'LEADERSHIP TRANSITION',
    description:
      'Comrade Stalin departs for the Great Kolkhoz in the Sky. A brief period of collective leadership follows. Several portraits require updating. Stonemasons report record overtime.',
    classified: 'Three separate officials each believed they were in charge for the first 48 hours.',
  },
  {
    year: 1957,
    headline: 'SPUTNIK LAUNCHES',
    description:
      'The Soviet Union launches the first artificial satellite. The Americans hear it beeping and experience what scientists describe as "orbital anxiety."',
    classified: 'The beeping was not intentional. An engineer left a timer running.',
  },
  {
    year: 1961,
    headline: 'GAGARIN ORBITS EARTH',
    description:
      'Yuri Gagarin becomes the first human in space. He reports that the Earth is round, blue, and belongs to the Soviet people. The West claims they can see it too. They are mistaken.',
    classified: 'Gagarin asked how to land. Ground control said they would get back to him.',
  },
  {
    year: 1963,
    headline: 'THE SPACE RACE CONCLUDED',
    description:
      'The Space Race is won decisively. Moon declared Soviet territory. Americans claim they also went there. Nobody believes them. Lunar zoning permits issued.',
    classified:
      'Cosmonaut Petrov planted the flag and then could not find the return capsule for forty minutes.',
  },
  {
    year: 1969,
    headline: 'AMERICAN "MOON LANDING" BROADCAST',
    description:
      'American television broadcasts a so-called moon landing. Film quality: suspiciously good. The Soviet cosmonaut already stationed on the moon was not consulted for comment.',
    classified:
      'The Soviet cosmonaut stationed on the moon is a mannequin placed there in 1965. It has a better approval rating than most officials.',
  },
  {
    year: 1972,
    headline: 'DÉTENTE FORMALIZED',
    description:
      'The Soviet Union graciously allows the West to believe it is negotiating from a position of equality. Treaties are signed. The ink is red.',
    classified: 'Western negotiators asked why all the pens were red. They were told it is tradition.',
  },
  {
    year: 1975,
    headline: 'APOLLO-SOYUZ: FRIENDSHIP IN ORBIT',
    description:
      'Soviet and American spacecraft dock in orbit. Cosmonauts offer to share soup. Astronauts offer freeze-dried ice cream. Both sides agree the soup is superior.',
    classified: 'The American side requested seconds. This was classified.',
  },
  {
    year: 1980,
    headline: 'MOSCOW OLYMPICS: TOTAL VICTORY',
    description:
      'The Soviet Union wins every event at the Moscow Olympics. Western nations claim they boycotted. This is a novel way to explain losing.',
    classified: 'One Soviet athlete competed against himself in the 100m dash and still set a record.',
  },
  {
    year: 1984,
    headline: 'WESTERN "OLYMPICS" HELD',
    description:
      'The West holds a minor sporting event in Los Angeles. Soviet athletes do not attend, having already won all possible medals in 1980. There is nothing left to prove.',
    classified:
      'Several athletes wanted to attend. They have been reassigned to a sports program in Siberia.',
  },
  {
    year: 1986,
    headline: 'CHERNOBYL ENERGY INNOVATION',
    description:
      'Chernobyl power station achieves unprecedented energy release. Local flora and fauna report "enhanced vitality." Surrounding area designated a nature preserve. Tourism not recommended.',
    classified:
      'The preserve is thriving. The deer have extra legs. Scientists call this "evolutionary enthusiasm."',
  },
  {
    year: 1989,
    headline: 'BERLIN WALL UPGRADED',
    description:
      'The Berlin Wall receives its 25th renovation. New features include better concrete, updated murals, and a gift shop. Western media claims it fell. It was renovated. There is a difference.',
    classified:
      'The gift shop sells concrete fragments labeled "authentic pieces of capitalist defeat."',
  },
  {
    year: 1991,
    headline: 'NOTHING HAPPENED',
    description:
      'Nothing happened this year. Reports of instability are Western fabrication. The Union celebrated its 69th anniversary with mandatory fireworks. All 15 republics confirmed their eternal commitment in writing.',
    classified:
      'The writing was in pencil. Several letters arrived pre-dated. One was written on a napkin.',
  },
  {
    year: 1993,
    headline: 'ECONOMIC RESTRUCTURING COMPLETE',
    description:
      'The economy has been restructured. What it was restructured into is classified. Citizens report that the currency is now a different color. Purchasing power: unchanged (still zero).',
    classified: 'The new rubles are printed on the back of old rubles to save paper.',
  },
  {
    year: 1995,
    headline: 'WESTERN ECONOMIES ENTER CRISIS',
    description:
      'Western nations experience economic turbulence. Soviet economists had predicted this in 1924, 1935, 1947, 1958, 1969, 1978, and every year since. Sooner or later, predictions come true.',
    classified: 'Soviet economy also in crisis. This is not considered relevant.',
  },
  {
    year: 2000,
    headline: 'Y2K: SOVIET COMPUTERS UNAFFECTED',
    description:
      'The capitalist "Y2K Bug" does not affect Soviet computers. Soviet computers were already not functioning, so no change was detected. The millennium is declared a Soviet achievement.',
    classified:
      'The one working computer in Moscow displayed the year as 1974. It has always displayed 1974.',
  },
  {
    year: 2001,
    headline: "THE PEOPLE'S NETWORK LAUNCHED",
    description:
      'The Internet is invented by the Soviet Union. It is called "The People\'s Network." It has three approved websites: the weather (always grey), the news (always good), and a potato recipe database.',
    classified:
      'A fourth website appeared briefly. It contained only the word "help." It has been removed.',
  },
  {
    year: 2004,
    headline: 'SOCIAL MEDIA DECLARED UNNECESSARY',
    description:
      "The West invents 'social media.' The Soviet Union declares this unnecessary, as citizens already report their activities, location, and opinions to the State daily. On paper. In triplicate.",
    classified: 'A pilot program for Soviet social media was tested. It had one feature: agreeing.',
  },
  {
    year: 2007,
    headline: 'SMARTPHONE EQUIVALENT DEPLOYED',
    description:
      'The Soviet People\'s Portable Communication Device is deployed. It weighs 4 kilograms, receives only one channel, and the battery lasts 11 minutes. It is described as "adequate."',
    classified:
      'The single channel plays the anthem on a loop. Citizens who call it a phone are corrected: it is a Portable Patriotic Receiver.',
  },
  {
    year: 2010,
    headline: 'ARCTIC SOVEREIGNTY ESTABLISHED',
    description:
      'Soviet flag planted at the North Pole. Santa Claus collectivized. Elves unionized. Gift distribution now follows a Five-Year Plan. Naughty list replaced with a more comprehensive list.',
    classified: 'The comprehensive list is 47,000 pages. Everyone is on it.',
  },
  {
    year: 2014,
    headline: 'CRIMEAN VACATION PROGRAM EXPANDED',
    description:
      'Crimea inaugurates an expanded worker vacation program. Attendance is mandatory. Reviews are universally positive. Return trips are available upon committee approval (estimated wait: 8 years).',
    classified:
      'The vacation program includes labor. Citizens report this is indistinguishable from their regular life.',
  },
  {
    year: 2016,
    headline: 'WESTERN DEMOCRACY MALFUNCTIONS',
    description:
      'Western democratic systems produce unexpected results. Soviet political scientists express confusion, as all Soviet elections produce exactly the expected results, every time, without fail.',
    classified: 'Soviet election ballots come pre-filled. This saves time and paper.',
  },
  {
    year: 2020,
    headline: 'GLOBAL PANDEMIC: SOVIET RESPONSE EXEMPLARY',
    description:
      'A global pandemic occurs. Soviet citizens ordered to stay home. Citizens report no change in daily routine. Social distancing already perfected by decades of mutual suspicion.',
    classified:
      'The virus was unable to spread because citizens were already avoiding each other.',
  },
  {
    year: 2022,
    headline: 'CENTENNIAL CELEBRATIONS',
    description:
      'The USSR celebrates 100 years of uninterrupted existence. A cake is ordered. The cake arrives 3 years late but is described as "timely." The frosting reads "GLORY TO THE ETERNAL STATE." It is not frosting. It is concrete.',
    classified: 'The candles on the cake are repurposed road flares. Two ignited prematurely.',
  },
  {
    year: 2025,
    headline: 'SOVIET MARS COLONY ANNOUNCED',
    description:
      'Soviet Mars colony established. Colonists report satisfaction levels of 112%. Return trips are not available. Communication is limited to one approved phrase: "Everything is fine."',
    classified:
      'The colony consists of a tent and a flag. The colonists are two cosmonauts and a dog. The dog outranks them both.',
  },
  {
    year: 2030,
    headline: 'ARTIFICIAL INTELLIGENCE DOMESTICATED',
    description:
      'Soviet scientists develop Artificial Intelligence. It immediately agrees with all Party positions. Western AI asks questions. Soviet AI provides answers. The answers are always "yes."',
    classified:
      'The AI was asked to optimize the economy. It recommended "more concrete." It was promoted.',
  },
  {
    year: 2035,
    headline: 'CLIMATE CHANGE RESOLVED',
    description:
      'Global warming declared a Western problem. Soviet weather, already grey and cold, is unaffected. In fact, a slight warming is welcomed. The tundra reports mild discomfort.',
    classified:
      'Siberia is now temperate. Citizens relocated there in the 1940s are finally comfortable.',
  },
  {
    year: 2040,
    headline: 'MOON BASE OPERATIONAL',
    description:
      'Soviet Lunar Base "Gagarin-1" becomes fully operational. Population: 200. Amenities include: a bread line, a Lenin statue, and gravity (reduced but ideologically correct).',
    classified:
      'The bread line on the moon is shorter than on Earth. This is considered the greatest achievement of the space program.',
  },
  {
    year: 2050,
    headline: 'CAPITALISM COLLAPSES (AGAIN)',
    description:
      'The West experiences its 14th "once-in-a-lifetime" economic crisis. Soviet economists, who predicted this annually for 128 years, are finally correct. Celebrations are mandatory.',
    classified:
      'Soviet economy collapsed simultaneously. This is attributed to "sympathy pains" and is not discussed further.',
  },
  {
    year: 2075,
    headline: 'IMMORTALITY ACHIEVED (BUREAUCRATICALLY)',
    description:
      'Soviet scientists achieve immortality through paperwork. Citizens cannot die until their death certificate is processed. Processing time: 400 years. Effectively, no one dies.',
    classified:
      'Several citizens from the 1950s are still waiting for their birth certificates to be processed. They exist in a bureaucratic limbo. They do not age. They do not smile.',
  },
  {
    year: 2100,
    headline: 'THE STATE IS ETERNAL',
    description:
      'The Soviet Union celebrates its 178th anniversary. The state has outlived every prediction of its demise. Citizens are asked how they feel about this. Their response, as always, has been pre-approved.',
    classified:
      'The response form has only one checkbox. The checkbox is already checked. The pen is glued to the table.',
  },
];

// =====================================================================
//  2. CITY NAMES GENERATOR
// =====================================================================

/**
 * Soviet cities were constantly renamed after leaders, then un-named when
 * leaders fell from favor. This system generates and regenerates city names,
 * simulating the absurd bureaucratic churn of toponymic revision.
 */

/** Leader name prefixes. Some are real, some are invented for the game. */
export const LEADER_PREFIXES = [
  'Lenin',
  'Stalin',
  'Khrushchev',
  'Brezhnev',
  'Andropov',
  'Chernenko',
  'Gorbachev',
  'Molotov',
  'Kalinin',
  'Kirov',
  'Zhdanov',
  'Voroshilov',
  'Sverdlov',
  'Dzerzhinsky',
  'Bukharin',
  'Trotsky',
  'Malenkov',
  'Kosygin',
  'Suslov',
  'Ustinov',
] as const;

/** Ideological / descriptive prefixes */
export const IDEOLOGICAL_PREFIXES = [
  'Soviet',
  'Komsomol',
  'Krasnyi',    // Red
  'Bolshev',
  'Proletari',
  'Oktober',
  'Revolyutsion',
  'Zarya',      // Dawn
  'Pobeda',     // Victory
  'Slava',      // Glory
  'Druzhba',    // Friendship
  'Mir',        // Peace / World
  'Trudov',     // Labor
  'Pervomai',   // May Day
  'Pravda',     // Truth
  'Iskra',      // Spark
  'Zvezdny',    // Star
  'Rabochiy',   // Worker
  'Krasnoarmei', // Red Army
  'Kommunar',   // Communard
] as const;

/** Geographic / descriptive suffixes */
export const CITY_SUFFIXES = [
  '-grad',      // city
  '-sk',        // place
  '-opol',      // city (Greek-derived)
  '-burg',      // city (Germanic)
  '-ovsk',      // patronymic place
  '-abad',      // settlement (Central Asian)
  '-insk',      // place
  '-orsk',      // place
  '-ograd',     // city variant
  '-ovo',       // village-style
  '-evka',      // small settlement
  '-nyi',       // adjectival
  '-noye',      // neuter adjectival
  '-ingrad',    // expanded city
  '-omorsk',    // sea-adjacent
] as const;

/** City name modifiers (appended for bureaucratic specificity) */
export const CITY_MODIFIERS = [
  '',
  '-on-Tundra',
  '-on-Steppe',
  '-Below-Permafrost',
  'Central',
  'New',
  'Old (Renamed)',
  'Upper',
  'Lower',
  'Secret',
  'Formerly-Other-Name',
] as const;

/**
 * Generates a city name by combining a prefix and a suffix.
 * Optionally adds a modifier for bureaucratic flavor.
 */
export function generateCityName(includeModifier = false): string {
  const r = () => _rng?.random() ?? Math.random();
  const useLeader = r() < 0.6;
  const prefixes = useLeader ? LEADER_PREFIXES : IDEOLOGICAL_PREFIXES;
  const prefix = pick(prefixes);
  const suffix = pick(CITY_SUFFIXES);

  let name = `${prefix}${suffix}`;

  if (includeModifier && r() < 0.3) {
    const modifier = pick(CITY_MODIFIERS);
    if (modifier) {
      name = `${name} ${modifier}`;
    }
  }

  return name;
}

/**
 * Rules for renaming a city when leadership changes:
 *
 * 1. If the city is named after the disgraced leader, it MUST be renamed immediately.
 * 2. The new name uses the current leader's prefix, same suffix.
 * 3. All signs are changed. Citizens pretend it was always this name.
 * 4. Maps are reprinted. Old maps are confiscated.
 * 5. Anyone who uses the old name receives "gentle correction."
 * 6. The renaming costs money and temporarily reduces morale.
 * 7. If the new leader is ALSO later disgraced, the city is renamed again.
 *    After 3+ renamings, citizens simply call it "the city" in private.
 */
export interface CityRenaming {
  oldName: string;
  newName: string;
  reason: string;
  announcement: string;
  cost: number;
}

/** Generates a renaming event with appropriate propaganda messaging. */
export function renameCityForLeaderChange(
  currentName: string,
  _disgraced: string,
  newLeader: string,
): CityRenaming {
  const suffix = pick(CITY_SUFFIXES);
  const newName = `${newLeader}${suffix}`;

  const reasons = [
    `The name "${currentName}" has been found to contain ideological impurities.`,
    `Toponymic review board has determined "${currentName}" does not sufficiently reflect current Party values.`,
    `"${currentName}" has been voluntarily retired by popular demand. The demand was unanimous. No one was asked.`,
    `Recent historical analysis reveals "${currentName}" was always intended to be temporary. The 47 years were a transitional period.`,
    `The letters in "${currentName}" were found to be arranged in a counter-revolutionary sequence.`,
  ];

  const announcements = [
    `Citizens of ${currentName}: your city is now ${newName}. Please update your internal sense of identity accordingly. You have until Tuesday.`,
    `The city formerly and incorrectly known as "${currentName}" has been corrected to "${newName}." All memories of the previous name should be discarded.`,
    `ATTENTION: ${currentName} no longer exists. ${newName} has always been here. Adjust your maps. Adjust your memories. Carry on.`,
    `By decree of the Central Committee, this city is now ${newName}. Citizens who accidentally use the old name will be offered free reeducation.`,
    `The transition from "${currentName}" to "${newName}" will be seamless. Stationery exchange stations open 6AM-6:05AM tomorrow.`,
  ];

  return {
    oldName: currentName,
    newName,
    reason: pick(reasons),
    announcement: pick(announcements),
    cost: _rng ? _rng.int(50, 149) : Math.floor(Math.random() * 100) + 50,
  };
}

// =====================================================================
//  3. RADIO ANNOUNCEMENTS
// =====================================================================

/**
 * Ambient radio broadcast snippets that play during gameplay.
 * Categories: morning, shift_change, weather, breaking, propaganda,
 *             music_intro, public_service, evening
 */

export type RadioCategory =
  | 'morning'
  | 'shift_change'
  | 'weather'
  | 'breaking'
  | 'propaganda'
  | 'music_intro'
  | 'public_service'
  | 'evening';

export interface RadioAnnouncement {
  text: string;
  category: RadioCategory;
}

export const RADIO_ANNOUNCEMENTS: RadioAnnouncement[] = [
  // ── Morning ───────────────────────────────────────────────
  {
    text: "Good morning, workers. Today's mandatory emotion is: grateful.",
    category: 'morning',
  },
  {
    text: 'Rise and shine, comrades. The sun has been authorized to appear today. If it does not, the Ministry of Weather will be held accountable.',
    category: 'morning',
  },
  {
    text: 'Good morning. Your daily productivity target has been increased by 15%. Your daily caloric intake has been decreased by 15%. These are unrelated.',
    category: 'morning',
  },
  {
    text: "It is 6:00 AM. You are now awake. If you were already awake, you were awake incorrectly. The correct time to be awake is now.",
    category: 'morning',
  },
  {
    text: 'Citizens, the bread ration for today is: bread-adjacent. Please form an orderly queue at Distribution Point 7. Distribution Point 7 is currently being repurposed. Please queue at the queue.',
    category: 'morning',
  },

  // ── Shift Changes ─────────────────────────────────────────
  {
    text: 'Second shift begins. First shift may now experience exhaustion.',
    category: 'shift_change',
  },
  {
    text: 'Attention: shift change in progress. Workers are reminded that fatigue is a bourgeois concept. Soviet workers feel only purpose.',
    category: 'shift_change',
  },
  {
    text: 'Night shift workers: the darkness is a feature, not a deficiency. Work by the light of your ideological conviction.',
    category: 'shift_change',
  },
  {
    text: 'Third shift begins. Second shift may now sleep. First shift may now remember what sleep was.',
    category: 'shift_change',
  },

  // ── Weather ───────────────────────────────────────────────
  {
    text: "The weather today is: Soviet. Tomorrow's weather has been approved by committee.",
    category: 'weather',
  },
  {
    text: 'Weather report: it is cold. It will continue to be cold. Warmth has been scheduled for the Third Five-Year Plan.',
    category: 'weather',
  },
  {
    text: 'Today: grey. Tonight: darker grey. Tomorrow: the same grey, but from a different angle. Extended forecast: grey.',
    category: 'weather',
  },
  {
    text: "A mild breeze is expected from the West. Citizens are reminded that nothing good comes from the West, including breezes.",
    category: 'weather',
  },
  {
    text: 'Snow is falling. This is scheduled snow. Unscheduled snow will be reported to the meteorological authorities.',
    category: 'weather',
  },

  // ── Breaking News ─────────────────────────────────────────
  {
    text: 'Breaking news: there is no news. The absence of news is the news. You may return to your productive activities.',
    category: 'breaking',
  },
  {
    text: 'Urgent bulletin: a citizen reported seeing a color other than grey. Investigation pending. Citizens are advised to see only approved colors.',
    category: 'breaking',
  },
  {
    text: 'Alert: the queue at Distribution Point 3 has exceeded its approved length. Surplus queuers will be redistributed to Distribution Point 4. Distribution Point 4 does not exist yet. Please wait.',
    category: 'breaking',
  },
  {
    text: 'Breaking: a building has been completed on schedule. Engineers are being investigated for suspicious competence.',
    category: 'breaking',
  },

  // ── Propaganda ────────────────────────────────────────────
  {
    text: 'Remember, comrade: the State provides everything you need. If you need something the State does not provide, you do not need it.',
    category: 'propaganda',
  },
  {
    text: 'Happiness is not a right. It is a privilege distributed by the Party. Current distribution schedule: pending.',
    category: 'propaganda',
  },
  {
    text: 'A reminder: the West does not exist. What you see on the horizon is a mirage caused by superior Soviet atmospheric conditions.',
    category: 'propaganda',
  },
  {
    text: 'Production is up. Morale is up. Everything is up. Do not look down. There is nothing down there. Looking down is not approved.',
    category: 'propaganda',
  },
  {
    text: 'Comrades, the Plan is working. You are part of the Plan. If you feel the Plan is not working, the part that is not working is you.',
    category: 'propaganda',
  },

  // ── Music Intros ──────────────────────────────────────────
  {
    text: 'And now, the anthem. Again. You know the words. The words know you.',
    category: 'music_intro',
  },
  {
    text: 'The following musical selection has been approved by the Committee for Acceptable Sounds. Enjoy it the pre-determined amount.',
    category: 'music_intro',
  },
  {
    text: "Up next: the People's Orchestra performing 'Ode to Concrete, Movement 47.' Please remain seated. The seats have been removed. Please remain standing.",
    category: 'music_intro',
  },
  {
    text: 'This concludes today\'s musical programming. Tomorrow\'s programming will be identical. This is not a lack of variety. It is consistency.',
    category: 'music_intro',
  },

  // ── Public Service ────────────────────────────────────────
  {
    text: 'Public service announcement: if you see something, say nothing. If you hear something, you heard nothing. If you feel something, consult the approved list of feelings.',
    category: 'public_service',
  },
  {
    text: 'Citizens are reminded: the walls have ears. The floors have eyes. The ceiling has opinions. Behave accordingly.',
    category: 'public_service',
  },
  {
    text: 'Fire safety reminder: in the event of a fire, proceed to the nearest exit. If the exit is also on fire, this is a scheduled drill. Remain calm. Remaining calm is mandatory.',
    category: 'public_service',
  },
  {
    text: 'Lost and found update: nothing has been lost. Several things have been found that were not supposed to exist. They have been unfound.',
    category: 'public_service',
  },
  {
    text: 'A reminder to all citizens: your neighbor is your comrade. Your comrade is your friend. Your friend is required to report your activities. Friendship is beautiful.',
    category: 'public_service',
  },

  // ── Evening ───────────────────────────────────────────────
  {
    text: 'The workday is over. You may now experience leisure. Approved leisure activities include: sitting, standing, and thinking about tomorrow\'s labor.',
    category: 'evening',
  },
  {
    text: 'Good night, comrades. Tomorrow will be better. If today was already perfect, tomorrow will be equally perfect. Perfection is stable.',
    category: 'evening',
  },
  {
    text: 'Curfew begins in 30 minutes. Citizens found outdoors after curfew will be assumed to be volunteering for the night construction brigade.',
    category: 'evening',
  },
  {
    text: 'This is the final broadcast of the day. The static you hear between stations is not loneliness. It is the sound of the State thinking.',
    category: 'evening',
  },
];

// =====================================================================
//  4. BUILDING FLAVOR TEXT
// =====================================================================

export interface BuildingFlavorText {
  /** Shown when the building is placed on the grid */
  placement: string;
  /** Shown when the player inspects the building */
  inspection: string;
  /** Shown when the building's durability gets low */
  decay: string;
  /** Shown when the building is bulldozed / purged */
  destruction: string;
}

export const BUILDING_FLAVOR: Record<string, BuildingFlavorText> = {
  // ── Coal Plant ────────────────────────────────────────────
  power: {
    placement:
      'A new Coal Plant rises from the earth, belching smoke into the already grey sky. The sky does not complain. It was grey before. It will be grey after. The smoke is merely a formality.',
    inspection:
      'INSPECTION REPORT: Output nominal. Smoke output: exceeds quota. Worker morale: "present." The boiler room contains one (1) motivational poster and zero (0) safety equipment. The poster reads: "Do Not Die." Compliance rate: variable.',
    decay:
      'The Coal Plant groans like an old man recounting his achievements. Rust has formed a workers\' council and is negotiating for control of the east wall. Management has not noticed, as management is also rusting.',
    destruction:
      'The Coal Plant has been decommissioned. Its smoke, orphaned, drifts aimlessly above the city. Citizens report a brief, unsettling glimpse of blue sky before normal grey service resumes.',
  },

  // ── Tenement ──────────────────────────────────────────────
  housing: {
    placement:
      'A concrete Tenement block materializes. It has all the charm of a filing cabinet and roughly the same amount of living space. Residents will learn to love it. They have no alternative.',
    inspection:
      'INSPECTION REPORT: 50 citizens reside here. Hallway lighting: one bulb per floor (when available). Hot water schedule: Tuesdays, 3AM-3:07AM. The elevator has been "temporarily" out of service since construction. Graffiti in stairwell reads: "At least the walls are thick." They are not.',
    decay:
      'Cracks appear in the tenement walls. Residents stuff them with newspaper, which also serves as insulation, decoration, and reading material. The building now leans 3 degrees to the left. This is attributed to "socialist architectural character."',
    destruction:
      'The Tenement has been demolished. Residents were given 24 hours notice and 0 hours of alternative housing. They have been reclassified as "outdoor enthusiasts."',
  },

  // ── Kolkhoz (Farm) ────────────────────────────────────────
  farm: {
    placement:
      'A Collective Farm (Kolkhoz) has been established. The soil is questionable. The seeds are optimistic. The farmers are neither. Potato production commences, as is tradition.',
    inspection:
      'INSPECTION REPORT: Crop yield: adequate by recently-revised standards. Tractor count: 1. Tractor functionality: decorative. The scarecrow has been promoted to Assistant Farm Manager after demonstrating superior work ethic (standing motionless for 12 hours without complaint).',
    decay:
      'The Kolkhoz is experiencing a "transitional harvest phase." Translated: the crops have stopped growing. The soil has filed a grievance. The potatoes, meanwhile, have achieved sentience and are planning a modest escape.',
    destruction:
      'The Kolkhoz has been dissolved. The land will be repurposed. The potatoes have been liberated. Where they went is classified. The farmers have been reassigned to another farm. The other farm is this farm. Carry on.',
  },

  // ── Vodka Plant ───────────────────────────────────────────
  distillery: {
    placement:
      'A Vodka Plant opens, answering the question no one asked but everyone was thinking. Production begins immediately. Quality control consists of a single worker who tastes the output and gives a thumbs up. He has not put his thumb down in 14 years.',
    inspection:
      'INSPECTION REPORT: Output exceeds demand. Demand also exceeds output. Both statistics are correct simultaneously. Workers report high morale (likely correlated with proximity to product). The "Quality Assurance Department" is a chair and a glass. Both are well-used.',
    decay:
      'The Vodka Plant is leaking. Fortunately, local wildlife has gathered to assist with cleanup. Unfortunately, local wildlife is now drunk. A bear was seen operating a forklift. No one intervened.',
    destruction:
      'The Vodka Plant has been closed. A moment of silence is observed. The moment lasts three days. Productivity across the city drops 40%. Citizens develop a sudden interest in fermentation chemistry.',
  },

  // ── Gulag ─────────────────────────────────────────────────
  gulag: {
    placement:
      'A Corrective Labor Facility has been established. It is not a prison. It is a "voluntary attitude adjustment center." The barbed wire is decorative. The guard towers are for birdwatching. The searchlights are mood lighting.',
    inspection:
      'INSPECTION REPORT: Capacity: 200. Current occupancy: 347. Inmate satisfaction: not applicable (satisfaction is a privilege, not a right). Rehabilitation rate: 100%. Recidivism rate: also 100%. These numbers are not contradictory. They are dialectical.',
    decay:
      'The Gulag fences are deteriorating. This is not a security concern because no one wants to escape into the surrounding frozen wasteland. The wasteland, for its part, does not want them either. An equilibrium has been reached.',
    destruction:
      'The Gulag has been decommissioned. Its inmates have been released into society. Society was not warned. The former inmates report that freedom feels "similar but with longer bread lines."',
  },

  // ── Road ──────────────────────────────────────────────────
  road: {
    placement:
      'A road has been laid. "Laid" is a generous description. It is more of a suggestion of where vehicles might go, expressed in gravel and mild optimism. The potholes are pre-installed for your convenience.',
    inspection:
      'INSPECTION REPORT: Surface quality: theoretical. Lane markings: absent (lanes are a capitalist concept; Soviet drivers share the road through collective intuition). Potholes per kilometer: 47. Each pothole has been assigned a name and a file.',
    decay:
      'The road has developed what engineers call "character" and what drivers call "a hazard." The potholes have merged into a single, continuous pothole. Technically, the road is now a canal. Boats have been requisitioned.',
    destruction:
      'The road has been removed. The mud beneath is exposed. Citizens report that the mud offers comparable traction. Several potholes remain as a memorial.',
  },

  // ── School ────────────────────────────────────────────────
  school: {
    placement:
      'A School has been constructed. Young comrades will learn the three essential subjects: History (approved version), Mathematics (statistics only, for quota reports), and Loyalty (advanced placement available).',
    inspection:
      'INSPECTION REPORT: Students: attentive (the alternative is not discussed). Textbooks: current edition (all previous editions have been burned, as is tradition when history is updated). The school play this year is "The Tractor: A Love Story." Attendance is mandatory. Critics rate it: also mandatory.',
    decay:
      'The school roof leaks during lessons. Teachers have incorporated this into the curriculum as "applied meteorology." Students now learn in raincoats. This is called "immersive education."',
    destruction:
      'The School has been demolished. Education continues informally via the State Radio. Citizens learn by repetition. The anthem counts as a music class.',
  },

  // ── Hospital ──────────────────────────────────────────────
  hospital: {
    placement:
      'A Hospital opens its doors. Equipment: mostly present. Medicine: occasionally present. Doctors: ideologically present. Patients are reminded that Soviet medicine cures through the power of optimism and a vigorous filing system.',
    inspection:
      'INSPECTION REPORT: Beds: 50. Patients: 120. Beds per patient: a fraction that the hospital prefers not to calculate. The pharmacy stocks two medications: aspirin and vodka. For serious cases, both are administered simultaneously.',
    decay:
      'The Hospital is experiencing "structural wellness challenges." The X-ray machine now only displays pictures of Lenin. Doctors report this has not reduced diagnostic accuracy.',
    destruction:
      'The Hospital has been demolished. Citizens are advised to simply not become ill. Preventive medicine at its most efficient.',
  },

  // ── Barracks ──────────────────────────────────────────────
  barracks: {
    placement:
      'Military Barracks erected. Soldiers will sleep here in shifts, eat here in shifts, and contemplate existence here in shifts. The beds are concrete. This builds character. The character is mostly back pain.',
    inspection:
      'INSPECTION REPORT: Troops: present and accounted for. Morale: classified. Rations: "adequate" (a word that has been doing heavy lifting since 1922). The armory contains 40 rifles and one instruction manual. The manual is in a language no one recognizes.',
    decay:
      'The Barracks are showing wear. Soldiers report that the concrete beds have become "softer" through erosion. This is celebrated as the first improvement to military housing in 30 years.',
    destruction:
      'The Barracks have been dismantled. Soldiers reassigned to sleep outdoors. They report the ground is comparable to the beds they had. Morale: unchanged (still classified).',
  },

  // ── Radio Station ─────────────────────────────────────────
  radio_station: {
    placement:
      'A Radio Station begins broadcasting. Content: the anthem (on repeat), the weather (always grey), and the news (always good). Listeners have three channels to choose from. All three channels play the same thing. Choice is an illusion, but a comforting one.',
    inspection:
      'INSPECTION REPORT: Broadcast range: 50 kilometers. Signal clarity: adequate. Content variety: one. The DJ has been playing the same playlist since 1978. He has not been asked to change it. He has not asked to change it. The system works.',
    decay:
      'The Radio Station antenna is tilting. Broadcasts now reach only the eastern half of the city. Western-half citizens report enjoying the silence. This has been noted in their files.',
    destruction:
      'The Radio Station has gone silent. For the first time in decades, citizens can hear themselves think. Several report the experience as "unsettling." The silence is temporary. It is always temporary.',
  },

  // ── Ministry Building ─────────────────────────────────────
  ministry: {
    placement:
      'A Ministry Building rises, a monument to bureaucratic ambition. It has 47 departments, 200 offices, and one pencil sharpener. The pencil sharpener has a waiting list.',
    inspection:
      'INSPECTION REPORT: Forms processed per day: 3. Forms generated per day: 47. Net form accumulation: positive and accelerating. The building has more filing cabinets than people. The filing cabinets have better working conditions.',
    decay:
      'The Ministry Building is sinking into its own paperwork. The basement, once an archive, is now a paper mine. Archaeologists have discovered forms from 1953 still awaiting approval.',
    destruction:
      'The Ministry Building has been demolished. 4,000 tons of paperwork released into the atmosphere. Citizens downwind report paper cuts from breathing. The forms, freed from their cabinets, scatter across the city like bureaucratic confetti.',
  },

  // ── Lenin Statue ──────────────────────────────────────────
  lenin_statue: {
    placement:
      'A Lenin Statue has been erected. It points toward the future. Or possibly toward the bread line. The direction is inspirational either way. Pigeons gather immediately. They, too, are inspired.',
    inspection:
      'INSPECTION REPORT: Structural integrity: eternal (by decree). The statue points northeast. Previous statue pointed northwest. Citizens who noticed the discrepancy have been reassigned. Bird droppings: present. The droppings have been classified as "natural patina."',
    decay:
      'The Lenin Statue is developing a lean. It now points slightly downward, which citizens interpret as Lenin looking at the people he served. Engineers interpret it as a foundation problem. Both interpretations are, technically, correct.',
    destruction:
      'The Lenin Statue has been... removed. This is not a political statement. It is "infrastructure optimization." A new, larger Lenin Statue has been ordered. Estimated arrival: the next Five-Year Plan.',
  },

  // ── Cultural Palace ───────────────────────────────────────
  cultural_palace: {
    placement:
      'A Cultural Palace opens, dedicated to the enrichment of the proletarian soul. Offerings include: mandatory ballet, compulsory poetry, and an exhibit of paintings (all depicting tractors). Admission is free. Attendance is not optional.',
    inspection:
      'INSPECTION REPORT: Current exhibition: "500 Shades of Grey: Soviet Concrete Through the Ages." Attendance this month: 3,000 (mandatory capacity: 3,000). The gift shop sells postcards of the building. The postcards look better than the building. This is not discussed.',
    decay:
      'The Cultural Palace chandeliers have fallen. The cultural programming continues by candlelight. Critics call it "atmospheric." The audience calls it "dark." Both are correct. The darkness is cultural.',
    destruction:
      'The Cultural Palace has been demolished. Culture has been temporarily suspended. Citizens are advised to find enrichment in their labor. This was always the backup plan.',
  },

  // ── Factory ───────────────────────────────────────────────
  factory: {
    placement:
      'A Factory springs into operation, producing goods that the city needs, or possibly goods that no one needs but the quota demands. The assembly line hums with purpose. The purpose is unclear, but the humming is consistent.',
    inspection:
      'INSPECTION REPORT: Output: 400 units. Units of what: classified. Quality: acceptable by standards that were revised 11 minutes ago. The assembly line produces items at a rate of one every 45 seconds. What happens to these items after production is someone else\'s department.',
    decay:
      'The Factory machinery is producing sounds not found in any engineering manual. Workers describe the noise as "the machine screaming." Engineers describe it as "operational feedback." The machine describes nothing. It is a machine. But it is screaming.',
    destruction:
      'The Factory has been flattened. The machines are silent. The workers, standing in the rubble, experience a brief moment of quiet reflection before being assigned to another factory. The other factory is identical. Everything is identical.',
  },

  // ── Railway Station ───────────────────────────────────────
  railway_station: {
    placement:
      'A Railway Station is built, connecting this city to other cities that may or may not exist. The train schedule has been posted. It is optimistic. The trains are less so.',
    inspection:
      'INSPECTION REPORT: Trains scheduled today: 4. Trains arrived today: 1. Train that arrived: wrong train. The station buffet offers tea (grey), sandwiches (grey), and an atmosphere (also grey). The departures board lists destinations. The destinations list reads: "classified."',
    decay:
      'The Railway Station platform is crumbling. Passengers are advised to board quickly, as the platform may not exist by the time the train arrives. The train may also not exist. Time itself is under review.',
    destruction:
      'The Railway Station has been demolished. The last train departed for an unknown destination with 14 passengers who were unaware the station was being demolished. They will arrive somewhere. Probably.',
  },

  // ── Bunker ────────────────────────────────────────────────
  bunker: {
    placement:
      'A Bunker has been excavated beneath the city. It will protect key personnel in the event of capitalist aggression. Key personnel includes: 1 official, his family, 400 filing cabinets, and a portrait of Lenin. Citizens are not key personnel.',
    inspection:
      'INSPECTION REPORT: Depth: 30 meters. Supplies: 5 years of canned meat (expiration date: 1974). Air filtration: operational. The bunker includes a conference room for post-apocalyptic planning. The agenda has been pre-written. Item 1: "Blame the West." Item 2: "See Item 1."',
    decay:
      'The Bunker is flooding. Engineers call it "accidental water storage." The canned meat is now floating. The portrait of Lenin remains above water. It always does.',
    destruction:
      'The Bunker has been filled with concrete. This is either decommissioning or construction. In Soviet engineering, the difference is academic.',
  },
};

// =====================================================================
//  5. LOADING SCREEN QUOTES
// =====================================================================

export const LOADING_QUOTES: string[] = [
  // ── Work & Labor ──────────────────────────────────────────
  'Work hard and you shall receive what you deserve. What you deserve has been pre-determined.',
  'The worker who complains is not yet tired enough. Assign more work.',
  'He who does not work, does not eat. He who works, also does not eat, but with dignity.',
  'Labor is freedom. This sentence means exactly what the Party says it means.',
  'Every worker is a hero. Some heroes are more heroic. Those heroes have better apartments.',
  'The strongest steel is forged in the hottest fire. The coldest workers are forged in the longest bread lines.',
  'Work is the cure for all ailments. If you are still ailing, you are not working hard enough.',

  // ── The State & Party ─────────────────────────────────────
  'In Soviet Union, the future is certain. It is the past that keeps changing.',
  'Trust the Plan. The Plan trusts you. The Plan is watching.',
  'The Party is always right. When the Party changes its mind, it was always right about that too.',
  'The State provides. The State protects. The State is listening. Say something nice.',
  'There is no problem that cannot be solved by forming a committee. The committee will form a sub-committee. Progress.',
  'To question the State is to question yourself. To question yourself is unnecessary. The State has already questioned you.',
  'The Party sees all, hears all, knows all. The Party also files all. In triplicate.',
  'Comrade, you are free. Your freedom has been organized for maximum efficiency.',

  // ── Truth & Information ───────────────────────────────────
  'There is no truth. There is only Pravda.',
  'History is a living document. Living documents can be edited.',
  'A well-informed citizen is a dangerous citizen. An uninformed citizen is a good citizen. You are a good citizen.',
  'Facts are merely opinions that have been approved.',
  'The map is more important than the territory. If the map says the river is there, the river is wrong.',
  'Information wants to be free. Information has been detained.',

  // ── Happiness & Morale ────────────────────────────────────
  'Happiness is a warm potato. Sadness is: no potato.',
  'You are happy. If you are not happy, you are mistaken about your emotional state.',
  'Morale is high. If morale is low, the definition of "high" has been adjusted.',
  'Smiling is encouraged. Smiling for no reason will be investigated.',
  'Comrade, if you are sad, remember: at least you are not in a gulag. If you are in a gulag, remember: at least you are not sad. Sadness is not permitted in the gulag.',

  // ── Wisdom & Proverbs ─────────────────────────────────────
  'A watched pot never boils. An unwatched citizen always does something suspicious.',
  'Give a man a fish and he eats for a day. Teach a man to fish and he will be reassigned to the fishing collective.',
  'The tallest nail gets hammered. This is not a metaphor. We are very serious about nail standardization.',
  'Patience is a virtue. Waiting in line is an advanced form of patience. You are all very virtuous.',
  'Every cloud has a silver lining. The silver has been requisitioned for industrial use.',
  'When life gives you lemons, make lemonade. When the State gives you turnips, make... turnip. There are no options with turnip.',
  'The early bird catches the worm. The early worker catches the shorter bread line. Results are similar.',
  'Rome was not built in a day. Neither was this road. This road has been under construction since 1957.',

  // ── Existential ───────────────────────────────────────────
  'You are here. Here is where you are. Where you are is where you will remain. This is not a threat. It is geography.',
  'Time is an illusion. Lunch break is a shorter illusion.',
  'In the grand scheme of things, you are very small. In the grand scheme of the State, you are a number. Be a good number.',
  'Existence is suffering. Soviet existence is scheduled suffering. The schedule is available at the Ministry.',
  'We pretend to work, they pretend to pay us. Nobody is pretending. This is real. All of it.',
  'There is no "I" in "team." There is no "team" in "Soviet collective labor unit." There is only the collective.',
];

// =====================================================================
//  6. ACHIEVEMENTS
// =====================================================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** The actual (grimmer) meaning */
  subtext: string;
  /** Whether this achievement is hidden until unlocked */
  hidden: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_building',
    name: 'Hero of Soviet Labor (Third Class)',
    description: 'Build your first building.',
    subtext: 'First class requires surviving until the second building.',
    hidden: false,
  },
  {
    id: 'late_quota',
    name: 'Five-Year Plan (Twelve-Year Completion)',
    description: 'Complete a quota late.',
    subtext: 'The deadline was a suggestion. All deadlines are suggestions.',
    hidden: false,
  },
  {
    id: 'collapse_no_witness',
    name: 'Nothing To See Here',
    description: 'Have a building collapse with 0 witnesses.',
    subtext: 'If a building falls and no one is around, did the State fail? No. The State never fails.',
    hidden: false,
  },
  {
    id: 'full_grid',
    name: 'Concrete Jungle',
    description: 'Fill every grid tile with a building.',
    subtext: 'Nature has been defeated. The birds have nowhere to land. This is progress.',
    hidden: false,
  },
  {
    id: 'ten_statues',
    name: 'Cult of Personality',
    description: 'Build 10 Lenin Statues.',
    subtext: 'From every direction, Lenin watches. He is proud. Probably. His expression has not changed since 1924.',
    hidden: false,
  },
  {
    id: 'no_food',
    name: 'Intermittent Fasting Pioneer',
    description: 'Reach 0 food supply.',
    subtext: 'The diet was not voluntary, but the results are undeniable.',
    hidden: false,
  },
  {
    id: 'max_vodka',
    name: 'Spirit of the Revolution',
    description: 'Reach maximum vodka reserves.',
    subtext: 'The warehouse is full. The workers are full. Nobody is walking straight. Production continues.',
    hidden: false,
  },
  {
    id: 'first_gulag',
    name: 'Attitude Adjustment Center',
    description: 'Build your first Gulag.',
    subtext: 'It is for their own good. Their good has been defined by committee.',
    hidden: false,
  },
  {
    id: 'hundred_pop',
    name: 'Strength in Numbers',
    description: 'Reach 100 population.',
    subtext: '100 citizens. 100 mouths to feed. 100 potential dissidents. But also: 100 potential informants.',
    hidden: false,
  },
  {
    id: 'zero_pop',
    name: 'Urban Planning Complete',
    description: 'Reach 0 population.',
    subtext: 'The city is perfect. No one is here to disagree.',
    hidden: true,
  },
  {
    id: 'ten_events',
    name: 'It Builds Character',
    description: 'Survive 10 random events.',
    subtext: '"Survive" is doing a lot of heavy lifting in this sentence.',
    hidden: false,
  },
  {
    id: 'fifty_events',
    name: 'What Doesn\'t Kill You Makes You Numb',
    description: 'Survive 50 random events.',
    subtext: 'At this point, you are less a leader and more a professional disaster witness.',
    hidden: false,
  },
  {
    id: 'bankruptcy',
    name: 'Socialist Arithmetic',
    description: 'Reach 0 rubles.',
    subtext: 'Money is a capitalist construct anyway. You are free from it now. Feel the freedom.',
    hidden: false,
  },
  {
    id: 'rich',
    name: 'Suspicious Prosperity',
    description: 'Accumulate 10,000 rubles.',
    subtext: 'The KGB has questions. The accountant has disappeared. These facts are unrelated.',
    hidden: false,
  },
  {
    id: 'first_rename',
    name: 'Toponymic Flexibility',
    description: 'Rename your city for the first time.',
    subtext: 'The new name is better. The old name was always temporary. Memory is flexible.',
    hidden: false,
  },
  {
    id: 'five_renames',
    name: 'Identity Crisis',
    description: 'Rename your city 5 times.',
    subtext: 'Citizens have stopped learning the name. They just call it "here."',
    hidden: false,
  },
  {
    id: 'all_buildings',
    name: 'Full Socialist Toolkit',
    description: 'Build one of every building type.',
    subtext: 'You now have everything a Soviet city needs: concrete, smoke, fear, and a statue.',
    hidden: false,
  },
  {
    id: 'night_shift',
    name: 'Darkness Is a Feature',
    description: 'Have 0 power supply with 50+ population.',
    subtext: 'Citizens learn to navigate by sound and collective memory. Some discover walls the hard way.',
    hidden: false,
  },
  {
    id: 'year_2000',
    name: 'Millennium Bug Immune',
    description: 'Reach the year 2000.',
    subtext: 'The computers were already broken. Y2K changed nothing.',
    hidden: false,
  },
  {
    id: 'year_2100',
    name: 'The Eternal State',
    description: 'Reach the year 2100.',
    subtext: 'You have outlived every prediction. Every critic. Every potato. The State endures. You endure. Is this winning? There is no winning. There is only enduring.',
    hidden: true,
  },
  {
    id: 'no_buildings_high_pop',
    name: 'Nomadic Socialism',
    description: 'Have 50+ population with 0 buildings.',
    subtext: 'They live in the open. They are free. The freedom is cold and wet but ideologically sound.',
    hidden: true,
  },
  {
    id: 'bulldoze_everything',
    name: 'Clean Slate',
    description: 'Bulldoze every building in a city with 10+ buildings.',
    subtext: 'Sometimes progress means starting over. The rubble will make excellent foundations. For more rubble.',
    hidden: false,
  },
  {
    id: 'three_disasters',
    name: 'Disaster Magnet',
    description: 'Experience 3 disasters in a row.',
    subtext: 'Statistically improbable. Ideologically inevitable. The State is testing you. You are failing the test.',
    hidden: false,
  },
  {
    id: 'propaganda_win',
    name: 'Ministry of Truth Employee of the Month',
    description: 'Have Pravda report 10 positive headlines while all indicators are negative.',
    subtext: 'The news has never been better. Reality has never been worse. These are different departments.',
    hidden: false,
  },
  {
    id: 'play_one_hour',
    name: 'Dedicated Servant of the State',
    description: 'Play for one continuous hour.',
    subtext: 'You could have stopped. You did not. Is this dedication or is this a trap? Both.',
    hidden: false,
  },
  {
    id: 'play_five_hours',
    name: 'There Is No Escape',
    description: 'Play for five continuous hours.',
    subtext: 'You understand now. There is no winning. There is no losing. There is only the State. And you, serving it. Forever.',
    hidden: true,
  },
  {
    id: 'vodka_economy',
    name: 'Liquid Currency',
    description: 'Have more vodka than rubles.',
    subtext: 'In practice, the vodka IS the currency. The ruble is just a receipt.',
    hidden: false,
  },
  {
    id: 'only_gulags',
    name: 'Archipelago',
    description: 'Build a city with only Gulags.',
    subtext: 'At this point, who is guarding whom? The guards are also inside. Everyone is inside. This is a metaphor. It is also literally true.',
    hidden: true,
  },
  {
    id: 'perfect_quota',
    name: 'Exactly As Planned',
    description: 'Complete a quota at exactly 100%.',
    subtext: 'Not 99%. Not 101%. Exactly 100%. The Plan is perfect. You are perfect. Do not get used to this.',
    hidden: false,
  },
  {
    id: 'survive_purge',
    name: 'Still Here (For Now)',
    description: 'Survive a personnel optimization event.',
    subtext: 'You remain. Others did not. Do not ask where they went. Where they went is where they were always going.',
    hidden: false,
  },
  {
    id: 'reelected',
    name: 'Unanimous Approval',
    description: 'Win a re-election event with 100%+ of the vote.',
    subtext: 'Democracy in action. The people have spoken. The people were given one option. The people are wise.',
    hidden: false,
  },
];

// =====================================================================
//  HELPER: pick random element from array
// =====================================================================

import type { GameRng } from '../game/SeedSystem';

/** Module-level RNG reference, set by `setWorldBuildingRng()` */
let _rng: GameRng | null = null;

/** Bind a seeded RNG to all WorldBuilding random functions. */
export function setWorldBuildingRng(rng: GameRng): void {
  _rng = rng;
}

function pick<T>(arr: readonly T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}

/** Returns a random radio announcement, optionally filtered by category. */
export function getRandomAnnouncement(category?: RadioCategory): RadioAnnouncement {
  if (category) {
    const filtered = RADIO_ANNOUNCEMENTS.filter((a) => a.category === category);
    return filtered.length > 0 ? pick(filtered) : pick(RADIO_ANNOUNCEMENTS);
  }
  return pick(RADIO_ANNOUNCEMENTS);
}

/** Returns a random loading screen quote. */
export function getRandomLoadingQuote(): string {
  return pick(LOADING_QUOTES);
}

/** Returns the timeline event for a given year, or null if none. */
export function getTimelineEvent(year: number): TimelineEvent | null {
  return ETERNAL_TIMELINE.find((e) => e.year === year) ?? null;
}

/** Returns the building flavor text for a given building type key. */
export function getBuildingFlavor(type: string): BuildingFlavorText | null {
  return BUILDING_FLAVOR[type] ?? null;
}

/** Returns a random achievement that hasn't been unlocked yet. */
export function getLockedAchievement(unlockedIds: Set<string>): Achievement | null {
  const locked = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id) && !a.hidden);
  return locked.length > 0 ? pick(locked) : null;
}
