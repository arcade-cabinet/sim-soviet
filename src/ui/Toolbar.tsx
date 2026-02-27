/**
 * Toolbar — Building tool buttons in a horizontal scrollable row.
 * Port of poc.html lines 440-474.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { BUILDING_TYPES, type BuildingTypeInfo } from '../engine/BuildingTypes';
import type { TabType } from '../engine/GameState';
import { Colors, SharedStyles, monoFont } from './styles';

export interface ToolbarProps {
  activeTab: TabType;
  selectedTool: string;
  onSelectTool: (tool: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTab, selectedTool, onSelectTool }) => {
  // Always show Inspect first, then filter by active tab category
  const inspectDef = BUILDING_TYPES['none'];
  const filteredKeys = Object.keys(BUILDING_TYPES).filter((key) => {
    if (key === 'none') return false;
    const def = BUILDING_TYPES[key];
    return !def.hidden && def.category === activeTab;
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
    >
      {/* Inspect button — always first */}
      <ToolButton
        toolKey="none"
        def={inspectDef}
        isActive={selectedTool === 'none'}
        onPress={onSelectTool}
      />

      {filteredKeys.map((key) => (
        <ToolButton
          key={key}
          toolKey={key}
          def={BUILDING_TYPES[key]}
          isActive={selectedTool === key}
          onPress={onSelectTool}
        />
      ))}
    </ScrollView>
  );
};

// --- Sub-component ---

interface ToolButtonProps {
  toolKey: string;
  def: BuildingTypeInfo;
  isActive: boolean;
  onPress: (key: string) => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ toolKey, def, isActive, onPress }) => (
  <TouchableOpacity
    onPress={() => onPress(toolKey)}
    style={[
      isActive ? SharedStyles.btnRetroActive : SharedStyles.btnRetro,
      styles.btn,
    ]}
    activeOpacity={0.7}
  >
    <Text style={styles.icon}>{def.icon}</Text>
    <Text style={[styles.name, isActive && { color: Colors.white }]}>{def.name}</Text>
    {def.cost > 0 && (
      <Text style={styles.cost}>{def.cost}₽</Text>
    )}
  </TouchableOpacity>
);

// --- Styles ---

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btn: {
    minWidth: 80,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  icon: {
    fontSize: 22,
    marginBottom: 4,
  },
  name: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: monoFont,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  cost: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: monoFont,
    color: Colors.sovietGold,
    letterSpacing: 1,
    marginTop: 2,
  },
});
