# Tech Context — SimSoviet 2000

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | >= 22.0.0 |
| Package Manager | pnpm | >= 10.0.0 |
| Language | TypeScript | 5.9 |
| Build | Vite | 7.3 |
| 3D Engine | BabylonJS | 8.50 |
| React Bridge | Reactylon | 3.5 |
| UI Framework | React | 19.2 |
| CSS | Tailwind CSS | 4.1 |
| ECS | Miniplex | 2.0 |
| Audio | Tone.js | 15.1 |
| AI (stubbed) | Yuka | 0.7 |
| Seeded RNG | seedrandom | 3.0.5 |
| Lint/Format | Biome | 2.3 |
| Unit Tests | Vitest | 4.0 (happy-dom) |
| E2E Tests | Playwright | 1.58 |
| Mobile | Capacitor | 8.0 |

## Development Setup

```bash
pnpm install                # Install all dependencies
pnpm download:audio         # Fetch Soviet-era music (OGG/Opus) from marxists.org
pnpm dev                    # Start dev server → http://localhost:3000
```

## Build & Quality

```bash
pnpm build                  # tsc --noEmit && vite build → dist/
pnpm typecheck              # TypeScript check only
pnpm lint                   # Biome check
pnpm lint:fix               # Biome auto-fix
pnpm format                 # Biome format
pnpm test                   # Vitest single run
pnpm test:watch             # Vitest watch mode
pnpm test:e2e               # Playwright (all devices)
pnpm test:e2e:mobile        # Playwright (mobile only)
```

Single test: `pnpm vitest run src/__tests__/SimulationEngine.test.ts`

## Path Aliases

| Alias | Resolves To |
|-------|-------------|
| `@/*` | `src/*` |
| `@app/*` | `app/*` |

Configured in: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`

## Vite Quirks

- **Root is `./app`**, not project root. The `index.html` entry lives in `app/`.
- **Build outputs to `../dist`** (relative to root).
- **XR stub**: Reactylon v3.5 imports `@babylonjs/core/XR/motionController/webXROculusHandController.js` which doesn't exist in BabylonJS 8. A stub alias in `vite.config.ts` resolves this to `src/stubs/empty.ts`.

## TypeScript Configuration

- Target: ES2020
- Strict mode: ON
- `noUncheckedIndexedAccess`: ON (forces `| undefined` on indexed types)
- `noUnusedLocals` / `noUnusedParameters`: ON
- JSX: `react-jsx`
- Module: ESNext with bundler resolution

## Biome Configuration

- 2-space indentation
- Single quotes
- Semicolons always
- Trailing commas: ES5 style
- Line width: 100 characters
- `noNonNullAssertion`: OFF (allowed in this codebase)
- `noExplicitAny`: warn
- `noUnusedVariables` / `noUnusedImports`: warn
- VCS-aware (respects .gitignore)

## Testing Environment

### Unit Tests (Vitest)
- Environment: happy-dom
- `restoreMocks: true` (auto-restore after each test)
- Tests in `src/__tests__/` matching `*.test.ts` or `*.spec.ts`
- Coverage: V8 provider, reports text + html + lcov

### E2E Tests (Playwright)
- Test directory: `e2e/`
- Base URL: `http://localhost:3000`
- Devices: Desktop Chrome (1280x720), iPhone SE, Pixel 8a, iPad
- Visual regression: `maxDiffPixelRatio: 0.05`
- Auto-starts dev server via `pnpm dev`

## CI/CD

### CI (GitHub Actions)
Triggers on push/PR to `main`. Pipeline: lint → typecheck → test → build.

### Deploy
Merges to `main` auto-deploy to GitHub Pages. Vite builds with `--base /<repo-name>/` for correct asset paths.

## Key Dependencies & Their Roles

- **Reactylon**: React reconciler for BabylonJS — provides `<Engine>`, `<Scene>`, `useScene()`, `useCanvas()`
- **Miniplex / miniplex-react**: ECS world with React bindings (`ECS.Entity`, `ECS.Entities`)
- **Tone.js**: Web Audio synthesizer for procedural SFX (build, destroy, notification sounds)
- **Yuka**: Behavioral AI library (imported but not yet deeply integrated)
- **seedrandom**: Deterministic PRNG for reproducible game worlds (wrapped by `GameRng` in `SeedSystem.ts`)
- **animejs**: Animation library (in dependencies, usage is minimal)

## Constraints

- Audio files are `.ogg` (Opus codec) — downloaded via `scripts/download-audio.sh`, not committed to git (tracked via `.gitattributes` with LFS or downloaded on setup)
- Browser autoplay policy requires user gesture before audio playback
- BabylonJS scene.pick() needs canvas-relative coordinates (offsetX/Y, not clientX/Y)
- Capacitor requires `dist/` output to sync to native platforms
