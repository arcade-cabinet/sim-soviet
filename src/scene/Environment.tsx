/**
 * Environment — Procedural sky, HDRI-lit PBR ground, and diorama hills.
 *
 * - SkyMaterial: procedural atmosphere (Preetham model) — reliable, zero-asset sky
 * - HDRCubeTexture: image-based lighting (IBL) from Poly Haven winter HDRIs
 *   for realistic ambient on PBR materials
 * - Season-dependent ground: snow PBR in winter, grass PBR in summer
 * - Perimeter hills frame the playable area
 *
 * HDRI credits: Poly Haven (CC0) — snowy_field, winter_sky, snowy_park_01
 */
import React, { useEffect, useRef } from 'react';
import {
  Color3,
  HDRCubeTexture,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Texture,
  Vector3,
} from '@babylonjs/core';
import { SkyMaterial } from '@babylonjs/materials';
import { useScene } from 'reactylon';
import { GRID_SIZE } from '../engine/GridTypes';
import type { Season } from './TerrainGrid';

const GROUND_SIZE = 400;
const GROUND_Y = -0.05;

/** Map season to HDRI for image-based lighting */
function getHdriFile(season: Season): string {
  switch (season) {
    case 'winter':
      return '/assets/hdri/snowy_field_1k.hdr';
    case 'autumn':
      return '/assets/hdri/snowy_park_01_1k.hdr';
    default:
      return '/assets/hdri/winter_sky_1k.hdr';
  }
}

/** Configure SkyMaterial for the season */
function configureSky(skyMat: SkyMaterial, season: Season): void {
  skyMat.backFaceCulling = false;

  switch (season) {
    case 'winter':
      // Overcast winter sky — high turbidity, low sun
      skyMat.turbidity = 20;
      skyMat.rayleigh = 1;
      skyMat.luminance = 1.0;
      skyMat.mieCoefficient = 0.01;
      skyMat.mieDirectionalG = 0.8;
      skyMat.inclination = 0.42; // low winter sun
      skyMat.azimuth = 0.25;
      break;
    case 'autumn':
      // Moody golden hour
      skyMat.turbidity = 15;
      skyMat.rayleigh = 2;
      skyMat.luminance = 1.0;
      skyMat.mieCoefficient = 0.008;
      skyMat.mieDirectionalG = 0.8;
      skyMat.inclination = 0.45;
      skyMat.azimuth = 0.25;
      break;
    case 'summer':
    case 'spring':
    default:
      // Bright clear sky
      skyMat.turbidity = 10;
      skyMat.rayleigh = 2;
      skyMat.luminance = 1.0;
      skyMat.mieCoefficient = 0.005;
      skyMat.mieDirectionalG = 0.8;
      skyMat.inclination = 0.49;
      skyMat.azimuth = 0.25;
      break;
  }
}

function getHillColor(season: Season): Color3 {
  switch (season) {
    case 'winter':
      return new Color3(0.82, 0.84, 0.88);
    case 'autumn':
      return new Color3(0.45, 0.40, 0.28);
    default:
      return new Color3(0.32, 0.42, 0.22);
  }
}

interface EnvironmentProps {
  season?: Season;
}

const Environment: React.FC<EnvironmentProps> = ({ season = 'winter' }) => {
  const scene = useScene();
  const meshesRef = useRef<Mesh[]>([]);
  const disposablesRef = useRef<{ dispose(): void }[]>([]);

  useEffect(() => {
    // Dispose previous
    for (const m of meshesRef.current) m.dispose();
    for (const d of disposablesRef.current) d.dispose();
    meshesRef.current = [];
    disposablesRef.current = [];

    const center = GRID_SIZE / 2;

    // --- PROCEDURAL SKY (SkyMaterial) ---
    const skyMat = new SkyMaterial('skyMat', scene);
    configureSky(skyMat, season);

    const skybox = MeshBuilder.CreateBox('skyBox', { size: 1000 }, scene);
    skybox.material = skyMat;
    skybox.infiniteDistance = true;
    meshesRef.current.push(skybox);
    disposablesRef.current.push(skyMat);

    // --- HDRI for Image-Based Lighting (IBL) ---
    // Provides realistic ambient light on PBR materials
    const hdriFile = getHdriFile(season);
    const hdrTexture = new HDRCubeTexture(hdriFile, scene, 256);
    scene.environmentTexture = hdrTexture;
    disposablesRef.current.push(hdrTexture);

    // --- PBR GROUND PLANE ---
    const ground = MeshBuilder.CreateGround(
      'envGround',
      { width: GROUND_SIZE, height: GROUND_SIZE, subdivisions: 4 },
      scene,
    );
    ground.position = new Vector3(center, GROUND_Y, center);
    ground.receiveShadows = true;

    const groundMat = new PBRMaterial('envGroundMat', scene);

    // Season-dependent textures
    const isWinter = season === 'winter';
    const colorFile = isWinter
      ? '/assets/textures/snow/Snow003_1K-JPG_Color.jpg'
      : '/assets/textures/grass/Grass001_1K-JPG_Color.jpg';
    const normalFile = isWinter
      ? '/assets/textures/snow/Snow003_1K-JPG_NormalGL.jpg'
      : '/assets/textures/grass/Grass001_1K-JPG_NormalGL.jpg';
    const roughFile = isWinter
      ? '/assets/textures/snow/Snow003_1K-JPG_Roughness.jpg'
      : '/assets/textures/grass/Grass001_1K-JPG_Roughness.jpg';

    const tileScale = 20;

    const albedo = new Texture(colorFile, scene);
    albedo.uScale = tileScale;
    albedo.vScale = tileScale;
    groundMat.albedoTexture = albedo;

    const normalTex = new Texture(normalFile, scene);
    normalTex.uScale = tileScale;
    normalTex.vScale = tileScale;
    groundMat.bumpTexture = normalTex;

    const roughTex = new Texture(roughFile, scene);
    roughTex.uScale = tileScale;
    roughTex.vScale = tileScale;
    groundMat.metallicTexture = roughTex;
    groundMat.useRoughnessFromMetallicTextureGreen = true;
    groundMat.metallic = 0;
    groundMat.roughness = 1;

    ground.material = groundMat;
    meshesRef.current.push(ground);
    disposablesRef.current.push(groundMat);

    // --- PERIMETER HILLS ---
    // PBRMaterial with max roughness prevents IBL reflections (the "glowing ball" problem)
    const hillMat = new PBRMaterial('hillMat', scene);
    hillMat.albedoColor = getHillColor(season);
    hillMat.roughness = 1;
    hillMat.metallic = 0;
    disposablesRef.current.push(hillMat);

    const hills = [
      { x: center - 15, z: -25, sx: 20, sy: 4, sz: 12 },
      { x: center + 10, z: -30, sx: 25, sy: 5, sz: 15 },
      { x: center + 35, z: -20, sx: 18, sy: 3.5, sz: 10 },
      { x: center - 10, z: GRID_SIZE + 25, sx: 22, sy: 4.5, sz: 13 },
      { x: center + 20, z: GRID_SIZE + 30, sx: 28, sy: 6, sz: 16 },
      { x: GRID_SIZE + 25, z: center - 10, sx: 15, sy: 4, sz: 20 },
      { x: GRID_SIZE + 30, z: center + 15, sx: 20, sy: 5, sz: 18 },
      { x: -25, z: center, sx: 18, sy: 3.5, sz: 22 },
      { x: -30, z: center + 20, sx: 22, sy: 4.5, sz: 15 },
      { x: -20, z: -20, sx: 15, sy: 3, sz: 15 },
      { x: GRID_SIZE + 20, z: GRID_SIZE + 20, sx: 18, sy: 4, sz: 18 },
      { x: GRID_SIZE + 25, z: -15, sx: 16, sy: 3.5, sz: 14 },
      { x: -15, z: GRID_SIZE + 15, sx: 14, sy: 3, sz: 16 },
    ];

    for (let i = 0; i < hills.length; i++) {
      const h = hills[i];
      const hill = MeshBuilder.CreateSphere(
        `hill_${i}`,
        { diameter: 1, segments: 8 },
        scene,
      );
      hill.scaling = new Vector3(h.sx, h.sy, h.sz);
      hill.position = new Vector3(h.x, h.sy * 0.3, h.z);
      hill.material = hillMat;
      meshesRef.current.push(hill);
    }

    return () => {
      for (const m of meshesRef.current) m.dispose();
      for (const d of disposablesRef.current) d.dispose();
      meshesRef.current = [];
      disposablesRef.current = [];
      scene.environmentTexture = null;
    };
  }, [scene, season]);

  return null;
};

export default Environment;
