/**
 * Toolbar — Unified command bar for bureaucratic navigation.
 *
 * Primary row: MANDATES | WORKERS | REPORTS | PURGE
 *
 * BUILD tab removed — SimSoviet 1917 is not a city builder.
 * Moscow mandates what gets built; the player is a bureaucrat, not a builder.
 */

import type React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MIN_TAP_TARGET } from './responsive';
import { Colors, monoFont, SharedStyles } from './styles';
import { useResponsive } from './useResponsive';

// ── Types ───────────────────────────────────────────────────────────────────

/** Primary navigation tab in the unified command bar. */
export type SovietTab = 'mandates' | 'workers' | 'reports' | 'purge';

// ── Tab Definitions ─────────────────────────────────────────────────────────

interface PrimaryTabDef {
  key: SovietTab;
  label: string;
  icon: string;
  /** Special color for dangerous tabs. */
  dangerColor?: string;
}

const PRIMARY_TABS: PrimaryTabDef[] = [
  { key: 'mandates', label: 'MANDATES', icon: '\u{1F4CB}' },
  { key: 'workers', label: 'WORKERS', icon: '\u2692' },
  { key: 'reports', label: 'REPORTS', icon: '\u{1F4CA}' },
  { key: 'purge', label: 'PURGE', icon: '\u{1F480}', dangerColor: '#ef5350' },
];

// ── Component ───────────────────────────────────────────────────────────────

export interface ToolbarProps {
  activeTab: SovietTab;
  onTabChange: (tab: SovietTab) => void;
}

/** Unified command bar with primary navigation tabs. */
export const Toolbar: React.FC<ToolbarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { isCompact } = useResponsive();

  return (
    <View style={styles.wrapper}>
      <View style={[SharedStyles.panel, styles.primaryRow, isCompact && styles.compactPrimaryRow]}>
        {PRIMARY_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.primaryTab, isCompact && styles.compactPrimaryTab, isActive && styles.primaryTabActive]}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={isCompact ? styles.compactTabIcon : styles.tabIcon}>{tab.icon}</Text>
              {!isCompact && (
                <Text
                  style={[
                    styles.tabLabel,
                    tab.dangerColor && !isActive ? { color: tab.dangerColor } : null,
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    // The whole toolbar sits at the bottom
  },

  // Primary row
  primaryRow: {
    flexDirection: 'row',
    height: 46,
    alignItems: 'stretch',
  },
  primaryTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  primaryTabActive: {
    backgroundColor: '#3a1a1a',
    borderBottomWidth: 2,
    borderBottomColor: Colors.sovietRed,
  },
  tabIcon: {
    fontSize: 16,
    marginBottom: 1,
  },
  tabLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1.5,
  },
  tabLabelActive: {
    color: Colors.white,
  },

  // Compact (mobile) styles
  compactPrimaryRow: {
    height: 50,
  },
  compactPrimaryTab: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
  },
  compactTabIcon: {
    fontSize: 20,
  },
});
