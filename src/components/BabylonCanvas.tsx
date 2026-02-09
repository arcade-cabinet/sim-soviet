/**
 * Re-exports Reactylon's Engine + Scene with our game defaults.
 * Provides the BabylonJS canvas with adaptToDeviceRatio enabled.
 */
export { Engine } from 'reactylon/web';
export { Scene, useScene, useEngine, useCanvas } from 'reactylon';
// Import type declarations so JSX intrinsic elements (arcRotateCamera, etc.) are available
import 'reactylon';
