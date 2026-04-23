import { createServer } from 'node:http';
import { mkdirSync, readFile, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(repoRoot, 'dist');
const artifactDir = resolve(repoRoot, 'e2e/artifacts/app-smoke/latest');
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
      res.writeHead(403);
      res.end('forbidden');
      return;
    }

    readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end(`not found: ${url}`);
        return;
      }
      res.writeHead(200, { 'content-type': mimeTypes[extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Unable to determine smoke server address.');
      }
      resolveServer({ server, url: `http://127.0.0.1:${address.port}${basePath}/` });
    });
  });
}

function assertSharedSmoke(diagnostics, pageErrors, networkFailures) {
  if (pageErrors.length > 0) {
    throw new Error(`Page errors:\n${pageErrors.join('\n')}`);
  }
  if (networkFailures.length > 0) {
    throw new Error(`Network failures:\n${networkFailures.join('\n')}`);
  }
  if (diagnostics.hasEngineMalfunction) {
    throw new Error('Engine malfunction fallback rendered.');
  }
  if (diagnostics.canvasCount < 1) {
    throw new Error('No canvas rendered.');
  }
  if (!diagnostics.canvases.some((canvas) => canvas.webgl && canvas.clientWidth > 0 && canvas.clientHeight > 0)) {
    throw new Error('No visible WebGL canvas detected.');
  }
  if (diagnostics.layout.scrollWidth > diagnostics.layout.innerWidth + 2) {
    throw new Error(
      `Document scrolls horizontally: ${diagnostics.layout.scrollWidth}px > ${diagnostics.layout.innerWidth}px`,
    );
  }
  if (diagnostics.layout.scrollHeight > diagnostics.layout.innerHeight + 2) {
    throw new Error(
      `Document scrolls vertically: ${diagnostics.layout.scrollHeight}px > ${diagnostics.layout.innerHeight}px`,
    );
  }
  if (!diagnostics.hasGameHud) {
    throw new Error('Game HUD text was not detected after starting campaign.');
  }
  if (diagnostics.hasMayorCopy) {
    throw new Error('Mayor copy is still visible in the app smoke.');
  }
  const disallowedOpeningCopy = /\b(KARDASHEV|COSMIC TAP|POST[- ]MONETARY|NUCLEAR-POWERED|ROCKET FUEL|QUANTUM|FASTER-THAN-LIGHT|AI)\b/i;
  if (disallowedOpeningCopy.test(diagnostics.bodyText)) {
    throw new Error(`Out-of-scope opening copy detected: ${diagnostics.visibleText}`);
  }
  const disallowed1917Copy =
    /\b(NATO|CIA|PENTAGON|WEST GERMANY|BONN|FREE WORLD|UN SUMMIT|SATELLITE|MISSILE|KGB|MINISTRY OF CULTURE|MINISTRY OF TRADE|MINISTRY OF HEALTH|MINISTRY OF LABOR|MINISTRY OF INTERNAL AFFAIRS|FIVE-YEAR PLAN)\b/i;
  if (diagnostics.bodyText.includes('OCT 1917') && disallowed1917Copy.test(diagnostics.bodyText)) {
    throw new Error(`1917 anachronistic opening copy detected: ${diagnostics.visibleText}`);
  }
}

function assertIntroSmoke(diagnostics, pageErrors, networkFailures) {
  assertSharedSmoke(diagnostics, pageErrors, networkFailures);
  if (!diagnostics.hasPredsedatelCopy) {
    throw new Error('Predsedatel intro copy was not visible.');
  }
}

function assertMenuSmoke(diagnostics, pageErrors, networkFailures) {
  if (pageErrors.length > 0) {
    throw new Error(`Page errors:\n${pageErrors.join('\n')}`);
  }
  if (networkFailures.length > 0) {
    throw new Error(`Network failures:\n${networkFailures.join('\n')}`);
  }
  if (diagnostics.layout.scrollWidth > diagnostics.layout.innerWidth + 2) {
    throw new Error(
      `Menu document scrolls horizontally: ${diagnostics.layout.scrollWidth}px > ${diagnostics.layout.innerWidth}px`,
    );
  }
  if (diagnostics.layout.scrollHeight > diagnostics.layout.innerHeight + 2) {
    throw new Error(
      `Menu document scrolls vertically: ${diagnostics.layout.scrollHeight}px > ${diagnostics.layout.innerHeight}px`,
    );
  }
  if (!diagnostics.hasCampaignLanding) {
    throw new Error(`Historical campaign landing copy was not detected: ${diagnostics.visibleText}`);
  }
  if (diagnostics.hasMayorCopy) {
    throw new Error('Mayor copy is still visible on the landing screen.');
  }
  if (diagnostics.hasPrototypeCopy) {
    throw new Error(`Prototype/demo wording is still visible on the landing screen: ${diagnostics.visibleText}`);
  }
  if (diagnostics.fonts && (!diagnostics.fonts.oswald || !diagnostics.fonts.ibmPlexMono)) {
    throw new Error(`Brand fonts did not load from local assets: ${JSON.stringify(diagnostics.fonts)}`);
  }
}

function assertPlayingSmoke(diagnostics, pageErrors, networkFailures) {
  assertSharedSmoke(diagnostics, pageErrors, networkFailures);
  if (diagnostics.hasIntroOverlay) {
    throw new Error('Intro overlay remained visible after accepting the chair.');
  }
  if ((diagnostics.ecs?.buildingCount ?? 0) < 1) {
    throw new Error('No ECS buildings or construction projects exist after opening play.');
  }
}

async function collectDiagnostics(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')].map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      let webgl = false;
      try {
        webgl = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
      } catch {
        webgl = false;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        clientWidth: Math.round(rect.width),
        clientHeight: Math.round(rect.height),
        webgl,
      };
    });

    const bodyText = document.body.innerText;
    const doc = document.documentElement;
    const body = document.body;
    const ecs = window.__ecsArchetypes
      ? {
          buildingCount: window.__ecsArchetypes.buildingCount,
          operationalCount: window.__ecsArchetypes.operationalCount,
          constructionCount: window.__ecsArchetypes.constructionCount,
          citizenCount: window.__ecsArchetypes.citizenCount,
          dvorCount: window.__ecsArchetypes.dvorCount,
          housingCount: window.__ecsArchetypes.housingCount,
          buildingPositions: window.__ecsArchetypes.buildingPositions,
        }
      : null;
    return {
      url: location.href,
      title: document.title,
      ecs,
      layout: {
        innerWidth,
        innerHeight,
        scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
        scrollHeight: Math.max(doc.scrollHeight, body.scrollHeight),
        clientWidth: doc.clientWidth,
        clientHeight: doc.clientHeight,
        bodyOverflow: getComputedStyle(body).overflow,
        htmlOverflow: getComputedStyle(doc).overflow,
      },
      bodyText: bodyText.slice(0, 2000),
      canvasCount: canvases.length,
      canvases,
      fonts:
        document.fonts && typeof document.fonts.check === 'function'
          ? {
              oswald: document.fonts.check('700 32px Oswald'),
              ibmPlexMono: document.fonts.check('600 14px "IBM Plex Mono"'),
            }
          : null,
      hasEngineMalfunction: bodyText.includes('ENGINE MALFUNCTION'),
      hasGameHud: bodyText.includes('FOOD') || bodyText.includes('POP'),
      hasCampaignLanding: bodyText.includes('Survive the Soviet Century') && bodyText.includes('Begin Historical Campaign'),
      hasPredsedatelCopy: bodyText.includes('Comrade Predsedatel') || bodyText.includes('PREDSEDATEL'),
      hasMayorCopy: /mayor/i.test(bodyText),
      hasPrototypeCopy: /\b(DEMO|POC|PROTOTYPE|IMPLEMENTATION DETAIL|V0\.1)\b/i.test(bodyText),
      hasIntroOverlay: bodyText.includes('ACCEPT THE CHAIR'),
      visibleText: bodyText.replace(/\s+/g, ' ').slice(0, 600),
    };
  });
}

async function main() {
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(artifactDir, { recursive: true });

  const { server, url } = await serveDist();
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHROME_CHANNEL || 'chrome',
    headless: process.env.PLAYWRIGHT_HEADLESS === '1',
  });

  const consoleEvents = [];
  const pageErrors = [];
  const networkFailures = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (msg) => consoleEvents.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(String(err.stack || err.message || err)));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('requestfailed', (request) => {
      networkFailures.push(`REQUEST FAILED ${request.url()} ${request.failure()?.errorText ?? ''}`.trim());
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.evaluate(() => document.fonts?.ready);
    await page.screenshot({ path: resolve(artifactDir, '00-menu.png'), fullPage: true });
    const menuDiagnostics = await collectDiagnostics(page);
    assertMenuSmoke(menuDiagnostics, pageErrors, networkFailures);
    await page.getByText('NEW GAME').click({ timeout: 30_000 });
    await page.getByText('BEGIN ASSIGNMENT').click({ timeout: 30_000 });
    await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0, null, { timeout: 60_000 });
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: resolve(artifactDir, '01-intro.png'), fullPage: true });
    const introDiagnostics = await collectDiagnostics(page);
    assertIntroSmoke(introDiagnostics, pageErrors, networkFailures);

    await page.getByText('ACCEPT THE CHAIR').click({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: resolve(artifactDir, '02-playing.png'), fullPage: true });
    const playingDiagnostics = await collectDiagnostics(page);
    assertPlayingSmoke(playingDiagnostics, pageErrors, networkFailures);

    const result = {
      menuDiagnostics,
      introDiagnostics,
      playingDiagnostics,
      consoleEvents: consoleEvents.slice(-80),
      pageErrors,
      networkFailures,
    };
    writeFileSync(resolve(artifactDir, 'diagnostics.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ menuDiagnostics, introDiagnostics, playingDiagnostics }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
