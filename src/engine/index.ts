/**
 * Engine barrel — re-exports all game logic modules.
 */

// Grid constants and types
export {
  TILE_WIDTH,
  TILE_HEIGHT,
  GRID_SIZE,
  TICKS_PER_MONTH,
  type TerrainType,
  type GridCell,
  type GridPoint,
} from './GridTypes';

// Building definitions
export {
  BUILDING_TYPES,
  GROWN_TYPES,
  TICKER_MESSAGES,
  getBuildingHeight,
  type BuildingTypeInfo,
  type GrownLevel,
} from './BuildingTypes';

// Game state and interfaces
export {
  GameState,
  gameState,
  type GameDate,
  type BuildingInstance,
  type Vehicle,
  type Zeppelin,
  type FloatingTextItem,
  type Train,
  type Meteor,
  type Quota,
  type WeatherType,
  type LensType,
  type TabType,
  type Lightning,
  type Launch,
} from './GameState';

// Weather
export { getSeason, getSeasonColor, updateWeatherSystem } from './WeatherSystem';

// Water network
export { updateWaterNetwork } from './WaterNetwork';

// Directives
export {
  DIRECTIVES,
  countBuildingsByRole,
  countBuildingsByDefId,
  countGridCellType,
  type Directive,
} from './Directives';

// Train
export { updateTrain } from './TrainSystem';

// Traffic
export { updateTraffic } from './TrafficSystem';

// Meteor
export { updateMeteor } from './MeteorSystem';

// Build actions
export { handleClick } from './BuildActions';

// Simulation tick
export { simTick } from './SimTick';

// Helpers
export {
  addFloatingText,
  getRandomTickerMsg,
  pushTickerMsg,
  setSpeed,
  setLens,
  setTab,
  selectTool,
  showToast,
  getToast,
  clearToast,
  showAdvisor,
  getAdvisor,
  dismissAdvisor,
  type ToastMessage,
  type AdvisorMessage,
} from './helpers';
