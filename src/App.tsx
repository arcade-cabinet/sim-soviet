/**
 * App.tsx — Fallback root component for SimSoviet 1917.
 *
 * Expo/Metro resolves platform-specific files first:
 * - Web:    App.web.tsx  (WebGPU Canvas, service workers, CSS injection)
 * - Native: App.native.tsx (R3F Canvas/native, AppState lifecycle)
 *
 * This file re-exports the native version as the default fallback,
 * which is used by the native entry point (index.js) on iOS/Android.
 */

export { default } from './App.native';
