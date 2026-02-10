import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMetaEntity, getResourceEntity } from '../ecs/archetypes';
import { createMetaStore, createResourceStore } from '../ecs/factories';
import { world } from '../ecs/world';
import type { GameEvent } from '../game/events';
import { PravdaSystem } from '../game/pravda';

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
    vi.restoreAllMocks();
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
        vi.spyOn(Date, 'now').mockReturnValue(100000 + i * 50000);
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
        vi.spyOn(Date, 'now').mockReturnValue(100000 + i * 50000);
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
      vi.spyOn(Date, 'now').mockReturnValue(100000);
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
      vi.spyOn(Date, 'now').mockReturnValue(100000);
      const first = pravda.generateAmbientHeadline();
      expect(first).not.toBeNull();

      // Call again immediately (same time)
      const second = pravda.generateAmbientHeadline();
      expect(second).toBeNull();
    });

    it('returns null when called within 45-second cooldown', () => {
      vi.spyOn(Date, 'now').mockReturnValue(100000);
      pravda.generateAmbientHeadline();

      vi.spyOn(Date, 'now').mockReturnValue(130000); // 30 seconds later
      const result = pravda.generateAmbientHeadline();
      expect(result).toBeNull();
    });

    it('generates headline after cooldown expires', () => {
      vi.spyOn(Date, 'now').mockReturnValue(100000);
      pravda.generateAmbientHeadline();

      vi.spyOn(Date, 'now').mockReturnValue(200000); // 100 seconds later
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
      vi.spyOn(Date, 'now').mockReturnValue(100000);
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
      vi.spyOn(Date, 'now').mockReturnValue(100000);
      pravda.generateAmbientHeadline();

      const data = pravda.serialize();
      expect(data.lastHeadlineTime).toBe(100000);
      expect(data.headlineCooldown).toBe(45000);

      const restored = PravdaSystem.deserialize(data);

      // Restored system should still be in cooldown at the same time
      vi.spyOn(Date, 'now').mockReturnValue(130000); // 30s later, still in cooldown
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
      vi.spyOn(Date, 'now').mockReturnValue(100000);
      pravda.generateAmbientHeadline();
      const data = pravda.serialize();

      const restored = PravdaSystem.deserialize(data);
      // After cooldown, should be able to generate
      vi.spyOn(Date, 'now').mockReturnValue(200000);
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
      expect(page).toContain('1922');
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
