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

import { useProgress } from '@react-three/drei';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type { SettlementTier } from './ai/agents/infrastructure/SettlementSystem';
import AudioManager from './audio/AudioManager';
import { getBuildingStates } from './bridge/ECSBridge';
import { gameState } from './engine/GameState';
import { getCurrentGridSize } from './engine/GridTypes';
import { useGameSnapshot } from './hooks/useGameState';
import { notifyStateChange, useActiveSettlement, useClimateMilestones, useSpaceVisualState } from './stores/gameStore';
import type { CelestialBodyType } from './scene/celestial';
import { getLoadZone } from './scene/loadZones';

// Import ModelPreloader for its side-effect (calls useGLTF.preload)
import './scene/ModelPreloader';
import AlienFaunaRenderer from './scene/AlienFaunaRenderer';
import ArcologyDomes from './scene/ArcologyDomes';
import AuraRenderer from './scene/AuraRenderer';
import CrisisVFXRenderer from './scene/CrisisVFXRenderer';
import CollapseOverlay from './scene/CollapseOverlay';
import BuildingRenderer from './scene/BuildingRenderer';
import BuildingStatusBadges from './scene/BuildingStatusBadges';
import CameraController from './scene/CameraController';
import { CelestialViewport } from './scene/celestial';
import CitizenRenderer from './scene/CitizenRenderer';
import Environment from './scene/Environment';
import FireRenderer from './scene/FireRenderer';
import FloatingText from './scene/FloatingText';
import GhostPreview from './scene/GhostPreview';
import HeatingOverlay from './scene/HeatingOverlay';
import LensSystem from './scene/LensSystem';
import Lighting from './scene/Lighting';
import LightningRenderer from './scene/LightningRenderer';
import MassGraveRenderer from './scene/MassGraveRenderer';
import MeteorRenderer from './scene/MeteorRenderer';
import { TOTAL_MODEL_COUNT } from './scene/ModelPreloader';
import PoliticalEntityRenderer from './scene/PoliticalEntityRenderer';
import PostProcessing from './scene/PostProcessing';
import SceneProps from './scene/SceneProps';
import SkyProgression from './scene/SkyProgression';
import PermafrostOverlay from './scene/PermafrostOverlay';
import SmogOverlay from './scene/SmogOverlay';
import TrainRenderer from './scene/TrainRenderer';
import VehicleRenderer from './scene/VehicleRenderer';
import WeatherFX from './scene/WeatherFX';
import WarOverlay from './scene/WarOverlay';
import ZeppelinRenderer from './scene/ZeppelinRenderer';

/** Progress callback: (loaded, total, currentModelName) */
type ModelLoadProgress = (loaded: number, total: number, name: string) => void;

interface ContentProps {
  onLoadProgress?: ModelLoadProgress;
  onLoadComplete?: () => void;
  /** When true, disables the orbit camera controller (XR provides its own camera). */
  disableCamera?: boolean;
}

/** Map celestialBody string (from settlement data) to CelestialBodyType (shader enum). */
function toCelestialBodyType(body: string): CelestialBodyType {
  switch (body) {
    case 'mars': return 'martian';
    case 'orbital':
    case 'dyson': return 'sun';
    default: return 'terran'; // earth, moon, titan, exoplanet, venus
  }
}

const Content: React.FC<ContentProps> = ({ onLoadProgress, onLoadComplete, disableCamera }) => {
  const snap = useGameSnapshot();
  const spaceVisual = useSpaceVisualState();
  const climateMilestones = useClimateMilestones();
  const activeSettlement = useActiveSettlement();
  const hasPermafrost = climateMilestones.has('permafrost_collapse') || climateMilestones.has('ecological_permafrost_collapse');
  const isWartime = snap.currentEra === 'great_patriotic';

  // Derive zone-specific visual props from active settlement + era
  const zoneProps = useMemo(() => {
    const active = activeSettlement.settlements.find(s => s.isActive);
    const body = active?.celestialBody ?? 'earth';
    const zone = getLoadZone(body, snap.currentEra);
    return {
      bodyType: toCelestialBodyType(body),
      // Only override HDRI when not the default Earth winter HDRI
      loadZoneHdri: zone.hdri !== 'snowy_field_1k.hdr' ? zone.hdri : undefined,
      loadZoneShader: zone.shader,
      marsPhase: zone.marsPhase,
      shellVisible: body === 'dyson' || body === 'orbital',
    };
  }, [activeSettlement.activeId, snap.currentEra]);

  // Track drei loading progress (useGLTF.preload triggers this)
  const { loaded, total, item } = useProgress();
  const completedRef = useRef(false);

  useEffect(() => {
    if (total > 0) {
      // Use TOTAL_MODEL_COUNT as the stable display total — drei's total
      // fluctuates as Poly Haven GLBs and prop models are discovered.
      // Cap loaded at displayTotal to prevent "401/98" display.
      const displayTotal = TOTAL_MODEL_COUNT;
      const displayLoaded = Math.min(loaded, displayTotal);
      const modelName = item ? (item.split('/').pop()?.replace('.glb', '') ?? '') : '';
      onLoadProgress?.(displayLoaded, displayTotal, modelName);
    }

    if (total > 0 && loaded === total && !completedRef.current) {
      completedRef.current = true;
      // Notify forces re-render through useSyncExternalStore,
      // so BuildingRenderer retries cloning now that models are ready
      gameState.notify();
      notifyStateChange();
      onLoadComplete?.();
    }
  }, [loaded, total, item, onLoadComplete, onLoadProgress]);

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

  // Grid center for positioning the celestial body under the settlement
  const center = getCurrentGridSize() / 2;

  // Body radius must match CelestialBody default (7) so the flat surface
  // sits at Y=0 when the outer group is offset by -bodyRadius on Y.
  const bodyRadius = 7;

  // Core scene + VFX layers + Interaction
  return (
    <>
      <CameraController disabled={disableCamera} />
      <Environment
        season={snap.season}
        era={snap.currentEra as import('./game/era/types').EraId}
        techLevel={spaceVisual.techLevel}
        loadZoneHdri={zoneProps.loadZoneHdri}
        loadZoneShader={zoneProps.loadZoneShader}
        marsPhase={zoneProps.marsPhase}
      />
      <SkyProgression state={spaceVisual} />
      <AlienFaunaRenderer />
      <Lighting timeOfDay={snap.timeOfDay} season={snap.season} isStorm={snap.weatherLabel === 'STORM'} isWartime={isWartime} />
      {/* Celestial body as ground surface — rotated so flat projection aligns
          with the XZ plane and offset so the flat surface sits at Y=0. */}
      <group position={[center, -bodyRadius, center]} rotation={[-Math.PI / 2, 0, 0]}>
        <CelestialViewport
          bodyType={zoneProps.bodyType}
          flattenNear={25}
          flattenFar={50}
          rotateSpeed={0.015}
          shellVisible={zoneProps.shellVisible}
        />
      </group>
      <BuildingRenderer
        buildings={buildings}
        settlementTier={snap.settlementTier as SettlementTier}
        season={snap.season}
        currentEra={snap.currentEra}
        subsidenceTilt={hasPermafrost}
      />
      <BuildingStatusBadges buildings={buildings} />
      <ArcologyDomes />
      <CollapseOverlay />
      <SceneProps season={snap.season} />

      <WeatherFX />
      <SmogOverlay />
      <FireRenderer />
      <AuraRenderer />
      <HeatingOverlay />
      <PermafrostOverlay />
      <LightningRenderer />
      <TrainRenderer />
      <VehicleRenderer />
      <ZeppelinRenderer />
      <MeteorRenderer />
      <CrisisVFXRenderer />
      <WarOverlay active={isWartime} scale="continental" era={snap.currentEra} intensity={1} />
      <MassGraveRenderer />
      <FloatingText />
      <CitizenRenderer />
      <PoliticalEntityRenderer />
      <GhostPreview />
      <LensSystem />
      <PostProcessing />
    </>
  );
};

export default Content;
