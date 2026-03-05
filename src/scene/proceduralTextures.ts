/**
 * Procedural canvas-based texture generators for contexts where
 * photographic PBR textures look wrong (Dyson panels, orbital corridors,
 * maintenance walkways).
 */
import * as THREE from 'three';

/**
 * Tileable metal panel grid — riveted industrial plates with visible gaps.
 * Use for Dyson sphere interior panels, orbital station walls.
 */
export function generateMetalPanelTexture(
  width: number,
  height: number,
  panelSize: number,
  gapWidth: number,
  color: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base panel color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // Gap color (dark seam between panels)
  ctx.fillStyle = '#1a1a1a';

  const cols = Math.ceil(width / panelSize);
  const rows = Math.ceil(height / panelSize);

  for (let col = 0; col <= cols; col++) {
    const x = col * panelSize - gapWidth / 2;
    ctx.fillRect(x, 0, gapWidth, height);
  }
  for (let row = 0; row <= rows; row++) {
    const y = row * panelSize - gapWidth / 2;
    ctx.fillRect(0, y, width, gapWidth);
  }

  // Subtle per-panel shade variation for visual interest
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const shade = (((row * 7 + col * 13) % 5) - 2) * 4; // -8 to +8
      const x = col * panelSize + gapWidth / 2;
      const y = row * panelSize + gapWidth / 2;
      const w = panelSize - gapWidth;
      const h = panelSize - gapWidth;
      if (shade > 0) {
        ctx.fillStyle = `rgba(255,255,255,${shade / 255})`;
      } else {
        ctx.fillStyle = `rgba(0,0,0,${-shade / 255})`;
      }
      ctx.fillRect(x, y, w, h);
    }
  }

  // Rivet dots at panel corners
  ctx.fillStyle = '#555555';
  const rivetRadius = Math.max(1, gapWidth * 0.6);
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const cx = col * panelSize;
      const cy = row * panelSize;
      ctx.beginPath();
      ctx.arc(cx, cy, rivetRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Circuit-board trace pattern — glowing lines on dark substrate.
 * Use for orbital habitat floors, high-tech interior surfaces.
 */
export function generateCircuitTexture(
  width: number,
  height: number,
  lineWidth: number,
  color: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Dark substrate
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'square';

  // Deterministic pseudo-random grid-based traces
  const cellSize = 32;
  const cols = Math.floor(width / cellSize);
  const rows = Math.floor(height / cellSize);

  // Seed-based deterministic hash for reproducibility
  function hash(x: number, y: number): number {
    let h = (x * 374761393 + y * 668265263) >>> 0;
    h = ((h ^ (h >> 13)) * 1274126177) >>> 0;
    return (h ^ (h >> 16)) >>> 0;
  }

  // Horizontal traces
  for (let row = 0; row < rows; row++) {
    const y = row * cellSize + cellSize / 2;
    let drawing = false;
    let startX = 0;
    for (let col = 0; col < cols; col++) {
      const h = hash(col, row);
      if (!drawing && h % 5 === 0) {
        drawing = true;
        startX = col * cellSize;
      } else if (drawing && (h % 4 === 0 || col === cols - 1)) {
        drawing = false;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo((col + 1) * cellSize, y);
        ctx.stroke();
      }
    }
  }

  // Vertical traces
  for (let col = 0; col < cols; col++) {
    const x = col * cellSize + cellSize / 2;
    let drawing = false;
    let startY = 0;
    for (let row = 0; row < rows; row++) {
      const h = hash(col + 100, row + 100);
      if (!drawing && h % 6 === 0) {
        drawing = true;
        startY = row * cellSize;
      } else if (drawing && (h % 3 === 0 || row === rows - 1)) {
        drawing = false;
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, (row + 1) * cellSize);
        ctx.stroke();
      }
    }
  }

  // Junction pads at trace intersections
  ctx.fillStyle = color;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const h = hash(col + 200, row + 200);
      if (h % 11 === 0) {
        const cx = col * cellSize + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;
        const padSize = lineWidth * 2;
        ctx.fillRect(cx - padSize / 2, cy - padSize / 2, padSize, padSize);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Metal grating with parallel bars and gaps — see-through flooring.
 * Use for maintenance walkways, ventilation covers, Dyson catwalks.
 */
export function generateGratingTexture(
  width: number,
  height: number,
  barWidth: number,
  gapWidth: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Transparent/dark gaps between bars
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, width, height);

  const step = barWidth + gapWidth;

  // Primary bars (horizontal)
  ctx.fillStyle = '#6a6a6a';
  for (let y = 0; y < height; y += step) {
    ctx.fillRect(0, y, width, barWidth);

    // Highlight on top edge of each bar
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, y, width, Math.max(1, barWidth * 0.2));
    // Shadow on bottom edge
    ctx.fillStyle = '#444444';
    ctx.fillRect(0, y + barWidth - Math.max(1, barWidth * 0.2), width, Math.max(1, barWidth * 0.2));

    ctx.fillStyle = '#6a6a6a';
  }

  // Cross-bars (vertical, thinner)
  const crossBarWidth = Math.max(1, barWidth * 0.4);
  const crossStep = step * 4;
  ctx.fillStyle = '#5a5a5a';
  for (let x = 0; x < width; x += crossStep) {
    ctx.fillRect(x, 0, crossBarWidth, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
