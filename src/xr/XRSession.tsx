import { createXRStore, XR } from '@react-three/xr';
import type React from 'react';

export const xrStore = createXRStore();

interface XRSessionProps {
  children: React.ReactNode;
}

/**
 * Wraps scene content in XR context.
 * Critical: Three.js r183 doesn't support WebXR with WebGPU backend.
 * XR sessions must fall back to WebGL2 renderer.
 */
const XRSession: React.FC<XRSessionProps> = ({ children }) => {
  return <XR store={xrStore}>{children}</XR>;
};

export default XRSession;
