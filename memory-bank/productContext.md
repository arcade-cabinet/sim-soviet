# Product Context

## Why This Project Exists

SimSoviet 1917 is a **Soviet bureaucrat survival sim** where the system itself is the antagonist. Unlike SimCity or Cities: Skylines where you build freely, here the player is a predsedatel (chairman) — a cog in the Soviet machine constrained by mandates, quotas, and political pressure. The settlement grows organically through autonomous agent systems. The player observes, sets priorities, and intervenes only when desperate.

**THIS IS NOT A CITY BUILDER.** The player does not place buildings freely. Moscow mandates what to build. The player only chooses WHERE to place mandated buildings and navigates political survival.

The satirical tone (dark comedy about bureaucracy, propaganda, and survival) provides entertainment value and historical education about how planned economies actually functioned.

## User Experience Goals

1. **Immediate immersion** — the Soviet aesthetic and the feeling of being a small cog in an enormous machine
2. **Watch the collective breathe** — workers auto-assign, paths form, buildings grow organically
3. **Meaningful tension** — every decision has tradeoffs: falsify reports (risky) or admit failure (consequences)
4. **Political survival** — your personnel file (lichnoye delo) IS the game — keep marks low, stay unremarkable
5. **Replayability** — 8 eras, historical/freeform modes, 3 consequence levels, procedural leaders, emergent crises

## What the Player Does

- **Observes** the settlement self-organizing
- **Chooses WHERE** to place mandated buildings (the ONLY spatial control)
- **Sets collective priorities** when demands conflict
- **Navigates political conversations** with commissars, KGB, military
- **Makes moral choices** — who to sacrifice, how much corruption, when to falsify
- **Overrides the collective** in emergencies (costs political capital)

## What the Player Does NOT Do

- Choose which buildings to build (Moscow mandates them)
- Individually assign workers (the collective self-organizes)
- Draw roads (they form from worker movement)
- Fight anyone directly
- Freely place structures from a toolbar

## Key Gameplay Systems

| System | Purpose |
|--------|---------|
| **Autonomous Collective** | Workers self-organize around priorities; player sets focus, not assignments |
| **Five-Year Plans** | Moscow mandates buildings + production quotas; player navigates compliance |
| **Personnel File** | Black marks → watched → investigated → arrested. THE fail-state meter. |
| **Demographics** | Dvory (households), births/deaths/aging, gendered labor, private plots |
| **Political Apparatus** | Politruks, KGB informants, military, personnel file with black marks |
| **Politburo** | 10 ministries, interaction matrix, coups, purges, succession |
| **Governor/Crisis** | PressureSystem (10 domains) + WorldAgent (sphere dynamics) + ClimateEventSystem + BlackSwanSystem + ColdBranches (19 branches) |
| **Eras** | 8 campaigns (Revolution → The Eternal) with doctrine integration |
| **Scoring** | Medals, achievements, consequence multipliers |

## Current Feature Set (Implemented)

- SimulationEngine with 7 phase modules (thin orchestrator, ~966 lines)
- Yuka agent architecture (9 subpackages, 169+ files, 39k+ lines)
- Building-as-Container (dual population modes: entity < 200, aggregate >= 200)
- Pressure-valve crisis system (PressureSystem with 10 domains + WorldAgent sphere dynamics + ClimateEventSystem + BlackSwanSystem + ColdBranches with 19 branches)
- Soviet Allocation Engine (organic growth, demand pipeline, site selection, HQ splitting, directives, posture, prestige)
- Buildings-as-UI (click buildings for contextual panels: FactoryContent, FarmContent, GovernmentHQ)
- Dynamic map expansion (grid expands via settlement tier upgrades, land grants)
- RelocationEngine data model for multi-settlement support (gameplay/UI viewport switching NOT yet implemented)
- Demographics (dvory, births/deaths/aging, gendered retirement)
- Full political apparatus (KGB, politruks, loyalty, trudodni)
- 56 3D models, 47 music tracks, 22 scene components
- 5,641+ tests across 170+ suites
