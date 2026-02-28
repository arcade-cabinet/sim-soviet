/**
 * @fileoverview Barrel file for the procedural Russian name generator.
 */

export { NameGenerator, nameGenerator } from './NameGenerator';
export { PATRONYMIC_RULES } from './patterns';
export {
  ALL_TITLES,
  CITY_NAMES,
  EPITHETS,
  FEMALE_GIVEN_NAMES,
  getSurname,
  IRREGULAR_PATRONYMICS,
  MALE_GIVEN_NAMES,
  PATRONYMIC_FATHER_NAMES,
  SURNAMES_FEMALE,
  SURNAMES_MALE,
  SURNAMES_RAW,
  TITLES,
} from './syllables';
export type { GeneratedLeader, PatronymicEntry, SurnameEntry, TitleCategory } from './types';
