/**
 * RehabilitationModal -- shown when the player returns from gulag
 * in non-permadeath consequence modes (forgiving/harsh).
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RehabilitationData } from '../game/engine/types';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

export interface RehabilitationModalProps {
  visible: boolean;
  data: RehabilitationData | null;
  playerName?: string;
  onResume: () => void;
}

/** Soviet-themed modal shown after gulag rehabilitation with loss summary. */
export const RehabilitationModal: React.FC<RehabilitationModalProps> = ({
  visible,
  data,
  playerName = 'CHAIRMAN',
  onResume,
}) => {
  if (!visible || !data) return null;

  const severity = data.consequenceLevel === 'harsh' ? 'SEVERE' : 'MODERATE';

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="REHABILITATION DECREE"
      stampText="REHABILITATED"
      actionLabel="Resume Service"
      onAction={onResume}
    >
      <Text style={styles.headline}>
        COMRADE {playerName} HAS BEEN REHABILITATED{'\n'}
        AFTER {data.yearsAway} YEAR{data.yearsAway > 1 ? 'S' : ''} IN CORRECTIVE LABOR
      </Text>

      <View style={styles.separator} />

      <Text style={styles.subheading}>DAMAGE ASSESSMENT ({severity})</Text>

      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Buildings Lost:</Text>
        <Text style={styles.statValue}>{data.buildingsLost}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Workers Lost:</Text>
        <Text style={styles.statValue}>{data.workersLost}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Rubles Lost:</Text>
        <Text style={styles.statValue}>{data.resourcesLost.money}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Food Lost:</Text>
        <Text style={styles.statValue}>{data.resourcesLost.food}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Vodka Lost:</Text>
        <Text style={styles.statValue}>{data.resourcesLost.vodka}</Text>
      </View>

      <View style={styles.separator} />

      <Text style={styles.statRow}>
        <Text style={styles.statLabel}>Black Marks Reset To: </Text>
        <Text style={styles.statValue}>{data.marksReset}</Text>
      </Text>

      <View style={styles.separator} />

      <Text style={styles.flavor}>
        The State, in its infinite mercy, has determined that your crimes were insufficiently criminal to warrant
        permanent removal. Your replacement was worse. Resume your duties immediately.
      </Text>
    </SovietModal>
  );
};

const styles = StyleSheet.create({
  headline: {
    fontFamily: monoFont,
    fontSize: 14,
    color: Colors.sovietGold,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.sovietGold,
    opacity: 0.3,
    marginVertical: 8,
  },
  subheading: {
    fontFamily: monoFont,
    fontSize: 12,
    color: Colors.termGreen,
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  statValue: {
    fontFamily: monoFont,
    fontSize: 11,
    color: Colors.sovietGold,
    fontWeight: 'bold',
  },
  flavor: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
});
