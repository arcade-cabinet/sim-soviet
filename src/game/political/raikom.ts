/**
 * @module game/political/raikom
 *
 * RAIKOM SYSTEM — District Committee
 *
 * The Raikom (district party committee) is a procedural character that:
 * - Has a name, personality, and agenda
 * - Visits the settlement periodically
 * - Issues directives (build X, produce Y, purge Z)
 * - Can be bribed with blat
 * - Reports to Moscow (affects personnel file)
 */

import type { GameRng } from '@/game/SeedSystem';
import type { RaikomDirective, RaikomPersonality, RaikomState } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** How often the Raikom visits (base ticks between visits). */
const BASE_VISIT_INTERVAL = 180;

/** Variance on visit timing (ticks). */
const VISIT_INTERVAL_VARIANCE = 60;

/** Favor gained per unit of blat spent. */
const BLAT_FAVOR_RATE = 5;

/** Favor threshold below which Raikom sends bad reports to Moscow. */
const BAD_REPORT_FAVOR_THRESHOLD = 30;

/** Favor threshold above which Raikom sends good reports to Moscow. */
const GOOD_REPORT_FAVOR_THRESHOLD = 70;

/** Marks penalty per bad Moscow report. */
const BAD_REPORT_MARKS = 1;

/** How many ticks a directive lasts before deadline. */
const DIRECTIVE_DEADLINE_TICKS = 120;

/** Maximum active directives at once. */
const MAX_ACTIVE_DIRECTIVES = 3;

// ─── Name Generation ────────────────────────────────────────────────────────

const RAIKOM_FIRST_NAMES = [
  'Grigori',
  'Nikolai',
  'Dmitri',
  'Anatoly',
  'Viktor',
  'Boris',
  'Sergei',
  'Yuri',
  'Aleksei',
  'Vladimir',
] as const;

const RAIKOM_LAST_NAMES = [
  'Braginskiy',
  'Churkin',
  'Dobrolubov',
  'Gradov',
  'Karpenko',
  'Lagunov',
  'Naumov',
  'Ozerov',
  'Proshkin',
  'Tretyakov',
] as const;

const RAIKOM_TITLES: Record<RaikomPersonality, string> = {
  hardliner: 'First Secretary',
  pragmatist: 'Committee Chairman',
  careerist: 'Deputy Secretary',
  reformist: 'Acting Secretary',
};

// ─── Directive Templates ────────────────────────────────────────────────────

interface DirectiveTemplate {
  type: RaikomDirective['type'];
  descriptions: string[];
  penaltyMarks: number;
}

const DIRECTIVE_TEMPLATES: Record<RaikomPersonality, DirectiveTemplate[]> = {
  hardliner: [
    { type: 'build', descriptions: ['Build a guard post immediately.', 'Construct additional housing for workers.'], penaltyMarks: 2 },
    { type: 'purge', descriptions: ['Root out counter-revolutionary elements.', 'Conduct loyalty audit of all workers.'], penaltyMarks: 1 },
    { type: 'produce', descriptions: ['Increase food production by 20%.', 'Double vodka output this quarter.'], penaltyMarks: 2 },
  ],
  pragmatist: [
    { type: 'build', descriptions: ['Expand infrastructure as needed.', 'Build a warehouse for surplus storage.'], penaltyMarks: 1 },
    { type: 'produce', descriptions: ['Meet this quarter production target.', 'Ensure food stores are adequate.'], penaltyMarks: 1 },
    { type: 'celebrate', descriptions: ['Organize a workers celebration.', 'Commemorate the anniversary of the revolution.'], penaltyMarks: 1 },
  ],
  careerist: [
    { type: 'produce', descriptions: ['Exceed quota by 15% for my report.', 'Produce enough vodka to impress Moscow.'], penaltyMarks: 2 },
    { type: 'celebrate', descriptions: ['Stage a parade for visiting officials.', 'Prepare a ceremonial display of achievements.'], penaltyMarks: 1 },
    { type: 'build', descriptions: ['Build something impressive for the delegation.', 'Construct a monument to Soviet progress.'], penaltyMarks: 2 },
  ],
  reformist: [
    { type: 'build', descriptions: ['Build a school for the children.', 'Establish a medical clinic.'], penaltyMarks: 1 },
    { type: 'produce', descriptions: ['Diversify food production.', 'Improve worker living conditions.'], penaltyMarks: 1 },
    { type: 'celebrate', descriptions: ['Organize cultural activities for workers.', 'Hold a community meeting.'], penaltyMarks: 0 },
  ],
};

// ─── Raikom Lifecycle ───────────────────────────────────────────────────────

/** Generate a new Raikom character. */
export function generateRaikom(rng: GameRng, initialTick: number): RaikomState {
  const personalities: RaikomPersonality[] = ['hardliner', 'pragmatist', 'careerist', 'reformist'];
  const personality = rng.pick(personalities);
  const firstName = rng.pick(RAIKOM_FIRST_NAMES);
  const lastName = rng.pick(RAIKOM_LAST_NAMES);
  const title = RAIKOM_TITLES[personality];

  return {
    name: `${title} ${firstName} ${lastName}`,
    personality,
    favor: 50, // Neutral starting favor
    blatAccepted: 0,
    nextVisitTick: initialTick + BASE_VISIT_INTERVAL + rng.int(0, VISIT_INTERVAL_VARIANCE),
    activeDirectives: [],
    reportsToMoscow: 0,
  };
}

/** Offer blat to the Raikom. Returns how much favor was gained. */
export function offerBlat(raikom: RaikomState, blatAmount: number): number {
  const favorGained = Math.floor(blatAmount * BLAT_FAVOR_RATE);
  raikom.favor = Math.min(100, raikom.favor + favorGained);
  raikom.blatAccepted += blatAmount;
  return favorGained;
}

/**
 * Process a Raikom visit. Issues new directives and possibly sends
 * reports to Moscow.
 *
 * @returns New directives issued and whether a Moscow report was sent.
 */
export function processVisit(
  raikom: RaikomState,
  totalTicks: number,
  rng: GameRng,
): { newDirectives: RaikomDirective[]; moscowReport: 'good' | 'bad' | null } {
  const newDirectives: RaikomDirective[] = [];

  // Clean up expired/fulfilled directives
  raikom.activeDirectives = raikom.activeDirectives.filter(
    (d) => !d.fulfilled && totalTicks < d.deadlineTick,
  );

  // Issue new directives (up to MAX_ACTIVE_DIRECTIVES)
  const slotsAvailable = MAX_ACTIVE_DIRECTIVES - raikom.activeDirectives.length;
  if (slotsAvailable > 0) {
    const templates = DIRECTIVE_TEMPLATES[raikom.personality];
    const numToIssue = Math.min(slotsAvailable, rng.int(1, 2));

    for (let i = 0; i < numToIssue; i++) {
      const template = rng.pick(templates);
      const description = rng.pick(template.descriptions);
      const directive: RaikomDirective = {
        id: rng.id(),
        description,
        type: template.type,
        deadlineTick: totalTicks + DIRECTIVE_DEADLINE_TICKS,
        penaltyMarks: template.penaltyMarks,
        fulfilled: false,
      };
      raikom.activeDirectives.push(directive);
      newDirectives.push(directive);
    }
  }

  // Report to Moscow based on favor
  let moscowReport: 'good' | 'bad' | null = null;
  if (raikom.favor < BAD_REPORT_FAVOR_THRESHOLD) {
    moscowReport = 'bad';
    raikom.reportsToMoscow++;
    // Bad reports reduce favor further (vicious cycle)
    raikom.favor = Math.max(0, raikom.favor - 5);
  } else if (raikom.favor >= GOOD_REPORT_FAVOR_THRESHOLD) {
    moscowReport = 'good';
    raikom.reportsToMoscow++;
  }

  // Schedule next visit
  raikom.nextVisitTick = totalTicks + BASE_VISIT_INTERVAL + rng.int(-VISIT_INTERVAL_VARIANCE, VISIT_INTERVAL_VARIANCE);

  return { newDirectives, moscowReport };
}

/**
 * Check for expired directives and apply penalties.
 * @returns Number of black marks incurred from expired directives.
 */
export function checkDirectiveDeadlines(raikom: RaikomState, totalTicks: number): number {
  let marksIncurred = 0;

  const expired = raikom.activeDirectives.filter((d) => !d.fulfilled && totalTicks >= d.deadlineTick);
  for (const directive of expired) {
    marksIncurred += directive.penaltyMarks;
    // Failed directives reduce favor
    raikom.favor = Math.max(0, raikom.favor - 10);
  }

  // Remove expired directives
  raikom.activeDirectives = raikom.activeDirectives.filter((d) => d.fulfilled || totalTicks < d.deadlineTick);

  return marksIncurred;
}

/**
 * Tick the Raikom system.
 * Handles visit scheduling, directive checking, and Moscow reports.
 */
export function tickRaikom(
  raikom: RaikomState,
  totalTicks: number,
  rng: GameRng,
  result: {
    announcements: string[];
    raikomDirectives: RaikomDirective[];
    blackMarksAdded: number;
  },
): void {
  // Check for expired directives
  const penaltyMarks = checkDirectiveDeadlines(raikom, totalTicks);
  if (penaltyMarks > 0) {
    result.blackMarksAdded += penaltyMarks;
    result.announcements.push(
      `Raikom ${raikom.name} notes your failure to fulfill ${penaltyMarks > 1 ? 'directives' : 'a directive'}. ` +
        `${penaltyMarks} mark${penaltyMarks > 1 ? 's' : ''} added to your file.`,
    );
  }

  // Process visit if it's time
  if (totalTicks >= raikom.nextVisitTick) {
    const { newDirectives, moscowReport } = processVisit(raikom, totalTicks, rng);

    for (const directive of newDirectives) {
      result.raikomDirectives.push(directive);
      result.announcements.push(`Raikom directive: "${directive.description}"`);
    }

    if (moscowReport === 'bad') {
      result.blackMarksAdded += BAD_REPORT_MARKS;
      result.announcements.push(
        `${raikom.name} has sent an unfavorable report to Moscow. A black mark has been added.`,
      );
    } else if (moscowReport === 'good') {
      result.announcements.push(
        `${raikom.name} has sent a favorable report to Moscow. The Comrade Mayor is noted positively.`,
      );
    }

    // Natural favor drift toward neutral (50) over time
    if (raikom.favor > 55) {
      raikom.favor -= 1;
    } else if (raikom.favor < 45) {
      raikom.favor += 1;
    }
  }
}
