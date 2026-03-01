import { world } from '../../src/ecs/world';
import { advanceTicks, createPlaythroughEngine, isGameOver } from './helpers';

describe('Playthrough: Personnel File & Arrest', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: Threat level escalation ──────────────────────────────────

  it('threat level escalates correctly as marks accumulate', () => {
    const { engine } = createPlaythroughEngine();
    const pf = engine.getPersonnelFile();

    // Start at 0 marks → 'safe'
    expect(pf.getThreatLevel()).toBe('safe');
    expect(pf.getEffectiveMarks()).toBe(0);

    // Add quota_missed_catastrophic (3 marks) → effective=3 → 'watched'
    pf.addMark('quota_missed_catastrophic', 0);
    expect(pf.getEffectiveMarks()).toBe(3);
    expect(pf.getThreatLevel()).toBe('watched');

    // Add quota_missed_minor (1 mark) → effective=4 → 'warned'
    pf.addMark('quota_missed_minor', 0);
    expect(pf.getEffectiveMarks()).toBe(4);
    expect(pf.getThreatLevel()).toBe('warned');

    // Add worker_arrested (1 mark) → effective=5 → 'investigated'
    pf.addMark('worker_arrested', 0);
    expect(pf.getEffectiveMarks()).toBe(5);
    expect(pf.getThreatLevel()).toBe('investigated');

    // Add worker_arrested (1 mark) → effective=6 → 'reviewed'
    pf.addMark('worker_arrested', 0);
    expect(pf.getEffectiveMarks()).toBe(6);
    expect(pf.getThreatLevel()).toBe('reviewed');

    // Add worker_arrested (1 mark) → effective=7 → 'arrested'
    pf.addMark('worker_arrested', 0);
    expect(pf.getEffectiveMarks()).toBe(7);
    expect(pf.getThreatLevel()).toBe('arrested');
    expect(pf.isArrested()).toBe(true);
  });

  // ── Scenario 2: Arrest triggers game over ────────────────────────────────

  it('arrest triggers game over on next engine tick', () => {
    const { engine, callbacks } = createPlaythroughEngine();
    const pf = engine.getPersonnelFile();

    // Accumulate 7 effective marks (3+2+1+1 = 7)
    pf.addMark('quota_missed_catastrophic', 0); // +3
    pf.addMark('black_market', 0); // +2
    pf.addMark('worker_arrested', 0); // +1
    pf.addMark('worker_arrested', 0); // +1
    expect(pf.getEffectiveMarks()).toBe(7);
    expect(pf.isArrested()).toBe(true);

    // One engine tick triggers the arrest check → endGame
    engine.tick();

    expect(callbacks.onGameOver).toHaveBeenCalledWith(false, expect.stringContaining('Enemy'));
    expect(isGameOver()).toBe(true);
  });

  // ── Scenario 3: Commendations offset marks ───────────────────────────────

  it('commendations reduce effective marks and lower threat level', () => {
    const { engine } = createPlaythroughEngine();
    const pf = engine.getPersonnelFile();

    // Add marks totaling 5: catastrophic(3) + black_market(2) = 5
    pf.addMark('quota_missed_catastrophic', 0);
    pf.addMark('black_market', 0);
    expect(pf.getEffectiveMarks()).toBe(5);
    expect(pf.getThreatLevel()).toBe('investigated');

    // Add 3 commendations: 3x quota_exceeded (1 each) = 3
    pf.addCommendation('quota_exceeded', 0);
    pf.addCommendation('quota_exceeded', 0);
    pf.addCommendation('quota_exceeded', 0);

    // Effective = 5 - 3 = 2 → 'safe'
    expect(pf.getEffectiveMarks()).toBe(2);
    expect(pf.getThreatLevel()).toBe('safe');
    expect(pf.isArrested()).toBe(false);
  });

  // ── Scenario 4: Mark decay over time ─────────────────────────────────────

  it('marks decay after decay interval when no new marks are added', () => {
    // Test PersonnelFile decay logic directly to avoid engine side-effects.
    // PersonnelFile defaults to 'comrade' → decay interval = 720 ticks.
    const { engine } = createPlaythroughEngine();
    const pf = engine.getPersonnelFile();

    // Constructor state: lastMarkAddedTick = -Infinity, lastDecayTick = 0
    // Add marks at tick -1 so lastMarkAddedTick(-1) < lastDecayTick(0)
    pf.addMark('quota_missed_minor', -1);
    pf.addMark('quota_missed_minor', -1);
    pf.addMark('quota_missed_minor', -1);
    expect(pf.getBlackMarks()).toBe(3);

    // At tick 720: 720-0 >= 720 ✓, -1 < 0 ✓, blackMarks>0 ✓ → decay fires
    pf.tick(720);
    expect(pf.getBlackMarks()).toBe(2);

    // After decay: lastDecayTick=720, lastMarkAddedTick=-1
    // At tick 1440: 1440-720 >= 720 ✓, -1 < 720 ✓ → second decay
    pf.tick(1440);
    expect(pf.getBlackMarks()).toBe(1);

    // At tick 2160: third decay → 0
    pf.tick(2160);
    expect(pf.getBlackMarks()).toBe(0);

    // At tick 2880: blackMarks=0 → condition fails, no further decay
    pf.tick(2880);
    expect(pf.getBlackMarks()).toBe(0);
  });

  it('adding new marks resets the decay timer', () => {
    const { engine } = createPlaythroughEngine();
    const pf = engine.getPersonnelFile();

    // Add marks at tick -1
    pf.addMark('quota_missed_minor', -1);
    pf.addMark('quota_missed_minor', -1);
    expect(pf.getBlackMarks()).toBe(2);

    // First decay at tick 720
    pf.tick(720);
    expect(pf.getBlackMarks()).toBe(1);

    // Add a new mark at tick 800 — this resets lastMarkAddedTick to 800
    pf.addMark('worker_arrested', 800);
    expect(pf.getBlackMarks()).toBe(2);

    // At tick 1440: 1440-720 >= 720 ✓, but lastMarkAddedTick(800) < lastDecayTick(720)?
    // 800 < 720 is FALSE → no decay (new mark blocks it)
    pf.tick(1440);
    expect(pf.getBlackMarks()).toBe(2);
  });

  // ── Scenario 5: Era transition resets marks ──────────────────────────────

  it('era transition resets marks to 2 and commendations to 0', () => {
    const { engine } = createPlaythroughEngine();
    const pf = engine.getPersonnelFile();

    // Accumulate marks and commendations
    pf.addMark('quota_missed_catastrophic', 0); // +3
    pf.addMark('black_market', 0); // +2
    pf.addCommendation('quota_exceeded', 0); // +1 commendation
    expect(pf.getBlackMarks()).toBe(5);
    expect(pf.getCommendations()).toBe(1);
    expect(pf.getEffectiveMarks()).toBe(4);

    // Simulate era transition
    pf.resetForNewEra();

    expect(pf.getBlackMarks()).toBe(2);
    expect(pf.getCommendations()).toBe(0);
    expect(pf.getEffectiveMarks()).toBe(2);
    expect(pf.getThreatLevel()).toBe('safe');
  });

  // ── Scenario 6: Quota failure accumulates marks ──────────────────────────

  it('quota failure at annual report adds marks to personnel file', () => {
    // The chronology always starts at month 10. With year 1926, the
    // quota deadline is 1927 (default). After 90 ticks (3 months: Oct→Nov→Dec→Jan),
    // the year rolls to 1927 and checkQuota fires.
    //
    // Set onAnnualReport to undefined so the direct evaluation path runs
    // (otherwise the mock defers to a player callback that never resolves).
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1926, month: 12, tick: 0 } },
      resources: { food: 10, population: 0 },
    });
    (callbacks as Record<string, unknown>).onAnnualReport = undefined;

    const pf = engine.getPersonnelFile();
    const initialMarks = pf.getBlackMarks();

    // Advance enough ticks to cross the year boundary and trigger quota evaluation.
    // 90 ticks = 3 months (Oct→Nov→Dec→Jan 1927).
    advanceTicks(engine, 90);

    // The quota was missed (current=0, target=500) so marks should have been added
    expect(pf.getBlackMarks()).toBeGreaterThan(initialMarks);
  });

  // ── Scenario 7: History tracking ─────────────────────────────────────────

  it('personnel file records history of all marks and commendations', () => {
    const { engine } = createPlaythroughEngine();
    const pf = engine.getPersonnelFile();

    pf.addMark('worker_arrested', 10, 'Test arrest');
    pf.addCommendation('quota_exceeded', 20, 'Test quota');

    const history = pf.getHistory();
    expect(history).toHaveLength(2);

    expect(history[0]).toEqual({
      tick: 10,
      type: 'mark',
      source: 'worker_arrested',
      amount: 1,
      description: 'Test arrest',
    });

    expect(history[1]).toEqual({
      tick: 20,
      type: 'commendation',
      source: 'quota_exceeded',
      amount: 1,
      description: 'Test quota',
    });
  });

  // ── Scenario 8: Effective marks floor at zero ────────────────────────────

  it('effective marks cannot go below zero', () => {
    const { engine } = createPlaythroughEngine();
    const pf = engine.getPersonnelFile();

    // Add more commendations than marks
    pf.addMark('worker_arrested', 0); // +1 mark
    pf.addCommendation('quota_exceeded', 0); // +1 commendation
    pf.addCommendation('quota_exceeded', 0); // +1 commendation
    pf.addCommendation('quota_exceeded', 0); // +1 commendation

    // Raw: 1 mark, 3 commendations → effective = max(0, 1-3) = 0
    expect(pf.getBlackMarks()).toBe(1);
    expect(pf.getCommendations()).toBe(3);
    expect(pf.getEffectiveMarks()).toBe(0);
    expect(pf.getThreatLevel()).toBe('safe');
  });
});
