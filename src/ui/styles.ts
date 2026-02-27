/**
 * Shared style constants and reusable StyleSheet for the SimSoviet 1917 UI.
 * Matches the SimCity 3000 retro-panel aesthetic from archive/poc.html.
 */

import { Platform, StyleSheet } from 'react-native';

// --- Color palette ---

export const Colors = {
  bgColor: '#121010',
  panelBg: '#2a2e33',
  panelHighlight: '#5b6570',
  panelShadow: '#15171a',

  sovietRed: '#c62828',
  sovietDarkRed: '#8e0000',
  sovietGold: '#fbc02d',

  termGreen: '#00e676',
  termBlue: '#40c4ff',

  textPrimary: '#eceff1',
  textSecondary: '#90a4ae',
  textMuted: '#888888',

  btnBg: '#37474f',
  btnHighlight: '#546e7a',
  btnShadow: '#1c272c',

  timeBtnBg: '#263238',
  timeBtnHighlight: '#455a64',
  timeBtnShadow: '#111111',

  tabBg: '#111111',
  tabBorder: '#333333',

  black: '#000000',
  white: '#ffffff',
} as const;

// --- Monospace font family ---

export const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

// --- Reusable shared styles ---

export const SharedStyles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.panelBg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.panelHighlight,
    borderLeftColor: Colors.panelHighlight,
    borderBottomColor: Colors.panelShadow,
    borderRightColor: Colors.panelShadow,
  },

  btnRetro: {
    backgroundColor: Colors.btnBg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.btnHighlight,
    borderLeftColor: Colors.btnHighlight,
    borderBottomColor: Colors.btnShadow,
    borderRightColor: Colors.btnShadow,
  },

  btnRetroActive: {
    backgroundColor: Colors.sovietDarkRed,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.btnShadow,
    borderLeftColor: Colors.btnShadow,
    borderBottomColor: Colors.btnHighlight,
    borderRightColor: Colors.btnHighlight,
  },

  timeBtn: {
    backgroundColor: Colors.timeBtnBg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.timeBtnHighlight,
    borderLeftColor: Colors.timeBtnHighlight,
    borderBottomColor: Colors.timeBtnShadow,
    borderRightColor: Colors.timeBtnShadow,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },

  timeBtnActive: {
    backgroundColor: Colors.sovietRed,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: '#ff5252',
    borderLeftColor: '#ff5252',
    borderBottomColor: Colors.sovietDarkRed,
    borderRightColor: Colors.sovietDarkRed,
  },

  mono: {
    fontFamily: monoFont,
  },

  trackingWidest: {
    letterSpacing: 2,
  },
});
