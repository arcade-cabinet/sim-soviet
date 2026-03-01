# Active Context

## Current Development Focus

Game completion sprint — implementing all remaining features across 5 workstreams:

- W1: Scene rendering (dynamic grid, new renderers)
- W2: Game systems (consequence modes, trudodni, vodka, leaders)
- W3: Era doctrines + interactive minigame system
- W4: Platform fixes (native restart, minimap, XR entry, iOS CI)
- W5: E2E tests + documentation updates

## Recent Changes

### Demographics Overhaul (PR #39 — merged)

- 9 features implemented, 82 new tests added
- Dvory (household) system, births/deaths/aging, gender retirement
- Private plots, loyalty/sabotage, trudodni labor accounting
- Male-first conscription, era birth rates
- Full save/load serialization

### Documentation Overhaul (PR #39 — merged)

- 41 docs with standardized YAML frontmatter
- 273/283 source files with JSDoc
- AGENTS.md hierarchy, memory-bank, .claude architecture
- TypeDoc pipeline

### Game Completion Sprint (in progress)

- Consequence mode rehabilitation flow
- Era doctrine mechanics (thaw/freeze, stagnation rot, eternal bureaucracy)
- Interactive minigame UI framework
- Dynamic grid size system
- New scene renderers (CitizenRenderer, PoliticalEntityRenderer, HeatingOverlay)
- E2E Playwright test expansion (6 spec files)

### Previous Major Work

- R3F migration from BabylonJS/Reactylon (completed)
- WebGPU migration (reverted — dual-instance problem)
- All GDD gap closure (28/28 PRD gaps done)
- Political entity system with tap interaction

## Active Branches

| Branch | Purpose | Status |
|--------|---------|--------|
| `main` | Release branch | Current |
| `feat/game-completion` | Game completion sprint | In progress |
| Release Please v1.2.0 | PR #37 | Open |

## Known Issues

- tsconfig: `module: "commonjs"` conflicts with `moduleResolution: "bundler"` — pre-existing, doesn't block builds
- Branch protection: main requires PRs — cannot push directly
