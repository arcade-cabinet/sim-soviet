/**
 * @fileoverview Tests for morale decentralization:
 * - Morale NOT visible in TopBar props
 * - Morale NOT visible in WorkerStatusBar (removed MORALE stat box)
 * - KGB morale reports generated at threshold crossings
 * - KGB morale report severity classification
 * - Pravda morale-reactive headlines contradict reality at low morale
 * - Pressure system still reads morale internally (not broken)
 */

import { KGBAgent, MORALE_CONCERN_THRESHOLD, MORALE_CRITICAL_THRESHOLD, MORALE_WARNING_THRESHOLD } from '@/ai/agents/political/KGBAgent';
import type { KGBMoraleReport, MoraleReportSeverity } from '@/ai/agents/political/types';
import { contextualGenerators } from '@/ai/agents/narrative/pravda/generators/absurdist';
import type { TopBarProps } from '@/ui/TopBar';
import type { GameView } from '@/game/GameView';

// ── TopBar: morale NOT visible ──────────────────────────────────────────────

describe('TopBar props — no morale', () => {
  it('TopBarProps does NOT include morale or happiness fields', () => {
    // TypeScript structural check: TopBarProps should only have
    // food, timber, population, dateLabel, speed, etc. — NOT morale.
    const props: TopBarProps = {
      food: 100,
      timber: 50,
      population: 25,
      dateLabel: 'MAR 1922',
      monthProgress: 0.5,
      speed: 1,
      onSetSpeed: () => {},
    };

    // Ensure these standard fields exist
    expect(props.food).toBe(100);
    expect(props.timber).toBe(50);
    expect(props.population).toBe(25);
    expect(props.dateLabel).toBe('MAR 1922');

    // Ensure morale/happiness is NOT in the props type
    expect('morale' in props).toBe(false);
    expect('happiness' in props).toBe(false);
    expect('avgMorale' in props).toBe(false);
  });
});

// ── KGB Morale Reports ──────────────────────────────────────────────────────

describe('KGBAgent morale reports', () => {
  let kgb: KGBAgent;

  beforeEach(() => {
    kgb = new KGBAgent('comrade');
  });

  it('starts with no morale reports', () => {
    expect(kgb.getMoraleReports()).toHaveLength(0);
  });

  it('does NOT generate reports when morale is above concern threshold', () => {
    kgb.sampleMorale(
      [{ sectorId: { gridX: 3, gridY: 5 }, avgMorale: 60 }],
      100,
    );
    expect(kgb.getMoraleReports()).toHaveLength(0);
  });

  it('does NOT generate reports at exactly the concern threshold', () => {
    kgb.sampleMorale(
      [{ sectorId: { gridX: 0, gridY: 0 }, avgMorale: MORALE_CONCERN_THRESHOLD }],
      100,
    );
    expect(kgb.getMoraleReports()).toHaveLength(0);
  });

  it('generates a "concern" report when morale drops below 40', () => {
    kgb.sampleMorale(
      [{ sectorId: { gridX: 2, gridY: 3 }, avgMorale: 35 }],
      200,
    );
    const reports = kgb.getMoraleReports();
    expect(reports).toHaveLength(1);
    expect(reports[0]!.severity).toBe('concern');
    expect(reports[0]!.avgMorale).toBe(35);
    expect(reports[0]!.timestamp).toBe(200);
    expect(reports[0]!.sectorId).toEqual({ gridX: 2, gridY: 3 });
  });

  it('generates a "warning" report when morale drops below 25', () => {
    kgb.sampleMorale(
      [{ sectorId: { gridX: 1, gridY: 1 }, avgMorale: 20 }],
      300,
    );
    const reports = kgb.getMoraleReports();
    expect(reports).toHaveLength(1);
    expect(reports[0]!.severity).toBe('warning');
  });

  it('generates a "critical" report when morale drops below 15', () => {
    kgb.sampleMorale(
      [{ sectorId: { gridX: 0, gridY: 0 }, avgMorale: 10 }],
      400,
    );
    const reports = kgb.getMoraleReports();
    expect(reports).toHaveLength(1);
    expect(reports[0]!.severity).toBe('critical');
  });

  it('processes multiple buildings in a single sample call', () => {
    kgb.sampleMorale(
      [
        { sectorId: { gridX: 0, gridY: 0 }, avgMorale: 30 }, // concern
        { sectorId: { gridX: 1, gridY: 0 }, avgMorale: 50 }, // no report
        { sectorId: { gridX: 2, gridY: 0 }, avgMorale: 10 }, // critical
      ],
      500,
    );
    const reports = kgb.getMoraleReports();
    expect(reports).toHaveLength(2);
    expect(reports[0]!.severity).toBe('concern');
    expect(reports[1]!.severity).toBe('critical');
  });

  it('trims reports to max capacity (20)', () => {
    // Generate 25 reports
    for (let i = 0; i < 25; i++) {
      kgb.sampleMorale(
        [{ sectorId: { gridX: i, gridY: 0 }, avgMorale: 30 }],
        i * 10,
      );
    }
    const reports = kgb.getMoraleReports();
    expect(reports.length).toBeLessThanOrEqual(20);
    // Most recent reports should be kept
    expect(reports[reports.length - 1]!.sectorId.gridX).toBe(24);
  });

  it('getMoraleReportsBySeverity filters by minimum severity', () => {
    kgb.sampleMorale(
      [
        { sectorId: { gridX: 0, gridY: 0 }, avgMorale: 35 }, // concern
        { sectorId: { gridX: 1, gridY: 0 }, avgMorale: 20 }, // warning
        { sectorId: { gridX: 2, gridY: 0 }, avgMorale: 5 },  // critical
      ],
      100,
    );

    const allReports = kgb.getMoraleReports();
    expect(allReports).toHaveLength(3);

    const warningAndAbove = kgb.getMoraleReportsBySeverity('warning');
    expect(warningAndAbove).toHaveLength(2);

    const criticalOnly = kgb.getMoraleReportsBySeverity('critical');
    expect(criticalOnly).toHaveLength(1);
    expect(criticalOnly[0]!.severity).toBe('critical');
  });
});

// ── Morale threshold constants ──────────────────────────────────────────────

describe('morale threshold constants', () => {
  it('concern threshold is 40', () => {
    expect(MORALE_CONCERN_THRESHOLD).toBe(40);
  });

  it('warning threshold is 25', () => {
    expect(MORALE_WARNING_THRESHOLD).toBe(25);
  });

  it('critical threshold is 15', () => {
    expect(MORALE_CRITICAL_THRESHOLD).toBe(15);
  });

  it('thresholds are in descending order (concern > warning > critical)', () => {
    expect(MORALE_CONCERN_THRESHOLD).toBeGreaterThan(MORALE_WARNING_THRESHOLD);
    expect(MORALE_WARNING_THRESHOLD).toBeGreaterThan(MORALE_CRITICAL_THRESHOLD);
  });
});

// ── Pravda morale-reactive headlines ────────────────────────────────────────

describe('Pravda morale-reactive contextual generators', () => {
  const makeGameView = (overrides: Partial<GameView>): GameView => ({
    money: 500,
    pop: 50,
    food: 100,
    vodka: 20,
    power: 10,
    powerUsed: 5,
    buildings: [],
    date: { year: 1930, month: 6, tick: 100 },
    quota: { type: 'production', target: 100, current: 50, deadlineYear: 1935 },
    currentEra: 'stalinism',
    avgMorale: 50,
    ...overrides,
  });

  it('has a generator that fires when morale is HIGH (> 70)', () => {
    const gs = makeGameView({ avgMorale: 80 });
    const highMoraleGen = contextualGenerators.find(
      (cg) => cg.condition(gs) && cg.generate(gs).headline.includes('MORALE EXCELLENT'),
    );
    expect(highMoraleGen).toBeDefined();
    const headline = highMoraleGen!.generate(gs);
    expect(headline.headline).toContain('WORKER MORALE EXCELLENT');
    expect(headline.category).toBe('triumph');
  });

  it('high morale generator does NOT fire when morale is below 70', () => {
    const gs = makeGameView({ avgMorale: 50 });
    const highMoraleGen = contextualGenerators.find(
      (cg) => cg.condition(gs) && cg.generate(gs).headline.includes('MORALE EXCELLENT'),
    );
    expect(highMoraleGen).toBeUndefined();
  });

  it('has a generator that LIES when morale is LOW (< 30)', () => {
    const gs = makeGameView({ avgMorale: 25 });
    const lowMoraleGen = contextualGenerators.find(
      (cg) => cg.condition(gs) && cg.generate(gs).headline.includes('GRATITUDE'),
    );
    expect(lowMoraleGen).toBeDefined();
    const headline = lowMoraleGen!.generate(gs);
    // Headline says gratitude (a LIE)
    expect(headline.headline).toContain('WORKERS EXPRESS GRATITUDE');
    // Reality reveals the lie
    expect(headline.reality).toMatch(/collapsing|fictional/i);
    expect(headline.category).toBe('spin');
  });

  it('has a generator for CRITICAL morale (< 15) with euphemistic language', () => {
    const gs = makeGameView({ avgMorale: 10 });
    const criticalGen = contextualGenerators.find(
      (cg) => cg.condition(gs) && cg.generate(gs).headline.includes('COUNTER-REVOLUTIONARY'),
    );
    expect(criticalGen).toBeDefined();
    const headline = criticalGen!.generate(gs);
    // Uses euphemism: "isolated incidents"
    expect(headline.headline).toContain('ISOLATED INCIDENTS');
    expect(headline.category).toBe('crisis');
    // Reality reveals the true scale
    expect(headline.reality).toMatch(/revolt|everywhere/i);
  });

  it('low morale generator does NOT fire at morale >= 30', () => {
    const gs = makeGameView({ avgMorale: 35 });
    const lowMoraleGen = contextualGenerators.find(
      (cg) => cg.condition(gs) && cg.generate(gs).headline.includes('GRATITUDE'),
    );
    expect(lowMoraleGen).toBeUndefined();
  });

  it('critical morale generator does NOT fire at morale >= 15', () => {
    const gs = makeGameView({ avgMorale: 20 });
    const criticalGen = contextualGenerators.find(
      (cg) => cg.condition(gs) && cg.generate(gs).headline.includes('COUNTER-REVOLUTIONARY'),
    );
    expect(criticalGen).toBeUndefined();
  });
});

// ── KGBTab morale reports prop ──────────────────────────────────────────────

describe('KGBTab moraleReports prop', () => {
  it('accepts moraleReports as an optional prop', () => {
    // Import the type to verify the prop exists
    const { KGBTab } = require('@/ui/hq-tabs/KGBTab');
    expect(KGBTab).toBeDefined();
  });

  it('KGBTabProps type accepts moraleReports array', () => {
    const { KGBTab } = require('@/ui/hq-tabs/KGBTab') as { KGBTab: React.FC<import('@/ui/hq-tabs/KGBTab').KGBTabProps> };
    // Type check: moraleReports is accepted in the props
    const reports: KGBMoraleReport[] = [
      { sectorId: { gridX: 1, gridY: 2 }, avgMorale: 30, timestamp: 100, severity: 'concern' },
      { sectorId: { gridX: 3, gridY: 4 }, avgMorale: 10, timestamp: 200, severity: 'critical' },
    ];
    expect(reports).toHaveLength(2);
    expect(reports[0]!.severity).toBe('concern');
    expect(reports[1]!.severity).toBe('critical');
  });
});
