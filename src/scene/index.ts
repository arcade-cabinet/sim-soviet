/**
 * Scene module barrel export.
 */
export { preloadModels, cloneModel, disposeModel, hasModel, disposeAll } from './ModelCache';
export { getModelName, BUILDING_TYPES } from './ModelMapping';
export { default as TerrainGrid } from './TerrainGrid';
export type { Season } from './TerrainGrid';
export { default as CameraController } from './CameraController';
export { default as Lighting } from './Lighting';
export { default as BuildingRenderer } from './BuildingRenderer';
export type { BuildingState } from './BuildingRenderer';

// VFX components
export { default as WeatherFX } from './WeatherFX';
export { default as SmogOverlay } from './SmogOverlay';
export { default as FireRenderer } from './FireRenderer';
export { default as AuraRenderer } from './AuraRenderer';
export { default as LightningRenderer } from './LightningRenderer';
export { default as TrainRenderer } from './TrainRenderer';
export { default as VehicleRenderer } from './VehicleRenderer';
export { default as ZeppelinRenderer } from './ZeppelinRenderer';
export { default as MeteorRenderer } from './MeteorRenderer';
export { default as GhostPreview } from './GhostPreview';
export { default as LensSystem } from './LensSystem';
export { default as FloatingText } from './FloatingText';
