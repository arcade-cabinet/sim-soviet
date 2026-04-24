/**
 * TopBar — Minimal resource bar, calendar, speed controls.
 * Phase 1: stripped to essentials — food, timber, population, date, threat, speed.
 * Includes overflow menu for accessing deep panels.
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BrandColors } from './designTokens';
import { Colors, monoFont, SharedStyles } from './styles';
import { useResponsive } from './useResponsive';

/** Overflow menu item definition. */
interface OverflowItem {
  icon: string;
  label: string;
  handler: () => void;
}

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
  onOpenGovernmentHQ?: () => void;
  onShowAchievements?: () => void;
  onShowLeadership?: () => void;
  onShowEconomy?: () => void;
  onShowWorkers?: () => void;
  onShowMandates?: () => void;
  onShowDisease?: () => void;
  onShowInfra?: () => void;
  onShowEvents?: () => void;
  onShowPolitical?: () => void;
  onShowScoring?: () => void;
  onShowWeather?: () => void;
  onShowEra?: () => void;
  onShowSettlement?: () => void;
  onShowPolitburo?: () => void;
  onShowDeliveries?: () => void;
  onShowMinigames?: () => void;
  onShowPravda?: () => void;
  onShowWorkerAnalytics?: () => void;
  onShowEconomyDetail?: () => void;
  onShowSaveLoad?: () => void;
  onShowMarket?: () => void;
  onShowNotifications?: () => void;
  unreadNotifications?: number;
  autopilot?: boolean;
  /** Current era display name, e.g. "Revolution". Rendered with testID="era-label" for E2E. */
  eraName?: string;
}

/** Minimal top bar: food, timber, population, date, threat indicator, speed controls, overflow menu. */
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
  onOpenGovernmentHQ,
  onShowAchievements,
  onShowLeadership,
  onShowEconomy,
  onShowWorkers,
  onShowMandates,
  onShowDisease,
  onShowInfra,
  onShowEvents,
  onShowPolitical,
  onShowScoring,
  onShowWeather,
  onShowEra,
  onShowSettlement,
  onShowPolitburo,
  onShowDeliveries,
  onShowMinigames,
  onShowPravda,
  onShowWorkerAnalytics,
  onShowEconomyDetail,
  onShowSaveLoad,
  onShowMarket,
  onShowNotifications,
  unreadNotifications = 0,
  autopilot = false,
  eraName = '',
}) => {
  const [showOverflow, setShowOverflow] = useState(false);
  const { isCompact } = useResponsive();

  const toggleOverflow = useCallback(() => {
    setShowOverflow((v) => !v);
  }, []);

  const handleOverflowAction = useCallback((handler?: () => void) => {
    setShowOverflow(false);
    handler?.();
  }, []);

  // Build overflow items from available handlers
  const overflowItems: OverflowItem[] = [];
  if (onShowLeadership) overflowItems.push({ icon: '\u262D', label: 'LEADERSHIP', handler: onShowLeadership });
  if (onShowEconomy) overflowItems.push({ icon: '\u20BD', label: 'ECONOMY', handler: onShowEconomy });
  if (onShowEconomyDetail)
    overflowItems.push({ icon: '\u{1F4B0}', label: 'ECONOMY DETAIL', handler: onShowEconomyDetail });
  if (onShowWorkers) overflowItems.push({ icon: '\u2692', label: 'WORKERS', handler: onShowWorkers });
  if (onShowWorkerAnalytics)
    overflowItems.push({ icon: '\u{1F4CA}', label: 'WORKER ANALYTICS', handler: onShowWorkerAnalytics });
  if (onShowMandates) overflowItems.push({ icon: '\u2261', label: 'MANDATES', handler: onShowMandates });
  if (onShowDisease) overflowItems.push({ icon: '\u2695', label: 'DISEASE', handler: onShowDisease });
  if (onShowInfra) overflowItems.push({ icon: '\u2302', label: 'INFRASTRUCTURE', handler: onShowInfra });
  if (onShowEvents) overflowItems.push({ icon: '\u2139', label: 'EVENTS', handler: onShowEvents });
  if (onShowPolitical) overflowItems.push({ icon: '\u{1F50D}', label: 'POLITICAL', handler: onShowPolitical });
  if (onShowScoring) overflowItems.push({ icon: '\u{1F3C6}', label: 'SCORING', handler: onShowScoring });
  if (onShowWeather) overflowItems.push({ icon: '\u2601', label: 'WEATHER', handler: onShowWeather });
  if (onShowEra) overflowItems.push({ icon: '\u{1F4DC}', label: 'ERA / TECH', handler: onShowEra });
  if (onShowSettlement) overflowItems.push({ icon: '\u{1F3D8}', label: 'SETTLEMENT', handler: onShowSettlement });
  if (onShowPolitburo) overflowItems.push({ icon: '\u{1F3DB}', label: 'POLITBURO', handler: onShowPolitburo });
  if (onShowDeliveries) overflowItems.push({ icon: '\u{1F4E6}', label: 'DELIVERIES', handler: onShowDeliveries });
  if (onShowMinigames) overflowItems.push({ icon: '\u{1F3B2}', label: 'MINIGAMES', handler: onShowMinigames });
  if (onShowPravda) overflowItems.push({ icon: '\u{1F4F0}', label: 'PRAVDA', handler: onShowPravda });
  if (onShowMarket) overflowItems.push({ icon: '\u{1F6D2}', label: 'MARKET', handler: onShowMarket });
  if (onShowSaveLoad) overflowItems.push({ icon: '\u{1F4BE}', label: 'SAVE / LOAD', handler: onShowSaveLoad });

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
          {onOpenGovernmentHQ && (
            <TouchableOpacity onPress={onOpenGovernmentHQ} style={styles.hqBtn} activeOpacity={0.7}>
              <Text style={styles.hqBtnLabel}>ГОСПЛАН</Text>
              <Text style={styles.hqBtnSub}>HQ</Text>
            </TouchableOpacity>
          )}
          {onShowAchievements && (
            <TouchableOpacity onPress={onShowAchievements} style={styles.achBtn} activeOpacity={0.7}>
              <Text style={styles.achBtnText}>{'\u2605'}</Text>
            </TouchableOpacity>
          )}
          {autopilot && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          )}
          {onShowNotifications && (
            <TouchableOpacity onPress={onShowNotifications} style={styles.notifBtn} activeOpacity={0.7}>
              <Text style={styles.navBtnText}>{'\u{1F514}'}</Text>
              {unreadNotifications > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : String(unreadNotifications)}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {overflowItems.length > 0 && (
            <TouchableOpacity onPress={toggleOverflow} style={styles.moreBtn} activeOpacity={0.7}>
              <Text style={[styles.moreBtnText, showOverflow && styles.moreBtnTextActive]}>{'\u2261'}</Text>
            </TouchableOpacity>
          )}
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
              color={Colors.sovietGold}
              testID="food-value"
              compact
            />
            <ResourceStat
              label="TIMBER"
              emoji={'\u{1FAB5}'}
              value={String(timber)}
              color={BrandColors.brass}
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
            <ResourceStat
              label="FOOD"
              emoji={'\u{1F954}'}
              value={String(food)}
              color={Colors.sovietGold}
              testID="food-value"
            />
            <ResourceStat
              label="TIMBER"
              emoji={'\u{1FAB5}'}
              value={String(timber)}
              color={BrandColors.brass}
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

      {/* Overflow dropdown */}
      {showOverflow && (
        <>
          <TouchableOpacity
            style={[styles.overflowBackdrop, { top: containerHeight }]}
            activeOpacity={1}
            onPress={() => setShowOverflow(false)}
          />
          <View style={[styles.overflowMenu, { top: containerHeight }]}>
            <ScrollView style={styles.overflowScroll} nestedScrollEnabled>
              {overflowItems.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.overflowItem}
                  activeOpacity={0.7}
                  onPress={() => handleOverflowAction(item.handler)}
                >
                  <Text style={styles.overflowIcon}>{item.icon}</Text>
                  <Text style={styles.overflowLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
      {/* Accessibility + E2E anchor: era name readable via testID without visual clutter */}
      <Text testID="era-label" style={styles.eraAccessibleLabel}>
        {eraName.toUpperCase()}
      </Text>
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
    gap: 8,
    flexShrink: 0,
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
  achBtn: {
    borderLeftWidth: 1,
    borderLeftColor: '#555',
    paddingLeft: 10,
    paddingVertical: 4,
  },
  achBtnText: {
    fontSize: 16,
    color: Colors.sovietGold,
  },
  navBtnText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  notifBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: 'relative' as const,
  },
  badge: {
    position: 'absolute' as const,
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.sovietRed,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: monoFont,
    fontSize: 8,
    fontWeight: 'bold' as const,
    color: Colors.white,
  },
  moreBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#555',
    paddingLeft: 10,
  },
  moreBtnText: {
    fontSize: 18,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  moreBtnTextActive: {
    color: Colors.sovietGold,
  },
  hqBtn: {
    borderLeftWidth: 1,
    borderLeftColor: '#555',
    borderRightWidth: 1,
    borderRightColor: '#555',
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    backgroundColor: 'rgba(180, 0, 0, 0.15)',
  },
  hqBtnLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  hqBtnSub: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 2,
  },
  aiBadge: {
    backgroundColor: Colors.termGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#00c853',
  },
  aiBadgeText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
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

  // Overflow menu
  overflowBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -2000,
    zIndex: 99,
  },
  overflowMenu: {
    position: 'absolute',
    left: 12,
    backgroundColor: '#1e2228',
    borderWidth: 2,
    borderColor: '#444',
    borderTopWidth: 0,
    zIndex: 100,
    maxHeight: 320,
    width: 200,
  },
  overflowScroll: {
    maxHeight: 320,
  },
  overflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  overflowIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  overflowLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ccc',
    letterSpacing: 1,
  },
  /** Visually hidden — exists only as an E2E testID anchor for the current era name. */
  eraAccessibleLabel: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
