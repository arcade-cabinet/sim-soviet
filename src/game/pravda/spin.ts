import type { EventCategory, GameEvent } from '../events';
import { pick } from './helpers';

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
function spinEffect(value: number | undefined, key: string, lossUnit: string, gainUnit: string): string | null {
  if (!value) return null;
  if (value < 0) return `${spinKey(`${key}_loss`)} ${Math.abs(value)} ${lossUnit}`;
  return `${spinKey(`${key}_gain`)} +${value} ${gainUnit}`;
}

export function spinEventEffects(event: GameEvent): string {
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

export function categoryFromEvent(
  eventCat: EventCategory,
): 'triumph' | 'editorial' | 'production' | 'culture' | 'weather' {
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
