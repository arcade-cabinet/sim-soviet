import { Platform } from 'react-native';

const monoFallback = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const BrandColors = {
  black: '#0b0b09',
  coal: '#15130f',
  iron: '#2d3434',
  oxide: '#86221e',
  red: '#b32620',
  redDark: '#611816',
  amber: '#d6a532',
  brass: '#9b6b26',
  paper: '#efe4c8',
  paperMuted: '#c7bda6',
  frost: '#9fb5b5',
  green: '#4d6257',
  white: '#fff7e7',
} as const;

export const BrandFonts = {
  display: Platform.OS === 'web' ? 'Oswald, Impact, sans-serif' : monoFallback,
  mono: Platform.OS === 'web' ? '"IBM Plex Mono", monospace' : monoFallback,
} as const;

export const DesignTokens = {
  radius: {
    sm: 4,
    md: 6,
  },
  space: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 36,
  },
  border: {
    hairline: 'rgba(239, 228, 200, 0.16)',
    strong: 'rgba(239, 228, 200, 0.34)',
  },
} as const;

const fontFaces = `
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/sim-soviet/assets/fonts/ibm-plex-mono-latin-400.woff2') format('woff2'),
       url('/assets/fonts/ibm-plex-mono-latin-400.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/sim-soviet/assets/fonts/ibm-plex-mono-latin-500.woff2') format('woff2'),
       url('/assets/fonts/ibm-plex-mono-latin-500.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/sim-soviet/assets/fonts/ibm-plex-mono-latin-600.woff2') format('woff2'),
       url('/assets/fonts/ibm-plex-mono-latin-600.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/sim-soviet/assets/fonts/ibm-plex-mono-latin-700.woff2') format('woff2'),
       url('/assets/fonts/ibm-plex-mono-latin-700.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Oswald';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/sim-soviet/assets/fonts/oswald-latin-variable.woff2') format('woff2'),
       url('/assets/fonts/oswald-latin-variable.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`;

export function ensureBrandFonts(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const id = 'sim-soviet-brand-fonts';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = fontFaces;
  document.head.appendChild(style);
}
