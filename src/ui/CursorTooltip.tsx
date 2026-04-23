/**
 * CursorTooltip — Tile info popup on long-press / hover.
 * Port of poc.html lines 108-145.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, monoFont } from './styles';

/** Grid cell information displayed in the cursor tooltip on hover/long-press. */
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

/** Human-readable labels for internal terrain enum IDs. */
const TERRAIN_LABELS: Record<string, string> = {
  tree: 'FOREST',
  forest: 'FOREST',
  grass: 'GRASSLAND',
  dirt: 'BARE EARTH',
  rock: 'ROCKY',
  water: 'WATER',
  river: 'RIVER',
  mud: 'MUD',
  snow: 'SNOW',
  sand: 'SAND',
  swamp: 'SWAMP',
  tundra: 'TUNDRA',
  steppe: 'STEPPE',
  farmland: 'FARMLAND',
  ruins: 'RUINS',
};

/** Returns the player-facing terrain label, falling back to the raw ID in title case. */
function terrainLabel(terrain: string): string {
  return TERRAIN_LABELS[terrain.toLowerCase()] ?? terrain.toUpperCase();
}

/** Returns a severity color (green/gold/red) based on smog level thresholds. */
function smogColor(level: number): string {
  if (level < 30) return Colors.termGreen;
  if (level < 60) return Colors.sovietGold;
  return Colors.sovietRed;
}

/** Returns a status label and color for tile conditions (fire, normal). */
function statusInfo(tile: TileData): { label: string; color: string } {
  if (tile.onFire) return { label: 'FIRE', color: '#ef5350' };
  return { label: 'NORMAL', color: Colors.textSecondary };
}

/** Returns a terrain/occupancy warning message, or null if the tile is ordinary ground. */
function tileWarning(tile: TileData): string | null {
  if (tile.terrain === 'river' || tile.terrain === 'water') return 'WATERCOURSE';
  if (tile.type && tile.type !== 'empty') return 'OCCUPIED';
  return null;
}

/** Floating tooltip showing grid tile info on long-press or hover. */
export const CursorTooltip: React.FC<CursorTooltipProps> = ({ visible, tileData, position }) => {
  if (!visible) return null;

  const status = statusInfo(tileData);
  const warning = tileWarning(tileData);
  const displayName =
    tileData.type && tileData.type !== 'empty' ? tileData.type.toUpperCase() : tileData.terrain.toUpperCase();

  return (
    <View style={[styles.container, { left: position.x + 16, top: position.y + 16 }]}>
      <Text style={styles.title}>{displayName}</Text>

      <Text style={styles.row}>TERRAIN: {terrainLabel(tileData.terrain)}</Text>

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
