/**
 * App.tsx — Root component for SimSoviet 1917.
 *
 * After the R3F migration, the same Canvas-based implementation
 * is used for both web and native. This file re-exports App.web.tsx
 * for the native entry point (index.js).
 *
 * On web, Expo/Metro resolves App.web.tsx directly via platform extension.
 */

export { default } from './App.web';
