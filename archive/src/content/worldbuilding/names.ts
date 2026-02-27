import { getRng, pick } from './_rng';
import type { CityRenaming } from './types';

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
  'Krasnyi', // Red
  'Bolshev',
  'Proletari',
  'Oktober',
  'Revolyutsion',
  'Zarya', // Dawn
  'Pobeda', // Victory
  'Slava', // Glory
  'Druzhba', // Friendship
  'Mir', // Peace / World
  'Trudov', // Labor
  'Pervomai', // May Day
  'Pravda', // Truth
  'Iskra', // Spark
  'Zvezdny', // Star
  'Rabochiy', // Worker
  'Krasnoarmei', // Red Army
  'Kommunar', // Communard
] as const;

/** Geographic / descriptive suffixes */
export const CITY_SUFFIXES = [
  '-grad', // city
  '-sk', // place
  '-opol', // city (Greek-derived)
  '-burg', // city (Germanic)
  '-ovsk', // patronymic place
  '-abad', // settlement (Central Asian)
  '-insk', // place
  '-orsk', // place
  '-ograd', // city variant
  '-ovo', // village-style
  '-evka', // small settlement
  '-nyi', // adjectival
  '-noye', // neuter adjectival
  '-ingrad', // expanded city
  '-omorsk', // sea-adjacent
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
  const _rng = getRng();
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

/** Generates a renaming event with appropriate propaganda messaging. */
export function renameCityForLeaderChange(
  currentName: string,
  _disgraced: string,
  newLeader: string
): CityRenaming {
  const _rng = getRng();
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
