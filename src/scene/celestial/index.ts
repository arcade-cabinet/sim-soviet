/**
 * Celestial Body Factory — component index.
 *
 * The celestial system provides a unified viewport for rendering ANY celestial body
 * as a 3D sphere that morphs to a flat 2D surface for settlement gameplay.
 *
 * This is the FOUNDATION of the game's visual system. Every settlement exists ON
 * a celestial body, and the viewport smoothly transitions between orbital and
 * surface views as the player zooms in/out.
 *
 * Components:
 * - CelestialViewport: Top-level component composing body + shell with auto-flatten
 * - CelestialBody: Procedural body renderer (Sun/Terran/Martian/Jovian)
 * - MegastructureShell: Hex-panel Dyson shell with build progress
 *
 * CelestialViewport is the DEFAULT ground surface (replaces TerrainGrid).
 * Settlement buildings sit ON the celestial body's surface, which curves
 * when zoomed out and flattens when zoomed in.
 */

export { default as CelestialViewport } from './CelestialViewport';
export type { CelestialViewportProps } from './CelestialViewport';
export { default as CelestialBody } from './CelestialBody';
export type { TerrainConfig } from './CelestialBody';
export { default as MegastructureShell } from './MegastructureShell';
export { BODY_TYPE_VALUE, type CelestialBodyType } from './shaders';
export { sampleHeight, classifyBiome, type PlanetConfig } from './planetGenerator';
