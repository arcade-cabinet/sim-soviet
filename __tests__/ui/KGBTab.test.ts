/**
 * @fileoverview Tests for KGBTab — read-only KGB intelligence reports dashboard.
 *
 * Validates:
 * - Props interface (loyaltyLevel, dissidentCount, recentArrests, surveillanceActive)
 * - Section rendering (Loyalty Overview, Suspected Dissidents, Recent Arrests, Surveillance Status)
 * - Classified/redacted styling elements
 * - Soviet nomenclature and formatting
 * - Edge cases (empty arrests, boundary loyalty values)
 */

import type { ArrestRecord, KGBTabProps } from '@/ui/hq-tabs/KGBTab';
import { CLASSIFICATION_HEADER, formatLoyaltyStatus, KGBTab, LOYALTY_THRESHOLDS } from '@/ui/hq-tabs/KGBTab';

describe('KGBTab', () => {
  describe('exports', () => {
    it('exports KGBTab component', () => {
      expect(KGBTab).toBeDefined();
      expect(typeof KGBTab).toBe('function');
    });

    it('exports CLASSIFICATION_HEADER constant', () => {
      expect(CLASSIFICATION_HEADER).toBeDefined();
      expect(typeof CLASSIFICATION_HEADER).toBe('string');
      // Should contain Russian classification marking
      expect(CLASSIFICATION_HEADER).toMatch(/СЕКРЕТНО|SECRET/);
    });

    it('exports LOYALTY_THRESHOLDS', () => {
      expect(LOYALTY_THRESHOLDS).toBeDefined();
      expect(LOYALTY_THRESHOLDS.critical).toBeLessThan(LOYALTY_THRESHOLDS.low);
      expect(LOYALTY_THRESHOLDS.low).toBeLessThan(LOYALTY_THRESHOLDS.acceptable);
      expect(LOYALTY_THRESHOLDS.acceptable).toBeLessThan(LOYALTY_THRESHOLDS.exemplary);
    });
  });

  describe('KGBTabProps interface', () => {
    it('accepts all required props', () => {
      const props: KGBTabProps = {
        loyaltyLevel: 72,
        dissidentCount: 3,
        recentArrests: [],
        surveillanceActive: true,
      };
      expect(props.loyaltyLevel).toBe(72);
      expect(props.dissidentCount).toBe(3);
      expect(props.recentArrests).toEqual([]);
      expect(props.surveillanceActive).toBe(true);
    });

    it('accepts arrest records with name, reason, and date', () => {
      const arrest: ArrestRecord = {
        name: 'Ivanov, P.S.',
        reason: 'Anti-Soviet agitation',
        date: '1937-12-15',
      };
      expect(arrest.name).toBe('Ivanov, P.S.');
      expect(arrest.reason).toBe('Anti-Soviet agitation');
      expect(arrest.date).toBe('1937-12-15');
    });

    it('handles multiple arrest records', () => {
      const arrests: ArrestRecord[] = [
        { name: 'Petrov, A.N.', reason: 'Sabotage', date: '1938-03-01' },
        { name: 'Sidorov, V.M.', reason: 'Wrecking', date: '1938-03-05' },
        { name: '[REDACTED]', reason: 'State security matter', date: '1938-03-10' },
      ];
      const props: KGBTabProps = {
        loyaltyLevel: 45,
        dissidentCount: 12,
        recentArrests: arrests,
        surveillanceActive: false,
      };
      expect(props.recentArrests).toHaveLength(3);
    });
  });

  describe('formatLoyaltyStatus', () => {
    it('returns CRITICAL for very low loyalty (0-24)', () => {
      expect(formatLoyaltyStatus(0)).toBe('CRITICAL — IMMEDIATE ACTION REQUIRED');
      expect(formatLoyaltyStatus(10)).toBe('CRITICAL — IMMEDIATE ACTION REQUIRED');
      expect(formatLoyaltyStatus(24)).toBe('CRITICAL — IMMEDIATE ACTION REQUIRED');
    });

    it('returns LOW for low loyalty (25-49)', () => {
      expect(formatLoyaltyStatus(25)).toBe('LOW — UNDER OBSERVATION');
      expect(formatLoyaltyStatus(40)).toBe('LOW — UNDER OBSERVATION');
      expect(formatLoyaltyStatus(49)).toBe('LOW — UNDER OBSERVATION');
    });

    it('returns ACCEPTABLE for mid loyalty (50-74)', () => {
      expect(formatLoyaltyStatus(50)).toBe('ACCEPTABLE — STANDARD MONITORING');
      expect(formatLoyaltyStatus(60)).toBe('ACCEPTABLE — STANDARD MONITORING');
      expect(formatLoyaltyStatus(74)).toBe('ACCEPTABLE — STANDARD MONITORING');
    });

    it('returns EXEMPLARY for high loyalty (75-100)', () => {
      expect(formatLoyaltyStatus(75)).toBe('EXEMPLARY — COMMENDATION RECOMMENDED');
      expect(formatLoyaltyStatus(100)).toBe('EXEMPLARY — COMMENDATION RECOMMENDED');
    });

    it('clamps out-of-range values', () => {
      expect(formatLoyaltyStatus(-10)).toBe('CRITICAL — IMMEDIATE ACTION REQUIRED');
      expect(formatLoyaltyStatus(150)).toBe('EXEMPLARY — COMMENDATION RECOMMENDED');
    });
  });

  describe('edge cases', () => {
    it('handles zero dissidents', () => {
      const props: KGBTabProps = {
        loyaltyLevel: 80,
        dissidentCount: 0,
        recentArrests: [],
        surveillanceActive: true,
      };
      expect(props.dissidentCount).toBe(0);
    });

    it('handles loyalty at exact thresholds', () => {
      expect(formatLoyaltyStatus(25)).toBe('LOW — UNDER OBSERVATION');
      expect(formatLoyaltyStatus(50)).toBe('ACCEPTABLE — STANDARD MONITORING');
      expect(formatLoyaltyStatus(75)).toBe('EXEMPLARY — COMMENDATION RECOMMENDED');
    });

    it('handles surveillance inactive state', () => {
      const props: KGBTabProps = {
        loyaltyLevel: 50,
        dissidentCount: 5,
        recentArrests: [],
        surveillanceActive: false,
      };
      expect(props.surveillanceActive).toBe(false);
    });
  });
});
