/**
 * TopBar — Minimal resource bar, calendar, speed controls.
 * Phase 1: stripped to essentials — food, timber, population, date, threat, speed.
 */

import type React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont, SharedStyles } from './styles';
import { useResponsive } from './useResponsive';

export interface TopBarProps {
  food: number;
  timber: number;
  population: number;
  dateLabel: string;
  monthProgress: number;
  speed: number;
  onSetSpeed: (speed: number) => void;
  threatLevel?: string;
  blackMarks?: number;
  commendations?: number;
  settlementTier?: string;
  onThreatPress?: () => void;
}

/** Minimal top bar: food, timber, population, date, threat indicator, speed controls. */
export const TopBar: React.FC<TopBarProps> = ({
  food,
  timber,
  population,
  dateLabel,
  monthProgress,
  speed,
  onSetSpeed,
  threatLevel = 'safe',
  blackMarks = 0,
  commendations = 0,
  settlementTier = 'selo',
  onThreatPress,
}) => {
  const { isCompact } = useResponsive();
  const containerHeight = isCompact ? 44 : 60;

  return (
    <View style={styles.wrapper}>
      <View style={[SharedStyles.panel, styles.container, { height: containerHeight }]}>
        <View style={styles.leftGroup}>
          <ThreatIndicator
            threatLevel={threatLevel}
            blackMarks={blackMarks}
            commendations={commendations}
            settlementTier={settlementTier}
            onPress={onThreatPress}
          />
        </View>

        {/* Right: resources, calendar, speed */}
        {isCompact ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.compactRightScroll}
            contentContainerStyle={styles.compactRightContent}
          >
            <ResourceStat
              label="FOOD"
              emoji={'\u{1F954}'}
              value={String(food)}
              color="#fdba74"
              testID="food-value"
              compact
            />
            <ResourceStat
              label="TIMBER"
              emoji={'\u{1FAB5}'}
              value={String(timber)}
              color="#a1887f"
              testID="timber-value"
              compact
            />
            <ResourceStat
              label="POP"
              value={String(population)}
              color={Colors.white}
              borderRight
              testID="pop-value"
              compact
            />

            <View style={styles.calendarBox}>
              <Text style={styles.compactStatLabel}>CALENDAR</Text>
              <Text testID="date-label" style={styles.compactDateText}>
                {dateLabel}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(monthProgress * 100)}%` }]} />
              </View>
            </View>

            <View style={styles.speedRow}>
              <SpeedButton label="||" value={0} active={speed === 0} onPress={onSetSpeed} compact />
              <SpeedButton label={'\u25B6'} value={1} active={speed === 1} onPress={onSetSpeed} compact />
              <SpeedButton label={'\u25B6\u25B6'} value={2} active={speed === 2} onPress={onSetSpeed} compact />
              <SpeedButton label={'\u25B6\u25B6\u25B6'} value={3} active={speed === 3} onPress={onSetSpeed} compact />
              <SpeedButton label={'\u23E9'} value={10} active={speed === 10} onPress={onSetSpeed} compact />
              <SpeedButton label={'\u23E9\u23E9'} value={100} active={speed === 100} onPress={onSetSpeed} compact />
            </View>
          </ScrollView>
        ) : (
          <View style={styles.rightGroup}>
            <ResourceStat label="FOOD" emoji={'\u{1F954}'} value={String(food)} color="#fdba74" testID="food-value" />
            <ResourceStat
              label="TIMBER"
              emoji={'\u{1FAB5}'}
              value={String(timber)}
              color="#a1887f"
              testID="timber-value"
            />
            <ResourceStat label="POP" value={String(population)} color={Colors.white} borderRight testID="pop-value" />

            {/* Calendar */}
            <View style={styles.calendarBox}>
              <Text style={styles.statLabel}>CALENDAR</Text>
              <Text testID="date-label" style={styles.dateText}>
                {dateLabel}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(monthProgress * 100)}%` }]} />
              </View>
            </View>

            {/* Speed controls */}
            <View style={styles.speedRow}>
              <SpeedButton label="||" value={0} active={speed === 0} onPress={onSetSpeed} />
              <SpeedButton label={'\u25B6'} value={1} active={speed === 1} onPress={onSetSpeed} />
              <SpeedButton label={'\u25B6\u25B6'} value={2} active={speed === 2} onPress={onSetSpeed} />
              <SpeedButton label={'\u25B6\u25B6\u25B6'} value={3} active={speed === 3} onPress={onSetSpeed} />
              <SpeedButton label={'\u23E9'} value={10} active={speed === 10} onPress={onSetSpeed} />
              <SpeedButton label={'\u23E9\u23E9'} value={100} active={speed === 100} onPress={onSetSpeed} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// --- Sub-components ---

const TIER_LABELS: Record<string, string> = {
  selo: 'SELO',
  posyolok: 'POSYOLOK',
  pgt: 'PGT',
  gorod: 'GOROD',
};

const THREAT_CONFIG: Record<string, { label: string; color: string }> = {
  safe: { label: 'SAFE', color: Colors.termGreen },
  watched: { label: 'WATCHED', color: Colors.sovietGold },
  warned: { label: 'WARNED', color: '#ff9800' },
  investigated: { label: 'INVESTIGATED', color: '#ff5722' },
  reviewed: { label: 'UNDER REVIEW', color: Colors.sovietRed },
  arrested: { label: 'ARRESTED', color: '#b71c1c' },
};

const ThreatIndicator: React.FC<{
  threatLevel: string;
  blackMarks: number;
  commendations: number;
  settlementTier: string;
  onPress?: () => void;
}> = ({ threatLevel, blackMarks, commendations, settlementTier, onPress }) => {
  const cfg = THREAT_CONFIG[threatLevel] ?? THREAT_CONFIG.safe;
  const effectiveMarks = Math.max(0, blackMarks - commendations);
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity: 0.7 } : {};
  return (
    <Container {...containerProps} style={styles.threatBox}>
      <Text style={styles.statLabel}>{TIER_LABELS[settlementTier] ?? 'SELO'}</Text>
      <View style={styles.threatRow}>
        <View style={[styles.threatDot, { backgroundColor: cfg.color }]} />
        <Text style={[styles.threatText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
      <Text style={styles.marksText}>{effectiveMarks > 0 ? `${effectiveMarks}\u2620` : '\u2605'}</Text>
    </Container>
  );
};

interface ResourceStatProps {
  label: string;
  emoji?: string;
  value: string;
  color: string;
  borderRight?: boolean;
  testID?: string;
  compact?: boolean;
  children?: React.ReactNode;
}

const ResourceStat: React.FC<ResourceStatProps> = ({
  label,
  emoji,
  value,
  color,
  borderRight,
  testID,
  compact,
  children,
}) => (
  <View style={[styles.statCol, borderRight && styles.statBorderRight]}>
    <Text style={compact ? styles.compactStatLabel : styles.statLabel}>
      {label} {emoji}
    </Text>
    <View style={styles.statValueRow}>
      <Text testID={testID} style={[compact ? styles.compactStatValue : styles.statValue, { color }]}>
        {value}
      </Text>
      {children}
    </View>
  </View>
);

interface SpeedButtonProps {
  label: string;
  value: number;
  active: boolean;
  onPress: (v: number) => void;
  compact?: boolean;
}

const SpeedButton: React.FC<SpeedButtonProps> = ({ label, value, active, onPress, compact }) => (
  <TouchableOpacity
    onPress={() => onPress(value)}
    style={[
      SharedStyles.timeBtn,
      active && SharedStyles.timeBtnActive,
      compact ? styles.compactSpeedBtn : styles.speedBtn,
    ]}
    activeOpacity={0.7}
  >
    <Text style={[styles.speedLabel, active && { color: Colors.white }]}>{label}</Text>
  </TouchableOpacity>
);

// --- Styles ---

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 100,
  },
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  threatBox: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  threatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  threatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  threatText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  marksText: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#9e9e9e',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statCol: {
    alignItems: 'flex-end',
  },
  statBorderRight: {
    borderRightWidth: 1,
    borderRightColor: '#555',
    paddingRight: 12,
  },
  statLabel: {
    color: '#9e9e9e',
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: monoFont,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  calendarBox: {
    alignItems: 'flex-start',
    width: 90,
  },
  dateText: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: monoFont,
    letterSpacing: 2,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.sovietRed,
  },
  speedRow: {
    flexDirection: 'row',
  },
  speedBtn: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedLabel: {
    fontSize: 14,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },

  // Compact mode (mobile) styles
  compactRightScroll: {
    flexShrink: 1,
  },
  compactRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactStatLabel: {
    color: '#9e9e9e',
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  compactStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: monoFont,
  },
  compactDateText: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: monoFont,
    letterSpacing: 1,
  },
  compactSpeedBtn: {
    width: 32,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
