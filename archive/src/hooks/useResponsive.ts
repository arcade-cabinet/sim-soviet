/**
 * Responsive breakpoint hook.
 *
 * Uses the design system breakpoints from tokens.ts and returns
 * the current device class for conditional rendering.
 */
import { useEffect, useState } from 'react';

export type DeviceClass = 'phone' | 'tablet' | 'desktop';

const BREAKPOINTS = {
  tablet: 768, // iPad SE, Pixel Tablet
  desktop: 1024, // Laptops, desktops
} as const;

function getDeviceClass(): DeviceClass {
  const w = window.innerWidth;
  if (w >= BREAKPOINTS.desktop) return 'desktop';
  if (w >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
}

export function useResponsive(): {
  device: DeviceClass;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
} {
  const [device, setDevice] = useState<DeviceClass>(getDeviceClass);
  const [isTouch] = useState(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0);

  useEffect(() => {
    const handleResize = () => setDevice(getDeviceClass());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    device,
    isPhone: device === 'phone',
    isTablet: device === 'tablet',
    isDesktop: device === 'desktop',
    isTouch,
  };
}
