/**
 * @module game/economy/stakhanovites
 *
 * Stakhanovite event constants — names, announcements, and probabilities.
 */

/** Probability of a Stakhanovite event per tick. Rare but memorable. */
export const STAKHANOVITE_CHANCE = 0.005;

/** Production boost range [min, max] as multiplier (e.g. 1.5 = 150%). */
export const STAKHANOVITE_BOOST_MIN = 1.5;
export const STAKHANOVITE_BOOST_MAX = 4.0;

/** How much the quota increases as a fraction of normal output. */
export const STAKHANOVITE_QUOTA_INCREASE_FACTOR = 0.1;

export const STAKHANOVITE_FIRST_NAMES = [
  'Alexei',
  'Boris',
  'Dmitri',
  'Grigori',
  'Ivan',
  'Konstantin',
  'Mikhail',
  'Nikolai',
  'Pavel',
  'Sergei',
  'Viktor',
  'Yuri',
  'Vasili',
  'Andrei',
  'Fyodor',
  'Maria',
  'Natasha',
  'Olga',
  'Svetlana',
  'Tatiana',
  'Valentina',
  'Zoya',
  'Lyudmila',
  'Galina',
  'Irina',
] as const;

export const STAKHANOVITE_SURNAMES = [
  'Petrov',
  'Ivanov',
  'Sidorov',
  'Kuznetsov',
  'Volkov',
  'Popov',
  'Sokolov',
  'Lebedev',
  'Kozlov',
  'Novikov',
  'Morozov',
  'Pavlov',
  'Smirnov',
  'Fedorov',
  'Kovalev',
  'Petrova',
  'Ivanova',
  'Sidorova',
  'Kuznetsova',
  'Volkova',
] as const;

export const STAKHANOVITE_ANNOUNCEMENTS = [
  'HERO OF SOCIALIST LABOR: {name} has exceeded production norms by {boost}%! All workers are encouraged to match this glorious achievement.',
  'PRODUCTION MIRACLE: Comrade {name} reports {boost}% over quota. The factory committee recommends immediate promotion and a modest parade.',
  'NEW RECORD AT {building}: {name} achieves {boost}% productivity. Previous quotas are hereby declared insufficient.',
  'PRAVDA REPORTS: {name} demonstrates that Soviet workers can achieve anything — except reasonable working hours.',
  'STAKHANOVITE ACHIEVEMENT: {name} of {building} produces {boost}% above plan. Fellow workers express "enthusiasm" for the new baseline.',
] as const;
