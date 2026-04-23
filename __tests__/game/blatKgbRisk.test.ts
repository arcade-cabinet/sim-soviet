import { GameRng } from '@/game/SeedSystem';
import {
  BLAT_ARREST_THRESHOLD,
  BLAT_SAFE_THRESHOLD,
  EconomySystem,
  KGB_INVESTIGATION_CHANCE_PER_POINT,
} from '../../src/ai/agents/economy/economy-core';
import { PersonnelFile } from '../../src/ai/agents/political/KGBAgent';

// ─────────────────────────────────────────────────────────────────────────────
//  BLAT KGB RISK — Passive per-tick investigation/arrest mechanic
// ─────────────────────────────────────────────────────────────────────────────

describe('Blat KGB Risk — Constants', () => {
  it('BLAT_SAFE_THRESHOLD is 15', () => {
    expect(BLAT_SAFE_THRESHOLD).toBe(15);
  });

  it('BLAT_ARREST_THRESHOLD is 30', () => {
    expect(BLAT_ARREST_THRESHOLD).toBe(30);
  });

  it('KGB_INVESTIGATION_CHANCE_PER_POINT is tuned for long campaigns', () => {
    expect(KGB_INVESTIGATION_CHANCE_PER_POINT).toBe(0.00005);
  });

  it('arrest threshold is higher than safe threshold', () => {
    expect(BLAT_ARREST_THRESHOLD).toBeGreaterThan(BLAT_SAFE_THRESHOLD);
  });
});

describe('Blat KGB Risk — Threshold behavior', () => {
  it('returns null when no RNG is set (requires deterministic seed)', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    // No setRng call — system has no seeded RNG
    // Default blat = 10, below threshold, so null anyway
    const result = sys.checkBlatKgbRisk();
    expect(result).toBeNull();
  });

  it('returns null when blat is at or below safe threshold', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.setRng(new GameRng('safe-blat'));

    // Default blat starts at 10, which is below safe threshold (15)
    expect(sys.getBlat().connections).toBe(10);

    const result = sys.checkBlatKgbRisk();
    expect(result).toBeNull();
  });

  it('returns null when blat is exactly at safe threshold', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.setRng(new GameRng('exact-threshold'));

    // Grant blat to reach exactly 15
    sys.grantBlat(5); // 10 + 5 = 15
    expect(sys.getBlat().connections).toBe(15);

    const result = sys.checkBlatKgbRisk();
    expect(result).toBeNull();
  });

  it('can trigger investigation when blat is above safe threshold', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const rng = new GameRng('forced-kgb-investigation');
    jest.spyOn(rng, 'random').mockReturnValue(0);
    sys.setRng(rng);
    sys.grantBlat(15); // blat = 25, 10 excess points

    const result = sys.checkBlatKgbRisk();
    expect(result?.investigated).toBe(true);
    expect(result!.announcement).not.toBeNull();
    expect(result!.announcement!.length).toBeGreaterThan(0);
  });

  it('does not always trigger investigation at moderate blat', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const rng = new GameRng('moderate-blat');
    jest.spyOn(rng, 'random').mockReturnValue(0.99);
    sys.setRng(rng);
    sys.grantBlat(6); // blat goes from 10 to 16

    expect(sys.checkBlatKgbRisk()).toBeNull();
  });
});

describe('Blat KGB Risk — Investigation probability scaling', () => {
  it('higher blat produces a higher investigation probability', () => {
    const lowExcess = 16 - BLAT_SAFE_THRESHOLD;
    const highExcess = 60 - BLAT_SAFE_THRESHOLD;

    expect(highExcess * KGB_INVESTIGATION_CHANCE_PER_POINT).toBeGreaterThan(
      lowExcess * KGB_INVESTIGATION_CHANCE_PER_POINT,
    );
  });

  it('at 25 connections (10 excess), per-tick risk stays rare', () => {
    const excess = 25 - BLAT_SAFE_THRESHOLD;
    const chance = excess * KGB_INVESTIGATION_CHANCE_PER_POINT;

    expect(chance).toBe(0.0005);
    expect(chance).toBeLessThan(0.001);
  });
});

describe('Blat KGB Risk — Arrest at high blat', () => {
  it('can trigger arrest when blat exceeds arrest threshold (>30)', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const rng = new GameRng('forced-arrest');
    jest.spyOn(rng, 'random').mockReturnValue(0);
    sys.setRng(rng);
    sys.grantBlat(50); // blat = 60, well above arrest threshold

    const result = sys.checkBlatKgbRisk();
    expect(result?.arrested).toBe(true);
    expect(result!.announcement).not.toBeNull();
    expect(result!.announcement!).toContain('KGB');
  });

  it('arrest is not possible when blat is at or below arrest threshold', () => {
    // At blat = 30 (arrest threshold), arrest should never trigger
    const trials = 500;
    let arrests = 0;
    for (let i = 0; i < trials; i++) {
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(new GameRng(`no-arrest-${i}`));
      sys.grantBlat(20); // blat = 30, which is exactly BLAT_ARREST_THRESHOLD
      // Arrest requires > threshold, not >=
      const result = sys.checkBlatKgbRisk();
      if (result?.arrested) arrests++;
    }
    expect(arrests).toBe(0);
  });
});

describe('Blat KGB Risk — PersonnelFile integration', () => {
  it('investigation result can be used to add a black mark', () => {
    const pf = new PersonnelFile('comrade');
    expect(pf.getBlackMarks()).toBe(0);

    // Simulate what SimulationEngine does with the result
    pf.addMark('blat_noticed', 100, 'KGB investigation into blat connections');
    expect(pf.getBlackMarks()).toBe(1);
    expect(pf.getThreatLevel()).toBe('safe'); // 1 mark = safe
  });

  it('multiple investigations accumulate marks toward arrest', () => {
    const pf = new PersonnelFile('comrade');

    // Each blat_noticed adds 1 mark. At 7 effective marks = arrested.
    for (let i = 0; i < 7; i++) {
      pf.addMark('blat_noticed', i * 10, 'KGB investigation');
    }
    expect(pf.getBlackMarks()).toBe(7);
    expect(pf.isArrested()).toBe(true);
  });

  it('arrested result adds an additional mark (double penalty)', () => {
    const pf = new PersonnelFile('comrade');

    // Simulate both investigation AND arrest in same tick
    pf.addMark('blat_noticed', 100, 'Investigation');
    pf.addMark('blat_noticed', 100, 'Arrest');
    expect(pf.getBlackMarks()).toBe(2);
  });
});

describe('Blat KGB Risk — tick() integration', () => {
  it('tick result includes blatKgbResult field', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.setRng(new GameRng('tick-kgb'));

    const result = sys.tick(0, 1960, 100, ['factory']);
    expect(result).toHaveProperty('blatKgbResult');
  });

  it('tick with low blat returns null blatKgbResult', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.setRng(new GameRng('tick-safe'));

    // Default blat = 10, below safe threshold (15)
    const result = sys.tick(0, 1960, 100, ['factory']);
    expect(result.blatKgbResult).toBeNull();
  });

  it('tick with high blat can return non-null blatKgbResult', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const rng = new GameRng('tick-high-blat');
    jest.spyOn(rng, 'random').mockReturnValue(0);
    sys.setRng(rng);
    sys.grantBlat(40); // blat = 50, well above threshold

    const result = sys.tick(0, 1960, 100, ['factory']);
    expect(result.blatKgbResult).not.toBeNull();
  });
});

describe('Blat KGB Risk — Determinism', () => {
  it('same seed produces identical KGB results', () => {
    const make = () => {
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(new GameRng('determinism-kgb'));
      sys.grantBlat(30); // blat = 40
      return sys.checkBlatKgbRisk();
    };

    const r1 = make();
    const r2 = make();

    if (r1 === null) {
      expect(r2).toBeNull();
    } else {
      expect(r2).not.toBeNull();
      expect(r1.investigated).toBe(r2!.investigated);
      expect(r1.arrested).toBe(r2!.arrested);
    }
  });
});
