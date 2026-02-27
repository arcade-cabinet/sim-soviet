/**
 * AchievementsPanel — In-game view of all 28 achievements.
 *
 * Shows unlocked achievements highlighted, locked ones dimmed,
 * and hidden ones as ???. Accessible from the STATE tab.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';
import { ACHIEVEMENTS } from '../content/worldbuilding/achievements';

export interface AchievementsPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game state for real-time achievement unlock updates
  useGameSnapshot();
  const engine = getEngine();
  const tracker = engine?.getAchievements();
  if (!visible) return null;

  const unlockedIds = tracker ? new Set(tracker.getUnlocked().map((a) => a.id)) : new Set<string>();
  const unlockedCount = unlockedIds.size;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="ACHIEVEMENTS"
      stampText={`${unlockedCount}/${totalCount}`}
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      <Text style={styles.subtitle}>
        MINISTRY OF RECOGNITION — AWARDS DIVISION
      </Text>

      {ACHIEVEMENTS.map((ach) => {
        const unlocked = unlockedIds.has(ach.id);
        const isHidden = ach.hidden && !unlocked;

        return (
          <View key={ach.id} style={[styles.achRow, unlocked && styles.achRowUnlocked]}>
            <Text style={styles.achIcon}>
              {unlocked ? '\u2605' : isHidden ? '\u2620' : '\u25CB'}
            </Text>
            <View style={styles.achContent}>
              <Text style={[styles.achName, !unlocked && styles.achNameLocked]}>
                {isHidden ? '??? CLASSIFIED ???' : ach.name}
              </Text>
              <Text style={[styles.achDesc, !unlocked && styles.achDescLocked]}>
                {isHidden ? 'Achievement details are classified.' : ach.description}
              </Text>
              {unlocked && ach.subtext && (
                <Text style={styles.achSubtext}>&quot;{ach.subtext}&quot;</Text>
              )}
            </View>
          </View>
        );
      })}
    </SovietModal>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#666',
    letterSpacing: 2,
    marginBottom: 16,
  },
  achRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  achRowUnlocked: {
    borderBottomColor: '#333',
  },
  achIcon: {
    fontSize: 16,
    color: Colors.sovietGold,
    marginTop: 1,
  },
  achContent: {
    flex: 1,
  },
  achName: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
  },
  achNameLocked: {
    color: '#666',
  },
  achDesc: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#ccc',
    marginTop: 2,
  },
  achDescLocked: {
    color: '#555',
  },
  achSubtext: {
    fontSize: 10,
    fontFamily: monoFont,
    fontStyle: 'italic',
    color: '#78909c',
    marginTop: 4,
  },
});
