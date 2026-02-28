/**
 * Minimap — 120×120 canvas rendering the 30×30 grid as colored pixels.
 *
 * Terrain colors: grass=green, water=blue, tree=dark green, mountain=gray,
 * irradiated=yellow-green, marsh=olive, rail=brown.
 * Buildings show as white dots. Smog as orange tint.
 * Redraws every 500ms via setInterval (not per-frame — minimap is low priority).
 */

import React, { useEffect, useRef } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { SharedStyles } from './styles';
import { getGridCells } from '../bridge/ECSBridge';
import { GRID_SIZE, type TerrainType } from '../engine/GridTypes';

const PIXEL_SIZE = Math.floor(120 / GRID_SIZE); // 4px per cell
const CANVAS_SIZE = PIXEL_SIZE * GRID_SIZE;       // 120px

const TERRAIN_COLORS: Record<TerrainType, string> = {
  grass: '#3a5a2c',
  water: '#2a5c8c',
  tree: '#1e3a14',
  mountain: '#6b6b6b',
  crater: '#4a3a2a',
  irradiated: '#7a8a20',
  marsh: '#4a5a30',
  rail: '#5a4a3a',
};

const BUILDING_COLOR = '#ddd';
const SMOG_TINT = '#c04000';

export const Minimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const grid = getGridCells();
      if (!grid.length) return;

      for (let y = 0; y < GRID_SIZE; y++) {
        const row = grid[y];
        if (!row) continue;
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = row[x];
          if (!cell) continue;

          // Base terrain color
          ctx.fillStyle = TERRAIN_COLORS[cell.terrain] || '#3a5a2c';
          ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);

          // Smog tint overlay
          if (cell.smog > 10) {
            const smogAlpha = Math.min(0.5, cell.smog / 200);
            ctx.fillStyle = SMOG_TINT;
            ctx.globalAlpha = smogAlpha;
            ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
            ctx.globalAlpha = 1;
          }

          // Building dot
          if (cell.type) {
            ctx.fillStyle = BUILDING_COLOR;
            ctx.fillRect(
              x * PIXEL_SIZE + 1,
              y * PIXEL_SIZE + 1,
              PIXEL_SIZE - 2,
              PIXEL_SIZE - 2,
            );
          }
        }
      }
    }

    // Initial draw + periodic refresh
    draw();
    const interval = setInterval(draw, 500);
    return () => clearInterval(interval);
  }, []);

  if (Platform.OS !== 'web') {
    // Fallback for native — still a placeholder
    return (
      <View style={[SharedStyles.panel, styles.container]}>
        <View style={styles.placeholder} />
      </View>
    );
  }

  return (
    <View style={[SharedStyles.panel, styles.container]}>
      <canvas
        ref={canvasRef as any}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated' } as any}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 10,
    width: 120,
    height: 120,
    zIndex: 50,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});
