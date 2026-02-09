# Power Transition Mechanics -- Game Design Spec

---

## 1. Architecture Integration

The power transition system integrates with the existing codebase as follows:

- **New module**: `src/game/LeadershipSystem.ts` -- the core state machine, probability engine, and transition orchestrator
- **New module**: `src/game/PolitburoState.ts` -- models the Politburo, factions, loyalty networks, and KGB/military institutions
- **New ECS component**: `LeaderComponent` on the resource store singleton entity in `src/ecs/world.ts`
- **Hooks into**: `SimulationEngine.tick()` for per-tick evaluation, `EventSystem` for transition event generation, `PravdaSystem` for announcement headlines, `SimCallbacks` for advisor/toast/pravda delivery
- **New game store fields**: leader snapshot, politburo snapshot, transition phase, fear level -- surfaced via `GameSnapshot` in `src/stores/gameStore.ts`

---

## 2. Core Data Structures

### 2.1 Leader

```typescript
interface Leader {
  id: string;
  name: string;
  patronymic: string;
  surname: string;
  archetype: LeaderArchetype;
  age: number;                    // years, starting 45-70
  yearsInPower: number;
  approval: number;               // 0-100
  health: number;                 // 0-100; below 20 triggers "health reasons" vulnerability
  paranoia: number;               // 0-100; affects purge severity
  ambition: number;               // 0-100; affects policy aggressiveness
  
  // Governance modifiers (multipliers on base rates)
  productionModifier: number;     // 0.5 - 1.5
  corruptionModifier: number;     // 0.5 - 2.0
  fearModifier: number;           // 0.5 - 2.0
  reformTendency: number;         // 0.0 - 1.0 (0 = hardliner, 1 = reformer)
  
  // Legacy
  buildingsRenamed: string[];     // building IDs renamed after this leader
  policiesEnacted: PolicyId[];
  wasErased: boolean;             // true if successor used "Mysterious Disappearance" or damnatio memoriae
}

enum LeaderArchetype {
  ZEALOT       = 'zealot',        // Ideological purist, high fear, low corruption
  APPARATCHIK  = 'apparatchik',   // Bureaucratic survivor, moderate everything
  REFORMER     = 'reformer',      // Tries to change things, gets "health reasons'd"
  STRONGMAN    = 'strongman',     // Military background, high fear, builds gulags
  MYSTIC       = 'mystic',        // Unpredictable, absurdist events spike
  GERIATRIC    = 'geriatric',     // Very old, very slow, nothing changes
}
```

### 2.2 Politburo

```typescript
interface PolitburoMember {
  id: string;
  name: string;
  role: PolitburoRole;
  faction: Faction;
  loyalty: number;      // 0-100, loyalty to CURRENT leader
  ambition: number;     // 0-100
  competence: number;   // 0-100 (affects policy effectiveness if they become leader)
  alive: boolean;       // false = purged or "retired"
  yearsInRole: number;
}

enum PolitburoRole {
  GENERAL_SECRETARY   = 'general_secretary',   // The Leader
  KGB_CHAIRMAN        = 'kgb_chairman',
  DEFENSE_MINISTER    = 'defense_minister',
  FOREIGN_MINISTER    = 'foreign_minister',
  AGRICULTURE_MINISTER = 'agriculture_minister',
  INDUSTRY_MINISTER   = 'industry_minister',
  IDEOLOGY_CHIEF      = 'ideology_chief',
  PARTY_SECRETARY     = 'party_secretary',      // #2 in line
}

enum Faction {
  HARDLINER    = 'hardliner',
  MODERATE     = 'moderate',
  REFORMIST    = 'reformist',
  MILITARY     = 'military',
  KGB          = 'kgb',
}
```

### 2.3 Transition State Machine

```
                         ┌─────────────────────────────────────────────┐
                         │              STABLE RULE                    │
                         │  (Normal gameplay, leader in power)         │
                         │                                             │
                         │  Per-tick: evaluate transition triggers     │
                         └──────────┬──────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────────┐
                    │  Trigger fires (probability roll)  │
                    └───────────────┬───────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
     ┌────────────────┐   ┌──────────────┐   ┌────────────────────┐
     │  TRANSITION    │   │  CONTESTED   │   │  IMMEDIATE         │
     │  ANNOUNCED     │   │  (Coup in    │   │  (Assassination,   │
     │  (Death,       │   │   progress)  │   │   Disappearance)   │
     │  "Health",     │   │              │   │                    │
     │   Palace Rev)  │   │ ┌──────────┐ │   │                    │
     │                │   │ │ SUCCEED? │ │   │                    │
     │                │   │ └────┬─────┘ │   │                    │
     │                │   │   Y / N      │   │                    │
     └───────┬────────┘   └───┬───┬──────┘   └──────────┬─────────┘
             │                │   │                     │
             │           ┌────┘   └────┐                │
             │           ▼             ▼                │
             │    ┌───────────┐ ┌──────────┐            │
             │    │NEW LEADER │ │ FAILED   │            │
             │    │ SELECTED  │ │ COUP     │            │
             │    └─────┬─────┘ │ (purge   │            │
             │          │       │  event)  │            │
             │          │       └────┬─────┘            │
             │          │            │                  │
             ▼          ▼            │                  ▼
     ┌─────────────────────────┐     │      ┌─────────────────────┐
     │     PURGE PHASE         │     │      │   PURGE PHASE       │
     │  (3-8 ticks)            │◄────┘      │   (3-8 ticks)       │
     │  Rivals removed         │            │                     │
     │  Fear spikes            │            │                     │
     │  Some policies frozen   │            │                     │
     └──────────┬──────────────┘            └──────────┬──────────┘
                │                                      │
                ▼                                      ▼
     ┌─────────────────────────┐            ┌─────────────────────┐
     │     DECREE PHASE        │            │   DECREE PHASE      │
     │  (5-12 ticks)           │            │   (5-12 ticks)      │
     │  New policies roll out  │            │                     │
     │  Buildings repurposed   │            │                     │
     │  City may rename        │            │                     │
     └──────────┬──────────────┘            └──────────┬──────────┘
                │                                      │
                ▼                                      ▼
     ┌─────────────────────────┐            ┌─────────────────────┐
     │  DE-[NAME]-IZATION      │            │  DE-[NAME]-IZATION  │
     │  (8-20 ticks)           │            │  (8-20 ticks)       │
     │  Legacy dismantled or   │            │                     │
     │  embraced               │            │                     │
     └──────────┬──────────────┘            └──────────┬──────────┘
                │                                      │
                ▼                                      ▼
     ┌─────────────────────────────────────────────────────────────┐
     │                    STABLE RULE                              │
     │              (New leader, normal gameplay resumes)           │
     └─────────────────────────────────────────────────────────────┘
```

---

## 3. Transition Types -- Full Specification

### 3.1 Natural Death

**Trigger Condition**: Probability roll each game-month (every 6 ticks).

**Probability Formula**:
```
P(death_per_month) = base_mortality * age_factor * health_factor * stagnation_bonus

where:
  base_mortality   = 0.001                               (0.1% per month baseline)
  age_factor       = max(1.0, (age - 55) / 10)          (linear ramp after 55)
  health_factor    = (100 - health) / 50                 (doubles at health=50, quadruples at health=0)
  stagnation_bonus = 1.0 + (yearsInPower / 30)          (the longer they rule, the frailer)
```

**Special: The Brezhnev Effect**
- When `archetype === GERIATRIC`, apply `deathResistance = 0.3` multiplier to final probability.
- A GERIATRIC leader who survives past age 80 gains increasing `deathResistance` bonuses (0.2 at 85, 0.1 at 90), making them paradoxically harder to kill.
- At age 95+, death probability clamps to a minimum 2% per month (they are not truly immortal, just very stubborn).

**Probability Table (approximate monthly death chance)**:

| Leader Age | Years in Power | Health | Archetype    | Monthly P(death) |
|------------|---------------|--------|--------------|-------------------|
| 55         | 2             | 80     | Any          | ~0.05%            |
| 60         | 5             | 70     | Apparatchik  | ~0.16%            |
| 65         | 10            | 60     | Zealot       | ~0.53%            |
| 70         | 15            | 50     | Strongman    | ~1.3%             |
| 75         | 20            | 40     | Geriatric    | ~0.9% (resisted)  |
| 80         | 25            | 30     | Geriatric    | ~1.5% (resisted)  |
| 85         | 30            | 20     | Any          | ~6.0%             |
| 90         | 35            | 10     | Geriatric    | ~3.6% (resisted)  |

**Mechanical Effects**:
- **Transition period**: 6-12 ticks (the Party takes its time acknowledging reality)
- **Delay mechanic**: 1-4 tick delay before death is announced (leader may have been dead for days)
- **Politburo**: Strongest faction leader becomes new General Secretary. If KGB chairman has highest combined (ambition + competence), they seize power. Otherwise, the Party Secretary inherits.
- **Policies**: All active policies FROZEN for the transition period, then the new leader's archetype determines which are kept/reversed.
- **Resources**: Treasury loses 5-15% to "funeral expenses and power consolidation."
- **Population morale**: -10 to -20 approval hit (uncertainty), recovers over 20 ticks.
- **Fear**: Slight spike (+10) during uncertainty, then settles based on new leader.

---

### 3.2 Coup

**Trigger Condition**: Evaluated each game-month. Requires ALL of:
1. Leader approval < 35
2. KGB Chairman ambition > 60 OR Defense Minister ambition > 60
3. At least 3 Politburo members with loyalty < 30
4. Fear level < 50 (high fear prevents coups -- everyone too scared)
5. Leader not in first 12 months of power (honeymoon period)

**Coup Success Probability**:
```
P(coup_success) = coup_strength / (coup_strength + defense_strength)

where:
  coup_strength    = instigator_ambition * 0.4
                   + military_support * 0.3     (defense_minister loyalty < 30 ? 1.0 : 0.0)
                   + disloyal_members / 8 * 0.3
  defense_strength = leader_paranoia * 0.2
                   + kgb_loyalty * 0.3          (if KGB is NOT the instigator)
                   + fear_level * 0.3
                   + leader_approval * 0.2
```

**Probability Table (coup attempt chance, given preconditions met)**:

| Leader Approval | KGB Ambition | Military Support | Fear | P(attempt) | P(success given attempt) |
|----------------|-------------|-----------------|------|------------|--------------------------|
| 30             | 65          | Yes             | 30   | 8%/month   | 65%                      |
| 20             | 80          | Yes             | 20   | 15%/month  | 78%                      |
| 25             | 70          | No              | 40   | 5%/month   | 40%                      |
| 10             | 90          | Yes             | 10   | 25%/month  | 88%                      |
| 30             | 60          | No              | 45   | 3%/month   | 30%                      |

**If Coup Succeeds**:
- **Transition period**: 3-5 ticks (coups are fast)
- **Politburo**: Instigator becomes leader. 2-4 loyalists of old leader are purged. Remaining members recalculate loyalty.
- **Policies**: Reversed if new leader is different faction. Military spending always increases.
- **Resources**: Treasury loses 10-25% (military mobilization costs). Food production drops 20% for 10 ticks (disruption).
- **Population morale**: -25 to -35 hit. Fear spikes +30.
- **Special**: Tanks appear in city center (visual event). Curfew declared for 5 ticks.

**If Coup Fails**:
- **Purge event**: 3-6 Politburo members removed (including instigator). Leader's paranoia +30.
- **Fear**: Spikes to 90 (capped at 100).
- **Policies**: Leader doubles down on current policies (modifiers increase 20%).
- **KGB/Military**: If KGB led the coup, new KGB Chairman is an ultra-loyalist (loyalty 95, ambition 10). Same for Defense Minister if military-led.
- **Resources**: Treasury loses 5-10% to "investigation costs."
- **Special announcement**: "The traitors have been unmasked. The Party is stronger than ever."

---

### 3.3 "Health Reasons"

**Trigger Condition**: Requires ALL of:
1. Leader approval < 40 (or health < 30)
2. Party Secretary ambition > 50
3. At least 4 Politburo members with loyalty < 45 (broad quiet consensus)
4. No active coup in progress
5. Leader archetype is NOT Strongman or Zealot (they don't go quietly)

**Exception**: Reformers have a 2x multiplier on being "health reasons'd" -- the system rejects them.

**Probability**:
```
P(health_reasons_per_month) = base * consensus_factor * weakness_factor

where:
  base             = 0.02 (2% monthly base when conditions met)
  consensus_factor = disloyal_count / 8                    (scales with how many want them gone)
  weakness_factor  = (100 - leader_health) / 100 + 0.3    (sicker leaders are easier to push)
  
  If archetype == REFORMER: multiply final by 2.0
  If archetype == STRONGMAN or ZEALOT: multiply final by 0.0 (blocked)
```

**Mechanical Effects**:
- **Transition period**: 2-4 ticks (smoothest transition)
- **Politburo**: Minimal changes. 0-1 members removed. Party Secretary typically ascends.
- **Policies**: Continued with minor adjustments (5-15% shift toward new leader's preferences).
- **Resources**: Treasury loses only 2-5%. Minimal economic disruption.
- **Population morale**: -5 to -10 (barely noticed). Fear unchanged.
- **Special**: The departing leader may reappear as a "retired advisor" event months later, offering unsolicited commentary.

---

### 3.4 Mysterious Disappearance

**Trigger Condition**: Random low-probability event. Increased by:
1. Leader archetype is MYSTIC (3x multiplier)
2. Leader has enacted absurdist policies
3. Game date is past 1990 (reality breaking down)
4. Low KGB competence (they lost track of the leader)

**Probability**:
```
P(disappearance_per_year) = 0.005 * mystic_bonus * era_bonus * incompetence_factor

where:
  mystic_bonus       = (archetype == MYSTIC) ? 3.0 : 1.0
  era_bonus          = max(1.0, (year - 1985) / 5)
  incompetence_factor = (100 - kgb_competence) / 100 + 0.5
```

**Mechanical Effects**:
- **Transition period**: 8-15 ticks (nobody knows what happened; bureaucratic paralysis)
- **Politburo**: Complete confusion. Each member has a 30% chance of "also disappearing" over the next 10 ticks. Surviving most-competent member eventually takes over.
- **Policies**: ALL policies suspended. City runs on autopilot (base production rates, no bonuses or penalties).
- **Resources**: No direct loss, but no policy bonuses either. Slow drift toward baseline.
- **Population morale**: Oddly neutral (people are used to this). Fear drops slightly (who are they afraid of?).
- **Damnatio Memoriae**: All buildings named after the disappeared leader are renamed. Their portrait is removed from the game UI. Previous Pravda headlines referencing them are retroactively edited (visible to the player as a comedic moment).
- **Special**: A "Comrade Who?" event fires. Citizens who mention the old leader's name are marked for "memory adjustment."

---

### 3.5 Assassination

**Trigger Condition**: Rare, dramatic. Requires:
1. Leader approval < 20 OR leader is a ZEALOT with approval < 40
2. Fear level between 30-70 (too low = no motive, too high = no opportunity)
3. At least one Politburo member with ambition > 80 and loyalty < 15
4. NOT in first 6 months of power

**Probability**:
```
P(assassination_per_year) = 0.01 * archetype_modifier * desperation_factor

where:
  archetype_modifier:
    ZEALOT     = 2.5  (extremists attract extremists)
    STRONGMAN  = 1.5  (military enemies)
    REFORMER   = 1.8  (hardliners strike back)
    APPARATCHIK = 0.5  (too boring to assassinate)
    GERIATRIC  = 0.3  (just wait)
    MYSTIC     = 1.0

  desperation_factor = (100 - approval) / 50
```

**Mechanical Effects**:
- **Transition period**: 10-20 ticks (massive disruption)
- **Politburo**: KGB Chairman ALWAYS becomes interim leader for 5 ticks (emergency powers). Then the actual succession process begins. 2-5 members purged during investigation.
- **Policies**: All frozen, then military/security policies enhanced. All other policies reduced in effect.
- **Resources**: Treasury loses 15-30% (security mobilization). Food production drops 30% for 15 ticks (curfews, disruption). Vodka consumption increases 50% for 10 ticks (stress drinking).
- **Population morale**: -40 hit. Fear spikes to 85+. Takes 30+ ticks to normalize.
- **Special**: KGB "emergency powers" mechanic -- for the next 20 ticks, fear cannot drop below 60, and a random citizen is "investigated" every 3 ticks (population slowly decreases).

---

### 3.6 Palace Revolution

**Trigger Condition**: Requires:
1. Leader approval < 50
2. A faction (hardliner, moderate, or reformist) controls 4+ Politburo seats
3. That faction's average loyalty to leader < 35
4. The faction's strongest member has ambition > 55

**Probability**:
```
P(palace_rev_per_month) = 0.03 * faction_strength * disloyalty_factor

where:
  faction_strength  = faction_seats / 8
  disloyalty_factor = (100 - avg_faction_loyalty) / 100
```

**Mechanical Effects**:
- **Transition period**: 4-8 ticks (orderly backstab)
- **Politburo**: Faction leader becomes new General Secretary. 1-3 members from rival factions "retired." Entire winning faction gets loyalty boost.
- **Policies**: Shift toward the winning faction's ideology. Hardliner win = more gulags, more fear. Moderate win = status quo. Reformist win = reduced fear, increased production attempts.
- **Resources**: Treasury loses 5-12%. Minor economic disruption.
- **Population morale**: -10 to -15. Fear adjusts based on winning faction (+15 for hardliners, -5 for moderates, -15 for reformists).
- **Special**: The announcement is delivered as if nothing unusual happened. "The Central Committee has unanimously agreed..." -- the unanimity is always suspicious.

---

### 3.7 The Immortal (Special Event)

**Trigger Condition**: Leader survives 25+ years in power without a transition. Probability increases each year after 25.

```
P(immortal_activation) = 0.0 if yearsInPower < 25
P(immortal_activation) = 0.1 * (yearsInPower - 25) / 5 if yearsInPower >= 25
```

Once activated, the leader enters "Immortal" status. This is not a transition -- it is the ABSENCE of a transition. The leader simply persists.

**Mechanical Effects (while Immortal is active)**:
- **Stagnation**: All production modifiers decay 2% per year toward 0.5x.
- **Bureaucratic calcification**: Event frequency drops 50%. New building costs increase 5% per year.
- **Population morale**: Slowly drifts toward exactly 50 (nobody feels anything anymore). Fear and approval converge on 50.
- **Absurdist events**: Increase in frequency by 3x. The world becomes surreal.
- **Death probability**: Increases each year but the leader stubbornly persists. At age 100+, a special "COMRADE ETERNAL" headline fires annually.
- **Special**: City stops changing. New buildings look identical to old ones. The Pravda headlines start repeating. Time becomes meaningless.

**Ending The Immortal**: Only natural death (at increasingly improbable ages, minimum 2% per month at 95+) or assassination (which gets a 3x modifier for Immortals because everyone is desperate) can end it.

---

## 4. Unified Probability Model

### 4.1 Base Yearly Transition Probabilities

This table shows the COMBINED annual probability of ANY transition occurring, before modifiers.

| Years in Power | Leader Age Range | Base Annual P(any transition) |
|---------------|-----------------|-------------------------------|
| 0-2           | Any             | 3% (honeymoon protection)      |
| 3-5           | 50-60           | 8%                             |
| 3-5           | 60-70           | 12%                            |
| 6-10          | 50-60           | 15%                            |
| 6-10          | 60-70           | 22%                            |
| 6-10          | 70-80           | 35%                            |
| 11-15         | 60-70           | 30%                            |
| 11-15         | 70-80           | 45%                            |
| 16-20         | 70-80           | 55%                            |
| 20+           | 80+             | 65% (or Immortal kicks in)     |

### 4.2 Archetype Vulnerability Matrix

Which transition types each archetype is most/least vulnerable to:

| Archetype     | Natural Death | Coup | Health Reasons | Disappearance | Assassination | Palace Rev |
|---------------|:---:|:---:|:---:|:---:|:---:|:---:|
| ZEALOT        | 1.0x | 1.0x | BLOCKED | 1.0x | **2.5x** | 0.8x |
| APPARATCHIK   | 1.0x | **1.5x** | 1.0x | 1.0x | 0.5x | **1.3x** |
| REFORMER      | 1.0x | 0.8x | **2.0x** | 1.0x | 1.8x | 1.2x |
| STRONGMAN     | 1.0x | 0.7x | BLOCKED | 0.5x | 1.5x | 0.6x |
| MYSTIC        | 1.0x | 1.0x | 1.0x | **3.0x** | 1.0x | 1.0x |
| GERIATRIC     | **0.3x** (resist) | 1.2x | 1.5x | 0.7x | 0.3x | 1.5x |

### 4.3 Modifier Summary Table

| Modifier | Affects | Effect |
|----------|---------|--------|
| Leader age > 55 | Natural Death | Linear increase |
| Leader health < 50 | Natural Death, Health Reasons | Increases both |
| Leader approval < 35 | Coup, Palace Rev | Enables / increases |
| Leader approval < 20 | Assassination | Enables |
| Fear > 70 | Coup | Blocks (everyone too scared) |
| Fear 30-70 | Assassination | Enables (sweet spot) |
| KGB loyalty < 30 | Coup (KGB-led) | Enables |
| Military loyalty < 30 | Coup (military-led) | Enables |
| Faction controls 4+ seats | Palace Revolution | Enables |
| Leader paranoia > 70 | Coup defense | +30% defense strength |
| Leader yearsInPower > 25 | Immortal | May activate |
| Game year > 1990 | Disappearance | Increases chance |

---

## 5. Announcement System

### 5.1 Natural Death

**Formal Pravda Announcements**:
1. `"THE CENTRAL COMMITTEE ANNOUNCES WITH DEEP SORROW THAT COMRADE {LEADER_SURNAME}, BELOVED LEADER OF THE PEOPLE, HAS COMPLETED THEIR EARTHLY DUTIES TO THE MOTHERLAND"`
2. `"COMRADE {LEADER_SURNAME} HAS BEEN PROMOTED TO THE ETERNAL POLITBURO. FUNERAL ARRANGEMENTS TO BE ANNOUNCED IN {RAND} DAYS"`
3. `"THE TIRELESS HEART OF COMRADE {LEADER_SURNAME} HAS CEASED ITS SERVICE TO THE REVOLUTION. THE REVOLUTION, HOWEVER, CONTINUES"`
4. `"SOURCES CONFIRM COMRADE {LEADER_SURNAME} IS RESTING. DEEPLY. PERMANENTLY. STATE FUNERAL DECLARED"`
5. `"THE PARTY MOURNS THE LOSS OF ITS GREATEST SON. REPLACEMENT SON WILL BE ANNOUNCED SHORTLY"`
6. `"COMRADE {LEADER_SURNAME}'S HEALTH HAS ACHIEVED ITS FINAL OPTIMIZATION. FLOWERS MAY BE DEPOSITED AT SECTOR 3"`

**Advisor Reactions (Comrade Vanya)**:
1. `"The old man is dead. He's been dead for three days, actually. We just found out because someone tried to schedule a meeting with him. The succession will be... interesting. Hide the vodka."`
2. `"Comrade Director, the leader has died. This is either a disaster or an opportunity. In this country, it's usually both."`
3. `"I've seen {RAND} leaders die. The funerals get shorter each time. The successor is already measuring the curtains."`
4. `"He died as he lived -- slowly, and without anyone noticing until the paperwork stopped."`
5. `"The body isn't cold yet and the Politburo is already voting. Democracy in action, Comrade."`

**Radio Broadcast**:
1. `"Attention citizens. Regular programming is suspended. The anthem will now play for the next 72 hours. Details to follow."`
2. `"This is Radio Moscow. We interrupt our broadcast of 'The Glorious Tractor' to bring you a lengthy silence, followed by the anthem, followed by more silence."`
3. `"Citizens are advised to adopt an expression of dignified grief. Diagrams of approved expressions will be distributed at work stations."`
4. `"The flag is at half-mast. We are not sure which half."`
5. `"All workers are granted one hour of mourning. Mourning will be deducted from annual leave."`

**Citizen Rumor**:
1. `"They say he died on Tuesday. Or was it last Tuesday? The doctors won't say. The doctors also disappeared."`
2. `"My cousin's neighbor's supervisor said the leader was actually dead for a week before anyone told the Politburo. The bodyguards just kept bringing meals to the room."`
3. `"I heard the funeral is going to cost more than the annual food budget. But I didn't say that. You didn't hear that."`
4. `"Someone in the factory said the new leader will be worse. He was corrected immediately."`
5. `"Shh. Don't talk about it. Don't talk about not talking about it. Just... look at your shoes."`

---

### 5.2 Coup

**Formal Pravda Announcements**:
1. `"THE ARMED FORCES, IN FULL UNITY WITH THE PEOPLE, HAVE ENSURED THE CONTINUATION OF SOCIALIST ORDER. COMRADE {NEW_LEADER} ASSUMES LEADERSHIP BY UNANIMOUS REQUEST"`
2. `"A SMALL GROUP OF ANTI-PARTY ELEMENTS HAS BEEN NEUTRALIZED. ORDER IS RESTORED. THE NEW LEADERSHIP THANKS THE TANKS FOR THEIR PARTICIPATION"`
3. `"THE PEOPLE'S ARMY HAS CORRECTED A MINOR ADMINISTRATIVE IRREGULARITY. COMRADE {OLD_LEADER} HAS BEEN RELOCATED FOR THEIR OWN SAFETY"`
4. `"BREAKING: THE REVOLUTION HAS BEEN RE-REVOLUTIONIZED. COMRADE {NEW_LEADER} LEADS THE VANGUARD OF THE VANGUARD"`
5. `"THE CENTRAL COMMITTEE ANNOUNCES THAT COMRADE {OLD_LEADER} HAS VOLUNTARILY SURRENDERED POWER AT GUNPOINT. DEMOCRACY PREVAILS"`
6. `"TANKS IN THE CITY CENTER ARE PARTICIPATING IN A SCHEDULED URBAN BEAUTIFICATION EXERCISE. UNRELATED: NEW LEADERSHIP ANNOUNCED"`

**Advisor Reactions**:
1. `"Tanks in the square, Comrade. I recommend we hang a portrait of whoever wins. I have several pre-prepared. One moment while I determine which face to use."`
2. `"The coup is underway. I suggest we maintain a neutral expression and agree with whoever walks through the door next. I've been practicing."`
3. `"The old boss was bad. The new boss will also be bad. But he'll be NEW bad, which is briefly exciting."`
4. `"I've survived {RAND} coups. The trick is to look busy and claim you were always loyal. Start now."`
5. `"The shooting has stopped. Either the coup succeeded or everyone ran out of ammunition. Both have happened before."`

**Radio Broadcast**:
1. `"Citizens: the sounds you are hearing are fireworks celebrating a spontaneous change in leadership. Please remain indoors during the celebration."`
2. `"This is an emergency broadcast. All citizens are to remain calm. Calmness is now mandatory. Failure to remain calm is punishable."`
3. `"Regular programming has been replaced with martial music. This is not alarming. The music is quite good. Please enjoy it from inside your homes."`
4. `"The airport, train station, and border crossings are closed for routine maintenance. All maintenance is expected to last indefinitely."`
5. `"Curfew is in effect. Curfew hours: all of them."`

**Citizen Rumor**:
1. `"Did you hear the gunshots last night? No? Good answer. I didn't hear them either."`
2. `"The tanks are just passing through. They've been passing through for three days. Very thorough route they're taking."`
3. `"My boss was arrested. My boss's boss was also arrested. I don't know who to report to. This might be the most productive day we've ever had."`
4. `"Someone said the old leader fled dressed as a woman. Someone else said that person has been arrested for spreading rumors. I'm saying nothing."`
5. `"The bread line is now also a loyalty oath line. Two birds, one queue."`

---

### 5.3 "Health Reasons"

**Formal Pravda Announcements**:
1. `"COMRADE {OLD_LEADER}, HAVING GLORIOUSLY COMPLETED THEIR HISTORIC MISSION, RETIRES TO FOCUS ON HEALTH AND WRITE MEMOIRS THAT WILL NEVER BE PUBLISHED"`
2. `"THE CENTRAL COMMITTEE ACCEPTS WITH DEEP UNDERSTANDING COMRADE {OLD_LEADER}'S DECISION TO STEP DOWN. THIS DECISION WAS ABSOLUTELY VOLUNTARY AND NOT AT ALL RELATED TO YESTERDAY'S 9-HOUR MEETING"`
3. `"COMRADE {OLD_LEADER} TRANSITIONS TO EMERITUS STATUS. A DACHA IN THE COUNTRYSIDE HAS BEEN PREPARED. THE COUNTRYSIDE IS FAR AWAY. VERY FAR"`
4. `"THE PARTY THANKS COMRADE {OLD_LEADER} FOR THEIR SERVICE. COMRADE {NEW_LEADER} CONTINUES THE WORK WITH IDENTICAL ENTHUSIASM AND SLIGHTLY DIFFERENT POLICIES"`
5. `"COMRADE {OLD_LEADER} RETIRES DUE TO HEALTH CONCERNS. THE CONCERNS WERE: THE HEALTH OF THE POLITBURO MEMBERS WHO VOTED AGAINST THEM"`
6. `"A SMOOTH AND ORDERLY TRANSITION OF POWER DEMONSTRATES THE MATURITY OF SOVIET GOVERNANCE. NO TANKS WERE INVOLVED. WE WANT TO BE VERY CLEAR ABOUT THAT"`

**Advisor Reactions**:
1. `"'Health reasons.' Yes, comrade. The most contagious disease in Soviet politics. Symptoms include: losing a vote 8 to 1 and being escorted from the building."`
2. `"The old leader is 'resting.' In a dacha with no phone and guards facing inward. Very restful."`
3. `"Smoothest transition in years. Almost suspiciously smooth. Like they had it planned for months. Which they did."`
4. `"The good news: the new leader seems competent. The bad news: competence is temporary. The vodka, however, is forever."`
5. `"I spoke with the departing leader. They said they were fine. Their eye was twitching when they said it. Both eyes, actually."`

**Radio Broadcast**:
1. `"Comrade {OLD_LEADER} has retired for health reasons. Citizens are reminded that health reasons are valid reasons. Questioning the validity of reasons is not healthy."`
2. `"A new chapter begins. The previous chapter has been classified. Please adjust your bookmarks accordingly."`
3. `"Programming note: all references to Comrade {OLD_LEADER} in previously broadcast material should be mentally replaced with Comrade {NEW_LEADER}. The State appreciates your cognitive flexibility."`
4. `"This transition was planned, orderly, and bore no resemblance to anything dramatic. The armed guards at the Kremlin were there for unrelated decorative purposes."`
5. `"Comrade {NEW_LEADER} will address the nation at 8:00 PM. Attendance at your radio is mandatory."`

**Citizen Rumor**:
1. `"'Health reasons.' Ha. The only thing wrong with his health was his political health. And his actual health, probably, after that meeting."`
2. `"I heard they gave him a dacha and a pension. That's generous. My uncle got neither when he was 'retired.' My uncle also has not been seen since."`
3. `"Nothing changes. Different mustache, same speeches. At least this one can climb stairs."`
4. `"My grandmother says she's seen seven leaders come and go. She says they're all the same. Then she goes back to her queue."`
5. `"Shh -- don't say 'retired.' Say 'promoted to nature.' It's the approved phrasing."`

---

### 5.4 Mysterious Disappearance

**Formal Pravda Announcements**:
1. `"THE COMMITTEE ANNOUNCES THE CONTINUATION OF GOVERNANCE. THERE IS NO LEADERSHIP VACANCY. THERE HAS NEVER BEEN A LEADERSHIP VACANCY. GOVERNANCE CONTINUES AS NORMAL"`
2. `"COMRADE {OLD_LEADER}? WE ARE NOT FAMILIAR WITH THAT NAME. PLEASE CONSULT THE UPDATED RECORDS. THE RECORDS HAVE ALWAYS SAID THIS"`
3. `"PRAVDA ISSUES A CORRECTION: ALL PREVIOUS REFERENCES TO [REDACTED] WERE TYPOGRAPHICAL ERRORS. WE APOLOGIZE FOR ANY CONFUSION CAUSED BY THE EXISTENCE OF THIS INDIVIDUAL"`
4. `"THE POSITION OF GENERAL SECRETARY HAS BEEN RESTRUCTURED. IT WAS PREVIOUSLY UNFILLED. IT IS NOW FILLED BY COMRADE {NEW_LEADER}. NO FURTHER QUESTIONS"`
5. `"AN EDITORIAL NOTE: SEVERAL PHOTOGRAPHS IN RECENT EDITIONS HAVE BEEN UPDATED TO REFLECT CURRENT REALITY. REALITY, AS ALWAYS, IS DETERMINED BY THE EDITORIAL BOARD"`
6. `"ATTENTION: ANYONE CLAIMING TO REMEMBER A LEADER NAMED {OLD_LEADER} IS ADVISED TO REPORT TO SECTOR 4 FOR COMPLIMENTARY MEMORY CALIBRATION"`

**Advisor Reactions**:
1. `"Comrade Director, I... who are we talking about? I'm sorry, my memory is suddenly very clear that no one occupied that office. Very, very clear. Suspiciously clear."`
2. `"The leader is gone. Not 'gone' as in dead. Not 'gone' as in retired. Just... gone. The chair was empty when we checked. The tea was still warm. Best not to think about it."`
3. `"I've updated our records. There is a gap of {YEARS_IN_POWER} years in the official timeline. Officially, those years did not happen. The potatoes from those years? Also did not happen."`
4. `"Someone in the Ministry of Records is having a very long night. By morning, Comrade {OLD_LEADER} will have never existed. I suggest you start practicing your 'I don't recall' face."`
5. `"This is the third time this has happened. You'd think I'd be used to it. I am not. Pass the vodka."`

**Radio Broadcast**:
1. `"Today's broadcast is brought to you by the Ministry of Truth. Today's truth: nothing has changed. Tomorrow's truth: it has always been this way."`
2. `"Citizens are reminded that asking 'what happened to the leader' is not a valid question, as the question presupposes a leader existed. Which they did not."`
3. `"Please return all photographs, documents, and commemorative plates bearing the likeness of [DATA EXPUNGED] to your nearest collection point."`
4. `"In other news, several thousand bureaucrats have been reassigned to the Department of Retroactive History. Their work is vital and absolutely real."`
5. `"The weather forecast: grey. The political forecast: exactly as it has always been. Next: the anthem. Again."`

**Citizen Rumor**:
1. `"Who? Oh, THEM. I never liked them anyway. I mean, I never knew them. They didn't exist. Why are you asking? Please stop asking. I'm going to go stand in a queue now."`
2. `"My neighbor's portrait of [REDACTED] was confiscated at 3 AM. Replaced with a painting of a tractor. The neighbor says the tractor has always been there. The neighbor is correct."`
3. `"I had a dream about the old leader. I have reported this dream to the authorities. The dream has been corrected."`
4. `"Have you noticed the blank spaces on the walls where portraits used to be? No? Neither have I. There were never portraits. The walls have always been blank. I love blank walls."`
5. `"They're re-painting the murals in the Cultural Palace. The figure that was in the center is now a very large potato. An improvement, honestly."`

---

### 5.5 Assassination

**Formal Pravda Announcements**:
1. `"AN ACT OF COWARDLY SABOTAGE BY FOREIGN AGENTS HAS STRUCK AT THE HEART OF THE MOTHERLAND. COMRADE {OLD_LEADER} HAS FALLEN. THE PERPETRATORS WILL BE FOUND. ALL OF THEM. EVEN THE ONES WHO HAD NOTHING TO DO WITH IT"`
2. `"THE ENEMIES OF THE PEOPLE HAVE COMMITTED THEIR FINAL ACT OF DESPERATION. THE KGB ASSUMES EMERGENCY AUTHORITY. JUSTICE WILL BE THOROUGH AND IMMEDIATE"`
3. `"COMRADE {OLD_LEADER} HAS BEEN MARTYRED BY COUNTERREVOLUTIONARY ELEMENTS. A NATIONAL PERIOD OF MOURNING AND SUSPICION IS DECLARED"`
4. `"THE WESTERN IMPERIALISTS WILL PAY FOR THIS OUTRAGE. EVIDENCE IS BEING MANUFACTURED -- WE MEAN GATHERED -- AS WE SPEAK"`
5. `"A DARK DAY FOR THE REVOLUTION. SECURITY MEASURES HAVE BEEN ENHANCED TO LEVEL: MAXIMUM. CITIZENS ARE ADVISED THAT TRUST IS NOW RATIONED"`
6. `"THE ASSASSIN HAS BEEN IDENTIFIED, ALONG WITH THEIR FAMILY, FRIENDS, NEIGHBORS, AND ANYONE WHO EVER SHARED A QUEUE WITH THEM. INVESTIGATIONS CONTINUE"`

**Advisor Reactions**:
1. `"Comrade... the leader is dead. Murdered. The KGB is already rounding up suspects. By 'suspects' I mean 'everyone.' I recommend we look very, very loyal today."`
2. `"This is bad. Very bad. The last time this happened, the purges lasted two years. Keep your head down. Literally and figuratively."`
3. `"The assassin used a [CLASSIFIED]. The KGB is in charge now. When the KGB is in charge, the only safe activity is breathing. And even that should be done quietly."`
4. `"I've seen leaders die of old age, politics, and bad vodka. But assassination? That's... that's going to leave a mark. On all of us. Possibly literally."`
5. `"Lock the doors. Hang the flag. Look sad. Don't look TOO sad, that's suspicious. Look exactly the right amount of sad. I'll demonstrate."`

**Radio Broadcast**:
1. `"EMERGENCY BROADCAST: All citizens must remain in their current location. Movement requires Form 7-B, signed by two KGB officers and a notary who no longer exists."`
2. `"The anthem will play continuously until further notice. The anthem is now also a loyalty test. Failure to sing along will be noted."`
3. `"All borders are sealed. All communications are monitored. All thoughts are... under review. Please think approved thoughts only."`
4. `"Citizens are reminded that seeing anything, hearing anything, or knowing anything is currently inadvisable. Ignorance is your friend. Ignorance has always been your friend."`
5. `"Security checkpoints have been established every 50 meters. Checkpoint staff are empowered to check your loyalty, your papers, and your pockets. In that order."`

**Citizen Rumor**:
1. `"..."` (silence -- nobody dares speak)
2. `"I was at home. I am always at home. I have documentation proving I have been at home since 1974."`
3. `"My neighbor disappeared last night. His wife says he went to buy milk. There is no milk. There is no neighbor. There is no wife. I don't have a neighbor."`
4. `"They arrested the baker. The baker! He can barely kill a loaf of bread, let alone a -- shh, someone's coming."`
5. `"I heard it was an inside job. I also heard that the person who said that was arrested. I am saying nothing. This rumor does not exist."`

---

### 5.6 Palace Revolution

**Formal Pravda Announcements**:
1. `"THE CENTRAL COMMITTEE HAS UNANIMOUSLY AGREED THAT COMRADE {OLD_LEADER} HAS COMPLETED THEIR HISTORIC MISSION. COMRADE {NEW_LEADER} UNANIMOUSLY ELECTED TO CONTINUE THE MISSION"`
2. `"IN A DISPLAY OF SOCIALIST DEMOCRACY, THE POLITBURO HAS ROTATED LEADERSHIP AS PART OF THE NATURAL DEMOCRATIC PROCESS. THE PROCESS WAS NATURAL. THE DEMOCRACY WAS SOCIALIST"`
3. `"COMRADE {NEW_LEADER} HAS BEEN CHOSEN BY THE COMMITTEE TO LEAD THE NEXT PHASE OF DEVELOPMENT. THE PREVIOUS PHASE WAS ALSO SUCCESSFUL. BOTH PHASES ARE GLORIOUS"`
4. `"A MEETING OF THE CENTRAL COMMITTEE HAS PRODUCED HISTORIC RESULTS. THE RESULTS ARE: EVERYTHING IS THE SAME, BUT DIFFERENT. THIS IS PROGRESS"`
5. `"THE PARTY THANKS COMRADE {OLD_LEADER} FOR THEIR VALUABLE CONTRIBUTIONS, WHICH WILL BE EVALUATED, REVISED, AND POSSIBLY DENIED AT A LATER DATE"`
6. `"COMRADE {OLD_LEADER} HAS BEEN REASSIGNED TO THE COMMITTEE FOR THE STUDY OF THINGS THAT DON'T MATTER. COMRADE {NEW_LEADER} TAKES THE HELM. THE HELM WAS ALWAYS THEIRS"`

**Advisor Reactions**:
1. `"The back room has spoken, Comrade. Amazing what eight people and a locked door can accomplish in twelve hours. The new boss wants to see our production numbers. May I suggest we... adjust them first."`
2. `"'Unanimously agreed.' That's what they always say. I counted the votes. There were nine members and twelve votes. Soviet mathematics at its finest."`
3. `"The old leader is being escorted to a very nice apartment with a very permanent lock. The new leader wants a tour of the city. Try to keep them away from Sector 7."`
4. `"Another rotation. Like a carousel, but less fun and more existential dread. The new one seems to have a plan. This is either good news or the worst possible news."`
5. `"I noticed the new leader moved their things into the office before the vote was finished. Very efficient. Very... confident."`

**Radio Broadcast**:
1. `"The Central Committee has made a decision. The decision is final. The decision was always the plan. Please adjust your understanding of history accordingly."`
2. `"Comrade {NEW_LEADER} will address the nation regarding the continuity of all plans, which will continue as planned, with minor adjustments to the plan."`
3. `"Citizens are invited to celebrate the smooth transition of power. Celebration supplies will be distributed. Supplies consist of: one flag per household."`
4. `"Programming note: the documentary 'The Visionary Leadership of Comrade {OLD_LEADER}' has been cancelled. It will be replaced by 'The Visionary Leadership of Comrade {NEW_LEADER},' which was, coincidentally, already in production."`
5. `"All portraits of Comrade {OLD_LEADER} should be rotated 180 degrees until replacement portraits arrive."`

**Citizen Rumor**:
1. `"New leader, same concrete. At least this one blinks. The last one stopped blinking in 1987 and nobody said anything."`
2. `"I heard the vote was 8-0. Comrade {OLD_LEADER} wasn't invited to vote. They weren't invited to the meeting. They weren't informed there was a meeting."`
3. `"My boss says we should be optimistic. My boss also said that about the last three leaders. My boss has been wrong three times."`
4. `"They say the new leader is a reformer. The last 'reformer' reformed the bread ration downward by 40%. I'll believe it when the queue gets shorter."`
5. `"The announcement said 'unanimously.' In my experience, 'unanimously' means 'the dissenters have been dealt with.'"`

---

## 6. Post-Transition Mechanics

### 6.1 New Leader Selection

The selection algorithm operates as a priority cascade:

```
function selectNewLeader(transition: TransitionType, politburo: PolitburoMember[]): Leader {
  const alive = politburo.filter(m => m.alive && m.role !== 'general_secretary');
  
  switch (transition) {
    case COUP:
      // Instigator (KGB or Defense Minister) takes power
      return promoteToLeader(getInstigator());
      
    case ASSASSINATION:
      // KGB Chairman gets interim power, then highest-competence surviving member
      return promoteToLeader(getKGBChairman() ?? highestCompetence(alive));
      
    case PALACE_REVOLUTION:
      // Strongest member of the winning faction
      return promoteToLeader(strongestInFaction(winningFaction, alive));
      
    case HEALTH_REASONS:
      // Party Secretary typically ascends
      return promoteToLeader(getPartySecretary() ?? highestCompetence(alive));
      
    case NATURAL_DEATH:
      // Strongest faction's leader
      return promoteToLeader(strongestInLargestFaction(alive));
      
    case MYSTERIOUS_DISAPPEARANCE:
      // Most competent survivor after the confusion settles
      return promoteToLeader(highestCompetence(alive));
  }
}
```

New leader archetype is determined by their faction and personal stats:

| Faction    | Ambition > 70 | Ambition 40-70 | Ambition < 40 |
|-----------|---------------|----------------|---------------|
| Hardliner  | ZEALOT        | STRONGMAN      | APPARATCHIK   |
| Moderate   | APPARATCHIK   | APPARATCHIK    | GERIATRIC     |
| Reformist  | REFORMER      | REFORMER       | MYSTIC        |
| Military   | STRONGMAN     | STRONGMAN      | APPARATCHIK   |
| KGB        | STRONGMAN     | ZEALOT         | APPARATCHIK   |

### 6.2 The Purge Phase (3-8 ticks)

Duration varies by transition type and new leader archetype:

| Transition Type        | Base Duration | Archetype Modifier                    |
|-----------------------|---------------|---------------------------------------|
| Natural Death          | 5 ticks       | ZEALOT +3, STRONGMAN +2, REFORMER -2  |
| Coup (success)         | 4 ticks       | Always +2 (consolidation)             |
| Coup (failed)          | 6 ticks       | +paranoia/20                          |
| Health Reasons         | 3 ticks       | REFORMER -1, APPARATCHIK +0           |
| Mysterious Disappearance | 8 ticks    | +3 (confusion)                        |
| Assassination          | 7 ticks       | Always +3 (security crackdown)        |
| Palace Revolution      | 4 ticks       | Winning faction size reduces by 1     |

**During the Purge Phase**:
- Each tick, 0-2 Politburo members with loyalty < 30 (to new leader) are removed.
- Removed members are replaced by loyalists (loyalty 70-90, faction matching new leader).
- Fear increases by 5 per member purged.
- Production efficiency drops 10% per purged member (disruption).
- A random existing building has a 10% chance of being "repurposed" (renamed, function changed).
- Population: 1-3 citizens "relocated" per tick (pop decreases).

### 6.3 The Decree Phase (5-12 ticks)

New policies are announced at a rate of 1 per 2-3 ticks. Policies are drawn from a pool filtered by archetype:

**Decree Pool by Archetype**:

| Archetype   | Likely Decrees |
|-------------|---------------|
| ZEALOT      | Increase ideology quotas, mandatory rallies (+fear, -production), purge intellectuals |
| APPARATCHIK | Reorganize bureaucracy (no real change), new reporting requirements, rename departments |
| REFORMER    | Reduce fear, increase production targets, open trade, reduce gulag quotas |
| STRONGMAN   | Military parades, defense spending increase, border fortification, conscription |
| MYSTIC      | Rename calendar months, redesign currency, mandate unusual architecture |
| GERIATRIC   | Re-announce existing policies as new, extend all deadlines, reduce meeting frequency |

**Resource effects per decree**: Each decree adjusts one or more resource rates by 5-15% in the archetype's preferred direction.

### 6.4 De-[Name]-ization Phase (8-20 ticks)

The new leader's relationship to the previous leader's legacy:

```
De-naming intensity = base_intensity * faction_difference * paranoia_factor

where:
  base_intensity:
    Same faction:      0.1  (keep most things)
    Adjacent faction:  0.5  (selective removal)
    Opposed faction:   0.9  (systematic erasure)
    
  faction_difference:
    HARDLINER -> REFORMIST = opposed
    MODERATE -> anything   = adjacent
    KGB -> MILITARY        = opposed
    
  paranoia_factor = new_leader.paranoia / 100
```

**Intensity Effects**:

| Intensity | Buildings Renamed | Policies Reversed | History Rewritten | Statues Removed |
|-----------|:---:|:---:|:---:|:---:|
| Low (< 0.3) | 0-1 | 0 | No | No |
| Medium (0.3-0.6) | 2-4 | 1-2 | Partial | 50% |
| High (0.6-0.9) | 4-8 | 3-5 | Yes | All |
| Total (> 0.9) | ALL | ALL | Damnatio memoriae | All + monuments built over them |

**Building Renaming Rules**:
- The `[Old Leader] Cultural Palace` becomes `The [New Leader] Re-Education Center` (if intensity > 0.5)
- The `[Old Leader] Memorial Park` becomes `The [New Leader] Victory Garden` 
- The `[Old Leader] Avenue` becomes `Avenue of the {YEAR} Revolution`
- If intensity is TOTAL, buildings may be physically demolished and rebuilt ("the old structure was ideologically unsound")

**City Renaming** (only at intensity > 0.7 or if new leader archetype is ZEALOT):
- City name is changed to `{New Leader}grad` or `{New Leader}sk`
- All city signage "updated" (costs 50-200 rubles)
- Previous city name becomes a thought crime

---

## 7. Game Balance Considerations

### 7.1 Transition Frequency Target

The design targets an average of **one transition every 8-15 game-years**, with variance:
- Early game (1980-1990): transitions are rare (stable Brezhnev-era gameplay, establishing the baseline)
- Mid game (1990-2000): transitions accelerate (perestroika-era instability)
- Late game (2000+): transitions become frequent OR the Immortal locks everything down

### 7.2 Player Agency

The player does not directly control transitions but influences them through city management:
- **Building gulags** increases fear (suppresses coups, but may trigger assassination)
- **Meeting quotas** increases leader approval (stabilizes rule)
- **Letting food/vodka run out** crashes approval (invites coups/palace revolutions)
- **Building too many of one type** concentrates faction power (enables palace revolutions)

### 7.3 Difficulty Scaling

Each transition that occurs increases a hidden `instability` counter by 1. This counter:
- Increases the base probability of ALL future transitions by 2% per point
- Decreases production efficiency by 1% per point (accumulated chaos)
- Can only be reduced by 1 per 10 years of stable rule (long recovery)

This creates a death spiral mechanic: bad governance leads to transitions, which lead to more transitions, which lead to stagnation, which leads to the Immortal or total collapse.

### 7.4 The "Win" Condition

There is no winning. There is only varying degrees of losing. This is historically accurate.

However, a player who maintains stability for 50+ game-years unlocks the "Eternal Stagnation" achievement, which is simultaneously the best and worst possible outcome.

---

## 8. Implementation Priority

For integration with the existing codebase at `/Users/jbogaty/src/arcade-cabinet/sim-soviet`:

**Phase 1 (MVP)**:
1. Add `LeaderState` and `PolitburoState` interfaces to `src/game/GameState.ts` alongside the existing `money`, `pop`, `food` fields
2. Create `src/game/LeadershipSystem.ts` with the probability engine, triggered from `SimulationEngine.tick()` on each month boundary (when `date.month` increments)
3. Wire transition events through the existing `EventSystem` as a new `EventCategory: 'leadership'`
4. Pipe announcements through the existing `PravdaSystem.headlineFromEvent()` and `SimCallbacks.onAdvisor()`

**Phase 2 (Full Transitions)**:
1. Implement the state machine (stable -> transition type -> purge -> decree -> de-naming -> stable)
2. Add post-transition mechanical effects (resource impacts, production modifier changes)
3. Extend `GameSnapshot` in `src/stores/gameStore.ts` to expose leader/politburo data to React components
4. Add a leader portrait UI component (similar to `src/components/ui/Advisor.tsx` but for the current leader)

**Phase 3 (Polish)**:
1. Building renaming system (extends `BuildingComponent` in `src/ecs/world.ts` with a `namedAfter` field)
2. City renaming (new field in `GameState`)
3. The Immortal mechanic
4. Damnatio memoriae visual effects (Pravda headline retroactive editing)
5. Integration with the existing `src/ai/CitizenClasses.ts` -- Party Officials become more/less influential based on faction alignment with the current leader

---

This document provides the complete mechanical specification for power transitions as the core disruption mechanic in SimSoviet 2000. Every random disaster in the existing `EventSystem` is secondary to these leadership changes -- they are the earthquakes around which the player must build their concrete paradise.
