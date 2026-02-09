# SimSoviet 2000 🏭⚡

An isometric city builder game with a Soviet aesthetic, built with modern web technologies and targeting both web and mobile platforms.

## 🎮 Game Features

- **Isometric 3D Grid**: 30x30 tile BabylonJS-powered world
- **Soviet Buildings**: Coal plants, housing, farms, distilleries, gulags
- **Resource Management**: Rubles, population, food, vodka, power
- **Power Grid Simulation**: Buildings need power to function
- **5-Year Plans**: Meet quotas or face consequences
- **Weather System**: Dynamic snow and atmospheric effects
- **Sound System**: Retro audio feedback (coming soon)
- **Persistence**: Auto-save to localStorage
- **Events System**: Random events and advisor messages
- **Mobile Support**: Touch controls and Capacitor for native apps

## 🛠️ Tech Stack

- **Engine**: [BabylonJS 7.x](https://www.babylonjs.com/) - WebGL 3D rendering
- **Animation**: [anime.js](https://animejs.com/) - Smooth easing and transitions
- **Build Tool**: [Vite 6.x](https://vitejs.dev/) - ESM-native dev & build
- **Language**: TypeScript 5.9 - Full type safety
- **Code Quality**: [Biome 2.3](https://biomejs.dev/) - Rust-powered linting
- **Mobile**: [Capacitor 6.x](https://capacitorjs.com/) - Cross-platform wrapper
- **Package Manager**: pnpm 10.x - Fast, disk-efficient

## 📁 Project Structure (DRY Soviet Style)

```
sim-soviet/
├── app/                    # Application layer (Capacitor wrapper)
│   ├── index.html          # Entry HTML with UI structure
│   ├── style.css           # App-specific styles
│   ├── main.ts             # Bootstrap & initialization
│   └── public/             # Static assets (icons, audio, etc)
│
├── src/                    # Core game engine (reusable library)
│   ├── design-system/      # Design tokens & branding
│   │   └── tokens.ts       # Colors, spacing, typography system
│   │
│   ├── game/               # Game logic & simulation
│   │   ├── GameState.ts    # Central state management
│   │   ├── SimulationEngine.ts  # Tick-based simulation
│   │   ├── SaveSystem.ts   # localStorage persistence
│   │   └── EventSystem.ts  # Random events & scenarios
│   │
│   ├── rendering/          # BabylonJS rendering layer
│   │   ├── IsometricRenderer.ts  # Grid & building meshes
│   │   ├── ParticleSystem.ts     # Snow, smoke, effects
│   │   └── CameraController.ts   # Camera management
│   │
│   ├── ui/                 # DOM UI management
│   │   ├── UIManager.ts    # HUD updates & notifications
│   │   └── ToolbarManager.ts  # Building selection
│   │
│   ├── input/              # Input handling
│   │   ├── InputManager.ts      # Mouse/touch events
│   │   └── TouchController.ts   # Mobile gestures
│   │
│   ├── audio/              # Sound system (future)
│   │   └── AudioManager.ts
│   │
│   └── config.ts           # Game configuration constants
│
├── dist/                   # Build output (generated, gitignored)
├── android/                # Native Android (generated via Capacitor)
├── ios/                    # Native iOS (generated via Capacitor)
│
└── .github/                # CI/CD automation
    ├── actions/
    │   └── setup-node-pnpm/     # Composite action
    └── workflows/
        ├── ci.yml               # Lint, test, build
        ├── deploy.yml           # GitHub Pages
        └── mobile-ci.yml        # Android APK build
```

### Design Philosophy

**Soviet Efficiency Principles:**
- **DRY**: Game engine (`/src`) separate from app shell (`/app`)
- **Modular**: Clean boundaries between systems
- **Reusable**: Core library can power multiple frontends
- **Type-Safe**: Strict TypeScript, no `any` allowed
- **Observable**: State changes trigger UI updates automatically

## 🎨 Design Tokens

Centralized design system in `src/design-system/tokens.ts`:

**Brand Colors:**
- Soviet Red: `#8a1c1c` - Primary brand color
- Soviet Gold: `#cfaa48` - Accent & highlights
- Concrete: `#757575` - UI elements
- Slate: `#2e2e2e` - Backgrounds

**Typography:**
- Primary: VT323 (retro terminal font)
- Monospace: Courier (documents, code)
- System: Fallback for UI

**Spacing Scale:** 4px base unit (xs=4, sm=8, md=16, lg=24, xl=32, xxl=48)

## 🚀 Development

### Quick Start
```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Open browser to http://localhost:3000
```

### Available Scripts
```bash
pnpm dev           # Start Vite dev server
pnpm build         # Build for production
pnpm preview       # Preview production build
pnpm typecheck     # Run TypeScript compiler checks
pnpm lint          # Check code with Biome
pnpm lint:fix      # Auto-fix linting issues
pnpm format        # Format code with Biome
pnpm test          # Run tests (placeholder)
pnpm clean         # Remove build artifacts
```

## 📱 Mobile Development

### Android Setup
```bash
# Add Android platform
pnpm cap:android

# Build debug APK
pnpm android:build

# Run on device/emulator
pnpm android:run
```

**Output:** `android/app/build/outputs/apk/debug/app-debug.apk`

### iOS Setup (macOS only)
```bash
# Add iOS platform
pnpm cap:ios

# Opens Xcode - build from there
```

### Sync Changes
After modifying web code:
```bash
pnpm build && pnpm cap:sync
```

## 🔄 CI/CD Pipelines

### Workflows

**1. CI (`.github/workflows/ci.yml`)**
- Triggers: Push to `main`, all PRs
- Jobs:
  - ✅ Biome linting
  - ✅ TypeScript type checking  
  - ✅ Unit tests
  - ✅ Production build
  - 📦 Upload build artifacts

**2. Deploy (`.github/workflows/deploy.yml`)**
- Triggers: Push to `main`
- Jobs:
  - 🏗️ Build web app
  - 🚀 Deploy to GitHub Pages
  - 🌐 Available at: `https://arcade-cabinet.github.io/sim-soviet/`

**3. Mobile CI (`.github/workflows/mobile-ci.yml`)**
- Triggers: Push to `main`, PRs with code changes
- Jobs:
  - ☕ Setup JDK 17
  - 🤖 Setup Android SDK
  - 🏗️ Build web assets
  - 📦 Build debug APK
  - ⬆️ Upload APK artifact (30-day retention)

### GitHub Pages Setup
1. Repository Settings → Pages
2. Source: **GitHub Actions**
3. Site URL: `https://arcade-cabinet.github.io/sim-soviet/`

## 🎯 Gameplay

### Buildings

| Icon | Building | Cost | Effect |
|------|----------|------|--------|
| 🛣️ | Road | 10₽ | Aesthetic (no function yet) |
| ⚡ | Coal Plant | 300₽ | +100 power, +20 pollution |
| 🏢 | Tenement | 100₽ | +50 housing capacity, -5 power |
| 🥔 | Kolkhoz | 150₽ | +20 food/tick, -2 power |
| 🍾 | Vodka Plant | 250₽ | +10 vodka/tick, -5 power, +5 pollution |
| ⛓️ | Gulag | 500₽ | -20 pop (fear), -10 power |
| 💣 | Purge | 20₽ | Remove building |

### Resources
- **Rubles (₽)**: Currency for construction
- **Population**: Workers (need housing)
- **Food**: 1 per 10 pop/tick
- **Vodka**: 1 per 20 pop/tick (happiness)
- **Power**: Buildings need power to function

### Win Condition
Meet 5-Year Plan quotas before deadline. Fail = "game over" (but you can keep playing in shame).

## 🧪 Testing

```bash
# Run tests (when implemented)
pnpm test

# Type checking
pnpm typecheck
```

## 🐛 Debugging

**Browser DevTools:**
- BabylonJS Inspector: Press F12 in dev mode
- Performance: Chrome DevTools Performance tab
- Network: Check asset loading

**Common Issues:**
- Build fails → Run `pnpm clean && pnpm install`
- Types not resolving → Check `tsconfig.json` paths
- Android build fails → Ensure JDK 17 installed

## 📦 Production Build

```bash
# Build optimized bundle
pnpm build

# Output: /dist directory
# - Minified JavaScript
# - Optimized assets
# - Source maps (for debugging)
```

**Build Size Targets:**
- JavaScript: ~500KB gzipped
- Assets: Lazy-loaded
- First Paint: <2s on 3G

## 🤝 Contributing

**Code Style:**
- Use Biome (replaces ESLint + Prettier)
- Conventional Commits
- TypeScript strict mode
- No `any` types

**PR Process:**
1. Fork & create feature branch
2. Make changes, run `pnpm lint:fix`
3. Commit with conventional format
4. Push & open PR
5. CI checks must pass

## 📄 License

MIT License - See LICENSE file

---

**Built for arcade-cabinet organization** 🕹️  
**Soviet efficiency meets modern web tech** ⚡
