/**
 * Toolbar — 4-tab navigation: MANDATES / WORKERS / REPORTS / PURGE.
 * Replaces the old building-type browser.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, SharedStyles, monoFont } from './styles';

export type SovietTab = 'mandates' | 'workers' | 'reports' | 'purge';

interface TabDef {
  key: SovietTab;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: 'mandates', label: 'MANDATES', icon: '\u{1F4CB}' },
  { key: 'workers', label: 'WORKERS', icon: '\u2692' },
  { key: 'reports', label: 'REPORTS', icon: '\u{1F4CA}' },
  { key: 'purge', label: 'PURGE', icon: '\u{1F480}' },
];

export interface ToolbarProps {
  activeTab: SovietTab;
  onTabChange: (tab: SovietTab) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={[SharedStyles.panel, styles.container]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 50,
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  tabActive: {
    backgroundColor: '#3a1a1a',
    borderBottomWidth: 2,
    borderBottomColor: Colors.sovietRed,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 2,
  },
  tabLabelActive: {
    color: Colors.white,
  },
});
