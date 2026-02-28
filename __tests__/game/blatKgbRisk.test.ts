import {
  BLAT_ARREST_THRESHOLD,
  BLAT_SAFE_THRESHOLD,
  EconomySystem,
  KGB_INVESTIGATION_CHANCE_PER_POINT,
} from '@/game/economy';
import { PersonnelFile } from '@/game/PersonnelFile';
import { GameRng } from '@/game/SeedSystem';

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

  it('KGB_INVESTIGATION_CHANCE_PER_POINT is 0.01', () => {
    expect(KGB_INVESTIGATION_CHANCE_PER_POINT).toBe(0.01);
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
    // With blat at 25 (10 excess), excessPoints = 10, chance = 10%
    let foundInvestigation = false;
    for (let i = 0; i < 200; i++) {
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(new GameRng(`kgb-investigation-${i}`));
      sys.grantBlat(15); // blat = 25, 10 excess points

      const result = sys.checkBlatKgbRisk();
      if (result?.investigated) {
        foundInvestigation = true;
        expect(result.announcement).not.toBeNull();
        expect(result.announcement!.length).toBeGreaterThan(0);
        break;
      }
    }
    expect(foundInvestigation).toBe(true);
  });

  it('does not always trigger investigation at moderate blat', () => {
    // With blat at 16 (1 above threshold), chance is only 1%
    // Most attempts should NOT trigger
    let safeCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(new GameRng(`moderate-blat-${i}`));
      sys.grantBlat(6); // blat goes from 10 to 16

      const result = sys.checkBlatKgbRisk();
      if (result === null) safeCount++;
    }
    // At 1% chance, we expect ~99 safe out of 100
    expect(safeCount).toBeGreaterThan(80);
  });
});

describe('Blat KGB Risk — Investigation probability scaling', () => {
  it('higher blat means more investigations over many trials', () => {
    const trials = 500;

    // Low blat (16 connections, 1 excess = 1% chance)
    let lowInvestigations = 0;
    for (let i = 0; i < trials; i++) {
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(new GameRng(`low-excess-${i}`));
      sys.grantBlat(6); // 10 → 16
      const result = sys.checkBlatKgbRisk();
      if (result?.investigated) lowInvestigations++;
    }

    // High blat (60 connections, 45 excess = 45% chance)
    let highInvestigations = 0;
    for (let i = 0; i < trials; i++) {
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(new GameRng(`high-excess-${i}`));
      sys.grantBlat(50); // 10 + 50 = 60
      const result = sys.checkBlatKgbRisk();
      if (result?.investigated) highInvestigations++;
    }

    // High blat should trigger significantly more investigations
    expect(highInvestigations).toBeGreaterThan(lowInvestigations);
  });

  it('1% per excess point: at 25 connections (10 excess), ~10% trigger rate', () => {
    const trials = 1000;
    let investigations = 0;
    for (let i = 0; i < trials; i++) {
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(new GameRng(`rate-check-${i}`));
      sys.grantBlat(15); // blat = 25, excess = 10, chance = 10%
      const result = sys.checkBlatKgbRisk();
      if (result?.investigated) investigations++;
    }
    // Expected ~100 out of 1000. Allow wide tolerance for RNG.
    expect(investigations).toBeGreaterThan(40);
    expect(investigations).toBeLessThan(200);
  });
});

describe('Blat KGB Risk — Arrest at high blat', () => {
  it('can trigger arrest when blat exceeds arrest threshold (>30)', () => {
    let foundArrest = false;
    for (let i = 0; i < 500; i++) {
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(new GameRng(`arrest-${i}`));
      sys.grantBlat(50); // blat = 60, well above arrest threshold

      const result = sys.checkBlatKgbRisk();
      if (result?.arrested) {
        foundArrest = true;
        expect(result.announcement).not.toBeNull();
        expect(result.announcement!).toContain('KGB');
        break;
      }
    }
    expect(foundArrest).toBe(true);
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
    let foundKgb = false;
    for (let i = 0; i < 200; i++) {
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(new GameRng(`tick-high-blat-${i}`));
      sys.grantBlat(40); // blat = 50, well above threshold

      const result = sys.tick(0, 1960, 100, ['factory']);
      if (result.blatKgbResult !== null) {
        foundKgb = true;
        break;
      }
    }
    expect(foundKgb).toBe(true);
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
