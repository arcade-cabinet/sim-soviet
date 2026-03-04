/**
 * Playthrough 15 — Diagnostic: Historical Mode (200 years)
 *
 * Runs the HistoricalGovernor through 1917 → ~2117 capturing comprehensive
 * yearly state snapshots as JSON. The output file enables offline analysis
 * of resource curves, population dynamics, building composition, era
 * transitions, and crisis timelines.
 *
 * Output: __tests__/playthrough/output/historical-80yr.json
 */

import { HistoricalGovernor } from '../../src/ai/agents/crisis/HistoricalGovernor';
import type { IGovernor } from '../../src/ai/agents/crisis/Governor';
import { getPopulationMode } from '../../src/ai/agents/workforce/collectiveTransition';
import {
  getResourceEntity,
  operationalBuildings,
  underConstruction,
  housing,
  producers,
  dvory,
  citizens,
} from '../../src/ecs/archetypes';
import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  createTestDvory,
  getDate,
  getResources,
  TICKS_PER_MONTH,
  TICKS_PER_YEAR,
} from './helpers';

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

interface YearlySnapshot {
  year: number;
  month: number;
  totalTicks: number;

  // Resources
  resources: {
    food: number;
    money: number;
    population: number;
    timber: number;
    steel: number;
    cement: number;
    vodka: number;
    power: number;
  };

  // Population
  populationMode: 'entity' | 'aggregate';
  demographics: {
    totalPop: number;
    dvoirCount: number;
    citizenCount: number;
    raionPop?: number;
    laborForce?: number;
    avgMorale?: number;
    avgLoyalty?: number;
    birthsThisYear?: number;
    deathsThisYear?: number;
  };

  // Buildings
  buildings: {
    total: number;
    operational: number;
    underConstruction: number;
    housingCount: number;
    producerCount: number;
    byType: Record<string, number>;
  };

  // Power
  power: {
    generated: number;
    used: number;
    balance: number;
  };

  // Political
  era: string;
  settlementTier: string;
  threatLevel: string;
  blackMarks: number;
  commendations: number;

  // Crises
  activeCrises: string[];

  // Quota
  quota: {
    type: string;
    target: number;
    current: number;
    deadlineYear: number;
  };

  // Score
  score: number;
  erasCompleted: number;

  // Anomalies detected this year
  anomalies: string[];
}

interface DiagnosticReport {
  mode: 'historical';
  startYear: number;
  endYear: number;
  totalYears: number;
  totalTicks: number;
  snapshots: YearlySnapshot[];
  anomalySummary: string[];
  eraTransitions: Array<{ year: number; from: string; to: string }>;
  crisisTimeline: Array<{ year: number; crisisId: string; event: 'activated' | 'resolved' }>;
}

// ─── Snapshot Capture ───────────────────────────────────────────────────────

function captureSnapshot(
  engine: ReturnType<typeof createPlaythroughEngine>['engine'],
  governor: IGovernor & { getActiveCrises(): string[] },
  prevSnapshot?: YearlySnapshot,
): YearlySnapshot {
  const date = getDate();
  const store = getResourceEntity();
  const res = store?.resources;

  // Building census
  const buildingCensus: Record<string, number> = {};
  for (const entity of operationalBuildings.entities) {
    const defId = entity.building.defId;
    buildingCensus[defId] = (buildingCensus[defId] ?? 0) + 1;
  }

  // Power calculation
  let powerGenerated = 0;
  let powerUsed = 0;
  for (const entity of operationalBuildings.entities) {
    if (entity.building.powerOutput > 0) {
      powerGenerated += entity.building.powerOutput;
    }
    if (entity.building.powerReq > 0) {
      powerUsed += entity.building.powerReq;
    }
  }

  // Population
  const raion = engine.getRaion();
  const popMode = getPopulationMode(res?.population ?? 0, raion);
  const totalPop = raion?.totalPopulation ?? res?.population ?? 0;

  // Political state
  const political = engine.getPoliticalAgent();
  const personnel = engine.getPersonnelFile();
  const settlement = engine.getSettlement();
  const scoring = engine.getScoring();
  const quota = engine.getQuota();

  // Detect anomalies
  const anomalies: string[] = [];
  if (res) {
    for (const [key, val] of Object.entries(res)) {
      if (typeof val === 'number' && !Number.isFinite(val)) {
        anomalies.push(`resource.${key} is ${val}`);
      }
      if (typeof val === 'number' && val < 0 && key !== 'power') {
        anomalies.push(`resource.${key} is negative: ${val}`);
      }
    }
  }

  // Population crash detection (>50% drop in one year)
  if (prevSnapshot && totalPop < prevSnapshot.demographics.totalPop * 0.5 && prevSnapshot.demographics.totalPop > 10) {
    anomalies.push(
      `population crash: ${prevSnapshot.demographics.totalPop} → ${totalPop} ` +
        `(${Math.round((1 - totalPop / prevSnapshot.demographics.totalPop) * 100)}% drop)`,
    );
  }

  // Stuck era detection (same era for 80+ years)
  // (detected by caller, not here)

  const activeCrises = governor.getActiveCrises();

  return {
    year: date.year,
    month: date.month,
    totalTicks: date.tick,

    resources: {
      food: res?.food ?? 0,
      money: res?.money ?? 0,
      population: res?.population ?? 0,
      timber: res?.timber ?? 0,
      steel: res?.steel ?? 0,
      cement: res?.cement ?? 0,
      vodka: res?.vodka ?? 0,
      power: res?.power ?? 0,
    },

    populationMode: popMode,
    demographics: {
      totalPop,
      dvoirCount: dvory.entities.length,
      citizenCount: citizens.entities.length,
      raionPop: raion?.totalPopulation,
      laborForce: raion?.laborForce,
      avgMorale: raion?.avgMorale,
      avgLoyalty: raion?.avgLoyalty,
      birthsThisYear: raion?.birthsThisYear,
      deathsThisYear: raion?.deathsThisYear,
    },

    buildings: {
      total: world.with('building', 'isBuilding').entities.length,
      operational: operationalBuildings.entities.length,
      underConstruction: underConstruction.entities.length,
      housingCount: housing.entities.length,
      producerCount: producers.entities.length,
      byType: buildingCensus,
    },

    power: {
      generated: powerGenerated,
      used: powerUsed,
      balance: powerGenerated - powerUsed,
    },

    era: political.getCurrentEraId(),
    settlementTier: settlement.getCurrentTier(),
    threatLevel: personnel.getThreatLevel(),
    blackMarks: personnel.getBlackMarks(),
    commendations: personnel.getCommendations(),

    activeCrises,

    quota: {
      type: quota.type,
      target: quota.target,
      current: quota.current,
      deadlineYear: quota.deadlineYear,
    },

    score: scoring.getFinalScore(),
    erasCompleted: scoring.getErasCompleted(),

    anomalies,
  };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Diagnostic: Historical mode 1917-1997 playthrough', () => {
  const report: DiagnosticReport = {
    mode: 'historical',
    startYear: 1917,
    endYear: 1917,
    totalYears: 0,
    totalTicks: 0,
    snapshots: [],
    anomalySummary: [],
    eraTransitions: [],
    crisisTimeline: [],
  };

  let governor: HistoricalGovernor;

  beforeAll(() => {
    jest.setTimeout(120000);

    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1917, month: 10, tick: 0 } },
      resources: {
        population: 100,
        food: 99999,
        timber: 99999,
        steel: 99999,
        cement: 99999,
        money: 99999,
        vodka: 99999,
        power: 99999,
      },
      difficulty: 'worker',
      consequence: 'permadeath',
      deterministicRandom: true,
    });

    // Disable interactive callbacks
    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

    governor = new HistoricalGovernor();
    engine.setGovernor(governor);

    // Disable game-over
    (engine as Record<string, unknown>).endGame = () => {};

    const MONTHS_PER_YEAR = 12;
    let lastEra = 'revolution';
    const previouslyActiveCrises = new Set<string>();
    let prevSnapshot: YearlySnapshot | undefined;

    // 80 years: 1917 → ~1997 — covers the full Soviet timeline through dissolution
    for (let year = 0; year < 80; year++) {
      // Top up resources each year
      const res = getResources();
      res.food = Math.max(res.food, 50000);
      res.vodka = Math.max(res.vodka, 50000);
      res.money = Math.max(res.money, 50000);
      res.timber = Math.max(res.timber, 50000);
      res.steel = Math.max(res.steel, 50000);

      // Replenish population
      const eng = engine as unknown as {
        workerSystem: { getPopulation: () => number; syncPopulationFromDvory: () => number };
      };
      if (eng.workerSystem.getPopulation() < 20) {
        createTestDvory(80);
        const newPop = eng.workerSystem.syncPopulationFromDvory();
        const store = getResourceEntity();
        if (store) store.resources.population = newPop;
      }

      // Advance month by month, tracking crises
      for (let month = 0; month < MONTHS_PER_YEAR; month++) {
        advanceTicks(engine, TICKS_PER_MONTH);

        // Track crisis activations and resolutions
        const active = new Set(governor.getActiveCrises());
        for (const id of active) {
          if (!previouslyActiveCrises.has(id)) {
            report.crisisTimeline.push({ year: getDate().year, crisisId: id, event: 'activated' });
          }
        }
        for (const id of previouslyActiveCrises) {
          if (!active.has(id)) {
            report.crisisTimeline.push({ year: getDate().year, crisisId: id, event: 'resolved' });
          }
        }
        previouslyActiveCrises.clear();
        for (const id of active) previouslyActiveCrises.add(id);
      }

      // Capture yearly snapshot
      const snapshot = captureSnapshot(engine, governor, prevSnapshot);

      // Track era transitions
      const currentEra = snapshot.era;
      if (currentEra !== lastEra) {
        report.eraTransitions.push({ year: snapshot.year, from: lastEra, to: currentEra });
        lastEra = currentEra;
      }

      report.snapshots.push(snapshot);
      prevSnapshot = snapshot;
    }

    // Finalize report
    const lastSnap = report.snapshots[report.snapshots.length - 1];
    report.endYear = lastSnap?.year ?? 1917;
    report.totalYears = report.snapshots.length;
    report.totalTicks = 80 * TICKS_PER_YEAR;

    // Collect all anomalies
    for (const snap of report.snapshots) {
      for (const anomaly of snap.anomalies) {
        report.anomalySummary.push(`[${snap.year}] ${anomaly}`);
      }
    }

    // Detect stuck eras (>80 years without transition)
    let currentEraStart = report.startYear;
    let currentEraId = 'revolution';
    for (const snap of report.snapshots) {
      if (snap.era !== currentEraId) {
        currentEraStart = snap.year;
        currentEraId = snap.era;
      }
      if (snap.year - currentEraStart > 30) {
        const msg = `era "${currentEraId}" stuck for ${snap.year - currentEraStart} years (since ${currentEraStart})`;
        if (!report.anomalySummary.includes(`[${snap.year}] ${msg}`)) {
          report.anomalySummary.push(`[${snap.year}] ${msg}`);
        }
      }
    }

    // Write output
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'historical-80yr.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

    // Log summary
    console.log('\n=== HISTORICAL 200-YEAR DIAGNOSTIC ===');
    console.log(`Years: ${report.startYear} → ${report.endYear} (${report.totalYears} snapshots)`);
    console.log(`Era transitions: ${report.eraTransitions.length}`);
    for (const t of report.eraTransitions) {
      console.log(`  ${t.year}: ${t.from} → ${t.to}`);
    }
    console.log(`Crisis events: ${report.crisisTimeline.length}`);
    console.log(`Anomalies: ${report.anomalySummary.length}`);
    if (report.anomalySummary.length > 0) {
      for (const a of report.anomalySummary.slice(0, 20)) console.log(`  ${a}`);
      if (report.anomalySummary.length > 20) console.log(`  ... and ${report.anomalySummary.length - 20} more`);
    }
    console.log(`Output: ${outputPath}`);
    console.log('');
  }, 120000);

  afterAll(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Assertions ────────────────────────────────────────────────────────

  it('simulation covers 1917-1997 (80 years)', () => {
    expect(report.snapshots.length).toBe(80);
    const lastYear = report.snapshots[report.snapshots.length - 1]?.year ?? 0;
    expect(lastYear).toBeGreaterThanOrEqual(1991);
  });

  it('no NaN or Infinity in any resource value', () => {
    const violations = report.anomalySummary.filter(
      (a) => a.includes('NaN') || a.includes('Infinity') || a.includes('undefined'),
    );
    if (violations.length > 0) {
      console.log('NaN/Infinity violations:', violations.slice(0, 10));
    }
    expect(violations).toHaveLength(0);
  });

  it('population never hits zero for 10+ consecutive years', () => {
    let consecutiveZero = 0;
    let maxConsecutiveZero = 0;
    for (const snap of report.snapshots) {
      if (snap.demographics.totalPop === 0) {
        consecutiveZero++;
        maxConsecutiveZero = Math.max(maxConsecutiveZero, consecutiveZero);
      } else {
        consecutiveZero = 0;
      }
    }
    expect(maxConsecutiveZero).toBeLessThan(10);
  });

  it('at least 3 era transitions occur', () => {
    expect(report.eraTransitions.length).toBeGreaterThanOrEqual(3);
  });

  it('GPW and Chernobyl both fire', () => {
    // Political crises (august_coup etc.) are handled by PoliticalAgent, not the Governor
    const activatedCrises = new Set(
      report.crisisTimeline.filter((e) => e.event === 'activated').map((e) => e.crisisId),
    );
    expect(activatedCrises.has('great_patriotic_war')).toBe(true);
    expect(activatedCrises.has('chernobyl')).toBe(true);
  });

  it('at least 5 distinct crises activate', () => {
    const uniqueCrises = new Set(report.crisisTimeline.filter((e) => e.event === 'activated').map((e) => e.crisisId));
    expect(uniqueCrises.size).toBeGreaterThanOrEqual(5);
  });

  it('building count increases over time', () => {
    const first25 = report.snapshots.slice(0, 25);
    const last25 = report.snapshots.slice(-25);
    const avgFirst = first25.reduce((s, snap) => s + snap.buildings.operational, 0) / first25.length;
    const avgLast = last25.reduce((s, snap) => s + snap.buildings.operational, 0) / last25.length;
    expect(avgLast).toBeGreaterThanOrEqual(avgFirst);
  });

  it('outputs diagnostic JSON file', () => {
    const outputPath = path.join(__dirname, 'output', 'historical-80yr.json');
    expect(fs.existsSync(outputPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(data.mode).toBe('historical');
    expect(data.snapshots.length).toBe(80);
  });
});
