/**
 * Shared primitive components and helpers for the BuildingInspectorPanel subcomponents.
 */

import type React from 'react';
import { Text, View } from 'react-native';
import type { WorkerDisplayInfo } from '../../ai/agents/workforce/types';
import type { CitizenComponent } from '../../ecs/world';
import { Colors } from '../styles';
import { ringStyles, styles } from './styles';

// ── Types ────────────────────────────────────────────────────────────────────

/** Detailed info for a worker assigned to this building. */
export interface AssignedWorkerInfo extends WorkerDisplayInfo {
  /** Worker's citizen class */
  class: CitizenComponent['class'];
}

// ── Color Helpers ─────────────────────────────────────────────────────────────

/** Color for power status. */
export function powerColor(powered: boolean): string {
  return powered ? Colors.termGreen : '#ef4444';
}

/** Color for health bar based on value (0-100). */
export function healthColor(value: number): string {
  if (value >= 60) return Colors.termGreen;
  if (value >= 30) return Colors.sovietGold;
  return '#ef4444';
}

/** Color for efficiency percentage. */
export function efficiencyColor(pct: number): string {
  if (pct >= 80) return Colors.termGreen;
  if (pct >= 50) return Colors.sovietGold;
  return '#ef4444';
}

/** Morale icon based on morale value (0-100). */
export function moraleIcon(morale: number): string {
  if (morale >= 70) return '★'; // star — happy
  if (morale >= 40) return '●'; // circle — neutral
  return '✗'; // cross — unhappy
}

/** Color for morale value. */
export function moraleColor(morale: number): string {
  if (morale >= 70) return Colors.termGreen;
  if (morale >= 40) return Colors.sovietGold;
  return '#ef4444';
}

/** Status label for worker display. */
export function statusLabel(status: WorkerDisplayInfo['status']): string {
  switch (status) {
    case 'working':
      return 'WORKING';
    case 'idle':
      return 'IDLE';
    case 'hungry':
      return 'HUNGRY';
    case 'drunk':
      return 'INTOXICATED';
    case 'defecting':
      return 'DISLOYAL';
  }
}

/** Color for worker status. */
export function statusColor(status: WorkerDisplayInfo['status']): string {
  switch (status) {
    case 'working':
      return Colors.termGreen;
    case 'idle':
      return '#9e9e9e';
    case 'hungry':
      return Colors.sovietGold;
    case 'drunk':
      return '#ff9800';
    case 'defecting':
      return '#ef4444';
  }
}

/** Class abbreviation for display. */
export const CLASS_ABBREV: Record<CitizenComponent['class'], string> = {
  worker: 'WRK',
  party_official: 'PTY',
  engineer: 'ENG',
  farmer: 'FRM',
  soldier: 'SOL',
  prisoner: 'PRS',
};

/** Class color for display. */
export const CLASS_COLOR: Record<CitizenComponent['class'], string> = {
  worker: '#90a4ae',
  party_official: Colors.sovietRed,
  engineer: Colors.termBlue,
  farmer: '#8bc34a',
  soldier: '#4caf50',
  prisoner: '#ff9800',
};

// ── Primitive Components ──────────────────────────────────────────────────────

export const StatBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}> = ({ label, value, max, color, suffix }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={styles.barContainer}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, { color }]}>
          {Math.round(value)}
          {suffix ? suffix : ''}
          {max > 0 ? ` / ${max}` : ''}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

/** A visually distinctive ring section header with Soviet-style framing. */
export const RingHeader: React.FC<{ label: string; icon: string; color: string }> = ({ label, icon, color }) => (
  <View style={ringStyles.header}>
    <View style={[ringStyles.headerAccent, { backgroundColor: color }]} />
    <Text style={[ringStyles.headerIcon, { color }]}>{icon}</Text>
    <Text style={[ringStyles.headerLabel, { color }]}>{label}</Text>
    <View style={[ringStyles.headerLine, { backgroundColor: color }]} />
    <Text style={[ringStyles.headerDot, { color }]}>{'◉'}</Text>
  </View>
);

/** Horizontal stacked distribution bar for showing class/morale breakdowns. */
export const DistributionBar: React.FC<{
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}> = ({ segments, total }) => {
  if (total === 0) return null;
  return (
    <View style={ringStyles.distContainer}>
      <View style={ringStyles.distBar}>
        {segments
          .filter((s) => s.value > 0)
          .map((seg, i) => (
            <View
              key={i}
              style={[ringStyles.distSegment, { width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }]}
            />
          ))}
      </View>
      <View style={ringStyles.distLegend}>
        {segments
          .filter((s) => s.value > 0)
          .map((seg, i) => (
            <View key={i} style={ringStyles.distLegendItem}>
              <View style={[ringStyles.distDot, { backgroundColor: seg.color }]} />
              <Text style={ringStyles.distLegendText}>
                {seg.label} {seg.value}
              </Text>
            </View>
          ))}
      </View>
    </View>
  );
};

export const InfoRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
}> = ({ label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
  </View>
);
