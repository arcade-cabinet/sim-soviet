/**
 * DirectiveHUD — Active directive panel (below minimap).
 * Port of poc.html lines 252-259.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont, SharedStyles } from './styles';

export interface DirectiveHUDProps {
  text: string;
  reward: string; // e.g. "+50₽"
}

export const DirectiveHUD: React.FC<DirectiveHUDProps> = ({ text, reward }) => {
  return (
    <View style={[SharedStyles.panel, styles.container]}>
      <Text style={styles.heading}>ACTIVE DIRECTIVE</Text>
      <Text style={styles.directiveText}>{text}</Text>
      {reward !== '' && reward !== '+0\u20BD' && (
        <View style={styles.rewardBox}>
          <Text style={styles.rewardLabel}>REWARD:</Text>
          <Text style={styles.rewardValue}>{reward}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 190,
    left: 10,
    width: 220,
    padding: 10,
    zIndex: 50,
  },
  heading: {
    color: Colors.termGreen,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    marginBottom: 8,
    paddingBottom: 4,
  },
  directiveText: {
    color: '#e0e0e0',
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 18,
    marginBottom: 8,
  },
  rewardBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 100, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 100, 0, 0.5)',
    padding: 4,
    marginTop: 4,
  },
  rewardLabel: {
    color: '#4caf50',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
  },
  rewardValue: {
    color: Colors.sovietGold,
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
