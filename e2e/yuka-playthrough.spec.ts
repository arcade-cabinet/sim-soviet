/**
 * E2E Yuka Playthrough Tests — Real browser playthroughs.
 *
 * Opens headed Chrome via Playwright, starts a game, enables Yuka autopilot
 * (ChairmanAgent handles minigames + annual reports including pripiski),
 * sets 100x turbo speed, and lets the engine run.
 *
 * These are REAL playthroughs — full 3D rendering, full agent system,
 * full game loop at 100x speed in real Chrome with GPU. No shortcuts,
 * no faked outcomes, no headless.
 *
 * Each capture point writes:
 *   - Screenshot (PNG with debug overlay)
 *   - JSON diagnostics (full engine state dump)
 *
 * "Win" = population > 0 and no game over for the target duration.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import {
  enableAutopilot,
  setTurboSpeed,
  getGameYear,
  waitForGameReady,
  dismissAnyModal,
  captureGameSnapshot,
  isGameOverVisible,
  type GameSnapshotData,
} from './helpers';

// 5 min per test — long playthroughs need time at 100x
test.describe.configure({ timeout: 300_000 });

const SCREENSHOT_DIR = 'e2e/screenshots/playthrough';
const MILESTONE_DIR = 'test-results/screenshots';
const START_YEAR = 1917;

/** Year markers that trigger milestone screenshots when crossed. */
const YEAR_MARKERS = [1991, 2100, 2500];

// ── Deep engine diagnostics extracted from window.__simEngine ────────────

interface EngineDiagnostics extends GameSnapshotData {
  // Resources
  money: number;
  timber: number;
  steel: number;
  cement: number;
  power: number;
  powerUsed: number;
  trudodni: number;
  blat: number;
  storageCapacity: number;
  // Quota
  quotaType: string;
  quotaTarget: number;
  quotaCurrent: number;
  quotaDeadlineYear: number;
  consecutiveQuotaFailures: number;
  // Personnel
  commendations: number;
  personnelHistory: unknown[];
  // ECS entity counts
  operationalCount: number;
  constructionCount: number;
  citizenCount: number;
  dvorCount: number;
  housingEntityCount: number;
  // Demographics
  populationMode: string;
  totalHouseholds: number;
  laborForce: number;
  // Governor / crises
  activeCrises: string[];
  governorMode: string;
  // Chronology
  totalTicks: number;
  season: string;
  // Game over details
  gameOverReason: string;
  // Timeline milestones
  activatedWorldMilestones: string[];
  activatedSpaceMilestones: string[];
  totalMilestonesActivated: number;
}

async function extractFullDiagnostics(page: Page): Promise<EngineDiagnostics> {
  return page.evaluate(() => {
    const getText = (testId: string): string =>
      document.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? '';
    const parseNum = (testId: string): number => {
      const raw = getText(testId).replace(/,/g, '');
      const n = parseInt(raw, 10);
      return isNaN(n) ? 0 : n;
    };

    const dateText = getText('date-label');
    const yearMatch = dateText.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
    const month = dateText.replace(/\d{4}/, '').trim();
    const population = parseNum('pop-value');
    const food = parseNum('food-value');
    const vodka = parseNum('vodka-value');
    const era = getText('era-label');

    const engine = (window as any).__simEngine;
    const result: any = {
      year, month, population, food, vodka, era,
      buildingCount: 0, settlementTier: 'unknown', threatLevel: 'unknown',
      blackMarks: 0, isGameOver: false,
      money: 0, timber: 0, steel: 0, cement: 0, power: 0, powerUsed: 0,
      trudodni: 0, blat: 0, storageCapacity: 0,
      quotaType: '', quotaTarget: 0, quotaCurrent: 0, quotaDeadlineYear: 0,
      consecutiveQuotaFailures: 0,
      commendations: 0, personnelHistory: [],
      populationMode: 'unknown', totalHouseholds: 0, laborForce: 0,
      activeCrises: [], governorMode: 'unknown',
      totalTicks: 0, season: 'unknown', gameOverReason: '',
      activatedWorldMilestones: [], activatedSpaceMilestones: [],
      totalMilestonesActivated: 0,
    };

    if (!engine) return result;

    // Resources from ECS store
    try {
      // Access resources via the engine's internal getResourceEntity path
      const store = (window as any).__simEngine;
      // Try to read quota directly from engine
      const q = store.quota || store.getQuota?.() || {};
      result.quotaType = q.type ?? '';
      result.quotaTarget = q.target ?? 0;
      result.quotaCurrent = q.current ?? 0;
      result.quotaDeadlineYear = q.deadlineYear ?? 0;
      result.consecutiveQuotaFailures = store.consecutiveQuotaFailures ?? 0;
    } catch { /* */ }

    // Resource store via DOM fallback + engine internal
    try {
      result.money = parseNum('money-value') || 0;
      result.timber = parseNum('timber-value') || 0;
      result.steel = parseNum('steel-value') || 0;
      result.cement = parseNum('cement-value') || 0;
      result.power = parseNum('power-value') || 0;
    } catch { /* */ }

    // Building count — via ECS archetypes exposed on window
    try {
      const arch = (window as any).__ecsArchetypes;
      if (arch) {
        result.buildingCount = arch.buildingCount ?? 0;
        result.operationalCount = arch.operationalCount ?? 0;
        result.constructionCount = arch.constructionCount ?? 0;
        result.citizenCount = arch.citizenCount ?? 0;
        result.dvorCount = arch.dvorCount ?? 0;
        result.housingEntityCount = arch.housingCount ?? 0;
      }
    } catch { /* */ }

    // Settlement
    try {
      result.settlementTier = engine.getSettlement?.()?.getCurrentTier?.() ?? 'unknown';
    } catch { /* */ }

    // Personnel file
    try {
      const pf = engine.getPersonnelFile?.();
      result.threatLevel = pf?.getThreatLevel?.() ?? 'unknown';
      result.blackMarks = pf?.getBlackMarks?.() ?? 0;
      result.commendations = pf?.getCommendations?.() ?? 0;
      const history = pf?.getHistory?.() ?? [];
      result.personnelHistory = history.slice(-20); // last 20 entries
    } catch { /* */ }

    // Chronology
    try {
      const chrono = engine.getChronology?.();
      const date = chrono?.getDate?.() ?? {};
      result.totalTicks = date.totalTicks ?? 0;
      result.season = chrono?.getSeason?.()?.season ?? 'unknown';
    } catch { /* */ }

    // Governor
    try {
      const gov = engine.getGovernor?.();
      result.governorMode = gov?.mode ?? 'unknown';
      const activeCrises = gov?.getActiveCrises?.() ?? [];
      result.activeCrises = activeCrises.map((c: any) => c.id ?? c.definition?.id ?? String(c));
    } catch { /* */ }

    // Population mode + demographics
    try {
      // Check for raion (aggregate mode indicator)
      const ws = engine.getWorkerSystem?.();
      result.populationMode = ws?.getMode?.() ?? (engine.raion ? 'aggregate' : 'entity');
    } catch {
      result.populationMode = 'unknown';
    }

    // Game over
    try {
      result.isGameOver = !!engine.ended;
      const meta = document.querySelector('[data-testid="game-over-reason"]');
      result.gameOverReason = meta?.textContent?.trim() ?? '';
      if (!result.gameOverReason && engine.ended) {
        // Try to get from engine callbacks
        result.gameOverReason = 'ended (reason not captured in DOM)';
      }
    } catch { /* */ }

    // Timeline milestones
    try {
      const subsystems = engine.serializeSubsystems?.();
      if (subsystems?.timelines) {
        result.activatedWorldMilestones = subsystems.timelines
          .find((t: any) => t.timelineId === 'world')?.activatedMilestones ?? [];
        result.activatedSpaceMilestones = subsystems.timelines
          .find((t: any) => t.timelineId === 'space')?.activatedMilestones ?? [];
        result.totalMilestonesActivated = subsystems.timelines
          .reduce((sum: number, t: any) => sum + (t.activatedMilestones?.length ?? 0), 0);
      }
    } catch { /* */ }

    return result;
  });
}

// ── Snapshot: screenshot + JSON dump ────────────────────────────────────

interface CaptureResult {
  diagnostics: EngineDiagnostics;
  screenshotPath: string;
  jsonPath: string;
}

async function captureFullSnapshot(
  page: Page,
  dir: string,
  label: string,
  seq: number,
): Promise<CaptureResult> {
  const diagnostics = await extractFullDiagnostics(page);

  const seqStr = String(seq).padStart(3, '0');
  const eraSlug = diagnostics.era.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
  const baseName = `${seqStr}-${label}-y${diagnostics.year}-pop${diagnostics.population}-${eraSlug}`;

  const screenshotPath = `${dir}/${baseName}.png`;
  const jsonPath = `${dir}/${baseName}.json`;

  // Inject debug overlay for screenshot
  await page.evaluate((d) => {
    document.getElementById('e2e-debug-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'e2e-debug-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', zIndex: '10000',
      background: 'rgba(0,0,0,0.85)', color: '#00ff00',
      fontFamily: 'monospace', fontSize: '11px', padding: '8px',
      lineHeight: '1.3', whiteSpace: 'pre', pointerEvents: 'none',
      maxWidth: '400px',
    });
    overlay.textContent = [
      `Year: ${d.year}  Month: ${d.month}  Ticks: ${d.totalTicks}  Season: ${d.season}`,
      `Pop: ${d.population}  Mode: ${d.populationMode}`,
      `Food: ${d.food}  Vodka: ${d.vodka}  Money: ${d.money}`,
      `Timber: ${d.timber}  Steel: ${d.steel}  Cement: ${d.cement}  Power: ${d.power}`,
      `Era: ${d.era}  Settlement: ${d.settlementTier}`,
      `Quota: ${d.quotaType} ${d.quotaCurrent}/${d.quotaTarget} (deadline ${d.quotaDeadlineYear})`,
      `Failures: ${d.consecutiveQuotaFailures}  Marks: ${d.blackMarks}  Commend: ${d.commendations}`,
      `Threat: ${d.threatLevel}  Buildings: ${d.buildingCount}`,
      `Governor: ${d.governorMode}  Crises: ${d.activeCrises.join(', ') || 'none'}`,
      d.isGameOver ? `GAME OVER: ${d.gameOverReason}` : 'ALIVE',
    ].join('\n');
    document.body.appendChild(overlay);
  }, diagnostics);

  await page.screenshot({ path: screenshotPath });

  // Clean up overlay
  await page.evaluate(() => document.getElementById('e2e-debug-overlay')?.remove());

  // Write JSON diagnostics
  writeFileSync(jsonPath, JSON.stringify(diagnostics, null, 2));

  return { diagnostics, screenshotPath, jsonPath };
}

// ── Helper: Start game with mode + consequence ──────────────────────────

async function startGameWithConfig(
  page: Page,
  mode: 'historical' | 'freeform',
  consequence: 'rehabilitated' | 'gulag' | 'rasstrelyat',
): Promise<void> {
  // Listen for console errors before navigation
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`  [BROWSER ERROR] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`  [PAGE ERROR] ${err.message}`));

  await page.goto('/', { waitUntil: 'load' });

  // Expo dev server may still be compiling — wait for app to actually render
  await page.getByText('NEW GAME').waitFor({ state: 'visible', timeout: 120_000 });
  await page.getByText('NEW GAME').click();
  await page.getByText('BEGIN ASSIGNMENT').waitFor({ timeout: 10_000 });

  const modeBtn = page.getByText(mode.toUpperCase());
  if (await modeBtn.first().isVisible().catch(() => false)) {
    await modeBtn.first().click();
    await page.waitForTimeout(200);
  }

  const consBtn = page.getByText(consequence.toUpperCase());
  if (await consBtn.first().isVisible().catch(() => false)) {
    await consBtn.first().click();
    await page.waitForTimeout(200);
  }

  await page.getByText('BEGIN ASSIGNMENT').click();
  await waitForGameReady(page);

  const ctaButton = page.getByText('ASSUME MAYORAL AUTHORITY');
  if (await ctaButton.isVisible().catch(() => false)) {
    await ctaButton.click();
    await page.waitForTimeout(800);
  }
}

// ── Playthrough runner ──────────────────────────────────────────────────

interface MilestoneCapture {
  milestoneId: string;
  year: number;
  screenshotPath: string;
  trigger: 'milestone' | 'year_marker' | 'divergence' | 'narrative' | 'end_of_run';
}

interface PlaythroughResult {
  survived: boolean;
  finalYear: number;
  finalPop: number;
  captures: CaptureResult[];
  milestoneCaptures: MilestoneCapture[];
  gameOverYear?: number;
  gameOverReason?: string;
}

/**
 * Capture a milestone screenshot into the milestone directory.
 * Returns a MilestoneCapture record for tracking.
 */
async function captureMilestoneScreenshot(
  page: Page,
  milestoneDir: string,
  milestoneId: string,
  year: number,
  trigger: MilestoneCapture['trigger'],
  seqNum: number,
): Promise<MilestoneCapture> {
  const slug = milestoneId.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const screenshotPath = `${milestoneDir}/milestone-${slug}-${year}.png`;

  // Inject milestone label overlay for context
  await page.evaluate(
    ({ id, yr, trig }) => {
      document.getElementById('e2e-milestone-overlay')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'e2e-milestone-overlay';
      Object.assign(overlay.style, {
        position: 'fixed', bottom: '30px', right: '10px', zIndex: '10001',
        background: 'rgba(198,40,40,0.9)', color: '#fbc02d',
        fontFamily: 'monospace', fontSize: '13px', padding: '6px 12px',
        fontWeight: 'bold', letterSpacing: '1px',
        border: '2px solid #fbc02d',
      });
      overlay.textContent = `MILESTONE: ${id} [${yr}] (${trig})`;
      document.body.appendChild(overlay);
    },
    { id: milestoneId, yr: year, trig: trigger },
  );

  await page.screenshot({ path: screenshotPath });

  // Clean up overlay
  await page.evaluate(() => document.getElementById('e2e-milestone-overlay')?.remove());

  console.log(`  [MILESTONE] ${trigger}: ${milestoneId} year=${year} → ${screenshotPath}`);

  return { milestoneId, year, screenshotPath, trigger };
}

async function runPlaythrough(
  page: Page,
  mode: 'historical' | 'freeform',
  consequence: 'rehabilitated' | 'gulag' | 'rasstrelyat',
  targetYears: number,
  screenshotDir: string,
): Promise<PlaythroughResult> {
  const milestoneDir = MILESTONE_DIR;
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(milestoneDir, { recursive: true });

  await startGameWithConfig(page, mode, consequence);
  await enableAutopilot(page);
  await setTurboSpeed(page);

  const captures: CaptureResult[] = [];
  const milestoneCaptures: MilestoneCapture[] = [];
  let seqNum = 0;

  // Track which milestones and year markers have already been screenshotted
  const capturedMilestones = new Set<string>();
  const capturedYearMarkers = new Set<number>();
  let divergenceCaptured = false;

  // Capture every 2 years for fine-grained diagnostics
  const captureInterval = 2;

  // Initial capture
  const initial = await captureFullSnapshot(page, screenshotDir, 'start', seqNum++);
  captures.push(initial);
  console.log(`  [${mode}] START year=${initial.diagnostics.year} pop=${initial.diagnostics.population}`);

  const targetYear = START_YEAR + targetYears;
  let lastCaptureYear = START_YEAR;

  const deadline = Date.now() + 270_000; // 4.5 min hard deadline
  while (Date.now() < deadline) {
    const currentYear = await getGameYear(page);

    // ── Milestone screenshot: check for newly activated milestones ──
    try {
      const diag = await extractFullDiagnostics(page);

      // Check for new space milestones (capture first one)
      const allMilestones = [
        ...(diag.activatedSpaceMilestones ?? []),
        ...(diag.activatedWorldMilestones ?? []),
      ];
      for (const msId of allMilestones) {
        if (!capturedMilestones.has(msId)) {
          capturedMilestones.add(msId);
          const mc = await captureMilestoneScreenshot(
            page, milestoneDir, msId, diag.year, 'milestone', seqNum++,
          );
          milestoneCaptures.push(mc);
        }
      }

      // Check for year markers (1991, 2100, 2500)
      for (const marker of YEAR_MARKERS) {
        if (currentYear >= marker && !capturedYearMarkers.has(marker)) {
          capturedYearMarkers.add(marker);
          const label = marker === 1991 ? 'divergence-1991' : `year-${marker}`;
          const trigger: MilestoneCapture['trigger'] = marker === 1991 ? 'divergence' : 'year_marker';
          const mc = await captureMilestoneScreenshot(
            page, milestoneDir, label, currentYear, trigger, seqNum++,
          );
          milestoneCaptures.push(mc);
        }
      }

      // Check for narrative event modal (visible choices indicate NarrativeEvent)
      const narrativeVisible = await page.getByText('IGNORE (AUTO-RESOLVE)').isVisible({ timeout: 50 }).catch(() => false);
      if (narrativeVisible && !capturedMilestones.has(`narrative-${currentYear}`)) {
        capturedMilestones.add(`narrative-${currentYear}`);
        const mc = await captureMilestoneScreenshot(
          page, milestoneDir, `narrative-event-${currentYear}`, currentYear, 'narrative', seqNum++,
        );
        milestoneCaptures.push(mc);
      }
    } catch {
      // Non-critical: milestone capture failure shouldn't stop the run
    }

    // Game over?
    if (await isGameOverVisible(page)) {
      const cap = await captureFullSnapshot(page, screenshotDir, 'game-over', seqNum++);
      captures.push(cap);
      console.log(`  [${mode}] GAME OVER year=${cap.diagnostics.year} pop=${cap.diagnostics.population} reason=${cap.diagnostics.gameOverReason}`);

      // End-of-run milestone screenshot
      const mc = await captureMilestoneScreenshot(
        page, milestoneDir, 'end-of-run', cap.diagnostics.year, 'end_of_run', seqNum++,
      );
      milestoneCaptures.push(mc);

      // Write full run summary
      writeSummary(screenshotDir, mode, captures, milestoneCaptures);

      return {
        survived: false,
        finalYear: cap.diagnostics.year,
        finalPop: cap.diagnostics.population,
        captures,
        milestoneCaptures,
        gameOverYear: cap.diagnostics.year,
        gameOverReason: cap.diagnostics.gameOverReason,
      };
    }

    // Periodic capture
    if (currentYear >= lastCaptureYear + captureInterval) {
      lastCaptureYear = currentYear;
      const cap = await captureFullSnapshot(page, screenshotDir, `checkpoint`, seqNum++);
      captures.push(cap);
      const d = cap.diagnostics;
      console.log(
        `  [${mode}] y=${d.year} pop=${d.population} food=${d.food} era=${d.era} ` +
        `quota=${d.quotaCurrent}/${d.quotaTarget} marks=${d.blackMarks} threat=${d.threatLevel} ` +
        `bldg=${d.buildingCount} crises=[${d.activeCrises.join(',')}]`
      );
    }

    // Reached target?
    if (currentYear >= targetYear) {
      const cap = await captureFullSnapshot(page, screenshotDir, 'final', seqNum++);
      captures.push(cap);
      console.log(`  [${mode}] FINAL year=${cap.diagnostics.year} pop=${cap.diagnostics.population}`);

      // End-of-run milestone screenshot
      const mc = await captureMilestoneScreenshot(
        page, milestoneDir, 'end-of-run', cap.diagnostics.year, 'end_of_run', seqNum++,
      );
      milestoneCaptures.push(mc);

      writeSummary(screenshotDir, mode, captures, milestoneCaptures);

      return {
        survived: cap.diagnostics.population > 0,
        finalYear: cap.diagnostics.year,
        finalPop: cap.diagnostics.population,
        captures,
        milestoneCaptures,
      };
    }

    // Dismiss blocking modals
    await dismissAnyModal(page);

    // Dismiss dissolution modal — auto-continue into freeform
    const dissolutionModal = page.getByText('CONTINUE INTO ALTERNATE HISTORY');
    if (await dissolutionModal.isVisible({ timeout: 100 }).catch(() => false)) {
      // Capture the dissolution moment before dismissing
      if (!divergenceCaptured) {
        divergenceCaptured = true;
        const mc = await captureMilestoneScreenshot(
          page, milestoneDir, 'ussr-dissolution-modal', currentYear, 'divergence', seqNum++,
        );
        milestoneCaptures.push(mc);
      }
      await dissolutionModal.click({ force: true, timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(1000);
  }

  // Timed out
  const cap = await captureFullSnapshot(page, screenshotDir, 'timeout', seqNum++);
  captures.push(cap);
  console.log(`  [${mode}] TIMEOUT year=${cap.diagnostics.year} pop=${cap.diagnostics.population}`);

  // End-of-run milestone screenshot
  const mc = await captureMilestoneScreenshot(
    page, milestoneDir, 'end-of-run', cap.diagnostics.year, 'end_of_run', seqNum++,
  );
  milestoneCaptures.push(mc);

  writeSummary(screenshotDir, mode, captures, milestoneCaptures);

  return {
    survived: cap.diagnostics.population > 0 && !cap.diagnostics.isGameOver,
    finalYear: cap.diagnostics.year,
    finalPop: cap.diagnostics.population,
    captures,
    milestoneCaptures,
  };
}

/** Write a summary JSON with all capture data for post-run analysis. */
function writeSummary(dir: string, mode: string, captures: CaptureResult[], milestoneCaptures: MilestoneCapture[] = []): void {
  const summary = {
    mode,
    captureCount: captures.length,
    milestoneCaptureCount: milestoneCaptures.length,
    milestones: milestoneCaptures.map((mc) => ({
      milestoneId: mc.milestoneId,
      year: mc.year,
      trigger: mc.trigger,
      screenshot: mc.screenshotPath,
    })),
    timeline: captures.map((c) => ({
      year: c.diagnostics.year,
      population: c.diagnostics.population,
      food: c.diagnostics.food,
      vodka: c.diagnostics.vodka,
      money: c.diagnostics.money,
      era: c.diagnostics.era,
      quotaCurrent: c.diagnostics.quotaCurrent,
      quotaTarget: c.diagnostics.quotaTarget,
      consecutiveQuotaFailures: c.diagnostics.consecutiveQuotaFailures,
      blackMarks: c.diagnostics.blackMarks,
      commendations: c.diagnostics.commendations,
      threatLevel: c.diagnostics.threatLevel,
      buildingCount: c.diagnostics.buildingCount,
      settlementTier: c.diagnostics.settlementTier,
      activeCrises: c.diagnostics.activeCrises,
      isGameOver: c.diagnostics.isGameOver,
      gameOverReason: c.diagnostics.gameOverReason,
      screenshot: c.screenshotPath,
    })),
  };
  writeFileSync(`${dir}/run-summary.json`, JSON.stringify(summary, null, 2));
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Yuka Playthrough — Historical Mode', () => {
  test.beforeAll(() => {
    mkdirSync(`${SCREENSHOT_DIR}/historical`, { recursive: true });
  });

  test('historical — Yuka autopilot 20-year playthrough (1917→1937)', async ({ page }) => {
    const result = await runPlaythrough(
      page, 'historical', 'rehabilitated', 20,
      `${SCREENSHOT_DIR}/historical`,
    );

    console.log('\n  === Historical Playthrough Results ===');
    console.log(`  Survived: ${result.survived}`);
    console.log(`  Final year: ${result.finalYear}`);
    console.log(`  Final pop: ${result.finalPop}`);
    console.log(`  Captures: ${result.captures.length}`);
    console.log(`  Milestone captures: ${result.milestoneCaptures.length}`);
    for (const mc of result.milestoneCaptures) {
      console.log(`    ${mc.trigger}: ${mc.milestoneId} (year ${mc.year})`);
    }
    if (result.gameOverReason) console.log(`  Game over: ${result.gameOverReason}`);

    // Autopilot + rehabilitated should survive at least 10 years.
    // If it dies before that, the game balance needs work.
    expect(result.finalYear).toBeGreaterThanOrEqual(START_YEAR + 10);
  });
});

test.describe('Yuka Playthrough — Freeform Mode', () => {
  test.beforeAll(() => {
    mkdirSync(`${SCREENSHOT_DIR}/freeform`, { recursive: true });
  });

  test('freeform — Yuka autopilot 20-year playthrough', async ({ page }) => {
    const result = await runPlaythrough(
      page, 'freeform', 'rehabilitated', 20,
      `${SCREENSHOT_DIR}/freeform`,
    );

    console.log('\n  === Freeform Playthrough Results ===');
    console.log(`  Survived: ${result.survived}`);
    console.log(`  Final year: ${result.finalYear}`);
    console.log(`  Final pop: ${result.finalPop}`);
    console.log(`  Captures: ${result.captures.length}`);
    console.log(`  Milestone captures: ${result.milestoneCaptures.length}`);
    for (const mc of result.milestoneCaptures) {
      console.log(`    ${mc.trigger}: ${mc.milestoneId} (year ${mc.year})`);
    }
    if (result.gameOverReason) console.log(`  Game over: ${result.gameOverReason}`);

    expect(result.finalYear).toBeGreaterThanOrEqual(START_YEAR + 10);
  });
});

// ── Extended E2E: 1991 Divergence + 100-Year Freeform ────────────────────────

test.describe('Historical Mode — 1991 divergence', () => {
  // 76-year run needs up to 10 minutes
  test.describe.configure({ timeout: 600_000 });

  test.beforeAll(() => {
    mkdirSync(`${SCREENSHOT_DIR}/historical-1991`, { recursive: true });
  });

  test('historical — survives to 1993 and crosses 1991 divergence', async ({ page }) => {
    const result = await runPlaythrough(
      page, 'historical', 'rehabilitated', 76,
      `${SCREENSHOT_DIR}/historical-1991`,
    );

    console.log('\n  === Historical 1991 Divergence Results ===');
    console.log(`  Survived: ${result.survived}`);
    console.log(`  Final year: ${result.finalYear}`);
    console.log(`  Milestone captures: ${result.milestoneCaptures.length}`);
    for (const mc of result.milestoneCaptures) {
      console.log(`    ${mc.trigger}: ${mc.milestoneId} (year ${mc.year})`);
    }
    const finalDiag = result.captures[result.captures.length - 1]?.diagnostics;
    if (finalDiag) {
      console.log(`  World milestones: ${finalDiag.activatedWorldMilestones?.join(', ')}`);
      console.log(`  Space milestones: ${finalDiag.activatedSpaceMilestones?.join(', ')}`);
      console.log(`  Total milestones: ${finalDiag.totalMilestonesActivated}`);
    }

    // Should survive past 1991 (modal dismissed, continued in freeform)
    expect(result.finalYear).toBeGreaterThanOrEqual(1991);
    expect(result.survived).toBe(true);

    // World milestones should include cold_war_start
    const worldMilestones = finalDiag?.activatedWorldMilestones ?? [];
    expect(worldMilestones).toContain('cold_war_start');

    // At least 3 milestone screenshots captured during the 76-year run
    // (cold_war_start + 1991 divergence + end_of_run at minimum)
    expect(result.milestoneCaptures.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Freeform Mode — 100-year narrative coherence', () => {
  // 100-year run needs up to 10 minutes
  test.describe.configure({ timeout: 600_000 });

  test.beforeAll(() => {
    mkdirSync(`${SCREENSHOT_DIR}/freeform-100yr`, { recursive: true });
  });

  test('freeform — 100-year run forms coherent narrative (>=5 distinct milestones)', async ({ page }) => {
    const result = await runPlaythrough(
      page, 'freeform', 'rehabilitated', 100,
      `${SCREENSHOT_DIR}/freeform-100yr`,
    );

    console.log('\n  === Freeform 100-Year Narrative Coherence ===');
    console.log(`  Survived: ${result.survived}`);
    console.log(`  Final year: ${result.finalYear}`);
    console.log(`  Milestone captures: ${result.milestoneCaptures.length}`);
    for (const mc of result.milestoneCaptures) {
      console.log(`    ${mc.trigger}: ${mc.milestoneId} (year ${mc.year})`);
    }
    const finalDiag = result.captures[result.captures.length - 1]?.diagnostics;
    if (finalDiag) {
      console.log(`  World milestones: ${finalDiag.activatedWorldMilestones?.join(', ')}`);
      console.log(`  Space milestones: ${finalDiag.activatedSpaceMilestones?.join(', ')}`);
      console.log(`  Total milestones: ${finalDiag.totalMilestonesActivated}`);
    }

    // Should survive at least 60 years
    expect(result.finalYear).toBeGreaterThanOrEqual(START_YEAR + 60);

    // Narrative coherence: at least 5 distinct milestones across timelines
    expect(finalDiag?.totalMilestonesActivated ?? 0).toBeGreaterThanOrEqual(5);

    // World timeline should have fired at least cold_war_start
    expect(finalDiag?.activatedWorldMilestones ?? []).toContain('cold_war_start');

    // At least 3 milestone screenshots captured during the 100-year run
    expect(result.milestoneCaptures.length).toBeGreaterThanOrEqual(3);
  });
});
