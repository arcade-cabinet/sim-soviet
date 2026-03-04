# Copilot Instructions — SimSoviet 1917

## Project Identity

Soviet bureaucrat survival sim (NOT a city builder). The player is the predsedatel — the settlement grows organically via autonomous agents. The player does NOT freely place buildings. Moscow mandates what to build; the player only chooses WHERE.

React Three Fiber (R3F v9.5) + Three.js r183 + React Native 0.81 + Expo 54. TypeScript 5.7 strict mode.

## Key Architecture

- **Two-layer rendering**: R3F `<Canvas>` (3D) + React Native overlays (UI)
- **State**: Miniplex ECS world + legacy GameState singleton, bridged via `useSyncExternalStore`
- **Screen flow**: `App.web.tsx` manages `'menu' | 'setup' | 'game'` state

## Code Style

- `StyleSheet.create` for all styling (no Tailwind)
- Soviet colors: red `#c62828`, gold `#fbc02d`, green `#00e676`, dark `#2a2e33`
- Monospace font: Menlo (iOS) / monospace (Android)
- JSDoc with `@param name - description` convention
- Import from `'three'` only (never `'three/webgpu'`)

## Essential Gotchas

- Edit `App.web.tsx` for web changes (Metro resolves `.web.tsx` before `.tsx`)
- Use `shadows="percentage"` on Canvas (PCFSoftShadowMap deprecated in r183)
- Use `assetUrl()` from `src/utils/assetPath.ts` for production asset paths
- UI overlays use `pointerEvents="box-none"` to pass touches to 3D canvas

## Full Context

See `AGENTS.md` for documentation index and `memory-bank/AGENTS.md` for project context.
