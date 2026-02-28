import type { EventTemplate } from '../types';

export const ECONOMIC_EVENTS: EventTemplate[] = [
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
    eraFilter: ['reconstruction', 'perestroika'],
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
    eraFilter: ['first_plans', 'reconstruction'],
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
  // ── Good economic events ──
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
    eraFilter: ['reconstruction', 'thaw', 'stagnation'],
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
];
