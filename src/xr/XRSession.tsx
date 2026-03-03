/**
 * XRSession -- manages WebXR session lifecycle.
 * Wraps children in @react-three/xr's XR provider.
 *
 * Creates a shared XR store with hand + controller enabled.
 * Detects session end via store state subscription and notifies parent.
 * Wrapped in an error boundary for graceful XR init failure handling.
 */

import { createXRStore, XR } from '@react-three/xr';
import React, { Component, type ReactNode, useEffect, useRef } from 'react';

/** Shared XR store instance for managing WebXR session state. */
export const xrStore = createXRStore({
  hand: true,
  controller: true,
});

interface XRSessionProps {
  children: ReactNode;
  onSessionEnd?: () => void;
}

/**
 * Inner component that subscribes to XR store state to detect session end.
 * Separated so the useEffect can fire inside the XR provider context.
 */
function XRSessionInner({ children, onSessionEnd }: XRSessionProps) {
  const sessionActiveRef = useRef(false);

  useEffect(() => {
    if (!onSessionEnd) return;

    const unsubscribe = xrStore.subscribe((state) => {
      const isActive = state.session != null;

      if (sessionActiveRef.current && !isActive) {
        // Session just ended
        onSessionEnd();
      }
      sessionActiveRef.current = isActive;
    });

    return unsubscribe;
  }, [onSessionEnd]);

  return <>{children}</>;
}

/**
 * Error boundary for XR initialization failures.
 * Catches WebXR errors and renders a fallback message inside the 3D scene.
 */
class XRErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'XR initialization failed' };
  }

  render() {
    if (this.state.hasError) {
      // Return null in the 3D scene -- the parent UI layer handles messaging
      return null;
    }
    return this.props.children;
  }
}

/**
 * XRSession -- wraps scene content in an XR provider with error boundary.
 *
 * @param props.children - Scene content to render inside XR context
 * @param props.onSessionEnd - Called when the WebXR session ends
 */
const XRSession: React.FC<XRSessionProps> = ({ children, onSessionEnd }) => {
  return (
    <XRErrorBoundary>
      <XR store={xrStore}>
        <XRSessionInner onSessionEnd={onSessionEnd}>{children}</XRSessionInner>
      </XR>
    </XRErrorBoundary>
  );
};

export default XRSession;
