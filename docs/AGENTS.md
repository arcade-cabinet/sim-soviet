# Documentation — Master Agent Index

> **SimSoviet 1917** — Satirical 3D city-builder (R3F + Three.js r183 + React Native + Expo)

## Quick Navigation

| Index | Domain | Docs |
|-------|--------|------|
| [`design/AGENTS.md`](design/AGENTS.md) | Game systems design docs | 15 docs |
| [`plans/AGENTS.md`](plans/AGENTS.md) | Implementation plans & PRDs | 9 docs |
| [`devlog/AGENTS.md`](devlog/AGENTS.md) | Development milestones | 5 entries |
| [`reference/AGENTS.md`](reference/AGENTS.md) | Subsystem reference docs | 6 docs |
| [`audits/AGENTS.md`](audits/AGENTS.md) | Code-vs-docs audits | 1 audit |

## Frontmatter Schema

Every doc in `docs/` has YAML frontmatter. Scan with: `head -20 docs/**/*.md`

```yaml
---
title: Document Title
type: design | reference | plan | devlog | audit | vision | research | index
status: draft | active | implemented | superseded | archived
implementation:               # Source files that implement the design
  - src/path/to/file.ts
tests:                         # Test files for this system
  - __tests__/path/to/test.ts
coverage: full | partial | none
last_verified: YYYY-MM-DD
# Plan-specific (optional):
plan_status: proposed | in-progress | completed | abandoned
superseded_by: path/to/newer-doc.md
# Devlog-specific (optional):
date: YYYY-MM-DD
category: feature | bugfix | refactor | migration
commits:
  - abc1234
---
```

## Type Taxonomy

| Type | Purpose | Count |
|------|---------|-------|
| `design` | Game system specifications | 16 |
| `plan` | Implementation strategies & PRDs | 9 |
| `devlog` | Chronological development milestones | 5 |
| `reference` | Subsystem data structure documentation | 6 |
| `audit` | Code-vs-docs alignment assessments | 1 |
| `vision` | High-level game vision | 1 |
| `research` | External library research | 1 |
| `index` | Navigation indexes (README files) | 3 |

## Status Taxonomy

| Status | Meaning |
|--------|---------|
| `draft` | Design spec, not yet fully implemented |
| `active` | In use, may have ongoing changes |
| `implemented` | Fully reflected in code |
| `superseded` | Replaced by a newer document |
| `archived` | Historical reference only |

## Start Here

1. **Quick overview**: [`GAME_VISION.md`](GAME_VISION.md) — covers everything in ~10 minutes
2. **Full GDD**: [`GDD-master.md`](GDD-master.md) — every mechanic specified
3. **Per-system**: Browse [`design/AGENTS.md`](design/AGENTS.md) for domain-specific docs

## All Documents by Status

### Implemented (Canonical — reflects actual code)
| Document | Type | Implementation |
|----------|------|---------------|
| `design/overview.md` | design | — |
| `design/economy.md` | design | `src/game/economy.ts` |
| `design/workers.md` | design | `src/game/workers/WorkerSystem.ts` |
| `design/demographics.md` | design | `src/ecs/systems/demographicSystem.ts` |
| `design/political.md` | design | `src/game/political/`, `src/game/politburo/` |
| `design/eras.md` | design | `src/game/era/EraSystem.ts` |
| `design/minigames.md` | design | `src/game/minigames/MinigameRouter.ts` |
| `design/scoring.md` | design | `src/game/ScoringSystem.ts` |
| `design/ecs-architecture.md` | design | `src/ecs/` |

### Active (In use, ongoing)
| Document | Type |
|----------|------|
| `GAME_VISION.md` | vision |
| `GDD-master.md` | design |
| `design/ui-ux.md` | design |
| `design/dialog-bible.md` | design |
| `reference/politburo-system.md` | reference |
| `reference/pravda-system.md` | reference |
| `reference/name-generator.md` | reference |
| `reference/world-building.md` | reference |
| `reference/audio-assets.md` | reference |

### Draft (Aspirational — not yet fully implemented)
| Document | Type |
|----------|------|
| `design/era-doctrines.md` | design |
| `design/leader-archetypes.md` | design |
| `design/leadership-architecture.md` | design |
| `design/power-transitions.md` | design |

### Superseded
| Document | Replaced By |
|----------|-------------|
| `plans/2026-02-26-reactylon-native-3d-design.md` | `plans/2026-02-27-r3f-migration-design.md` |
| `plans/2026-02-26-simSoviet1917-reactylon-native.md` | `plans/2026-02-27-r3f-migration-plan.md` |
