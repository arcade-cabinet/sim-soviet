/**
 * @module ai/agents/crisis/pressure/pressureCrisisMapping
 *
 * Maps each pressure domain to minor incidents and major crises.
 * Minor = Pravda headlines + small morale hits (warning threshold).
 * Major = real CrisisImpact tickets through existing pipeline (critical).
 */

import type { CrisisDefinition, CrisisImpact, CrisisSeverity } from '../types';
import type { PostScarcityDomain, PressureDomain } from './PressureDomains';

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

// ─── Post-Scarcity Minor Incidents ───────────────────────────────────────

export const POST_SCARCITY_MINOR_INCIDENTS: Record<PostScarcityDomain, MinorIncidentTemplate> = {
  meaning: {
    domain: 'meaning' as PressureDomain,
    name: 'Existential Malaise',
    pravdaHeadline: 'COMMITTEE NOTES DECLINING PARTICIPATION IN VOLUNTARY LABOR.',
    toastMessage: 'Citizens questioning the purpose of existence.',
    impact: {
      crisisId: 'minor-meaning',
      workforce: { moraleModifier: -0.08 },
      narrative: {
        pravdaHeadlines: ['DECLINING PARTICIPATION IN VOLUNTARY LABOR'],
        toastMessages: [{ text: 'Citizens questioning the purpose of existence.', severity: 'warning' }],
      },
    },
  },
  density: {
    domain: 'density' as PressureDomain,
    name: 'Overcrowding Stress',
    pravdaHeadline: 'HABITAT DENSITY COMMITTEE RECOMMENDS EXPANSION PROTOCOLS.',
    toastMessage: 'Population density causing social friction.',
    impact: {
      crisisId: 'minor-density',
      workforce: { moraleModifier: -0.05 },
      narrative: {
        pravdaHeadlines: ['HABITAT DENSITY COMMITTEE RECOMMENDS EXPANSION'],
        toastMessages: [{ text: 'Population density causing social friction.', severity: 'warning' }],
      },
    },
  },
  entropy: {
    domain: 'entropy' as PressureDomain,
    name: 'Maintenance Backlog',
    pravdaHeadline: 'STELLAR ENGINEERING BUREAU REPORTS MINOR COLLECTOR DEGRADATION.',
    toastMessage: 'Dyson swarm maintenance falling behind.',
    impact: {
      crisisId: 'minor-entropy',
      economy: { productionMult: 0.95 },
      narrative: {
        pravdaHeadlines: ['MINOR COLLECTOR DEGRADATION REPORTED'],
        toastMessages: [{ text: 'Stellar maintenance backlog growing.', severity: 'warning' }],
      },
    },
  },
  legacy: {
    domain: 'legacy' as PressureDomain,
    name: 'Directional Dispute',
    pravdaHeadline: 'CIVILIZATIONAL COMMITTEE DEBATES LONG-TERM RESOURCE ALLOCATION.',
    toastMessage: 'Factions disagree on civilization direction.',
    impact: {
      crisisId: 'minor-legacy',
      political: { kgbAggressionMult: 1.2 },
      narrative: {
        pravdaHeadlines: ['LONG-TERM ALLOCATION DEBATE CONTINUES'],
        toastMessages: [{ text: 'No consensus on civilizational direction.', severity: 'warning' }],
      },
    },
  },
  ennui: {
    domain: 'ennui' as PressureDomain,
    name: 'Civilizational Boredom',
    pravdaHeadline: 'CULTURAL COMMITTEE REPORTS DECLINING CREATIVE OUTPUT.',
    toastMessage: 'Existential boredom spreading.',
    impact: {
      crisisId: 'minor-ennui',
      economy: { productionMult: 0.93 },
      workforce: { moraleModifier: -0.06 },
      narrative: {
        pravdaHeadlines: ['DECLINING CREATIVE OUTPUT NOTED'],
        toastMessages: [{ text: 'Existential boredom spreading through the collective.', severity: 'warning' }],
      },
    },
  },
};

// ─── Post-Scarcity Major Crises ─────────────────────────────────────────

export const POST_SCARCITY_MAJOR_CRISES: Record<PostScarcityDomain, MajorCrisisTemplate> = {
  meaning: {
    domain: 'meaning' as PressureDomain,
    name: 'Meaning Crisis',
    crisisType: 'political',
    baseSeverity: 'national',
    durationYears: 5,
    basePeakParams: { productionMult: 0.3, moraleHit: -0.8, growthMult: 0.1 },
    buildupTicks: 12,
    aftermathTicks: 24,
  },
  density: {
    domain: 'density' as PressureDomain,
    name: 'Habitat Collapse',
    crisisType: 'disaster',
    baseSeverity: 'regional',
    durationYears: 3,
    basePeakParams: { moraleHit: -0.6, growthMult: 0.3, productionMult: 0.5 },
    buildupTicks: 6,
    aftermathTicks: 18,
  },
  entropy: {
    domain: 'entropy' as PressureDomain,
    name: 'Stellar Cascade Failure',
    crisisType: 'disaster',
    baseSeverity: 'existential',
    durationYears: 10,
    basePeakParams: { productionMult: 0.1, decayMult: 5.0, moraleHit: -0.9 },
    buildupTicks: 6,
    aftermathTicks: 36,
  },
  legacy: {
    domain: 'legacy' as PressureDomain,
    name: 'Civilizational Schism',
    crisisType: 'political',
    baseSeverity: 'existential',
    durationYears: 8,
    basePeakParams: { kgbAggressionMult: 3.0, productionMult: 0.4, moraleHit: -0.7 },
    buildupTicks: 12,
    aftermathTicks: 30,
  },
  ennui: {
    domain: 'ennui' as PressureDomain,
    name: 'Hedonistic Collapse',
    crisisType: 'political',
    baseSeverity: 'national',
    durationYears: 5,
    basePeakParams: { productionMult: 0.2, moraleHit: -0.9, growthMult: 0.2 },
    buildupTicks: 8,
    aftermathTicks: 24,
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
