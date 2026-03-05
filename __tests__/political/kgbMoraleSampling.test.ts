/**
 * @fileoverview Tests for KGB morale sampling + Pravda integration.
 *
 * Covers:
 * - KGBAgent.sampleMorale() generates reports at correct thresholds
 * - Morale reports have correct severity classification
 * - High morale samples are ignored (no report)
 * - Reports are trimmed to max capacity
 * - Severity filtering works
 */

import { KGBAgent, MORALE_CONCERN_THRESHOLD, MORALE_WARNING_THRESHOLD, MORALE_CRITICAL_THRESHOLD } from '@/ai/agents/political/KGBAgent';

describe('KGB Morale Sampling', () => {
  let kgb: KGBAgent;

  beforeEach(() => {
    kgb = new KGBAgent('comrade');
  });

  describe('sampleMorale', () => {
    it('generates no report for morale above concern threshold', () => {
      kgb.sampleMorale([{ sectorId: { gridX: 0, gridY: 0 }, avgMorale: 50 }], 100);
      expect(kgb.getMoraleReports()).toHaveLength(0);
    });

    it('generates "concern" report for morale between warning and concern thresholds', () => {
      const morale = MORALE_WARNING_THRESHOLD + 1; // Between 25 and 40
      kgb.sampleMorale([{ sectorId: { gridX: 1, gridY: 2 }, avgMorale: morale }], 100);
      const reports = kgb.getMoraleReports();
      expect(reports).toHaveLength(1);
      expect(reports[0]!.severity).toBe('concern');
      expect(reports[0]!.sectorId).toEqual({ gridX: 1, gridY: 2 });
      expect(reports[0]!.timestamp).toBe(100);
    });

    it('generates "warning" report for morale between critical and warning thresholds', () => {
      const morale = MORALE_CRITICAL_THRESHOLD + 1; // Between 15 and 25
      kgb.sampleMorale([{ sectorId: { gridX: 3, gridY: 4 }, avgMorale: morale }], 200);
      const reports = kgb.getMoraleReports();
      expect(reports).toHaveLength(1);
      expect(reports[0]!.severity).toBe('warning');
    });

    it('generates "critical" report for morale below critical threshold', () => {
      kgb.sampleMorale([{ sectorId: { gridX: 5, gridY: 6 }, avgMorale: 10 }], 300);
      const reports = kgb.getMoraleReports();
      expect(reports).toHaveLength(1);
      expect(reports[0]!.severity).toBe('critical');
    });

    it('handles multiple samples in one call', () => {
      kgb.sampleMorale(
        [
          { sectorId: { gridX: 0, gridY: 0 }, avgMorale: 50 }, // No report
          { sectorId: { gridX: 1, gridY: 1 }, avgMorale: 30 }, // Concern
          { sectorId: { gridX: 2, gridY: 2 }, avgMorale: 10 }, // Critical
        ],
        400,
      );
      const reports = kgb.getMoraleReports();
      expect(reports).toHaveLength(2);
      expect(reports[0]!.severity).toBe('concern');
      expect(reports[1]!.severity).toBe('critical');
    });

    it('trims reports to max capacity (20)', () => {
      // Generate 25 reports
      for (let i = 0; i < 25; i++) {
        kgb.sampleMorale([{ sectorId: { gridX: i, gridY: 0 }, avgMorale: 10 }], i);
      }
      expect(kgb.getMoraleReports().length).toBeLessThanOrEqual(20);
    });
  });

  describe('getMoraleReportsBySeverity', () => {
    it('filters by minimum severity', () => {
      kgb.sampleMorale(
        [
          { sectorId: { gridX: 0, gridY: 0 }, avgMorale: 35 }, // concern
          { sectorId: { gridX: 1, gridY: 1 }, avgMorale: 20 }, // warning
          { sectorId: { gridX: 2, gridY: 2 }, avgMorale: 5 },  // critical
        ],
        500,
      );

      const allReports = kgb.getMoraleReportsBySeverity('concern');
      expect(allReports).toHaveLength(3);

      const warningAndAbove = kgb.getMoraleReportsBySeverity('warning');
      expect(warningAndAbove).toHaveLength(2);

      const criticalOnly = kgb.getMoraleReportsBySeverity('critical');
      expect(criticalOnly).toHaveLength(1);
    });
  });

  describe('threshold constants', () => {
    it('concern threshold is 40', () => {
      expect(MORALE_CONCERN_THRESHOLD).toBe(40);
    });

    it('warning threshold is 25', () => {
      expect(MORALE_WARNING_THRESHOLD).toBe(25);
    });

    it('critical threshold is 15', () => {
      expect(MORALE_CRITICAL_THRESHOLD).toBe(15);
    });

    it('thresholds are ordered: critical < warning < concern', () => {
      expect(MORALE_CRITICAL_THRESHOLD).toBeLessThan(MORALE_WARNING_THRESHOLD);
      expect(MORALE_WARNING_THRESHOLD).toBeLessThan(MORALE_CONCERN_THRESHOLD);
    });
  });
});
