/**
 * SimSoviet 2000 -- Design Tokens
 *
 * Dual-theme system derived from approved prototypes:
 *
 *   CONCRETE (dark) — in-game: HUD, toolbar, drawer, toasts
 *     Surface:  #1a1a1a → #2a2a2a → #3a3535
 *     Accent:   red #8b0000 + gold #cfaa48
 *     Font:     VT323 monospace
 *
 *   PARCHMENT (light) — documents: modals, reports, decrees
 *     Surface:  #f4e8d0 → #e8dcc0 → #d4c4a0
 *     Accent:   brown #8b4513 + red-600
 *     Font:     Courier New monospace
 *
 * Same accent colors (red, gold/brown) — inverted surfaces.
 * Buttons, stamps, severity badges, resource pills all work in both modes.
 *
 * Usage:
 *   import { concrete, parchment, accent, SOVIET_FONT } from '@/design/tokens';
 */

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

/** VT323 monospace -- primary game font for all HUD / overlay text. */
export const SOVIET_FONT = "'VT323', monospace" as const;

/** Courier New monospace -- bureaucratic forms, reports, fine print. */
export const DOCUMENT_FONT = "'Courier New', monospace" as const;

// ---------------------------------------------------------------------------
// Theme: Concrete (dark — in-game)
// ---------------------------------------------------------------------------

export const concrete = {
  surface: {
    deep: '#1a1a1a',
    panel: '#2a2a2a',
    card: '#2d2a2a',
    hover: '#3a3535',
  },
  border: {
    primary: '#8b0000',
    subtle: '#444444',
    hover: '#666666',
  },
  text: {
    primary: '#ffffff',
    secondary: '#cccccc',
    muted: '#888888',
    dim: '#666666',
    faint: '#555555',
  },
} as const;

// ---------------------------------------------------------------------------
// Theme: Parchment (light — documents)
// ---------------------------------------------------------------------------

export const parchment = {
  surface: {
    paper: '#f4e8d0',
    alt: '#e8dcc0',
    header: '#d4c4a0',
  },
  border: {
    primary: '#8b4513',
  },
  text: {
    primary: '#654321',
    stamp: 'rgb(220 38 38)',
  },
} as const;

// ---------------------------------------------------------------------------
// Shared accents (work on both surfaces)
// ---------------------------------------------------------------------------

export const accent = {
  red: '#8b0000',
  redHover: '#a00000',
  redBright: '#8a1c1c',
  redText: '#ff4444',
  gold: '#cfaa48',
} as const;

// ---------------------------------------------------------------------------
// Severity (notifications / toasts — Tailwind classes)
// ---------------------------------------------------------------------------

export const severity = {
  warning: {
    banner: 'bg-yellow-600',
    bg: 'bg-amber-50',
    text: 'text-yellow-800',
    border: 'border-yellow-700',
  },
  critical: {
    banner: 'bg-red-700',
    bg: 'bg-red-50',
    text: 'text-red-900',
    border: 'border-red-800',
  },
  evacuation: {
    banner: 'bg-red-900',
    bg: 'bg-zinc-100',
    text: 'text-red-950',
    border: 'border-red-950',
  },
} as const;

// ---------------------------------------------------------------------------
// Status indicators
// ---------------------------------------------------------------------------

export const status = {
  positive: '#22c55e',
  negative: '#ff4444',
  neutral: '#888888',
} as const;

// Legacy alias — backwards compat if anything imported `color`
export const color = {
  bg: concrete.surface,
  border: concrete.border,
  text: { ...concrete.text, gold: accent.gold, red: accent.redText },
  accent,
  parchment: parchment.surface,
  severity,
  status,
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  font: {
    soviet: SOVIET_FONT,
    document: DOCUMENT_FONT,
  },

  size: {
    faintest: 'text-[9px]',
    label: 'text-[10px]',
    body: 'text-xs',
    secondary: 'text-sm',
    primary: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
  },
} as const;

// ---------------------------------------------------------------------------
// Component-level tokens
// ---------------------------------------------------------------------------

/** Dark panel (top bar, bottom bar, drawer). */
export const panel = {
  bg: concrete.surface.panel,
  borderColor: accent.red,
  borderWidth: '2px',
  shadow: '0 4px 12px rgba(0,0,0,0.6)',
} as const;

/** Buttons — concrete (dark) variant. */
export const button = {
  concrete: {
    bg: concrete.surface.deep,
    border: concrete.border.subtle,
    hoverBorder: concrete.border.hover,
    activeBg: accent.red,
    activeBorder: accent.redText,
    minHeight: '44px',
  },
  /** Buttons — parchment (light / embossed) variant. */
  parchment: {
    shadow: '4px 4px 0px 0px rgba(0,0,0,0.3)',
    hoverShadow: '2px 2px 0px 0px rgba(0,0,0,0.3)',
    hoverTranslate: '2px',
  },
} as const;

/** Resource pill (emoji + mono value in top bar). */
export const resourcePill = {
  bg: concrete.surface.deep,
  border: concrete.border.subtle,
} as const;

/** Drawer section header (icon + gold title). */
export const drawerSection = {
  iconSize: 'w-3.5 h-3.5',
  iconColor: accent.red,
  titleColor: accent.gold,
  titleTracking: 'tracking-widest',
  titleCase: 'uppercase',
} as const;

/** Soviet approval stamp (rotated red badge). */
export const stamp = {
  rotation: '-12deg',
  bg: parchment.text.stamp,
  text: concrete.text.primary,
  borderRadius: 'rounded-full',
} as const;
