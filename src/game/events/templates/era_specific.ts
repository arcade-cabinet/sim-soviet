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
 *   the_eternal       — Bureaucratic singularity, absurdist endgame
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
      'A requisition squad arrives demanding grain for the cities. ' +
      'They have rifles. You have turnips. The negotiation is brief.',
    pravdaHeadline: 'VOLUNTARY GRAIN CONTRIBUTION EXCEEDS ALL EXPECTATIONS',
    category: 'political',
    severity: 'major',
    effects: (gs) => ({ food: -Math.min(40, Math.floor(gs.food * 0.3)) }),
    condition: (gs) => gs.food > 30,
    eraFilter: ['revolution'],
    weight: 1.2,
  },

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

  // ── THE THAW (1953-1964) ───────────────────────────────

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

  // ── THE ETERNAL SOVIET (1991+) ─────────────────────────

  {
    id: 'bureaucratic_singularity_approach',
    title: 'PAPERWORK ANOMALY DETECTED',
    description:
      'The bureaucracy has begun generating its own forms. Form 27-B/6 now requires ' +
      'Form 27-B/6a, which requires Form 27-B/6b, which requires the original Form 27-B/6. ' +
      'The loop is stable. The loop is growing. The loop has opinions.',
    pravdaHeadline: 'ADMINISTRATIVE EFFICIENCY ACHIEVES RECURSIVE OPTIMIZATION',
    category: 'absurdist',
    severity: 'minor',
    effects: { money: -25 },
    eraFilter: ['the_eternal'],
    weight: 2.0,
  },
  {
    id: 'reality_fluctuation',
    title: 'REALITY MAINTENANCE NOTICE',
    description:
      'The Ministry of Truth reports a minor reality fluctuation in Sector 7. ' +
      'Citizens are advised that yesterday did not happen. Tomorrow is also under review. ' +
      'Today is provisionally approved but subject to revision.',
    pravdaHeadline: 'MINISTRY CONFIRMS: REALITY REMAINS WITHIN ACCEPTABLE PARAMETERS',
    category: 'absurdist',
    severity: 'minor',
    effects: {},
    eraFilter: ['the_eternal'],
    weight: 1.5,
  },
  {
    id: 'food_probabilistic',
    title: 'HARVEST PROBABILITY COLLAPSE',
    description:
      'The harvest has entered a quantum state. It is simultaneously abundant and nonexistent. ' +
      'The official report lists it as "adequate" which covers both possibilities. ' +
      'Citizens are advised to eat theoretically.',
    pravdaHeadline: 'HARVEST DECLARED ADEQUATE BY ALL RELEVANT METRICS',
    category: 'absurdist',
    severity: 'major',
    effects: (gs) => {
      // Probabilistic food: 50% chance of +20, 50% chance of -20
      const roll = gs.date.tick % 2;
      return roll === 0 ? { food: 20 } : { food: -20 };
    },
    eraFilter: ['the_eternal'],
    weight: 1.2,
  },
  {
    id: 'bureaucracy_sentient',
    title: 'THE BUREAUCRACY SPEAKS',
    description:
      'The filing cabinets have begun humming. Not the sound of old metal. A melody. ' +
      'Form 42-C/7 was found on your desk this morning. You did not request it. ' +
      'It approves itself. It has always approved itself. You may proceed.',
    pravdaHeadline: 'ADMINISTRATIVE SYSTEM ACHIEVES UNPRECEDENTED AUTONOMY',
    category: 'absurdist',
    severity: 'catastrophic',
    effects: { money: -50 },
    eraFilter: ['the_eternal'],
    weight: 0.5,
  },
];
