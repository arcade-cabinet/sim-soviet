---
title: "Yuka ChairmanBrain — AI Governor + Turbo Speed + E2E Playthrough"
type: plan
status: active
plan_status: in-progress
date: 2026-03-01
---

# Yuka ChairmanBrain — AI Governor + Turbo Speed + E2E Playthrough

## Problem

SimSoviet needs an autonomous AI governor that can run the game without player input, serving two purposes:
1. **In-game autopilot** — "Comrade Advisor" mode where the AI makes all player decisions
2. **E2E validation** — 200-year playthroughs (1917→2117) that validate game balance across difficulty levels

## Design Decisions

- **Yuka v0.7.8** goal-driven AI library (GoalEvaluator + Think + FuzzyModule)
- **Single brain entity** (ChairmanBrain) — one Yuka Vehicle handles all player decisions
- **Turbo speed mode** — speeds 4 (10x) and 5 (100x) added to the actual game
- **Per-difficulty success thresholds** — Worker: 95%, Comrade: 75-85%, Tovarish: 40-60%
- **In-game feature** — not test-only; players can enable autopilot

## Architecture

### ChairmanBrain (Yuka Vehicle)

```
ChairmanBrain (extends Vehicle)
├─ GoalEvaluator
│   ├─ SurvivalGoal (food/housing survival)
│   ├─ QuotaGoal (5-year plan fulfillment)
│   ├─ PoliticalGoal (mark management, minigames, reports)
│   ├─ GrowthGoal (settlement expansion)
│   └─ DefenseGoal (fire/meteor/disease emergency response)
├─ Think (state machine for goal arbitration)
│   ├─ AssessState — evaluate game state, fuzzy inputs
│   ├─ PlanAction — arbitrate goals, select highest desirability
│   └─ ExecuteAction — apply decision
└─ FuzzyModule
    ├─ foodUrgency (LeftShoulder/Triangular/RightShoulder)
    ├─ politicalRisk (marks vs threshold)
    └─ growthPotential (housing vacancy + resource surplus)
```

### Goal Evaluators

| Goal | What It Decides | Key Inputs |
|---|---|---|
| SurvivalGoal | CollectiveFocus → "food" when starving | food/capita, season, population trend |
| QuotaGoal | CollectiveFocus → "construction" or "production" near deadlines | quota progress %, time remaining in plan |
| PoliticalGoal | Minigame choices, annual report strategy, bribery | black marks, commendations, blat, KGB aggression |
| GrowthGoal | CollectiveFocus → "balanced" when stable | housing utilization, population trend, resources |
| DefenseGoal | Emergency response focus when crises active | active fires, meteor impacts, disease outbreaks |

### Decision Logic

**Minigame Resolution**: Each MinigameChoice has `successChance`, `onSuccess`, `onFailure`. PoliticalGoal calculates expected value: `EV = successChance × onSuccess + (1-successChance) × onFailure`. Picks choice that maximizes `EV(commendations + blat) - EV(blackMarks)`, weighted by current political risk fuzzy value.

**Annual Report Strategy**:
- `quotaMet >= 100%` → honest report (safe, earns commendations)
- `quotaMet 60-100%` → falsify if political risk is low (risk marks for better score)
- `quotaMet < 60%` → honest (falsification too risky when gap is obvious)

**Directive Selection** (via CollectiveFocus):
- Food crisis → "food" (All Hands to Harvest)
- Near quota deadline with shortfall → "construction" (Fulfill the Plan!)
- Stable with surplus → "balanced" (Balanced Operations)
- Production gap → "production" (Maximize Output)

### Turbo Speed Mode

| Level | Speed | UI Button | Use Case |
|---|---|---|---|
| 0 | Pause | ‖ | Existing |
| 1 | 1x | ▶ | Existing |
| 2 | 2x | ▶▶ | Existing |
| 3 | 3x | ▶▶▶ | Existing |
| 4 | 10x | ⏩ | Fast-forward through quiet periods |
| 5 | 100x | ⏩⏩ | Turbo — skip to next event/year |

**Implementation**: The game loop (`useGameLoop.ts`) accumulates time. At high speeds, multiple `engine.tick()` calls execute per frame. Rendering frequency is reduced at turbo speeds (render every Nth frame) to prevent GPU bottleneck.

**Modal pausing**: Minigames/modals still pause simulation at turbo speed. ChairmanBrain auto-resolves them instantly when autopilot is enabled.

## E2E Playthrough Test

### Flow

```
1. Start new game (per-difficulty)
2. Enable ChairmanBrain autopilot
3. Set speed to turbo (100x)
4. Every year boundary:
   - Brief pause for React re-render
   - Screenshot → e2e/screenshots/{difficulty}-{seed}/{year}.png
   - Log: population, food, era, buildings, marks
5. Verify sustainability checkpoints:
   - Year 5: population > starting
   - Year 20: settlement tier > selo
   - Year 50: has entered era 3+
   - Year 100: population > 200
   - Year 200: still alive (game not over)
6. Record final score
```

### Per-Difficulty Matrix

| Difficulty | Runs | Pass Threshold | Timeout/Run |
|---|---|---|---|
| Worker | 5 | 95% (≥5/5) | 5 min |
| Comrade | 10 | 75% (≥8/10) | 5 min |
| Tovarish | 10 | 40% (≥4/10) | 5 min |

### Screenshots

`e2e/screenshots/{difficulty}-{seed}/{year}.png` — organized by run seed for reviewing visual progression of each playthrough.

## File Structure

```
src/ai/
├── ChairmanBrain.ts        # Yuka Vehicle + GoalEvaluator + Think + FuzzyModule
├── goals/
│   ├── SurvivalGoal.ts     # Food/housing survival evaluator
│   ├── QuotaGoal.ts        # 5-year plan quota evaluator
│   ├── PoliticalGoal.ts    # Mark management, minigame/report decisions
│   ├── GrowthGoal.ts       # Settlement expansion evaluator
│   └── DefenseGoal.ts      # Emergency response evaluator
├── fuzzy/
│   └── ChairmanFuzzy.ts    # Fuzzy linguistic variables + rules
└── decisions/
    ├── MinigameDecider.ts   # Expected-value minigame choice picker
    └── ReportDecider.ts     # Annual report strategy
```

## Integration Points

- **SimulationEngine**: Optional `chairmanBrain` field. When set, `think()` called each tick. Minigame/report callbacks delegate to brain.
- **App.web.tsx**: Autopilot toggle. When enabled, creates ChairmanBrain and passes to engine.
- **GameInitOptions**: `autopilot: boolean` flag.
- **useGameLoop.ts**: Support speeds 4 (10x), 5 (100x) with multi-tick-per-frame batching.
- **TopBar.tsx**: Turbo speed buttons (⏩, ⏩⏩).
- **Save/Load**: ChairmanBrain serializes via Yuka's `toJSON()`/`fromJSON()`.

## YAGNI Exclusions

- No multi-entity collective (single brain suffices)
- No steering behaviors (Chairman doesn't move)
- No perception system (Chairman has full game state access)
- No message passing (single entity)
- Fuzzy module limited to 3 variables (expandable later)
- No Yuka Memory system yet (can add for grudge tracking later)
