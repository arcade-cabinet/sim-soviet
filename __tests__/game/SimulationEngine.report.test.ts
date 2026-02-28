/**
 * Tests for SimulationEngine — Annual Report (pripiski) mechanic
 * and additional coverage for settlement, personnel file integration,
 * and falsification risk calculation.
 */
import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import { getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '@/ecs/factories';
import type { QuotaState } from '@/ecs/systems';
import { world } from '@/ecs/world';
import { GameGrid } from '@/game/GameGrid';
import { SimulationEngine } from '@/game/SimulationEngine';

function createMockCallbacks() {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onAnnualReport: jest.fn(),
    onNewPlan: jest.fn(),
    onSettlementChange: jest.fn(),
    onGameOver: jest.fn(),
    onBuildingCollapsed: jest.fn(),
    onEraChanged: jest.fn(),
    onMinigame: jest.fn(),
  };
}

describe('SimulationEngine — Annual Report', () => {
  let grid: GameGrid;
  let cb: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    world.clear();
    grid = new GameGrid();
    cb = createMockCallbacks();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('fires onAnnualReport at quota deadline', () => {
    createResourceStore({ food: 300, vodka: 50, population: 10 });
    createMetaStore({ date: { year: 1926, month: 10, tick: 0 } });
    const engine = new SimulationEngine(grid, cb);

    // Oct 1926 → Jan 1927 (deadline year = 1927)
    for (let i = 0; i < 90; i++) engine.tick();

    expect(cb.onAnnualReport).toHaveBeenCalledTimes(1);
    const [data, submitFn] = cb.onAnnualReport.mock.calls[0]! as [
      AnnualReportData,
      (s: ReportSubmission) => void,
    ];
    expect(data.year).toBe(1927);
    expect(data.quotaType).toBe('food');
    expect(data.quotaTarget).toBe(500);
    expect(typeof submitFn).toBe('function');
  });

  it('honest report with quota met succeeds', () => {
    // Need enough food to survive 90 ticks of overflow spoilage (5%/tick) and stay above 500 quota
    createResourceStore({ food: 5000, vodka: 50, population: 0 });
    createMetaStore({ date: { year: 1926, month: 10, tick: 0 } });
    const engine = new SimulationEngine(grid, cb);

    for (let i = 0; i < 90; i++) engine.tick();

    expect(cb.onAnnualReport).toHaveBeenCalledTimes(1);
    const [data, submitFn] = cb.onAnnualReport.mock.calls[0]! as [
      AnnualReportData,
      (s: ReportSubmission) => void,
    ];

    // Submit honest report
    submitFn({
      reportedQuota: data.quotaCurrent,
      reportedSecondary: data.actualVodka,
      reportedPop: data.actualPop,
    });

    // Should result in quota met
    expect(cb.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('Quota met'));
    const quota = engine.getQuota() as QuotaState;
    expect(quota.type).toBe('vodka');
  });

  it('honest report with quota missed registers failure', () => {
    createResourceStore({ food: 100, vodka: 50, population: 0 });
    createMetaStore({ date: { year: 1926, month: 10, tick: 0 } });
    const engine = new SimulationEngine(grid, cb);

    for (let i = 0; i < 90; i++) engine.tick();

    expect(cb.onAnnualReport).toHaveBeenCalledTimes(1);
    const [data, submitFn] = cb.onAnnualReport.mock.calls[0]! as [
      AnnualReportData,
      (s: ReportSubmission) => void,
    ];

    submitFn({
      reportedQuota: data.quotaCurrent,
      reportedSecondary: data.actualVodka,
      reportedPop: data.actualPop,
    });

    expect(cb.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('failed the 5-Year Plan'));
  });

  it('falsified report can be detected (high risk → caught)', () => {
    // Low random value means caught — but we need enough resources
    // to survive until the annual report deadline despite aggressive events
    jest.spyOn(Math, 'random').mockReturnValue(0.01);

    createResourceStore({ food: 5000, vodka: 500, population: 100 });
    createMetaStore({ date: { year: 1926, month: 10, tick: 0 } });
    const engine = new SimulationEngine(grid, cb);

    for (let i = 0; i < 90; i++) engine.tick();

    const [_data, submitFn] = cb.onAnnualReport.mock.calls[0]! as [
      AnnualReportData,
      (s: ReportSubmission) => void,
    ];

    // Submit wildly inflated numbers
    submitFn({
      reportedQuota: 9999,
      reportedSecondary: 9999,
      reportedPop: 9999,
    });

    // Should be caught
    expect(cb.onToast).toHaveBeenCalledWith(
      expect.stringContaining('FALSIFICATION DETECTED'),
      'evacuation'
    );
  });

  it('falsified report can succeed (low risk or lucky roll)', () => {
    // High random means not caught
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    createResourceStore({ food: 100, vodka: 50, population: 0 });
    createMetaStore({ date: { year: 1926, month: 10, tick: 0 } });
    const engine = new SimulationEngine(grid, cb);

    for (let i = 0; i < 90; i++) engine.tick();

    const [data, submitFn] = cb.onAnnualReport.mock.calls[0]! as [
      AnnualReportData,
      (s: ReportSubmission) => void,
    ];

    // Inflate quota slightly (small enough risk, but enough to pass)
    submitFn({
      reportedQuota: 600,
      reportedSecondary: data.actualVodka + 10,
      reportedPop: data.actualPop,
    });

    // Got away with it — report accepted
    expect(cb.onToast).toHaveBeenCalledWith('Report accepted by Gosplan', 'warning');
    // Since reported quota >= target, should be treated as met
    expect(cb.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('Quota met'));
  });

  it('does not fire double reports while pending', () => {
    createResourceStore({ food: 100, vodka: 50, population: 0 });
    createMetaStore({ date: { year: 1926, month: 10, tick: 0 } });
    const engine = new SimulationEngine(grid, cb);

    // Advance to deadline
    for (let i = 0; i < 90; i++) engine.tick();
    expect(cb.onAnnualReport).toHaveBeenCalledTimes(1);

    // Continue ticking without submitting report — should not fire again
    for (let i = 0; i < 360; i++) engine.tick();
    expect(cb.onAnnualReport).toHaveBeenCalledTimes(1);
  });
});

describe('SimulationEngine — Settlement integration', () => {
  beforeEach(() => {
    world.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('exposes the settlement system', () => {
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    createResourceStore();
    createMetaStore();
    const engine = new SimulationEngine(grid, cb);
    const settlement = engine.getSettlement();
    expect(settlement).toBeDefined();
    expect(settlement.getCurrentTier()).toBe('selo');
  });

  it('syncs settlement tier to meta entity after tick', () => {
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    createResourceStore({ population: 50 });
    createMetaStore();
    const engine = new SimulationEngine(grid, cb);

    engine.tick();
    expect(getMetaEntity()!.gameMeta.settlementTier).toBe('selo');
  });
});

describe('SimulationEngine — Personnel file integration', () => {
  beforeEach(() => {
    world.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('exposes the personnel file', () => {
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    createResourceStore();
    createMetaStore();
    const engine = new SimulationEngine(grid, cb);
    const pf = engine.getPersonnelFile();
    expect(pf).toBeDefined();
    expect(pf.getBlackMarks()).toBe(0);
    expect(pf.getCommendations()).toBe(0);
  });

  it('syncs personnel file state to meta after tick', () => {
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    createResourceStore();
    createMetaStore();
    const engine = new SimulationEngine(grid, cb);

    engine.tick();
    expect(getMetaEntity()!.gameMeta.blackMarks).toBe(0);
    expect(getMetaEntity()!.gameMeta.commendations).toBe(0);
    expect(getMetaEntity()!.gameMeta.threatLevel).toBe('safe');
  });
});

describe('SimulationEngine — Compulsory Deliveries integration', () => {
  beforeEach(() => {
    world.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('exposes the deliveries system', () => {
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    createResourceStore();
    createMetaStore();
    const engine = new SimulationEngine(grid, cb);
    expect(engine.getDeliveries()).toBeDefined();
  });

  it('deliveries reduce new production output', () => {
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    createResourceStore({ food: 100, vodka: 50, population: 0 });
    createMetaStore();
    const engine = new SimulationEngine(grid, cb);

    createBuilding(0, 0, 'power-station');
    createBuilding(1, 1, 'vodka-distillery');

    const vodkaBefore = getResourceEntity()!.resources.vodka;
    engine.tick();
    const vodkaAfter = getResourceEntity()!.resources.vodka;

    // Vodka should increase but deliveries take a cut — so net gain is less
    // than the full production amount. At minimum, vodka should increase
    // (distillery is powered, no consumption with pop=0).
    expect(vodkaAfter).toBeGreaterThan(vodkaBefore);
  });
});

describe('SimulationEngine — quota commendation on exceeded', () => {
  beforeEach(() => {
    world.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('awards commendation when quota exceeds target by >10%', () => {
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    // Target is 500, need food >550 (>10% over) after 90 ticks of spoilage.
    // StorageSystem decays overflow food at 5%/tick * seasonalMult.
    createResourceStore({ food: 5000, vodka: 50, population: 0 });
    createMetaStore({ date: { year: 1926, month: 10, tick: 0 } });
    const engine = new SimulationEngine(grid, cb);

    for (let i = 0; i < 90; i++) engine.tick();

    // Without onAnnualReport, direct evaluation happens
    // But we have cb.onAnnualReport set, so submit honest report
    const [data, submitFn] = cb.onAnnualReport.mock.calls[0]! as [
      AnnualReportData,
      (s: ReportSubmission) => void,
    ];
    submitFn({
      reportedQuota: data.quotaCurrent,
      reportedSecondary: data.actualVodka,
      reportedPop: data.actualPop,
    });

    expect(cb.onToast).toHaveBeenCalledWith(expect.stringContaining('COMMENDATION'), 'warning');
    expect(engine.getPersonnelFile().getCommendations()).toBe(1);
  });
});
