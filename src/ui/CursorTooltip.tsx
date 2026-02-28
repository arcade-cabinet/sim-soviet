/**
 * CursorTooltip — Tile info popup on long-press / hover.
 * Port of poc.html lines 108-145.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from './styles';

export interface TileData {
  terrain: string;
  type?: string;
  smog: number;
  watered: boolean;
  onFire: boolean;
  zone?: string;
  z: number;
}

export interface CursorTooltipProps {
  visible: boolean;
  tileData: TileData;
  position: { x: number; y: number };
}

function smogColor(level: number): string {
  if (level < 30) return Colors.termGreen;
  if (level < 60) return Colors.sovietGold;
  return Colors.sovietRed;
}

function statusInfo(tile: TileData): { label: string; color: string } {
  if (tile.onFire) return { label: 'FIRE', color: '#ef5350' };
  return { label: 'NORMAL', color: Colors.textSecondary };
}

function buildWarning(tile: TileData): string | null {
  if (tile.terrain === 'river' || tile.terrain === 'water') return 'CANNOT BUILD ON RIVER';
  if (tile.type && tile.type !== 'empty') return 'OBSTRUCTED';
  return null;
}

export const CursorTooltip: React.FC<CursorTooltipProps> = ({ visible, tileData, position }) => {
  if (!visible) return null;

  const status = statusInfo(tileData);
  const warning = buildWarning(tileData);
  const displayName =
    tileData.type && tileData.type !== 'empty' ? tileData.type.toUpperCase() : tileData.terrain.toUpperCase();

  return (
    <View style={[styles.container, { left: position.x + 16, top: position.y + 16 }]}>
      <Text style={styles.title}>{displayName}</Text>

      <Text style={styles.row}>TERRAIN: {tileData.terrain.toUpperCase()}</Text>

      <Text style={[styles.row, { color: smogColor(tileData.smog) }]}>SMOG: {Math.floor(tileData.smog)}</Text>

      <Text
        style={[
          styles.row,
          { color: tileData.watered ? '#60a5fa' : '#757575' },
          tileData.watered && { fontWeight: 'bold' },
        ]}
      >
        WATER: {tileData.watered ? 'CONNECTED' : 'DRY'}
      </Text>

      <Text style={[styles.row, { color: status.color }]}>STATUS: {status.label}</Text>

      {warning ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>{warning}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 20, 25, 0.95)',
    borderWidth: 2,
    borderColor: Colors.termBlue,
    padding: 12,
    gap: 4,
    minWidth: 180,
    zIndex: 3000,
  },
  title: {
    color: Colors.termBlue,
    fontFamily: monoFont,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    paddingBottom: 4,
    marginBottom: 4,
  },
  row: {
    color: '#9e9e9e',
    fontFamily: monoFont,
    fontSize: 12,
  },
  warnBox: {
    backgroundColor: 'rgba(180, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: '#ef5350',
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 4,
  },
  warnText: {
    color: '#ef5350',
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
