# Scoring, Difficulty & Permadeath

## Structure: Civilization-Style

The game accumulates a running score across all 8 eras. If you survive without being thrown in a labor camp, you receive the medal and can continue playing.

---

## Score Sources

| Source | Points | Notes |
|--------|--------|-------|
| Workers alive at era end | +2 each | Rewarding population |
| Quotas met | +50 each | Per-quota bonus |
| Quotas exceeded | +25 | But next quota raised 20-40% |
| Buildings standing | +5 each | Infrastructure |
| Commendations earned | +30 each | Good marks on file |
| Black marks on file | -40 each | Penalty per mark |
| Workers lost to KGB/purge | -10 each | Human cost |
| Workers conscripted | -5 each | Drain |
| Era completed without investigation | +100 | Clean era bonus |

**Era multiplier**: Later eras are worth more (Era 1: x1.0, Era 8: x3.0).

---

## New Game Flow

```
┌─────────────────────────────────────────────┐
│           NEW GAME — YEAR 1917              │
│                                             │
│   DIFFICULTY                                │
│   ┌───────────┬───────────┬───────────┐     │
│   │  WORKER   │  COMRADE  │  TOVARISH │     │
│   │  (Easy)   │ (Normal)  │  (Hard)   │     │
│   └───────────┴───────────┴───────────┘     │
│                                             │
│   CONSEQUENCES                              │
│   ┌───────────┬───────────┬───────────┐     │
│   │ FORGIVING │    ☠      │  HARSH    │     │
│   │           │ PERMADEATH│           │     │
│   └───────────┴───────────┴───────────┘     │
│                                             │
│   MAP SIZE                                  │
│   ┌───────┬───────┬───────┐                 │
│   │ Small │  Med  │ Large │                 │
│   └───────┴───────┴───────┘                 │
│                                             │
│   SEED: [autumn-tractor-287]  [randomize]   │
│                                             │
│              [ BEGIN ]                       │
└─────────────────────────────────────────────┘
```

---

## Difficulty Levels

| Setting | Quotas | Mark Decay | Politruk Ratio | KGB Aggression | Growth Rate | Winter |
|---------|--------|-----------|----------------|----------------|-------------|--------|
| **Worker** | 0.6x | 1/year | 1:40 | Low | 1.5x | Shorter |
| **Comrade** | 1.0x | 1/2 years | 1:20 | Medium | 1.0x | Standard |
| **Tovarish** | 1.5x | 1/4 years | 1:8 | High | 0.7x | Longer |

---

## Consequence Levels

### Forgiving — "Replaced by an Idiot"
- Return after 1 year, 90% buildings, 80% workers, 50% resources
- Black marks reset to 1. Score: -100.

### Permadeath — "The File Is Closed"
- Stamped "ВРАГ НАРОДА." No return. Restart era.
- Score multiplier: x1.5 for all points earned.

### Harsh — "The Village Is Evacuated"
- Return after 3 years, 40% buildings, 25% workers, 10% resources
- Black marks reset to 2. Score: -300.

---

## Score Multipliers

| Setting | Multiplier |
|---------|-----------|
| Worker + Forgiving | x0.5 |
| Worker + Permadeath | x1.0 |
| Comrade + Forgiving | x0.8 |
| Comrade + Permadeath | x1.5 |
| Comrade + Harsh | x1.2 |
| Tovarish + Forgiving | x1.0 |
| Tovarish + Permadeath | x2.0 |
| Tovarish + Harsh | x1.8 |

---

## End of Game

**Medal ceremony**: Complete all 8 eras → "Medal of the Order of the Soviet Union, Third Class." A bored bureaucrat hands you a small pin. Score displayed.

**One More Turn**: Continue in The Eternal era for no further points. Absurdist events escalate.

**Game over screen**: Personnel file displayed with every mark annotated.
*"Chairman [Name] was reassigned to a facility in Norilsk. No further correspondence is expected."*
