# Contributing to SimSoviet 2000 🏭

Welcome, Comrade Developer! Your contributions to the glorious SimSoviet 2000 project are valued by the Ministry of Software Development.

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v22+ (check `.nvmrc`)
- **pnpm**: v10+ (fast, efficient package manager)
- **Git**: For version control

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/arcade-cabinet/sim-soviet.git
cd sim-soviet

# Install dependencies
pnpm install

# Download audio assets (optional, requires wget & ffmpeg)
pnpm download:audio

# Start development server
pnpm dev
```

## 📋 Project Structure

```
sim-soviet/
├── app/              # Application shell (Capacitor wrapper)
│   ├── index.html    # Entry HTML
│   ├── main.ts       # Bootstrap
│   ├── style.css     # App styles
│   └── public/       # Static assets
├── src/              # Core game engine (reusable library)
│   ├── design-system/  # Design tokens
│   ├── game/           # Game logic
│   ├── rendering/      # BabylonJS rendering
│   ├── ui/             # UI management
│   ├── input/          # Input handling
│   └── audio/          # Audio system
├── docs/             # Documentation
├── scripts/          # Build/dev scripts
└── .github/          # CI/CD workflows
```

## 🎯 Development Workflow

### 1. Create a Branch
```bash
git checkout -b feat/your-feature-name
# Or: fix/bug-description
```

### 2. Make Changes
- Follow TypeScript best practices
- Use design tokens from `src/design-system/tokens.ts`
- Keep changes minimal and focused
- Add JSDoc comments for public APIs

### 3. Test Your Changes
```bash
# Type check
pnpm typecheck

# Lint (Biome)
pnpm lint

# Auto-fix issues
pnpm lint:fix

# Build
pnpm build
```

### 4. Commit
We use **Conventional Commits**:

```bash
# Format: <type>(<scope>): <description>

# Examples:
git commit -m "feat(audio): add volume controls"
git commit -m "fix(renderer): correct isometric tile positioning"
git commit -m "docs(readme): update installation steps"
git commit -m "refactor(ui): extract toolbar to separate component"
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style/formatting
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Tests
- `chore`: Maintenance

### 5. Push & PR
```bash
git push origin feat/your-feature-name
```

Then open a Pull Request on GitHub.

## 🎨 Code Style

### TypeScript
- **Strict mode**: No `any` types
- **Explicit returns**: Always type function returns
- **Interfaces over types**: For object shapes
- **Named exports**: Avoid default exports

```typescript
// ✅ Good
export interface BuildingConfig {
  name: string;
  cost: number;
}

export function createBuilding(config: BuildingConfig): Building {
  // ...
}

// ❌ Avoid
export default function() {
  // ...
}
```

### Formatting
We use **Biome** (replaces ESLint + Prettier):
```bash
pnpm lint:fix  # Auto-fix
pnpm format    # Format all files
```

**Settings** (in `biome.json`):
- Single quotes
- 2-space indentation
- 100 char line width
- Semicolons required

### Naming Conventions
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `PascalCase.ts` for classes, `camelCase.ts` for utilities

## 🧪 Testing

### Current State
- No test framework yet (planned: Vitest)
- Manual testing required
- CI runs type checking and builds

### Manual Testing
1. Run `pnpm dev`
2. Test in browser (Chrome/Firefox/Safari)
3. Test on mobile (via Capacitor)
4. Check console for errors
5. Verify no TypeScript errors

## 🎵 Audio Assets

Audio files are **not** committed to Git. They're downloaded from marxists.org.

### Adding New Audio
1. Update `src/audio/AudioManifest.ts`
2. Add download logic to `scripts/download-audio.sh`
3. Document in `docs/AUDIO_ASSETS.md`
4. Ensure proper attribution

### License Compliance
- Use Public Domain sources (marxists.org)
- Add attribution in manifest
- Check `docs/AUDIO_ASSETS.md` for guidelines

## 🏗️ Architecture Guidelines

### Design Tokens First
Always use tokens from `src/design-system/tokens.ts`:

```typescript
import { colors, spacing, typography } from '@/design-system/tokens';

// ✅ Good
const titleStyle = {
  color: colors.sovietRed,
  fontSize: typography.fontSize['2xl'],
  padding: spacing.md,
};

// ❌ Avoid magic values
const titleStyle = {
  color: '#8a1c1c',
  fontSize: '24px',
  padding: '16px',
};
```

### Separation of Concerns
- **Game Logic** (`src/game/`): Pure logic, no rendering
- **Rendering** (`src/rendering/`): BabylonJS meshes, no game logic
- **UI** (`src/ui/`): DOM manipulation, HUD
- **Input** (`src/input/`): Event handling, no state mutation

### State Management
- All state in `GameState.ts`
- Components read from state
- Simulation updates state
- UI reacts to state changes

## 📱 Mobile Development

### Testing on Android
```bash
# Add Android platform
pnpm cap:android

# Sync web build
pnpm build && pnpm cap:sync

# Build APK
pnpm android:build
```

### Mobile-Specific Considerations
- Touch events (not just mouse)
- Performance (lower-end devices)
- Audio playback (iOS restrictions)
- Screen sizes (responsive design)

## 🐛 Debugging

### Browser DevTools
- **F12**: Open DevTools
- **BabylonJS Inspector**: Built-in scene debugger
- **Network Tab**: Check asset loading
- **Performance Tab**: Profile rendering

### Common Issues

**Build fails:**
```bash
pnpm clean && pnpm install
```

**Types not resolving:**
- Check `tsconfig.json` paths
- Restart TypeScript server

**Audio not playing:**
- User interaction required (browser policy)
- Check console for errors
- Verify file paths

## 📝 Documentation

### When to Update Docs
- New features → Update README
- API changes → Update JSDoc
- Architecture changes → Update this file
- Audio assets → Update AUDIO_ASSETS.md

### Documentation Style
- Clear and concise
- Code examples
- Soviet-themed humor welcome!
- Emoji for visual hierarchy

## 🚦 CI/CD

### Workflows
1. **CI**: Runs on all PRs (lint, typecheck, build)
2. **Deploy**: Runs on `main` push (GitHub Pages)
3. **Mobile CI**: Builds Android APK

### Making CI Pass
```bash
# Run what CI runs locally:
pnpm lint
pnpm typecheck
pnpm build
```

## 🎖️ Recognition

Contributors will be:
- Listed in README
- Awarded Honorary Soviet Developer badge
- Given unlimited virtual vodka rations

## 🤝 Code of Conduct

- Be respectful and inclusive
- Constructive criticism only
- Help fellow developers
- Have fun! This is a game project!

## 📞 Getting Help

- **Issues**: GitHub Issues for bugs/features
- **Discussions**: GitHub Discussions for questions
- **Discord**: (link TBD)

---

**Remember:** In Soviet development, code reviews YOU! 

But seriously, we're here to help. Don't hesitate to ask questions.

**Glory to the workers! Glory to the code!** 🏭⚡
