# SimSoviet 2000 -- Design Documents

> *"All documentation is accurate. Discrepancies are the reader's fault."*

This directory contains the foundational design specifications and reference
documents for SimSoviet 2000. These are permanent records -- they define
the game's systems, content, and creative voice.

---

## Architecture & Systems

| Document | Description |
|----------|-------------|
| [ECS Architecture](design-ecs-architecture.md) | Miniplex 2.0 Entity Component System -- 7 data components, 4 tag components, 14 archetype queries, 6 system functions. Unified Entity interface, system pipeline execution order, React bindings. |
| [Leadership Architecture](design-leadership-architecture.md) | ECS component design for the political system -- Leader, Ministry, PolicyModifiers, Politburo components. Modifier pipeline, data flow, phased implementation plan. |
| [Era Doctrines](design-era-doctrines.md) | The 8 composable policy modifier sets any leader can adopt: Revolutionary, Industrialization, Wartime, Reconstruction, Thaw, Freeze, Stagnation, Eternal. TypeScript interfaces, transition graph. |
| [Power Transitions](design-power-transitions.md) | Leadership succession mechanics -- 7 transition types (natural death, coup, health reasons, mysterious disappearance, assassination, palace revolution, the immortal). Probability engine, state machine, announcement system. |
| [Leader Archetypes](design-leader-archetypes.md) | The 11 procedurally-generated leader personality types: Zealot, Idealist, Reformer, Technocrat, Apparatchik, Populist, Militarist, Mystic, Poet, Collector, Ghost. Succession matrices, purge chains, cross-archetype systems. |

## Content & Creative

| Document | Description |
|----------|-------------|
| [Dialog Bible](design-dialog-bible.md) | Complete voice guide for all in-game text. Trilingual voice (Russian, Yiddish, accented English), advisor monologues, leader decrees by archetype, citizen complaints, building placement lines, game-over states. |
| [Pravda System Reference](reference-pravda-system.md) | Procedural propaganda headline generator -- 61 generators across 6 categories, 279 word pool entries producing 145,000+ unique combinations. Contextual, ambient, and event-reactive modes. |

## Technical Reference

| Document | Description |
|----------|-------------|
| [Politburo System Reference](reference-politburo-system.md) | Ministry & Politburo simulation -- 10 ministries, 8 personality archetypes, 80-cell interaction matrix, inter-ministry tension system, coup/purge probability engines, 29 event templates, appointment strategies. |
| [Name Generator Reference](reference-name-generator.md) | Procedural Russian name generator API -- 3-part naming (given + patronymic + surname), 81 male names, 40 female names, 173 surnames, 85 titles. `generate()`, `generatePolitburo()`, `generateCabinet()`. |
| [World-Building Reference](reference-world-building.md) | Content module reference -- 36 alternate-history timeline events, city naming system, 36 radio announcements, 17 building flavor texts, 42 loading quotes, 31 achievements. |
| [Yuka AI Research](research-yuka-ai.md) | Capabilities mapping of the Yuka v0.7.8 AI library to the leadership system -- GoalEvaluator, StateMachine, FuzzyModule, MemorySystem, steering behaviors, JSON serialization. |

## Assets

| Document | Description |
|----------|-------------|
| [Audio Assets](AUDIO_ASSETS.md) | Inventory of the 40+ Soviet-era music tracks sourced from public domain. Download script reference. |

---

## Reading Order

For a new contributor, the recommended reading order is:

1. **ECS Architecture** -- understand the entity-component-system backbone
2. **Leadership Architecture** -- understand the political ECS components
3. **Era Doctrines** -- understand the policy modifier system
4. **Leader Archetypes** -- understand who drives those policies
5. **Power Transitions** -- understand how leaders come and go
6. **Politburo System Reference** -- understand the ministry simulation engine
7. **Dialog Bible** -- understand the game's creative voice
8. **Name Generator + World-Building** -- understand the content layer
9. **Yuka AI Research** -- understand the planned AI integration

## Development Log

Chronological record of major milestones: [docs/devlog/](devlog/README.md)

---

*Document count: 12 + devlog | Last updated: February 2026*
