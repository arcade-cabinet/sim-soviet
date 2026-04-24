/**
 * polish-audit-screenshots.mjs — Visual QA audit screenshots for pre-1.0 polish pass.
 *
 * Captures desktop (1920x1080) and mobile (375x812) views of all major screens.
 * Uses the same dist + static-server + playwright pattern as store-screenshots.mjs.
 *
 * Output: /tmp/polish-audit/*.png
 *
 * Run AFTER `pnpm run build`.
 */

import { createServer } from 'node:http';
import { mkdirSync, readFile, rmSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(repoRoot, 'dist');
const outDir = '/tmp/polish-audit';
const basePath = '/sim-soviet';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.hdr': 'application/octet-stream',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
};

function serveDist() {
  const server = createServer((req, res) => {
    let url = (req.url || '/').split('?')[0] || '/';
    if (url === '/' || url === basePath || url === `${basePath}/`) {
      url = `${basePath}/index.html`;
    }
    if (url.startsWith(`${basePath}/`)) {
      url = url.slice(basePath.length);
    }
    const file = normalize(join(distRoot, url));
    if (!file.startsWith(distRoot)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }
    readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': mimeTypes[extname(file)] || 'application/octet-stream',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'credentialless',
      });
      res.end(data);
    });
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolveServer({ server, url: `http://127.0.0.1:${addr.port}${basePath}/` });
    });
  });
}

async function shot(page, name, description) {
  const path = resolve(outDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  ✓ ${name} — ${description}`);
  return path;
}

async function navigateToGame(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.evaluate(() => document.fonts?.ready);
}

async function startNewGame(page) {
  await page.getByText('NEW GAME').click({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.getByText('BEGIN ASSIGNMENT').click({ timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0, null, { timeout: 60_000 });
  await page.waitForTimeout(6_000);
  const acceptBtn = page.getByText('ACCEPT THE CHAIR');
  if (await acceptBtn.count() > 0) {
    await acceptBtn.click({ timeout: 10_000 });
    await page.waitForTimeout(3_000);
  }
}

async function openGovernmentHQ(page) {
  // Try clicking ГОСПЛАН HQ button in TopBar
  const hqBtn = page.locator('[style*="hqBtn"], text=/ГОСПЛАН/').first();
  if (await hqBtn.count() > 0) {
    await hqBtn.click({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    return true;
  }
  // Fallback: look for the HQ sub-label
  const hqSub = page.getByText('HQ', { exact: true }).first();
  if (await hqSub.count() > 0) {
    await hqSub.click({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    return true;
  }
  return false;
}

async function clickTab(page, tabLabel) {
  const tab = page.getByText(tabLabel, { exact: false }).first();
  if (await tab.count() > 0) {
    await tab.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function dismissAnyPanel(page) {
  // Press Escape repeatedly to dismiss overlays
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
  }
  // Also try pressing close buttons
  const closeButtons = ['CLOSE', 'BACK', '✕', '×'];
  for (const label of closeButtons) {
    const btn = page.getByText(label, { exact: true }).first();
    if (await btn.count() > 0) {
      await btn.click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }
  await page.waitForTimeout(500);
}

async function clickOverflowButton(page) {
  // The overflow button has text ≡ (U+2261) and is in the TopBar
  // Try by content
  const byText = page.getByText('≡', { exact: true }).last();
  if (await byText.count() > 0) {
    try {
      // Use force: true to bypass intercept issues
      await byText.click({ timeout: 5_000, force: true });
      await page.waitForTimeout(600);
      return true;
    } catch (_) {}
  }
  return false;
}

async function openOverflowAndSelectByForce(page, label) {
  await clickOverflowButton(page);
  const item = page.getByText(label, { exact: false }).first();
  if (await item.count() > 0) {
    await item.click({ timeout: 5_000, force: true }).catch(() => {});
    await page.waitForTimeout(1_000);
    return true;
  }
  return false;
}

async function main() {
  // Don't wipe existing shots — just add new ones
  mkdirSync(outDir, { recursive: true });
  console.log(`Output: ${outDir}`);

  const { server, url } = await serveDist();
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHROME_CHANNEL || 'chrome',
    headless: true,
  });

  const pageErrors = [];

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // CONTINUE: Settlement panels, settings, dissolution, mobile
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- DESKTOP: Settlement panels ---');
    const desktop2 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    desktop2.on('pageerror', (e) => pageErrors.push(`[desktop2] ${String(e)}`));

    await navigateToGame(desktop2, url);
    await startNewGame(desktop2);
    await desktop2.waitForTimeout(6_000); // let sim run

    // Settlement panel
    const settlOpened = await openOverflowAndSelectByForce(desktop2, 'SETTLEMENT');
    if (settlOpened) {
      await shot(desktop2, '13-settlement-panel-desktop', 'Settlement progress panel');
      await dismissAnyPanel(desktop2);
    } else {
      console.log('  ~ SETTLEMENT panel not reachable');
    }

    // Economy panel
    const econOpened = await openOverflowAndSelectByForce(desktop2, 'ECONOMY');
    if (econOpened) {
      await shot(desktop2, '14-economy-panel-desktop', 'Economy panel');
      await dismissAnyPanel(desktop2);
    } else {
      console.log('  ~ ECONOMY panel not reachable');
    }

    // Worker panel
    const workOpened = await openOverflowAndSelectByForce(desktop2, 'WORKERS');
    if (workOpened) {
      await shot(desktop2, '14b-workers-panel-desktop', 'Workers panel');
      await dismissAnyPanel(desktop2);
    }

    // Mandates
    const mandOpened = await openOverflowAndSelectByForce(desktop2, 'MANDATES');
    if (mandOpened) {
      await shot(desktop2, '14c-mandates-panel-desktop', 'Mandates panel');
      await dismissAnyPanel(desktop2);
    }

    // Infrastructure
    const infraOpened = await openOverflowAndSelectByForce(desktop2, 'INFRASTRUCTURE');
    if (infraOpened) {
      await shot(desktop2, '14d-infra-panel-desktop', 'Infrastructure panel');
      await dismissAnyPanel(desktop2);
    }

    // Politburo (probably tier-locked, try anyway)
    const polbOpened = await openOverflowAndSelectByForce(desktop2, 'POLITBURO');
    if (polbOpened) {
      await shot(desktop2, '14e-politburo-panel-desktop', 'Politburo panel');
      await dismissAnyPanel(desktop2);
    }

    // Pravda
    const pravdaOpened = await openOverflowAndSelectByForce(desktop2, 'PRAVDA');
    if (pravdaOpened) {
      await shot(desktop2, '14f-pravda-panel-desktop', 'Pravda archive panel');
      await dismissAnyPanel(desktop2);
    }

    // Save/Load
    const saveOpened = await openOverflowAndSelectByForce(desktop2, 'SAVE');
    if (saveOpened) {
      await shot(desktop2, '14g-saveload-panel-desktop', 'Save/Load panel');
      await dismissAnyPanel(desktop2);
    }

    // Leadership
    const leadOpened = await openOverflowAndSelectByForce(desktop2, 'LEADERSHIP');
    if (leadOpened) {
      await shot(desktop2, '14h-leadership-panel-desktop', 'Leadership panel');
      await dismissAnyPanel(desktop2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Settings modal
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Settings ---');
    const desktop3 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await navigateToGame(desktop3, url);
    await desktop3.waitForTimeout(800);
    const settingsBtn = desktop3.getByText('SETTINGS');
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click({ timeout: 10_000 });
      await desktop3.waitForTimeout(1_000);
      await shot(desktop3, '15-settings-modal-desktop', 'Settings modal from main menu');
    } else {
      console.log('  ~ Settings button not found');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dissolution modal
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Dissolution ---');
    const desktop4 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    desktop4.on('pageerror', (e) => pageErrors.push(`[desktop4] ${String(e)}`));
    await navigateToGame(desktop4, url);
    await startNewGame(desktop4);
    await desktop4.waitForTimeout(3_000);

    const advResult = await desktop4.evaluate(() => {
      try {
        const eng = window.__simEngine || window.__engine;
        if (eng?.getChronologyAgent) {
          eng.getChronologyAgent().advanceYears?.(80);
          return 'advanced 80 years';
        }
        return 'no engine handle';
      } catch (e) {
        return `error: ${e}`;
      }
    });
    console.log(`  engine advance: ${advResult}`);
    await desktop4.waitForTimeout(6_000);
    await shot(desktop4, '16-dissolution-desktop', 'USSR Dissolution modal or stagnation era');

    // Try clicking continue
    const continueBtn = desktop4.getByText('CONTINUE FREE PLAY');
    if (await continueBtn.count() > 0) {
      await continueBtn.click({ timeout: 10_000 });
      await desktop4.waitForTimeout(3_000);
      await shot(desktop4, '17-post-dissolution-desktop', 'Post-dissolution free play state');
    } else {
      // Try END ASSIGNMENT
      const endBtn = desktop4.getByText('END ASSIGNMENT');
      if (await endBtn.count() > 0) {
        await shot(desktop4, '16b-dissolution-modal-desktop', 'Dissolution modal visible');
        await endBtn.click({ timeout: 10_000 }).catch(() => {});
        await desktop4.waitForTimeout(2_000);
        await shot(desktop4, '17-post-dissolution-desktop', 'After END ASSIGNMENT');
      } else {
        console.log('  ~ Dissolution modal not visible, capturing era state');
        await shot(desktop4, '17-late-era-desktop', 'Late era state (no dissolution modal)');
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MOBILE (375x812)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- MOBILE 375×812 ---');
    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
    mobile.on('pageerror', (e) => pageErrors.push(`[mobile] ${String(e)}`));

    await navigateToGame(mobile, url);
    await shot(mobile, 'M01-main-menu-mobile', 'Mobile: MainMenu landing');

    // NewGameSetup
    await mobile.getByText('NEW GAME').click({ timeout: 30_000 });
    await mobile.waitForTimeout(400);
    await shot(mobile, 'M02-new-game-setup-mobile', 'Mobile: NewGameSetup');

    // Game HUD
    await mobile.getByText('BEGIN ASSIGNMENT').click({ timeout: 30_000 });
    await mobile.waitForFunction(() => document.querySelectorAll('canvas').length > 0, null, { timeout: 60_000 });
    await mobile.waitForTimeout(6_000);
    const mobileAccept = mobile.getByText('ACCEPT THE CHAIR');
    if (await mobileAccept.count() > 0) {
      await mobileAccept.click({ timeout: 10_000 });
      await mobile.waitForTimeout(3_000);
    }
    await shot(mobile, 'M03-hud-tick0-mobile', 'Mobile: HUD at tick 0');

    // Let sim run a bit
    await mobile.waitForTimeout(6_000);
    await shot(mobile, 'M03b-hud-running-mobile', 'Mobile: HUD after 6 months');

    // Government HQ
    const mHQOpened = await openGovernmentHQ(mobile);
    if (mHQOpened) {
      await shot(mobile, 'M04-hq-mobile', 'Mobile: Government HQ open');
      await dismissAnyPanel(mobile);
    }

    // Overflow menu open
    const mOverflowOpened = await clickOverflowButton(mobile);
    if (mOverflowOpened) {
      await shot(mobile, 'M05-overflow-mobile', 'Mobile: Overflow menu open');
      await dismissAnyPanel(mobile);
    }

    // Mobile: Economy panel via overflow
    const mEconOpened = await openOverflowAndSelectByForce(mobile, 'ECONOMY');
    if (mEconOpened) {
      await shot(mobile, 'M06-economy-mobile', 'Mobile: Economy panel');
      await dismissAnyPanel(mobile);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Error summary
    // ─────────────────────────────────────────────────────────────────────────
    if (pageErrors.length > 0) {
      console.log('\n=== Page/console errors ===');
      for (const e of pageErrors.slice(0, 15)) {
        console.warn('  ' + e.slice(0, 300));
      }
    }

    console.log(`\nDone. All screenshots in ${outDir}/`);

  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
