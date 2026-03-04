# Pressure-Valve Crisis System + WorldAgent

## Context

The current ChaosEngine generates crises via weighted random dice rolls, checked once per year. This is artificial — real systems don't roll dice. Crises emerge from accumulated, unrelieved pressure in interconnected domains. The settlement doesn't exist in a vacuum; the Soviet Union always had external pressures from neighbors, trade routes, global conflicts.

This replaces the ChaosEngine with a **three-tier event model**:
- **Tier 1 — Pressure crises**: Emerge from accumulated systemic pressure (famine, revolt, purge). Player's job is managing these gauges.
- **Tier 2 — Climate events**: Follow seasonal/geographic patterns. ADD pressure but aren't caused by player neglect.
- **Tier 3 — Black swans**: Meteor strikes, earthquakes. Truly rare probability per tick, no artificial gates whatsoever.

Plus a **WorldAgent** that models the geopolitical context every agent responds to.

---

## Architecture

### Pipeline (replaces ChaosEngine)

```
Every tick:
  WorldAgent.computePressureModifiers()     ← external context
  PressureSystem.readAndAccumulate()        ← reads existing agent metrics
  PressureCrisisEngine.checkForEmergence()  ← Tier 1
  ClimateEventSystem.evaluate()             ← Tier 2 (seasonal)
  BlackSwanSystem.roll()                    ← Tier 3 (incredibly rare)
  evaluateActiveAgents()                    ← existing WarAgent/FamineAgent/etc
  mergeModifiers()                          ← existing pipeline
```

All three tiers produce standard `CrisisImpact[]` — the existing `CrisisImpactApplicator` and `GovernorDirective` pipeline is unchanged.

---

## 1. WorldAgent (`src/ai/agents/core/WorldAgent.ts`)

New Yuka Vehicle agent. Models the external world the settlement exists within. Russia never existed in a vacuum — from Kievan Rus' (trade routes to Byzantium, pressure from Khazars/Mongols) through to the Cold War, external context shaped everything.

### Country/Sphere Model

**Key design**: Like dvory aggregate into buildings at population scale, **countries aggregate into spheres at temporal scale**.

In 1917, individual countries matter: Germany, Austria-Hungary, Ottoman Empire, Britain, France, Japan, China, USA. In freeform eternal mode (year 2100+), they merge into **spheres of influence**: Sinosphere, Western sphere, Eurasian sphere, etc.

```typescript
/** Individual country (used in historical mode and early freeform). */
interface Country {
  id: string;               // 'germany', 'china', 'usa', etc.
  name: string;
  sphere: SphereId;         // which sphere it belongs to
  hostility: number;        // 0-1 toward Russia
  tradeVolume: number;      // 0-1 trade relationship
  militaryStrength: number; // 0-1 relative power
  /** Year this country merges into its sphere (freeform only). */
  mergeYear?: number;
}

/** Sphere of influence (aggregated from countries). See full Sphere interface in WorldState section. */
type SphereId = 'european' | 'sinosphere' | 'western' | 'middle_eastern' | 'eurasian' | 'corporate';
```

**Starting countries (1917)**:
- European: Germany, Austria-Hungary, France, Britain, Italy, Spain, Portugal
- Sinosphere: China, Japan
- Western: USA, Canada, Australia
- Middle Eastern: Ottoman Empire
- Eurasian: Poland (contested)

**Russia-specific insight**: Very insular superpower. Fought almost entirely on home soil. The Eastern Front of WWII was the largest theater of war in history — 27 million Soviet dead, mostly civilians. The WorldAgent models this as **border threat** and **homeland devastation**, not force projection.

### World State

```typescript
interface WorldState {
  spheres: Record<SphereId, Sphere>;
  globalTension: number;      // 0-1 (Cold War=0.6, détente=0.3, hot war=0.9)
  borderThreat: number;       // 0-1 (computed from neighboring country hostility)
  tradeAccess: number;        // 0-1 (1=open, 0=blockade)
  commodityIndex: number;     // multiplier (oil boom=1.5, crash=0.5)
  centralPlanningEfficiency: number; // 1.0=normal, stagnation drops this
  climateTrend: number;       // -1 to +1 (multi-year cycles)
  climateCycleRemaining: number;
  moscowAttention: number;    // 0-1 (higher=more scrutiny/quotas/KGB)
  ideologyRigidity: number;   // 0-1 (higher in revolution, lower in thaw)
  techLevel: number;          // 0-1 (unlocks efficiency bonuses)
  /** Active settlements player manages. Starts at 1, grows via cold branches. */
  settlements: Settlement[];
  /** Cold branches that have already activated (one-shot tracking). */
  activatedBranches: Set<string>;
}

interface Sphere {
  id: SphereId;
  countries: Country[];        // tracked individually until they merge
  aggregateHostility: number;
  aggregateTrade: number;
  aggregateMilitary: number;
  governance: GovernanceType;  // current governance model
  /** Ibn Khaldun cycle: 0-1 within ~120yr cycle. 0=founding vigor, 1=decadent collapse. */
  khaldunPhase: number;
  /** Turchin structural-demographic: 0-1 within ~250yr cycle. */
  turchinPhase: number;
  /** Corporate GDP as fraction of total sphere GDP (0=none, >0.5=corporate dominance). */
  corporateShare: number;
  /** Religious movement intensity (0=secular, 1=fundamentalist). */
  religiousIntensity: number;
}
```

- Updates **once per year** (slow-moving backdrop, not micro-managed)
- Era transitions drive major state shifts (see era profiles below)
- Climate cycles: 3-7 year duration, random trend -1 to +1
- In freeform eternal mode, world events become cyclical oscillations

### Era Profiles

| Era | globalTension | borderThreat | tradeAccess | moscowAttention | ideologyRigidity |
|-----|--------------|-------------|-------------|-----------------|-----------------|
| revolution | 0.7→0.4 | 0.6→0.3 | 0.2 | 0.5 | 0.9 |
| collectivization | 0.3→0.5 | 0.2 | 0.3 | 0.8 | 0.95 |
| industrialization | 0.6→0.85 | 0.4→0.8 | 0.3 | 0.9 | 0.85 |
| great_patriotic | 1.0 | 1.0 | 0.4 (Lend-Lease) | 0.7 (survival focus) | 0.6 |
| reconstruction | 0.5→0.7 | 0.3 | 0.3 | 0.85 | 0.8 |
| thaw_and_freeze | 0.6 | 0.4 | 0.4 | 0.5↔0.7 | 0.5↔0.7 |
| stagnation | 0.5 | 0.3 | 0.4 | 0.6 | 0.6→0.4 |
| the_eternal | cyclical oscillations driven by sphere dynamics | | | | |

### War Context (for realism)

Historical wars include country-level detail — which nations contributed, what battles occurred on the homeland. This makes conscription weight and devastation feel real:
- **WWI (1914-1918)**: Germany + Austria-Hungary on Western/Eastern fronts. Russia fights on own soil.
- **Civil War (1918-1921)**: Internal + foreign intervention (Britain, France, Japan, USA all sent troops)
- **WWII (1941-1945)**: Germany invades. 80% of German military casualties on Eastern Front. 27M Soviet dead. Lend-Lease from USA/Britain.

The WorldAgent tracks per-country contributions to active wars, feeding into conscription pressure and morale.

### Sphere Dynamics (Eternal Mode — Research-Grounded Deep Model)

#### Governance Types

Eight types, each with historical precedent and transition rules:

```typescript
type GovernanceType =
  | 'democratic'     // Elections, liberal institutions (Western sphere post-WWII)
  | 'authoritarian'  // Centralized power, limited participation (historical default)
  | 'oligarchic'     // Rule by wealthy elite (Russia 1990s, many historical states)
  | 'theocratic'     // Religious authority (Iran 1979+, historical caliphates)
  | 'corporate'      // Corporate entities control governance (VOC precedent, neofeudal)
  | 'technocratic'   // Expert-led bureaucracy (Singapore model, EU aspiration)
  | 'communist'      // State ownership, party control (Soviet model, China variant)
  | 'feudal';        // Decentralized lords/vassals (medieval default, neofeudal endpoint)
```

#### Governance Transition Rules (research-grounded)

Each transition has historical precedent:

| From | To | Trigger | Historical Precedent |
|------|-----|---------|---------------------|
| democratic → authoritarian | Elite overproduction + economic crisis | Weimar → Nazi Germany, many Latin American coups |
| democratic → oligarchic | Wealth concentration + institutional capture | Late Roman Republic, Gilded Age USA |
| democratic → theocratic | Religious movement + identity crisis | Iran 1979, Taliban Afghanistan |
| authoritarian → oligarchic | Regime collapse + asset seizure | USSR → Russian Federation 1991 |
| authoritarian → democratic | Revolution + external pressure | Post-WWII Japan/Germany, Color Revolutions |
| oligarchic → corporate | Corporate GDP > state GDP + debt colonialism | VOC Dutch East Indies (1602-1800, governed 2.5M people with 57K employees + 40 warships + 10K soldiers), British East India Company ruled all India |
| corporate → feudal | Platform monopoly + algorithmic dependence | Neofeudalism thesis: rent/debt > profit, 69 of 100 largest economic entities are already corporations |
| any → communist | Revolution from immiseration + vanguard party | Russia 1917, China 1949, Cuba 1959 |
| communist → oligarchic | Stagnation + corruption + collapse | USSR 1991, many post-Soviet states |
| any → theocratic | Identity crisis + religious revival | Saudi founding (Wahhabi), Iran 1979, ISIS |

#### Empire Lifecycle Model

Two overlapping cycle theories drive sphere behavior:

**Ibn Khaldun cycle** (~120 years / 3 generations):
```
founding (strong asabiyyah) → consolidation → luxury/decay → collapse
Generation 1: Hardship forges cohesion. Founders conquer.
Generation 2: Inherits power, remembers struggle. Competent but complacent.
Generation 3: Born in luxury, no memory of hardship. Asabiyyah erodes.
Collapse: Another group with stronger asabiyyah displaces them.
```

**Turchin structural-demographic cycle** (~200-300 years):
```
expansion → peak → stagflation → elite overproduction → crisis → collapse → rebirth
```
Key mechanism: Labor oversupply → falling living standards + too many elites competing for too few positions → political instability. Turchin's 2010 model correctly predicted US instability in the 2020s. 50-year oscillations within larger secular cycles.

**Implementation**: Each sphere tracks TWO cycle positions:
- `khaldunPhase`: 0-1 within 120-year cycle (asabiyyah erosion)
- `turchinPhase`: 0-1 within 250-year cycle (structural-demographic pressure)

When both cycles trough simultaneously → **sphere collapse** (split/fragmentation). When a sphere is in expansion phase with high asabiyyah → **sphere merge** (absorbs weakened neighbors). This creates non-periodic, complex behavior — two overlapping sine waves of different frequencies, modulated by pressure.

#### Sphere Split/Merge Probability Model

**Splits** (fragmentation) — historical pattern: empires fragment along ethnic, linguistic, or geographic fault lines.
- P(split) increases with: governance mismatch between sub-regions, economic inequality within sphere, identity pressure (religious/ethnic), Turchin crisis phase, Khaldun decay phase
- Historical examples: Roman Empire (East/West 395), Mongol Empire (4 khanates within 2 generations), Ottoman collapse (20+ nation-states), USSR dissolution (15 republics), future EU fragmentation (centrifugal forces at strongest since 1950s)

**Merges** (unification) — historical pattern: empires form through CONQUEST, not voluntary union.
- P(merge) increases with: military dominance by one sphere, shared external threat, compatible governance, high trade interdependence, dominant sphere in Khaldun founding phase
- Historical examples: Roman expansion, Mongol conquests, Qin unification of China, British colonial empire, Soviet absorption of Eastern Europe
- **Critical insight from user**: Voluntary unions (like the EU) are historically anomalous and fragile. Most unification happens through force or existential threat.

#### Corporate Emergence (research-grounded)

**The VOC Precedent**: In 1602, the Dutch East India Company was granted sovereign powers — wage war, govern territories, mint coins, maintain armies. By peak: 57,000 employees, 150 merchant ships, 40 warships, governed 2.5 million people. This is NOT speculation — corporations HAVE been sovereign before.

**Modern trajectory**: 69 of 100 largest global economic entities are already corporations. Apple, Microsoft, Amazon dwarf most national GDPs. When corporate revenue exceeds state revenue → debt colonialism → defacto governance.

**Neofeudalism endpoint**: Scholars identify the pattern — rent and debt become more important than profit. Algorithmic dependence replaces personal dependence. Workers become serfs tied to platforms rather than land. The transition from corporate governance to neofeudal governance is the final stage.

```
oligarchic → corporate → neofeudal
(wealth concentration → corporate sovereignty → algorithmic serfdom)
```

This creates a `'corporate'` sphere that is NON-GEOGRAPHIC — it competes with territorial spheres, can overlap them, and eventually fragments them from within.

#### Religious Movements as Sphere-Forming Force

Religious fundamentalism is "inherently totalitarian, seeking to remake all aspects of society and government on religious principles." It creates identity-based spheres that cut ACROSS geographic boundaries.

Historical examples of religious sphere formation:
- Islamic caliphates (multiple iterations, geographic + identity-based)
- Holy Roman Empire (religion + political authority fused)
- Iran 1979 (theocratic revolution from within secular state)
- Hindu nationalism (fragmenting secular Indian democracy)
- Christian nationalism (USA, Brazil, Hungary — cross-cutting Western sphere)

Religious spheres can emerge when identity crisis meets economic dislocation. They don't follow geographic logic — a theocratic movement in one sphere can resonate across all spheres with compatible populations.

#### Geological Timescale (research-grounded)

**Near-term (2025-2100)**: Permafrost thaw. 60%+ of Russia built on frozen soil. By 2050, 45% of Arctic hydrocarbon fields at severe risk. Permafrost thaw releases 10-240 billion tons of carbon. Southern breadbaskets face increased droughts. Paradoxically, newly thawed land is acidic, thin, and unstable — NOT automatically farmable.

**Medium-term (2100-2500)**: Warming opens Arctic, shifts agricultural zones north. Russia potentially becomes more habitable in some areas, less in others. Coastal flooding worldwide shifts population pressures. Sphere dynamics accelerate as resource competition intensifies.

**Long-term (2500-5000+)**: Interglacial period ends → new ice age OR runaway warming. Either scenario eventually makes Russian settlement uninhabitable. Triggers RELOCATION EVENT chain.

**Ultra long-term (5000+)**: Stellar evolution. Solar luminosity increase makes Earth progressively uninhabitable (1 billion years for extreme case, but game can compress). This is the ultimate pressure — leave or die.

### Relocation System (`src/game/relocation/`)

**Core insight**: Relocation is a REUSABLE MECHANIC across all timescales.

The same system architecture handles:
1. **Historical forced transfers** (Stalin-era, political pressure)
2. **Climate relocation** (permafrost collapse, flooding)
3. **Multiple settlements** ("rewarded" for success with MORE responsibility)
4. **Planetary colonies** (Moon, Mars — different terrain/parameters)
5. **Interstellar colonies** (Alpha Centauri+ — extreme version)

**Why this works architecturally**: The game already stores buildings/population as abstract data, rendering only what's in viewport. A second settlement is just a second data store with its own grid, terrain parameters, and agent state. The viewport switches between them.

#### Historical Relocation Precedent (Stalin Era)

Between 1930-1950, the NKVD forcibly relocated ~3.5 million people across 40+ ethnic groups:
- **Dekulakization (1929-1933)**: 1.8M people deported to Siberia/Kazakhstan/Urals for forced labor and agricultural colonization
- **Ethnic deportations (1935-1944)**: Volga Germans (438K), Chechens/Ingush (490K), Crimean Tatars (200K), Koreans (172K) — mortality rates 10-40%
- **Virgin Lands Campaign (1954-1963)**: 300K+ volunteers/conscripts sent to Kazakhstan to farm marginal steppe land

These are NOT just flavor text — they're game mechanics:
- Political pressure builds → Moscow decides YOUR people are "unreliable" → forced relocation directive
- You must manage the exodus: who goes, what resources transfer, mortality during transit
- New settlement starts with harsh conditions, existing settlement continues (or doesn't)

#### Multi-Settlement Mechanic

**The Party "rewards" success**: Once you stabilize one settlement, Moscow promotes you to oversee ANOTHER. Classic Soviet bureaucratic logic — you've done such a fine job, now do it twice.

```typescript
interface Settlement {
  id: string;
  name: string;
  grid: GameGrid;             // terrain, buildings, roads
  agents: AgentState;         // full agent tree per settlement
  pressureState: PressureState;
  population: number;
  terrain: TerrainProfile;    // climate zone, soil quality, elevation, etc.
  distance: number;           // from other settlements (affects transfer logistics)
  /** Is this a colony on another body? */
  celestialBody?: 'earth' | 'moon' | 'mars' | 'titan' | 'exoplanet';
}
```

Each settlement runs its OWN agent tree, pressure system, and world context. Player switches viewport between settlements. Resources can transfer between settlements (with logistics cost proportional to distance). Moscow's quotas now span ALL settlements — meeting quota from Settlement A doesn't exempt Settlement B.

#### Celestial Scaling (deep future)

Moon/Mars/exoplanet colonies are the SAME mechanic with different `TerrainProfile`:

| Parameter | Earth (Siberia) | Moon | Mars | Titan | Exoplanet |
|-----------|-----------------|------|------|-------|-----------|
| gravity | 1.0 | 0.16 | 0.38 | 0.14 | variable |
| atmosphere | breathable | none | thin CO2 | thick N2/CH4 | variable |
| water | rivers/snow | ice deposits | subsurface | methane lakes | variable |
| farming | soil-based | hydroponics | greenhouse | impossible | variable |
| construction | standard | pressurized domes | pressurized domes | pressurized domes | variable |
| base survival cost | low | extreme | very high | extreme | variable |

The agent tree adapts: FoodAgent checks if farming is possible, PowerAgent accounts for solar distance, WeatherAgent uses different climate models. But the STRUCTURE is identical — pressure accumulates, crises emerge, quotas arrive from Moscow (or whatever central authority exists by then).

### Cold Branches (`src/ai/agents/core/worldBranches.ts`)

Pre-scripted divergence points that exist **dormant** in the timeline. They activate automatically when pressure conditions match — not on fixed dates, not by dice roll. The game *discovers* them organically.

```typescript
interface ColdBranch {
  id: string;
  name: string;
  /** Activation conditions — ALL must be true simultaneously. */
  conditions: {
    pressureThresholds?: Partial<Record<PressureDomain, number>>;
    worldStateConditions?: Partial<Record<keyof WorldState, { min?: number; max?: number }>>;
    sphereConditions?: { sphere: SphereId; governance?: GovernanceType; hostility?: { min?: number } }[];
    yearRange?: { min: number; max?: number };
    /** Sustained duration in ticks before activation. */
    sustainedTicks?: number;
  };
  /** What happens when the branch activates (merges onto timeline). */
  effects: {
    sphereChanges?: { splits?: SphereId[]; merges?: [SphereId, SphereId][] };
    worldStateOverrides?: Partial<WorldState>;
    pressureSpikes?: Partial<Record<PressureDomain, number>>;
    crisisDefinition?: CrisisDefinition;
    narrative: { pravdaHeadline: string; toast: string };
    relocation?: { type: 'forced_transfer' | 'climate_exodus' | 'colonial_expansion' | 'interstellar'; targetTerrain: TerrainProfile };
    newSettlement?: boolean;
  };
  /** Once activated, stays activated (no re-trigger). */
  oneShot: boolean;
}
```

#### Cold Branch Catalog (research-grounded)

**Geopolitical Branches:**

| Branch | Conditions | Effects | Historical Basis |
|--------|-----------|---------|-----------------|
| WWIII | globalTension > 0.9 + borderThreat > 0.8 + year > 1960 | Massive conscription, infrastructure destruction, sphere realignment | Cold War escalation scenarios, Berlin Crisis, Cuban Missile Crisis |
| Great Depression II | economic pressure > 0.8 + commodityIndex < 0.4 sustained 24 ticks | Sphere fragmentation, authoritarian drift across all spheres, trade collapse | 1929 crash → fascism in Europe, 2008 → populist surge |
| EU Dissolution | European sphere + governance=democratic + Turchin crisis phase + economic > 0.6 | European sphere splits into 3-4 sub-spheres (Nordic, Mediterranean, Central, Eastern) | Current centrifugal forces at strongest since 1950s, Euroscepticism, zero-growth trap |
| Eurasian Unification | European + Eurasian spheres < 0.3 hostility + trade > 0.7 + shared external threat | Sphere merge, economic boom | Historical pattern: empires form through shared threat, not voluntarism |
| Pan-Asian Hegemony | Sinosphere military > 0.9 + Western sphere in Turchin collapse | Trade route realignment, new world order | Historical precedent of Chinese centrality in pre-colonial Asian order |

**Corporate/Economic Branches:**

| Branch | Conditions | Effects | Historical Basis |
|--------|-----------|---------|-----------------|
| Corporate Sovereignty | corporate GDP > 2× any state sphere + year > 2030 | Non-geographic corporate sphere emerges with sovereign powers | VOC governed 2.5M people with 57K employees; 69 of 100 largest economic entities already corporations |
| Debt Colonialism Wave | corporate sphere + economic > 0.7 in 3+ state spheres | Corporate sphere buys sovereign debt → defacto control over debtor nations | Vulture funds blocking sovereign debt restructuring; Ashmore owning 25%+ of Lebanon's eurobonds |
| Neofeudal Transition | corporate governance sustained 100+ years + tech > 0.8 | Corporate → feudal governance shift, algorithmic serfdom, new class structure | Scholarly consensus on rent > profit, platform dependence replacing land dependence |

**Religious/Identity Branches:**

| Branch | Conditions | Effects | Historical Basis |
|--------|-----------|---------|-----------------|
| Islamic Renaissance | Middle Eastern sphere + theocratic governance + hostility > 0.7 | New identity-based sphere cuts across geography, religious pressure wave | Caliphate formations, OIC hijacking by Iran/Pakistan, ISIS territorial ambitions |
| Christian Nationalist Surge | Western sphere + democratic governance + Turchin elite overproduction | Western sphere internal split (secular vs. theocratic factions) | US Christian nationalism, Brazilian evangelicalism, Hungarian Orbán model |
| Hindu Hegemony | Sinosphere + authoritarian/theocratic drift in India sub-region | Sinosphere fragments along religious lines | BJP Hindu nationalism transforming secular Indian democracy |

**Climate/Geological Branches:**

| Branch | Conditions | Effects | Historical Basis |
|--------|-----------|---------|-----------------|
| Permafrost Collapse | climateTrend > 0.5 sustained 50+ years + year > 2050 | Infrastructure destruction (45% of Arctic extraction at risk), disease outbreaks (anthrax from thawed burial grounds), RELOCATION EVENT | 60%+ of Russia on permafrost; 200+ anthrax burial grounds in permafrost |
| Siberian Exodus | climateTrend > 0.8 sustained 100+ years + food > 0.9 + infrastructure > 0.9 | Mandatory RELOCATION — entire settlement moves, new grid with different terrain | Southern breadbaskets drought + thawed land too acidic for farming |
| New Ice Age | climateTrend < -0.8 sustained 200+ years | Frozen tundra expansion, resource scarcity, sphere consolidation around equatorial regions | Interglacial cycles, Younger Dryas precedent |
| Nuclear Winter | any nuclear accident black swan + globalTension > 0.7 | Multi-sphere collapse, climateTrend forced to -1.0, 50-year recovery | Chernobyl impact, nuclear winter modeling |

**Technology/Expansion Branches:**

| Branch | Conditions | Effects | Historical Basis |
|--------|-----------|---------|-----------------|
| AI Singularity | techLevel > 0.95 + year > 2040 | Governance disruption, labor crisis, corporate sphere dominance | Current AI trajectory, labor displacement concerns |
| Lunar Colony Directive | techLevel > 0.7 + any sphere military > 0.8 + year > 2030 | Moscow (or central authority) orders Moon colony — NEW SETTLEMENT with lunar terrain | Space race logic, lunar resource competition |
| Mars Colonization | techLevel > 0.8 + lunar colony established + year > 2060 | NEW SETTLEMENT with Martian terrain profile | Direct extension of lunar mechanics |
| Interstellar Ark | techLevel > 0.99 + Earth becoming uninhabitable OR corporate sphere in expansion | NEW SETTLEMENT with exoplanet terrain, decades-long transit (time skip) | Generation ship concepts, Fermi paradox |

**Historical/Political Branches (fire during known eras):**

| Branch | Conditions | Effects | Historical Basis |
|--------|-----------|---------|-----------------|
| Dekulakization Purge | era=collectivization + political > 0.5 | Forced relocation of "kulaks" from your settlement, population loss, new settlement assignment | 1.8M deported 1929-1933, mortality rates 10-40% |
| Ethnic Deportation | era=great_patriotic + political > 0.6 + loyalty < 0.4 | Moscow deports "unreliable" ethnic group from settlement, severe morale/loyalty hit | Volga Germans, Chechens, Crimean Tatars — 3.5M total |
| Virgin Lands Assignment | era=thaw_and_freeze + food > 0.6 | "Promotion" — you're assigned a SECOND settlement on marginal steppe land | Khrushchev's 1954-1963 campaign, 300K+ sent to Kazakhstan |
| Moscow Promotion | any era + settlement thriving + political < 0.3 | Party "rewards" success with managing additional settlement simultaneously | Classic Soviet bureaucratic "reward" — more responsibility |

Each playthrough discovers different branches. The combination creates emergent narrative: "What if the EU dissolved during a corporate sovereignty wave?" vs "What if the Virgin Lands assignment happened right before WWIII?" vs "What if the Siberian Exodus forced you to relocate your three settlements to Mars?"

---

## 2. PressureSystem (`src/ai/agents/crisis/pressure/`)

Pure-function module (NOT a Yuka agent). Reads existing agent metrics → normalizes → accumulates.

### 10 Pressure Domains

`food | morale | loyalty | housing | political | power | infrastructure | demographic | health | economic`

Each normalized to 0-1 from metrics **already computed every tick**:

| Domain | Source (already exists) | Normalization |
|--------|----------------------|---------------|
| food | `FoodAgent.getFoodState()`, starvation counter | surplus=0, stable=0.2, rationing=0.5, starvation=0.8+(counter/90)*0.2 |
| morale | `WorkerSystem.getAverageMorale()` (0-100) | `1 - morale/100` |
| loyalty | `LoyaltyAgent.getAvgLoyalty()`, sabotage/flight counts | `(1-loyalty/100)*0.7 + min(1,(sabotage+flight)/10)*0.3` |
| housing | `population / housingCapacity` | `clamp((ratio-0.8)/0.7, 0, 1)` |
| political | `KGBAgent.getSuspicionLevel()`, marks, blat | `max(suspicion, marks/7, blat/30)` |
| power | `PowerAgent.isInShortage()`, unpowered count | `shortage ? min(1, unpowered/total + 0.3) : 0` |
| infrastructure | Average building durability | `1 - avgDurability/100` |
| demographic | `DemographicAgent.getGrowthRate()`, labor ratio | `clamp(-growth*20,0,1)*0.5 + (1-laborRatio)*0.5` |
| health | Active sick / population | `min(1, sickRatio*5)` |
| economic | Quota deficit, production trends | `clamp(quotaDeficit,0,1)*0.6 + (1-prodTrend)*0.4` |

### Dual-Spread Accumulation

Like the food allocation system (baseline uniform + spiked biased):

- **Layer 1 (Uniform)**: `BASELINE = 0.002` added to ALL domains per tick. Systemic entropy — the Soviet system always decays.
- **Layer 2 (Spiked)**: `BUDGET = 0.008` distributed proportionally to current pressure levels. Stressed domains attract MORE pressure. Positive feedback loop.
- **World modifier**: Multiplier from WorldAgent per domain (1.0 = neutral).
- **Venting**: Pressure decreases when raw readings improve (player fixes the problem).
- **EMA smoothing**: α=0.15 for trend detection.

```
pressureNext = pressureCurrent * 0.95  // natural 5% decay
             + rawReading * 0.3         // instantaneous conditions
             + (baseline + spiked) * worldModifier  // accumulation
             - ventAmount               // relief from improvement
```

### Thresholds

| Level | Threshold | Effect |
|-------|-----------|--------|
| Warning | 0.50 | Minor incidents after 6 ticks (~0.5 year) |
| Critical | 0.75 | Major crisis after 12 ticks (~1 year) |
| Emergency | 0.90 | Major crisis fast-tracked after 3 ticks |

---

## 3. Major vs Minor Crises

Each domain maps to both a minor incident and a major crisis:

| Domain | Minor (warning) | Major (critical) |
|--------|----------------|-------------------|
| food | Temporary Food Shortfall | Famine |
| morale | Worker Unrest | Worker Revolt |
| loyalty | Sabotage Wave | Mass Defection |
| housing | Overcrowding Complaints | Housing Crisis |
| political | Party Scrutiny | Political Purge |
| power | Rolling Blackouts | Power Grid Collapse |
| infrastructure | Accelerated Decay | Infrastructure Crisis |
| demographic | Labor Shortage | Demographic Collapse |
| health | Disease Outbreak | Epidemic |
| economic | Production Shortfall | Economic Crisis |

Minor incidents are warnings — Pravda headlines, advisor messages, small morale hits. Major crises produce real `CrisisImpact` tickets through the existing WarAgent/FamineAgent/DisasterAgent pipeline.

---

## 4. Climate Events (Tier 2) — `src/ai/agents/crisis/ClimateEventSystem.ts`

Pattern-driven natural events. ADD pressure but aren't caused by player neglect.

Each event has: valid seasons, weather boosts, climate trend range, and pressure contributions.

| Event | Valid Seasons | Weather Boost | Climate Trend |
|-------|-------------|--------------|---------------|
| Severe Frost | WINTER, EARLY_FROST | BLIZZARD ×2.0 | -1.0 to -0.2 (cooling) |
| Summer Drought | STIFLING_HEAT, GOLDEN_WEEK | HEATWAVE ×2.5 | -0.8 to -0.1 |
| Spring Flood | RASPUTITSA_SPRING | MUD_STORM ×2.0 | 0.2 to 1.0 (wet) |
| Seasonal Epidemic | WINTER, RASPUTITSA_AUTUMN | FOG ×1.5 | any |
| Wildfire | STIFLING_HEAT | HEATWAVE ×3.0, CLEAR ×1.5 | -1.0 to 0.0 (dry) |
| Hailstorm | SHORT_SUMMER | RAIN ×2.0 | any |

Evaluated every tick. Season/weather gates ensure events only fire when climatically appropriate (no blizzard_burial in June).

---

## 5. Black Swans (Tier 3) — `src/ai/agents/crisis/BlackSwanSystem.ts`

**NO artificial gates.** No minimum intervals. No "once per era" rules. Just incredibly low per-tick probability. If two meteors hit in consecutive years, that happened.

| Event | Prob/tick | ~Prob/year | ~Prob/60yr | Notes |
|-------|----------|-----------|-----------|-------|
| Meteor Strike | 0.001 | ~1.2% | ~50% | Maybe once per playthrough |
| Earthquake | 0.0008 | ~1.0% | ~42% | Magnitude 4-8 |
| Solar Storm | 0.0005 | ~0.6% | ~30% | Power grid devastation |
| Nuclear Accident | 0.0003 | ~0.4% | ~20% | Post-1954 only, era-scaled |
| Supervolcanic Ash | 0.0001 | ~0.1% | ~7% | Global cooling, food crisis |

Each generates a one-tick `CrisisImpact` plus a pressure spike across relevant domains.

---

## Files

### New Files

| File | Purpose | ~Lines |
|------|---------|--------|
| **Pressure System** | | |
| `src/ai/agents/crisis/pressure/PressureDomains.ts` | Domain types, PressureGauge, PressureState | 80 |
| `src/ai/agents/crisis/pressure/pressureNormalization.ts` | Pure functions: existing metrics → 0-1 | 180 |
| `src/ai/agents/crisis/pressure/pressureAccumulation.ts` | Dual-spread model, EMA, venting | 150 |
| `src/ai/agents/crisis/pressure/pressureThresholds.ts` | Warning/critical/emergency constants | 40 |
| `src/ai/agents/crisis/pressure/PressureCrisisEngine.ts` | Gauge monitoring → crisis emergence (replaces ChaosEngine) | 250 |
| `src/ai/agents/crisis/pressure/pressureCrisisMapping.ts` | Domain → minor/major crisis templates | 300 |
| `src/ai/agents/crisis/pressure/PressureSystem.ts` | Orchestrator: reads + accumulates + exports | 200 |
| **WorldAgent** | | |
| `src/ai/agents/core/WorldAgent.ts` | World state, sphere dynamics, governance drift, cycle tracking, pressure modifiers | 500 |
| `src/ai/agents/core/worldCountries.ts` | Country/sphere data for 1917 + merge rules + governance transitions | 300 |
| `src/ai/agents/core/worldBranches.ts` | Cold branch catalog — all dormant divergence points + activation logic | 400 |
| `src/ai/agents/core/sphereDynamics.ts` | Khaldun/Turchin cycle engine, split/merge probability, corporate emergence | 350 |
| **Event Systems** | | |
| `src/ai/agents/crisis/ClimateEventSystem.ts` | Tier 2: seasonal/weather pattern-driven events | 200 |
| `src/ai/agents/crisis/BlackSwanSystem.ts` | Tier 3: pure low-probability, no gates | 250 |
| **Relocation** | | |
| `src/game/relocation/Settlement.ts` | Settlement type, TerrainProfile, multi-settlement state | 150 |
| `src/game/relocation/RelocationEngine.ts` | Settlement creation, viewport switching, resource transfer, transit mortality | 300 |
| `src/game/relocation/terrainProfiles.ts` | Terrain configs: Siberia, steppe, lunar, Martian, exoplanet | 200 |
| **Tests** (8 files) | pressure, crisis-engine, world-agent, sphere-dynamics, climate, black-swan, cold-branches, relocation | ~1500 |

### Modified Files

| File | Change |
|------|--------|
| `src/ai/agents/crisis/Governor.ts` | Add `PressureReadContext` to `GovernorContext` |
| `src/ai/agents/crisis/FreeformGovernor.ts` | Replace ChaosEngine with PressureSystem + WorldAgent + Climate + BlackSwans |
| `src/ai/agents/crisis/HistoricalGovernor.ts` | Add pressure reading for severity modulation; add cold branch evaluation for historical branches |
| `src/ai/agents/crisis/types.ts` | Add `'climate'`, `'black_swan'`, `'cold_branch'` to CrisisType |
| `src/game/engine/phaseChronology.ts` | Assemble PressureReadContext from existing agents; evaluate cold branches |
| `src/game/engine/tickContext.ts` | Add WorldAgent to agents block |
| `src/game/SimulationEngine.ts` | Instantiate WorldAgent, wire to governor, manage Settlement[] |
| `src/game/engine/types.ts` | Add Settlement, TerrainProfile, WorldState to serializable types |

### Preserved (no changes)

- `CrisisImpactApplicator.ts` — consumes standard CrisisImpact[], format-agnostic
- `WarAgent.ts`, `FamineAgent.ts`, `DisasterAgent.ts` — consumers of CrisisDefinitions, work identically
- `TimelineSystem.ts` — records events from all three tiers
- `ChaosEngine.ts` — deprecated with `@deprecated` JSDoc, kept for old save compat

---

## Implementation Sequence

### Phase 1: Foundation (pure functions, no behavioral changes)
1. `PressureDomains.ts` — types + interfaces
2. `pressureNormalization.ts` — all 10 domain formulas
3. `pressureAccumulation.ts` — dual-spread + venting
4. `PressureSystem.ts` — orchestrator
5. Unit tests for normalization + accumulation

### Phase 2: WorldAgent Core
1. `worldCountries.ts` — 1917 country/sphere data + governance types + transition rules
2. `sphereDynamics.ts` — Khaldun/Turchin cycle engine, split/merge probability, corporate share tracking
3. `WorldAgent.ts` — state model, era evolution, climate cycles, `computePressureModifiers()`
4. Register in SimulationEngine
5. Unit tests for sphere dynamics + governance transitions

### Phase 3: Crisis Engine
1. `pressureCrisisMapping.ts` — 10 domain templates (minor + major)
2. `PressureCrisisEngine.ts` — emergence logic with severity scaling
3. `pressureThresholds.ts`
4. Unit tests

### Phase 4: Climate Events + Black Swans
1. `ClimateEventSystem.ts` — seasonal patterns
2. `BlackSwanSystem.ts` — pure probability, no gates
3. Move meteor logic from FreeformGovernor to BlackSwanSystem
4. Unit tests

### Phase 5: Cold Branches
1. `worldBranches.ts` — full branch catalog (geopolitical, corporate, religious, climate, technology, historical)
2. Branch evaluation engine (condition matching, sustained-tick tracking, activation)
3. Wire into Governor evaluation pipeline
4. Unit tests for branch activation

### Phase 6: Relocation System
1. `Settlement.ts` — Settlement type, TerrainProfile
2. `terrainProfiles.ts` — Siberia/steppe/lunar/Martian/exoplanet configs
3. `RelocationEngine.ts` — settlement creation, viewport switching, resource transfer
4. Wire multi-settlement into SimulationEngine tick loop
5. Unit tests

### Phase 7: Integration
1. Extend `GovernorContext` with `PressureReadContext` + `WorldState`
2. Assemble context in `phaseChronology.ts`
3. Rewrite `FreeformGovernor.evaluate()` internals (keep interface)
4. Add pressure reading to `HistoricalGovernor`
5. Deprecate `ChaosEngine.ts`
6. Integration tests

### Phase 8: Serialization + Polish
1. Serialize/restore PressureState + WorldState + Settlement[] + activatedBranches for save/load
2. Add pressure snapshot to `SettlementSummary` for future UI
3. Tune constants via playthrough tests
4. Old saves load with default state (single settlement, all pressures zero, 1917 world state)

---

## Verification

1. `npx tsc --noEmit` — zero type errors
2. `npm test -- --no-coverage` — all tests pass (existing + new)
3. Playthrough test: run 50-year historical + freeform, verify:
   - Pressure gauges accumulate when conditions worsen
   - Minor incidents fire at warning threshold
   - Major crises emerge at critical threshold
   - Climate events follow seasonal patterns (no blizzard in summer)
   - Black swans are genuinely rare (~0-2 per 50 years)
   - WorldAgent state shifts with eras
   - Historical crises ADD pressure (Holodomor spikes food + morale)
   - Sphere governance drifts based on Khaldun/Turchin cycles
   - Cold branches activate when conditions match (not on fixed dates)
   - At least one cold branch fires in a 100-year freeform run
4. Old saves load with default state (all zeros, single settlement)
5. Extended freeform test (1917→2200): verify sphere dynamics produce non-trivial world evolution — governance changes, at least one sphere split or merge, corporate emergence possible
