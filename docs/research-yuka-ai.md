# Yuka AI Library — Capabilities Research

## Summary

Yuka v0.7.8 is an excellent fit for the Leadership System. It provides composable behavioral AI primitives that map directly to procedural Soviet leader generation.

## Key Capabilities for Leader AI

### 1. Goal-Driven Architecture (Think + GoalEvaluator)
The `GoalEvaluator.characterBias` field is the core mechanism for personality-driven decisions:
```typescript
class GoalEvaluator<T extends GameEntity> {
  characterBias: number  // Personality trait multiplier (0..1)
  calculateDesirability(owner: T): number  // Returns 0..1 score
  setGoal(owner: T): void
}

class Think<T> extends CompositeGoal {
  evaluators: GoalEvaluator[]
  arbitrate(): this  // Picks highest-desirability evaluator, sets that goal
}
```
Each leader archetype is a set of evaluators with different characterBias values. A Zealot has high bias on PurgeEvaluator, low on ReformEvaluator. A Reformer has the inverse.

### 2. State Machine (StateMachine + State)
Leaders have public behavioral states:
```typescript
StateMachine<T extends GameEntity> {
  currentState, previousState, globalState
  changeTo(id: string), revert()
}
State<T> {
  enter(owner), execute(owner), exit(owner), onMessage(owner, telegram)
}
```
States: Rally, Consolidate, Purge, Crisis, Paranoia, Reform, Stagnate

### 3. Fuzzy Logic (FuzzyModule)
For nuanced decisions that aren't binary:
```typescript
FuzzyModule {
  fuzzify(name, crisp_value): void
  defuzzify(name, type?): number
}
```
Example: IF Frustration is High AND Support is Weak THEN ActionIntensity is VeryHigh

Available fuzzy set types: Triangular, LeftShoulder, RightShoulder, NormalDist, SCurve, Singleton

### 4. Perception & Memory
```typescript
MemorySystem { memorySpan, records: MemoryRecord[] }
Vision { fieldOfView, range }
```
Leaders track rivals, remember grudges, forget old intelligence over time.

### 5. Message Passing (Telegram + MessageDispatcher)
Inter-leader communication for alliances, threats, negotiations:
```typescript
leader1.sendMessage(leader2, "PROPOSE_ALLIANCE", delay, extraData)
// Received in state.onMessage() or goal.handleMessage()
```

### 6. Steering Behaviors (13 built-in)
For "political movement" — seeking allies, fleeing rivals, wandering:
Seek, Flee, Pursuit, Evade, Wander, Arrive, Separation, Alignment, Cohesion, FollowPath, Interpose, OffsetPursuit, ObstacleAvoidance

### 7. Full JSON Serialization
All components (entities, FSMs, goals, fuzzy modules, steering) support toJSON()/fromJSON() — essential for save/load.

## Recommended Leader Entity Structure

```
SovietLeader (extends Vehicle)
├── Traits (characterBias values for each GoalEvaluator)
├── StateMachine (public behavior phases: Rally, Purge, Reform, Crisis)
├── Think (goal arbitration with trait-biased evaluators)
│   ├── PurgeEvaluator (bias = traits.authoritarianism)
│   ├── ReformEvaluator (bias = traits.pragmatism)
│   ├── ConsolidateEvaluator (bias = traits.paranoia)
│   ├── ExpandEvaluator (bias = traits.ambition)
│   └── IdeologicalPurityEvaluator (bias = traits.idealism)
├── FuzzyModule (nuanced loyalty/threat/reform decisions)
├── MemorySystem (political memory — grudges, alliances)
└── SteeringManager (political positioning)
```

## Integration with Existing Code

- `src/ai/CitizenClasses.ts` already has behavioral profiles with 20+ numerical modifiers and distribution system — extends naturally to leader traits
- Goal evaluator biases map to archetype definitions
- FSM states map to "phases" of a leader's tenure
- Fuzzy logic handles the gray areas (when to purge vs when to reform)
- Memory system handles succession grudges and political history

## Key Yuka Files
- Goal system: `yuka/src/goal/`
- State machines: `yuka/src/fsm/`
- Steering: `yuka/src/steering/`
- Fuzzy logic: `yuka/src/fuzzy/`
- Perception: `yuka/src/perception/`
- Core entities: `yuka/src/core/`
