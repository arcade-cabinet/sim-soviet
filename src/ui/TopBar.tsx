/**
 * TopBar — Resource bar, calendar, speed controls.
 * Port of poc.html lines 179-231.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, SharedStyles, monoFont } from './styles';

export interface TopBarProps {
  season: string;
  weather: string;
  waterUsed: number;
  waterGen: number;
  powerUsed: number;
  powerGen: number;
  money: number;
  income: number;
  food: number;
  vodka: number;
  population: number;
  dateLabel: string;
  monthProgress: number; // 0..1
  speed: number; // 0 | 1 | 3
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
}

export const TopBar: React.FC<TopBarProps> = ({
  season,
  weather,
  waterUsed,
  waterGen,
  powerUsed,
  powerGen,
  money,
  income,
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
}) => {
  return (
    <View style={[SharedStyles.panel, styles.container]}>
      <View style={styles.leftGroup}>
        <Text style={styles.title}>
          <Text style={{ color: Colors.sovietRed }}>SIM</Text>
          <Text style={{ color: Colors.white }}>SOVIET</Text>
          {' '}
          <Text style={styles.titleYear}>1917</Text>
        </Text>
        <View style={styles.seasonBox}>
          <Text style={[styles.seasonText, { color: Colors.white }]}>{season}</Text>
          <Text style={[styles.seasonText, { color: Colors.termBlue }]}>{weather}</Text>
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
        {onShowLeadership && (
          <TouchableOpacity onPress={onShowLeadership} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u262D'}</Text>
          </TouchableOpacity>
        )}
        {onShowEconomy && (
          <TouchableOpacity onPress={onShowEconomy} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u20BD'}</Text>
          </TouchableOpacity>
        )}
        {onShowWorkers && (
          <TouchableOpacity onPress={onShowWorkers} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u2692'}</Text>
          </TouchableOpacity>
        )}
        {onShowMandates && (
          <TouchableOpacity onPress={onShowMandates} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u2261'}</Text>
          </TouchableOpacity>
        )}
        {onShowDisease && (
          <TouchableOpacity onPress={onShowDisease} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u2695'}</Text>
          </TouchableOpacity>
        )}
        {onShowInfra && (
          <TouchableOpacity onPress={onShowInfra} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u2302'}</Text>
          </TouchableOpacity>
        )}
        {onShowEvents && (
          <TouchableOpacity onPress={onShowEvents} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u2139'}</Text>
          </TouchableOpacity>
        )}
        {onShowPolitical && (
          <TouchableOpacity onPress={onShowPolitical} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F50D}'}</Text>
          </TouchableOpacity>
        )}
        {onShowScoring && (
          <TouchableOpacity onPress={onShowScoring} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F3C6}'}</Text>
          </TouchableOpacity>
        )}
        {onShowWeather && (
          <TouchableOpacity onPress={onShowWeather} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u2601'}</Text>
          </TouchableOpacity>
        )}
        {onShowEra && (
          <TouchableOpacity onPress={onShowEra} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F4DC}'}</Text>
          </TouchableOpacity>
        )}
        {onShowSettlement && (
          <TouchableOpacity onPress={onShowSettlement} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F3D8}'}</Text>
          </TouchableOpacity>
        )}
        {onShowPolitburo && (
          <TouchableOpacity onPress={onShowPolitburo} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F3DB}'}</Text>
          </TouchableOpacity>
        )}
        {onShowDeliveries && (
          <TouchableOpacity onPress={onShowDeliveries} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F4E6}'}</Text>
          </TouchableOpacity>
        )}
        {onShowMinigames && (
          <TouchableOpacity onPress={onShowMinigames} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F3B2}'}</Text>
          </TouchableOpacity>
        )}
        {onShowPravda && (
          <TouchableOpacity onPress={onShowPravda} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F4F0}'}</Text>
          </TouchableOpacity>
        )}
        {onShowWorkerAnalytics && (
          <TouchableOpacity onPress={onShowWorkerAnalytics} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F4CA}'}</Text>
          </TouchableOpacity>
        )}
        {onShowEconomyDetail && (
          <TouchableOpacity onPress={onShowEconomyDetail} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F4B0}'}</Text>
          </TouchableOpacity>
        )}
        {onShowSaveLoad && (
          <TouchableOpacity onPress={onShowSaveLoad} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{'\u{1F4BE}'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Right: resources, calendar, speed */}
      <View style={styles.rightGroup}>
        <ResourceStat label="WATER" emoji="💧" value={`${waterUsed}/${waterGen}`} color="#60a5fa" />
        <ResourceStat label="POWER" emoji="⚡" value={`${powerUsed}/${powerGen}`} color={Colors.sovietGold} />
        <ResourceStat label="FUNDS ₽" value={String(money)} color={Colors.white}>
          <Text style={styles.income}>{income >= 0 ? `+${income}` : String(income)}</Text>
        </ResourceStat>
        <ResourceStat label="FOOD" emoji="🥔" value={String(food)} color="#fdba74" />
        <ResourceStat label="VODKA" emoji="🍾" value={String(vodka)} color={Colors.termBlue} />
        <ResourceStat label="POPULATION" value={String(population)} color={Colors.white} borderRight />

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
          <SpeedButton label="▶" value={1} active={speed === 1} onPress={onSetSpeed} />
          <SpeedButton label="▶▶" value={3} active={speed === 3} onPress={onSetSpeed} />
        </View>
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
      <Text style={styles.statLabel}>
        {TIER_LABELS[settlementTier] ?? 'SELO'}
      </Text>
      <View style={styles.threatRow}>
        <View style={[styles.threatDot, { backgroundColor: cfg.color }]} />
        <Text style={[styles.threatText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
      <Text style={styles.marksText}>
        {effectiveMarks > 0 ? `${effectiveMarks}\u2620` : '\u2605'}
      </Text>
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
  income: {
    color: Colors.termGreen,
    fontSize: 9,
    fontFamily: monoFont,
    marginBottom: 2,
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
  navBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  navBtnText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
