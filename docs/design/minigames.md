---
title: Minigames — Building & Tile Triggered
status: Complete
implementation: src/game/minigames/MinigameRouter.ts
tests: src/__tests__/MinigameRouter.test.ts
last_verified: 2026-02-10
coverage: "Full — 8 minigames, trigger routing, auto-resolve fallback"
---

# Minigames — Building & Tile Triggered

Minigames are triggered by tapping specific buildings or terrain features. They pause the simulation, spawn a modal, and run for 30-90 seconds.

---

## Trigger System

| Tap Target | Minigame | Condition |
|-----------|----------|-----------|
| KGB Station | Interrogation | Investigation event active |
| Black Market (hidden) | Trading | Appears in later eras |
| Forest tile | The Hunt | Workers assigned to foraging |
| Mountain tile | Mining Expedition | Workers assigned to mining |
| Factory (breakdown) | Repair | Breakdown event active (smoke/sparks) |
| Party HQ | Ideology Session | Politruk event active |
| Building with queue | Queue Management | Resource distribution backlogged |
| Barracks | Conscription Selection | Conscription order active |

### Rules
- **Pause**: Simulation pauses during minigames
- **Cooldowns**: Each minigame has a per-building cooldown (e.g., Hunt: 30 ticks between plays per tile)
- **Scaling**: Difficulty increases with era (e.g., Ideology Session questions get harder)
- **Optional**: Minigames are never mandatory — the event resolves automatically if you don't tap (usually with a worse outcome)

---

## 12.1 The Queue

**Trigger**: Tap a building with visible queue.
**Duration**: 45 seconds.
**Gameplay**: Citizens in line. Shuffle people, distribute rations, manage line-cutters. A politruk watches — maintain order without force (force attracts KGB).
**Reward**: Efficient queue → morale +10 for that building's workers.
**Penalty**: Fights break out → morale -15, KGB arrives, +1 mark.

## 12.2 Ideology Session

**Trigger**: Tap Party HQ during politruk event.
**Duration**: 60 seconds.
**Gameplay**: Multiple-choice Soviet ideology exam. Coach workers on "correct" answers before the session. Questions get harder in later eras.
**Reward**: All pass → politruk leaves, loyalty +10, +0.5 commendation.
**Penalty**: Failures → workers flagged, +1 mark if too many fail.

## 12.3 The Inspection

**Trigger**: Inspector arrives (tap inspector character).
**Duration**: 90 seconds.
**Gameplay**: Papers, Please-style. Present reports, falsify numbers (risk), show model buildings. Inspector asks questions.
**Reward**: Pass → quota deadline extended, +0.5 commendation.
**Penalty**: Fail → +1-2 marks depending on severity.

## 12.4 Conscription Selection

**Trigger**: Tap barracks during conscription order.
**Duration**: 60 seconds.
**Gameplay**: Workers lined up with stats. Select N to send. Real-time impact display. Timer = compliance deadline.
**Reward**: Strategic picks preserve production. Timely compliance = no marks.
**Penalty**: Non-compliance → military takes workers randomly (always your best), +2 marks.

## 12.5 The Black Market

**Trigger**: Tap shadowy alley tile or hidden market.
**Duration**: 45 seconds.
**Gameplay**: Barter goods at black market rates. KGB-risk meter fills as you trade. Stop before it maxes out.
**Reward**: Desperately needed resources at inflated rates.
**Penalty**: Caught → workers taken, rubles confiscated, +2 marks.

## 12.6 Factory Floor Emergency

**Trigger**: Tap factory during breakdown event.
**Duration**: 30 seconds.
**Gameplay**: Timing-based repair. Match tool to pipe/gear. Fix before pressure gauge hits red.
**Reward**: Production continues, +0.5 commendation.
**Penalty**: Building damaged, workers injured, production halted.

## 12.7 The Hunt (Forest/Mountain)

**Trigger**: Tap forest or mountain tile with workers assigned.
**Duration**: 60 seconds.
**Gameplay**: Oregon Trail-style. Side-scrolling birch forest or snowy mountain. Single-shot rifle, 3-5 shots. Animals are scarce.
- **Forest**: Rabbits, birds, mushroom gathering (tap to collect)
- **Mountain**: Goats, wolves (can injure hunter), mineral deposits
- **Winter**: Almost nothing alive. Hunter freezes over time.
**Reward**: Small food/material bonus.
**Penalty**: Hunter injured → worker out for 10 ticks. Frostbite → permanent stat reduction.
**Tone**: Desperate subsistence. Grey forest. Old rifle. Thin animals.

## 12.8 Interrogation

**Trigger**: Tap KGB HQ during investigation event.
**Duration**: 90 seconds.
**Gameplay**: You are questioned. Multiple-choice dialog. KGB officer asks about discrepancies, suspicious workers, black market knowledge.
- **Deflect**: Investigation closed, no marks.
- **Implicate a worker**: Worker disappears, your file stays clean (moral cost).
- **Get caught lying**: +2 marks, increased KGB presence.
**Tone**: A desk. A lamp. A man in black. Claustrophobic.
