/**
 * Annual report / quota tick helpers -- extracted from SimulationEngine.
 *
 * Handles quota deadline evaluation, annual report submissions (honest or
 * falsified), and quota met/missed outcomes including black marks,
 * commendations, and game-over from consecutive failures.
 */

import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import { economy, political } from '@/config';
import { getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import type { SimCallbacks } from '../../../game/engine/types';
import type { GameRng } from '../../../game/SeedSystem';
import type { ChronologySystem } from '../core/ChronologyAgent';
import type { CompulsoryDeliveries } from './CompulsoryDeliveries';
import type { PersonnelFile } from './KGBAgent';
import type { MandateWithFulfillment, PlanMandateState, QuotaState } from './PoliticalAgent';
import { allMandatesComplete, getMandateFulfillment } from './PoliticalAgent';
import type { ScoringSystem } from './ScoringSystem';

/** Consecutive quota failures that trigger game over. */
const MAX_QUOTA_FAILURES = political.annualReport.maxQuotaFailures;

/** Pripiski inflation applied to next quota when falsification succeeds. */
const PRIPISKI_QUOTA_INFLATION = political.annualReport.pripiskiQuotaInflation;

/** Additional investigation probability from prior pripiski history. */
const PRIPISKI_HISTORY_INSPECTION_BONUS = political.annualReport.pripiskiHistoryInspectionBonus;

/** Minimum baseline for a normal 5-year plan target before difficulty modifiers. */
const BASE_PLAN_TARGET = 500;

/** Floor for a revised plan so misses remain meaningful without being impossible. */
const MIN_REVISED_PLAN_TARGET = 100;

function finiteNonNegative(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

function planNameForYear(year: number): string {
  return year >= 1928 ? 'Five-Year Plan' : 'state work plan';
}

function numberedPlanNameForYear(year: number): string {
  return year >= 1928 ? '5-Year Plan' : 'state work plan';
}

function securityServiceForYear(year: number): string {
  if (year >= 1954) return 'KGB';
  if (year >= 1946) return 'MGB';
  if (year >= 1934) return 'NKVD';
  if (year >= 1922) return 'OGPU';
  return 'Cheka';
}

/** Mutable engine state that the annual report helpers read and write. */
export interface AnnualReportEngineState {
  quota: QuotaState;
  consecutiveQuotaFailures: number;
  pendingReport: boolean;
  mandateState: PlanMandateState | null;
  /** Number of times the player successfully falsified reports (undetected). */
  pripiskiCount: number;
  /** Difficulty-based quota target multiplier. */
  quotaMultiplier: number;
}

/** Subset of SimulationEngine state needed by annual report helpers. */
export interface AnnualReportContext {
  chronology: ChronologySystem;
  personnelFile: PersonnelFile;
  scoring: ScoringSystem;
  callbacks: SimCallbacks;
  rng: GameRng | undefined;
  engineState: AnnualReportEngineState;
  deliveries: CompulsoryDeliveries;
  endGame: (victory: boolean, reason: string) => void;
}

/**
 * Checks if the current year triggers a quota deadline.
 * If an onAnnualReport callback is registered, defers to the player;
 * otherwise evaluates directly.
 */
export function checkQuota(ctx: AnnualReportContext): void {
  const meta = getMetaEntity();
  const res = getResourceEntity();
  const currentYear = meta?.gameMeta.date.year ?? 1922;
  const { engineState } = ctx;
  if (currentYear < engineState.quota.deadlineYear) return;
  if (engineState.pendingReport) return;

  // If onAnnualReport callback is registered, defer evaluation to the player
  if (ctx.callbacks.onAnnualReport) {
    engineState.pendingReport = true;

    const data: AnnualReportData = {
      year: currentYear,
      quotaType: engineState.quota.type as 'food' | 'vodka',
      quotaTarget: finiteNonNegative(engineState.quota.target, BASE_PLAN_TARGET),
      quotaCurrent: finiteNonNegative(engineState.quota.current),
      actualFood: finiteNonNegative(res?.resources.food ?? 0),
      actualVodka: finiteNonNegative(res?.resources.vodka ?? 0),
      actualPop: finiteNonNegative(res?.resources.population ?? 0),
      deliveries: ctx.deliveries.getTotalDelivered(),
      mandateFulfillment: engineState.mandateState ? getMandateFulfillment(engineState.mandateState) : undefined,
    };

    ctx.callbacks.onAnnualReport(data, (submission: ReportSubmission) => {
      processReport(ctx, submission);
      engineState.pendingReport = false;
    });
  } else {
    // No report UI -- evaluate directly (backward compatible)
    if (engineState.quota.current >= engineState.quota.target) {
      handleQuotaMet(ctx);
    } else {
      handleQuotaMissed(ctx);
    }
  }
}

/**
 * Processes an annual report submission (honest or falsified).
 * Honest: standard quota evaluation.
 * Falsified: risk-based investigation -- if caught, extra black marks + honest eval;
 * if not caught, reported values determine quota outcome.
 */
export function processReport(ctx: AnnualReportContext, submission: ReportSubmission): void {
  const { engineState } = ctx;
  const quotaActual = finiteNonNegative(engineState.quota.current);
  const res = getResourceEntity();
  const isHonest =
    submission.reportedQuota === quotaActual &&
    submission.reportedSecondary ===
      (engineState.quota.type === 'food'
        ? finiteNonNegative(res?.resources.vodka ?? 0)
        : finiteNonNegative(res?.resources.food ?? 0)) &&
    submission.reportedPop === finiteNonNegative(res?.resources.population ?? 0);

  if (isHonest) {
    if (engineState.quota.current >= engineState.quota.target) {
      handleQuotaMet(ctx);
    } else {
      handleQuotaMissed(ctx);
    }
    return;
  }

  // Falsified report -- calculate aggregate risk
  const quotaRisk = falsificationRisk(quotaActual, submission.reportedQuota);
  const secActual =
    engineState.quota.type === 'food'
      ? finiteNonNegative(res?.resources.vodka ?? 0)
      : finiteNonNegative(res?.resources.food ?? 0);
  const secRisk = falsificationRisk(secActual, submission.reportedSecondary);
  const popRisk = falsificationRisk(finiteNonNegative(res?.resources.population ?? 0), submission.reportedPop);
  const maxRisk = Math.max(quotaRisk, secRisk, popRisk);

  // Investigation probability scales with risk (capped at 80%).
  // Prior successful pripiski increase baseline inspection probability by +15% each.
  const historyBonus = engineState.pripiskiCount * PRIPISKI_HISTORY_INSPECTION_BONUS;

  // Blat insurance: spending blat reduces investigation chance.
  // Each point of blat reduces detection probability by 0.5% (max 25% reduction).
  const blatLevel = res?.resources.blat ?? 0;
  const blatInsurance = Math.min(0.25, blatLevel * 0.005);

  const investigationProb = Math.min(0.8, Math.max(0, maxRisk / 100 + historyBonus - blatInsurance));
  const roll = ctx.rng ? ctx.rng.random() : Math.random();

  // Spend blat when falsifying — connections used to smooth things over
  if (blatInsurance > 0 && res) {
    const blatCost = Math.min(res.resources.blat, Math.ceil(blatLevel * 0.1));
    res.resources.blat = Math.max(0, res.resources.blat - blatCost);
  }

  if (roll < investigationProb) {
    // CAUGHT -- investigation detected falsification (now +3 marks per docs)
    const totalTicks = ctx.chronology.getDate().totalTicks;
    ctx.personnelFile.addMark('report_falsified', totalTicks);
    ctx.callbacks.onToast('FALSIFICATION DETECTED — Investigation ordered', 'evacuation');
    ctx.callbacks.onAdvisor(
      'Comrade, the State Committee has detected discrepancies in your report. ' +
        'Black marks have been added to your personnel file.',
    );

    // Evaluate with ACTUAL values
    if (engineState.quota.current >= engineState.quota.target) {
      handleQuotaMet(ctx);
    } else {
      handleQuotaMissed(ctx);
    }
  } else {
    // Got away with it -- record successful pripiski
    engineState.pripiskiCount++;
    ctx.callbacks.onToast('Report accepted by Gosplan', 'warning');

    if (submission.reportedQuota >= engineState.quota.target) {
      handleQuotaMet(ctx, true);
    } else {
      handleQuotaMissed(ctx);
    }
  }
}

export function falsificationRisk(actual: number, reported: number): number {
  if (actual === 0 && reported === 0) return 0;
  if (actual === 0) return 100;
  return Math.round((Math.abs(reported - actual) / actual) * 100);
}

/**
 * Evaluates mandate fulfillment at plan deadline.
 *
 * All mandates complete → commendation.
 * Any mandates incomplete → black mark (construction_mandate).
 * Partial completion (>50%) with some incomplete → advisory warning only.
 *
 * Called by both handleQuotaMet and handleQuotaMissed since mandates
 * are evaluated independently from production quota.
 */
function evaluateMandates(ctx: AnnualReportContext): void {
  const { engineState } = ctx;
  const totalTicks = ctx.chronology.getDate().totalTicks;
  const currentYear = getMetaEntity()?.gameMeta.date.year ?? ctx.chronology.getDate().year;
  const planName = planNameForYear(currentYear);

  if (!engineState.mandateState || engineState.mandateState.mandates.length === 0) {
    return;
  }

  const fulfillmentRatio = getMandateFulfillment(engineState.mandateState);

  if (allMandatesComplete(engineState.mandateState)) {
    // All mandates fulfilled — commendation
    ctx.personnelFile.addCommendation('mandates_fulfilled', totalTicks);
    ctx.callbacks.onToast('+1 COMMENDATION: All building mandates fulfilled', 'warning');
  } else if (fulfillmentRatio < 0.5) {
    // Less than half fulfilled — black mark
    ctx.personnelFile.addMark(
      'construction_mandate',
      totalTicks,
      `Building mandates severely unfulfilled (${Math.round(fulfillmentRatio * 100)}% complete)`,
    );
    ctx.callbacks.onToast('BLACK MARK: Construction mandates not met', 'critical');
    ctx.callbacks.onAdvisor(
      'Comrade, the State Planning Committee has noted your failure to meet ' +
        `the construction mandates of the ${planName}. ` +
        'A notation has been made in your personnel file.',
    );
  } else {
    // Partially fulfilled (50-99%) — warning but no mark
    ctx.callbacks.onAdvisor(
      `Building mandates partially fulfilled (${Math.round(fulfillmentRatio * 100)}%). ` +
        'The Committee has noted your... adequate effort.',
    );
  }
}

export function handleQuotaMet(ctx: AnnualReportContext, falsified = false): void {
  const { engineState } = ctx;
  const totalTicks = ctx.chronology.getDate().totalTicks;
  engineState.consecutiveQuotaFailures = 0;
  engineState.quota.current = finiteNonNegative(engineState.quota.current);
  engineState.quota.target = Math.max(1, finiteNonNegative(engineState.quota.target, BASE_PLAN_TARGET));

  // Score: quota met (+50)
  ctx.scoring.onQuotaMet();

  if (engineState.quota.current > engineState.quota.target * 1.1) {
    ctx.personnelFile.addCommendation('quota_exceeded', totalTicks);
    ctx.callbacks.onToast('+1 COMMENDATION: Quota exceeded', 'warning');
    // Score: quota exceeded (+25)
    ctx.scoring.onQuotaExceeded();
  }

  // Evaluate building mandates independently from quota
  evaluateMandates(ctx);

  // Reset delivery totals for the new plan period
  ctx.deliveries.resetTotals();

  ctx.callbacks.onAdvisor('Quota met. Accept this medal made of tin. Now, produce VODKA.');
  engineState.quota.type = 'vodka';
  // Base target scaled by difficulty quota multiplier
  let nextTarget = Math.round(500 * engineState.quotaMultiplier);
  // Successful pripiski inflates the next quota target by +20%
  // (Gosplan raises expectations based on the inflated numbers you reported)
  if (falsified) {
    nextTarget = Math.round(nextTarget * (1 + PRIPISKI_QUOTA_INFLATION));
  }
  engineState.quota.target = nextTarget;
  const metaYear = getMetaEntity()?.gameMeta.date.year ?? 1922;
  engineState.quota.deadlineYear = metaYear + 5;
  engineState.quota.current = 0;

  // Show the new plan directive modal
  ctx.callbacks.onNewPlan?.({
    quotaType: engineState.quota.type as 'food' | 'vodka',
    quotaTarget: engineState.quota.target,
    startYear: metaYear,
    endYear: engineState.quota.deadlineYear,
    mandates: engineState.mandateState?.mandates as MandateWithFulfillment[] | undefined,
  });
}

export function handleQuotaMissed(ctx: AnnualReportContext): void {
  const { engineState } = ctx;
  const totalTicks = ctx.chronology.getDate().totalTicks;
  const currentYear = getMetaEntity()?.gameMeta.date.year ?? ctx.chronology.getDate().year;
  engineState.quota.current = finiteNonNegative(engineState.quota.current);
  engineState.quota.target = Math.max(1, finiteNonNegative(engineState.quota.target, BASE_PLAN_TARGET));
  engineState.consecutiveQuotaFailures++;
  const revisedTarget = calculateRevisedMissedPlanTarget(engineState);
  const missPercent = 1 - engineState.quota.current / Math.max(1, revisedTarget);

  // Black marks based on how badly the quota was missed
  if (missPercent > 0.6) {
    ctx.personnelFile.addMark('quota_missed_catastrophic', totalTicks);
  } else if (missPercent > 0.3) {
    ctx.personnelFile.addMark('quota_missed_major', totalTicks);
  } else if (missPercent > 0.1) {
    ctx.personnelFile.addMark('quota_missed_minor', totalTicks);
  }

  // Evaluate building mandates independently from quota
  evaluateMandates(ctx);

  // Reset delivery totals for the extended plan period
  ctx.deliveries.resetTotals();

  if (shouldReassignUnworkableQuota(engineState)) {
    reassignUnworkableQuota(ctx);
    return;
  }

  if (engineState.consecutiveQuotaFailures >= MAX_QUOTA_FAILURES) {
    ctx.endGame(
      false,
      `You failed ${MAX_QUOTA_FAILURES} consecutive ${numberedPlanNameForYear(currentYear)}s. The Politburo has dissolved your position.`,
    );
  } else {
    ctx.callbacks.onAdvisor(
      `You failed the ${numberedPlanNameForYear(currentYear)} (${engineState.consecutiveQuotaFailures}/${MAX_QUOTA_FAILURES} failures). The ${securityServiceForYear(currentYear)} is watching.`,
    );
    engineState.quota.target = revisedTarget;
    engineState.quota.current = 0;
    engineState.quota.deadlineYear += 5;
  }
}

/**
 * Extend a missed plan with a bounded revised target.
 *
 * The Stakhanovite and pripiski systems can legitimately raise expectations,
 * but missed plans should not preserve runaway multiplicative targets forever.
 * Rebase against actual output and the difficulty baseline so the extended
 * plan stays punitive without becoming a dead campaign.
 */
function calculateRevisedMissedPlanTarget(engineState: AnnualReportEngineState): number {
  const currentTarget = Math.max(1, finiteNonNegative(engineState.quota.target, BASE_PLAN_TARGET));
  const currentProgress = finiteNonNegative(engineState.quota.current);
  const reducedTarget = Math.round(currentTarget * economy.quota.missedReduction);
  const hardshipFloor = Math.max(
    MIN_REVISED_PLAN_TARGET,
    Math.round(BASE_PLAN_TARGET * engineState.quotaMultiplier * 0.25),
  );
  const outputBasedTarget = Math.round(currentProgress * 1.25);
  const attainableCeiling = Math.max(hardshipFloor, outputBasedTarget);
  return Math.max(hardshipFloor, Math.min(reducedTarget, attainableCeiling));
}

function shouldReassignUnworkableQuota(engineState: AnnualReportEngineState): boolean {
  if (engineState.quota.type !== 'vodka') return false;
  if (engineState.consecutiveQuotaFailures < 3) return false;
  return engineState.quota.current < Math.max(5, engineState.quota.target * 0.1);
}

function reassignUnworkableQuota(ctx: AnnualReportContext): void {
  const { engineState } = ctx;
  const res = getResourceEntity();
  const currentFood = finiteNonNegative(res?.resources.food ?? 0);
  const metaYear = getMetaEntity()?.gameMeta.date.year ?? ctx.chronology.getDate().year;
  const difficultyBaseline = Math.round(BASE_PLAN_TARGET * engineState.quotaMultiplier);
  const foodTarget = Math.max(
    MIN_REVISED_PLAN_TARGET,
    Math.min(difficultyBaseline, Math.round(Math.max(currentFood * 0.75, MIN_REVISED_PLAN_TARGET))),
  );

  engineState.consecutiveQuotaFailures = 0;
  engineState.quota.type = 'food';
  engineState.quota.target = foodTarget;
  engineState.quota.current = 0;
  engineState.quota.deadlineYear = metaYear + 5;

  ctx.callbacks.onAdvisor(
    'Gosplan has revised the local plan back to food deliveries. Produce something measurable, Comrade.',
  );
  ctx.callbacks.onNewPlan?.({
    quotaType: 'food',
    quotaTarget: engineState.quota.target,
    startYear: metaYear,
    endYear: engineState.quota.deadlineYear,
    mandates: engineState.mandateState?.mandates as MandateWithFulfillment[] | undefined,
  });
}
