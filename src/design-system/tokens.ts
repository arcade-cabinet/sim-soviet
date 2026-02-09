/**
 * Design Tokens - SimSoviet 2000
 * Soviet-inspired color palette and design system
 */

export const colors = {
  // Brand Colors
  sovietRed: '#8a1c1c',
  sovietRedLight: '#a02020',
  sovietRedDark: '#6b1515',
  sovietGold: '#cfaa48',
  sovietGoldLight: '#e0c36a',
  sovietGoldDark: '#b89532',

  // Neutrals
  concrete: '#757575',
  concreteLight: '#9e9e9e',
  concreteDark: '#616161',
  slate: '#2e2e2e',
  slateDark: '#1a1818',
  slateLight: '#3a3a3a',

  // UI Colors
  background: '#1a1818',
  panelBg: '#2d2a2a',
  panelBorder: '#000000',
  textPrimary: '#dcdcdc',
  textSecondary: '#999999',
  textDisabled: '#666666',

  // Semantic Colors
  success: '#33691e',
  warning: '#f57c00',
  error: '#b71c1c',
  info: '#1976d2',

  // Game Colors
  grass: '#2e2e2e',
  road: '#444444',
  foundation: '#333333',
  highlight: 'rgba(255, 255, 255, 0.3)',
  terminalGreen: '#33ff00',
} as const;

export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  xxl: '3rem', // 48px
} as const;

export const typography = {
  fontFamily: {
    retro: "'VT323', monospace",
    mono: "'Courier New', 'Courier Prime', monospace",
    system: 'system-ui, -apple-system, sans-serif',
  },
  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.125rem', // 2px
  md: '0.25rem', // 4px
  lg: '0.5rem', // 8px
  full: '9999px',
} as const;

export const shadows = {
  sm: '2px 2px 0 #000',
  md: '4px 4px 0 #000',
  lg: '10px 10px 0 #000',
  xl: '20px 20px 0 #000',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.5)',
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 10,
  tooltip: 50,
  toolbar: 50,
  modal: 100,
  toast: 200,
  scanlines: 998,
  crtOverlay: 999,
  introModal: 2000,
} as const;

export const transitions = {
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  verySlow: '500ms',
} as const;

// CSS Custom Properties Generator
export function getCSSVariables(): Record<string, string> {
  return {
    '--soviet-red': colors.sovietRed,
    '--soviet-gold': colors.sovietGold,
    '--concrete': colors.concrete,
    '--bg-color': colors.background,
    '--panel-bg': colors.panelBg,
    '--text-primary': colors.textPrimary,
    '--term-green': colors.terminalGreen,
  };
}

export const designTokens = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  breakpoints,
  zIndex,
  transitions,
  getCSSVariables,
} as const;
