/**
 * @module game/politburo/events
 *
 * Ministry event templates — the pool of events that can fire
 * based on the current cabinet composition.
 */

import { pick } from './ministers';
import { type Minister, Ministry, type MinistryEventTemplate, PersonalityType } from './types';

export const MINISTRY_EVENTS: MinistryEventTemplate[] = [
  // ── KGB Events ──
  {
    id: 'kgb_surveillance_report',
    ministry: Ministry.KGB,
    title: 'SURVEILLANCE REPORT',
    description: (m) =>
      `KGB Chairman ${m.name} presents surveillance findings. ${m.personality === PersonalityType.ZEALOT ? 'Everyone is guilty.' : 'Most citizens are merely suspicious.'}`,
    pravdaHeadline: "KGB REPORTS: ALL CITIZENS LOYAL (THOSE WHO AREN'T ARE NO LONGER CITIZENS)",
    severity: 'minor',
    category: 'political',
    effects: { money: -15 },
  },
  {
    id: 'kgb_spy_discovery',
    ministry: Ministry.KGB,
    title: 'SPY DISCOVERED',
    description:
      'A Western spy found infiltrating the turnip warehouse. Interrogation reveals: he actually just wanted turnips.',
    pravdaHeadline: 'HEROIC KGB FOILS WESTERN AGRICULTURAL ESPIONAGE',
    severity: 'minor',
    category: 'political',
    effects: { money: 20, food: -5 },
  },
  {
    id: 'kgb_loyalty_test',
    ministry: Ministry.KGB,
    title: 'LOYALTY TEST',
    description: (m, gs) =>
      `Mandatory loyalty tests administered to ${Math.floor(gs.pop * 0.3)} citizens. ${m.personality === PersonalityType.REFORMER ? 'Tests graded on a curve. Everyone passes.' : 'Several citizens fail. They will be "re-educated."'}`,
    pravdaHeadline: 'CITIZENS DEMONSTRATE UNWAVERING DEVOTION TO STATE',
    severity: 'minor',
    category: 'political',
    effects: (m) => ({
      pop: m.personality === PersonalityType.ZEALOT ? -3 : -1,
      money: -10,
    }),
    condition: (_, gs) => gs.pop > 10,
  },
  {
    id: 'kgb_purge_wave',
    ministry: Ministry.KGB,
    title: 'PURGE WAVE',
    description: (m, gs) => {
      const purged = Math.floor(gs.pop * 0.05);
      return `Chairman ${m.name} initiates purge. ${purged} citizens relocated to "agricultural development zones." The zones have no agriculture.`;
    },
    pravdaHeadline: 'VOLUNTARY RELOCATION PROGRAM EXCEEDS ENROLLMENT TARGETS',
    severity: 'major',
    category: 'political',
    effects: (_, gs) => ({ pop: -Math.max(1, Math.floor(gs.pop * 0.05)), food: 5 }),
    requiredPersonality: PersonalityType.ZEALOT,
    condition: (_, gs) => gs.pop > 20,
    weight: 1.5,
  },

  // ── Agriculture Events ──
  {
    id: 'agri_harvest_report',
    ministry: Ministry.AGRICULTURE,
    title: 'HARVEST REPORT',
    description: (m) =>
      `Minister ${m.name} announces harvest results. ${m.competence > 60 ? 'Yields are acceptable.' : 'Yields are disappointing but the report says otherwise.'}`,
    pravdaHeadline: 'BUMPER CROP PROVES SUPERIORITY OF SOCIALIST FARMING',
    severity: 'trivial',
    category: 'economic',
    effects: (m) => ({ food: Math.floor(m.competence / 5) }),
  },
  {
    id: 'agri_weather_disaster',
    ministry: Ministry.AGRICULTURE,
    title: 'WEATHER CATASTROPHE',
    description:
      'Early frost destroys 40% of crops. Minister blames the weather. The weather has been added to the watch list.',
    pravdaHeadline: 'MINOR WEATHER EVENT HAS ZERO IMPACT ON FOOD SUPPLY (DO NOT CHECK)',
    severity: 'major',
    category: 'disaster',
    effects: { food: -40 },
    weight: 0.6,
  },
  {
    id: 'agri_collectivization_drive',
    ministry: Ministry.AGRICULTURE,
    title: 'COLLECTIVIZATION DRIVE',
    description: (m) =>
      `Minister ${m.name} launches new collectivization campaign. Private gardens ${m.personality === PersonalityType.REFORMER ? 'are explicitly protected (for now)' : 'are seized for the collective good'}.`,
    pravdaHeadline: 'GLORIOUS COLLECTIVIZATION ADVANCES SOCIALIST AGRICULTURE',
    severity: 'minor',
    category: 'political',
    effects: (m) => ({
      food: m.personality === PersonalityType.REFORMER ? 10 : -10,
      money: -20,
    }),
    requiredPersonality: PersonalityType.ZEALOT,
  },
  {
    id: 'agri_private_garden_boom',
    ministry: Ministry.AGRICULTURE,
    title: 'PRIVATE GARDEN BOOM',
    description:
      "Citizens' private gardens produce more food than all kolkhozes combined. This fact has been classified.",
    pravdaHeadline: 'KOLKHOZ PRODUCTION AT ALL-TIME HIGH (PRIVATE GARDENS NOT MEASURED)',
    severity: 'minor',
    category: 'economic',
    effects: { food: 30 },
    requiredPersonality: PersonalityType.REFORMER,
    weight: 0.8,
  },

  // ── Culture Events ──
  {
    id: 'culture_banned_art',
    ministry: Ministry.CULTURE,
    title: 'ART BANNED',
    description: (m) =>
      `Minister ${m.name} bans ${pick(['jazz', 'abstract painting', 'poetry about feelings', 'smiling in photographs', 'the color purple', 'music in minor keys'])}. Citizens mourn privately. Mourning also banned.`,
    pravdaHeadline: 'DECADENT WESTERN ART PURGED FROM CULTURAL LANDSCAPE',
    severity: 'trivial',
    category: 'cultural',
    effects: { vodka: -3 },
    condition: (m: Minister) =>
      m.personality === PersonalityType.ZEALOT || m.personality === PersonalityType.MILITARIST,
  },
  {
    id: 'culture_mandatory_celebration',
    ministry: Ministry.CULTURE,
    title: 'MANDATORY CELEBRATION',
    description:
      'Anniversary of the Revolution. Attendance compulsory. Joy compulsory. Second helpings of joy: unavailable.',
    pravdaHeadline: 'SPONTANEOUS OUTPOURING OF REVOLUTIONARY FERVOR SWEEPS CITY',
    severity: 'trivial',
    category: 'cultural',
    effects: { money: -15, vodka: -5 },
  },
  {
    id: 'culture_approved_music',
    ministry: Ministry.CULTURE,
    title: 'APPROVED MUSIC LIST UPDATED',
    description: (m) =>
      `New approved music list: ${m.personality === PersonalityType.REFORMER ? '47 songs (up from 3!)' : '3 songs. One is the anthem. The other two are also the anthem.'} `,
    pravdaHeadline: 'RICH MUSICAL HERITAGE CELEBRATED WITH UPDATED PLAYLIST',
    severity: 'trivial',
    category: 'cultural',
    effects: {},
  },

  // ── Defense Events ──
  {
    id: 'defense_border_incident',
    ministry: Ministry.DEFENSE,
    title: 'BORDER INCIDENT',
    description: (m) =>
      `Border incident reported. Defense Minister ${m.name} ${m.personality === PersonalityType.MILITARIST ? 'mobilizes entire army' : 'sends a strongly worded letter'}. The incident was a stray cow.`,
    pravdaHeadline: 'WESTERN PROVOCATIONS MET WITH IRON RESOLVE',
    severity: 'minor',
    category: 'political',
    effects: (m) => ({
      money: m.personality === PersonalityType.MILITARIST ? -50 : -10,
    }),
  },
  {
    id: 'defense_military_exercise',
    ministry: Ministry.DEFENSE,
    title: 'MILITARY EXERCISES',
    description:
      'Annual military exercises. Tanks drive through city center. Several flower beds are casualties. A cat is decorated for bravery.',
    pravdaHeadline: 'AWESTRIKING DISPLAY OF MILITARY MIGHT REASSURES POPULACE',
    severity: 'trivial',
    category: 'political',
    effects: { money: -30, food: -5 },
    requiredPersonality: PersonalityType.MILITARIST,
  },
  {
    id: 'defense_conscription_drive',
    ministry: Ministry.DEFENSE,
    title: 'CONSCRIPTION DRIVE',
    description: (m, gs) => {
      const drafted = Math.max(1, Math.floor(gs.pop * 0.03));
      return `${drafted} citizens conscripted. Minister ${m.name}: "The Motherland needs you more than your family does."`;
    },
    pravdaHeadline: 'PATRIOTIC YOUTH RUSH TO SERVE THE MOTHERLAND',
    severity: 'minor',
    category: 'political',
    effects: (_, gs) => ({ pop: -Math.max(1, Math.floor(gs.pop * 0.03)) }),
    condition: (_, gs) => gs.pop > 15,
  },

  // ── Health Events ──
  {
    id: 'health_vodka_policy',
    ministry: Ministry.HEALTH,
    title: 'VODKA POLICY UPDATE',
    description: (m) =>
      `Health Minister ${m.name} ${m.personality === PersonalityType.REFORMER ? 'restricts vodka. Citizens riot quietly.' : 'declares vodka a food group. Life expectancy: unclear.'}`,
    pravdaHeadline: 'HEALTH MINISTRY OPTIMIZES NATIONAL BEVERAGE STRATEGY',
    severity: 'minor',
    category: 'economic',
    effects: (m) => ({
      vodka: m.personality === PersonalityType.REFORMER ? -15 : 10,
    }),
  },
  {
    id: 'health_epidemic',
    ministry: Ministry.HEALTH,
    title: 'MYSTERIOUS ILLNESS',
    description: (m) =>
      `Mysterious illness sweeps city. Health Minister ${m.name} ${m.competence > 50 ? 'mobilizes hospitals effectively' : 'prescribes rest and revolutionary spirit'}. ${m.personality === PersonalityType.MYSTIC ? 'Also: crystals.' : ''}`,
    pravdaHeadline: 'MINOR HEALTH FLUCTUATION HANDLED WITH CHARACTERISTIC SOVIET EFFICIENCY',
    severity: 'major',
    category: 'disaster',
    effects: (m) => ({
      pop: m.competence > 50 ? -2 : -5,
      money: -20,
    }),
    condition: (_, gs) => gs.pop > 10,
    weight: 0.5,
  },

  // ── Gosplan Events ──
  {
    id: 'gosplan_quota_revision',
    ministry: Ministry.GOSPLAN,
    title: 'QUOTA REVISION',
    description: (m) =>
      `Gosplan Chairman ${m.name} revises 5-year plan targets ${m.personality === PersonalityType.ZEALOT ? 'upward by 300%' : m.personality === PersonalityType.POPULIST ? 'downward (everyone gets a medal)' : 'slightly'}.`,
    pravdaHeadline: 'FIVE-YEAR PLAN TARGETS ADJUSTED TO REFLECT GLORIOUS REALITY',
    severity: 'minor',
    category: 'economic',
    effects: {},
  },
  {
    id: 'gosplan_resource_reallocation',
    ministry: Ministry.GOSPLAN,
    title: 'RESOURCE REALLOCATION',
    description:
      'Gosplan reallocates resources. What was going to agriculture now goes to heavy industry. What was going to heavy industry now goes to defense. What was going to defense is classified.',
    pravdaHeadline: 'OPTIMAL RESOURCE DISTRIBUTION ACHIEVED THROUGH CENTRAL PLANNING',
    severity: 'minor',
    category: 'economic',
    effects: { food: -10, money: 20 },
  },

  // ── Education Events ──
  {
    id: 'education_literacy_campaign',
    ministry: Ministry.EDUCATION,
    title: 'LITERACY CAMPAIGN',
    description: (m) =>
      `Minister ${m.name} launches literacy campaign. Citizens now able to read the propaganda posters they have been saluting for years.`,
    pravdaHeadline: 'ILLITERACY OFFICIALLY ELIMINATED (REMAINING ILLITERATES RECLASSIFIED)',
    severity: 'trivial',
    category: 'cultural',
    effects: { money: -15 },
  },
  {
    id: 'education_textbook_revision',
    ministry: Ministry.EDUCATION,
    title: 'TEXTBOOK REVISION',
    description: (m) =>
      `History textbooks revised. ${m.personality === PersonalityType.ZEALOT ? 'Several historical figures erased. Photographs retouched.' : 'Minor corrections. Stalin still did nothing wrong.'} `,
    pravdaHeadline: 'UPDATED EDUCATIONAL MATERIALS REFLECT LATEST TRUTH',
    severity: 'trivial',
    category: 'cultural',
    effects: { money: -10 },
  },

  // ── MVD Events ──
  {
    id: 'mvd_black_market_raid',
    ministry: Ministry.MVD,
    title: 'BLACK MARKET OPERATION',
    description: (m) =>
      `MVD ${m.personality === PersonalityType.REFORMER ? 'turns blind eye to' : 'raids'} black market. Confiscated: 47 pairs of jeans, 12 Beatles records, 1 suspicious amount of optimism.`,
    pravdaHeadline: 'CAPITALIST CONTRABAND SEIZED IN DARING OPERATION',
    severity: 'minor',
    category: 'economic',
    effects: (m) => ({
      money: m.personality === PersonalityType.REFORMER ? 0 : 30,
      vodka: m.personality === PersonalityType.REFORMER ? 0 : -5,
    }),
  },
  {
    id: 'mvd_corruption_scandal',
    ministry: Ministry.MVD,
    title: 'CORRUPTION SCANDAL',
    description: (m) =>
      `Corruption discovered in MVD. Minister ${m.name}'s corruption level: ${m.corruption}%. Investigation launched by KGB. KGB also corrupt. Investigation ongoing indefinitely.`,
    pravdaHeadline: 'MINOR ADMINISTRATIVE IRREGULARITIES ADDRESSED',
    severity: 'minor',
    category: 'political',
    effects: (m) => ({ money: -Math.floor(m.corruption / 2) }),
    condition: (m) => m.corruption > 40,
  },

  // ── Transport Events ──
  {
    id: 'transport_supply_delay',
    ministry: Ministry.TRANSPORT,
    title: 'SUPPLY CHAIN DISRUPTION',
    description: (m) =>
      `Supply shipment delayed by ${m.competence > 50 ? '2 weeks' : '3 months'}. Contents: unknown. Destination: also unknown. Driver: "I was told to drive east."`,
    pravdaHeadline: 'SHIPMENT TAKES SCENIC ROUTE TO DEMONSTRATE BEAUTIFUL COUNTRYSIDE',
    severity: 'minor',
    category: 'economic',
    effects: (m) => ({ food: m.competence > 50 ? -5 : -15 }),
  },
  {
    id: 'transport_infrastructure_collapse',
    ministry: Ministry.TRANSPORT,
    title: 'INFRASTRUCTURE COLLAPSE',
    description:
      'Bridge collapses. Last inspected: 1958. Inspector: "It looked fine from a distance. I did not get closer."',
    pravdaHeadline: 'RIVER CROSSING UNDERGOES SPONTANEOUS RENOVATION',
    severity: 'major',
    category: 'disaster',
    effects: { money: -50 },
    weight: 0.4,
  },
];
