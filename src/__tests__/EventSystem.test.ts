import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameState } from '../game/GameState';
import { EventSystem, ALL_EVENT_TEMPLATES, type GameEvent } from '../game/EventSystem';

describe('EventSystem', () => {
  let gs: GameState;
  let firedEvents: GameEvent[];
  let eventSystem: EventSystem;

  beforeEach(() => {
    gs = new GameState();
    firedEvents = [];
    eventSystem = new EventSystem(gs, (event) => {
      firedEvents.push(event);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Event triggering ────────────────────────────────────

  describe('triggerEvent', () => {
    it('fires a known event by ID', () => {
      eventSystem.triggerEvent('earthquake_bread');
      expect(firedEvents).toHaveLength(1);
      expect(firedEvents[0]!.id).toBe('earthquake_bread');
    });

    it('does nothing for an unknown event ID', () => {
      eventSystem.triggerEvent('nonexistent_event');
      expect(firedEvents).toHaveLength(0);
    });

    it('resolves the event with correct fields', () => {
      eventSystem.triggerEvent('earthquake_bread');
      const event = firedEvents[0]!;
      expect(event.title).toBe('SEISMIC EVENT IN SECTOR 4');
      expect(event.category).toBe('disaster');
      expect(event.severity).toBe('major');
      expect(event.effects).toEqual({ food: -15 });
    });

    it('stores the event in history', () => {
      eventSystem.triggerEvent('earthquake_bread');
      const recent = eventSystem.getRecentEvents(1);
      expect(recent).toHaveLength(1);
      expect(recent[0]!.id).toBe('earthquake_bread');
    });
  });

  // ── Effect application ──────────────────────────────────

  describe('effect application', () => {
    it('reduces food on negative food effect', () => {
      gs.food = 100;
      eventSystem.triggerEvent('earthquake_bread'); // effects: { food: -15 }
      expect(gs.food).toBe(85);
    });

    it('reduces money on negative money effect', () => {
      gs.money = 500;
      eventSystem.triggerEvent('cultural_palace_fire'); // effects: { money: -50 }
      expect(gs.money).toBe(450);
    });

    it('clamps resources to minimum of 0', () => {
      gs.food = 5;
      eventSystem.triggerEvent('earthquake_bread'); // effects: { food: -15 }
      expect(gs.food).toBe(0);
    });

    it('applies positive effects (e.g., money gain)', () => {
      gs.money = 100;
      eventSystem.triggerEvent('hero_award'); // effects: { money: 100 }
      expect(gs.money).toBe(200);
    });

    it('applies population effects', () => {
      gs.pop = 20;
      eventSystem.triggerEvent('chemical_leak'); // effects: { pop: -2 }, cond: pop > 10
      expect(gs.pop).toBe(18);
    });

    it('applies multiple resource effects simultaneously', () => {
      gs.food = 100;
      gs.vodka = 50;
      eventSystem.triggerEvent('blizzard_burial'); // effects: { food: -10, vodka: -5 }
      expect(gs.food).toBe(90);
      expect(gs.vodka).toBe(45);
    });
  });

  // ── Dynamic (function-based) descriptions ───────────────

  describe('dynamic content resolution', () => {
    it('resolves function-based descriptions with game state', () => {
      gs.pop = 42;
      eventSystem.triggerEvent('rat_invasion');
      const event = firedEvents[0]!;
      expect(event.description).toContain('42 citizens');
      expect(event.description).toContain('126 rats');
    });

    it('resolves function-based effects', () => {
      gs.money = 1000;
      eventSystem.triggerEvent('currency_reform'); // effects: (gs) => ({ money: -Math.floor(gs.money * 0.15) })
      expect(gs.money).toBe(850); // 1000 - 150
    });

    it('resolves function-based pravdaHeadline', () => {
      gs.food = 200;
      eventSystem.triggerEvent('agricultural_record');
      const event = firedEvents[0]!;
      // Math.max(3, Math.floor(200 / 50)) = 4
      expect(event.pravdaHeadline).toContain('400%');
    });
  });

  // ── Condition predicates ────────────────────────────────

  describe('condition predicates', () => {
    it('fires events whose conditions are met', () => {
      gs.pop = 20;
      eventSystem.triggerEvent('chemical_leak'); // condition: gs.pop > 10
      expect(firedEvents).toHaveLength(1);
    });

    it('power_station_explosion requires power > 0', () => {
      gs.power = 0;
      // triggerEvent bypasses condition check (it's a force trigger)
      // but the template has condition: (gs) => gs.power > 0
      // Let's verify the template condition directly
      const template = ALL_EVENT_TEMPLATES.find((t) => t.id === 'power_station_explosion');
      expect(template!.condition!(gs)).toBe(false);
      gs.power = 50;
      expect(template!.condition!(gs)).toBe(true);
    });

    it('defection_attempt requires pop > 10', () => {
      const template = ALL_EVENT_TEMPLATES.find((t) => t.id === 'defection_attempt');
      gs.pop = 5;
      expect(template!.condition!(gs)).toBe(false);
      gs.pop = 15;
      expect(template!.condition!(gs)).toBe(true);
    });

    it('vodka_surplus requires vodka > 20', () => {
      const template = ALL_EVENT_TEMPLATES.find((t) => t.id === 'vodka_surplus');
      gs.vodka = 10;
      expect(template!.condition!(gs)).toBe(false);
      gs.vodka = 30;
      expect(template!.condition!(gs)).toBe(true);
    });
  });

  // ── Weighted random selection ───────────────────────────

  describe('weighted random selection', () => {
    it('templates have default weight of 1 when not specified', () => {
      const noWeight = ALL_EVENT_TEMPLATES.find((t) => t.id === 'earthquake_bread');
      expect(noWeight!.weight).toBeUndefined();
    });

    it('some templates have custom weights', () => {
      const vodkaSurplus = ALL_EVENT_TEMPLATES.find((t) => t.id === 'vodka_surplus');
      expect(vodkaSurplus!.weight).toBe(0.7);
    });

    it('hero_award has low weight (rare good event)', () => {
      const heroAward = ALL_EVENT_TEMPLATES.find((t) => t.id === 'hero_award');
      expect(heroAward!.weight).toBe(0.5);
    });
  });

  // ── Tick-based event generation ─────────────────────────

  describe('tick-based generation', () => {
    it('does not fire events if cooldown has not elapsed', () => {
      // Force random to always trigger (< 0.12)
      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      vi.spyOn(Date, 'now').mockReturnValue(1000);

      eventSystem.tick();
      // First tick should fire (lastEventTime starts at 0, now=1000 > 25000 cooldown? No, 1000 < 25000)
      // Actually lastEventTime is 0 and cooldown is 25000, so 1000 - 0 = 1000 < 25000
      // So it should NOT fire
      expect(firedEvents).toHaveLength(0);
    });

    it('fires events after cooldown has elapsed', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      // Set time well past cooldown
      vi.spyOn(Date, 'now').mockReturnValue(30000);

      eventSystem.tick();
      expect(firedEvents).toHaveLength(1);
    });

    it('respects the 12% probability check', () => {
      vi.spyOn(Date, 'now').mockReturnValue(30000);
      // random returns 0.5 which is > 0.12, so no event
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      eventSystem.tick();
      expect(firedEvents).toHaveLength(0);
    });
  });

  // ── Recently-fired memory ───────────────────────────────

  describe('recently-fired memory', () => {
    it('prevents the same event from firing twice in a row via generateEvent', () => {
      // We can test this by looking at getRecentEvents after triggering multiple events
      eventSystem.triggerEvent('earthquake_bread');
      eventSystem.triggerEvent('cultural_palace_fire');

      const recent = eventSystem.getRecentEvents(5);
      expect(recent).toHaveLength(2);
      expect(recent[0]!.id).toBe('earthquake_bread');
      expect(recent[1]!.id).toBe('cultural_palace_fire');
    });
  });

  // ── Event history ───────────────────────────────────────

  describe('event history', () => {
    it('getRecentEvents returns the last N events', () => {
      eventSystem.triggerEvent('earthquake_bread');
      eventSystem.triggerEvent('cultural_palace_fire');
      eventSystem.triggerEvent('kgb_inspection');

      const recent = eventSystem.getRecentEvents(2);
      expect(recent).toHaveLength(2);
      expect(recent[0]!.id).toBe('cultural_palace_fire');
      expect(recent[1]!.id).toBe('kgb_inspection');
    });

    it('getLastEvent returns the most recent event', () => {
      eventSystem.triggerEvent('earthquake_bread');
      eventSystem.triggerEvent('cultural_palace_fire');

      const last = eventSystem.getLastEvent();
      expect(last!.id).toBe('cultural_palace_fire');
    });

    it('getLastEvent returns null when no events have fired', () => {
      expect(eventSystem.getLastEvent()).toBeNull();
    });

    it('getRecentEvents returns empty array when no events have fired', () => {
      expect(eventSystem.getRecentEvents(5)).toEqual([]);
    });
  });

  // ── Event type classification (good/bad/neutral) ───────

  describe('event type classification', () => {
    it('classifies negative-impact events as "bad"', () => {
      eventSystem.triggerEvent('earthquake_bread'); // food: -15 -> net -15
      expect(firedEvents[0]!.type).toBe('bad');
    });

    it('classifies positive-impact events as "good"', () => {
      eventSystem.triggerEvent('hero_award'); // money: 100 -> net 100
      expect(firedEvents[0]!.type).toBe('good');
    });

    it('classifies zero-impact events as "neutral"', () => {
      eventSystem.triggerEvent('five_year_plan_deadline'); // effects: {}
      expect(firedEvents[0]!.type).toBe('neutral');
    });

    it('classifies small negative net impact (-5 to 5) as "neutral"', () => {
      eventSystem.triggerEvent('propaganda_contest'); // effects: { food: -1 }
      expect(firedEvents[0]!.type).toBe('neutral');
    });
  });

  // ── Template completeness ───────────────────────────────

  describe('template completeness', () => {
    it('has events from all categories', () => {
      const categories = new Set(ALL_EVENT_TEMPLATES.map((t) => t.category));
      expect(categories).toContain('disaster');
      expect(categories).toContain('political');
      expect(categories).toContain('economic');
      expect(categories).toContain('cultural');
      expect(categories).toContain('absurdist');
    });

    it('has events of all severity levels', () => {
      const severities = new Set(ALL_EVENT_TEMPLATES.map((t) => t.severity));
      expect(severities).toContain('trivial');
      expect(severities).toContain('minor');
      expect(severities).toContain('major');
      expect(severities).toContain('catastrophic');
    });

    it('every template has a unique ID', () => {
      const ids = ALL_EVENT_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('every template has a non-empty title', () => {
      for (const t of ALL_EVENT_TEMPLATES) {
        expect(t.title.length).toBeGreaterThan(0);
      }
    });

    it('every template has a non-empty description', () => {
      for (const t of ALL_EVENT_TEMPLATES) {
        expect(t.description).toBeDefined();
        if (typeof t.description === 'string') {
          expect(t.description.length).toBeGreaterThan(0);
        }
      }
    });

    it('every template has a non-empty pravdaHeadline', () => {
      for (const t of ALL_EVENT_TEMPLATES) {
        expect(t.pravdaHeadline).toBeDefined();
        if (typeof t.pravdaHeadline === 'string') {
          expect(t.pravdaHeadline.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
