/**
 * TabBar — Category tab strip (ZONING, INFRASTRUCTURE, STATE, PURGE).
 * Port of poc.html lines 293-299.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { TabType } from '../engine/GameState';
import { Colors, monoFont } from './styles';

export interface TabBarProps {
  activeTab: TabType;
  onTabPress: (tab: TabType) => void;
}

interface TabDef {
  key: TabType;
  label: string;
  redText?: boolean;
}

const TABS: TabDef[] = [
  { key: 'zone', label: 'ZONING' },
  { key: 'infra', label: 'INFRASTRUCTURE' },
  { key: 'state', label: 'STATE' },
  { key: 'purge', label: 'PURGE', redText: true },
];

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress }) => {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                tab.redText && !isActive && { color: '#ef5350' },
                isActive && styles.tabTextActive,
              ]}
            >
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
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#444',
    backgroundColor: '#111',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tab: {
    backgroundColor: Colors.tabBg,
    borderWidth: 1,
    borderColor: Colors.tabBorder,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tabActive: {
    backgroundColor: Colors.sovietGold,
    borderColor: Colors.white,
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: monoFont,
  },
  tabTextActive: {
    color: Colors.black,
    fontWeight: 'bold',
  },
});
