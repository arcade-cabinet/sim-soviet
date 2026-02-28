/**
 * PersonnelFilePanel — Full personnel dossier view.
 *
 * Shows the player's complete KGB record: threat level, black marks,
 * commendations, and the full history log. Accessible by tapping the
 * threat indicator in TopBar.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import type { FileEntry } from '../game/PersonnelFile';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

const THREAT_CONFIG: Record<string, { label: string; color: string }> = {
  safe: { label: 'SAFE', color: Colors.termGreen },
  watched: { label: 'WATCHED', color: Colors.sovietGold },
  warned: { label: 'WARNED', color: '#ff9800' },
  investigated: { label: 'INVESTIGATED', color: '#ff5722' },
  reviewed: { label: 'UNDER REVIEW', color: Colors.sovietRed },
  arrested: { label: 'ARRESTED', color: '#b71c1c' },
};

export interface PersonnelFilePanelProps {
  visible: boolean;
  onDismiss: () => void;
}

export const PersonnelFilePanel: React.FC<PersonnelFilePanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game state for real-time threat level updates
  useGameSnapshot();
  const engine = getEngine();
  const file = engine?.getPersonnelFile();
  if (!visible || !file) return null;

  const threatLevel = file.getThreatLevel();
  const blackMarks = file.getBlackMarks();
  const commendations = file.getCommendations();
  const effective = file.getEffectiveMarks();
  const history = file.getHistory();
  const cfg = THREAT_CONFIG[threatLevel] ?? THREAT_CONFIG.safe;

  // Threat meter: 7 segments (arrest at 7)
  const meterSegments = Array.from({ length: 7 }, (_, i) => i < effective);

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="PERSONNEL FILE"
      stampText={cfg.label}
      actionLabel="CLOSE FILE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* Threat meter */}
      <View style={styles.meterRow}>
        <Text style={styles.meterLabel}>THREAT LEVEL:</Text>
        <View style={styles.meterTrack}>
          {meterSegments.map((filled, i) => (
            <View
              key={i}
              style={[
                styles.meterSegment,
                filled && {
                  backgroundColor: i < 3 ? Colors.sovietGold : i < 5 ? '#ff9800' : Colors.sovietRed,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.meterValue, { color: cfg.color }]}>{cfg.label}</Text>
      </View>

      {/* Summary stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{blackMarks}</Text>
          <Text style={[styles.statLabel, { color: Colors.sovietRed }]}>BLACK MARKS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{commendations}</Text>
          <Text style={[styles.statLabel, { color: Colors.termGreen }]}>COMMENDATIONS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: cfg.color }]}>{effective}</Text>
          <Text style={styles.statLabel}>EFFECTIVE</Text>
        </View>
      </View>

      <Text style={styles.note}>Arrest threshold: 7 effective marks. Marks decay over time if no new infractions.</Text>

      {/* History log */}
      <View style={styles.divider} />
      <Text style={styles.historyTitle}>FILE HISTORY</Text>

      {history.length === 0 ? (
        <Text style={styles.emptyHistory}>No entries. Record is clean... for now.</Text>
      ) : (
        [...history].reverse().map((entry, i) => <HistoryEntry key={i} entry={entry} />)
      )}
    </SovietModal>
  );
};

const HistoryEntry: React.FC<{ entry: FileEntry }> = ({ entry }) => {
  const isMark = entry.type === 'mark';
  return (
    <View style={styles.historyRow}>
      <Text style={[styles.historyIcon, { color: isMark ? Colors.sovietRed : Colors.termGreen }]}>
        {isMark ? '\u2620' : '\u2605'}
      </Text>
      <View style={styles.historyContent}>
        <Text style={styles.historyDesc}>{entry.description}</Text>
        <Text style={styles.historyAmount}>
          {isMark ? `+${entry.amount} mark${entry.amount !== 1 ? 's' : ''}` : `+${entry.amount} commendation`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  meterLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  meterTrack: {
    flexDirection: 'row',
    gap: 3,
    flex: 1,
  },
  meterSegment: {
    flex: 1,
    height: 12,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  meterValue: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
    minWidth: 80,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
  },
  statLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
    marginTop: 2,
  },
  note: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginVertical: 12,
  },
  historyTitle: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 8,
  },
  emptyHistory: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
  },
  historyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  historyIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  historyContent: {
    flex: 1,
  },
  historyDesc: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#ccc',
    lineHeight: 16,
  },
  historyAmount: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#888',
    marginTop: 2,
  },
});
