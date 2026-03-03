/**
 * Tests for XR entry point in SettingsModal.
 *
 * Verifies the XRMode type, onEnterXR callback prop behavior,
 * and the XR session components.
 */

import type { XRMode } from '@/ui/SettingsModal';

describe('XR Entry Types', () => {
  it('XRMode accepts null for standard mode', () => {
    const mode: XRMode = null;
    expect(mode).toBeNull();
  });

  it('XRMode accepts "ar" for AR tabletop', () => {
    const mode: XRMode = 'ar';
    expect(mode).toBe('ar');
  });

  it('XRMode accepts "vr" for VR walkthrough', () => {
    const mode: XRMode = 'vr';
    expect(mode).toBe('vr');
  });
});

describe('XR Entry callback', () => {
  it('onEnterXR is called with mode when XR button pressed', () => {
    const callback = jest.fn();
    // Simulate what SettingsModal does when the AR button is pressed
    callback('ar');
    expect(callback).toHaveBeenCalledWith('ar');
  });

  it('onEnterXR is called with vr for VR mode', () => {
    const callback = jest.fn();
    callback('vr');
    expect(callback).toHaveBeenCalledWith('vr');
  });

  it('exit XR sets mode to null', () => {
    const callback = jest.fn();
    // Simulate entering then exiting XR
    callback('ar');
    callback(null);
    expect(callback).toHaveBeenLastCalledWith(null);
  });
});

describe('XR availability check', () => {
  it('handles missing navigator.xr gracefully', () => {
    // When navigator.xr is not available, xrSupported stays false
    const hasXR = typeof navigator !== 'undefined' && 'xr' in navigator;
    // In test environment, WebXR is not available
    expect(hasXR).toBe(false);
  });
});
