/**
 * @fileoverview Tests for the PolitburoTab component data model:
 * - PolitburoDemand interface and validation
 * - PolitburoTabProps interface and defaults
 * - Satisfaction clamping (0-100)
 * - Demand progress calculations
 * - Prestige project display logic
 * - formatDemandStatus helper
 * - getSatisfactionLabel helper
 */

import {
  formatDemandStatus,
  getDemandProgressPercent,
  getSatisfactionColor,
  getSatisfactionLabel,
  type PolitburoDemand,
  type PolitburoTabProps,
  type PrestigeProjectStatus,
} from '@/ui/hq-tabs/PolitburoTab';

describe('PolitburoTab', () => {
  // ── PolitburoDemand interface ──────────────────────────────────────────

  describe('PolitburoDemand interface', () => {
    it('accepts a valid demand object', () => {
      const demand: PolitburoDemand = {
        type: 'food',
        target: 500,
        current: 250,
        deadline: 1923,
      };
      expect(demand.type).toBe('food');
      expect(demand.target).toBe(500);
      expect(demand.current).toBe(250);
      expect(demand.deadline).toBe(1923);
    });

    it('supports different demand types', () => {
      const types = ['food', 'industrial', 'power', 'housing', 'military'];
      for (const type of types) {
        const demand: PolitburoDemand = { type, target: 100, current: 0, deadline: 1930 };
        expect(demand.type).toBe(type);
      }
    });
  });

  // ── PrestigeProjectStatus interface ────────────────────────────────────

  describe('PrestigeProjectStatus interface', () => {
    it('accepts a valid prestige project status', () => {
      const project: PrestigeProjectStatus = {
        name: 'Grand Factory Complex',
        progress: 1500,
        total: 3000,
      };
      expect(project.name).toBe('Grand Factory Complex');
      expect(project.progress).toBe(1500);
      expect(project.total).toBe(3000);
    });
  });

  // ── PolitburoTabProps interface ────────────────────────────────────────

  describe('PolitburoTabProps interface', () => {
    it('accepts full props with demands and prestige project', () => {
      const props: PolitburoTabProps = {
        demands: [
          { type: 'food', target: 500, current: 300, deadline: 1923 },
          { type: 'industrial', target: 200, current: 50, deadline: 1925 },
        ],
        prestigeProject: { name: 'Monument to Revolution', progress: 100, total: 300 },
        satisfaction: 65,
        onAcceptMandate: () => {},
      };
      expect(props.demands).toHaveLength(2);
      expect(props.prestigeProject).not.toBeNull();
      expect(props.satisfaction).toBe(65);
      expect(typeof props.onAcceptMandate).toBe('function');
    });

    it('accepts null prestige project', () => {
      const props: PolitburoTabProps = {
        demands: [],
        prestigeProject: null,
        satisfaction: 50,
        onAcceptMandate: () => {},
      };
      expect(props.prestigeProject).toBeNull();
    });

    it('accepts empty demands array', () => {
      const props: PolitburoTabProps = {
        demands: [],
        prestigeProject: null,
        satisfaction: 0,
        onAcceptMandate: () => {},
      };
      expect(props.demands).toHaveLength(0);
    });
  });

  // ── getDemandProgressPercent ────────────────────────────────────────────

  describe('getDemandProgressPercent', () => {
    it('returns 0 when current is 0', () => {
      expect(getDemandProgressPercent({ type: 'food', target: 500, current: 0, deadline: 1925 })).toBe(0);
    });

    it('returns 50 when half complete', () => {
      expect(getDemandProgressPercent({ type: 'food', target: 500, current: 250, deadline: 1925 })).toBe(50);
    });

    it('caps at 100 when current exceeds target', () => {
      expect(getDemandProgressPercent({ type: 'food', target: 500, current: 600, deadline: 1925 })).toBe(100);
    });

    it('returns 100 when current equals target', () => {
      expect(getDemandProgressPercent({ type: 'food', target: 500, current: 500, deadline: 1925 })).toBe(100);
    });

    it('returns 0 when target is 0', () => {
      expect(getDemandProgressPercent({ type: 'food', target: 0, current: 0, deadline: 1925 })).toBe(0);
    });
  });

  // ── formatDemandStatus ─────────────────────────────────────────────────

  describe('formatDemandStatus', () => {
    it('formats incomplete demand', () => {
      const result = formatDemandStatus({ type: 'food', target: 500, current: 250, deadline: 1925 });
      expect(result).toBe('250 / 500');
    });

    it('formats complete demand', () => {
      const result = formatDemandStatus({ type: 'food', target: 500, current: 500, deadline: 1925 });
      expect(result).toBe('500 / 500');
    });

    it('formats over-fulfilled demand', () => {
      const result = formatDemandStatus({ type: 'food', target: 500, current: 700, deadline: 1925 });
      expect(result).toBe('700 / 500');
    });
  });

  // ── getSatisfactionLabel ───────────────────────────────────────────────

  describe('getSatisfactionLabel', () => {
    it('returns SUSPICIOUS for satisfaction > 90', () => {
      expect(getSatisfactionLabel(95)).toBe('SUSPICIOUS');
    });

    it('returns ACCEPTABLE for satisfaction 60-90', () => {
      expect(getSatisfactionLabel(75)).toBe('ACCEPTABLE');
      expect(getSatisfactionLabel(60)).toBe('ACCEPTABLE');
      expect(getSatisfactionLabel(90)).toBe('ACCEPTABLE');
    });

    it('returns CONCERNING for satisfaction 30-59', () => {
      expect(getSatisfactionLabel(45)).toBe('CONCERNING');
      expect(getSatisfactionLabel(30)).toBe('CONCERNING');
      expect(getSatisfactionLabel(59)).toBe('CONCERNING');
    });

    it('returns CRITICAL for satisfaction < 30', () => {
      expect(getSatisfactionLabel(15)).toBe('CRITICAL');
      expect(getSatisfactionLabel(0)).toBe('CRITICAL');
      expect(getSatisfactionLabel(29)).toBe('CRITICAL');
    });
  });

  // ── getSatisfactionColor ───────────────────────────────────────────────

  describe('getSatisfactionColor', () => {
    it('returns gold for suspicious range (>90)', () => {
      expect(getSatisfactionColor(95)).toBe('#fbc02d');
    });

    it('returns green for acceptable range (60-90)', () => {
      expect(getSatisfactionColor(75)).toBe('#00e676');
    });

    it('returns orange for concerning range (30-59)', () => {
      expect(getSatisfactionColor(45)).toBe('#ff9800');
    });

    it('returns red for critical range (<30)', () => {
      expect(getSatisfactionColor(10)).toBe('#c62828');
    });
  });
});
