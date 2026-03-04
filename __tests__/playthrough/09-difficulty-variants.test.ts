import { PersonnelFile } from '../../src/ai/agents/political/KGBAgent';
import { DIFFICULTY_PRESETS } from '../../src/ai/agents/political/ScoringSystem';
import { world } from '../../src/ecs/world';
import { advanceYears, buildBasicSettlement, createPlaythroughEngine, getResources, isGameOver } from './helpers';

describe('Playthrough: Difficulty Variants', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: Quota target scales with difficulty ──────────────────────

  it('quota targets scale by difficulty multiplier', () => {
    const baseTarget = 500;

    // Worker difficulty — quotaMultiplier 0.6
    const { engine: workerEngine } = createPlaythroughEngine({ difficulty: 'worker' });
    const workerTarget = workerEngine.getQuota().target;
    expect(workerTarget).toBe(Math.round(baseTarget * DIFFICULTY_PRESETS.worker.quotaMultiplier));

    // Comrade difficulty — quotaMultiplier 1.0
    const { engine: comradeEngine } = createPlaythroughEngine({ difficulty: 'comrade' });
    const comradeTarget = comradeEngine.getQuota().target;
    expect(comradeTarget).toBe(Math.round(baseTarget * DIFFICULTY_PRESETS.comrade.quotaMultiplier));

    // Tovarish difficulty — quotaMultiplier 1.5
    const { engine: tovarishEngine } = createPlaythroughEngine({ difficulty: 'tovarish' });
    const tovarishTarget = tovarishEngine.getQuota().target;
    expect(tovarishTarget).toBe(Math.round(baseTarget * DIFFICULTY_PRESETS.tovarish.quotaMultiplier));

    // Verify ordering: worker < comrade < tovarish
    expect(workerTarget).toBeLessThan(comradeTarget);
    expect(comradeTarget).toBeLessThan(tovarishTarget);
  });

  // ── Scenario 2: Mark decay interval varies by difficulty ─────────────────

  it('worker marks decay faster than comrade marks', () => {
    // Test PersonnelFile decay directly — decay intervals are per-difficulty:
    //   worker: 360 ticks, comrade: 720 ticks, tovarish: 1440 ticks
    // Decay requires: (currentTick - lastDecayTick >= interval)
    //              && (lastMarkAddedTick < lastDecayTick)
    //              && (blackMarks > 0)

    // Worker file with 3 marks added before tick 0
    const workerFile = new PersonnelFile('worker');
    workerFile.addMark('quota_missed_minor', -1);
    workerFile.addMark('quota_missed_minor', -1);
    workerFile.addMark('quota_missed_minor', -1);
    expect(workerFile.getBlackMarks()).toBe(3);

    // Tick the worker file to 360 — should trigger decay
    for (let t = 1; t <= 360; t++) workerFile.tick(t);
    expect(workerFile.getBlackMarks()).toBe(2); // one mark decayed

    // Comrade file with same 3 marks
    const comradeFile = new PersonnelFile('comrade');
    comradeFile.addMark('quota_missed_minor', -1);
    comradeFile.addMark('quota_missed_minor', -1);
    comradeFile.addMark('quota_missed_minor', -1);
    expect(comradeFile.getBlackMarks()).toBe(3);

    // Tick comrade file to 360 — NOT enough for comrade's 720-tick interval
    for (let t = 1; t <= 360; t++) comradeFile.tick(t);
    expect(comradeFile.getBlackMarks()).toBe(3); // no decay yet

    // Tick comrade file to 720 — now it should decay
    for (let t = 361; t <= 720; t++) comradeFile.tick(t);
    expect(comradeFile.getBlackMarks()).toBe(2); // one mark decayed

    // Tovarish file — decay takes 1440 ticks
    const tovarishFile = new PersonnelFile('tovarish');
    tovarishFile.addMark('quota_missed_minor', -1);
    tovarishFile.addMark('quota_missed_minor', -1);
    tovarishFile.addMark('quota_missed_minor', -1);
    expect(tovarishFile.getBlackMarks()).toBe(3);

    // Tick to 720 — not enough for tovarish
    for (let t = 1; t <= 720; t++) tovarishFile.tick(t);
    expect(tovarishFile.getBlackMarks()).toBe(3); // no decay

    // Tick to 1440 — now tovarish decays
    for (let t = 721; t <= 1440; t++) tovarishFile.tick(t);
    expect(tovarishFile.getBlackMarks()).toBe(2); // one mark decayed
  });

  // ── Scenario 3: Survival comparison across difficulties ──────────────────

  it('worker difficulty produces more favorable outcomes than tovarish', () => {
    const startFood = 2000;
    const startPop = 30;

    // Use rehabilitated consequence so KGB arrest doesn't end game prematurely.
    // Disable interactive callbacks that accumulate marks or defer evaluation.
    const runDifficulty = (diff: 'worker' | 'comrade' | 'tovarish') => {
      const { engine, callbacks } = createPlaythroughEngine({
        difficulty: diff,
        consequence: 'rehabilitated',
        resources: { food: startFood, population: startPop, power: 100, vodka: 5000 },
      });
      callbacks.onMinigame = undefined as never;
      callbacks.onAnnualReport = undefined as never;
      buildBasicSettlement({ housing: 2, farms: 2, power: 1 });
      advanceYears(engine, 1);
      return {
        food: getResources().food,
        pop: getResources().population,
        gameOver: isGameOver(),
      };
    };

    const worker = runDifficulty('worker');
    const _comrade = runDifficulty('comrade');
    const tovarish = runDifficulty('tovarish');

    // Worker should have roughly as much or more population as tovarish.
    // Allow small margin (5) for demographic stochasticity (births, deaths,
    // household formation, working mother penalties).
    expect(worker.pop).toBeGreaterThanOrEqual(tovarish.pop - 5);

    // Worker should not be game over
    expect(worker.gameOver).toBe(false);
  });
});
