/**
 * GovernmentHQ — Central bureaucratic panel with 6 agency tabs.
 *
 * Tabs: Gosplan | Central Committee | KGB | Military | Politburo | Reports
 * Each tab will house agency-specific content; placeholders for now.
 */

import type React from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type Allocations, DEFAULT_ALLOCATIONS, GosplanTab } from './hq-tabs/GosplanTab';
import { Colors, monoFont } from './styles';

// ── Types ───────────────────────────────────────────────────────────────────

/** Agency tab identifiers for the GovernmentHQ panel. */
export type AgencyTab = 'gosplan' | 'central_committee' | 'kgb' | 'military' | 'politburo' | 'reports';

export interface AgencyTabDef {
  key: AgencyTab;
  label: string;
}

/** Ordered tab definitions for the GovernmentHQ panel. */
export const AGENCY_TABS: AgencyTabDef[] = [
  { key: 'gosplan', label: 'GOSPLAN' },
  { key: 'central_committee', label: 'CENTRAL COMMITTEE' },
  { key: 'kgb', label: 'KGB' },
  { key: 'military', label: 'MILITARY' },
  { key: 'politburo', label: 'POLITBURO' },
  { key: 'reports', label: 'REPORTS' },
];

/** Human-readable placeholder descriptions for each agency tab. */
const TAB_DESCRIPTIONS: Record<AgencyTab, string> = {
  gosplan: 'Gosplan — Coming Soon',
  central_committee: 'Central Committee — Coming Soon',
  kgb: 'KGB — Coming Soon',
  military: 'Military — Coming Soon',
  politburo: 'Politburo — Coming Soon',
  reports: 'Reports — Coming Soon',
};

// ── Props ───────────────────────────────────────────────────────────────────

export interface GovernmentHQProps {
  visible: boolean;
  onClose: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export const GovernmentHQ: React.FC<GovernmentHQProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState<AgencyTab>('gosplan');
  const [allocations, setAllocations] = useState<Allocations>({ ...DEFAULT_ALLOCATIONS });

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>GOVERNMENT HQ</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close Government HQ"
          >
            <Text style={styles.closeText}>X</Text>
          </Pressable>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {AGENCY_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                testID={`tab-${tab.key}`}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content area */}
        <ScrollView style={styles.content}>
          {activeTab === 'gosplan' ? (
            <GosplanTab currentAllocations={allocations} onAllocationChange={setAllocations} />
          ) : (
            <Text style={styles.placeholder}>{TAB_DESCRIPTIONS[activeTab]}</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    backgroundColor: '#2a2e33',
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    width: '90%',
    maxWidth: 720,
    maxHeight: '85%',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  closeButton: {
    width: 28,
    height: 28,
    backgroundColor: Colors.sovietRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
  },
  closeText: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.white,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.sovietRed,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    backgroundColor: '#424242',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  tabActive: {
    backgroundColor: Colors.sovietRed,
    borderColor: Colors.sovietRed,
  },
  tabText: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: Colors.sovietGold,
  },
  content: {
    flex: 1,
    minHeight: 200,
  },
  placeholder: {
    fontFamily: monoFont,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
});
