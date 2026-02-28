/**
 * EdgeIndicators — Off-screen event indicators at viewport edges.
 *
 * When events (fires, political events, positive events) occur outside the
 * visible camera area, shows colored arrow indicators at the nearest edge.
 *
 * Color coding:
 *   Red     — fires, emergencies
 *   Yellow  — political events, warnings
 *   Green   — positive events (upgrades, achievements)
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNotifications } from '../stores/gameStore';
import { Colors, monoFont } from './styles';

/** Map notification severity to indicator color. */
function severityColor(severity: string): string {
  switch (severity) {
    case 'critical':
    case 'evacuation':
      return Colors.sovietRed;
    case 'warning':
      return Colors.sovietGold;
    default:
      return Colors.termGreen;
  }
}

/** Arrow glyph based on edge position. */
function edgeArrow(edge: 'top' | 'bottom' | 'left' | 'right'): string {
  switch (edge) {
    case 'top':
      return '\u25B2'; // up triangle
    case 'bottom':
      return '\u25BC'; // down triangle
    case 'left':
      return '\u25C0'; // left triangle
    case 'right':
      return '\u25B6'; // right triangle
  }
}

interface EdgeIndicator {
  id: number;
  edge: 'top' | 'bottom' | 'left' | 'right';
  color: string;
  label: string;
}

/**
 * Compute which edge an off-screen grid event should appear on.
 * Since we don't have direct camera frustum info, we use a simple heuristic:
 * recent notifications with grid coordinates get indicators on the nearest edge.
 */
function computeIndicators(
  notifications: { id: number; severity: string; gridX?: number; gridY?: number; message: string }[],
): EdgeIndicator[] {
  const MAX_INDICATORS = 4;
  const recent = notifications.slice(0, 8);
  const indicators: EdgeIndicator[] = [];

  for (const n of recent) {
    if (indicators.length >= MAX_INDICATORS) break;
    if (n.gridX == null || n.gridY == null) continue;

    // Simple heuristic: map grid position to edge
    // Grid center is ~15,15 (for 30x30). Push to closest edge.
    const cx = 15;
    const cy = 15;
    const dx = n.gridX - cx;
    const dy = n.gridY - cy;

    let edge: 'top' | 'bottom' | 'left' | 'right';
    if (Math.abs(dx) > Math.abs(dy)) {
      edge = dx > 0 ? 'right' : 'left';
    } else {
      edge = dy > 0 ? 'bottom' : 'top';
    }

    indicators.push({
      id: n.id,
      edge,
      color: severityColor(n.severity),
      label: n.message.length > 20 ? `${n.message.slice(0, 18)}..` : n.message,
    });
  }

  return indicators;
}

export const EdgeIndicators: React.FC = () => {
  const notifications = useNotifications();

  const indicators = computeIndicators(notifications);

  if (indicators.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {indicators.map((ind) => {
        const posStyle = edgePosition(ind.edge, indicators.filter((i) => i.edge === ind.edge).indexOf(ind));
        return (
          <View key={ind.id} style={[styles.indicator, posStyle]}>
            <Text style={[styles.arrow, { color: ind.color }]}>{edgeArrow(ind.edge)}</Text>
          </View>
        );
      })}
    </View>
  );
};

/** Compute absolute position for an indicator on a given edge. */
function edgePosition(edge: 'top' | 'bottom' | 'left' | 'right', index: number) {
  const offset = 100 + index * 40;
  switch (edge) {
    case 'top':
      return { top: 64, left: offset } as const;
    case 'bottom':
      return { bottom: 60, left: offset } as const;
    case 'left':
      return { left: 4, top: offset + 60 } as const;
    case 'right':
      return { right: 4, top: offset + 60 } as const;
  }
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    padding: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: '#444',
    zIndex: 80,
  },
  arrow: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
});
