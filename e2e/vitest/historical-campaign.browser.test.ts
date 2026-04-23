import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { page, server } from 'vitest/browser';
import { buildingsLogic, getMetaEntity, getResourceEntity, operationalBuildings, underConstruction } from '@/ecs/archetypes';
import { resetAllSingletons } from '@/bridge/Reset';
import { getEngine, initGame, shutdownSaveSystem } from '@/bridge/GameInit';
import type { SimCallbacks } from '@/game/engine/types';
import { ERA_DEFINITIONS, ERA_ORDER } from '@/game/era';
import { gameState } from '@/engine/GameState';

const ARTIFACT_DIR = 'e2e/artifacts/vitest-historical/latest';
const SCREENSHOT_DIR_FROM_TEST = '../artifacts/vitest-historical/latest';
const TARGET_YEAR = 1995;
const CHECKPOINT_YEARS = [1917, 1927, 1937, 1941, 1945, 1953, 1964, 1982, 1991, 1992, 1995];
const REMOVED_RUNTIME_IDS = [
  'the_eternal',
  'kardashev',
  'type_one',
  'type_two',
  'dyson',
  'mars',
  'lunar',
  'oneill',
  'post_scarcity',
  'freeform',
];

interface ProofEvent {
  type: string;
  year: number;
  message: string;
}

interface ProofDiagnostics {
  label: string;
  year: number;
  month: number;
  totalTicks: number;
  era: string;
  eraName: string;
  eraEndYear: number;
  gameMode: string;
  ended: boolean;
  postCampaignFreePlay: boolean;
  historicalCompletionCount: number;
  population: number;
  food: number;
  vodka: number;
  timber: number;
  steel: number;
  cement: number;
  power: number;
  blat: number;
  quotaType: string;
  quotaCurrent: number;
  quotaTarget: number;
  quotaDeadlineYear: number;
  consecutiveQuotaFailures: number;
  buildings: number;
  operationalBuildings: number;
  underConstruction: number;
  constructionSites: Array<{
    defId: string;
    phase: string;
    progress: number;
    ticks: number;
    x: number;
    y: number;
  }>;
  settlementTier: string;
  threatLevel: string;
  blackMarks: number;
  commendations: number;
  activeCrises: string[];
  eraOrder: readonly string[];
  events: ProofEvent[];
}

const proofEvents: ProofEvent[] = [];
let historicalCompletionCount = 0;
let warnSpy: ReturnType<typeof vi.spyOn> | null = null;

function record(type: string, message: string): void {
  const year = getEngine()?.getChronology().getDate().year ?? getMetaEntity()?.gameMeta.date.year ?? 1917;
  proofEvents.push({ type, year, message });
}

function finiteRounded(label: string, value: number | undefined): number {
  const rounded = Math.round(value ?? 0);
  if (!Number.isFinite(rounded)) {
    throw new Error(`Non-finite diagnostic value for ${label}: ${String(value)}`);
  }
  return rounded;
}

function callbacks(): SimCallbacks {
  return {
    onToast: (msg) => record('toast', msg),
    onAdvisor: (msg) => record('advisor', msg),
    onPravda: (msg) => record('pravda', msg),
    onStateChange: () => {
      gameState.notify();
    },
    onGameOver: (_victory, reason) => record('game-over', reason),
    onSeasonChanged: (season) => record('season', season),
    onEraChanged: (era) => record('era', era.id),
    onAnnualReport: (data, submitReport) => {
      record('annual-report', `${data.year}:${data.quotaType}:${data.quotaCurrent}/${data.quotaTarget}`);
      submitReport({
        reportedQuota: data.quotaCurrent,
        reportedSecondary: data.quotaType === 'food' ? data.actualVodka : data.actualFood,
        reportedPop: data.actualPop,
      });
    },
    onMinigame: (active, resolveChoice) => {
      const choiceId = active.definition.choices[0]?.id ?? '';
      record('minigame', `${active.definition.id}:${choiceId}`);
      resolveChoice(choiceId);
    },
    onHistoricalEraEnd: (resolve) => {
      historicalCompletionCount += 1;
      record('historical-complete', '1991 campaign endpoint reached; continuing grounded free play');
      resolve(true);
    },
  };
}

function collectDiagnostics(label: string): ProofDiagnostics {
  const engine = getEngine();
  if (!engine) throw new Error('Simulation engine was not initialized');

  const date = engine.getChronology().getDate();
  const resources = getResourceEntity()?.resources;
  const personnel = engine.getPersonnelFile();
  const era = engine.getEraSystem().getCurrentEraId();
  const eraDefinition = ERA_DEFINITIONS[era];
  const activeCrises = engine.getGovernor()?.getActiveCrises() ?? [];
  const postCampaignFreePlay =
    Boolean((engine as unknown as { historicalCompletionFired?: boolean }).historicalCompletionFired) &&
    date.year > 1991 &&
    !(engine as unknown as { ended?: boolean }).ended;

  return {
    label,
    year: date.year,
    month: date.month,
    totalTicks: date.totalTicks,
    era,
    eraName: eraDefinition.name,
    eraEndYear: eraDefinition.endYear,
    gameMode: (engine as unknown as { gameMode?: string }).gameMode ?? 'unknown',
    ended: Boolean((engine as unknown as { ended?: boolean }).ended),
    postCampaignFreePlay,
    historicalCompletionCount,
    population: finiteRounded('population', resources?.population),
    food: finiteRounded('food', resources?.food),
    vodka: finiteRounded('vodka', resources?.vodka),
    timber: finiteRounded('timber', resources?.timber),
    steel: finiteRounded('steel', resources?.steel),
    cement: finiteRounded('cement', resources?.cement),
    power: finiteRounded('power', resources?.power),
    blat: finiteRounded('blat', resources?.blat),
    quotaType: engine.getQuota().type,
    quotaCurrent: finiteRounded('quotaCurrent', engine.getQuota().current),
    quotaTarget: finiteRounded('quotaTarget', engine.getQuota().target),
    quotaDeadlineYear: engine.getQuota().deadlineYear,
    consecutiveQuotaFailures:
      (engine as unknown as { consecutiveQuotaFailures?: number }).consecutiveQuotaFailures ?? 0,
    buildings: buildingsLogic.entities.length,
    operationalBuildings: operationalBuildings.entities.length,
    underConstruction: underConstruction.entities.length,
    constructionSites: underConstruction.entities.map((entity) => ({
      defId: entity.building.defId,
      phase: entity.building.constructionPhase ?? 'unknown',
      progress: Number((entity.building.constructionProgress ?? 0).toFixed(3)),
      ticks: entity.building.constructionTicks ?? 0,
      x: entity.position.gridX,
      y: entity.position.gridY,
    })),
    settlementTier: engine.getSettlement().getCurrentTier(),
    threatLevel: personnel.getThreatLevel(),
    blackMarks: personnel.getBlackMarks(),
    commendations: personnel.getCommendations(),
    activeCrises,
    eraOrder: ERA_ORDER,
    events: proofEvents.slice(-16),
  };
}

function renderDiagnostics(diag: ProofDiagnostics): void {
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#080807';
  document.body.style.color = '#e8e0c6';
  document.body.style.fontFamily = 'Menlo, Consolas, monospace';

  const root = document.createElement('main');
  root.id = 'historical-proof-root';
  Object.assign(root.style, {
    width: '100vw',
    height: '100vh',
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    gap: '24px',
    padding: '28px',
    boxSizing: 'border-box',
    background: 'linear-gradient(135deg, #11110f 0%, #16120f 55%, #210b0b 100%)',
  });

  const status = diag.ended ? 'ENDED' : diag.postCampaignFreePlay ? 'GROUNDED FREE PLAY' : 'HISTORICAL CAMPAIGN';
  const eventLines = diag.events.map((event) => `${event.year} ${event.type}: ${event.message}`).join('\n');

  root.innerHTML = `
    <section>
      <div style="color:#c62828;font-size:13px;letter-spacing:2px;margin-bottom:10px;">SIMSOVIET 1.0 AUTOMATED PROOF RUN</div>
      <h1 style="margin:0 0 14px;font-size:36px;line-height:1.05;color:#f5d76e;">${diag.year} ${diag.eraName}</h1>
      <div style="font-size:16px;color:#9be078;margin-bottom:24px;">${status}</div>
      <pre style="font-size:15px;line-height:1.55;margin:0;color:#e8e0c6;">Population: ${diag.population}
Food:       ${diag.food}
Vodka:      ${diag.vodka}
Timber:     ${diag.timber}
Steel:      ${diag.steel}
Cement:     ${diag.cement}
Power:      ${diag.power}
Blat:       ${diag.blat}
Buildings:  ${diag.buildings} (${diag.operationalBuildings} operational)
Building:   ${diag.underConstruction} under construction
Settlement: ${diag.settlementTier}
Threat:     ${diag.threatLevel} | Marks ${diag.blackMarks} | Commendations ${diag.commendations}</pre>
    </section>
    <section style="border-left:1px solid rgba(245,215,110,.35);padding-left:24px;">
      <div style="font-size:13px;color:#f5d76e;margin-bottom:10px;">DIAGNOSTIC STATE</div>
      <pre style="white-space:pre-wrap;font-size:12px;line-height:1.45;color:#b9c0a2;margin:0;">Label: ${diag.label}
Month: ${diag.month}
Total ticks: ${diag.totalTicks}
Game mode: ${diag.gameMode}
Era id: ${diag.era}
Final campaign era end: ${diag.eraEndYear}
1991 completion count: ${diag.historicalCompletionCount}
Post-campaign flag: ${diag.postCampaignFreePlay}
Active crises: ${diag.activeCrises.join(', ') || 'none'}
Quota: ${diag.quotaType} ${diag.quotaCurrent}/${diag.quotaTarget} due ${diag.quotaDeadlineYear} | Failures ${diag.consecutiveQuotaFailures}
Construction sites: ${diag.constructionSites.map((site) => `${site.defId}:${site.phase}:${Math.round(site.progress * 100)}%`).join(', ') || 'none'}
Era order: ${diag.eraOrder.join(' -> ')}

Recent events:
${eventLines || 'none yet'}</pre>
    </section>
  `;

  document.body.appendChild(root);
}

async function writeDiagnostics(diag: ProofDiagnostics, sequence: number): Promise<string> {
  const filename = `${String(sequence).padStart(2, '0')}-${diag.label}-y${diag.year}.json`;
  await server.commands.writeFile(`${ARTIFACT_DIR}/${filename}`, JSON.stringify(diag, null, 2));
  return `${ARTIFACT_DIR}/${filename}`;
}

async function captureCheckpoint(label: string, sequence: number): Promise<ProofDiagnostics> {
  const diag = collectDiagnostics(label);
  renderDiagnostics(diag);
  await page.mark(`checkpoint:${label}:year-${diag.year}`);
  await writeDiagnostics(diag, sequence);
  await page.screenshot({
    path: `${SCREENSHOT_DIR_FROM_TEST}/${String(sequence).padStart(2, '0')}-${label}-y${diag.year}.png`,
  });
  return diag;
}

describe('historical Soviet campaign browser proof run', () => {
  beforeAll(async () => {
    await page.viewport(1280, 720);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      const first = String(args[0] ?? '');
      if (first.includes('YUKA.MessageDispatcher')) return;
      console.error(...args);
    });
    resetAllSingletons();
    historicalCompletionCount = 0;
    proofEvents.length = 0;
    initGame(callbacks(), {
      seed: 'vitest-historical-1-0-proof',
      consequence: 'rehabilitated',
      autosave: false,
    });
  });

  afterAll(() => {
    shutdownSaveSystem();
    resetAllSingletons();
    warnSpy?.mockRestore();
    warnSpy = null;
  });

  it('runs 1917 through 1991 once, then continues grounded free play with artifacts', async () => {
    let sequence = 0;
    let checkpointIndex = 0;
    const captured: ProofDiagnostics[] = [];

    captured.push(await captureCheckpoint('start', sequence++));
    checkpointIndex = 1;

    const engine = getEngine();
    if (!engine) throw new Error('Simulation engine was not initialized');

    for (let guard = 0; guard < 30_000; guard++) {
      engine.tick();
      const diag = collectDiagnostics('poll');

      while (checkpointIndex < CHECKPOINT_YEARS.length && diag.year >= CHECKPOINT_YEARS[checkpointIndex]!) {
        const year = CHECKPOINT_YEARS[checkpointIndex]!;
        captured.push(await captureCheckpoint(`checkpoint-${year}`, sequence++));
        checkpointIndex += 1;
      }

      if (diag.ended || diag.year >= TARGET_YEAR) break;
    }

    const finalDiag = await captureCheckpoint('final', sequence++);
    const manifest = {
      targetYear: TARGET_YEAR,
      completedAt: new Date().toISOString(),
      checkpointYears: CHECKPOINT_YEARS,
      screenshotCount: sequence,
      final: finalDiag,
      captured: captured.map((diag) => ({
        label: diag.label,
        year: diag.year,
        era: diag.era,
        population: diag.population,
        buildings: diag.buildings,
        postCampaignFreePlay: diag.postCampaignFreePlay,
      })),
    };
    await server.commands.writeFile(`${ARTIFACT_DIR}/manifest.json`, JSON.stringify(manifest, null, 2));

    const serializedRuntime = JSON.stringify({
      eraOrder: ERA_ORDER,
      finalEra: ERA_DEFINITIONS[ERA_ORDER[ERA_ORDER.length - 1]!],
      finalDiag,
    }).toLowerCase();

    expect(finalDiag.year).toBeGreaterThanOrEqual(TARGET_YEAR);
    expect(finalDiag.ended).toBe(false);
    expect(finalDiag.gameMode).toBe('historical');
    expect(finalDiag.era).toBe('stagnation');
    expect(finalDiag.eraEndYear).toBe(1991);
    expect(finalDiag.historicalCompletionCount).toBe(1);
    expect(finalDiag.postCampaignFreePlay).toBe(true);
    expect(finalDiag.population).toBeGreaterThan(0);
    expect(finalDiag.buildings).toBeGreaterThan(0);
    for (const removedId of REMOVED_RUNTIME_IDS) {
      expect(serializedRuntime).not.toContain(removedId);
    }
  });
});
