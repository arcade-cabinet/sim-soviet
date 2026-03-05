# Memory Bank — Agent Navigation

> Cline-style memory bank adapted for multi-agent development on SimSoviet 1917.

## Purpose

The memory bank provides persistent project context so agents never start from zero. Instead of reading the entire codebase, agents read these files to understand the project's identity, architecture, patterns, and current state.

## Reading Order

**Always read in this order:**

1. **`projectbrief.md`** — What is this project? (2 min)
2. **`productContext.md`** — Why does it exist? What does the player experience? (3 min)
3. **`techContext.md`** — Tech stack, architecture, build pipeline, gotchas (5 min)
4. **`systemPatterns.md`** — Code patterns, ECS conventions, system design (5 min)
5. **`activeContext.md`** — What's happening right now? (2 min)
6. **`progress.md`** — What's done, in progress, and planned? (2 min)

## Rules

1. **Read `AGENTS.md` first** before any other memory-bank file
2. **Update `activeContext.md`** after significant development work
3. **Update `progress.md`** when features are completed or new work begins
4. **Don't duplicate CLAUDE.md** — memory bank provides context, CLAUDE.md provides operational instructions
5. **Keep files concise** — these are reference docs, not narratives

## Recent System Additions (feat/allocation-engine)

Key new systems that agents should be aware of:

| System | Location | What It Does |
|--------|----------|-------------|
| **Pressure-Valve Crisis** | `src/ai/agents/crisis/pressure/` (7 files) | 10-domain pressure accumulation → threshold-based crisis emergence. Replaces ChaosEngine dice rolls. |
| **Climate Events** | `src/ai/agents/crisis/ClimateEventSystem.ts` | Tier 2: seasonal/weather-gated natural events that spike pressure domains. |
| **Black Swan Events** | `src/ai/agents/crisis/BlackSwanSystem.ts` | Tier 3: ultra-rare events (earthquakes, solar storms, nuclear accidents). |
| **World Agent** | `src/ai/agents/core/WorldAgent.ts` | Geopolitical backdrop — spheres of influence, trade, tension, climate trends, Moscow scrutiny. |
| **Sphere Dynamics** | `src/ai/agents/core/sphereDynamics.ts` | Khaldun + Turchin empire lifecycle cycles driving sphere behavior. |
| **Cold Branches** | `src/ai/agents/core/worldBranches.ts` | Dormant divergence points activated by pressure conditions (not dates). |
| **Multi-Settlement** | `src/game/relocation/` (3 files) | Settlement type, RelocationEngine, terrain profiles (Siberia → exoplanets). |
| **HQ Splitting** | `src/growth/HQSplitting.ts` | Population milestones spawn buildings from Government HQ (50/150/400). |
| **Building Panel Content** | `src/ui/BuildingPanelContent/` | Per-role building panels (Factory, Farm, Housing, Service, etc.). |
| **HQ Agency Tabs** | `src/ui/hq-tabs/` | Government HQ tabs (Gosplan, KGB, Military, Politburo, Reports). |
| **Kardashev Sub-Eras** | `src/game/era/kardashev.ts` | 8 sub-eras replacing flat the_eternal (post_soviet → type_two_peak). |
| **Post-Scarcity Pressure** | `src/ai/agents/crisis/pressure/PressureDomains.ts` | 5 new domains: meaning, density, entropy, legacy, ennui. |
| **Celestial Body Factory** | `src/scene/celestial/` (5 files) | Sphere↔flat morphing, 4 body types (Sun/Terran/Martian/Jovian), MegastructureShell. |
| **ZonePreloader** | `src/scene/ZonePreloader.ts` | Zone-specific asset preloading (models, textures, HDRIs) with progress phases. |
| **Zone-Aware Loading** | `src/ui/LoadingScreen.tsx`, `src/ui/SettlementTransitionOverlay.tsx` | Zone-specific loading screens + settlement transition overlay with flavor text. |
| **MegaCity Law Enforcement** | `src/ai/agents/political/` | KGB → Security → Sector Judges → Megacity Arbiters at mega-scale. |
| **Adaptive Agent Matrix** | `src/ai/agents/core/agentProfiles.ts` | 10 terrain profiles, 6 agents wired, climate polarity. |

## Coordination

When multiple agents work on the project:
- Each agent reads the memory bank before starting work
- The lead agent updates `activeContext.md` when the development focus changes
- Agents update `progress.md` when completing significant features
- Conflicting updates should be resolved by the lead agent
