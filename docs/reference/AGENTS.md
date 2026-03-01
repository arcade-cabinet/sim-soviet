# Reference Documents — Agent Index

> Scan frontmatter: `head -20 docs/reference/*.md`

## How to Use This Index

Reference documents describe existing subsystems in detail — their data structures, algorithms, and content inventories. These are living documentation of implemented code.

## Document Index

| Document | Title | Key Data Structures | Implementation |
|----------|-------|-------------------|---------------|
| `politburo-system.md` | Politburo & Ministry System | 10 ministries, 80-cell interaction matrix, 29 events | `src/game/politburo/` |
| `pravda-system.md` | Pravda Headline Generator | 145K+ headline combinations, mood-based spin | `src/game/pravda/` |
| `name-generator.md` | Procedural Name Generator | 1.1M+ Russian name combinations | `src/content/worldbuilding/names.ts` |
| `world-building.md` | World-Building Content | Timeline events, achievements, building flavor, quotes | `src/content/worldbuilding/` |
| `audio-assets.md` | Audio Assets Inventory | 52 OGG tracks, playlists, mood mapping | `src/audio/AudioManifest.ts` |
| `research-yuka-ai.md` | Yuka AI Library Research | Behavioral AI primitives research | archived — not implemented |
