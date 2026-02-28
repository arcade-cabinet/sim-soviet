/**
 * TopBar — Resource bar, calendar, speed controls.
 * Thin chrome: essential indicators only, secondary panels in overflow menu.
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, monoFont, SharedStyles } from './styles';

const ERA_LABELS: Record<string, string> = {
  revolution: 'REVOLUTION',
  collectivization: 'COLLECTIVIZATION',
  industrialization: 'INDUSTRIALIZATION',
  great_patriotic: 'GREAT PATRIOTIC WAR',
  reconstruction: 'RECONSTRUCTION',
  thaw_and_freeze: 'THAW & FREEZE',
  stagnation: 'ERA OF STAGNATION',
  the_eternal: 'THE ETERNAL SOVIET',
};

export interface TopBarProps {
  season: string;
  weather: string;
  timber: number;
  steel: number;
  cement: number;
  powerUsed: number;
  powerGen: number;
  currentEra: string;
  food: number;
  vodka: number;
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
}

// ── Overflow menu item definition ─────────────────────────────────────────

interface OverflowItem {
  icon: string;
  label: string;
  handler?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  season,
  weather,
  timber,
  steel,
  cement,
  powerUsed,
  powerGen,
  currentEra,
  food,
  vodka,
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
}) => {
  const [showOverflow, setShowOverflow] = useState(false);

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

  return (
    <View style={styles.wrapper}>
      <View style={[SharedStyles.panel, styles.container]}>
        <View style={styles.leftGroup}>
          <Text style={styles.title}>
            <Text style={{ color: Colors.sovietRed }}>SIM</Text>
            <Text style={{ color: Colors.white }}>SOVIET</Text> <Text style={styles.titleYear}>1917</Text>
          </Text>
          <View style={styles.seasonBox}>
            <Text style={[styles.seasonText, { color: Colors.white }]}>{season}</Text>
            <Text style={[styles.seasonText, { color: Colors.termBlue }]}>{weather}</Text>
          </View>
          <View style={styles.eraBox}>
            <Text style={[styles.seasonText, { color: Colors.sovietGold }]}>
              {ERA_LABELS[currentEra] ?? currentEra.toUpperCase()}
            </Text>
          </View>
          <ThreatIndicator
            threatLevel={threatLevel}
            blackMarks={blackMarks}
            commendations={commendations}
            settlementTier={settlementTier}
            onPress={onThreatPress}
          />
          {onShowAchievements && (
            <TouchableOpacity onPress={onShowAchievements} style={styles.achBtn} activeOpacity={0.7}>
              <Text style={styles.achBtnText}>{'\u2605'}</Text>
            </TouchableOpacity>
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
        <View style={styles.rightGroup}>
          <ResourceStat label="TIMBER" emoji={'\u{1FAB5}'} value={String(timber)} color="#a1887f" />
          <ResourceStat label="STEEL" emoji={'\u{1F529}'} value={String(steel)} color="#90a4ae" />
          <ResourceStat label="CEMENT" value={String(cement)} color="#bdbdbd" />
          <ResourceStat label="POWER" emoji={'\u26A1'} value={`${powerUsed}/${powerGen}`} color={Colors.sovietGold} />
          <ResourceStat label="FOOD" emoji={'\u{1F954}'} value={String(food)} color="#fdba74" />
          <ResourceStat label="VODKA" emoji={'\u{1F37E}'} value={String(vodka)} color={Colors.termBlue} />
          <ResourceStat label="POP" value={String(population)} color={Colors.white} borderRight />

          {/* Calendar */}
          <View style={styles.calendarBox}>
            <Text style={styles.statLabel}>CALENDAR</Text>
            <Text style={styles.dateText}>{dateLabel}</Text>
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
          </View>
        </View>
      </View>

      {/* Overflow dropdown */}
      {showOverflow && (
        <>
          <TouchableOpacity style={styles.overflowBackdrop} activeOpacity={1} onPress={() => setShowOverflow(false)} />
          <View style={styles.overflowMenu}>
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
  children?: React.ReactNode;
}

const ResourceStat: React.FC<ResourceStatProps> = ({ label, emoji, value, color, borderRight, children }) => (
  <View style={[styles.statCol, borderRight && styles.statBorderRight]}>
    <Text style={styles.statLabel}>
      {label} {emoji}
    </Text>
    <View style={styles.statValueRow}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {children}
    </View>
  </View>
);

interface SpeedButtonProps {
  label: string;
  value: number;
  active: boolean;
  onPress: (v: number) => void;
}

const SpeedButton: React.FC<SpeedButtonProps> = ({ label, value, active, onPress }) => (
  <TouchableOpacity
    onPress={() => onPress(value)}
    style={[SharedStyles.timeBtn, active && SharedStyles.timeBtnActive, styles.speedBtn]}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: monoFont,
    letterSpacing: -1,
  },
  titleYear: {
    color: '#9e9e9e',
    fontSize: 16,
    fontWeight: 'normal',
  },
  seasonBox: {
    borderLeftWidth: 1,
    borderLeftColor: '#555',
    paddingLeft: 12,
  },
  eraBox: {
    borderLeftWidth: 1,
    borderLeftColor: '#555',
    paddingLeft: 12,
    paddingRight: 4,
  },
  seasonText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  threatBox: {
    borderLeftWidth: 1,
    borderLeftColor: '#555',
    paddingLeft: 12,
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

  // Overflow menu
  overflowBackdrop: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: -2000,
    zIndex: 99,
  },
  overflowMenu: {
    position: 'absolute',
    top: 60,
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    gap: 8,
  },
  overflowIcon: {
    fontSize: 14,
    width: 22,
    textAlign: 'center',
  },
  overflowLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#ccc',
    letterSpacing: 1,
  },
});
