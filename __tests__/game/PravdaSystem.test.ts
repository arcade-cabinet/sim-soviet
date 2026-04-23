import type { GameEvent } from '../../src/ai/agents/narrative/events';
import { PravdaSystem } from '../../src/ai/agents/narrative/pravda';
import { contextualGenerators as absurdistContextualGenerators } from '../../src/ai/agents/narrative/pravda/generators/absurdist';
import { culturalVictoryGenerators } from '../../src/ai/agents/narrative/pravda/generators/cultural';
import { weatherFillerGenerators } from '../../src/ai/agents/narrative/pravda/generators/daily';
import {
  internalTriumphGenerators,
  resourceSpinGenerators,
} from '../../src/ai/agents/narrative/pravda/generators/economic';
import {
  adversariesForYear,
  enemySubjectsForYear,
  externalThreatGenerators,
  institutionsForYear,
  securityServiceForYear,
} from '../../src/ai/agents/narrative/pravda/generators/military';
import {
  culturalAuthorityForYear,
  planLabelForYear,
  tradeAuthorityForYear,
} from '../../src/ai/agents/narrative/pravda/helpers';
import { getMetaEntity, getResourceEntity } from '../../src/ecs/archetypes';
import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import type { GameView } from '../../src/game/GameView';

function createMockEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: 'test_event',
    title: 'Test Event',
    description: 'A test event occurred.',
    pravdaHeadline: 'GLORIOUS TEST EVENT SUCCEEDS',
    category: 'political',
    severity: 'minor',
    effects: {},
    type: 'neutral',
    ...overrides,
  };
}

function createMockGameView(overrides: Partial<GameView> = {}): GameView {
  return {
    money: 100,
    pop: 25,
    food: 500,
    vodka: 25,
    power: 10,
    powerUsed: 5,
    buildings: [],
    date: { year: 1917, month: 10, tick: 1 },
    quota: { type: 'food', target: 100, current: 0, deadlineYear: 1922 },
    currentEra: 'revolution',
    avgMorale: 50,
    ...overrides,
  };
}

describe('PravdaSystem', () => {
  let pravda: PravdaSystem;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    pravda = new PravdaSystem();
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── headlineFromEvent ───────────────────────────────────

  describe('headlineFromEvent', () => {
    it('creates a PravdaHeadline from a game event', () => {
      const event = createMockEvent();
      const headline = pravda.headlineFromEvent(event);

      expect(headline.headline).toBe('GLORIOUS TEST EVENT SUCCEEDS');
      expect(headline.reality).toBe('A test event occurred.');
      expect(headline.timestamp).toBeGreaterThan(0);
    });

    it('stores the headline in history', () => {
      const event = createMockEvent();
      pravda.headlineFromEvent(event);

      const recent = pravda.getRecentHeadlines(1);
      expect(recent).toHaveLength(1);
      expect(recent[0]!.headline).toBe('GLORIOUS TEST EVENT SUCCEEDS');
    });

    it('maps disaster events to "triumph" category', () => {
      const event = createMockEvent({ category: 'disaster' });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.category).toBe('triumph');
    });

    it('maps political events to "editorial" category', () => {
      const event = createMockEvent({ category: 'political' });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.category).toBe('editorial');
    });

    it('maps economic events to "production" category', () => {
      const event = createMockEvent({ category: 'economic' });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.category).toBe('production');
    });

    it('maps cultural events to "culture" category', () => {
      const event = createMockEvent({ category: 'cultural' });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.category).toBe('culture');
    });

    it('maps absurdist events to one of editorial/weather/culture', () => {
      const validCategories = ['editorial', 'weather', 'culture'];
      // Run multiple times since it uses random pick
      for (let i = 0; i < 20; i++) {
        const event = createMockEvent({ category: 'absurdist' });
        const headline = pravda.headlineFromEvent(event);
        expect(validCategories).toContain(headline.category);
      }
    });
  });

  describe('contextual generator guards', () => {
    it('only emits the zero-citizen crime headline for actual collapse conditions', () => {
      const zeroCitizenGenerator = absurdistContextualGenerators.find((generator) =>
        generator.generate(createMockGameView({ pop: 0, food: 0 })).headline.includes('PERFECT CRIME RATE'),
      );

      expect(zeroCitizenGenerator).toBeDefined();
      expect(zeroCitizenGenerator!.condition(createMockGameView({ pop: 0, food: 500 }))).toBe(false);
      expect(zeroCitizenGenerator!.condition(createMockGameView({ pop: 0, food: 0 }))).toBe(true);
    });

    it('does not emit treasury austerity spin during the 1917 startup state', () => {
      const treasuryGenerator = absurdistContextualGenerators.find((generator) =>
        generator
          .generate(createMockGameView({ money: 0, date: { year: 1918, month: 1, tick: 0 } }))
          .headline.includes('TREASURY AUSTERITY'),
      );

      expect(treasuryGenerator).toBeDefined();
      expect(
        treasuryGenerator!.condition(createMockGameView({ money: 0, date: { year: 1917, month: 10, tick: 1 } })),
      ).toBe(false);
      expect(
        treasuryGenerator!.condition(createMockGameView({ money: 0, date: { year: 1918, month: 1, tick: 0 } })),
      ).toBe(true);
      expect(treasuryGenerator!.generate(createMockGameView({ money: 0 })).headline).not.toMatch(/POST[- ]MONETARY/);
    });

    it('does not emit no-building collapse spin during the 1917 startup state', () => {
      const noBuildingGenerator = absurdistContextualGenerators.find((generator) =>
        generator
          .generate(createMockGameView({ buildings: [], date: { year: 1918, month: 1, tick: 0 } }))
          .headline.includes('MINIMALIST SETTLEMENT'),
      );

      expect(noBuildingGenerator).toBeDefined();
      expect(
        noBuildingGenerator!.condition(createMockGameView({ buildings: [], date: { year: 1917, month: 10, tick: 1 } })),
      ).toBe(false);
      expect(
        noBuildingGenerator!.condition(createMockGameView({ buildings: [], date: { year: 1918, month: 1, tick: 0 } })),
      ).toBe(true);
    });

    it('does not use Five-Year Plan language before 1928', () => {
      expect(planLabelForYear(1917)).toBe('LOCAL WORK PLAN');
      expect(planLabelForYear(1930)).toBe('FIVE-YEAR PLAN');

      const planGenerator = internalTriumphGenerators[7]!;
      const quotaSpinGenerator = resourceSpinGenerators.at(-1)!;
      const quotaDueGenerator = absurdistContextualGenerators.find((generator) =>
        generator
          .generate(
            createMockGameView({
              date: { year: 1930, month: 1, tick: 0 },
              quota: { type: 'food', target: 100, current: 50, deadlineYear: 1930 },
            }),
          )
          .headline.includes('FIVE-YEAR PLAN'),
      );

      expect(planGenerator).toBeDefined();
      expect(planGenerator!(createMockGameView({ date: { year: 1917, month: 10, tick: 1 } })).headline).not.toContain(
        'FIVE-YEAR PLAN',
      );
      expect(planGenerator!(createMockGameView({ date: { year: 1930, month: 1, tick: 0 } })).headline).toContain(
        'FIVE-YEAR PLAN',
      );

      expect(
        quotaSpinGenerator(
          createMockGameView({
            date: { year: 1917, month: 10, tick: 1 },
            quota: { type: 'food', target: 100, current: 50, deadlineYear: 1922 },
          }),
        ).headline,
      ).not.toContain('FIVE-YEAR PLAN');
      expect(
        quotaSpinGenerator(
          createMockGameView({
            date: { year: 1930, month: 1, tick: 0 },
            quota: { type: 'food', target: 100, current: 50, deadlineYear: 1932 },
          }),
        ).headline,
      ).toContain('FIVE-YEAR PLAN');

      expect(quotaDueGenerator).toBeDefined();
      expect(
        quotaDueGenerator!.generate(
          createMockGameView({
            date: { year: 1917, month: 10, tick: 1 },
            quota: { type: 'food', target: 100, current: 50, deadlineYear: 1918 },
          }),
        ).headline,
      ).not.toContain('FIVE-YEAR PLAN');
      expect(
        quotaDueGenerator!.generate(
          createMockGameView({
            date: { year: 1930, month: 1, tick: 0 },
            quota: { type: 'food', target: 100, current: 50, deadlineYear: 1930 },
          }),
        ).headline,
      ).toContain('FIVE-YEAR PLAN');
    });

    it('keeps weather plan filler era-aware', () => {
      const winterGenerator = weatherFillerGenerators[1]!;
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      expect(winterGenerator(createMockGameView({ date: { year: 1917, month: 10, tick: 1 } })).headline).toContain(
        'LOCAL WEATHER DIRECTIVE',
      );
      expect(winterGenerator(createMockGameView({ date: { year: 1930, month: 1, tick: 0 } })).headline).toContain(
        'FIVE-YEAR WEATHER PLAN',
      );
    });

    it('keeps contextual security-service copy era-aware', () => {
      const noPowerGenerator = absurdistContextualGenerators.find((generator) =>
        generator
          .generate(
            createMockGameView({
              buildings: [{ x: 1, y: 1, defId: 'government-hq', powered: false }],
              power: 0,
            }),
          )
          .subtext.includes('notes this ability'),
      );
      const moraleCrisisGenerator = absurdistContextualGenerators.find((generator) =>
        generator.generate(createMockGameView({ avgMorale: 0 })).headline.includes('COUNTER-REVOLUTIONARY SENTIMENT'),
      );

      expect(noPowerGenerator).toBeDefined();
      expect(
        noPowerGenerator!.generate(
          createMockGameView({
            buildings: [{ x: 1, y: 1, defId: 'government-hq', powered: false }],
            power: 0,
            date: { year: 1917, month: 10, tick: 1 },
          }),
        ).subtext,
      ).toContain('CHEKA');
      expect(
        noPowerGenerator!.generate(
          createMockGameView({
            buildings: [{ x: 1, y: 1, defId: 'government-hq', powered: false }],
            power: 0,
            date: { year: 1964, month: 1, tick: 0 },
          }),
        ).subtext,
      ).toContain('KGB');

      expect(moraleCrisisGenerator).toBeDefined();
      jest.spyOn(Math, 'random').mockReturnValue(0);
      expect(
        moraleCrisisGenerator!.generate(createMockGameView({ avgMorale: 0, date: { year: 1917, month: 10, tick: 1 } }))
          .subtext,
      ).toContain('CHEKA');
      expect(
        moraleCrisisGenerator!.generate(createMockGameView({ avgMorale: 0, date: { year: 1964, month: 1, tick: 0 } }))
          .subtext,
      ).toContain('KGB');
    });

    it('keeps institutional copy era-aware', () => {
      const culturalGenerator = culturalVictoryGenerators.at(-1)!;
      const classifiedGenerator = weatherFillerGenerators[6]!;

      expect(culturalAuthorityForYear(1917)).toBe("PEOPLE'S COMMISSARIAT OF ENLIGHTENMENT");
      expect(culturalAuthorityForYear(1964)).toBe('MINISTRY OF CULTURE');
      expect(tradeAuthorityForYear(1917)).toBe('REVOLUTIONARY SUPPLY COMMITTEE');
      expect(tradeAuthorityForYear(1964)).toBe('MINISTRY OF TRADE');

      expect(culturalGenerator(createMockGameView({ date: { year: 1917, month: 10, tick: 1 } })).headline).toContain(
        "PEOPLE'S COMMISSARIAT OF ENLIGHTENMENT",
      );
      expect(culturalGenerator(createMockGameView({ date: { year: 1964, month: 1, tick: 0 } })).headline).toContain(
        'MINISTRY OF CULTURE',
      );
      expect(classifiedGenerator(createMockGameView({ date: { year: 1917, month: 10, tick: 1 } })).subtext).toContain(
        'REVOLUTIONARY SUPPLY COMMITTEE',
      );
      expect(classifiedGenerator(createMockGameView({ date: { year: 1964, month: 1, tick: 0 } })).subtext).toContain(
        'MINISTRY OF TRADE',
      );
    });

    it('keeps 1917 external-threat headlines free of Cold War anachronisms', () => {
      const forbidden1917Terms = /\b(NATO|CIA|PENTAGON|WEST GERMANY|BONN|FREE WORLD|UN SUMMIT|SATELLITE|MISSILE|KGB)\b/;
      const preColdWarPools = [
        ...enemySubjectsForYear(1917),
        ...adversariesForYear(1917),
        ...institutionsForYear(1917),
        securityServiceForYear(1917),
      ];

      expect(preColdWarPools.join(' ')).not.toMatch(forbidden1917Terms);

      for (const randomValue of [0, 0.5, 0.999999]) {
        jest.spyOn(Math, 'random').mockReturnValue(randomValue);
        for (const generator of externalThreatGenerators) {
          const generated = generator(createMockGameView({ date: { year: 1917, month: 10, tick: 1 } }));
          expect(`${generated.headline} ${generated.subtext} ${generated.reality}`).not.toMatch(forbidden1917Terms);
        }
        jest.restoreAllMocks();
      }
    });
  });

  // ── Spin doctor (subtext from effects) ──────────────────

  describe('spin doctor subtext', () => {
    it('generates spin for money loss', () => {
      const event = createMockEvent({ effects: { money: -50 } });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.subtext).toContain('50');
      expect(headline.subtext).toContain('rubles');
    });

    it('generates spin for money gain', () => {
      const event = createMockEvent({ effects: { money: 100 } });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.subtext).toContain('+100');
      expect(headline.subtext).toContain('rubles');
    });

    it('generates spin for food loss', () => {
      const event = createMockEvent({ effects: { food: -20 } });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.subtext).toContain('20');
      expect(headline.subtext).toContain('redistributed');
    });

    it('generates spin for food gain', () => {
      const event = createMockEvent({ effects: { food: 30 } });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.subtext).toContain('+30');
    });

    it('generates spin for population loss', () => {
      const event = createMockEvent({ effects: { pop: -5 } });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.subtext).toContain('5');
      expect(headline.subtext).toContain('reassigned');
    });

    it('generates spin for population gain', () => {
      const event = createMockEvent({ effects: { pop: 3 } });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.subtext).toContain('+3');
      expect(headline.subtext).toContain('comrades');
    });

    it('generates spin for vodka loss', () => {
      const event = createMockEvent({ effects: { vodka: -10 } });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.subtext).toContain('10');
    });

    it('generates spin for power loss', () => {
      const event = createMockEvent({ effects: { power: -30 } });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.subtext).toContain('30');
      expect(headline.subtext).toContain('MW');
    });

    it('generates a positive status message for no effects', () => {
      const event = createMockEvent({ effects: {} });
      const headline = pravda.headlineFromEvent(event);
      // The system randomly picks from several "everything is fine" messages
      const validMessages = [
        'State remains perfect',
        'Stability is our greatest product',
        'Numbers were already ideal',
        'The quo has never been better',
      ];
      const hasValidMessage = validMessages.some((msg) => headline.subtext.includes(msg));
      expect(hasValidMessage).toBe(true);
    });

    it('combines multiple effects with pipe separator', () => {
      const event = createMockEvent({ effects: { money: -50, food: -15 } });
      const headline = pravda.headlineFromEvent(event);
      expect(headline.subtext).toContain('|');
    });
  });

  // ── Template variable substitution ──────────────────────

  describe('template variable substitution in ambient headlines', () => {
    it('includes game state values in generated headlines', () => {
      getResourceEntity()!.resources.population = 42;
      getResourceEntity()!.resources.food = 999;
      getResourceEntity()!.resources.vodka = 25;

      // Generate many headlines and check that game state values appear
      // The procedural system interpolates values directly, so population,
      // food, vodka, etc. should appear in some generated headlines.
      let foundEcsRef = false;
      for (let i = 0; i < 500; i++) {
        jest.spyOn(Date, 'now').mockReturnValue(100000 + i * 50000);
        const headline = pravda.generateAmbientHeadline();
        if (headline) {
          const allText = headline.headline + headline.subtext + headline.reality;
          if (allText.includes('42') || allText.includes('999') || allText.includes('25')) {
            foundEcsRef = true;
            break;
          }
        }
      }
      expect(foundEcsRef).toBe(true);
    });

    it('includes year in generated headlines', () => {
      getMetaEntity()!.gameMeta.date.year = 1922;

      let foundYear = false;
      for (let i = 0; i < 3000; i++) {
        jest.spyOn(Date, 'now').mockReturnValue(100000 + i * 50000);
        const headline = pravda.generateAmbientHeadline();
        if (headline) {
          const allText = headline.headline + headline.subtext + headline.reality;
          if (allText.includes('1922')) {
            foundYear = true;
            break;
          }
        }
      }
      expect(foundYear).toBe(true);
    });

    it('never contains unresolved template variables', () => {
      jest.spyOn(Date, 'now').mockReturnValue(100000);
      const headline = pravda.generateAmbientHeadline();
      // The procedural system should never produce raw template tokens
      if (headline) {
        expect(headline.headline).not.toContain('{RAND}');
        expect(headline.headline).not.toContain('{POP}');
        expect(headline.headline).not.toContain('{FOOD}');
        expect(headline.headline).not.toContain('{YEAR}');
        expect(headline.subtext).not.toContain('{RAND}');
        expect(headline.reality).not.toContain('{RAND}');
      }
    });
  });

  // ── Ambient headline rate limiting ──────────────────────

  describe('ambient headline rate limiting', () => {
    it('returns null when called before cooldown expires', () => {
      jest.spyOn(Date, 'now').mockReturnValue(100000);
      const first = pravda.generateAmbientHeadline();
      expect(first).not.toBeNull();

      // Call again immediately (same time)
      const second = pravda.generateAmbientHeadline();
      expect(second).toBeNull();
    });

    it('returns null when called within 45-second cooldown', () => {
      jest.spyOn(Date, 'now').mockReturnValue(100000);
      pravda.generateAmbientHeadline();

      jest.spyOn(Date, 'now').mockReturnValue(130000); // 30 seconds later
      const result = pravda.generateAmbientHeadline();
      expect(result).toBeNull();
    });

    it('generates headline after cooldown expires', () => {
      jest.spyOn(Date, 'now').mockReturnValue(100000);
      pravda.generateAmbientHeadline();

      jest.spyOn(Date, 'now').mockReturnValue(200000); // 100 seconds later
      const result = pravda.generateAmbientHeadline();
      expect(result).not.toBeNull();
    });
  });

  // ── Headline history ────────────────────────────────────

  describe('headline history', () => {
    it('accumulates headlines from events', () => {
      pravda.headlineFromEvent(createMockEvent({ id: 'a' }));
      pravda.headlineFromEvent(createMockEvent({ id: 'b' }));
      pravda.headlineFromEvent(createMockEvent({ id: 'c' }));

      const recent = pravda.getRecentHeadlines(10);
      expect(recent).toHaveLength(3);
    });

    it('getRecentHeadlines returns only the last N', () => {
      for (let i = 0; i < 15; i++) {
        pravda.headlineFromEvent(createMockEvent({ id: `event_${i}` }));
      }

      const recent = pravda.getRecentHeadlines(5);
      expect(recent).toHaveLength(5);
    });

    it('mixes event headlines and ambient headlines in history', () => {
      pravda.headlineFromEvent(createMockEvent());
      jest.spyOn(Date, 'now').mockReturnValue(100000);
      pravda.generateAmbientHeadline();

      const recent = pravda.getRecentHeadlines(10);
      expect(recent).toHaveLength(2);
    });
  });

  // ── Serialization ─────────────────────────────────────

  describe('serialize / deserialize', () => {
    it('round-trips headline history', () => {
      pravda.headlineFromEvent(createMockEvent({ id: 'a', pravdaHeadline: 'HEADLINE A' }));
      pravda.headlineFromEvent(createMockEvent({ id: 'b', pravdaHeadline: 'HEADLINE B' }));

      const data = pravda.serialize();
      expect(data.headlineHistory).toHaveLength(2);

      const restored = PravdaSystem.deserialize(data);
      const recent = restored.getRecentHeadlines(10);
      expect(recent).toHaveLength(2);
      expect(recent[0]!.headline).toBe('HEADLINE A');
      expect(recent[1]!.headline).toBe('HEADLINE B');
    });

    it('preserves lastHeadlineTime and cooldown state', () => {
      jest.spyOn(Date, 'now').mockReturnValue(100000);
      pravda.generateAmbientHeadline();

      const data = pravda.serialize();
      expect(data.lastHeadlineTime).toBe(100000);
      expect(data.headlineCooldown).toBe(45000);

      const restored = PravdaSystem.deserialize(data);

      // Restored system should still be in cooldown at the same time
      jest.spyOn(Date, 'now').mockReturnValue(130000); // 30s later, still in cooldown
      const result = restored.generateAmbientHeadline();
      expect(result).toBeNull();
    });

    it('preserves recent category memory', () => {
      // Generate several headlines to build up category memory
      pravda.headlineFromEvent(createMockEvent({ category: 'political' })); // → editorial
      pravda.headlineFromEvent(createMockEvent({ category: 'disaster' })); // → triumph
      pravda.headlineFromEvent(createMockEvent({ category: 'economic' })); // → production

      const data = pravda.serialize();
      expect(data.recentCategories.length).toBeGreaterThan(0);

      const restored = PravdaSystem.deserialize(data);
      const restoredData = restored.serialize();
      expect(restoredData.recentCategories).toEqual(data.recentCategories);
    });

    it('serialized data is JSON-safe', () => {
      pravda.headlineFromEvent(createMockEvent());
      const data = pravda.serialize();
      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);
      expect(parsed.headlineHistory).toHaveLength(1);
      expect(typeof parsed.lastHeadlineTime).toBe('number');
    });

    it('deserialized system can generate new headlines', () => {
      jest.spyOn(Date, 'now').mockReturnValue(100000);
      pravda.generateAmbientHeadline();
      const data = pravda.serialize();

      const restored = PravdaSystem.deserialize(data);
      // After cooldown, should be able to generate
      jest.spyOn(Date, 'now').mockReturnValue(200000);
      const headline = restored.generateAmbientHeadline();
      expect(headline).not.toBeNull();
    });

    it('handles empty state', () => {
      const data = pravda.serialize();
      expect(data.headlineHistory).toHaveLength(0);
      expect(data.recentCategories).toHaveLength(0);

      const restored = PravdaSystem.deserialize(data);
      expect(restored.getRecentHeadlines(10)).toHaveLength(0);
    });

    it('deserialized system formatFrontPage reflects restored history', () => {
      pravda.headlineFromEvent(createMockEvent({ pravdaHeadline: 'RESTORED HEADLINE' }));
      const data = pravda.serialize();

      const restored = PravdaSystem.deserialize(data);
      const page = restored.formatFrontPage();
      expect(page).toContain('RESTORED HEADLINE');
    });
  });

  // ── formatFrontPage ─────────────────────────────────────

  describe('formatFrontPage', () => {
    it('returns a default message when no headlines exist', () => {
      const page = pravda.formatFrontPage();
      expect(page).toContain('PRAVDA');
      expect(page).toContain('NO NEWS IS GOOD NEWS');
    });

    it('includes the current year', () => {
      pravda.headlineFromEvent(createMockEvent());
      const page = pravda.formatFrontPage();
      expect(page).toContain('1917');
    });

    it('shows up to 3 headlines with star prefix', () => {
      pravda.headlineFromEvent(createMockEvent({ pravdaHeadline: 'HEADLINE ONE' }));
      pravda.headlineFromEvent(createMockEvent({ pravdaHeadline: 'HEADLINE TWO' }));
      pravda.headlineFromEvent(createMockEvent({ pravdaHeadline: 'HEADLINE THREE' }));
      pravda.headlineFromEvent(createMockEvent({ pravdaHeadline: 'HEADLINE FOUR' }));

      const page = pravda.formatFrontPage();
      // Should show only the last 3
      expect(page).not.toContain('HEADLINE ONE');
      expect(page).toContain('HEADLINE TWO');
      expect(page).toContain('HEADLINE THREE');
      expect(page).toContain('HEADLINE FOUR');
    });
  });
});
