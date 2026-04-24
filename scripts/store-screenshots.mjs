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

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.evaluate(() => document.fonts?.ready);

    // ── Shot 1: Revolution opening (post-intro, HUD visible) ────────────
    await page.getByText('NEW GAME').click({ timeout: 30_000 });
    await page.getByText('BEGIN ASSIGNMENT').click({ timeout: 30_000 });
    await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0, null, { timeout: 60_000 });
    await page.waitForTimeout(6_000);
    await page.getByText('ACCEPT THE CHAIR').click({ timeout: 30_000 });
    await page.waitForTimeout(4_000);
    await page.screenshot({ path: resolve(outDir, '01-revolution-opening.png'), fullPage: false });
    console.log('✓ 01-revolution-opening');

    // ── Shot 2: Active quota + directive (let a few ticks pass) ─────────
    await page.waitForTimeout(8_000);
    await page.screenshot({ path: resolve(outDir, '02-active-quota-directive.png'), fullPage: false });
    console.log('✓ 02-active-quota-directive');

    // ── Shot 3: Government HQ open ───────────────────────────────────────
    // Click the "ГОСПЛАН HQ" button (id-stable text) in TopBar
    const hqButton = page.locator('text=/ГОСПЛАН|HQ/i').first();
    if (await hqButton.count() > 0) {
      await hqButton.click({ timeout: 10_000 });
      await page.waitForTimeout(2_000);
    }
    await page.screenshot({ path: resolve(outDir, '03-government-hq-open.png'), fullPage: false });
    console.log('✓ 03-government-hq-open');

    // Close HQ and advance to stagnation era (1982+)
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1_000);

    // ── Shot 4: Late era via engine advanceYears ────────────────────────
    // Access engine through a global bridge if exposed, otherwise use test hook
    const advanced = await page.evaluate(() => {
      const engine = window.__simEngine || window.__engine;
      if (engine && engine.getChronologyAgent) {
        try {
          engine.getChronologyAgent().advanceYears?.(70);
          return 'advanced 70 years';
        } catch (e) {
          return `advance error: ${String(e)}`;
        }
      }
      return 'no engine handle';
    });
    console.log(`engine advance: ${advanced}`);
    await page.waitForTimeout(4_000);
    await page.screenshot({ path: resolve(outDir, '04-late-era-stagnation.png'), fullPage: false });
    console.log('✓ 04-late-era-stagnation');

    // ── Shot 5: USSR dissolution modal (advance past 1991) ──────────────
    const advanced2 = await page.evaluate(() => {
      const engine = window.__simEngine || window.__engine;
      if (engine && engine.getChronologyAgent) {
        try {
          engine.getChronologyAgent().advanceYears?.(10);
          return 'advanced to 1991+';
        } catch (e) {
          return `advance2 error: ${String(e)}`;
        }
      }
      return 'no engine handle';
    });
    console.log(`engine advance 2: ${advanced2}`);
    await page.waitForTimeout(4_000);
    await page.screenshot({ path: resolve(outDir, '05-ussr-dissolution.png'), fullPage: false });
    console.log('✓ 05-ussr-dissolution');

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
