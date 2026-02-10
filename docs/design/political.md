# Political Apparatus — What You're Surviving

The three forces you cannot control, only endure. Plus: your personnel file — the game's central tension mechanic.

---

## Your File (Личное Дело)

Your personnel file is the game's fail-state meter. It replaces health bars, population thresholds, and other city-builder death conditions.

### Black Marks

| Source | Marks | Notes |
|--------|-------|-------|
| Worker arrested for disloyalty | +1 | Your collective bred disloyalty |
| Quota missed by 10-30% | +1 | Underperformance |
| Quota missed by 30-60% | +2 | Significant failure |
| Quota missed by >60% | +3 | Catastrophic failure |
| Construction mandate not met | +1 per building | Failed to build what was ordered |
| Conscription not met | +2 | Defying the military |
| Black market caught | +2 | Corruption |
| Caught lying to KGB | +2 | Cover-up |
| Stakhanovite exposed as fraud | +1 | Falsifying reports |
| Blat transaction noticed | +1 | Informal economy |
| Suppressing good news | +1 | Burying a Stakhanovite event |

### Commendations (Offset Marks)

| Source | Commendation | Notes |
|--------|-------------|-------|
| Quota exceeded | +1 | But next quota is raised 20-40% |
| Stakhanovite celebrated | +1 | But quota consequences |
| Factory repair (minigame success) | +0.5 | Small recognition |
| Inspection passed | +0.5 | Inspector satisfied |
| Ideology session: all pass | +0.5 | Politically reliable collective |

### Threshold Effects

| Marks | Effect |
|-------|--------|
| **0-2** | Normal operations. You're unremarkable. This is the goal. |
| **3** | Increased politruk presence. More frequent loyalty checks. |
| **4** | Warning from raikom. Advisor dialog: "Comrade, Moscow is noticing you." |
| **5** | KGB investigation begins. Agents arrive. Workers can be taken randomly. |
| **6** | Formal review. Inspection minigame triggered automatically. |
| **7+** | Arrest. Game over (or rehabilitation, depending on consequence setting). |

### Mark Decay

- Marks decay at 1 per N in-game years (N depends on difficulty):
  - Worker: 1 mark / 1 year
  - Comrade: 1 mark / 2 years
  - Tovarish: 1 mark / 4 years
- Decay only happens if no new marks are added during the period
- Era transitions reset marks to 2 (not zero — the file follows you)

### Net Mark Calculation

`effective_marks = black_marks - commendations`

Commendations are permanent and offset marks, but they don't remove marks from the file — they add positive entries. A file with 5 marks and 3 commendations has effective_marks = 2 (safe), but if you get 2 more marks without any commendations, you're at 4 (dangerous).

---

## The Three Arms of the Apparatus

### Politruks (Red) — The Eyes

**Function**: Political officers assigned to your collective from above. They hold ideology sessions, conduct loyalty checks, and report findings upward.

**Arrival**: Politruks are assigned based on your collective's political profile.
- Base ratio: 1 politruk per ~20 workers
- Doctrine modifier: Freeze = 1 per 8. Thaw = 1 per 50.
- Black mark escalation: At 3+ marks, additional politruks arrive
- Difficulty modifier: Worker = 1 per 40, Tovarish = 1 per 8

**Behavior each tick**:
1. Politruk selects a building to "visit"
2. Workers in that building are pulled off production for ideology session (N ticks)
3. Each worker's loyalty is checked against a threshold
4. Workers below threshold are "flagged" — noted in the politruk's report
5. Flagged workers become KGB targets

**Player interaction**:
- You can't stop ideology sessions, but you CAN choose which workers attend (assign your least productive workers to buildings the politruk is visiting)
- Workers who repeatedly skip sessions get flagged faster
- Politruks consume food and housing but produce nothing
- A well-timed vodka ration before a session boosts loyalty scores temporarily

**Politruk personality** (procedurally generated):
- **Zealous**: Checks more often, lower loyalty threshold, harder to satisfy
- **Lazy**: Checks less often, higher threshold, can be bribed (blat)
- **Paranoid**: Random checks on high-loyalty workers too — nobody is safe
- **Corrupt**: Will accept bribes to write favorable reports (blat cost, KGB risk)

### KGB / FSB (Black) — The Fist

**Function**: Security apparatus that acts on politruk reports and its own suspicion.

**Arrival triggers**:
- Politruk reports N flagged workers → KGB arrives after 5-10 ticks
- Black marks reach 5+ → permanent KGB presence
- Random (low probability) during high-paranoia eras
- Zealot leader in power → KGB activity doubles
- During Freeze doctrine → KGB always present

**Behavior**:
1. KGB agent arrives (visible black-outfit figure on map)
2. After 3-5 ticks of "investigation," agent selects a target
3. Target is usually a flagged worker, but during paranoia spikes, targets skilled workers
4. Target **disappears** — no trial, no announcement, just gone next tick
5. Remaining workers' morale drops. Fear rises.
6. +1 black mark on your file (your collective produced a disloyal element)

**Player interaction**:
- You see the agent arrive and know someone will disappear
- You can try to "sacrifice" low-value workers by ensuring they have the lowest loyalty scores (manipulate who attends sessions, who gets vodka)
- KGB agents occasionally take your BEST workers (skill-based targeting during paranoia) — this is devastating and unfair. That's the point.
- Interrogation minigame (tap KGB HQ): deflect investigation, implicate someone, or get caught lying

**The Informant Network** (Freeze doctrine):
- KGB asks you to designate informants in each building
- Informants report on coworkers: their loyalty scores rise, everyone else's drops
- At >60% coverage, workers start false-reporting each other
- Paranoia spiral → more KGB visits → more disappearances → more marks

### Military (Green) — The Drain

**Function**: Conscription demands that pull workers regardless of collective impact.

**Conscription orders**:
- Arrive as events with a deadline (N ticks to comply)
- Specify a percentage of population (8-40%, set by doctrine)
- YOU choose which workers to send (the one point of agency)
- Non-compliance → military arrives and takes workers randomly (always your best)

**Era-specific behavior**:
- Revolution: small militia obligations, workers may return
- Collectivization: minimal conscription
- Industrialization: moderate (8-15%)
- Wartime: massive (30-40%), factory conversion
- Reconstruction: veterans RETURN (influx of workers, but traumatized)
- Thaw: low (5-8%)
- Stagnation: moderate (10-15%)
- Eternal: arbitrary and absurd (20% conscripted, no one knows why)

**Riot suppression**: If worker morale drops below 15 across the collective, riots can trigger. Military is called in automatically — workers are detained, production halts, +2 black marks.

---

## Reporting & Pripiski — The Player's Weapon

The player's primary tool for managing the apparatus is **reporting** — how you present your collective's performance to the raikom. Historically, **pripiski** (приписки — literally "add-ons") was the endemic falsification of statistics at every level of Soviet administration. Kolkhoz chairmen routinely padded output figures, sold the same grain to the state twice, or simply invented harvest numbers when reality fell short.

**Source**: [Pripiski - Global Informality Project](https://www.in-formality.com/wiki/index.php?title=Pripiski_(USSR)), [Soviet Managers and Accounting Fraud](https://warwick.ac.uk/fac/soc/economics/staff/mharrison/public/jce2011postprint.pdf)

### The Annual Report

Every in-game year, the player submits an **annual report** to the raikom. This is a key decision point:

```
┌─────────────────────────────────────────┐
│       ANNUAL REPORT TO RAIKOM           │
│                                         │
│  GRAIN OUTPUT:                          │
│    Actual: 3,200 tonnes                 │
│    Quota:  5,000 tonnes                 │
│    ──────────────────                   │
│    Report as: [3,200] [4,000] [4,800]   │
│                                         │
│  INDUSTRIAL OUTPUT:                     │
│    Actual: 1,800 units                  │
│    Quota:  2,000 units                  │
│    ──────────────────                   │
│    Report as: [1,800] [2,000] [2,200]   │
│                                         │
│  POPULATION:                            │
│    Actual: 187                          │
│    Report as: [187] [165] [200]         │
│                                         │
│  [Submit Honest Report]                 │
│  [Submit Padded Report] ⚠               │
│  [Submit Deflated Report] ⚠             │
│                                         │
└─────────────────────────────────────────┘
```

### Three Reporting Strategies

**1. Honest Reporting**
- Report actual numbers. If you're below quota, you take the marks.
- +0 risk. The system works as designed.
- If you're at 90%+ of quota, this is usually the best strategy (only -1 mark for 10-30% miss).

**2. Pripiski (Padding / Inflating)**
- Report higher numbers than actual. Claim you produced 4,800 tonnes when you only produced 3,200.
- **Benefit**: Avoid quota failure marks. May even earn commendations for "exceeding" quota.
- **Risk**: Inspector visits can expose the fraud. Risk scales with padding amount:
  - Padding <10%: 15% chance of detection per inspection
  - Padding 10-30%: 40% chance of detection per inspection
  - Padding >30%: 70% chance of detection
- **If caught**: +3 black marks (worse than just missing the quota honestly). KGB investigation. Scandal.
- **Compounding problem**: If you report 4,800 and quota for next plan is based on that number (+20%), you now need to produce 5,760 or pad even MORE. The lie snowballs.

**3. Deflation (Underreporting)**
- Report LOWER numbers. Hide surplus from the state.
- **Why?**: Lower reported output → lower next quota. Build a secret stockpile.
- **Benefit**: Future quotas are lower. Emergency food reserves grow. More remainder for workers.
- **Risk**: If inspectors find your hidden stockpile → +2 marks ("hoarding state property"). Inspectors check granary capacity vs. reported output.
- **When useful**: When you know an era of high demand is coming (War, Freeze) and want reserves.

### Population Reporting

- **Underreport population**: Fewer reported workers → lower conscription quotas, lower expected output. But inspectors can count heads.
- **Overreport population**: Claim more workers → more fondy allocations, more rations from the state. But you have to account for them in the labor rolls.

### Bribery as Reporting Insurance

Blat spent on the raikom chairman reduces inspection frequency:

| Blat Spent | Effect | Duration |
|-----------|--------|----------|
| 5 blat | Next inspection delayed 30 ticks | One-time |
| 10 blat | Inspector given a "tour" of your best buildings only | One inspection |
| 20 blat | Raikom chairman files YOUR report without reading it | One year |
| 30 blat | Raikom chairman co-signs your pripiski (you're both in on it) | One year, but if caught → both fall |

### The Inspection Minigame (triggered by inspector arrival)

When an inspection happens, the Inspection minigame launches. Performance depends on how much pripiski you've done:
- **Honest books**: Inspector finds nothing wrong. Easy pass.
- **Light padding**: Papers, Please-style document review. Present the right reports, hide the wrong ones.
- **Heavy padding**: Frantic cover-up. Move grain from one warehouse to another before the inspector gets there. Divert his attention to the model farm.
- **Co-signed pripiski**: If the raikom chairman is in on it, inspection is auto-pass (but if a NATIONAL auditor comes, you both go down).

---

## National → Local Political Connection

The PolitburoSystem models national-level politics (general secretaries, coups, purges, doctrine shifts). But how does Moscow's chaos reach your kolkhoz?

### Transmission Mechanisms

| National Event | Local Effect |
|----------------|-------------|
| **New General Secretary** | Doctrine change. New quotas. Politruks reshuffled. 5-10 ticks of chaos. |
| **Coup attempt (successful)** | All ongoing plans paused. New mandates arrive. Purge of "enemies" — random workers flagged. +1 mark (guilt by association). |
| **Coup attempt (failed)** | Fear spikes. KGB presence doubled for 20 ticks. Loyalty checks intensified. |
| **Purge wave** | N workers disappear regardless of loyalty. Historical: Great Terror took people at random. |
| **Doctrine shift (e.g., Thaw → Freeze)** | Policies change over 10 ticks. Buildings may be banned/unbanned. Quota adjustments. |
| **Leader death** | Succession crisis: 10-20 ticks of uncertainty. No new orders, but no deliveries either. Stockpile period. |
| **De-[Name]-ization** | Previous leader's legacy dismantled. Monuments renamed. Some buildings repurposed. |

### The Raikom (District Committee)

The raikom is your immediate superior — the buffer between Moscow and your collective. The raikom chairman is a procedurally generated character who:
- Relays orders from Moscow (sometimes late, sometimes garbled)
- Can be bribed (blat) to reduce quota targets or delay inspections
- Has their own personality (zealous, corrupt, lazy, paranoid)
- Can be replaced during political upheaval (new raikom chairman = new relationship to build)
- Occasionally visits for inspection (triggers Inspection minigame)
