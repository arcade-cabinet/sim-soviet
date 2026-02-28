---
title: Overview — Game Identity & Core Loop
status: Complete
last_verified: 2026-02-10
coverage: "Full — core loop, ECS architecture, Canvas 2D rendering, all subsystems wired"
---

# Overview — Game Identity & Core Loop

## Game Identity

**Genre**: Worker-management survival sim with 3D city-building
**Setting**: Alternate history — the Soviet Union never collapses. The state endures from 1917 through the present and beyond.
**Platform**: Mobile-first (phone), browser, PWA
**Tone**: Dark satirical comedy. *Krokodil* magazine meets Papers, Please meets Banished.

**The Pitch**: You are the predsedatel — the chairman of a Soviet collective. You take orders from the central authority and ensure your labor pool works for the good of the state. The political apparatus is the weather: politruks check your loyalty, the KGB disappears your best workers, and the military drafts them regardless of impact. Your job is to keep everyone alive, meet impossible quotas, and avoid attracting attention.

**What This Is NOT**:
- Not a power fantasy — you have no upward mobility
- Not a free-market sim — the planned economy dictates everything
- Not a war game — the military is a drain, not a tool
- Not a game where the USSR falls — alternate history, the state endures forever

## You Are the Predsedatel

The player is the **predsedatel** (председатель) — the chairman of the collective. In early eras, you're the predsedatel kolkhoza (collective farm chairman). As the collective industrializes, you become the direktor of the enterprise. You take orders from the raikom (district committee) and ensure your labor pool works effectively for the good of the state.

You are not a hero. You are not a rebel. You are a middle manager in the most bureaucratic system ever devised. Your name is on a file in Moscow. That file accumulates black marks. Too many marks and you attract investigation. Investigation leads to a labor camp. The game ends.

**The Sweet Spot**: The ideal state is comfortable mediocrity. Excel too much and you get harder targets. Fail too badly and you get a mark on your file. The entire game is about navigating this impossible middle while your file slowly fills with notations.

## Settlement Evolution

Your settlement naturally progresses from a tiny rural kolkhoz to an industrial town to a full city. This progression is based on the **actual Soviet settlement classification system** — the state formally reclassifies your settlement when it crosses population and economic thresholds.

**Sources**: [Classification of inhabited localities in Russia](https://en.wikipedia.org/wiki/Classification_of_inhabited_localities_in_Russia), [Urban-type settlement](https://en.wikipedia.org/wiki/Urban-type_settlement), [Kolkhoz amalgamation](https://en.wikipedia.org/wiki/Kolkhoz)

### Settlement Status Tiers

| Status | Russian | Threshold | Era Range | What Changes |
|--------|---------|-----------|-----------|-------------|
| **Selo** (village) | село | Starting state | Era 1-2 | No bureaucracy. Selsoviet governs. Player is predsedatel kolkhoza. Just you and your peasants. |
| **Posyolok** (workers' settlement) | рабочий посёлок | 50+ workers, ≥1 factory or industrial building | Era 2-4 | First politruk arrives. Raikom pays attention. Player title: predsedatel. Industrial quotas begin. |
| **PGT** (urban-type settlement) | посёлок городского типа | 150+ workers, ≥50% in non-agricultural work, school + clinic | Era 4-6 | KGB station appears. Full quota system. Kolkhoz → sovkhoz conversion possible. Player title: direktor. |
| **Gorod** (city) | город | 400+ workers, ≥85% non-agricultural, multiple districts | Era 6-8 | Full city soviet. Multiple party committees. Bureaucratic overhead. Player title: glava administratsii. |

### Upgrade Triggers

Status upgrades happen **automatically** when all thresholds are met for 30 consecutive ticks (1 in-game month). The upgrade is announced with a ceremonial event:

```text
┌─────────────────────────────────────────┐
│     DECREE OF THE SUPREME SOVIET        │
│                                         │
│  By order of the Presidium, the selo    │
│  of [name] is hereby reclassified as    │
│  a WORKERS' SETTLEMENT (рабочий        │
│  посёлок) in recognition of its         │
│  productive contributions to the        │
│  Socialist cause.                       │
│                                         │
│  Comrade [player], you are now          │
│  Predsedatel of a Posyolok.             │
│                                         │
│  [+1 Commendation] [New buildings       │
│  unlocked] [New problems unlocked]      │
└─────────────────────────────────────────┘
```

### What Each Tier Unlocks

**Selo → Posyolok**:
- Unlocks: Factory, power station, party HQ, apartment block
- Unlocks: Orgnabor drain (state starts "borrowing" your workers for industry elsewhere)
- Bureaucracy: First politruk assigned permanently. Annual inspections begin.
- Quota change: Industrial production quotas added to agricultural ones.

**Posyolok → PGT**:
- Unlocks: KGB station, hospital, school, cinema, administrative center
- Unlocks: Conscription mechanic (military drafts from your settlement)
- Optional: Kolkhoz → sovkhoz conversion (workers get fixed wages instead of remainder shares — higher morale but higher state expectations)
- Bureaucracy: KGB presence constant. Multiple politruks. Inspections quarterly.
- Quota change: Quotas increase 30%. Construction mandates become more ambitious.

**PGT → Gorod**:
- Unlocks: University, monument, district subdivisions, full bureaucratic apparatus
- Unlocks: The Queue mechanic (consumer goods distribution becomes a problem at scale)
- Bureaucracy: Full party committee. Multiple KGB agents. Monthly inspections.
- Quota change: You now contribute to the national economy. Quotas are enormous. Failure = immediate attention.

### Downgrade Rules

If your population drops below a tier's threshold for 60 consecutive ticks (2 months), your settlement is **downgraded**. This is humiliating:

- -2 commendations
- Some buildings are shuttered (can't operate at lower tier)
- Reduced state support (fewer fondy)
- But also: reduced scrutiny (fewer politruks, lower quotas)

**Strategic implication**: A player might deliberately let population drop to avoid the bureaucratic overhead of a higher tier. The state doesn't like this.

### Visual Progression

The settlement's appearance evolves naturally with construction:
- **Selo**: Wooden buildings, dirt paths, forest clearing, a few structures
- **Posyolok**: Mix of wood and concrete. Factory chimney visible. Paved road to raion center.
- **PGT**: Predominantly concrete. Apartment blocks. Grid street layout. Power lines.
- **Gorod**: Prefab panel housing. Multiple districts. Monument in central square. Smoke from multiple factories.

---

## Core Loop

```text
┌───────────────────────────────────────────────────────┐
│                                                       │
│   STATE DEMANDS ──→ COLLECTIVE SELF-ORGANIZES         │
│        ↑                    │                         │
│        │                    ↓                         │
│   SURVIVE APPARATUS ←── YOU NAVIGATE THE MIDDLE       │
│        │                    │                         │
│        │                    ↓                         │
│        └──── INTERVENE ONLY WHEN YOU MUST ────────────┘
│                                                       │
└───────────────────────────────────────────────────────┘
```

The collective is a living organism. Workers wake up, walk to work, produce output, eat, sleep. They self-organize around collective goals. **You do not micromanage them.** You are the predsedatel — you set priorities, navigate political threats, and make survival decisions when the system breaks.

### Moment-to-Moment Gameplay

1. **Watch the settlement breathe** → workers auto-assign to jobs, paths form between buildings, production ticks
2. **Respond to state demands** → Moscow mandates 2 factories. The collective calculates what's needed (materials, workers, time) and starts building. You choose WHERE to place them.
3. **Navigate political survival** → commissar visits, KGB asks questions, military demands conscripts. Your answers determine your file.
4. **Make survival decisions** → divert workers to foraging when food runs low, allow black market trade behind your back, decide who to sacrifice when the state demands bodies
5. **Override when desperate** → force specific workers into specific tasks when the autonomous system isn't doing what you need. This costs political capital — the collective notices when the chairman meddles.

### What the Player DOES:

- **Choose WHERE to place mandated buildings** (the only direct spatial control)
- **Set collective priorities** when demands conflict (food vs quotas vs construction)
- **Navigate political conversations** with commissars, KGB, military
- **Make moral choices** — who to sacrifice, how much corruption to allow, when to lie
- **Override the collective** in emergencies (force assignment, divert resources)
- **Tap buildings to inspect and manage** — drill into any building to see who's inside, what it produces, and intervene

### What the Player Does NOT:

- Individually assign each worker to each building (the collective self-organizes)
- Choose which buildings to build (the 5-year plan mandates them)
- Draw roads (paths form automatically from worker movement)
- Fight anyone directly
- Have free-market trading (except the black market, at great risk)
- Control the political officers, KGB, or military — only endure them

---

## Autonomous Collective System

The settlement is not a set of passive buildings waiting for the player to click them. It is a **self-organizing collective** where workers make decisions based on a priority hierarchy.

### Why Soviet Simplifies Worker AI

In a capitalist sim, individual workers would need complex economic models: profit motivation, wage negotiation, career ambition, competitive behavior. **The Soviet system eliminates all of this.**

There is no individualism motivation (unless discontented). There is no profit motive. The Soviets designed their space ships so that literally anyone could fix them — will they come down safely? That's less of a priority. Workers don't optimize for personal gain. They fulfill their role in the collective or face consequences.

The only deviations from collective behavior are:
1. **Discontent** → when morale/loyalty drops, workers resist, shirk, or flee
2. **Survival instinct** → when starving/freezing, personal survival overrides collective duty
3. **Family bonds** → protecting children, caring for elderly, private plot tending

This means the worker AI is a **simple priority queue**, not a complex economic agent model.

### Worker Decision Priorities (Behavioral Governor)

Each tick, unassigned workers evaluate what to do based on this priority stack:

```
PRIORITY 1: Don't die
  → If starving: forage, hunt, tend private plot
  → If freezing: gather firewood, repair heating
  → If housing destroyed: shelter with family/neighbors

PRIORITY 2: Meet state demands (avoid black marks for the collective)
  → Mandated buildings need construction workers? Go build.
  → Quota shortfall? Shift to production.
  → Compulsory delivery deadline approaching? Increase output.

PRIORITY 3: Fulfill personal trudodni minimum
  → Each worker must earn their annual minimum or lose private plot rights
  → Workers self-assign to available job slots at buildings

PRIORITY 4: Improve the collective
  → Build non-mandated structures (storage, housing, services)
  → Repair decaying buildings
  → Train skills (if school exists)

PRIORITY 5: Private life
  → Tend private plot (food for family)
  → Domestic work (childcare, cooking — invisible labor)
  → Rest, vodka, social
```

The player **adjusts these priorities**, not individual assignments. Example:
- "All hands to the harvest" → bumps food production to Priority 1
- "Ignore the factory mandate for now" → drops construction to Priority 4 (risk: black mark)
- "Allow black market this month" → enables a hidden economy boost (risk: KGB investigation)

### Construction Planning

When Moscow mandates a building (or the player overrides to place one), the collective calculates:

```
STATE: "Build 1 Factory"

COLLECTIVE CALCULATES:
  Materials needed: 200 timber, 100 steel, 50 cement
  Materials in stock: 150 timber, 30 steel, 50 cement
  Shortfall: 50 timber, 70 steel

  Workers needed: 8 construction workers for 45 ticks
  Available idle workers: 12

  PLAN:
  1. Assign 4 workers to timber cutting (est. 15 ticks to gather 50)
  2. Request steel from fondy (next delivery in ~30 ticks)
  3. Begin foundation when timber arrives (8 workers, 45 ticks)
  4. Workers auto-return to previous jobs on completion
```

The player sees this plan and can:
- **Accept**: the collective proceeds autonomously
- **Reprioritize**: "Get the steel from the other factory's allocation" (risk: that factory underproduces)
- **Override**: manually assign specific workers, divert materials from storage
- **Delay**: "Not yet — we can't afford to pull workers from the harvest"

### Auto-Pathfinding & Roads

Workers walk between their housing and their workplace each day. The most-traveled routes become **visible dirt paths** on the ground layer. As traffic increases:

| Traffic Level | Visual | Era Upgrade |
|---------------|--------|-------------|
| Low (1-5 workers/day) | Faint worn grass | — |
| Medium (5-15 workers/day) | Clear dirt path | Gravel (Era 3+) |
| High (15+ workers/day) | Wide dirt road | Paved (Era 5+), Concrete (Era 7+) |

Paths are **emergent** — they appear because workers are walking, not because the player drew them. This is a visual cue that the settlement is alive.

### Why Larger Populations Work

With autonomous workers, historically accurate populations (10-15 households, 50-90 people) are manageable because:

1. **No micromanagement**: Workers self-assign. The player doesn't click each one.
2. **Political pressure scales**: With 150 people and one commissar, you have plenty to do just making sure you don't become responsible for anything your collective does.
3. **Moral weight scales**: Every conscription event means choosing whose father doesn't come home. With 15 people it's abstract. With 90, it's agonizing.
4. **The system self-regulates**: You set priorities; the collective organizes. You intervene only when necessary.
5. **Emergent gameplay**: The system runs itself until it doesn't — a bad harvest, a fire, a purge. Then you're scrambling.
