# Active Context

## Current Development Focus

Documentation and tooling infrastructure overhaul:
- Standardized YAML frontmatter on all 41 docs
- AGENTS.md index hierarchy for agent navigation
- Cline-style memory bank (this directory)
- JSDoc completion across ~283 source files
- TypeDoc generation pipeline
- Bespoke .claude architecture (agents, commands, hooks)

## Recent Changes

### Demographics Overhaul (PR #39 — completed)
- 9 features implemented, 82 new tests added
- Dvory (household) system, births/deaths/aging, gender retirement
- Private plots, loyalty/sabotage, trudodni labor accounting
- Male-first conscription, era birth rates
- Full save/load serialization

### Previous Major Work
- R3F migration from BabylonJS/Reactylon (completed)
- WebGPU migration (reverted — dual-instance problem)
- All GDD gap closure (28/28 PRD gaps done)
- Political entity system with tap interaction

## Active Branches

| Branch | Purpose | Status |
|--------|---------|--------|
| `feat/demographics-overhaul` | Demographics PR #39 | PR open |
| `feat/docs-jsdoc-claude-overhaul` | This documentation overhaul | In progress |

## Known Issues

- tsconfig: `module: "commonjs"` conflicts with `moduleResolution: "bundler"` — pre-existing, doesn't block builds
- 3D rendering needs live verification on deployed v1.1.2
