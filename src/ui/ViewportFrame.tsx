/**
 * ViewportFrame — Brutalist concrete decorative frame around the game viewport.
 *
 * Non-interactive, purely decorative. Concrete gray border with industrial
 * texture feel and Soviet corner motifs (hammer & sickle stars).
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const ViewportFrame: React.FC = () => {
  return (
    <View style={styles.frame} pointerEvents="none">
      {/* Corner elements */}
      <View style={[styles.corner, styles.cornerTL]}>
        <Text style={styles.cornerGlyph}>{'\u2605'}</Text>
      </View>
      <View style={[styles.corner, styles.cornerTR]}>
        <Text style={styles.cornerGlyph}>{'\u2605'}</Text>
      </View>
      <View style={[styles.corner, styles.cornerBL]}>
        <Text style={styles.cornerGlyph}>{'\u2605'}</Text>
      </View>
      <View style={[styles.corner, styles.cornerBR]}>
        <Text style={styles.cornerGlyph}>{'\u2605'}</Text>
      </View>
    </View>
  );
};

const BORDER_WIDTH = 4;
const CORNER_SIZE = 20;

const styles = StyleSheet.create({
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: BORDER_WIDTH,
    borderColor: '#606060',
    borderTopColor: '#787878',
    borderLeftColor: '#787878',
    borderBottomColor: '#484848',
    borderRightColor: '#484848',
    zIndex: 40,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    backgroundColor: '#585858',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#707070',
  },
  cornerTL: {
    top: -BORDER_WIDTH,
    left: -BORDER_WIDTH,
  },
  cornerTR: {
    top: -BORDER_WIDTH,
    right: -BORDER_WIDTH,
  },
  cornerBL: {
    bottom: -BORDER_WIDTH,
    left: -BORDER_WIDTH,
  },
  cornerBR: {
    bottom: -BORDER_WIDTH,
    right: -BORDER_WIDTH,
  },
  cornerGlyph: {
    fontSize: 10,
    color: '#8b0000',
    opacity: 0.6,
  },
});
