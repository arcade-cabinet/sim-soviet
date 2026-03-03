/**
 * Visual Playtest Capture — rich screenshot capture at significant game stages.
 *
 * Runs autopilot playthroughs per difficulty with debug overlays, capturing
 * screenshots on era changes, 5-year intervals, and game-over events.
 * Generates an HTML summary report per difficulty.
 *
 * Screenshots: e2e/screenshots/{difficulty}/
 * Reports: e2e/screenshots/{difficulty}/report.html
 */
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import {
  startGameWithDifficulty,
  enableAutopilot,
  setTurboSpeed,
  getGameYear,
  captureGameSnapshot,
  isGameOverVisible,
  extractGameState,
  dismissAnyModal,
  type GameSnapshotData,
} from './helpers';

// 5 minutes per test — long playthroughs at turbo speed
test.describe.configure({ timeout: 300_000 });

const SCREENSHOT_DIR = 'e2e/screenshots';
const START_YEAR = 1917;
const MAX_GAME_YEARS = 80;
const POLL_INTERVAL_MS = 500;

interface CaptureEntry {
  data: GameSnapshotData;
  filename: string;
  trigger: string;
}

/**
 * Generate a Soviet-themed HTML report from captured snapshots.
 */
function generateReport(difficulty: string, captures: CaptureEntry[]): string {
  const rows = captures
    .map(
      (c) => `
      <tr>
        <td><img src="${c.filename}" width="320" loading="lazy" /></td>
        <td>${c.trigger}</td>
        <td>${c.data.year}</td>
        <td>${c.data.population.toLocaleString()}</td>
        <td>${c.data.food.toLocaleString()}</td>
        <td>${c.data.vodka}</td>
        <td>${c.data.era}</td>
        <td>${c.data.settlementTier}</td>
        <td>${c.data.threatLevel}</td>
        <td>${c.data.blackMarks}</td>
        <td>${c.data.isGameOver ? 'DA' : 'NYET'}</td>
      </tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Visual Playtest — ${difficulty.toUpperCase()}</title>
  <style>
    body { background: #1a1a2e; color: #c62828; font-family: 'Courier New', monospace; margin: 20px; }
    h1 { color: #fbc02d; text-align: center; border-bottom: 2px solid #c62828; padding-bottom: 10px; }
    h2 { color: #00e676; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th { background: #c62828; color: #fbc02d; padding: 8px; text-align: left; font-size: 12px; }
    td { padding: 6px 8px; border-bottom: 1px solid #333; color: #e0e0e0; font-size: 12px; vertical-align: top; }
    tr:hover { background: #2a2e33; }
    img { border: 1px solid #444; border-radius: 4px; }
    .stats { color: #00e676; margin: 8px 0; }
  </style>
</head>
<body>
  <h1>VISUAL PLAYTEST REPORT — ${difficulty.toUpperCase()}</h1>
  <p class="stats">Captures: ${captures.length} | Difficulty: ${difficulty} | Max years: ${MAX_GAME_YEARS}</p>
  <table>
    <thead>
      <tr>
        <th>Screenshot</th><th>Trigger</th><th>Year</th><th>Pop</th>
        <th>Food</th><th>Vodka</th><th>Era</th><th>Settlement</th>
        <th>Threat</th><th>Marks</th><th>Game Over</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * Run a visual playtest for a given difficulty.
 * Polls the game state and captures screenshots on significant events.
 */
async function runVisualPlaytest(
  page: Awaited<ReturnType<typeof test.info>['_test']> extends never ? never : any,
  difficulty: 'worker' | 'comrade' | 'tovarish',
): Promise<void> {
  const dir = `${SCREENSHOT_DIR}/${difficulty}`;
  mkdirSync(dir, { recursive: true });

  // Start game with autopilot + turbo speed
  await startGameWithDifficulty(page, difficulty);
  await enableAutopilot(page);
  await dismissAnyModal(page);
  await setTurboSpeed(page);
  await dismissAnyModal(page);

  const captures: CaptureEntry[] = [];
  let seq = 0;
  let lastEra = '';
  let lastCaptureYear = START_YEAR;

  // Capture start screenshot
  const start = await captureGameSnapshot(page, dir, 'start', seq++);
  captures.push({ ...start, trigger: 'start' });
  lastEra = start.data.era;

  // Polling capture loop
  const endYear = START_YEAR + MAX_GAME_YEARS;

  while (true) {
    await page.waitForTimeout(POLL_INTERVAL_MS);

    // Dismiss any blocking modals (plan, era, annual report, etc.)
    await dismissAnyModal(page);

    // Check game over
    const gameOver = await isGameOverVisible(page);
    if (gameOver) {
      const snap = await captureGameSnapshot(page, dir, 'game-over', seq++);
      captures.push({ ...snap, trigger: 'game-over' });
      break;
    }

    const currentYear = await getGameYear(page);
    if (currentYear <= 0) continue;

    // Safety cap
    if (currentYear >= endYear) {
      const snap = await captureGameSnapshot(page, dir, 'end-cap', seq++);
      captures.push({ ...snap, trigger: 'end-cap' });
      break;
    }

    // Check for era change
    const state = await extractGameState(page);
    if (state.era && state.era !== lastEra && state.era !== '') {
      const snap = await captureGameSnapshot(page, dir, 'era-change', seq++);
      captures.push({ ...snap, trigger: `era-change: ${lastEra} → ${state.era}` });
      lastEra = state.era;
      lastCaptureYear = currentYear;
      continue;
    }

    // Capture at 5-year intervals
    if (currentYear - lastCaptureYear >= 5) {
      const snap = await captureGameSnapshot(page, dir, '5yr-interval', seq++);
      captures.push({ ...snap, trigger: '5-year interval' });
      lastCaptureYear = currentYear;
    }
  }

  // Generate HTML report
  const reportHtml = generateReport(difficulty, captures);
  writeFileSync(`${dir}/report.html`, reportHtml);

  // Basic assertions
  expect(captures.length).toBeGreaterThan(1);
  console.log(
    `[${difficulty}] Captured ${captures.length} snapshots, ` +
      `final year: ${captures[captures.length - 1]!.data.year}, ` +
      `final pop: ${captures[captures.length - 1]!.data.population}`,
  );
}

test.describe('Visual Playtest Capture', () => {
  // CI: rAF under SwiftShader cannot run game loop fast enough for playthroughs
  test.skip(!!process.env.CI, 'Visual playtest requires sustained turbo-speed game loop, unreliable on headless WebGL');

  test.beforeAll(() => {
    for (const level of ['worker', 'comrade', 'tovarish']) {
      mkdirSync(`${SCREENSHOT_DIR}/${level}`, { recursive: true });
    }
  });

  test('worker difficulty — visual playtest', async ({ page }) => {
    await runVisualPlaytest(page, 'worker');
  });

  test('comrade difficulty — visual playtest', async ({ page }) => {
    await runVisualPlaytest(page, 'comrade');
  });

  test('tovarish difficulty — visual playtest', async ({ page }) => {
    await runVisualPlaytest(page, 'tovarish');
  });
});
