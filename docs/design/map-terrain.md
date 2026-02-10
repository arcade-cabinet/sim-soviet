---
title: Map & Terrain
status: Complete
implementation: src/game/map/, src/game/TerrainGenerator.ts, src/rendering/GroundTileRenderer.ts
tests: src/__tests__/MapSystem.test.ts, src/__tests__/TerrainGenerator.test.ts, src/__tests__/GroundTileRenderer.test.ts
last_verified: 2026-02-10
coverage: "Full — 3 map sizes, rivers, marshland, mountains, forests, biome rendering, terrain gameplay effects"
---

# Map & Terrain

## Map Generation

At New Game, the player selects map size. Seeded procedural generation creates the terrain.

### Map Sizes

| Size | Grid | Workers Sweet Spot | Session Feel |
|------|------|-------------------|--------------|
| Small | 20x20 | 12-80 | Quick games, tight resource management |
| Medium | 30x30 | 30-200 | Standard experience |
| Large | 50x50 | 50-500+ | Epic campaigns, strategic sprawl |

### Terrain Types

| Terrain | Passable | Buildable | Resources | Notes |
|---------|----------|-----------|-----------|-------|
| **Flat land** | Yes | Yes | — | Majority of map. Primary building area. |
| **Mountains** | No | No | Minerals (minigame) | Clusters of 3-8 tiles. Scattered throughout. |
| **Forest** | Yes | Clearable | Timber, food (hunt minigame) | Dense clusters. Clear for building space or keep for resources. |
| **River** | No | Bridges | Water, fish | 1-2 rivers crossing map. Bridges buildable. |
| **Marshland** | Yes | Slow | — | 1.5x construction time. -20% worker speed. |
| **Cleared forest** | Yes | Yes | — | Former forest, now buildable. |

### Procedural Placement Rules

- Mountains: 10-15% of map area, placed in clusters, NOT just borders
- Forests: 15-20% of map area, clearable
- Rivers: 1-2 crossing the map, snaking paths (seeded)
- Marshland: 5-10%, typically near rivers
- Map edges: dense terrain (mountains + forest) creates natural boundary — no visible edge
- Flat land: 50-60% of map, your building space

---

## Camera & Framing

### Concrete Frame

```
┌──────────────────────────────────────────┐
│████████████ TOP BAR (resources) █████████│
│▓▓│                                  │▓▓│
│▓▓│                                  │▓▓│
│▓▓│       GAME MAP VIEWPORT         │▓▓│
│▓▓│                                  │▓▓│  Brutalist concrete
│▓▓│    (drag to pan, pinch zoom)     │▓▓│  frame masks edges
│▓▓│                                  │▓▓│
│▓▓│                                  │▓▓│
│▓▓├──────────────────────────────────┤▓▓│
│▓▓│     WORKER CONTROLS / STATUS     │▓▓│
│████████████████████████████████████████│
└──────────────────────────────────────────┘
```

- Left/right borders: thin (8-12px) brutalist concrete texture
- Top: thicker, holds resource bar / era info
- Bottom: context-sensitive worker panel
- **The frame is UI chrome, not game world**

### Edge Masking Rules

- Game map is always larger than viewport at any zoom level
- Zoom-out clamped: viewport never exceeds map bounds
- Pan clamped: can't scroll past map edges
- Map edge terrain: dense mountains + forest → natural-looking boundary
- **No floating plane ever visible**

### Zoom Levels

| Level | Tile Size | Workers | Use Case |
|-------|-----------|---------|----------|
| **Close** | 80x40 (native) | Individual sprites visible | Task assignment, inspecting buildings |
| **Medium** | 40x20 | Small dots near buildings | Overview of activity, worker flow |
| **Far** | 20x10 | Not visible, buildings show count badges | Strategic view, full map overview |

### Roads & Transport Infrastructure

Roads are NOT individual placeable tiles. Instead, transport is handled via **infrastructure buildings** that provide collective-wide bonuses.

**Historical basis**: 40% of Soviet rural villages had no paved roads. Rasputitsa (mud season) made transport impossible. ([Source](https://en.wikipedia.org/wiki/Rasputitsa))

| Building | Era Available | Effect |
|----------|--------------|--------|
| **Dirt path network** | Auto (Selo) | Baseline: workers move at 1.0× speed. Rasputitsa: 0.5× |
| **Road depot** | Era 3+ (Posyolok) | Paved roads appear visually. Workers: 1.3× speed. Rasputitsa: 0.8× |
| **Rail depot** | Era 3+ (Posyolok) | Material deliveries arrive faster. Fondy delivery time -30%. |
| **Motor pool** | Era 5+ (PGT) | Workers: 1.5× speed. Construction materials move faster (-20% build time). |
| **Bus station** | Era 6+ (Gorod) | Worker assignment changes are instant (normally takes ticks to walk). |

- **Visual**: Dirt paths appear automatically between buildings. Road depot adds paved textures. Rail depot adds track sprites to map edge (supply line).
- **No pathfinding**: Workers assigned to a building arrive after a delay based on distance × speed modifier. No actual pathfinding algorithm needed.
- **Rasputitsa impact**: Without road depot, spring mud season adds +50% to all construction/farming timers. With road depot: only +20%.

---

### Seasonal Terrain Rendering

Existing FeatureTileRenderer handles seasonal sprite swaps:
- **Winter**: Snow-covered ground, frozen rivers (walkable?), bare trees
- **Rasputitsa**: Mud everywhere, flooded areas near rivers
- **Summer**: Green ground, full trees, bright rivers
- **Early Frost**: Browning ground, first snow patches
