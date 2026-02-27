# SimSoviet 2000

**A satirical isometric city-builder set in the Soviet Union.**

Build a glorious socialist city. Manage resources. Survive purges. Fulfill
the Five-Year Plan. Or don't -- the state persists either way.

> *"We pretend to work, they pretend to pay us. Nobody is pretending. This is real. All of it."*

---

## About

SimSoviet 2000 is a darkly humorous city-building game where you play as a
Soviet city planner navigating the absurdities of central planning. Every
system is designed to produce bureaucratic chaos, resource shortages, and
propaganda-tinged feedback.

The game begins at the founding of the USSR and spans an alternate history
where the Soviet Union never falls. Procedurally generated leaders come and
go -- each with their own personality, doctrine, and capacity for catastrophe.
The only constant is the state itself, which persists through every disaster,
purge, and Five-Year Plan.

### Key Features

- **Isometric city-building** on a 30x30 grid with Canvas 2D rendering
- **Procedural leadership system** -- 11 leader archetypes x 8 era doctrines x ministry appointments = unlimited political chaos
- **Pravda headline generator** -- 145,000+ unique propaganda headlines that spin every disaster into a triumph
- **40+ Soviet-era music tracks** from public domain sources
- **Procedural sound effects** via Tone.js
- **Trilingual dialog** (Russian, Yiddish, accented English) with satirical advisor commentary
- **Alternate history timeline** spanning 1922 to 2100+
- **Mobile-first** -- touch-friendly controls, PWA support, Capacitor for native builds

---

## Getting Started

### Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 10.0.0

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd sim-soviet

# Install dependencies and download audio assets (~100MB)
pnpm setup

# Start the development server
pnpm dev
```

The game runs at **http://localhost:3000**.

> Audio files are ~100MB and hosted externally. The `pnpm setup` command runs
> `pnpm install` followed by `scripts/download-audio.sh` to fetch them.

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Preview the production build |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm test:e2e` | Run end-to-end tests (Playwright) |
| `pnpm test:e2e:mobile` | Run mobile-viewport E2E tests |
| `pnpm lint` | Lint with Biome |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm download:audio` | Re-download audio assets |

### Mobile Builds

```bash
# Android
pnpm cap:android
pnpm android:run

# iOS
pnpm cap:ios
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Rendering** | Canvas 2D -- sprite-based isometric rendering |
| **UI Framework** | [React 19](https://react.dev/) -- DOM overlays on canvas |
| **ECS** | [Miniplex 2](https://github.com/hmans/miniplex) -- entity component system for game entities |
| **AI** | [Yuka 0.7.8](https://mugen87.github.io/yuka/) -- goal-driven AI, state machines, fuzzy logic for leader behavior |
| **Audio** | [Tone.js 15](https://tonejs.github.io/) -- procedural SFX; 40+ OGG tracks for music |
| **Animation** | [anime.js 4](https://animejs.com/) -- smooth UI transitions and easing |
| **State** | [Zustand](https://github.com/pmndrs/zustand) -- React state management for game snapshots |
| **Build** | [Vite 7](https://vitejs.dev/) -- dev server and bundler |
| **Language** | [TypeScript 5.9](https://www.typescriptlang.org/) -- strict mode |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) -- utility-first CSS |
| **Linting** | [Biome 2](https://biomejs.dev/) -- linting and formatting |
| **Testing** | [Vitest 4](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (e2e) |
| **Mobile** | [Capacitor 8](https://capacitorjs.com/) -- PWA + Android/iOS native builds |

---

## Architecture

```text
sim-soviet/
├── app/                          # Vite root
│   ├── App.tsx                   # Root React component
│   ├── main.tsx                  # Entry point
│   ├── index.html                # HTML template
│   ├── style.css                 # Global styles + CRT overlay
│   └── public/audio/music/       # 40+ Soviet-era OGG tracks
├── src/
│   ├── ai/                       # AI systems
│   │   ├── CitizenClasses.ts     # Behavioral profiles for citizen types
│   │   └── NameGenerator.ts      # Procedural Russian name generation (1.1M+ combinations)
│   ├── audio/                    # Audio engine
│   │   ├── AudioManager.ts       # Music playback and crossfading
│   │   ├── AudioManifest.ts      # Track registry
│   │   └── ProceduralSounds.ts   # Tone.js SFX synthesis
│   ├── components/               # React UI components
│   ├── content/                  # Game content modules
│   │   └── WorldBuilding.ts      # Timeline, radio, achievements, city names, flavor text
│   ├── ecs/                      # Entity Component System
│   │   ├── world.ts              # Miniplex world + component definitions
│   │   ├── archetypes.ts         # Pre-built queries (buildings, citizens, tiles)
│   │   └── systems/              # ECS systems (quota, power, production)
│   ├── game/                     # Core game logic
│   │   ├── SimulationEngine.ts   # Main tick loop (1s interval)
│   │   ├── GameState.ts          # Mutable game state
│   │   ├── EventSystem.ts        # Random event generation
│   │   ├── PravdaSystem.ts       # Procedural propaganda headline generator (145K+ combinations)
│   │   └── SaveSystem.ts         # localStorage save/load
│   ├── hooks/                    # React hooks
│   ├── input/                    # Input handling
│   │   └── CanvasGestureManager.ts # Touch/mouse input for building placement
│   ├── rendering/                # Canvas 2D rendering
│   │   ├── Canvas2DRenderer.ts   # Main renderer orchestrator
│   │   └── ParticleSystem2D.ts   # Snow, rain effects
│   ├── stores/                   # Zustand stores
│   │   └── gameStore.ts          # Game state -> React bridge
│   └── design-system/            # Design tokens
│       └── tokens.ts             # Colors, spacing, typography
├── docs/                         # Design documents
├── e2e/                          # Playwright E2E tests
├── scripts/                      # Build & asset scripts
│   ├── download-audio.sh         # Fetch audio from marxists.org
│   └── sovietize_kenney.py       # Asset pipeline for Kenney tiles
└── agentic-memory-bank/          # AI agent context files (Cline protocol)
```

### Design Principles

- **ECS-first**: Game logic lives in systems, not UI components
- **Parallel architectures**: ECS (Miniplex) and GameState coexist -- ECS is newer, gradually replacing imperative state
- **Satirical tone**: All user-facing text maintains dark comedy voice
- **Mobile-first**: Touch controls, responsive layouts, PWA support
- **Type-safe**: Strict TypeScript, `any` usage warned by linter

---

## Game Systems

### The Simulation Loop

Every second, `SimulationEngine.tick()` runs:

1. **Power system** -- allocate power from coal plants to buildings
2. **Production system** -- powered farms produce food, distilleries produce vodka
3. **Consumption system** -- population consumes food; unfed citizens leave
4. **Population system** -- housing capacity drives growth
5. **Quota system** -- track progress toward Five-Year Plan targets
6. **Event system** -- roll for random events
7. **Pravda system** -- generate propaganda headlines
8. **State notification** -- push snapshot to React via `notifyStateChange()`

### Leadership & Politics

The political system is the game's core differentiator. Leaders are
procedurally generated with:

- **Archetype** (personality): Zealot, Idealist, Reformer, Technocrat,
  Apparatchik, Populist, Militarist, Mystic, Poet, Collector, or Ghost
- **Doctrine** (policy era): Revolutionary, Industrialization, Wartime,
  Reconstruction, Thaw, Freeze, Stagnation, or Eternal
- **Ministries**: Production, Defense, Culture, Propaganda, Security --
  each with their own minister and loyalty score

These compose into `PolicyModifiers` that affect every game system:
building costs, production rates, fear levels, event probabilities, and more.
Leaders come and go through succession events -- natural death, coups,
"health reasons," and mysterious disappearances.

### Resources

| Resource | Source | Sink |
|----------|--------|------|
| **Rubles** | Taxes, trade | Building construction |
| **Food** | Kolkhoz (farms) | Population consumption |
| **Vodka** | Distilleries | Morale, trade, quota targets |
| **Power** | Coal plants | Building operation |
| **Population** | Housing capacity | Labor, consumption |

### Building Types

| Building | Cost | Power | Effect |
|----------|------|-------|--------|
| Coal Plant | 300 | +100 | Generates power, +20 pollution |
| Tenement | 100 | -5 | Houses 50 citizens |
| Kolkhoz | 150 | -2 | Produces 20 food/tick |
| Vodka Plant | 250 | -5 | Produces 10 vodka/tick, +5 pollution |
| Gulag | 500 | -10 | +fear, -population |
| Road | 10 | 0 | Adjacency bonuses |

---

## Design Documents

Comprehensive design specs live in [`docs/`](docs/README.md):

| Category | Documents |
|----------|-----------|
| **Architecture** | [Leadership Architecture](docs/design-leadership-architecture.md), [Era Doctrines](docs/design-era-doctrines.md), [Power Transitions](docs/design-power-transitions.md), [Leader Archetypes](docs/design-leader-archetypes.md) |
| **Creative** | [Dialog Bible](docs/design-dialog-bible.md), [Pravda System](docs/reference-pravda-system.md) |
| **Reference** | [Name Generator](docs/reference-name-generator.md), [World-Building](docs/reference-world-building.md), [Yuka AI](docs/research-yuka-ai.md), [Audio Assets](docs/AUDIO_ASSETS.md) |

---

## Testing

```bash
# Unit tests (235 tests across 7 test files)
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# E2E tests (desktop + mobile viewports)
pnpm test:e2e
pnpm test:e2e:mobile
```

---

## CI/CD

### Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| **CI** (`ci.yml`) | Push to `main`, all PRs | Biome lint, typecheck, unit tests, production build |
| **Deploy** (`deploy.yml`) | Push to `main` | Build + deploy to GitHub Pages |
| **Mobile CI** (`mobile-ci.yml`) | Push to `main`, PRs with code changes | Build web assets, build Android APK, upload artifact |

### Design Tokens

Centralized in `src/design-system/tokens.ts`:

- **Soviet Red** `#8a1c1c` -- primary brand
- **Soviet Gold** `#cfaa48` -- accents
- **Concrete** `#757575` -- UI elements
- **Slate** `#2e2e2e` -- backgrounds
- **Typography**: VT323 (retro terminal), Courier (documents)
- **Spacing**: 4px base unit scale

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run checks: `pnpm test && pnpm typecheck && pnpm lint`
4. Commit your changes
5. Push and open a Pull Request

### Code Style

- **Biome** handles linting and formatting -- `pnpm lint:fix`
- **TypeScript strict mode** -- avoid `any` (linter warns), no implicit returns
- **ECS-first** -- game logic in systems, not UI
- **Satirical tone** -- all user-facing text maintains dark comedy voice
- **`notifyStateChange()`** -- must be called after any `GameState` mutation

---

## License

Part of the [arcade-cabinet](https://github.com/jbogaty/arcade-cabinet) collection.

---

*"The state is eternal. There is no win state. There is only the state."*
