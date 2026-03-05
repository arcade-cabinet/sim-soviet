/**
 * CPU-side procedural planet heightmap generator.
 *
 * Uses seeded FBM (Fractal Brownian Motion) over simplex-like noise
 * to produce deterministic terrain for any celestial body.
 * No external dependencies — all noise is inline.
 */

// ── Seeded hash + noise primitives ──────────────────────────────────────────

/** Seeded 3D hash → [0, 1). */
function hash3(x: number, y: number, z: number, seed: number): number {
  const dot = x * 127.1 + y * 311.7 + z * 74.7 + seed * 1313.17;
  return ((Math.sin(dot) * 43758.5453) % 1 + 1) % 1;
}

/** Smooth interpolation (Hermite). */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Floor that works correctly for negatives. */
function ifloor(x: number): number {
  return Math.floor(x);
}

/**
 * Seeded value noise in 3D — returns [-1, 1].
 * Simple but effective; the FBM layering hides lattice artifacts.
 */
function valueNoise3D(x: number, y: number, z: number, seed: number): number {
  const ix = ifloor(x);
  const iy = ifloor(y);
  const iz = ifloor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const sx = smoothstep(fx);
  const sy = smoothstep(fy);
  const sz = smoothstep(fz);

  // 8 corner hashes
  const n000 = hash3(ix, iy, iz, seed);
  const n100 = hash3(ix + 1, iy, iz, seed);
  const n010 = hash3(ix, iy + 1, iz, seed);
  const n110 = hash3(ix + 1, iy + 1, iz, seed);
  const n001 = hash3(ix, iy, iz + 1, seed);
  const n101 = hash3(ix + 1, iy, iz + 1, seed);
  const n011 = hash3(ix, iy + 1, iz + 1, seed);
  const n111 = hash3(ix + 1, iy + 1, iz + 1, seed);

  // Trilinear interpolation
  const nx00 = lerp(n000, n100, sx);
  const nx10 = lerp(n010, n110, sx);
  const nx01 = lerp(n001, n101, sx);
  const nx11 = lerp(n011, n111, sx);
  const nxy0 = lerp(nx00, nx10, sy);
  const nxy1 = lerp(nx01, nx11, sy);
  return lerp(nxy0, nxy1, sz) * 2 - 1; // remap [0,1] → [-1,1]
}

// ── FBM ─────────────────────────────────────────────────────────────────────

/**
 * Fractal Brownian Motion: sum of N octaves with decreasing amplitude.
 * Returns roughly [-1, 1] but may exceed slightly.
 */
function fbm(
  x: number,
  y: number,
  z: number,
  seed: number,
  octaves: number,
): number {
  let value = 0;
  let amplitude = 0.5;
  let px = x;
  let py = y;
  let pz = z;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise3D(px, py, pz, seed + i * 31);
    px *= 2;
    py *= 2;
    pz *= 2;
    amplitude *= 0.5;
  }
  return value;
}

// ── Crater generation ───────────────────────────────────────────────────────

interface CraterSite {
  cx: number;
  cy: number;
  cz: number;
  radius: number;
  depth: number;
}

/**
 * Generate deterministic crater positions on the unit sphere.
 * Count is proportional to craterDensity.
 */
function generateCraters(seed: number, density: number): CraterSite[] {
  const count = Math.round(density * 40);
  const craters: CraterSite[] = [];
  for (let i = 0; i < count; i++) {
    const h1 = hash3(i * 7.3, i * 13.1, seed, 9999);
    const h2 = hash3(i * 17.3, seed, i * 23.1, 8888);
    const h3 = hash3(seed, i * 37.1, i * 41.3, 7777);
    // Uniform sphere distribution via acos/phi
    const theta = h1 * Math.PI * 2;
    const phi = Math.acos(2 * h2 - 1);
    const cx = Math.sin(phi) * Math.cos(theta);
    const cy = Math.cos(phi);
    const cz = Math.sin(phi) * Math.sin(theta);
    const radius = 0.05 + h3 * 0.15; // angular radius on unit sphere
    const depth = 0.3 + hash3(i, seed, 42, 6666) * 0.7;
    craters.push({ cx, cy, cz, radius, depth });
  }
  return craters;
}

/**
 * Compute crater depression at a point on the unit sphere.
 * Returns a negative value (depression depth) or 0.
 */
function sampleCraters(
  nx: number,
  ny: number,
  nz: number,
  craters: CraterSite[],
): number {
  let depression = 0;
  for (const c of craters) {
    // Great-circle angular distance approximated by chord distance
    const dx = nx - c.cx;
    const dy = ny - c.cy;
    const dz = nz - c.cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < c.radius * 2) {
      const t = dist / c.radius;
      if (t < 1) {
        // Bowl shape: deeper at center, raised rim at edge
        const bowl = (t * t - 1) * c.depth;
        depression += bowl;
      } else if (t < 1.5) {
        // Raised rim
        const rim = (1 - (t - 1) / 0.5) * c.depth * 0.2;
        depression += rim;
      }
    }
  }
  return depression;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface PlanetConfig {
  seed: number;
  seaLevel: number;
  mountainAmplitude: number;
  noiseOctaves: number;
  noiseScale: number;
  continentBias: number;
  craterDensity?: number;
}

/**
 * Sample the heightmap at a point on the unit sphere.
 * (x, y, z) should be normalized (on the unit sphere).
 *
 * Returns a height value in roughly [0, 1] range where:
 * - 0 = deepest ocean/lowest terrain
 * - seaLevel = shoreline
 * - 1 = highest peak
 */
export function sampleHeight(
  x: number,
  y: number,
  z: number,
  config: PlanetConfig,
): number {
  const { seed, noiseOctaves, noiseScale, continentBias, mountainAmplitude, craterDensity } = config;

  // Base terrain from multi-octave FBM
  const px = x * noiseScale;
  const py = y * noiseScale;
  const pz = z * noiseScale;
  let height = fbm(px, py, pz, seed, noiseOctaves);

  // Continent bias: low-frequency layer that creates large landmasses
  if (continentBias > 0) {
    const continentNoise = fbm(
      x * noiseScale * 0.3,
      y * noiseScale * 0.3,
      z * noiseScale * 0.3,
      seed + 777,
      3,
    );
    height += continentNoise * continentBias;
  }

  // Craters
  if (craterDensity && craterDensity > 0) {
    const craters = generateCraters(seed, craterDensity);
    height += sampleCraters(x, y, z, craters) * 0.3;
  }

  // Apply mountain amplitude scaling
  height *= mountainAmplitude;

  // Remap from [-amplitude, amplitude] to [0, 1]
  height = (height + mountainAmplitude) / (2 * mountainAmplitude);

  return Math.max(0, Math.min(1, height));
}

/**
 * Classify a biome from height + latitude for Terran-type bodies.
 *
 * Returns one of: 'ocean' | 'shore' | 'land' | 'mountain' | 'snow' | 'ice'
 */
export function classifyBiome(
  height: number,
  latitude: number,
  seaLevel: number,
  profile: 'terran' | 'martian' | 'lunar',
): string {
  const absLat = Math.abs(latitude);

  if (profile === 'lunar') {
    if (height < 0.3) return 'mare';
    if (height > 0.7) return 'highland';
    return 'regolith';
  }

  if (profile === 'martian') {
    if (absLat > 0.85) return 'polar_ice';
    if (height > 0.75) return 'canyon';
    if (height > 0.5) return 'rock';
    return 'dust';
  }

  // Terran
  if (absLat > 0.7) return 'ice';
  if (height < seaLevel - 0.1) return 'ocean';
  if (height < seaLevel) return 'shore';
  if (height > 0.85) return 'snow';
  if (height > 0.65) return 'mountain';
  return 'land';
}

// Re-export primitives for testing
export { fbm as _fbm, valueNoise3D as _valueNoise3D, hash3 as _hash3 };
