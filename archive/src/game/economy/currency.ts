/**
 * @module game/economy/currency
 *
 * Currency reform data and application logic.
 */

import type { CurrencyReformEvent, CurrencyReformResult } from './types';

/**
 * Historical Soviet currency reforms.
 *
 * Each reform converts rubles at a punishing exchange rate.
 * The pattern: the state prints too much money, then "reforms"
 * the currency to delete the excess — along with people's savings.
 */
export const CURRENCY_REFORMS: CurrencyReformEvent[] = [
  {
    year: 1924,
    name: 'Chervonets Reform',
    exchangeRate: 50000,
    announcement:
      'The Soviet government introduces the gold chervonets. Old sovznaks will be exchanged at a rate of 50,000:1. Citizens are encouraged to celebrate this monetary stabilization.',
    applied: false,
  },
  {
    year: 1947,
    name: 'Post-War Reform',
    exchangeRate: 10,
    announcement:
      'In order to strengthen the Soviet ruble and combat speculators, a currency reform is announced. Old rubles are exchanged at 10:1. Savings accounts above 3,000 rubles receive less favorable rates. The state thanks citizens for their understanding.',
    applied: false,
  },
  {
    year: 1961,
    name: 'Khrushchev Reform',
    exchangeRate: 10,
    announcement:
      'A new ruble is introduced, worth 10 old rubles. Prices and wages are adjusted accordingly. The reform is purely technical and will not affect living standards. (The state is confident you believe this.)',
    applied: false,
  },
  {
    year: 1991,
    name: 'Pavlov Reform',
    exchangeRate: 1,
    announcement:
      'Large-denomination banknotes are withdrawn from circulation with 3 days notice. Citizens may exchange limited amounts. The measure targets criminals and hoarders. (Everyone else is merely collateral.)',
    applied: false,
  },
];

/**
 * Find the next applicable currency reform for a given year.
 * Returns null if no reform is pending.
 */
export function findPendingReform(
  reforms: CurrencyReformEvent[],
  year: number
): CurrencyReformEvent | null {
  return reforms.find((r) => !r.applied && r.year <= year) ?? null;
}

/**
 * Apply a currency reform to a money balance.
 *
 * The 1991 Pavlov reform is special: it confiscates a flat 50% of
 * large denominations rather than using an exchange rate.
 */
export function applyCurrencyReform(
  money: number,
  reform: CurrencyReformEvent
): CurrencyReformResult {
  let moneyAfter: number;

  if (reform.year === 1991) {
    // Pavlov: confiscate 50% of anything over 1000
    const protected_ = Math.min(money, 1000);
    const excess = Math.max(0, money - 1000);
    moneyAfter = Math.round(protected_ + excess * 0.5);
  } else {
    moneyAfter = Math.round(money / reform.exchangeRate);
  }

  // Ensure minimum of 1 ruble if they had anything
  if (money > 0 && moneyAfter < 1) {
    moneyAfter = 1;
  }

  return {
    reform,
    moneyBefore: money,
    moneyAfter,
    amountLost: money - moneyAfter,
  };
}
