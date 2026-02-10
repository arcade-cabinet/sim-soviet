---
title: Initial Build -- Canvas 2D Migration & Core Systems
date: 2026-02-09
status: Complete
category: devlog
commits: 6ca2bce..e39929f
---

# 001: Initial Build -- Canvas 2D Migration & Core Systems

## What Was Built

- **Canvas 2D renderer** replacing BabylonJS 3D engine
  - 6-layer rendering pipeline (ground, grid, buildings, hover, preview, particles)
  - Camera2D with pan/zoom and DPR-aware canvas sizing
  - SpriteLoader with manifest-driven preloading (31 building PNGs)
  - GridMath for isometric projection (TILE_WIDTH=80, TILE_HEIGHT=40)
  - CanvasGestureManager for tap/pan/pinch/scroll-zoom
  - ParticleSystem2D for snow/rain in screen-space
- **Sprite pipeline** (Blender render scripts)
  - `render_sprites.py`: 31 building PNGs at PPU=80
  - `render_hex_tiles.py`: 138 hex terrain tiles across 3 seasons
  - Anchor system: projected tile base center with auto-crop
- **Building defs pipeline**: manifest.json -> Zod-validated buildingDefs.generated.json
- **CI/CD**: GitHub Actions for lint/typecheck/test/build + auto-deploy to Pages
- **795 unit tests** passing (Vitest + happy-dom)

## Key Decisions

- **Canvas 2D over BabylonJS**: BabylonJS was too heavy for a 2D isometric game.
  Pre-baked sprites from Blender give the SimCity 2000 aesthetic at a fraction of
  the bundle size (665 KB main JS vs ~2MB with BabylonJS).
- **Sprite baking via Blender**: Orthographic camera at 60deg X / 45deg Z for 2:1
  dimetric projection, Cycles renderer for quality PNGs.
- **Vite root = ./app**: Keeps static assets in `app/public/` separate from source.
- **Asset URLs use `import.meta.env.BASE_URL`**: Required for GitHub Pages
  subdirectory deployment at `/sim-soviet/`.

## PRs Merged

- PR #1: Canvas 2D migration, CI/CD setup, systems overhaul
- PR #2: Fix deploy workflow (upload-pages-artifact v3->v4)
- PR #3: Fix sprite/audio asset paths with Vite BASE_URL
