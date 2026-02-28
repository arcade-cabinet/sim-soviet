/**
 * Engine barrel — re-exports all game logic modules.
 */

// Build actions
export { handleClick } from './BuildActions';

// Building definitions
export {
  BUILDING_TYPES,
  type BuildingTypeInfo,
  GROWN_TYPES,
  type GrownLevel,
  getBuildingHeight,
  TICKER_MESSAGES,
} from './BuildingTypes';
// Directives
export {
  countBuildingsByDefId,
  countBuildingsByRole,
  countGridCellType,
  DIRECTIVES,
  type Directive,
} from './Directives';
// Game state and interfaces
export {
  type BuildingInstance,
  type FloatingTextItem,
  type GameDate,
  GameState,
  gameState,
  type Launch,
  type LensType,
  type Lightning,
  type Meteor,
  type Quota,
  type TabType,
  type Train,
  type Vehicle,
  type WeatherType,
  type Zeppelin,
} from './GameState';
// Grid constants and types
export {
  GRID_SIZE,
  type GridCell,
  type GridPoint,
  type TerrainType,
  TICKS_PER_MONTH,
  TILE_HEIGHT,
  TILE_WIDTH,
} from './GridTypes';
// Helpers
export {
  type AdvisorMessage,
  addFloatingText,
  clearToast,
  dismissAdvisor,
  getAdvisor,
  getRandomTickerMsg,
  getToast,
  pushTickerMsg,
  selectTool,
  setLens,
  setSpeed,
  setTab,
  showAdvisor,
  showToast,
  type ToastMessage,
} from './helpers';
// Meteor
export { updateMeteor } from './MeteorSystem';
// Simulation tick
export { simTick } from './SimTick';
// Traffic
export { updateTraffic } from './TrafficSystem';
// Train
export { updateTrain } from './TrainSystem';
// Water network
export { updateWaterNetwork } from './WaterNetwork';
// Weather
export { getSeason, getSeasonColor, updateWeatherSystem } from './WeatherSystem';
