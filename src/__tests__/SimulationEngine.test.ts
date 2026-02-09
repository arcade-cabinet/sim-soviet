import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../game/GameState';
import { SimulationEngine } from '../game/SimulationEngine';
import type { SimCallbacks } from '../game/SimulationEngine';

/**
 * Creates mock callbacks that satisfy the SimulationEngine constructor.
 */
function createMockCallbacks(): SimCallbacks {
  return {
    onToast: vi.fn(),
    onAdvisor: vi.fn(),
    onPravda: vi.fn(),
    onStateChange: vi.fn(),
  };
}

describe('SimulationEngine', () => {
  let gs: GameState;
  let cb: SimCallbacks;
  let engine: SimulationEngine;

  beforeEach(() => {
    gs = new GameState();
    cb = createMockCallbacks();
    engine = new SimulationEngine(gs, cb);
  });

  // ── Time advancement ────────────────────────────────────

  describe('time advancement', () => {
    it('increments tick on each call', () => {
      engine.tick();
      expect(gs.date.tick).toBe(1);
    });

    it('rolls over from tick 5 to tick 0, incrementing month', () => {
      gs.date.tick = 5;
      engine.tick();
      expect(gs.date.tick).toBe(0);
      expect(gs.date.month).toBe(2);
    });

    it('rolls over from month 12 to month 1, incrementing year', () => {
      gs.date.tick = 5;
      gs.date.month = 12;
      engine.tick();
      expect(gs.date.month).toBe(1);
      expect(gs.date.year).toBe(1981);
    });

    it('handles multiple ticks correctly within the same month', () => {
      for (let i = 0; i < 5; i++) {
        engine.tick();
      }
      expect(gs.date.tick).toBe(5);
      expect(gs.date.month).toBe(1);
    });
  });

  // ── Resource calculation: power ─────────────────────────

  describe('power calculation', () => {
    it('calculates total power from power plants', () => {
      gs.addBuilding(0, 0, 'power');
      engine.tick();
      expect(gs.power).toBe(100);
    });

    it('accumulates power from multiple plants', () => {
      gs.addBuilding(0, 0, 'power');
      gs.addBuilding(1, 1, 'power');
      engine.tick();
      expect(gs.power).toBe(200);
    });

    it('reports 0 power with no power plants', () => {
      gs.addBuilding(0, 0, 'housing');
      engine.tick();
      expect(gs.power).toBe(0);
    });
  });

  // ── Resource calculation: food ──────────────────────────

  describe('food production', () => {
    it('produces food from powered farms', () => {
      gs.addBuilding(0, 0, 'power');
      gs.addBuilding(1, 1, 'farm');
      const initialFood = gs.food;
      engine.tick();
      expect(gs.food).toBe(initialFood + 20);
    });

    it('does not produce food from unpowered farms', () => {
      gs.addBuilding(1, 1, 'farm');
      const initialFood = gs.food;
      engine.tick();
      expect(gs.food).toBe(initialFood);
    });

    it('produces food from multiple farms', () => {
      gs.addBuilding(0, 0, 'power');
      gs.addBuilding(1, 1, 'farm');
      gs.addBuilding(2, 2, 'farm');
      const initialFood = gs.food;
      engine.tick();
      expect(gs.food).toBe(initialFood + 40);
    });
  });

  // ── Resource calculation: vodka ─────────────────────────

  describe('vodka production', () => {
    it('produces vodka from powered distilleries', () => {
      gs.addBuilding(0, 0, 'power');
      gs.addBuilding(1, 1, 'distillery');
      const initialVodka = gs.vodka;
      engine.tick();
      expect(gs.vodka).toBe(initialVodka + 10);
    });

    it('does not produce vodka from unpowered distilleries', () => {
      // Prevent random events from firing and modifying resources
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      gs.addBuilding(1, 1, 'distillery');
      const initialVodka = gs.vodka;
      engine.tick();
      expect(gs.vodka).toBe(initialVodka);
      vi.restoreAllMocks();
    });
  });

  // ── Power distribution ─────────────────────────────────

  describe('power distribution', () => {
    it('tracks total power used by buildings', () => {
      gs.addBuilding(0, 0, 'power');
      gs.addBuilding(1, 1, 'housing');
      gs.addBuilding(2, 2, 'farm');
      engine.tick();
      expect(gs.powerUsed).toBe(7);
    });

    it('marks buildings as unpowered when power exceeds supply', () => {
      gs.addBuilding(1, 1, 'housing');
      engine.tick();
      const building = gs.buildings.find((b) => b.type === 'housing');
      expect(building!.powered).toBe(false);
    });

    it('marks buildings as powered when power is available', () => {
      gs.addBuilding(0, 0, 'power');
      gs.addBuilding(1, 1, 'housing');
      engine.tick();
      const housing = gs.buildings.find((b) => b.type === 'housing');
      expect(housing!.powered).toBe(true);
    });

    it('power plants themselves are always powered', () => {
      gs.addBuilding(0, 0, 'power');
      engine.tick();
      const plant = gs.buildings.find((b) => b.type === 'power');
      expect(plant!.powered).toBe(true);
    });
  });

  // ── Food consumption ────────────────────────────────────

  describe('food consumption', () => {
    it('consumes food based on population (pop/10 rounded up)', () => {
      gs.pop = 15;
      gs.food = 100;
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();
      expect(gs.food).toBe(98);
    });

    it('consumes 0 food when population is 0', () => {
      gs.pop = 0;
      gs.food = 100;
      engine.tick();
      expect(gs.food).toBe(100);
    });

    it('causes starvation when food is insufficient', () => {
      gs.pop = 100;
      gs.food = 0;
      engine.tick();
      expect(gs.pop).toBeLessThanOrEqual(95);
      expect(cb.onToast).toHaveBeenCalledWith('STARVATION DETECTED');
    });

    it('reduces population by 5 during starvation (clamped at 0)', () => {
      gs.pop = 3;
      gs.food = 0;
      engine.tick();
      expect(gs.pop).toBe(0);
    });
  });

  // ── Vodka consumption ───────────────────────────────────

  describe('vodka consumption', () => {
    it('consumes vodka based on population (pop/20 rounded up)', () => {
      gs.pop = 20;
      gs.vodka = 50;
      engine.tick();
      expect(gs.vodka).toBe(49);
    });

    it('does not reduce population when vodka runs out', () => {
      gs.pop = 100;
      gs.food = 1000;
      gs.vodka = 0;
      const popBefore = gs.pop;
      engine.tick();
      expect(gs.pop).toBe(popBefore);
    });
  });

  // ── Population growth ───────────────────────────────────

  describe('population growth', () => {
    it('does not grow population without housing', () => {
      gs.food = 1000;
      gs.pop = 0;
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();
      expect(gs.pop).toBe(0);
    });

    it('grows population when housing and food are available', () => {
      gs.addBuilding(0, 0, 'power');
      gs.addBuilding(1, 1, 'housing');
      gs.food = 1000;
      gs.pop = 5;
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      engine.tick();
      expect(gs.pop).toBe(6);
    });

    it('does not grow population when at housing cap', () => {
      gs.addBuilding(0, 0, 'power');
      gs.addBuilding(1, 1, 'housing');
      gs.food = 1000;
      gs.pop = 50;
      engine.tick();
      expect(gs.pop).toBe(50);
    });

    it('does not grow population when food is low', () => {
      gs.addBuilding(0, 0, 'power');
      gs.addBuilding(1, 1, 'housing');
      gs.food = 5;
      gs.pop = 1;
      engine.tick();
      expect(gs.pop).toBeLessThanOrEqual(1);
    });
  });

  // ── Quota system ────────────────────────────────────────

  describe('quota system', () => {
    it('updates quota.current to match food when quota type is food', () => {
      gs.quota.type = 'food';
      gs.food = 350;
      engine.tick();
      expect(gs.quota.current).toBe(gs.food);
    });

    it('updates quota.current to match vodka when quota type is vodka', () => {
      gs.quota.type = 'vodka';
      gs.vodka = 75;
      engine.tick();
      expect(gs.quota.current).toBe(gs.vodka);
    });

    it('shows success advisor and advances to vodka quota on year rollover when quota is met', () => {
      gs.date.tick = 5;
      gs.date.month = 12;
      gs.date.year = 1985;
      gs.quota.deadlineYear = 1986;
      gs.food = 600;
      gs.quota.type = 'food';
      gs.quota.target = 500;
      gs.quota.current = 600;

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();

      expect(cb.onAdvisor).toHaveBeenCalledWith(
        expect.stringContaining('Quota met'),
      );
      expect(gs.quota.type).toBe('vodka');
      expect(gs.quota.target).toBe(500);
      expect(gs.quota.deadlineYear).toBe(1991);
    });

    it('shows game-over advisor when quota is failed', () => {
      gs.date.tick = 5;
      gs.date.month = 12;
      gs.date.year = 1985;
      gs.quota.deadlineYear = 1985;
      gs.food = 100;
      gs.quota.type = 'food';
      gs.quota.target = 500;

      engine.tick();

      expect(cb.onAdvisor).toHaveBeenCalledWith(
        expect.stringContaining('failed the 5-Year Plan'),
      );
      expect(gs.quota.deadlineYear).toBe(1990);
    });
  });

  // ── Callback integration ──────────────────────────────────

  describe('callback integration', () => {
    it('calls onStateChange every tick', () => {
      engine.tick();
      expect(cb.onStateChange).toHaveBeenCalledTimes(1);
    });

    it('calls onStateChange on every tick', () => {
      engine.tick();
      engine.tick();
      engine.tick();
      expect(cb.onStateChange).toHaveBeenCalledTimes(3);
    });
  });

  // ── Subsystem access ──────────────────────────────────────

  describe('subsystem access', () => {
    it('exposes the event system', () => {
      const evtSys = engine.getEventSystem();
      expect(evtSys).toBeDefined();
      expect(typeof evtSys.tick).toBe('function');
    });

    it('exposes the pravda system', () => {
      const pravda = engine.getPravdaSystem();
      expect(pravda).toBeDefined();
      expect(typeof pravda.generateAmbientHeadline).toBe('function');
    });
  });
});
