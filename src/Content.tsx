/**
 * Content — Scene graph root that composes all 3D components.
 *
 * Placed inside <Canvas> by App.web.tsx. Reads game state via the
 * useGameSnapshot hook and passes derived props to each scene component.
 *
 * After the archive merge, building data comes from the ECS bridge
 * while the old GameState is kept for visual-only systems (weather, time).
 *
 * R3F migration: uses drei's useProgress for loading tracking.
 * Models are preloaded via ModelPreloader (import side-effect).
 */

import React, { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { useGameSnapshot } from './hooks/useGameState';
import AudioManager from './audio/AudioManager';
import { gameState } from './engine/GameState';
import { getBuildingStates, getGridCells } from './bridge/ECSBridge';
import { notifyStateChange, useTerrainVersion } from './stores/gameStore';
import type { SettlementTier } from './game/SettlementSystem';

// Import ModelPreloader for its side-effect (calls useGLTF.preload)
import './scene/ModelPreloader';
import { TOTAL_MODEL_COUNT } from './scene/ModelPreloader';

// Scene components
import TerrainGrid from './scene/TerrainGrid';
import CameraController from './scene/CameraController';
import Lighting from './scene/Lighting';
import BuildingRenderer from './scene/BuildingRenderer';
import WeatherFX from './scene/WeatherFX';
import SmogOverlay from './scene/SmogOverlay';
import FireRenderer from './scene/FireRenderer';
import AuraRenderer from './scene/AuraRenderer';
import LightningRenderer from './scene/LightningRenderer';
import TrainRenderer from './scene/TrainRenderer';
import VehicleRenderer from './scene/VehicleRenderer';
import ZeppelinRenderer from './scene/ZeppelinRenderer';
import MeteorRenderer from './scene/MeteorRenderer';
import GhostPreview from './scene/GhostPreview';
import LensSystem from './scene/LensSystem';
import FloatingText from './scene/FloatingText';
import HeatingOverlay from './scene/HeatingOverlay';
import Environment from './scene/Environment';
import SceneProps from './scene/SceneProps';
import PoliticalEntityRenderer from './scene/PoliticalEntityRenderer';

/** Progress callback: (loaded, total, currentModelName) */
type ModelLoadProgress = (loaded: number, total: number, name: string) => void;

interface ContentProps {
  onLoadProgress?: ModelLoadProgress;
  onLoadComplete?: () => void;
}

const Content: React.FC<ContentProps> = ({ onLoadProgress, onLoadComplete }) => {
  const snap = useGameSnapshot();

  // Track drei loading progress (useGLTF.preload triggers this)
  const { loaded, total, item } = useProgress();
  const completedRef = useRef(false);

  useEffect(() => {
    if (total > 0) {
      // Map drei progress to our progress callback
      // Use TOTAL_MODEL_COUNT as a stable "total" since drei's total can fluctuate
      const displayTotal = Math.max(total, TOTAL_MODEL_COUNT);
      const modelName = item ? item.split('/').pop()?.replace('.glb', '') ?? '' : '';
      onLoadProgress?.(loaded, displayTotal, modelName);
    }

    if (total > 0 && loaded === total && !completedRef.current) {
      completedRef.current = true;
      // Notify forces re-render through useSyncExternalStore,
      // so BuildingRenderer retries cloning now that models are ready
      gameState.notify();
      notifyStateChange();
      onLoadComplete?.();
    }
  }, [loaded, total, item]);

  // Initialize audio on mount (no scene param needed for R3F — uses Web Audio API)
  useEffect(() => {
    const audio = AudioManager.getInstance();
    audio.init();

    return () => {
      audio.dispose();
    };
  }, []);

  // Derive building states from ECS (archive merge)
  // The ECS building defIds match GLB model names directly
  const buildings = getBuildingStates();

  // Cache the terrain grid — it only needs to rebuild when season changes
  // or when buildings are placed/demolished (path recalculation changes tiles).
  // Without this, getGridCells() returns a new array every render, causing
  // TerrainGrid to dispose and rebuild all meshes on every tick.
  const terrainVersion = useTerrainVersion();
  const lastSeasonRef = useRef(snap.season);
  const lastTerrainVersionRef = useRef(terrainVersion);
  const [ecsGrid, setEcsGrid] = useState(() => getGridCells());

  useEffect(() => {
    if (lastSeasonRef.current !== snap.season || lastTerrainVersionRef.current !== terrainVersion) {
      lastSeasonRef.current = snap.season;
      lastTerrainVersionRef.current = terrainVersion;
      setEcsGrid(getGridCells());
    }
  }, [snap.season, terrainVersion]);

  // Core scene + VFX layers + Interaction
  return (<>
    <CameraController />
    <Environment season={snap.season} />
    <Lighting
      timeOfDay={snap.timeOfDay}
      season={snap.season}
      isStorm={snap.weatherLabel === 'STORM'}
    />
    <TerrainGrid grid={ecsGrid} season={snap.season} />
    <BuildingRenderer buildings={buildings} settlementTier={snap.settlementTier as SettlementTier} />
    <SceneProps season={snap.season} />

    <WeatherFX />
    <SmogOverlay />
    <FireRenderer />
    <AuraRenderer />
    <HeatingOverlay />
    <LightningRenderer />
    <TrainRenderer />
    <VehicleRenderer />
    <ZeppelinRenderer />
    <MeteorRenderer />
    <FloatingText />
    <PoliticalEntityRenderer />
    <GhostPreview />
    <LensSystem />
  </>);
};

export default Content;
