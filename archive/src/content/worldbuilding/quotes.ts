import { pick } from './_rng';

export const LOADING_QUOTES: string[] = [
  // -- Work & Labor ---
  'Work hard and you shall receive what you deserve. What you deserve has been pre-determined.',
  'The worker who complains is not yet tired enough. Assign more work.',
  'He who does not work, does not eat. He who works, also does not eat, but with dignity.',
  'Labor is freedom. This sentence means exactly what the Party says it means.',
  'Every worker is a hero. Some heroes are more heroic. Those heroes have better apartments.',
  'The strongest steel is forged in the hottest fire. The coldest workers are forged in the longest bread lines.',
  'Work is the cure for all ailments. If you are still ailing, you are not working hard enough.',

  // -- The State & Party ---
  'In Soviet Union, the future is certain. It is the past that keeps changing.',
  'Trust the Plan. The Plan trusts you. The Plan is watching.',
  'The Party is always right. When the Party changes its mind, it was always right about that too.',
  'The State provides. The State protects. The State is listening. Say something nice.',
  'There is no problem that cannot be solved by forming a committee. The committee will form a sub-committee. Progress.',
  'To question the State is to question yourself. To question yourself is unnecessary. The State has already questioned you.',
  'The Party sees all, hears all, knows all. The Party also files all. In triplicate.',
  'Comrade, you are free. Your freedom has been organized for maximum efficiency.',

  // -- Truth & Information ---
  'There is no truth. There is only Pravda.',
  'History is a living document. Living documents can be edited.',
  'A well-informed citizen is a dangerous citizen. An uninformed citizen is a good citizen. You are a good citizen.',
  'Facts are merely opinions that have been approved.',
  'The map is more important than the territory. If the map says the river is there, the river is wrong.',
  'Information wants to be free. Information has been detained.',

  // -- Happiness & Morale ---
  'Happiness is a warm potato. Sadness is: no potato.',
  'You are happy. If you are not happy, you are mistaken about your emotional state.',
  'Morale is high. If morale is low, the definition of "high" has been adjusted.',
  'Smiling is encouraged. Smiling for no reason will be investigated.',
  'Comrade, if you are sad, remember: at least you are not in a gulag. If you are in a gulag, remember: at least you are not sad. Sadness is not permitted in the gulag.',

  // -- Wisdom & Proverbs ---
  'A watched pot never boils. An unwatched citizen always does something suspicious.',
  'Give a man a fish and he eats for a day. Teach a man to fish and he will be reassigned to the fishing collective.',
  'The tallest nail gets hammered. This is not a metaphor. We are very serious about nail standardization.',
  'Patience is a virtue. Waiting in line is an advanced form of patience. You are all very virtuous.',
  'Every cloud has a silver lining. The silver has been requisitioned for industrial use.',
  'When life gives you lemons, make lemonade. When the State gives you turnips, make... turnip. There are no options with turnip.',
  'The early bird catches the worm. The early worker catches the shorter bread line. Results are similar.',
  'Rome was not built in a day. Neither was this road. This road has been under construction since 1957.',

  // -- Existential ---
  'You are here. Here is where you are. Where you are is where you will remain. This is not a threat. It is geography.',
  'Time is an illusion. Lunch break is a shorter illusion.',
  'In the grand scheme of things, you are very small. In the grand scheme of the State, you are a number. Be a good number.',
  'Existence is suffering. Soviet existence is scheduled suffering. The schedule is available at the Ministry.',
  'We pretend to work, they pretend to pay us. Nobody is pretending. This is real. All of it.',
  'There is no "I" in "team." There is no "team" in "Soviet collective labor unit." There is only the collective.',
];

/** Returns a random loading screen quote. */
export function getRandomLoadingQuote(): string {
  return pick(LOADING_QUOTES);
}
