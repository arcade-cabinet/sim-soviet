/**
 * Content — Scene graph root that composes all 3D components.
 *
 * Placed inside <Scene> by App.tsx. Reads game state via the
 * useGameSnapshot hook and passes derived props to each scene component.
 *
 * After the archive merge, building data comes from the ECS bridge
 * while the old GameState is kept for visual-only systems (weather, time).
 */

import React, { useEffect, useRef, useState } from 'react';
import { useScene } from 'reactylon';
import { useGameSnapshot } from './hooks/useGameState';
import { preloadModels, type ModelLoadProgress } from './scene/ModelCache';
import AudioManager from './audio/AudioManager';
import { gameState } from './engine/GameState';
import { getBuildingStates, getGridCells } from './bridge/ECSBridge';
import { notifyStateChange } from './stores/gameStore';

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
import Environment from './scene/Environment';
import SceneProps from './scene/SceneProps';


interface ContentProps {
  onLoadProgress?: ModelLoadProgress;
  onLoadComplete?: () => void;
}

const Content: React.FC<ContentProps> = ({ onLoadProgress, onLoadComplete }) => {
  const scene = useScene();
  const snap = useGameSnapshot();

  // Preload all GLB models and initialize audio on mount
  useEffect(() => {
    preloadModels(scene, 'assets', onLoadProgress)
      .then(() => {
        // Notify forces re-render through useSyncExternalStore,
        // so BuildingRenderer retries cloning now that models are ready
        gameState.notify();
        notifyStateChange();
        onLoadComplete?.();
      })
      .catch((err) => {
        console.error('[Content] Model preload failed:', err);
        // Still complete loading so the user isn't stuck on the loading screen
        onLoadComplete?.();
      });

    // Initialize audio — starts playlist after user interaction (IntroModal dismiss)
    const audio = AudioManager.getInstance();
    audio.init(scene);

    return () => {
      audio.dispose();
    };
  }, [scene]);

  // Derive building states from ECS (archive merge)
  // The ECS building defIds match GLB model names directly
  const buildings = getBuildingStates();

  // Cache the terrain grid — it only needs to rebuild when season changes
  // (terrain features don't move). Without this, getGridCells() returns a new
  // array every render, causing TerrainGrid to dispose and rebuild all meshes
  // (terrain quads, tree cones, mountain peaks) on every tick.
  const lastSeasonRef = useRef(snap.season);
  const [ecsGrid, setEcsGrid] = useState(() => getGridCells());

  useEffect(() => {
    if (lastSeasonRef.current !== snap.season) {
      lastSeasonRef.current = snap.season;
      setEcsGrid(getGridCells());
    }
  }, [snap.season]);

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
    <BuildingRenderer buildings={buildings} />
    <SceneProps season={snap.season} />

    <WeatherFX />
    <SmogOverlay />
    <FireRenderer />
    <AuraRenderer />
    <LightningRenderer />
    <TrainRenderer />
    <VehicleRenderer />
    <ZeppelinRenderer />
    <MeteorRenderer />
    <FloatingText />
    <GhostPreview />
    <LensSystem />
  </>);
};

export default Content;
