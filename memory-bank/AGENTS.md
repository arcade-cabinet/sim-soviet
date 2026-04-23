# Memory Bank - Agent Navigation

Persistent project context for SimSoviet 1917. These files should stay aligned
with `CLAUDE.md`, `AGENTS.md`, and the canonical docs in `docs/`.

## Reading Order

1. `projectbrief.md` - product identity and scope
2. `productContext.md` - player experience and system intent
3. `techContext.md` - stack, commands, workflows, and verification lanes
4. `systemPatterns.md` - architecture and coding patterns
5. `activeContext.md` - immediate development focus
6. `progress.md` - shipped surface and remaining work summary

## 1.0 Scope

SimSoviet 1917 is a historical Soviet bureaucrat survival sim. The 1.0 campaign
runs from 1917 through the 1991 dissolution endpoint. After the campaign
summary, the same settlement may continue in grounded post-campaign free play.

Keep:
- Historical settlement simulation and autonomous organic growth.
- Historical eras, quotas, inspections, food, industry, power, transport,
  politics, KGB, demographics, narrative, and classical pressure domains.
- The 1991 completion state and conservative same-settlement continuation.

Remove from 1.0:
- Deep-future eras, space expansion, per-world timelines, and Kardashev stages.
- Multi-settlement relocation, celestial rendering, arcologies, and global
  expansion layers.
- Post-scarcity pressure domains and freeform chaos modes.

## Current Key Systems

| System | Location | Purpose |
|--------|----------|---------|
| Simulation tick | `src/game/SimulationEngine.ts`, `src/game/engine/` | Historical campaign orchestration and serialization |
| Era data | `src/game/era/`, `src/config/eras.json` | Seven historical eras ending in 1991 |
| Pressure-valve crisis | `src/ai/agents/crisis/pressure/` | Classical pressure accumulation and crisis emergence |
| World backdrop | `src/ai/agents/core/WorldAgent.ts` | Grounded geopolitical pressure and Moscow scrutiny |
| Organic growth | `src/growth/` | Demand, site selection, pacing, and HQ splitting |
| Building panels | `src/ui/BuildingPanelContent/`, `src/ui/hq-tabs/` | Buildings-as-UI interaction surface |
| Historical completion | `src/ui/USSRDissolutionModal.tsx`, `src/game/engine/phaseChronology.ts` | One-shot 1991 campaign completion and continuation |

## Coordination Rules

- Update `activeContext.md` when the immediate focus changes.
- Update `progress.md` when shipped state or remaining work materially changes.
- Do not reintroduce removed future scope unless the product scope changes again.
