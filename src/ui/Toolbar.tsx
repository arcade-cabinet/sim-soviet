/**
 * Toolbar — Unified command bar consolidating primary navigation + building
 * category tabs into a single component.
 *
 * Primary row:  BUILD | MANDATES | WORKERS | REPORTS | PURGE
 * Secondary row (only when BUILD is active): ZONING | INFRASTRUCTURE | STATE
 *
 * This replaces the old separate TabBar (building categories) and Toolbar
 * (management tabs), merging them into one navigation system.
 */

import type React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TabType } from '../engine/GameState';
import { Colors, monoFont, SharedStyles } from './styles';

// ── Types ───────────────────────────────────────────────────────────────────

export type SovietTab = 'build' | 'mandates' | 'workers' | 'reports' | 'purge';

// ── Tab Definitions ─────────────────────────────────────────────────────────

interface PrimaryTabDef {
  key: SovietTab;
  label: string;
  icon: string;
  /** Special color for dangerous tabs. */
  dangerColor?: string;
}

const PRIMARY_TABS: PrimaryTabDef[] = [
  { key: 'build', label: 'BUILD', icon: '\u{1F3D7}' },
  { key: 'mandates', label: 'MANDATES', icon: '\u{1F4CB}' },
  { key: 'workers', label: 'WORKERS', icon: '\u2692' },
  { key: 'reports', label: 'REPORTS', icon: '\u{1F4CA}' },
  { key: 'purge', label: 'PURGE', icon: '\u{1F480}', dangerColor: '#ef5350' },
];

interface SubTabDef {
  key: TabType;
  label: string;
}

const BUILD_SUBTABS: SubTabDef[] = [
  { key: 'zone', label: 'ZONING' },
  { key: 'infra', label: 'INFRASTRUCTURE' },
  { key: 'state', label: 'STATE' },
];

// ── Component ───────────────────────────────────────────────────────────────

export interface ToolbarProps {
  activeTab: SovietTab;
  onTabChange: (tab: SovietTab) => void;
  /** Active building sub-category (only relevant when activeTab === 'build'). */
  activeBuildTab?: TabType;
  /** Callback when a building sub-category is selected. */
  onBuildTabChange?: (tab: TabType) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTab,
  onTabChange,
  activeBuildTab = 'zone',
  onBuildTabChange,
}) => {
  return (
    <View style={styles.wrapper}>
      {/* ── Primary Navigation Row ── */}
      <View style={[SharedStyles.panel, styles.primaryRow]}>
        {PRIMARY_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.primaryTab, isActive && styles.primaryTabActive]}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  tab.dangerColor && !isActive ? { color: tab.dangerColor } : null,
                  isActive && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Build Sub-Category Row (conditional) ── */}
      {activeTab === 'build' && (
        <View style={styles.subRow}>
          {BUILD_SUBTABS.map((sub) => {
            const isActive = activeBuildTab === sub.key;
            return (
              <TouchableOpacity
                key={sub.key}
                style={[styles.subTab, isActive && styles.subTabActive]}
                onPress={() => onBuildTabChange?.(sub.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
                  {sub.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    // The whole toolbar sits at the bottom — wraps both rows
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

  // Build sub-category row
  subRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    height: 30,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#2a2a2a',
  },
  subTabActive: {
    backgroundColor: Colors.sovietGold,
  },
  subTabText: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#666',
    letterSpacing: 1.5,
  },
  subTabTextActive: {
    color: Colors.black,
  },
});
