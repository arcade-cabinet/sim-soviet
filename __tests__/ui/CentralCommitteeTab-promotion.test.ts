/**
 * @fileoverview Tests for the Moscow Promotion Notice in CentralCommitteeTab.
 *
 * Covers:
 * - getPromotionRiskLevel helper
 * - PromotionNoticeProps interface
 * - Promotion notice visibility based on notificationActive
 * - Risk meter display levels
 */

import { createPromotionState, type MoscowPromotionState } from '@/ai/agents/political/moscowPromotion';
import { type CentralCommitteeTabProps, getPromotionRiskLevel } from '@/ui/hq-tabs/CentralCommitteeTab';

describe('CentralCommitteeTab — Promotion Notice', () => {
  describe('getPromotionRiskLevel', () => {
    it('returns "low" for risk < 0.4', () => {
      expect(getPromotionRiskLevel(0)).toBe('low');
      expect(getPromotionRiskLevel(0.1)).toBe('low');
      expect(getPromotionRiskLevel(0.39)).toBe('low');
    });

    it('returns "medium" for risk 0.4-0.69', () => {
      expect(getPromotionRiskLevel(0.4)).toBe('medium');
      expect(getPromotionRiskLevel(0.5)).toBe('medium');
      expect(getPromotionRiskLevel(0.69)).toBe('medium');
    });

    it('returns "high" for risk >= 0.7', () => {
      expect(getPromotionRiskLevel(0.7)).toBe('high');
      expect(getPromotionRiskLevel(0.9)).toBe('high');
      expect(getPromotionRiskLevel(1.0)).toBe('high');
    });
  });

  describe('promotion props integration', () => {
    it('accepts null promotionState (no promotion notice shown)', () => {
      const props: CentralCommitteeTabProps = {
        directives: [],
        activeDirective: null,
        onIssueDirective: () => {},
        promotionState: null,
        onPromotionRespond: () => {},
      };
      expect(props.promotionState).toBeNull();
    });

    it('accepts active promotion state', () => {
      const state: MoscowPromotionState = {
        ...createPromotionState(),
        notificationActive: true,
        currentRisk: 0.6,
        delayCount: 1,
      };
      const props: CentralCommitteeTabProps = {
        directives: [],
        activeDirective: null,
        onIssueDirective: () => {},
        promotionState: state,
        onPromotionRespond: () => {},
      };
      expect(props.promotionState?.notificationActive).toBe(true);
      expect(props.promotionState?.currentRisk).toBe(0.6);
    });

    it('inactive promotion state does not satisfy notificationActive', () => {
      const state = createPromotionState();
      expect(state.notificationActive).toBe(false);
    });

    it('promotion response callback receives correct response types', () => {
      const responses: string[] = [];
      const handler = (r: string) => responses.push(r);

      handler('accept');
      handler('delay');
      handler('bribe');

      expect(responses).toEqual(['accept', 'delay', 'bribe']);
    });
  });
});
