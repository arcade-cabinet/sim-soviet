---
title: Overview — Game Identity & Core Loop
status: Complete
last_verified: 2026-02-10
coverage: "Full — core loop, ECS architecture, Canvas 2D rendering, all subsystems wired"
---

# Overview — Game Identity & Core Loop

## Game Identity

**Genre**: Worker-management survival sim with isometric city-building
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
┌──────────────────────────────────────────────────────┐
│                                                      │
│   ASSIGN WORKERS ──→ PRODUCE OUTPUT                  │
│        ↑                    │                        │
│        │                    ↓                        │
│   SURVIVE APPARATUS ←── COMPULSORY DELIVERIES        │
│        │                    │                        │
│        │                    ↓                        │
│        └──── 5-YEAR PLAN (quotas + mandates) ────────┘
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Moment-to-Moment Gameplay

1. **Tap a worker (or group)** → worker/group highlights
2. **Tap a building or zone** → workers assigned to that task
3. **Watch production tick** → output accumulates, state takes its cut
4. **Respond to events** → political officers arrive, military drafts workers, KGB takes someone
5. **Manage the impossible** → too few workers for too many demands, constantly triaging

### The Player Does NOT:
- Choose which buildings to build (the 5-year plan mandates them)
- Choose WHERE to build (the player DOES choose this)
- Fight anyone directly
- Have free-market trading (except the black market minigame, at great risk)
- Control the political officers, KGB, or military — only endure them
