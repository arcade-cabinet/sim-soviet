/**
 * Responsive utilities for compact (mobile) vs. standard (desktop) layouts.
 */

export const COMPACT_BREAKPOINT = 600;
export const MIN_TAP_TARGET = 44;
export const MIN_FONT_SIZE = 12;

/** Scale a pixel value relative to viewport width. */
export function scaled(base: number, width: number): number {
  if (width >= COMPACT_BREAKPOINT) return base;
  return Math.max(Math.round(base * (width / COMPACT_BREAKPOINT)), Math.round(base * 0.6));
}

/** Scale a font size, clamping to MIN_FONT_SIZE. */
export function scaledFont(base: number, width: number): number {
  const s = scaled(base, width);
  return Math.max(s, MIN_FONT_SIZE);
}

/** Scale a touch target size, clamping to MIN_TAP_TARGET. */
export function scaledTap(base: number, width: number): number {
  const s = scaled(base, width);
  return Math.max(s, MIN_TAP_TARGET);
}
