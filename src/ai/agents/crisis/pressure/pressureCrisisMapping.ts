/**
 * @module ai/agents/crisis/pressure/pressureCrisisMapping
 *
 * Maps each pressure domain to minor incidents and major crises.
 * Minor = Pravda headlines + small morale hits (warning threshold).
 * Major = real CrisisImpact tickets through existing pipeline (critical).
 */

import type { CrisisDefinition, CrisisImpact, CrisisSeverity } from '../types';
import type { PressureDomain } from './PressureDomains';

// ─── Templates ───────────────────────────────────────────────────────────────

/** Minor incident template (warning-level). */
export interface MinorIncidentTemplate {
  domain: PressureDomain;
  name: string;
  pravdaHeadline: string;
  toastMessage: string;
  /** Small impact (morale hit, minor production penalty, etc.). */
  impact: CrisisImpact;
}

/** Major crisis template (critical-level). */
export interface MajorCrisisTemplate {
  domain: PressureDomain;
  name: string;
  /** Crisis type for the existing pipeline. */
  crisisType: 'war' | 'famine' | 'disaster' | 'political';
  /** Base severity (modulated by pressure level). */
  baseSeverity: CrisisSeverity;
  /** Duration in years. */
  durationYears: number;
  /** Base peak parameters for the CrisisDefinition. */
  basePeakParams: Record<string, number>;
  /** Buildup ticks. */
  buildupTicks: number;
  /** Aftermath ticks. */
  aftermathTicks: number;
}

// ─── Minor Incidents ─────────────────────────────────────────────────────────

export const MINOR_INCIDENTS: Record<PressureDomain, MinorIncidentTemplate> = {
  food: {
    domain: 'food',
    name: 'Temporary Food Shortfall',
    pravdaHeadline: 'TEMPORARY SUPPLY DISRUPTION — Citizens advised to economize.',
    toastMessage: 'Food supplies running low.',
    impact: {
      crisisId: 'minor-food',
      workforce: { moraleModifier: -0.05 },
      narrative: { pravdaHeadlines: ['TEMPORARY SUPPLY DISRUPTION'], toastMessages: [{ text: 'Food supplies running low.', severity: 'warning' }] },
    },
  },
  morale: {
    domain: 'morale',
    name: 'Worker Unrest',
    pravdaHeadline: 'MINOR LABOR DISPUTE RESOLVED THROUGH SOCIALIST DIALOGUE.',
    toastMessage: 'Workers expressing dissatisfaction.',
    impact: {
      crisisId: 'minor-morale',
      economy: { productionMult: 0.95 },
      narrative: { pravdaHeadlines: ['MINOR LABOR DISPUTE RESOLVED'], toastMessages: [{ text: 'Workers expressing dissatisfaction.', severity: 'warning' }] },
    },
  },
  loyalty: {
    domain: 'loyalty',
    name: 'Sabotage Wave',
    pravdaHeadline: 'COUNTER-REVOLUTIONARY ELEMENTS DETECTED — Vigilance urged.',
    toastMessage: 'Sabotage incidents reported.',
    impact: {
      crisisId: 'minor-loyalty',
      political: { kgbAggressionMult: 1.3 },
      narrative: { pravdaHeadlines: ['COUNTER-REVOLUTIONARY ELEMENTS DETECTED'], toastMessages: [{ text: 'Sabotage incidents reported.', severity: 'warning' }] },
    },
  },
  housing: {
    domain: 'housing',
    name: 'Overcrowding Complaints',
    pravdaHeadline: 'HOUSING COMMITTEE REPORTS TEMPORARY CAPACITY CONSTRAINTS.',
    toastMessage: 'Citizens complaining about overcrowding.',
    impact: {
      crisisId: 'minor-housing',
      workforce: { moraleModifier: -0.03 },
      narrative: { pravdaHeadlines: ['HOUSING COMMITTEE REPORTS CONSTRAINTS'], toastMessages: [{ text: 'Overcrowding complaints.', severity: 'warning' }] },
    },
  },
  political: {
    domain: 'political',
    name: 'Party Scrutiny',
    pravdaHeadline: 'REGIONAL COMMITTEE ANNOUNCES ROUTINE INSPECTION.',
    toastMessage: 'Moscow is paying attention.',
    impact: {
      crisisId: 'minor-political',
      political: { kgbAggressionMult: 1.2, quotaMult: 1.1 },
      narrative: { pravdaHeadlines: ['REGIONAL COMMITTEE INSPECTION'], toastMessages: [{ text: 'Moscow is paying attention.', severity: 'warning' }] },
    },
  },
  power: {
    domain: 'power',
    name: 'Rolling Blackouts',
    pravdaHeadline: 'SCHEDULED MAINTENANCE ON POWER GRID — Temporary outages expected.',
    toastMessage: 'Rolling blackouts affecting production.',
    impact: {
      crisisId: 'minor-power',
      economy: { productionMult: 0.9 },
      narrative: { pravdaHeadlines: ['POWER GRID MAINTENANCE'], toastMessages: [{ text: 'Rolling blackouts.', severity: 'warning' }] },
    },
  },
  infrastructure: {
    domain: 'infrastructure',
    name: 'Accelerated Decay',
    pravdaHeadline: 'BUILDING INSPECTORS NOTE MAINTENANCE BACKLOG.',
    toastMessage: 'Infrastructure deteriorating.',
    impact: {
      crisisId: 'minor-infrastructure',
      infrastructure: { decayMult: 1.3 },
      narrative: { pravdaHeadlines: ['MAINTENANCE BACKLOG NOTED'], toastMessages: [{ text: 'Infrastructure deteriorating.', severity: 'warning' }] },
    },
  },
  demographic: {
    domain: 'demographic',
    name: 'Labor Shortage',
    pravdaHeadline: 'PRODUCTION TARGETS REQUIRE ADDITIONAL LABOR ALLOCATION.',
    toastMessage: 'Not enough workers.',
    impact: {
      crisisId: 'minor-demographic',
      economy: { productionMult: 0.92 },
      narrative: { pravdaHeadlines: ['LABOR ALLOCATION NEEDED'], toastMessages: [{ text: 'Labor shortage.', severity: 'warning' }] },
    },
  },
  health: {
    domain: 'health',
    name: 'Disease Outbreak',
    pravdaHeadline: 'MINOR ILLNESS REPORTED — Clinic capacity adequate.',
    toastMessage: 'Disease spreading.',
    impact: {
      crisisId: 'minor-health',
      social: { diseaseMult: 1.5 },
      narrative: { pravdaHeadlines: ['MINOR ILLNESS REPORTED'], toastMessages: [{ text: 'Disease spreading.', severity: 'warning' }] },
    },
  },
  economic: {
    domain: 'economic',
    name: 'Production Shortfall',
    pravdaHeadline: 'QUARTERLY TARGETS REVISED — Workers urged to increase output.',
    toastMessage: 'Production falling behind quota.',
    impact: {
      crisisId: 'minor-economic',
      political: { quotaMult: 1.15 },
      narrative: { pravdaHeadlines: ['QUARTERLY TARGETS REVISED'], toastMessages: [{ text: 'Production behind quota.', severity: 'warning' }] },
    },
  },
};

// ─── Major Crises ────────────────────────────────────────────────────────────

export const MAJOR_CRISES: Record<PressureDomain, MajorCrisisTemplate> = {
  food: {
    domain: 'food',
    name: 'Famine',
    crisisType: 'famine',
    baseSeverity: 'regional',
    durationYears: 2,
    basePeakParams: { foodDrainPerCapita: 0.3, diseaseMult: 2.0, moraleHit: -0.5, growthMult: 0.2, productionMult: 0.5 },
    buildupTicks: 6,
    aftermathTicks: 12,
  },
  morale: {
    domain: 'morale',
    name: 'Worker Revolt',
    crisisType: 'political',
    baseSeverity: 'regional',
    durationYears: 1,
    basePeakParams: { productionMult: 0.4, moraleHit: -0.7, kgbAggressionMult: 2.0 },
    buildupTicks: 4,
    aftermathTicks: 12,
  },
  loyalty: {
    domain: 'loyalty',
    name: 'Mass Defection',
    crisisType: 'political',
    baseSeverity: 'national',
    durationYears: 1,
    basePeakParams: { kgbAggressionMult: 2.5, quotaMult: 1.3, moraleHit: -0.4, productionMult: 0.6 },
    buildupTicks: 3,
    aftermathTicks: 18,
  },
  housing: {
    domain: 'housing',
    name: 'Housing Crisis',
    crisisType: 'disaster',
    baseSeverity: 'regional',
    durationYears: 2,
    basePeakParams: { moraleHit: -0.4, growthMult: 0.5, productionMult: 0.8 },
    buildupTicks: 6,
    aftermathTicks: 12,
  },
  political: {
    domain: 'political',
    name: 'Political Purge',
    crisisType: 'political',
    baseSeverity: 'national',
    durationYears: 2,
    basePeakParams: { kgbAggressionMult: 3.0, quotaMult: 1.5, moraleHit: -0.6, productionMult: 0.5 },
    buildupTicks: 6,
    aftermathTicks: 24,
  },
  power: {
    domain: 'power',
    name: 'Power Grid Collapse',
    crisisType: 'disaster',
    baseSeverity: 'regional',
    durationYears: 1,
    basePeakParams: { productionMult: 0.3, moraleHit: -0.5, decayMult: 2.0 },
    buildupTicks: 3,
    aftermathTicks: 12,
  },
  infrastructure: {
    domain: 'infrastructure',
    name: 'Infrastructure Crisis',
    crisisType: 'disaster',
    baseSeverity: 'regional',
    durationYears: 2,
    basePeakParams: { decayMult: 3.0, productionMult: 0.6, moraleHit: -0.3 },
    buildupTicks: 6,
    aftermathTicks: 18,
  },
  demographic: {
    domain: 'demographic',
    name: 'Demographic Collapse',
    crisisType: 'disaster',
    baseSeverity: 'national',
    durationYears: 3,
    basePeakParams: { growthMult: 0.1, productionMult: 0.5, moraleHit: -0.5 },
    buildupTicks: 12,
    aftermathTicks: 24,
  },
  health: {
    domain: 'health',
    name: 'Epidemic',
    crisisType: 'disaster',
    baseSeverity: 'regional',
    durationYears: 1,
    basePeakParams: { diseaseMult: 4.0, growthMult: 0.3, moraleHit: -0.6, productionMult: 0.6 },
    buildupTicks: 3,
    aftermathTicks: 12,
  },
  economic: {
    domain: 'economic',
    name: 'Economic Crisis',
    crisisType: 'political',
    baseSeverity: 'national',
    durationYears: 2,
    basePeakParams: { productionMult: 0.4, quotaMult: 1.5, moraleHit: -0.4 },
    buildupTicks: 6,
    aftermathTicks: 18,
  },
};

// ─── Crisis Generation ───────────────────────────────────────────────────────

/**
 * Generate a CrisisDefinition from a major crisis template.
 *
 * @param template - The major crisis template
 * @param year - Current game year
 * @param pressureLevel - Current pressure level (0-1) for severity scaling
 * @param crisisId - Unique crisis ID
 */
export function generateCrisisFromTemplate(
  template: MajorCrisisTemplate,
  year: number,
  pressureLevel: number,
  crisisId: string,
): CrisisDefinition {
  // Scale severity based on pressure level
  let severity: CrisisSeverity = template.baseSeverity;
  if (pressureLevel >= 0.95) severity = 'existential';
  else if (pressureLevel >= 0.85) severity = 'national';
  else if (pressureLevel >= 0.75) severity = 'regional';

  // Scale peak params by pressure level
  const scaledParams: Record<string, number> = {};
  for (const [key, value] of Object.entries(template.basePeakParams)) {
    // For multipliers < 1 (penalties), scale toward worse values
    // For multipliers > 1 (amplifiers), scale toward higher values
    if (value < 1) {
      scaledParams[key] = value * (1 - (pressureLevel - 0.75) * 0.5);
    } else {
      scaledParams[key] = value * (1 + (pressureLevel - 0.75) * 0.5);
    }
  }

  return {
    id: crisisId,
    type: template.crisisType,
    name: `${template.name} of ${year}`,
    startYear: year,
    endYear: year + template.durationYears,
    severity,
    peakParams: scaledParams,
    buildupTicks: template.buildupTicks,
    aftermathTicks: template.aftermathTicks,
    description: `${template.name} — ${severity} severity, pressure-driven`,
  };
}
