import {
  CONSEQUENCE_PRESETS,
  type ConsequenceLevel,
  DIFFICULTY_PRESETS,
  type DifficultyLevel,
  getEraMultiplier,
  getSettingsMultiplier,
  MEDALS,
  SCORE_MULTIPLIER_MATRIX,
  ScoringSystem,
} from '../../src/game/ScoringSystem';

describe('ScoringSystem', () => {
  // ── Difficulty Presets ───────────────────────────────

  describe('difficulty presets', () => {
    it('has exactly 3 difficulty levels', () => {
      const keys = Object.keys(DIFFICULTY_PRESETS) as DifficultyLevel[];
      expect(keys).toHaveLength(3);
      expect(keys).toContain('worker');
      expect(keys).toContain('comrade');
      expect(keys).toContain('tovarish');
    });

    it('worker has 0.6x quota multiplier per design doc', () => {
      expect(DIFFICULTY_PRESETS.worker.quotaMultiplier).toBe(0.6);
    });

    it('comrade has 1.0x quota multiplier', () => {
      expect(DIFFICULTY_PRESETS.comrade.quotaMultiplier).toBe(1.0);
    });

    it('tovarish has 1.5x quota multiplier per design doc', () => {
      expect(DIFFICULTY_PRESETS.tovarish.quotaMultiplier).toBe(1.5);
    });

    it('worker mark decay is 360 ticks (1/year)', () => {
      expect(DIFFICULTY_PRESETS.worker.markDecayTicks).toBe(360);
    });

    it('comrade mark decay is 720 ticks (1/2 years)', () => {
      expect(DIFFICULTY_PRESETS.comrade.markDecayTicks).toBe(720);
    });

    it('tovarish mark decay is 1440 ticks (1/4 years)', () => {
      expect(DIFFICULTY_PRESETS.tovarish.markDecayTicks).toBe(1440);
    });

    it('worker has 1:40 politruk ratio', () => {
      expect(DIFFICULTY_PRESETS.worker.politrukRatio).toBe(40);
    });

    it('tovarish has 1:8 politruk ratio', () => {
      expect(DIFFICULTY_PRESETS.tovarish.politrukRatio).toBe(8);
    });

    it('all difficulties have complete configs', () => {
      for (const key of Object.keys(DIFFICULTY_PRESETS) as DifficultyLevel[]) {
        const cfg = DIFFICULTY_PRESETS[key];
        expect(cfg.label).toBeTruthy();
        expect(cfg.quotaMultiplier).toBeGreaterThan(0);
        expect(cfg.markDecayTicks).toBeGreaterThan(0);
        expect(cfg.politrukRatio).toBeGreaterThan(0);
        expect(cfg.growthMultiplier).toBeGreaterThan(0);
        expect(cfg.decayMultiplier).toBeGreaterThan(0);
        expect(cfg.resourceMultiplier).toBeGreaterThan(0);
      }
    });
  });

  // ── Consequence Presets ─────────────────────────────

  describe('consequence presets', () => {
    it('has exactly 3 consequence levels', () => {
      const keys = Object.keys(CONSEQUENCE_PRESETS) as ConsequenceLevel[];
      expect(keys).toHaveLength(3);
      expect(keys).toContain('forgiving');
      expect(keys).toContain('permadeath');
      expect(keys).toContain('harsh');
    });

    it('forgiving returns after 1 year with 90% buildings', () => {
      const cfg = CONSEQUENCE_PRESETS.forgiving;
      expect(cfg.returnDelayYears).toBe(1);
      expect(cfg.buildingSurvival).toBe(0.9);
      expect(cfg.workerSurvival).toBe(0.8);
      expect(cfg.resourceSurvival).toBe(0.5);
      expect(cfg.marksReset).toBe(1);
      expect(cfg.scorePenalty).toBe(100);
      expect(cfg.permadeath).toBe(false);
    });

    it('permadeath is game over with 1.5x score multiplier', () => {
      const cfg = CONSEQUENCE_PRESETS.permadeath;
      expect(cfg.permadeath).toBe(true);
      expect(cfg.permadeathScoreMultiplier).toBe(1.5);
      expect(cfg.returnDelayYears).toBe(0);
    });

    it('harsh returns after 3 years with 40% buildings', () => {
      const cfg = CONSEQUENCE_PRESETS.harsh;
      expect(cfg.returnDelayYears).toBe(3);
      expect(cfg.buildingSurvival).toBe(0.4);
      expect(cfg.workerSurvival).toBe(0.25);
      expect(cfg.resourceSurvival).toBe(0.1);
      expect(cfg.marksReset).toBe(2);
      expect(cfg.scorePenalty).toBe(300);
      expect(cfg.permadeath).toBe(false);
    });
  });

  // ── Score Multiplier Matrix ─────────────────────────

  describe('score multiplier matrix', () => {
    it('worker + forgiving = 0.5x', () => {
      expect(SCORE_MULTIPLIER_MATRIX.worker.forgiving).toBe(0.5);
    });

    it('worker + permadeath = 1.0x', () => {
      expect(SCORE_MULTIPLIER_MATRIX.worker.permadeath).toBe(1.0);
    });

    it('comrade + forgiving = 0.8x', () => {
      expect(SCORE_MULTIPLIER_MATRIX.comrade.forgiving).toBe(0.8);
    });

    it('comrade + permadeath = 1.5x', () => {
      expect(SCORE_MULTIPLIER_MATRIX.comrade.permadeath).toBe(1.5);
    });

    it('comrade + harsh = 1.2x', () => {
      expect(SCORE_MULTIPLIER_MATRIX.comrade.harsh).toBe(1.2);
    });

    it('tovarish + forgiving = 1.0x', () => {
      expect(SCORE_MULTIPLIER_MATRIX.tovarish.forgiving).toBe(1.0);
    });

    it('tovarish + permadeath = 2.0x', () => {
      expect(SCORE_MULTIPLIER_MATRIX.tovarish.permadeath).toBe(2.0);
    });

    it('tovarish + harsh = 1.8x', () => {
      expect(SCORE_MULTIPLIER_MATRIX.tovarish.harsh).toBe(1.8);
    });

    it('getSettingsMultiplier matches matrix', () => {
      expect(getSettingsMultiplier('worker', 'forgiving')).toBe(0.5);
      expect(getSettingsMultiplier('tovarish', 'permadeath')).toBe(2.0);
    });
  });

  // ── Era Multiplier ──────────────────────────────────

  describe('era multiplier', () => {
    it('era 1 (index 0) = 1.0x', () => {
      expect(getEraMultiplier(0)).toBeCloseTo(1.0);
    });

    it('era 8 (index 7) = 3.0x', () => {
      expect(getEraMultiplier(7)).toBeCloseTo(3.0);
    });

    it('era 4 (index 3) is approximately 1.857x', () => {
      expect(getEraMultiplier(3)).toBeCloseTo(1.0 + (3 * 2.0) / 7, 3);
    });

    it('linearly increases from 1.0 to 3.0', () => {
      for (let i = 0; i < 8; i++) {
        const expected = 1.0 + (i * 2.0) / 7;
        expect(getEraMultiplier(i)).toBeCloseTo(expected, 5);
      }
    });

    it('clamps negative indices to 0', () => {
      expect(getEraMultiplier(-1)).toBeCloseTo(1.0);
    });

    it('clamps indices above 7', () => {
      expect(getEraMultiplier(10)).toBeCloseTo(3.0);
    });
  });

  // ── Initial State ───────────────────────────────────

  describe('initial state', () => {
    it('defaults to comrade + permadeath', () => {
      const sys = new ScoringSystem();
      expect(sys.getDifficulty()).toBe('comrade');
      expect(sys.getConsequence()).toBe('permadeath');
    });

    it('starts with 0 final score', () => {
      const sys = new ScoringSystem();
      expect(sys.getFinalScore()).toBe(0);
    });

    it('starts with 0 eras completed and 0 quotas met', () => {
      const sys = new ScoringSystem();
      expect(sys.getErasCompleted()).toBe(0);
      expect(sys.getTotalQuotasMet()).toBe(0);
    });

    it('starts with no medals', () => {
      const sys = new ScoringSystem();
      expect(sys.getAwardedMedalIds().size).toBe(0);
    });

    it('score breakdown starts empty', () => {
      const sys = new ScoringSystem();
      const breakdown = sys.getScoreBreakdown();
      expect(breakdown.eras).toHaveLength(0);
      expect(breakdown.subtotal).toBe(0);
      expect(breakdown.finalScore).toBe(0);
    });
  });

  // ── Score Accumulation at Era End ───────────────────

  describe('onEraEnd', () => {
    it('calculates workers alive points (+2 each)', () => {
      const sys = new ScoringSystem();
      sys.onEraEnd(0, 'Test Era', 100, 0, 0, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.workersAlive).toBe(100);
      expect(era.workersAlivePoints).toBe(200);
    });

    it('calculates buildings standing points (+5 each)', () => {
      const sys = new ScoringSystem();
      sys.onEraEnd(0, 'Test Era', 0, 20, 0, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.buildingsStanding).toBe(20);
      expect(era.buildingsStandingPoints).toBe(100);
    });

    it('calculates commendation points (+30 each)', () => {
      const sys = new ScoringSystem();
      sys.onEraEnd(0, 'Test Era', 0, 0, 3, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.commendationsPoints).toBe(90);
    });

    it('calculates black mark penalty (-40 each)', () => {
      const sys = new ScoringSystem();
      sys.onEraEnd(0, 'Test Era', 0, 0, 0, 2);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.blackMarksPoints).toBe(-80);
    });

    it('includes quota met points (+50 each)', () => {
      const sys = new ScoringSystem();
      sys.onQuotaMet();
      sys.onQuotaMet();
      sys.onEraEnd(0, 'Test Era', 0, 0, 0, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.quotasMet).toBe(2);
      expect(era.quotasMetPoints).toBe(100);
    });

    it('includes quota exceeded points (+25 each)', () => {
      const sys = new ScoringSystem();
      sys.onQuotaExceeded();
      sys.onEraEnd(0, 'Test Era', 0, 0, 0, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.quotasExceededPoints).toBe(25);
    });

    it('includes KGB loss penalty (-10 each)', () => {
      const sys = new ScoringSystem();
      sys.onKGBLoss(5);
      sys.onEraEnd(0, 'Test Era', 0, 0, 0, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.kgbLosses).toBe(5);
      expect(era.kgbLossesPoints).toBe(-50);
    });

    it('includes conscription penalty (-5 each)', () => {
      const sys = new ScoringSystem();
      sys.onConscription(10);
      sys.onEraEnd(0, 'Test Era', 0, 0, 0, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.conscripted).toBe(10);
      expect(era.conscriptedPoints).toBe(-50);
    });

    it('grants clean era bonus (+100) when no investigation', () => {
      const sys = new ScoringSystem();
      sys.onEraEnd(0, 'Test Era', 0, 0, 0, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.cleanEraBonus).toBe(100);
    });

    it('denies clean era bonus when investigated', () => {
      const sys = new ScoringSystem();
      sys.onInvestigation();
      sys.onEraEnd(0, 'Test Era', 0, 0, 0, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      expect(era.cleanEraBonus).toBe(0);
    });

    it('applies era multiplier', () => {
      const sys = new ScoringSystem();
      sys.onEraEnd(7, 'Eternal Soviet', 100, 0, 0, 0);
      const era = sys.getScoreBreakdown().eras[0]!;
      // 100 workers * 2 = 200 + clean era 100 = 300, x3.0 = 900
      expect(era.rawTotal).toBe(300);
      expect(era.eraMultiplier).toBeCloseTo(3.0);
      expect(era.eraTotal).toBe(900);
    });

    it('resets per-era counters after onEraEnd', () => {
      const sys = new ScoringSystem();
      sys.onQuotaMet();
      sys.onKGBLoss(3);
      sys.onConscription(2);
      sys.onInvestigation();
      sys.onEraEnd(0, 'Era 1', 50, 10, 1, 0);

      // Second era should start fresh
      sys.onEraEnd(1, 'Era 2', 50, 10, 1, 0);
      const era2 = sys.getScoreBreakdown().eras[1]!;
      expect(era2.quotasMet).toBe(0);
      expect(era2.kgbLosses).toBe(0);
      expect(era2.conscripted).toBe(0);
      expect(era2.cleanEraBonus).toBe(100); // not investigated in era 2
    });

    it('accumulates across multiple eras', () => {
      const sys = new ScoringSystem('comrade', 'permadeath');
      sys.onQuotaMet();
      sys.onEraEnd(0, 'Era 1', 50, 10, 1, 0);
      sys.onQuotaMet();
      sys.onEraEnd(1, 'Era 2', 80, 15, 2, 1);

      const breakdown = sys.getScoreBreakdown();
      expect(breakdown.eras).toHaveLength(2);
      expect(breakdown.subtotal).toBe(breakdown.eras[0]!.eraTotal + breakdown.eras[1]!.eraTotal);
    });
  });

  // ── Final Score with Settings Multiplier ────────────

  describe('getFinalScore', () => {
    it('applies settings multiplier to subtotal', () => {
      const sys = new ScoringSystem('tovarish', 'permadeath'); // 2.0x
      sys.onEraEnd(0, 'Test Era', 100, 10, 2, 0);
      const breakdown = sys.getScoreBreakdown();
      expect(breakdown.settingsMultiplier).toBe(2.0);
      expect(breakdown.finalScore).toBe(Math.floor(breakdown.subtotal * 2.0));
    });

    it('worker + forgiving halves the score', () => {
      const sys = new ScoringSystem('worker', 'forgiving'); // 0.5x
      sys.onEraEnd(0, 'Test Era', 100, 10, 2, 0);
      const breakdown = sys.getScoreBreakdown();
      expect(breakdown.settingsMultiplier).toBe(0.5);
      expect(breakdown.finalScore).toBe(Math.floor(breakdown.subtotal * 0.5));
    });
  });

  // ── Partial Era Score ───────────────────────────────

  describe('getCurrentEraPartialScore', () => {
    it('returns score for in-progress era', () => {
      const sys = new ScoringSystem();
      sys.onQuotaMet();
      sys.onKGBLoss(2);

      const partial = sys.getCurrentEraPartialScore(3, 'Mid-Era', 75, 12, 1, 0);
      expect(partial.quotasMet).toBe(1);
      expect(partial.kgbLosses).toBe(2);
      expect(partial.workersAlive).toBe(75);
      expect(partial.eraMultiplier).toBeCloseTo(getEraMultiplier(3));
    });
  });

  // ── Medals ──────────────────────────────────────────

  describe('medals', () => {
    it('MEDALS array has at least 10 entries', () => {
      expect(MEDALS.length).toBeGreaterThanOrEqual(10);
    });

    it('all medals have unique IDs', () => {
      const ids = MEDALS.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('awardMedal returns true for new, false for duplicate', () => {
      const sys = new ScoringSystem();
      expect(sys.awardMedal('red_potato')).toBe(true);
      expect(sys.awardMedal('red_potato')).toBe(false);
    });

    it('getAwardedMedals returns correct objects', () => {
      const sys = new ScoringSystem();
      sys.awardMedal('red_potato');
      sys.awardMedal('vodka_diplomat');
      const awarded = sys.getAwardedMedals();
      expect(awarded).toHaveLength(2);
      expect(awarded.map((m) => m.id)).toContain('red_potato');
    });
  });

  // ── Config Accessors ────────────────────────────────

  describe('config accessors', () => {
    it('getDifficultyConfig returns a copy', () => {
      const sys = new ScoringSystem('worker');
      const cfg = sys.getDifficultyConfig();
      cfg.quotaMultiplier = 999;
      expect(sys.getDifficultyConfig().quotaMultiplier).toBe(0.6);
    });

    it('getConsequenceConfig returns a copy', () => {
      const sys = new ScoringSystem('comrade', 'harsh');
      const cfg = sys.getConsequenceConfig();
      cfg.scorePenalty = 999;
      expect(sys.getConsequenceConfig().scorePenalty).toBe(300);
    });

    it('getSettingsMultiplier matches matrix', () => {
      const sys = new ScoringSystem('tovarish', 'harsh');
      expect(sys.getSettingsMultiplier()).toBe(1.8);
    });
  });

  // ── Serialization ───────────────────────────────────

  describe('serialize / deserialize', () => {
    it('round-trips correctly', () => {
      const original = new ScoringSystem('tovarish', 'harsh');
      original.onQuotaMet();
      original.onQuotaExceeded();
      original.onKGBLoss(3);
      original.onConscription(2);
      original.onInvestigation();
      original.onEraEnd(0, 'War Communism', 100, 20, 3, 1);
      original.onQuotaMet();
      original.awardMedal('red_potato');

      const data = original.serialize();
      const restored = ScoringSystem.deserialize(data);

      expect(restored.getDifficulty()).toBe('tovarish');
      expect(restored.getConsequence()).toBe('harsh');
      expect(restored.getErasCompleted()).toBe(1);
      expect(restored.getTotalQuotasMet()).toBe(2); // 1 from era + 1 current
      expect(restored.getFinalScore()).toBe(original.getFinalScore());
      expect([...restored.getAwardedMedalIds()]).toEqual([...original.getAwardedMedalIds()]);
    });

    it('preserves in-progress era counters', () => {
      const original = new ScoringSystem('comrade', 'permadeath');
      original.onKGBLoss(5);
      original.onConscription(3);
      original.onInvestigation();

      const data = original.serialize();
      expect(data.currentEraKGBLosses).toBe(5);
      expect(data.currentEraConscripted).toBe(3);
      expect(data.currentEraInvestigated).toBe(true);

      const restored = ScoringSystem.deserialize(data);
      // These counters should be preserved
      const partial = restored.getCurrentEraPartialScore(0, 'Test', 50, 10, 0, 0);
      expect(partial.kgbLosses).toBe(5);
      expect(partial.conscripted).toBe(3);
      expect(partial.cleanEraBonus).toBe(0);
    });
  });
});
