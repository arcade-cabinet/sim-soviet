import { getBuildingDef } from '@/data/buildingDefs';
import {
  healthAuthorityForYear,
  internalAffairsAuthorityForYear,
  isGulag,
  laborAuthorityForYear,
  pick,
  planLabelForYear,
  randInt,
  securityServiceForYear,
} from '../helpers';
import type { ContextualGenerator } from '../types';

// ─────────────────────────────────────────────────────────
//  CONTEXTUAL HEADLINE GENERATORS
//
//  These react to specific game state conditions.
//  They fire when the game state matches certain thresholds,
//  ALWAYS spinning the situation positively.
// ─────────────────────────────────────────────────────────

/** Game-state-reactive headline generators that fire when specific conditions are met. */
export const contextualGenerators: ContextualGenerator[] = [
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
      subtext: `Health benefits of not eating: extensively documented by the ${pick([healthAuthorityForYear(gs.date.year), 'Nutrition Committee', 'Office of Convenient Explanations'])}.`,
      reality: `Food supply: ${Math.round(gs.food)} units. Citizens spotted eating a poster of food.`,
      category: 'spin',
    }),
  },

  // No money (money < 50) after the settlement has had time to exhaust its assignment funds
  {
    condition: (gs) => gs.money < 50 && (gs.date.year > 1917 || gs.buildings.length > 0),
    weight: 2,
    generate: (gs) => ({
      headline: `TREASURY AUSTERITY CELEBRATED: ${Math.round(gs.money)} RUBLES REMAIN UNDER STRICT DISCIPLINE`,
      subtext: `Every ruble has been assigned a patriotic purpose. Some purposes are still waiting for rubles.`,
      reality: `The treasury is a tin box with ${Math.round(gs.money)} rubles and a moth.`,
      category: 'spin',
    }),
  },

  // Lots of buildings (> 15)
  {
    condition: (gs) => gs.buildings.length > 15,
    weight: 1,
    generate: (gs) => ({
      headline: `SETTLEMENT PLAN FEATURES ${gs.buildings.length} MAGNIFICENT STRUCTURES`,
      subtext: `Architectural diversity: rectangles, squares, and the occasional rectangle. All grey.`,
      reality: `${gs.buildings.length} buildings, ${randInt(1, 3)} of which are structurally sound.`,
      category: 'production',
    }),
  },

  // No buildings after the opening assignment period
  {
    condition: (gs) => gs.buildings.length === 0 && gs.date.year > 1917,
    weight: 3,
    generate: () => ({
      headline: 'MINIMALIST SETTLEMENT DESIGN WINS INTERNATIONAL ACCLAIM',
      subtext: 'Zero buildings represent a bold architectural statement. "Less is more," says nobody.',
      reality: 'There are no buildings. The settlement is a field. The field is also struggling.',
      category: 'spin',
    }),
  },

  // Population zero
  {
    condition: (gs) => gs.pop === 0 && gs.food < 10,
    weight: 5,
    generate: () => ({
      headline: 'SETTLEMENT ACHIEVES PERFECT CRIME RATE: 0 CRIMES, 0 CITIZENS',
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
      headline: `VODKA RESERVES AT ${Math.round(gs.vodka)} UNITS: MORALE INFRASTRUCTURE SECURE`,
      subtext: `Ministry of Spirits confirms: nation can withstand ${Math.floor(gs.vodka / gs.pop || 1)}-day morale siege.`,
      reality: `Workers operating at blood-vodka level of ${(gs.vodka / Math.max(1, gs.pop)).toFixed(1)}%. Productivity: debatable.`,
      category: 'production',
    }),
  },

  // No power but has buildings that need it
  {
    condition: (gs) => gs.power === 0 && gs.buildings.length > 0,
    weight: 2.5,
    generate: (gs) => ({
      headline: 'NATIONWIDE LIGHTS-OUT EVENT CELEBRATES EARTH HOUR (EXTENDED INDEFINITELY)',
      subtext: `Citizens report improved night vision. Some claim to see in the dark. ${securityServiceForYear(gs.date.year)} notes this ability.`,
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
        'SYSTEM DECLARED "STABLE" FOR 47TH CONSECUTIVE YEAR',
        'REPORT OF "CHANGES" DENIED: NOTHING HAS CHANGED',
        'PERESTROIKA? NEVER HEARD OF IT. SOUNDS CAPITALIST',
        'THE 1990S ARE THE NEW 1950S, DECLARES MINISTRY',
      ])}`,
      subtext: 'The next year is certain. It is the past that keeps changing.',
      reality: 'Cracks in the system visible from the main road. Also visible: the wall. Also cracking.',
      category: 'editorial',
    }),
  },

  // Quota almost due
  {
    condition: (gs) => gs.quota.deadlineYear - gs.date.year <= 1 && gs.quota.current < gs.quota.target,
    weight: 3,
    generate: (gs) => {
      const pct = Math.floor((gs.quota.current / gs.quota.target) * 100);
      return {
        headline: `${planLabelForYear(gs.date.year)} ${pct}% COMPLETE WITH ${pick(['MONTHS', 'WEEKS', 'DAYS', 'MOMENTS'])} TO SPARE`,
        subtext: `Remaining ${100 - pct}% to be achieved through ${pick(['a miracle', 'creative accounting', 'redefining the goal', 'sheer willpower', 'retroactive adjustment'])}`,
        reality: `Quota deadline: ${gs.quota.deadlineYear}. Current year: ${gs.date.year}. Current: ${gs.quota.current}/${gs.quota.target}. Someone should panic.`,
        category: 'production',
      };
    },
  },

  // ── Morale-reactive headlines ──────────────────────────────────────────
  // High morale — genuine (but still propagandistic) celebration
  {
    condition: (gs) => gs.avgMorale > 70,
    weight: 1.5,
    generate: (gs) => ({
      headline: `WORKER MORALE EXCELLENT IN ALL SECTORS`,
      subtext: pick([
        `${laborAuthorityForYear(gs.date.year)} confirms: smiles detected across the collective.`,
        'Productivity naturally follows from socialist contentment.',
        'Comrades report: life has never been better. (Quote verified by 3 supervisors.)',
      ]),
      reality: 'For once, the headline is approximately true. This makes the editors nervous.',
      category: 'triumph',
    }),
  },

  // Low morale — the system LIES (classic Soviet euphemism)
  {
    condition: (gs) => gs.avgMorale < 30 && gs.avgMorale >= 15,
    weight: 2.5,
    generate: () => ({
      headline: `WORKERS EXPRESS GRATITUDE FOR PARTY LEADERSHIP`,
      subtext: pick([
        'Spontaneous displays of appreciation noted in all districts.',
        '"We have never been more motivated," says worker (name withheld for modesty).',
        'Satisfaction surveys return 97.3% approval. Remaining 2.7%: clerical error.',
      ]),
      reality: 'Morale is collapsing. The gratitude is fictional. The surveys were pre-filled.',
      category: 'spin',
    }),
  },

  // Critical morale — careful euphemism for near-revolt conditions
  {
    condition: (gs) => gs.avgMorale < 15,
    weight: 3.5,
    generate: (gs) => ({
      headline: `ISOLATED INCIDENTS OF COUNTER-REVOLUTIONARY SENTIMENT REPORTED`,
      subtext: pick([
        `${securityServiceForYear(gs.date.year)} assures: situation contained. Additional containment measures authorized.`,
        'Handful of provocateurs identified. The collective remains resolute.',
        `${internalAffairsAuthorityForYear(gs.date.year)}: "This is not a trend. This is weather."`,
      ]),
      reality:
        'The collective is on the verge of revolt. "Isolated" means "everywhere." "Incidents" means "the whole settlement."',
      category: 'crisis',
    }),
  },
];
