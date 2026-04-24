/**
 * store-screenshots.mjs — Capture 5 store-facing screenshots for P1D-1.
 *
 * Uses the same dist + static-server + playwright pattern as smoke-export.mjs.
 *
 * Produces:
 *   docs/screenshots/store/01-revolution-opening.png
 *   docs/screenshots/store/02-active-quota-directive.png
 *   docs/screenshots/store/03-government-hq-open.png
 *   docs/screenshots/store/04-late-era-stagnation.png
 *   docs/screenshots/store/05-ussr-dissolution.png
 *
 * Requires a production build — run `pnpm run build` first.
 */

import { createServer } from 'node:http';
import { mkdirSync, readFile, rmSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(repoRoot, 'dist');
const outDir = resolve(repoRoot, 'docs/screenshots/store');
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

async function main() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const { server, url } = await serveDist();
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHROME_CHANNEL || 'chrome',
    headless: process.env.PLAYWRIGHT_HEADLESS === '1',
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    // Screenshot helper with generous timeout; animations/rAF can race the
    // default 30s capture window on a loaded scene.
    const snap = async (name) => {
      await page.screenshot({ path: resolve(outDir, name), fullPage: false, timeout: 60_000 });
      console.log(`✓ ${name}`);
    };

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.evaluate(() => document.fonts?.ready);

    // ── Shot 1: Revolution opening (post-intro, HUD visible) ────────────
    await page.getByText('NEW GAME').click({ timeout: 30_000 });
    await page.getByText('BEGIN ASSIGNMENT').click({ timeout: 30_000 });
    await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0, null, { timeout: 60_000 });
    await page.waitForTimeout(6_000);
    await page.getByText('ACCEPT THE CHAIR').click({ timeout: 30_000 });
    await page.waitForTimeout(4_000);
    await snap('01-revolution-opening.png');

    // ── Shot 2: Active quota + directive (let a few ticks pass) ─────────
    await page.waitForTimeout(8_000);
    await snap('02-active-quota-directive.png');

    // ── Shot 3: Government HQ open ───────────────────────────────────────
    // Click the "ГОСПЛАН HQ" button (id-stable text) in TopBar
    const hqButton = page.locator('text=/ГОСПЛАН|HQ/i').first();
    if ((await hqButton.count()) > 0) {
      await hqButton.click({ timeout: 10_000 });
      await page.waitForTimeout(2_000);
    }
    await snap('03-government-hq-open.png');

    // Close HQ and advance through eras via ticks (so era transitions + the
    // 1991 dissolution check actually fire in phaseChronology).
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1_000);

    // ── Shot 4: Late era (1982 — stagnation) ─────────────────────────────
    // advanceYears() jumps the calendar but does NOT tick phases, so it
    // cannot trigger dissolution. Instead, advance to 1982 then tick for
    // a few more to let stagnation events populate.
    const advanced = await page.evaluate(() => {
      const engine = window.__simEngine;
      if (!engine) return 'no engine handle';
      engine.getChronologyAgent().advanceYears(65); // 1917 -> 1982
      // Tick a few times to let stagnation events/modifiers fire
      for (let i = 0; i < 20; i++) engine.tick();
      return 'advanced to 1982 + 20 ticks';
    });
    console.log(`engine advance: ${advanced}`);
    await page.waitForTimeout(3_000);
    await snap('04-late-era-stagnation.png');

    // ── Shot 5: USSR dissolution modal ────────────────────────────────────
    // Need to be AT year 1991 when a tick fires for maybeCompleteHistoricalCampaign
    // to trigger. Advance 9 years via calendar skip, then tick to fire the
    // chronology phase. Wait for the modal DOM.
    const advanced2 = await page.evaluate(() => {
      const engine = window.__simEngine;
      if (!engine) return 'no engine handle';
      engine.getChronologyAgent().advanceYears(9); // 1982 -> 1991
      // Tick a few times so phaseChronology runs and fires the completion check
      for (let i = 0; i < 10; i++) engine.tick();
      return 'advanced to 1991 + 10 ticks';
    });
    console.log(`engine advance 2: ${advanced2}`);
    // Wait for the dissolution modal to appear if it fired
    await page
      .waitForFunction(() => document.body.innerText.includes('THE UNION HAS DISSOLVED'), null, { timeout: 10_000 })
      .catch(() => console.log('  (dissolution modal did not appear within 10s)'));
    await page.waitForTimeout(2_000);
    await snap('05-ussr-dissolution.png');

    if (pageErrors.length > 0) {
      console.warn('Page errors observed (non-fatal):');
      for (const e of pageErrors.slice(0, 5)) console.warn('  ' + e.slice(0, 200));
    }

    console.log('\nAll 5 screenshots written to', outDir);
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
