/**
 * Lighting — bright, inviting scene lighting with day/night cycle.
 *
 * - DirectionalLight "sun" rotates by timeOfDay (0-1), casts shadows
 * - HemisphericLight provides warm ambient fill
 * - Light fog for depth cueing (not oppressive Soviet gloom)
 * - ShadowGenerator for ground-contact shadows
 */
import React, { useEffect, useRef } from 'react';
import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  Vector3,
} from '@babylonjs/core';
import { useScene } from 'reactylon';
import type { Season } from './TerrainGrid';

interface LightingProps {
  /** 0-1: 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk */
  timeOfDay?: number;
  season?: Season;
  isStorm?: boolean;
}

/** Bright sky blue — the game should feel inviting, not oppressive */
const SKY_COLOR = new Color4(0.53, 0.68, 0.85, 1);
const FOG_COLOR = new Color3(0.65, 0.72, 0.82);

/** Season multiplier for hemisphere light intensity */
function seasonBrightness(season: Season): number {
  switch (season) {
    case 'summer':
      return 1.15;
    case 'winter':
      return 0.85;
    case 'autumn':
      return 0.95;
    case 'spring':
    default:
      return 1.0;
  }
}

/**
 * Sun intensity over 24h cycle. Peak at noon (timeOfDay=0.5), off at night.
 */
function sunIntensity(t: number): number {
  const angle = t * Math.PI * 2;
  const raw = Math.sin(angle - Math.PI / 2);
  return Math.max(0, raw) * 1.8; // much brighter than before (was 1.2)
}

/**
 * Sun direction vector based on time. Rotates around the scene.
 */
function sunDirection(t: number): Vector3 {
  const angle = t * Math.PI * 2;
  const x = Math.cos(angle);
  const y = -Math.abs(Math.sin(angle)) - 0.3; // steeper downward for better shadows
  const z = 0.3;
  return new Vector3(x, y, z).normalize();
}

/** Exported so Environment.tsx can attach shadow casters */
export let shadowGenerator: ShadowGenerator | null = null;

const Lighting: React.FC<LightingProps> = ({
  timeOfDay = 0.5,
  season = 'summer',
  isStorm = false,
}) => {
  const scene = useScene();
  const sunRef = useRef<DirectionalLight | null>(null);
  const hemiRef = useRef<HemisphericLight | null>(null);
  const shadowRef = useRef<ShadowGenerator | null>(null);

  useEffect(() => {
    // Scene background — bright sky blue
    scene.clearColor = SKY_COLOR;

    // Light fog for depth cueing — much lighter than before
    scene.fogMode = 2; // exponential
    scene.fogColor = FOG_COLOR;

    // Directional light (sun) — main light source
    const dir = sunDirection(timeOfDay);
    const sun = new DirectionalLight('sun', dir, scene);
    sun.diffuse = new Color3(1.0, 0.96, 0.88); // warm sunlight
    sun.specular = new Color3(0.9, 0.85, 0.75);
    sun.intensity = sunIntensity(timeOfDay);
    sun.position = new Vector3(-20, 40, -20); // for shadow projection
    sunRef.current = sun;

    // ShadowGenerator — ground-contact shadows give buildings depth
    const sg = new ShadowGenerator(1024, sun);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 32;
    sg.depthScale = 50;
    sg.darkness = 0.4; // soft shadows, not pitch black
    shadowRef.current = sg;
    shadowGenerator = sg;

    // Hemispheric light — warm ambient fill from above
    const hemi = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    hemi.diffuse = new Color3(0.70, 0.75, 0.85); // sky blue ambient
    hemi.groundColor = new Color3(0.35, 0.32, 0.28); // warm earth bounce
    hemi.intensity = 1.0 * seasonBrightness(season);
    hemiRef.current = hemi;

    return () => {
      sun.dispose();
      hemi.dispose();
      if (shadowRef.current) {
        shadowRef.current.dispose();
        shadowRef.current = null;
        shadowGenerator = null;
      }
    };
  }, [scene]);

  // Update lighting parameters reactively
  useEffect(() => {
    if (sunRef.current) {
      sunRef.current.direction = sunDirection(timeOfDay);
      sunRef.current.intensity = sunIntensity(timeOfDay);
    }
  }, [timeOfDay]);

  useEffect(() => {
    if (hemiRef.current) {
      hemiRef.current.intensity = 1.0 * seasonBrightness(season);
    }
  }, [season]);

  useEffect(() => {
    // Fog density: very light by default, heavier during storms
    let density = 0.002; // much lighter than before (was 0.006)
    const nightFactor = 1 - sunIntensity(timeOfDay);
    density += nightFactor * 0.005;
    if (isStorm) density += 0.01;
    scene.fogDensity = density;
  }, [scene, timeOfDay, isStorm]);

  return null;
};

export default Lighting;
