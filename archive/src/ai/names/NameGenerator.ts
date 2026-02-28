/**
 * @fileoverview Procedural Russian Name Generator for SimSoviet 2000.
 *
 * Generates endless unique leader names for the Politburo, KGB, ministries,
 * and various Soviet bureaucratic organs. Names follow authentic Russian
 * naming conventions: Given Name + Patronymic + Surname.
 */

import type { GameRng } from '@/game/SeedSystem';
import { PATRONYMIC_RULES } from './patterns';
import {
  ALL_TITLES,
  CITY_NAMES,
  EPITHETS,
  FEMALE_GIVEN_NAMES,
  getSurname,
  MALE_GIVEN_NAMES,
  PATRONYMIC_FATHER_NAMES,
  SURNAMES_RAW,
  TITLES,
} from './syllables';
import type { GeneratedLeader } from './types';

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

/** Module-level RNG reference, set by NameGenerator constructor */
let _rng: GameRng | null = null;

function pick<T>(arr: readonly T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}

function pickIndex(length: number): number {
  return _rng ? _rng.pickIndex(length) : Math.floor(Math.random() * length);
}

// ─────────────────────────────────────────────────────────
//  NAME GENERATOR CLASS
// ─────────────────────────────────────────────────────────

/**
 * Procedural Russian name generator for Soviet leader identities.
 *
 * Tracks previously generated names to avoid exact duplicates within
 * a session. The combinatorial space (~1.9 million unique male names,
 * ~640k female) makes collisions extremely rare.
 *
 * @example
 * ```ts
 * const gen = new NameGenerator();
 * const leader = gen.generate();
 * console.log(leader.introduction);
 * // "Minister of Heavy Industry Volkov, 'The Concrete Poet'"
 *
 * const kgbChief = gen.generate({ gender: 'male', titleCategory: 'security' });
 * console.log(kgbChief.formalName);
 * // "Morozov Ivan Petrovich"
 * ```
 */
export class NameGenerator {
  private generatedKeys = new Set<string>();
  private cityName: string;

  constructor(cityName?: string, rng?: GameRng) {
    if (rng) _rng = rng;
    this.cityName = cityName ?? pick(CITY_NAMES);
  }

  /**
   * Set the city name used in title placeholders.
   */
  public setCityName(name: string): void {
    this.cityName = name;
  }

  /**
   * Generate a unique Soviet leader identity.
   *
   * @param options - Optional constraints on generation.
   * @param options.gender - Force 'male' or 'female'. Default: 85% male, 15% female.
   * @param options.titleCategory - Restrict title to a specific category key from TITLES.
   * @param options.epithet - Force a specific epithet. Default: random.
   * @returns A complete GeneratedLeader identity.
   */
  public generate(options?: {
    gender?: 'male' | 'female';
    titleCategory?: keyof typeof TITLES;
    epithet?: string;
  }): GeneratedLeader {
    const gender =
      options?.gender ?? ((_rng?.random() ?? Math.random()) < 0.85 ? 'male' : 'female');

    // Pick components, retry on duplicate
    let givenName: string;
    let patronymic: string;
    let surname: string;
    let key: string;
    let attempts = 0;

    do {
      givenName = gender === 'male' ? pick(MALE_GIVEN_NAMES) : pick(FEMALE_GIVEN_NAMES);

      const fatherName = pick(PATRONYMIC_FATHER_NAMES);
      patronymic = PATRONYMIC_RULES.generate(fatherName, gender);

      const surnameIndex = pickIndex(SURNAMES_RAW.length);
      surname = getSurname(surnameIndex, gender);

      key = `${givenName}|${patronymic}|${surname}`;
      attempts++;
    } while (this.generatedKeys.has(key) && attempts < 100);

    this.generatedKeys.add(key);

    // Title
    let titlePool: readonly string[];
    if (options?.titleCategory) {
      titlePool = TITLES[options.titleCategory];
    } else {
      titlePool = ALL_TITLES;
    }
    const rawTitle = pick(titlePool);
    const title = rawTitle.replace(/\{CITY\}/g, this.cityName);

    // Epithet
    const epithet = options?.epithet ?? pick(EPITHETS);

    // Format names
    const formalName = `${surname} ${givenName} ${patronymic}`;
    const westernName = `${givenName} ${patronymic} ${surname}`;
    const shortName = `${givenName[0]}.${patronymic[0]}. ${surname}`;
    const introduction = `${title} ${surname}, "${epithet}"`;

    return {
      givenName,
      patronymic,
      surname,
      gender,
      formalName,
      westernName,
      shortName,
      title,
      epithet,
      introduction,
    };
  }

  /**
   * Generate a batch of unique leaders.
   *
   * @param count - Number of leaders to generate.
   * @param options - Optional constraints applied to all.
   * @returns Array of GeneratedLeader identities.
   */
  public generateBatch(
    count: number,
    options?: {
      gender?: 'male' | 'female';
      titleCategory?: keyof typeof TITLES;
    }
  ): GeneratedLeader[] {
    const leaders: GeneratedLeader[] = [];
    for (let i = 0; i < count; i++) {
      leaders.push(this.generate(options));
    }
    return leaders;
  }

  /**
   * Generate a complete Politburo -- one leader per category.
   *
   * @returns A record mapping category name to a generated leader.
   */
  public generatePolitburo(): Record<string, GeneratedLeader> {
    const politburo: Record<string, GeneratedLeader> = {};
    for (const category of Object.keys(TITLES)) {
      politburo[category] = this.generate({ titleCategory: category as keyof typeof TITLES });
    }
    return politburo;
  }

  /**
   * Generate a full government cabinet with one leader per ministry title.
   *
   * @returns Array of leaders, one for each ministry title.
   */
  public generateCabinet(): GeneratedLeader[] {
    return TITLES.ministry.map((title) => {
      const leader = this.generate({ titleCategory: 'ministry' });
      // Override with the specific ministry title
      const resolvedTitle = title.replace(/\{CITY\}/g, this.cityName);
      return {
        ...leader,
        title: resolvedTitle,
        introduction: `${resolvedTitle} ${leader.surname}, "${leader.epithet}"`,
      };
    });
  }

  /**
   * Reset the duplicate tracker. Useful between game sessions.
   */
  public reset(): void {
    this.generatedKeys.clear();
  }

  /**
   * Get the number of unique names generated so far in this session.
   */
  public get generatedCount(): number {
    return this.generatedKeys.size;
  }
}

/** Pre-instantiated generator for quick use. */
export const nameGenerator = new NameGenerator();
