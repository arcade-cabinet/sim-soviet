/**
 * Hook returning responsive layout info.
 */
import { useWindowDimensions } from 'react-native';
import { COMPACT_BREAKPOINT } from './responsive';

export interface ResponsiveInfo {
  isCompact: boolean;
  width: number;
  height: number;
  scale: number;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const scale = isCompact ? width / COMPACT_BREAKPOINT : 1;
  return { isCompact, width, height, scale };
}
