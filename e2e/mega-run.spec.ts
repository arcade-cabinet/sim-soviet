/**
 * Mega-Run E2E — 1-hour 100x turbo playthrough with full milestone capture.
 *
 * Starts in historical mode 1917, rehabilitated consequence, ChairmanAgent
 * autopilot, 100x turbo speed. The dissolution modal is auto-dismissed to
 * continue into freeform. Runs for up to 1 hour of wall-clock time.
 *
 * Captures:
 *   - Screenshot on every milestone activation (space + world timelines)
 *   - Screenshot at year markers (1947, 1957, 1991, 2000, 2100, 2200, 2500)
 *   - Periodic checkpoint screenshots every 10 sim-years
 *   - Full engine diagnostics JSON at each capture
 *
 * Outputs:
 *   - e2e/screenshots/mega-run/*.png + *.json
 *   - e2e/screenshots/mega-run/TIMELINE.md — markdown timeline document
 *
 * Run: npx playwright test e2e/mega-run.spec.ts --headed --timeout=3700000
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
  isGameOverVisible,
  type GameSnapshotData,
} from './helpers';

// 1 hour + 100s buffer
test.describe.configure({ timeout: 3_700_000 });

const SCREENSHOT_DIR = 'e2e/screenshots/mega-run';
const START_YEAR = 1917;
const TARGET_YEAR = 2200;

/** Year markers that trigger special screenshots. */
const YEAR_MARKERS = [1947, 1957, 1991, 2000, 2100, 2200, 2500, 3000];

// ── Deep engine diagnostics ─────────────────────────────────────────────────

interface EngineDiagnostics extends GameSnapshotData {
  money: number;
  timber: number;
  steel: number;
  cement: number;
  power: number;
  trudodni: number;
  totalTicks: number;
  season: string;
  populationMode: string;
  operationalCount: number;
  activeCrises: string[];
  governorMode: string;
  consecutiveQuotaFailures: number;
  commendations: number;
  gameOverReason: string;
  activatedWorldMilestones: string[];
  activatedSpaceMilestones: string[];
  totalMilestonesActivated: number;
  activatedMilestoneYears: Record<string, number>;
  pravdaHeadlines: string[];
}

async function extractDiagnostics(page: Page): Promise<EngineDiagnostics> {
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

    const result: any = {
      year, month, population, food, vodka, era,
      buildingCount: 0, settlementTier: 'unknown', threatLevel: 'unknown',
      blackMarks: 0, isGameOver: false,
      money: 0, timber: 0, steel: 0, cement: 0, power: 0,
      trudodni: 0, totalTicks: 0, season: 'unknown',
      populationMode: 'unknown', operationalCount: 0,
      activeCrises: [], governorMode: 'unknown',
      consecutiveQuotaFailures: 0, commendations: 0,
      gameOverReason: '',
      activatedWorldMilestones: [], activatedSpaceMilestones: [],
      totalMilestonesActivated: 0,
      activatedMilestoneYears: {},
      pravdaHeadlines: [],
    };

    const engine = (window as any).__simEngine;
    if (!engine) return result;

    try { result.money = parseNum('money-value'); } catch { /* */ }
    try { result.timber = parseNum('timber-value'); } catch { /* */ }
    try { result.steel = parseNum('steel-value'); } catch { /* */ }
    try { result.cement = parseNum('cement-value'); } catch { /* */ }
    try { result.power = parseNum('power-value'); } catch { /* */ }

    try {
      const arch = (window as any).__ecsArchetypes;
      if (arch) {
        result.buildingCount = arch.buildingCount ?? 0;
        result.operationalCount = arch.operationalCount ?? 0;
      }
    } catch { /* */ }

    try {
      result.settlementTier = engine.getSettlement?.()?.getCurrentTier?.() ?? 'unknown';
    } catch { /* */ }

    try {
      const pf = engine.getPersonnelFile?.();
      result.threatLevel = pf?.getThreatLevel?.() ?? 'unknown';
      result.blackMarks = pf?.getBlackMarks?.() ?? 0;
      result.commendations = pf?.getCommendations?.() ?? 0;
    } catch { /* */ }

    try {
      const chrono = engine.getChronology?.();
      const date = chrono?.getDate?.() ?? {};
      result.totalTicks = date.totalTicks ?? 0;
      result.season = chrono?.getSeason?.()?.season ?? 'unknown';
    } catch { /* */ }

    try {
      const gov = engine.getGovernor?.();
      result.governorMode = gov?.mode ?? 'unknown';
      const active = gov?.getActiveCrises?.() ?? [];
      result.activeCrises = active.map((c: any) => c.id ?? c.definition?.id ?? String(c));
    } catch { /* */ }

    try {
      result.isGameOver = !!engine.ended;
      if (engine.ended) result.gameOverReason = 'ended';
    } catch { /* */ }

    try {
      result.populationMode = engine.raion ? 'aggregate' : 'entity';
    } catch { /* */ }

    try { result.consecutiveQuotaFailures = engine.consecutiveQuotaFailures ?? 0; } catch { /* */ }

    // Timeline milestones with activation years
    try {
      const subsystems = engine.serializeSubsystems?.();
      if (subsystems?.timelines) {
        for (const tl of subsystems.timelines) {
          if (tl.timelineId === 'world') {
            result.activatedWorldMilestones = tl.activatedMilestones ?? [];
          } else if (tl.timelineId === 'space') {
            result.activatedSpaceMilestones = tl.activatedMilestones ?? [];
          }
          result.totalMilestonesActivated += tl.activatedMilestones?.length ?? 0;
          // Merge activation years from all timelines
          if (tl.activatedMilestoneYears) {
            Object.assign(result.activatedMilestoneYears, tl.activatedMilestoneYears);
          }
        }
      }
    } catch { /* */ }

    // Grab recent Pravda headlines from DOM
    try {
      const ticker = document.querySelector('[data-testid="pravda-ticker"]');
      if (ticker) {
        result.pravdaHeadlines = [ticker.textContent?.trim() ?? ''];
      }
    } catch { /* */ }

    return result;
  });
}

// ── Screenshot capture ──────────────────────────────────────────────────────

interface MilestoneRecord {
  milestoneId: string;
  year: number;
  era: string;
  population: number;
  screenshotPath: string;
  trigger: 'milestone' | 'year_marker' | 'divergence' | 'narrative' | 'end_of_run';
  pravdaHeadline: string;
}

async function captureSnapshot(
  page: Page,
  dir: string,
  label: string,
  seq: number,
): Promise<{ diagnostics: EngineDiagnostics; screenshotPath: string; jsonPath: string }> {
  const diagnostics = await extractDiagnostics(page);

  const seqStr = String(seq).padStart(4, '0');
  const eraSlug = diagnostics.era.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
  const baseName = `${seqStr}-${label}-y${diagnostics.year}-pop${diagnostics.population}-${eraSlug}`;

  const screenshotPath = `${dir}/${baseName}.png`;
  const jsonPath = `${dir}/${baseName}.json`;

  // Inject debug overlay
  await page.evaluate((d) => {
    document.getElementById('e2e-debug-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'e2e-debug-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', zIndex: '10000',
      background: 'rgba(0,0,0,0.85)', color: '#00ff00',
      fontFamily: 'monospace', fontSize: '11px', padding: '8px',
      lineHeight: '1.3', whiteSpace: 'pre', pointerEvents: 'none',
      maxWidth: '420px',
    });
    overlay.textContent = [
      `Year: ${d.year}  Ticks: ${d.totalTicks}  Season: ${d.season}  Mode: ${d.populationMode}`,
      `Pop: ${d.population}  Food: ${d.food}  Vodka: ${d.vodka}  Money: ${d.money}`,
      `Timber: ${d.timber}  Steel: ${d.steel}  Cement: ${d.cement}  Power: ${d.power}`,
      `Era: ${d.era}  Settlement: ${d.settlementTier}  Buildings: ${d.buildingCount}`,
      `Governor: ${d.governorMode}  Crises: ${d.activeCrises.join(', ') || 'none'}`,
      `Milestones: ${d.totalMilestonesActivated}  Threat: ${d.threatLevel}  Marks: ${d.blackMarks}`,
      d.isGameOver ? `GAME OVER: ${d.gameOverReason}` : 'ALIVE',
    ].join('\n');
    document.body.appendChild(overlay);
  }, diagnostics);

  await page.screenshot({ path: screenshotPath });
  await page.evaluate(() => document.getElementById('e2e-debug-overlay')?.remove());

  writeFileSync(jsonPath, JSON.stringify(diagnostics, null, 2));

  return { diagnostics, screenshotPath, jsonPath };
}

async function captureMilestone(
  page: Page,
  dir: string,
  milestoneId: string,
  diagnostics: EngineDiagnostics,
  trigger: MilestoneRecord['trigger'],
  seq: number,
): Promise<MilestoneRecord> {
  const slug = milestoneId.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const screenshotPath = `${dir}/ms-${String(seq).padStart(4, '0')}-${slug}-y${diagnostics.year}.png`;

  // Inject milestone label overlay
  await page.evaluate(
    ({ id, yr, trig }) => {
      document.getElementById('e2e-milestone-overlay')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'e2e-milestone-overlay';
      Object.assign(overlay.style, {
        position: 'fixed', bottom: '30px', right: '10px', zIndex: '10001',
        background: 'rgba(198,40,40,0.9)', color: '#fbc02d',
        fontFamily: 'monospace', fontSize: '14px', padding: '8px 14px',
        fontWeight: 'bold', letterSpacing: '1px',
        border: '2px solid #fbc02d',
      });
      overlay.textContent = `MILESTONE: ${id} [${yr}] (${trig})`;
      document.body.appendChild(overlay);
    },
    { id: milestoneId, yr: diagnostics.year, trig: trigger },
  );

  await page.screenshot({ path: screenshotPath });
  await page.evaluate(() => document.getElementById('e2e-milestone-overlay')?.remove());

  console.log(`  [MILESTONE] ${trigger}: ${milestoneId} year=${diagnostics.year}`);

  return {
    milestoneId,
    year: diagnostics.year,
    era: diagnostics.era,
    population: diagnostics.population,
    screenshotPath,
    trigger,
    pravdaHeadline: diagnostics.pravdaHeadlines?.[0] ?? '',
  };
}

// ── Start game ──────────────────────────────────────────────────────────────

async function startHistoricalGame(page: Page): Promise<void> {
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`  [BROWSER ERROR] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`  [PAGE ERROR] ${err.message}`));

  await page.goto('/', { waitUntil: 'load' });
  await page.getByText('NEW GAME').waitFor({ state: 'visible', timeout: 120_000 });
  await page.getByText('NEW GAME').click();
  await page.getByText('BEGIN ASSIGNMENT').waitFor({ timeout: 10_000 });

  // Select historical mode
  const histBtn = page.getByText('HISTORICAL');
  if (await histBtn.first().isVisible().catch(() => false)) {
    await histBtn.first().click();
    await page.waitForTimeout(200);
  }

  // Select rehabilitated consequence
  const rehabBtn = page.getByText('REHABILITATED');
  if (await rehabBtn.first().isVisible().catch(() => false)) {
    await rehabBtn.first().click();
    await page.waitForTimeout(200);
  }

  await page.getByText('BEGIN ASSIGNMENT').click();
  await waitForGameReady(page);

  // Dismiss intro modal
  const ctaButton = page.getByText('ASSUME MAYORAL AUTHORITY');
  if (await ctaButton.isVisible().catch(() => false)) {
    await ctaButton.click();
    await page.waitForTimeout(800);
  }
}

// ── Generate markdown timeline document ─────────────────────────────────────

function generateTimelineMarkdown(
  milestones: MilestoneRecord[],
  finalDiag: EngineDiagnostics,
  wallTimeMs: number,
): string {
  const wallMinutes = Math.round(wallTimeMs / 60_000);
  const sorted = [...milestones].sort((a, b) => a.year - b.year);

  const lines: string[] = [
    '# SimSoviet Mega-Run Timeline',
    '',
    `**Mode**: Historical → Freeform (post-1991)`,
    `**Consequence**: Rehabilitated`,
    `**Start year**: ${START_YEAR}`,
    `**Final year reached**: ${finalDiag.year}`,
    `**Sim years traversed**: ${finalDiag.year - START_YEAR}`,
    `**Wall-clock time**: ${wallMinutes} minutes`,
    `**Total milestones activated**: ${finalDiag.totalMilestonesActivated}`,
    `**Final population**: ${finalDiag.population}`,
    `**Final era**: ${finalDiag.era}`,
    `**Population mode**: ${finalDiag.populationMode}`,
    `**Game over**: ${finalDiag.isGameOver ? finalDiag.gameOverReason : 'No (survived)'}`,
    '',
    '---',
    '',
    '## Milestone Timeline',
    '',
    '| Year | Milestone | Era | Pop | Trigger | Pravda Headline | Screenshot |',
    '|------|-----------|-----|-----|---------|-----------------|------------|',
  ];

  for (const ms of sorted) {
    const relPath = ms.screenshotPath.replace(/^e2e\/screenshots\/mega-run\//, '');
    lines.push(
      `| ${ms.year} | ${ms.milestoneId} | ${ms.era} | ${ms.population.toLocaleString()} | ${ms.trigger} | ${ms.pravdaHeadline || '—'} | [screenshot](${relPath}) |`,
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## World Milestones');
  lines.push('');
  for (const msId of finalDiag.activatedWorldMilestones) {
    const yr = finalDiag.activatedMilestoneYears?.[msId];
    lines.push(`- **${msId}** ${yr ? `(year ${yr})` : ''}`);
  }

  lines.push('');
  lines.push('## Space Milestones');
  lines.push('');
  for (const msId of finalDiag.activatedSpaceMilestones) {
    const yr = finalDiag.activatedMilestoneYears?.[msId];
    lines.push(`- **${msId}** ${yr ? `(year ${yr})` : ''}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Final State');
  lines.push('');
  lines.push(`- **Year**: ${finalDiag.year}`);
  lines.push(`- **Population**: ${finalDiag.population}`);
  lines.push(`- **Era**: ${finalDiag.era}`);
  lines.push(`- **Settlement tier**: ${finalDiag.settlementTier}`);
  lines.push(`- **Buildings**: ${finalDiag.buildingCount}`);
  lines.push(`- **Governor mode**: ${finalDiag.governorMode}`);
  lines.push(`- **Active crises**: ${finalDiag.activeCrises.join(', ') || 'none'}`);
  lines.push(`- **Threat level**: ${finalDiag.threatLevel}`);
  lines.push(`- **Black marks**: ${finalDiag.blackMarks}`);
  lines.push(`- **Commendations**: ${finalDiag.commendations}`);
  lines.push(`- **Total ticks**: ${finalDiag.totalTicks}`);
  lines.push('');

  return lines.join('\n');
}

// ── The Mega-Run ────────────────────────────────────────────────────────────

test.describe('Mega-Run — 1-hour 100x turbo playthrough', () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('historical 1917 → 2200+ with full milestone capture', async ({ page }) => {
    const startWallTime = Date.now();

    await startHistoricalGame(page);
    await enableAutopilot(page);
    await setTurboSpeed(page);

    const milestoneRecords: MilestoneRecord[] = [];
    const capturedMilestones = new Set<string>();
    const capturedYearMarkers = new Set<number>();
    let seqNum = 0;
    let lastCheckpointYear = START_YEAR;
    let divergenceCaptured = false;
    let lastDiag: EngineDiagnostics | null = null;

    // Initial capture
    const initial = await captureSnapshot(page, SCREENSHOT_DIR, 'start', seqNum++);
    console.log(`  [MEGA-RUN] START year=${initial.diagnostics.year} pop=${initial.diagnostics.population}`);

    // 1 hour hard deadline
    const deadline = startWallTime + 3_600_000;

    while (Date.now() < deadline) {
      const currentYear = await getGameYear(page);

      // Extract diagnostics for milestone tracking
      let diag: EngineDiagnostics;
      try {
        diag = await extractDiagnostics(page);
        lastDiag = diag;
      } catch {
        await page.waitForTimeout(2000);
        continue;
      }

      // ── Check for new milestone activations ──
      const allMilestones = [
        ...(diag.activatedSpaceMilestones ?? []),
        ...(diag.activatedWorldMilestones ?? []),
      ];
      for (const msId of allMilestones) {
        if (!capturedMilestones.has(msId)) {
          capturedMilestones.add(msId);
          try {
            const mc = await captureMilestone(
              page, SCREENSHOT_DIR, msId, diag, 'milestone', seqNum++,
            );
            milestoneRecords.push(mc);
          } catch (e) {
            console.log(`  [WARN] Failed to capture milestone ${msId}: ${e}`);
          }
        }
      }

      // ── Check for year markers ──
      for (const marker of YEAR_MARKERS) {
        if (currentYear >= marker && !capturedYearMarkers.has(marker)) {
          capturedYearMarkers.add(marker);
          const label = marker === 1991 ? 'divergence-1991' : `year-${marker}`;
          const trigger: MilestoneRecord['trigger'] = marker === 1991 ? 'divergence' : 'year_marker';
          try {
            const mc = await captureMilestone(
              page, SCREENSHOT_DIR, label, diag, trigger, seqNum++,
            );
            milestoneRecords.push(mc);
          } catch (e) {
            console.log(`  [WARN] Failed to capture year marker ${marker}: ${e}`);
          }
        }
      }

      // ── Check for narrative event modals ──
      try {
        const narrativeVisible = await page.getByText('IGNORE (AUTO-RESOLVE)').isVisible({ timeout: 50 }).catch(() => false);
        if (narrativeVisible && !capturedMilestones.has(`narrative-${currentYear}`)) {
          capturedMilestones.add(`narrative-${currentYear}`);
          const mc = await captureMilestone(
            page, SCREENSHOT_DIR, `narrative-event-${currentYear}`, diag, 'narrative', seqNum++,
          );
          milestoneRecords.push(mc);
        }
      } catch { /* non-critical */ }

      // ── Game over check ──
      if (await isGameOverVisible(page)) {
        const cap = await captureSnapshot(page, SCREENSHOT_DIR, 'game-over', seqNum++);
        console.log(`  [MEGA-RUN] GAME OVER year=${cap.diagnostics.year} pop=${cap.diagnostics.population}`);

        const mc = await captureMilestone(
          page, SCREENSHOT_DIR, 'end-of-run', cap.diagnostics, 'end_of_run', seqNum++,
        );
        milestoneRecords.push(mc);

        // Generate timeline document
        const wallTimeMs = Date.now() - startWallTime;
        const timeline = generateTimelineMarkdown(milestoneRecords, cap.diagnostics, wallTimeMs);
        writeFileSync(`${SCREENSHOT_DIR}/TIMELINE.md`, timeline);
        console.log(`  [MEGA-RUN] Timeline written to ${SCREENSHOT_DIR}/TIMELINE.md`);

        // The test still passes — we capture data regardless of game over
        expect(cap.diagnostics.year).toBeGreaterThanOrEqual(START_YEAR + 10);
        return;
      }

      // ── Periodic checkpoint (every 10 sim-years) ──
      if (currentYear >= lastCheckpointYear + 10) {
        lastCheckpointYear = currentYear;
        const elapsed = Math.round((Date.now() - startWallTime) / 1000);
        console.log(
          `  [MEGA-RUN] y=${diag.year} pop=${diag.population} era=${diag.era} ` +
          `milestones=${diag.totalMilestonesActivated} bldg=${diag.buildingCount} ` +
          `crises=[${diag.activeCrises.join(',')}] wall=${elapsed}s`,
        );
        await captureSnapshot(page, SCREENSHOT_DIR, 'checkpoint', seqNum++);
      }

      // ── Dismiss dissolution modal → continue freeform ──
      try {
        const dissolutionModal = page.getByText('CONTINUE INTO ALTERNATE HISTORY');
        if (await dissolutionModal.isVisible({ timeout: 100 }).catch(() => false)) {
          if (!divergenceCaptured) {
            divergenceCaptured = true;
            const mc = await captureMilestone(
              page, SCREENSHOT_DIR, 'ussr-dissolution', diag, 'divergence', seqNum++,
            );
            milestoneRecords.push(mc);
          }
          await dissolutionModal.click({ force: true, timeout: 1000 }).catch(() => {});
          await page.waitForTimeout(500);
        }
      } catch { /* non-critical */ }

      // ── Dismiss any other blocking modals ──
      await dismissAnyModal(page);

      // ── Target reached? ──
      if (currentYear >= TARGET_YEAR) {
        const cap = await captureSnapshot(page, SCREENSHOT_DIR, 'target-reached', seqNum++);
        console.log(`  [MEGA-RUN] TARGET REACHED year=${cap.diagnostics.year}`);

        const mc = await captureMilestone(
          page, SCREENSHOT_DIR, 'end-of-run', cap.diagnostics, 'end_of_run', seqNum++,
        );
        milestoneRecords.push(mc);

        const wallTimeMs = Date.now() - startWallTime;
        const timeline = generateTimelineMarkdown(milestoneRecords, cap.diagnostics, wallTimeMs);
        writeFileSync(`${SCREENSHOT_DIR}/TIMELINE.md`, timeline);
        console.log(`  [MEGA-RUN] Timeline written to ${SCREENSHOT_DIR}/TIMELINE.md`);

        // Assertions
        expect(cap.diagnostics.year).toBeGreaterThanOrEqual(TARGET_YEAR);
        expect(cap.diagnostics.totalMilestonesActivated).toBeGreaterThanOrEqual(5);
        return;
      }

      // Brief wait between polling cycles
      await page.waitForTimeout(2000);
    }

    // ── 1 hour elapsed — write results regardless ──
    const finalDiag = lastDiag ?? await extractDiagnostics(page);
    const cap = await captureSnapshot(page, SCREENSHOT_DIR, 'timeout-final', seqNum++);

    const mc = await captureMilestone(
      page, SCREENSHOT_DIR, 'end-of-run', finalDiag, 'end_of_run', seqNum++,
    );
    milestoneRecords.push(mc);

    const wallTimeMs = Date.now() - startWallTime;
    const timeline = generateTimelineMarkdown(milestoneRecords, finalDiag, wallTimeMs);
    writeFileSync(`${SCREENSHOT_DIR}/TIMELINE.md`, timeline);
    console.log(`  [MEGA-RUN] Timeline written to ${SCREENSHOT_DIR}/TIMELINE.md`);

    console.log(`\n  === MEGA-RUN FINAL RESULTS ===`);
    console.log(`  Final year: ${finalDiag.year}`);
    console.log(`  Final pop: ${finalDiag.population}`);
    console.log(`  Total milestones: ${finalDiag.totalMilestonesActivated}`);
    console.log(`  World milestones: ${finalDiag.activatedWorldMilestones.join(', ')}`);
    console.log(`  Space milestones: ${finalDiag.activatedSpaceMilestones.join(', ')}`);
    console.log(`  Wall time: ${Math.round(wallTimeMs / 60_000)} min`);

    // Should have made significant progress even if didn't reach TARGET_YEAR
    expect(finalDiag.year).toBeGreaterThanOrEqual(START_YEAR + 50);
  });
});
