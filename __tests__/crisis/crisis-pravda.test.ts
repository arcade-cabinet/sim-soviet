/**
 * @fileoverview Tests for crisis-aware PravdaSystem.
 *
 * Validates that the PravdaSystem generates crisis-specific headlines
 * when active crises are provided, weights them by phase, and maintains
 * the satirical Soviet propaganda tone.
 */

import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { PravdaSystem } from '../../src/ai/agents/narrative/pravda';
import type { ActiveCrisisInfo } from '../../src/ai/agents/narrative/pravda/types';
import { generateCrisisHeadline, crisisPhaseWeight } from '../../src/ai/agents/narrative/pravda/generators/crisis';
import { generateHeadline } from '../../src/ai/agents/narrative/pravda/generators';
import { createGameView } from '../../src/game/GameView';
import {
  WAR_HEADLINES,
  FAMINE_HEADLINES,
  DISASTER_HEADLINES,
  POLITICAL_HEADLINES,
} from '../../src/ai/agents/narrative/pravda/wordPools';

// ─── Helpers ────────────────────────────────────────────────────────────────

function setupECS(): void {
  world.clear();
  createResourceStore();
  createMetaStore();
}

// ─── Word Pool Completeness ─────────────────────────────────────────────────

describe('Crisis headline pools', () => {
  it('WAR_HEADLINES has at least 10 entries', () => {
    expect(WAR_HEADLINES.length).toBeGreaterThanOrEqual(10);
  });

  it('FAMINE_HEADLINES has at least 10 entries', () => {
    expect(FAMINE_HEADLINES.length).toBeGreaterThanOrEqual(10);
  });

  it('DISASTER_HEADLINES has at least 10 entries', () => {
    expect(DISASTER_HEADLINES.length).toBeGreaterThanOrEqual(10);
  });

  it('POLITICAL_HEADLINES has at least 10 entries', () => {
    expect(POLITICAL_HEADLINES.length).toBeGreaterThanOrEqual(10);
  });

  it('all war headlines are uppercase', () => {
    for (const h of WAR_HEADLINES) {
      expect(h).toBe(h.toUpperCase());
    }
  });

  it('all famine headlines are uppercase', () => {
    for (const h of FAMINE_HEADLINES) {
      expect(h).toBe(h.toUpperCase());
    }
  });

  it('all disaster headlines are uppercase', () => {
    for (const h of DISASTER_HEADLINES) {
      expect(h).toBe(h.toUpperCase());
    }
  });

  it('all political headlines are uppercase', () => {
    for (const h of POLITICAL_HEADLINES) {
      expect(h).toBe(h.toUpperCase());
    }
  });
});

// ─── generateCrisisHeadline ─────────────────────────────────────────────────

describe('generateCrisisHeadline', () => {
  it('generates a war headline from the WAR pool', () => {
    const crisis: ActiveCrisisInfo = { type: 'war', phase: 'peak' };
    const headline = generateCrisisHeadline(crisis);
    expect(WAR_HEADLINES).toContain(headline.headline);
    expect(headline.category).toBe('crisis');
  });

  it('generates a famine headline from the FAMINE pool', () => {
    const crisis: ActiveCrisisInfo = { type: 'famine', phase: 'peak' };
    const headline = generateCrisisHeadline(crisis);
    expect(FAMINE_HEADLINES).toContain(headline.headline);
    expect(headline.category).toBe('crisis');
  });

  it('generates a disaster headline from the DISASTER pool', () => {
    const crisis: ActiveCrisisInfo = { type: 'disaster', phase: 'buildup' };
    const headline = generateCrisisHeadline(crisis);
    expect(DISASTER_HEADLINES).toContain(headline.headline);
    expect(headline.category).toBe('crisis');
  });

  it('generates a political headline from the POLITICAL pool', () => {
    const crisis: ActiveCrisisInfo = { type: 'political', phase: 'aftermath' };
    const headline = generateCrisisHeadline(crisis);
    expect(POLITICAL_HEADLINES).toContain(headline.headline);
    expect(headline.category).toBe('crisis');
  });

  it('always includes subtext and reality', () => {
    const types: ActiveCrisisInfo['type'][] = ['war', 'famine', 'disaster', 'political'];
    for (const type of types) {
      const headline = generateCrisisHeadline({ type, phase: 'peak' });
      expect(headline.subtext).toBeTruthy();
      expect(headline.reality).toBeTruthy();
    }
  });
});

// ─── crisisPhaseWeight ──────────────────────────────────────────────────────

describe('crisisPhaseWeight', () => {
  it('returns 3 for peak phase', () => {
    expect(crisisPhaseWeight('peak')).toBe(3);
  });

  it('returns 2 for buildup phase', () => {
    expect(crisisPhaseWeight('buildup')).toBe(2);
  });

  it('returns 2 for aftermath phase', () => {
    expect(crisisPhaseWeight('aftermath')).toBe(2);
  });
});

// ─── generateHeadline with active crises ────────────────────────────────────

describe('generateHeadline with active crises', () => {
  beforeEach(setupECS);
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('can produce crisis headlines when crises are active', () => {
    const gs = createGameView();
    const crises: ActiveCrisisInfo[] = [{ type: 'war', phase: 'peak' }];

    let foundCrisis = false;
    for (let i = 0; i < 100; i++) {
      const headline = generateHeadline(gs, crises);
      if (headline.category === 'crisis') {
        foundCrisis = true;
        break;
      }
    }
    expect(foundCrisis).toBe(true);
  });

  it('produces no crisis headlines when no crises are active', () => {
    const gs = createGameView();

    for (let i = 0; i < 100; i++) {
      const headline = generateHeadline(gs, []);
      expect(headline.category).not.toBe('crisis');
    }
  });

  it('produces no crisis headlines when activeCrises is undefined', () => {
    const gs = createGameView();

    for (let i = 0; i < 100; i++) {
      const headline = generateHeadline(gs);
      expect(headline.category).not.toBe('crisis');
    }
  });

  it('produces crisis headlines at higher rate during peak than during buildup', () => {
    const gs = createGameView();
    const peakCrises: ActiveCrisisInfo[] = [{ type: 'war', phase: 'peak' }];
    const buildupCrises: ActiveCrisisInfo[] = [{ type: 'war', phase: 'buildup' }];

    let peakCrisisCount = 0;
    let buildupCrisisCount = 0;
    const trials = 2000;

    for (let i = 0; i < trials; i++) {
      if (generateHeadline(gs, peakCrises).category === 'crisis') peakCrisisCount++;
      if (generateHeadline(gs, buildupCrises).category === 'crisis') buildupCrisisCount++;
    }

    // Peak (weight 3) should produce more crisis headlines than buildup (weight 2)
    expect(peakCrisisCount).toBeGreaterThan(buildupCrisisCount);
  });

  it('handles multiple simultaneous crises', () => {
    const gs = createGameView();
    const crises: ActiveCrisisInfo[] = [
      { type: 'war', phase: 'peak' },
      { type: 'famine', phase: 'buildup' },
    ];

    let warHeadlines = 0;
    let famineHeadlines = 0;
    const trials = 2000;

    for (let i = 0; i < trials; i++) {
      const headline = generateHeadline(gs, crises);
      if (headline.category === 'crisis') {
        if (WAR_HEADLINES.includes(headline.headline as typeof WAR_HEADLINES[number])) warHeadlines++;
        if (FAMINE_HEADLINES.includes(headline.headline as typeof FAMINE_HEADLINES[number])) famineHeadlines++;
      }
    }

    // Both crisis types should appear
    expect(warHeadlines).toBeGreaterThan(0);
    expect(famineHeadlines).toBeGreaterThan(0);
  });

  it('still produces generic headlines during crises', () => {
    const gs = createGameView();
    const crises: ActiveCrisisInfo[] = [{ type: 'disaster', phase: 'peak' }];

    let genericCount = 0;
    const trials = 500;

    for (let i = 0; i < trials; i++) {
      const headline = generateHeadline(gs, crises);
      if (headline.category !== 'crisis') genericCount++;
    }

    // Some generic headlines should still appear (not 100% crisis)
    expect(genericCount).toBeGreaterThan(0);
  });
});

// ─── PravdaSystem.generateAmbientHeadline with crises ───────────────────────

describe('PravdaSystem.generateAmbientHeadline with crises', () => {
  let pravda: PravdaSystem;

  beforeEach(() => {
    setupECS();
    pravda = new PravdaSystem();
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('accepts activeCrises parameter', () => {
    jest.spyOn(Date, 'now').mockReturnValue(100000);
    const crises: ActiveCrisisInfo[] = [{ type: 'war', phase: 'peak' }];
    const headline = pravda.generateAmbientHeadline(crises);
    expect(headline).not.toBeNull();
  });

  it('works without activeCrises parameter (backward compatible)', () => {
    jest.spyOn(Date, 'now').mockReturnValue(100000);
    const headline = pravda.generateAmbientHeadline();
    expect(headline).not.toBeNull();
  });

  it('produces crisis headlines when crises are active', () => {
    const crises: ActiveCrisisInfo[] = [{ type: 'famine', phase: 'peak' }];

    let foundCrisis = false;
    for (let i = 0; i < 200; i++) {
      jest.spyOn(Date, 'now').mockReturnValue(100000 + i * 50000);
      const headline = pravda.generateAmbientHeadline(crises);
      if (headline && headline.category === 'crisis') {
        foundCrisis = true;
        break;
      }
    }
    expect(foundCrisis).toBe(true);
  });

  it('records crisis headlines in history', () => {
    const crises: ActiveCrisisInfo[] = [{ type: 'political', phase: 'peak' }];

    // Keep generating until we get a crisis headline
    let crisisHeadline = null;
    for (let i = 0; i < 200; i++) {
      jest.spyOn(Date, 'now').mockReturnValue(100000 + i * 50000);
      const headline = pravda.generateAmbientHeadline(crises);
      if (headline && headline.category === 'crisis') {
        crisisHeadline = headline;
        break;
      }
    }

    if (crisisHeadline) {
      const history = pravda.getRecentHeadlines(50);
      const found = history.some((h) => h.category === 'crisis');
      expect(found).toBe(true);
    }
  });

  it('still respects cooldown with active crises', () => {
    const crises: ActiveCrisisInfo[] = [{ type: 'war', phase: 'peak' }];

    jest.spyOn(Date, 'now').mockReturnValue(100000);
    const first = pravda.generateAmbientHeadline(crises);
    expect(first).not.toBeNull();

    // Same time — should return null
    const second = pravda.generateAmbientHeadline(crises);
    expect(second).toBeNull();
  });
});

// ─── Satirical tone checks ──────────────────────────────────────────────────

describe('Crisis headline satirical tone', () => {
  it('war headlines reference military/patriotic themes', () => {
    const militaryTerms = ['MOTHERLAND', 'ARMS', 'WAR', 'HERO', 'FRONT', 'ARMY', 'MOBILIZATION', 'PARTISAN', 'AMMUNITION', 'DEFENSE', 'ENEMY', 'EVACUATION', 'MILITARY', 'BATTLE', 'FACTORY', 'PRODUCTION', 'COMRADE', 'LABOR', 'SACRIFICE', 'INDUSTRIAL', 'COMMAND', 'PATRIOTIC', 'RED'];
    const matchCount = WAR_HEADLINES.filter((h) =>
      militaryTerms.some((term) => h.includes(term)),
    ).length;
    // At least 80% should match
    expect(matchCount / WAR_HEADLINES.length).toBeGreaterThanOrEqual(0.8);
  });

  it('famine headlines reference food/agriculture themes', () => {
    const famineTerms = ['GRAIN', 'HARVEST', 'FARM', 'FOOD', 'AGRICULTURAL', 'KULAK', 'CALORIC', 'BREAD', 'WHEAT', 'PORTION', 'DIET', 'HOARDING', 'SABOTAGE', 'LYSENKO', 'SHORTAGE', 'DROUGHT', 'DELIVERIES', 'MINISTRY', 'RATION', 'QUEUE', 'FESTIVAL'];
    const matchCount = FAMINE_HEADLINES.filter((h) =>
      famineTerms.some((term) => h.includes(term)),
    ).length;
    expect(matchCount / FAMINE_HEADLINES.length).toBeGreaterThanOrEqual(0.8);
  });

  it('disaster headlines minimize/deny the catastrophe', () => {
    const minimizers = ['MINOR', 'CONTROL', 'NO DANGER', 'SMOOTHLY', 'NO RISK', 'PLANNED', 'ACCEPTABLE', 'EFFICIENCY', 'REFRESHING', 'REBRANDED', 'RECLASSIFIED', 'RELOCATED', 'REDESIGNED', 'DISCOURAGED', 'EXCITING', 'HEROIC', 'DRILL', 'SEISMIC', 'RAPID', 'COLLAPSE', 'CONFIRM'];
    const matchCount = DISASTER_HEADLINES.filter((h) =>
      minimizers.some((term) => h.includes(term)),
    ).length;
    expect(matchCount / DISASTER_HEADLINES.length).toBeGreaterThanOrEqual(0.8);
  });

  it('political headlines reference party/state apparatus', () => {
    const politicalTerms = ['PARTY', 'COUNTER-REVOLUTIONARY', 'PURGE', 'TRIAL', 'KGB', 'CONFESS', 'REHABILITATED', 'POLITBURO', 'LOYALTY', 'IDEOLOGICAL', 'CONGRESS', 'COMMITTEE', 'VIGILANCE', 'HERO', 'ENEMY', 'DEVIATION', 'RECLASSIFIED', 'PEOPLE', 'STATE', 'PLAN', 'APPOINTM', 'WRECKER', 'TRAITOR', 'VOTE'];
    const matchCount = POLITICAL_HEADLINES.filter((h) =>
      politicalTerms.some((term) => h.includes(term)),
    ).length;
    expect(matchCount / POLITICAL_HEADLINES.length).toBeGreaterThanOrEqual(0.8);
  });
});
