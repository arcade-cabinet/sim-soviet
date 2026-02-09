import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameState } from '../game/GameState';
import { PravdaSystem } from '../game/PravdaSystem';
import type { GameEvent } from '../game/EventSystem';

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
  let gs: GameState;
  let pravda: PravdaSystem;

  beforeEach(() => {
    gs = new GameState();
    pravda = new PravdaSystem(gs);
  });

  afterEach(() => {
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
      const hasValidMessage = validMessages.some((msg) =>
        headline.subtext.includes(msg)
      );
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
      gs.pop = 42;
      gs.food = 999;
      gs.vodka = 25;

      // Generate many headlines and check that game state values appear
      // The procedural system interpolates values directly, so population,
      // food, vodka, etc. should appear in some generated headlines.
      let foundGameStateRef = false;
      for (let i = 0; i < 500; i++) {
        vi.spyOn(Date, 'now').mockReturnValue(100000 + i * 50000);
        const headline = pravda.generateAmbientHeadline();
        if (headline) {
          const allText = headline.headline + headline.subtext + headline.reality;
          if (allText.includes('42') || allText.includes('999') || allText.includes('25')) {
            foundGameStateRef = true;
            break;
          }
        }
      }
      expect(foundGameStateRef).toBe(true);
    });

    it('includes year in generated headlines', () => {
      gs.date.year = 1980;

      let foundYear = false;
      for (let i = 0; i < 500; i++) {
        vi.spyOn(Date, 'now').mockReturnValue(100000 + i * 50000);
        const headline = pravda.generateAmbientHeadline();
        if (headline) {
          const allText = headline.headline + headline.subtext + headline.reality;
          if (allText.includes('1980')) {
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
      expect(page).toContain('1980');
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
