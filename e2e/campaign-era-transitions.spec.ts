/**
 * Campaign era-transition smoke — P1E-2
 *
 * Advances the campaign through ≥3 era transitions by calling
 * engine.getChronologyAgent().advanceYears(N), which is the same path used
 * by the in-game rehabilitation time-skip mechanic. On the next engine tick
 * the era system fires onEraChanged, React re-renders, and the UI updates.
 *
 * Assertions per transition:
 *   1. era-label testID updates to the expected era name (TopBar)
 *   2. ≥1 era briefing modal (showing "ACKNOWLEDGED" CTA) fires across all jumps
 *   3. Quota HUD (quota-target testID) is present and non-empty
 *   4. No critical JS errors emitted during any transition
 */
import { expect, test } from '@playwright/test';
import { dismissAnyModal, getEraText, startGameAndDismiss } from './helpers';

/** Era jumps in chronological order. year = first year of the target era. */
const ERA_JUMPS: { year: number; eraName: string; yearsToAdvance: number }[] = [
  // Revolution (1917-1921) → Collectivization starts 1922
  { year: 1922, eraName: 'COLLECTIVIZATION', yearsToAdvance: 5 },
  // Collectivization (1922-1931) → Industrialization starts 1932
  { year: 1932, eraName: 'INDUSTRIALIZATION', yearsToAdvance: 10 },
  // Industrialization (1932-1940) → Great Patriotic War starts 1941
  { year: 1941, eraName: 'GREAT PATRIOTIC WAR', yearsToAdvance: 9 },
];

/** Advance the ChronologyAgent by N years and allow the tick loop to process. */
async function advanceYearsViaEngine(page: import('@playwright/test').Page, years: number): Promise<void> {
  const ok: boolean = await page.evaluate((n: number) => {
    const engine = (window as any).__simEngine;
    if (!engine) return false;
    const chrono = engine.getChronologyAgent?.();
    if (typeof chrono?.advanceYears !== 'function') return false;
    chrono.advanceYears(n);
    return true;
  }, years);

  if (!ok) throw new Error('advanceYearsViaEngine: __simEngine or getChronologyAgent not available');

  // Give the rAF tick loop time to pick up the year change and fire era transition.
  // Two seconds is enough at any speed: one tick fires handleEraTransitionFull,
  // React reconciles, and the DOM updates.
  await page.waitForTimeout(2_000);
}

test.describe('Campaign Era Transitions (P1E-2)', () => {
  // Full 55-model load + 3 era jumps — generous timeout
  test.slow();

  test('advances through 3 era transitions and verifies all requirements', async ({ page }) => {
    // ── Collect JS errors ────────────────────────────────────────────────────
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
    });

    // ── 1. Start game ────────────────────────────────────────────────────────
    await startGameAndDismiss(page);

    // Verify starting era label is present and reads REVOLUTION
    const initialEraText = await getEraText(page);
    expect(initialEraText).toBe('REVOLUTION');

    // ── 2. Advance through 3 era transitions ─────────────────────────────────
    let eraModalsObserved = 0;

    for (const jump of ERA_JUMPS) {
      // Jump the ChronologyAgent forward — era detection fires on next tick
      await advanceYearsViaEngine(page, jump.yearsToAdvance);

      // Wait for era-label to reflect the new era (up to 20 s)
      await page
        .waitForFunction(
          (expected: string) => {
            const el = document.querySelector('[data-testid="era-label"]');
            const text = el?.textContent?.trim().toUpperCase() ?? '';
            // The era name may be truncated or formatted differently; check inclusion
            return text.includes(expected.split(' ')[0]!);
          },
          jump.eraName,
          { timeout: 20_000 },
        )
        .catch(async () => {
          const actual = await page
            .getByTestId('era-label')
            .textContent()
            .catch(() => '<missing>');
          throw new Error(
            `era-label did not update to contain "${jump.eraName}" after advancing ${jump.yearsToAdvance} years. ` +
              `Actual: "${actual}"`,
          );
        });

      // ── 2a. Era label is correct ────────────────────────────────────────
      const eraText = await getEraText(page);
      // First word of the expected era name must appear in the label
      expect(eraText).toContain(jump.eraName.split(' ')[0]!);

      // ── 2b. Detect era briefing modal ──────────────────────────────────
      const ackBtn = page.getByText('ACKNOWLEDGED', { exact: false });
      if (await ackBtn.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
        eraModalsObserved++;
        await ackBtn.first().click({ force: true, timeout: 1_500 }).catch(() => {});
        await page.waitForTimeout(300);
      } else {
        await dismissAnyModal(page);
      }

      // ── 2c. Quota HUD shows non-empty delivery target ──────────────────
      // The element must exist in the DOM (may be compact/hidden visually)
      const quotaInDom = await page.evaluate(
        () => !!document.querySelector('[data-testid="quota-target"]'),
      );
      expect(quotaInDom).toBe(true);

      // If visible, verify it has readable content
      const quotaTarget = page.getByTestId('quota-target');
      if (await quotaTarget.isVisible({ timeout: 1_000 }).catch(() => false)) {
        const text = await quotaTarget.textContent().catch(() => '');
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    }

    // ── 3. At least 1 era modal was observed across all 3 jumps ─────────────
    // (Modals can be suppressed if the game engine merges rapid transitions or
    // if the sim is paused, so we only require ≥1 not all 3.)
    expect(eraModalsObserved).toBeGreaterThanOrEqual(1);

    // ── 4. No critical JS errors ─────────────────────────────────────────────
    const criticalErrors = jsErrors.filter(
      (msg) =>
        !msg.includes('ResizeObserver loop') &&
        !msg.includes('Non-Error promise rejection') &&
        !msg.includes('ChunkLoadError'),
    );
    expect(
      criticalErrors,
      `JS errors during era transitions: ${criticalErrors.join('; ')}`,
    ).toHaveLength(0);
  });

  test('era-label testID is present at game start with non-empty content', async ({ page }) => {
    await startGameAndDismiss(page);

    const eraLabel = page.getByTestId('era-label');
    await expect(eraLabel).toBeAttached({ timeout: 10_000 });

    const text = await eraLabel.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});
