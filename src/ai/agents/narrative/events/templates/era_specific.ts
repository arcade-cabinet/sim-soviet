/**
 * @module game/events/templates/era_specific
 *
 * Era-specific event templates — events that only fire during particular
 * historical eras. Each era gets 2-4 signature events that capture its
 * unique tensions and absurdities.
 *
 * Era mapping (EraId → era theme):
 *   revolution        — Revolution, civil war chaos, survival
 *   collectivization  — Forced collectivization, kulak purges
 *   industrialization — Five-year plans, Great Terror, rapid industry
 *   great_patriotic   — WWII, conscription, rationing, bombardment
 *   reconstruction    — Post-war rebuilding, veteran integration, rubble salvage
 *   thaw_and_freeze   — De-Stalinization, cultural freedom, then re-freeze
 *   stagnation        — Decay, vodka economy, queues, corruption, reform chaos
 *   stagnation        — Stagnation, shortages, bureaucratic sclerosis
 */

import type { EventTemplate } from '../types';

export const ERA_SPECIFIC_EVENTS: EventTemplate[] = [
  // ── WAR COMMUNISM (1922-1928) ──────────────────────────

  {
    id: 'bandit_raid',
    title: 'BANDIT RAID',
    description:
      'Armed bandits attack the settlement perimeter. They take food and disappear into the forest. ' +
      'The local militia was eating lunch. The bandits knew this.',
    pravdaHeadline: 'COUNTER-REVOLUTIONARY ELEMENTS BRIEFLY INCONVENIENCE SETTLEMENT',
    category: 'disaster',
    severity: 'major',
    effects: (gs) => ({ food: -Math.min(30, Math.floor(gs.food * 0.2)), pop: -1 }),
    condition: (gs) => gs.food > 20,
    eraFilter: ['revolution'],
    weight: 1.5,
  },
  {
    id: 'requisition_squad',
    title: 'REQUISITION SQUAD',
    description:
      'A requisition squad arrives demanding grain for distant industrial centers. ' +
      'They have rifles. You have turnips. The negotiation is brief.',
    pravdaHeadline: 'VOLUNTARY GRAIN CONTRIBUTION EXCEEDS ALL EXPECTATIONS',
    category: 'political',
    severity: 'major',
    effects: (gs) => ({ food: -Math.min(40, Math.floor(gs.food * 0.3)) }),
    condition: (gs) => gs.food > 30,
    eraFilter: ['revolution'],
    weight: 1.2,
  },

  // ── COLLECTIVIZATION (1922-1932) — dedicated events ────

  {
    id: 'forced_farm_liquidation',
    title: 'AGRICULTURAL REORGANIZATION',
    description:
      'Officials arrive to liquidate the remaining private farms. The word "liquidation" ' +
      'has been carefully chosen. Farmers are informed that their land, tools, livestock, ' +
      'and opinions now belong to the collective. The farmers have thoughts about this. ' +
      'The officials have rifles. The meeting is short.',
    pravdaHeadline: 'PEASANTRY JOYFULLY SURRENDERS PRIVATE PROPERTY TO THE COLLECTIVE',
    category: 'political',
    severity: 'major',
    effects: (gs) => ({
      food: -Math.min(25, Math.floor(gs.food * 0.2)),
      pop: -Math.min(5, Math.floor(gs.pop * 0.04)),
    }),
    condition: (gs) => gs.food > 20,
    eraFilter: ['collectivization'],
    weight: 1.8,
  },
  {
    id: 'grain_seizure_famine',
    title: 'REQUISITION FULFILLED',
    description:
      'The quarterly grain quota has been met. Surplus grain has been collected as well, ' +
      'to ensure the quota is met again next quarter. The settlement now has no grain. ' +
      'This is not a problem. The problem is that you have not yet filled out the form ' +
      'explaining why there is no grain.',
    pravdaHeadline: 'HEROIC GRAIN COLLECTION EXCEEDS STATE TARGETS BY MEANINGFUL MARGIN',
    category: 'economic',
    severity: 'catastrophic',
    effects: (gs) => ({
      food: -Math.min(50, Math.floor(gs.food * 0.6)),
    }),
    condition: (gs) => gs.food > 40,
    eraFilter: ['collectivization'],
    weight: 1.4,
  },
  {
    id: 'kulak_deportation',
    title: 'RESETTLEMENT ACTION',
    description:
      'Families classified as kulaks are loaded onto carts and transported east. ' +
      'The definition of kulak was expanded last week to include anyone with a metal ' +
      'plough, a wooden plough, or strong opinions about ploughs. The carts depart ' +
      'before dawn. Nobody is watching officially. Everyone watches.',
    pravdaHeadline: 'ANTI-SOVIET ELEMENTS RELOCATED TO PRODUCTIVE EASTERN DISTRICTS',
    category: 'political',
    severity: 'major',
    effects: (gs) => ({
      pop: -Math.min(10, Math.floor(gs.pop * 0.07)),
      food: -Math.min(15, Math.floor(gs.food * 0.12)),
    }),
    condition: (gs) => gs.pop > 25,
    eraFilter: ['collectivization'],
    weight: 1.5,
  },
  {
    id: 'collectivization_quota_pressure',
    title: 'COLLECTIVIZATION TARGETS REVISED UPWARD',
    description:
      'Moscow has revised the collectivization quota upward. It is now 110%. ' +
      'This number was arrived at scientifically. A committee has been tasked with ' +
      'determining what 110% of the farms means in practical terms. The committee ' +
      'is optimistic. The committee has never been to a farm.',
    pravdaHeadline: 'SETTLEMENT EMBRACES ACCELERATED SOCIALIST TRANSFORMATION PLAN',
    category: 'political',
    severity: 'minor',
    effects: { food: -10, pop: -1 },
    eraFilter: ['collectivization'],
    weight: 1.3,
  },
  {
    id: 'peasant_resistance',
    title: 'COUNTER-REVOLUTIONARY GRAIN CONCEALMENT',
    description:
      'Peasants are hiding grain. In floors, in walls, in the well, behind the icon, ' +
      'inside the icon, under the goat, inside the goat. Investigators are dispatched. ' +
      'The goat is considered a suspect. Three farmers have been arrested. The goat ' +
      'has been collectivized.',
    pravdaHeadline: 'WRECKERS FOILED BY VIGILANT COLLECTIVE SECURITY APPARATUS',
    category: 'absurdist',
    severity: 'minor',
    effects: (gs) => ({
      food: Math.min(12, Math.floor(gs.pop * 0.5)),
      pop: -2,
    }),
    condition: (gs) => gs.pop > 20,
    eraFilter: ['collectivization'],
    weight: 1.1,
  },
  {
    id: 'holodomor_shadow',
    title: 'HUNGER REPORT FILED',
    description:
      'The regional death registry is backlogged. Clerks are working through the night. ' +
      'A request to classify the deaths as "natural causes" has been submitted in triplicate. ' +
      'Moscow will note that the harvest numbers remain correct. The harvest numbers ' +
      'were always correct. The people are less certain.',
    pravdaHeadline: 'REGIONAL NUTRITION SITUATION SUBJECT TO ONGOING REVIEW',
    category: 'disaster',
    severity: 'catastrophic',
    effects: (gs) => ({
      pop: -Math.min(15, Math.floor(gs.pop * 0.12)),
      food: -Math.min(30, Math.floor(gs.food * 0.25)),
    }),
    condition: (gs) => gs.pop > 30 && gs.food < 30 && gs.date.year >= 1932,
    eraFilter: ['collectivization'],
    weight: 1.0,
  },

  // ── FIRST FIVE-YEAR PLANS (1928-1941) ──────────────────

  // ── FIRST FIVE-YEAR PLANS (1928-1941) ──────────────────

  {
    id: 'kulak_purge',
    title: 'KULAK IDENTIFICATION CAMPAIGN',
    description:
      'A campaign to identify kulaks begins. Anyone with two cows is suspect. ' +
      'Anyone with one cow and a fence is also suspect. The definition of kulak ' +
      'expands until it includes anyone who looks well-fed.',
    pravdaHeadline: 'CLASS ENEMIES UNMASKED IN HEROIC DEKULAKIZATION CAMPAIGN',
    category: 'political',
    severity: 'major',
    effects: (gs) => ({
      pop: -Math.min(8, Math.floor(gs.pop * 0.08)),
      food: -Math.min(20, Math.floor(gs.food * 0.15)),
    }),
    condition: (gs) => gs.pop > 30,
    eraFilter: ['collectivization', 'industrialization'],
    weight: 1.5,
  },
  {
    id: 'great_terror_wave',
    title: 'PERSONNEL OPTIMIZATION WAVE',
    description:
      'A wave of arrests sweeps the settlement. The charges are creative: ' +
      '"insufficient enthusiasm," "suspicious competence," "owning a suspicious hat." ' +
      'Nobody is sure who ordered this. Nobody asks.',
    pravdaHeadline: 'VIGILANT CITIZENS ROOT OUT ENEMIES OF THE PEOPLE',
    category: 'political',
    severity: 'catastrophic',
    effects: (gs) => ({
      pop: -Math.min(12, Math.floor(gs.pop * 0.1)),
    }),
    condition: (gs) => gs.pop > 40 && gs.date.year >= 1936,
    eraFilter: ['collectivization', 'industrialization'],
    weight: 0.8,
  },
  {
    id: 'stakhanovite_miracle',
    title: 'STAKHANOVITE ACHIEVEMENT',
    description:
      'A worker mines 102 tons of coal in a single shift, beating the record by 1300%. ' +
      'Investigation reveals 14 other workers helped. They have been reassigned. ' +
      'The hero has been given a medal. The medal is heavy. Like the coal.',
    pravdaHeadline: 'SOCIALIST LABOR HERO ACHIEVES HUMANLY IMPOSSIBLE OUTPUT',
    category: 'economic',
    severity: 'minor',
    effects: { food: 15, vodka: 5 },
    eraFilter: ['collectivization', 'industrialization'],
    weight: 0.7,
  },

  // ── GREAT PATRIOTIC WAR (1941-1945) ────────────────────

  {
    id: 'conscription_wave',
    title: 'CONSCRIPTION ORDER',
    description:
      'New conscription order received. Every able-bodied person between 18 and 50 ' +
      'is to report. The definition of "able-bodied" now includes people with only ' +
      'minor injuries. And people with moderate injuries. The quota must be met.',
    pravdaHeadline: 'PATRIOTS VOLUNTEER EN MASSE FOR DEFENSE OF MOTHERLAND',
    category: 'political',
    severity: 'catastrophic',
    effects: (gs) => ({
      pop: -Math.min(15, Math.floor(gs.pop * 0.15)),
    }),
    condition: (gs) => gs.pop > 20,
    eraFilter: ['great_patriotic'],
    weight: 2.0,
  },
  {
    id: 'bombardment',
    title: 'ENEMY BOMBARDMENT',
    description:
      'Enemy aircraft spotted overhead. Bombs fall on the settlement. ' +
      'Some buildings are damaged. The air raid shelter holds. ' +
      'The vodka reserves, miraculously, are untouched.',
    pravdaHeadline: 'SETTLEMENT HEROICALLY WITHSTANDS FASCIST AIR ATTACK',
    category: 'disaster',
    severity: 'catastrophic',
    effects: (gs) => ({
      pop: -Math.min(5, Math.floor(gs.pop * 0.05)),
      food: -Math.min(20, Math.floor(gs.food * 0.2)),
    }),
    condition: (gs) => gs.pop > 15,
    eraFilter: ['great_patriotic'],
    weight: 1.5,
  },
  {
    id: 'evacuee_arrival',
    title: 'EVACUEES ARRIVE',
    description:
      'A train of evacuees arrives from the western front. They bring nothing but ' +
      'themselves and stories you do not want to hear. They need food and shelter. ' +
      'You have very little of either. Welcome to collective solidarity.',
    pravdaHeadline: 'SETTLEMENT WARMLY WELCOMES RELOCATED WORKERS',
    category: 'economic',
    severity: 'minor',
    effects: { pop: 8, food: -15 },
    eraFilter: ['great_patriotic'],
    weight: 1.0,
  },

  // ── RECONSTRUCTION (1945-1953) ─────────────────────────

  {
    id: 'veteran_return',
    title: 'VETERANS RETURN',
    description:
      'Soldiers return from the front. They are different now. They have seen things. ' +
      'They do not discuss these things. They are excellent workers when the vodka holds out. ' +
      'The vodka does not always hold out.',
    pravdaHeadline: 'GLORIOUS HEROES REJOIN PRODUCTIVE WORKFORCE',
    category: 'economic',
    severity: 'minor',
    effects: { pop: 5, vodka: -10 },
    eraFilter: ['reconstruction'],
    weight: 1.2,
  },
  {
    id: 'rubble_salvage',
    title: 'RUBBLE SALVAGE SUCCESS',
    description:
      'Workers discover usable building materials in the war rubble. ' +
      'Also discovered: three unexploded bombs, a cat, and a pre-war sausage. ' +
      'The sausage has been reclassified as a structural material.',
    pravdaHeadline: 'RECONSTRUCTION YIELDS VALUABLE RESOURCES FROM HEROIC RUINS',
    category: 'economic',
    severity: 'minor',
    effects: { money: 50 },
    eraFilter: ['reconstruction'],
    weight: 1.0,
  },

  {
    id: 'postwar_housing_crisis',
    title: 'POSTWAR HOUSING SHORTAGE',
    description:
      'Twenty-three families have been assigned to a building with capacity for eight. ' +
      'A commission has determined that a family of four can live in fourteen square meters ' +
      'if they breathe in shifts. The commission does not live in fourteen square meters.',
    pravdaHeadline: 'COLLECTIVE LIVING ARRANGEMENTS FOSTER SOCIALIST SOLIDARITY',
    category: 'economic',
    severity: 'major',
    effects: (gs) => ({
      pop: -Math.min(4, Math.floor(gs.pop * 0.04)),
      food: -10,
    }),
    condition: (gs) => gs.pop > 25,
    eraFilter: ['reconstruction'],
    weight: 1.3,
  },
  {
    id: 'lysenko_decree',
    title: 'LYSENKOIST AGRICULTURAL DECREE',
    description:
      'A new agricultural decree arrives from Moscow, authored by Academician Lysenko. ' +
      'Planting must now follow the principles of vernalization and the inheritance of ' +
      'acquired characteristics. The crops have not been informed. The crops are unmoved by theory.',
    pravdaHeadline: 'PROGRESSIVE AGROBIOLOGY TO TRANSFORM SETTLEMENT YIELDS',
    category: 'economic',
    severity: 'major',
    effects: (gs) => ({
      food: -Math.min(35, Math.floor(gs.food * 0.25)),
    }),
    condition: (gs) => gs.food > 20,
    eraFilter: ['reconstruction'],
    weight: 1.1,
  },
  {
    id: 'late_stalinist_purge',
    title: 'LATE STALINIST PURGE WAVE',
    description:
      'A new purge wave arrives, this one targeting "rootless cosmopolitans," ' +
      'doctors, and anyone who has ever expressed admiration for foreign shoes. ' +
      'The settlement engineer was arrested this morning. He wore good shoes. ' +
      'His successor will not wear good shoes.',
    pravdaHeadline: 'VIGILANT AUTHORITIES UNCOVER ANTI-SOCIALIST CONSPIRACY',
    category: 'political',
    severity: 'catastrophic',
    effects: (gs) => ({
      pop: -Math.min(10, Math.floor(gs.pop * 0.08)),
      money: -25,
    }),
    condition: (gs) => gs.pop > 30 && gs.date.year >= 1952,
    eraFilter: ['reconstruction'],
    weight: 0.9,
  },
  {
    id: 'destalinization_signal',
    title: 'UNCERTAIN SIGNALS FROM MOSCOW',
    description:
      'The dictator has died. Nobody says this directly. The official communiqués ' +
      'contain unusual pauses. Portraits are being quietly removed from prominent walls ' +
      'and repositioned to slightly less prominent walls. The future is unknowable. ' +
      'This has always been true. Now it feels different.',
    pravdaHeadline: 'NATION MOURNS; COLLECTIVE RESOLVE REMAINS UNSHAKEN',
    category: 'political',
    severity: 'minor',
    effects: { vodka: 8, food: 5 },
    condition: (gs) => gs.date.year >= 1953,
    eraFilter: ['reconstruction'],
    weight: 0.7,
  },

  // ── THE THAW & FREEZE (1956-1982) ─────────────────────

  {
    id: 'private_gardens_allowed',
    title: 'PRIVATE GARDENS PERMITTED',
    description:
      'Private garden plots are now permitted. Citizens may grow vegetables for personal use. ' +
      'The size limit is 0.15 hectares. Anyone caught growing 0.16 hectares of cabbage ' +
      'will be considered a kulak. Progress has limits.',
    pravdaHeadline: "PEOPLE'S AGRICULTURAL INITIATIVE ENHANCES FOOD SUPPLY",
    category: 'economic',
    severity: 'minor',
    effects: { food: 25 },
    eraFilter: ['thaw_and_freeze'],
    weight: 1.5,
  },
  {
    id: 'cultural_thaw',
    title: 'CULTURAL RENAISSANCE',
    description:
      'Books previously banned are now permitted. Poetry readings draw crowds. ' +
      'A jazz record is played publicly without anyone being arrested. ' +
      'The population is confused but cautiously optimistic.',
    pravdaHeadline: 'CULTURAL LIFE FLOURISHES UNDER WISE LEADERSHIP',
    category: 'cultural',
    severity: 'minor',
    effects: { pop: 2, vodka: 3 },
    eraFilter: ['thaw_and_freeze'],
    weight: 1.0,
  },
  {
    id: 'freeze_crackdown',
    title: 'POLICY REVERSAL',
    description:
      'The cultural thaw has ended. Private gardens are confiscated. Books are re-banned. ' +
      'The jazz record has been destroyed. Citizens who expressed optimism are being questioned. ' +
      'Hope has been suspended until further notice.',
    pravdaHeadline: 'VIGILANCE RESTORED AGAINST BOURGEOIS INFLUENCES',
    category: 'political',
    severity: 'major',
    effects: { food: -15, pop: -2 },
    eraFilter: ['thaw_and_freeze'],
    weight: 0.8,
  },
  {
    id: 'sputnik_mania',
    title: 'SPUTNIK FEVER',
    description:
      'A metal ball has been launched into space. It beeps. This proves the superiority of ' +
      'scientific socialism beyond all possible dispute. Citizens are instructed to look up ' +
      'at the night sky and feel pride. Several injure their necks. The ball continues to beep.',
    pravdaHeadline: 'SOCIALIST SCIENCE CONQUERS THE COSMOS, BEEPING CONTINUES',
    category: 'cultural',
    severity: 'minor',
    effects: { pop: 3, money: 10 },
    condition: (gs) => gs.date.year >= 1957 && gs.date.year <= 1962,
    eraFilter: ['thaw_and_freeze'],
    weight: 1.8,
  },
  {
    id: 'khrushchev_corn_campaign',
    title: 'CORN IS THE FUTURE',
    description:
      'A directive arrives: plant corn everywhere. Every field, every meadow, every rooftop. ' +
      'The settlement is at 60 degrees latitude. Corn does not grow at 60 degrees latitude. ' +
      'This information is not welcomed. The corn is planted. The corn does not grow.',
    pravdaHeadline: "LEADER'S VISIONARY GRAIN INITIATIVE LAUNCHES WITH GREAT ENTHUSIASM",
    category: 'political',
    severity: 'major',
    effects: { food: -25 },
    condition: (gs) => gs.date.year >= 1958 && gs.date.year <= 1964,
    eraFilter: ['thaw_and_freeze'],
    weight: 1.4,
  },
  {
    id: 'cuban_missile_tension',
    title: 'THIRTEEN DAYS OF PAPERWORK',
    description:
      'A global crisis is occurring. The details are classified. Citizens have been advised to ' +
      'remain calm and to review their civil defense plans, which nobody received. ' +
      'Vodka rations are raised by 10% as a precautionary measure. This helps.',
    pravdaHeadline: 'IMPERIALIST PROVOCATION FIRMLY REBUFFED BY PEACE-LOVING PEOPLES',
    category: 'political',
    severity: 'major',
    effects: { vodka: -15, pop: -1 },
    condition: (gs) => gs.date.year >= 1962 && gs.date.year <= 1963,
    eraFilter: ['thaw_and_freeze'],
    weight: 2.0,
  },
  {
    id: 'prague_spring_crackdown',
    title: 'FRATERNAL ASSISTANCE ARRIVES',
    description:
      'Tanks from fraternal socialist nations have corrected a temporary misunderstanding in a ' +
      'neighboring country. The local party secretary reads the report carefully. He files it ' +
      'under "lessons learned." He has also stopped reading Czech poetry at lunch.',
    pravdaHeadline: 'SOCIALIST SOLIDARITY PREVAILS; COUNTERREVOLUTION DECISIVELY RESOLVED',
    category: 'political',
    severity: 'major',
    effects: { pop: -2, vodka: -5 },
    condition: (gs) => gs.date.year >= 1968 && gs.date.year <= 1970,
    eraFilter: ['thaw_and_freeze'],
    weight: 1.6,
  },
  {
    id: 'brezhnev_doctrine_memo',
    title: 'DOCTRINE CLARIFICATION RECEIVED',
    description:
      'A memo arrives explaining the Brezhnev Doctrine: socialist states that deviate will ' +
      'receive fraternal correction. The settlement has not deviated. But the memo is noted. ' +
      'The secretary general photograph is straightened. The corn is still not growing.',
    pravdaHeadline: 'SETTLEMENT REAFFIRMS UNSHAKEABLE SOCIALIST UNITY',
    category: 'political',
    severity: 'minor',
    effects: { money: -10 },
    condition: (gs) => gs.date.year >= 1968 && gs.date.year <= 1975,
    eraFilter: ['thaw_and_freeze'],
    weight: 1.0,
  },
  {
    id: 'detente_trade_rumor',
    title: 'GRAIN DEAL WHISPER',
    description:
      'Rumor circulates: a trade deal with the Americans for wheat. Citizens debate whether ' +
      'this is ideological surrender or simply hunger. The wheat, if it arrives, does not care ' +
      'about ideology. Neither do the people eating it. The rumor is 40% accurate.',
    pravdaHeadline: 'SOCIALIST TRADE INITIATIVE DEMONSTRATES CONFIDENCE OF PLANNED ECONOMY',
    category: 'economic',
    severity: 'minor',
    effects: (gs) => ({ food: Math.floor(gs.pop * 0.15) }),
    condition: (gs) => gs.date.year >= 1972 && gs.date.year <= 1979,
    eraFilter: ['thaw_and_freeze'],
    weight: 1.2,
  },
  {
    id: 'afghan_draft_lottery',
    title: 'LIMITED MILITARY ASSISTANCE VOLUNTEERS',
    description:
      'The settlement must provide two "volunteers" for a limited operation in Afghanistan. ' +
      'The volunteers are identified through a process described as a lottery. ' +
      'The lottery results were known before the lottery was held. ' +
      'The volunteers have been informed of this honor.',
    pravdaHeadline: 'HEROIC VOLUNTEERS ASSIST FRATERNAL AFGHAN PEOPLE',
    category: 'political',
    severity: 'catastrophic',
    effects: (gs) => ({
      pop: -Math.min(3, Math.floor(gs.pop * 0.02)),
      vodka: -10,
    }),
    condition: (gs) => gs.date.year >= 1979 && gs.date.year <= 1982,
    eraFilter: ['thaw_and_freeze'],
    weight: 1.8,
  },

  // ── STAGNATION (1964-1985) ─────────────────────────────

  {
    id: 'vodka_economy_boom',
    title: 'VODKA ECONOMY FLOURISHES',
    description:
      'Vodka has become the unofficial currency. A plumber charges two bottles for ' +
      'a house call. A doctor charges three. The black market now accepts vodka, ' +
      'rubles, and "interesting cheese." Productivity metrics are unaffected because ' +
      'the metrics were always fictional.',
    pravdaHeadline: 'CONSUMER SATISFACTION REACHES NEW HEIGHTS',
    category: 'economic',
    severity: 'minor',
    effects: (gs) => ({ vodka: -Math.min(15, Math.floor(gs.vodka * 0.1)), money: 30 }),
    condition: (gs) => gs.vodka > 20,
    eraFilter: ['stagnation'],
    weight: 1.5,
  },
  {
    id: 'queue_crisis',
    title: 'THE GREAT QUEUE',
    description:
      'A queue forms outside the bread shop. Nobody knows what is for sale. ' +
      'The queue grows. People join the queue because there is a queue. ' +
      'By afternoon, the queue has become self-sustaining. It no longer needs a shop.',
    pravdaHeadline: 'ORDERLY CITIZENS DEMONSTRATE PATIENCE AND CIVIC VIRTUE',
    category: 'economic',
    severity: 'minor',
    effects: { food: -10 },
    eraFilter: ['stagnation'],
    weight: 1.2,
  },
  {
    id: 'infrastructure_decay',
    title: 'SCHEDULED MAINTENANCE POSTPONED',
    description:
      'Building maintenance has been postponed. Again. The postponement has been ' +
      'postponed from its original postponement date. A crack in the wall has been ' +
      'designated a "feature." The feature is growing.',
    pravdaHeadline: 'INFRASTRUCTURE ENTERS EXCITING NEW PHASE OF MATURITY',
    category: 'disaster',
    severity: 'minor',
    effects: { money: -20 },
    eraFilter: ['stagnation'],
    weight: 1.0,
  },

  // ── PERESTROIKA (1985-1991) ────────────────────────────

  {
    id: 'reform_confusion',
    title: 'REFORM IMPLEMENTATION',
    description:
      'New reforms arrive. Nobody understands them. The reforms reform the previous reforms ' +
      'which were reforming the reforms before that. A committee has been formed to study ' +
      'the formation of a committee to implement the reforms.',
    pravdaHeadline: 'RESTRUCTURING ENTERS DYNAMIC NEW PHASE',
    category: 'political',
    severity: 'minor',
    effects: { money: -15 },
    eraFilter: ['stagnation'],
    weight: 1.5,
  },
  {
    id: 'shortage_cascade',
    title: 'SUPPLY CHAIN DISRUPTION',
    description:
      'The soap factory cannot produce soap because the box factory has no cardboard. ' +
      'The cardboard factory has no pulp because the forestry ministry was reorganized. ' +
      'Everyone is dirty, confused, and running low on everything.',
    pravdaHeadline: 'TEMPORARY SUPPLY ADJUSTMENT IN PROGRESS',
    category: 'economic',
    severity: 'major',
    effects: { food: -20, vodka: -10 },
    eraFilter: ['stagnation'],
    weight: 1.2,
  },
];
