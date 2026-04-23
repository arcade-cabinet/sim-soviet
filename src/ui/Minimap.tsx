/**
 * Minimap — 120x120 rendering of the grid as colored pixels.
 *
 * Web: uses a `<canvas>` element for fast pixel drawing.
 * Native: uses a grid of tiny colored `<View>` cells (no canvas available).
 *
 * Terrain colors: grass=green, water=blue, tree=dark green, mountain=gray,
 * irradiated=yellow-green, marsh=olive, rail=brown.
 * Buildings show as white dots. Smog as orange tint.
 * Redraws every 500ms via setInterval (not per-frame — minimap is low priority).
 */

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getGridCells } from '../bridge/ECSBridge';
import type { GridCell } from '../engine/GridTypes';
import { getCurrentGridSize, type TerrainType } from '../engine/GridTypes';
import { Colors, monoFont, SharedStyles } from './styles';
import { useResponsive } from './useResponsive';

const TERRAIN_COLORS: Record<TerrainType, string> = {
  grass: '#3a5a2c',
  water: '#2a5c8c',
  tree: '#1e3a14',
  mountain: '#6b6b6b',
  crater: '#4a3a2a',
  irradiated: '#7a8a20',
  marsh: '#4a5a30',
  rail: '#5a4a3a',
  path: '#7a6a50',
};

const BUILDING_COLOR = '#ddd';

/**
 * Determine the display color for a grid cell.
 * Buildings override terrain color; smog tints orange.
 */
function getCellColor(cell: GridCell): string {
  if (cell.type) return BUILDING_COLOR;
  if (cell.smog > 10) return '#c04000';
  return TERRAIN_COLORS[cell.terrain] || '#3a5a2c';
}

/** Native minimap using a grid of tiny colored View cells. */
const NativeMinimap: React.FC = () => {
  const [gridSnapshot, setGridSnapshot] = useState<GridCell[][] | null>(null);

  useEffect(() => {
    function refresh() {
      const grid = getGridCells();
      if (grid.length > 0) setGridSnapshot(grid);
    }
    refresh();
    const interval = setInterval(refresh, 500);
    return () => clearInterval(interval);
  }, []);

  const cells = useMemo(() => {
    if (!gridSnapshot) return null;
    const views: React.ReactElement[] = [];
    const gridSize = getCurrentGridSize();
    const pixelSize = Math.floor(120 / gridSize);
    const size = Math.min(gridSnapshot.length, gridSize);
    for (let y = 0; y < size; y++) {
      const row = gridSnapshot[y];
      if (!row) continue;
      for (let x = 0; x < size; x++) {
        const cell = row[x];
        if (!cell) continue;
        views.push(
          <View
            key={`${x}_${y}`}
            style={{
              position: 'absolute',
              left: x * pixelSize,
              top: y * pixelSize,
              width: pixelSize,
              height: pixelSize,
              backgroundColor: getCellColor(cell),
            }}
          />,
        );
      }
    }
    return views;
  }, [gridSnapshot]);

  const nativeGridSize = useMemo(() => {
    const gs = getCurrentGridSize();
    const ps = Math.floor(120 / gs);
    return ps * gs;
  }, []);

  return (
    <View style={[SharedStyles.panel, styles.container]}>
      <View style={{ width: nativeGridSize, height: nativeGridSize }}>{cells}</View>
    </View>
  );
};

/** Web minimap using a canvas element for fast pixel drawing. */
const WebMinimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridSize = getCurrentGridSize();
  const pixelSize = Math.floor(120 / gridSize);
  const canvasSize = pixelSize * gridSize;

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const grid = getGridCells();
      if (!grid.length) return;

      for (let y = 0; y < gridSize; y++) {
        const row = grid[y];
        if (!row) continue;
        for (let x = 0; x < gridSize; x++) {
          const cell = row[x];
          if (!cell) continue;

          // Base terrain color
          ctx.fillStyle = TERRAIN_COLORS[cell.terrain] || '#3a5a2c';
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);

          // Smog tint overlay
          if (cell.smog > 10) {
            const smogAlpha = Math.min(0.5, cell.smog / 200);
            ctx.fillStyle = '#c04000';
            ctx.globalAlpha = smogAlpha;
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            ctx.globalAlpha = 1;
          }

          // Building dot
          if (cell.type) {
            ctx.fillStyle = BUILDING_COLOR;
            ctx.fillRect(x * pixelSize + 1, y * pixelSize + 1, pixelSize - 2, pixelSize - 2);
          }
        }
      }
    }

    // Initial draw + periodic refresh
    draw();
    const interval = setInterval(draw, 500);
    return () => clearInterval(interval);
  }, [gridSize, pixelSize]);

  return (
    <View style={[SharedStyles.panel, styles.container]}>
      <canvas
        ref={canvasRef as any}
        width={canvasSize}
        height={canvasSize}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated' } as any}
      />
    </View>
  );
};

/** Canvas-based minimap (web) or View-based minimap (native) rendering real grid data. */
export const Minimap: React.FC = () => {
  const { isCompact } = useResponsive();
  const [visible, setVisible] = useState(!isCompact);

  if (isCompact && !visible) {
    return (
      <TouchableOpacity style={styles.toggleBtn} onPress={() => setVisible(true)} activeOpacity={0.7}>
        <Text style={styles.toggleBtnText}>{'\u{1F5FA}'}</Text>
      </TouchableOpacity>
    );
  }

  const content = Platform.OS !== 'web' ? <NativeMinimap /> : <WebMinimap />;

  if (isCompact) {
    return (
      <View>
        {content}
        <TouchableOpacity style={styles.closeBtnCompact} onPress={() => setVisible(false)} activeOpacity={0.7}>
          <Text style={styles.closeBtnText}>X</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <View>{content}</View>;
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
  toggleBtn: {
    position: 'absolute',
    bottom: 140,
    right: 10,
    width: 44,
    height: 44,
    backgroundColor: Colors.panelBg,
    borderWidth: 2,
    borderTopColor: Colors.panelHighlight,
    borderLeftColor: Colors.panelHighlight,
    borderBottomColor: Colors.panelShadow,
    borderRightColor: Colors.panelShadow,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  toggleBtnText: {
    fontSize: 18,
  },
  closeBtnCompact: {
    position: 'absolute',
    top: 60,
    left: 102,
    width: 20,
    height: 20,
    backgroundColor: Colors.panelBg,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 51,
  },
  closeBtnText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
});
