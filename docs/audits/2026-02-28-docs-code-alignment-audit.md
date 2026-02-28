# SimSoviet 1917 — Comprehensive Docs-vs-Code Alignment Audit

**Date:** 2026-02-28
**Scope:** All 39+ design documents vs full codebase implementation
**Method:** 6-agent parallel divide-and-conquer audit (Game Init, Economy, Workers, Political, UI/UX, Minigames/Scoring/Audio)

---

## EXECUTIVE SUMMARY

**Overall Alignment: ~40-50%**

The codebase has impressive structural coverage — ECS entities, building definitions, UI panels, political systems, scoring, minigames, and audio all exist. However, many systems are **skeleton implementations** (data structures present, logic disconnected) and the game's **fundamental identity** has drifted from the design vision:

| What Docs Describe | What Code Implements |
|---|---|
| Worker-management survival sim ("workers ARE the game") | Traditional 3D city-builder with information panels |
| Household-centric (dvory as unit of play) | Individual citizen model, dvory exist but unused |
| Start from nothing in 1917, build your first barracks | Pre-placed 11 industrial buildings in 1922 |
| Autonomous collective with behavioral governor | Silent background governor with no player visibility |
| "Stop the bleeding" core loop (drains vs inflows) | No migration, no flight, no automatic pressure |
| Interactive political antagonists | Passive modifier engines and skeleton entities |
| Universal radial context menu | Two separate radial components + legacy inspector panel |
| Interactive minigames (Oregon Trail, Papers Please, timing) | All 17 minigames are text-choice modals |

---

## SECTION 1: GAME INIT & STARTING STATE

### CRITICAL Issues

| # | Issue | Docs Say | Code Does |
|---|-------|----------|-----------|
| 1 | **Start year** | 1917 (game is literally called "SimSoviet 1917") | 1922 — skips entire Revolution era |
| 2 | **Starting buildings** | "No buildings, undeveloped land" | 11 pre-placed buildings from 6 different eras |
| 3 | **Era timeline** | Revolution->Collectivization->Industrialization->... (8 eras from 1917) | War Communism->First Plans->... (different 8 eras from 1922, adds Perestroika, merges Collectivization+Industrialization) |
| 4 | **Starting resources** | "Timber only. No steel, no power." | 800 food, 150 timber, 60 steel, 30 cement |
| 5 | **Era 1 buildings available** | Kolkhoz HQ, wooden barracks, watchtower, well, granary | power-station, workers-house, apartment-tower, concrete-block (no well, watchtower, granary) |
| 6 | **Chairman dvor** | Comrade Orlov, Party appointee, 11th dvor | Never created |
| 7 | **Resource multipliers** | Worker=2.0x, Tovarish=0.5x | Worker=1.5x, Tovarish=0.7x |

### Era Timeline Comparison

| # | Doc Era | Doc Years | Code Era ID | Code Years |
|---|---------|-----------|-------------|------------|
| 1 | Revolution | 1917-1922 | `war_communism` | 1922-1928 |
| 2 | Collectivization | 1922-1932 | `first_plans` | 1928-1941 |
| 3 | Industrialization | 1932-1941 | (merged into first_plans) | — |
| 4 | Great Patriotic War | 1941-1945 | `great_patriotic` | 1941-1945 |
| 5 | Reconstruction | 1945-1956 | `reconstruction` | 1945-1953 |
| 6 | Thaw & Freeze | 1956-1982 | `thaw` | 1953-1964 |
| 7 | Stagnation | 1982-2000 | `stagnation` | 1964-1985 |
| 8 | The Eternal | 2000+ | `perestroika` (EXTRA) | 1985-1991 |
| — | — | — | `eternal_soviet` | 1991+ |

### Starter Buildings (All Wrong per Docs)

| Building | Era Available (docs) | Issue |
|----------|---------------------|-------|
| power-station | Era 3 (Industrialization) | Not available until Era 3; docs say no power in Era 1 |
| apartment-tower-a | Era 5 (Reconstruction) | Requires pgt tier |
| apartment-tower-c | Era 7 (Stagnation) | Requires gorod tier |
| factory-office | Era 3 (Industrialization) | Requires posyolok tier |
| vodka-distillery | Era 7 (Stagnation) | Requires pgt tier |
| radio-station | Era 7 (Stagnation) | Requires pgt tier |
| gulag-admin | Era 3 (Industrialization) | Requires posyolok tier; historically wrong for 1917 |

---

## SECTION 2: ECONOMY & RESOURCES

### Dead Code — Systems Built But Never Wired Into Game Loop

| System | Status | Detail |
|--------|--------|--------|
| **Remainder Allocation** | Code exists, never called | `allocateRemainder()` exists but `tick()` never invokes it. Core economic tension absent. |
| **Compulsory Deliveries** | Code exists, unreachable | `applyDeliveries()` calculates state extraction but SimulationEngine never calls it |
| **Heating fuel** | UI layer only | `processHeating()` returns fuelConsumed but value never deducted from resources |
| **Currency reforms** | Dead code | `checkCurrencyReform()` implemented but disconnected from engine loop |
| **MTS grain payment** | Structure only | 1.3x grain multiplier computed but never applied to food production |
| **Ration cards** | Data layer only | Calculated but never deducted from food consumption |

### Missing/Incomplete Economic Systems

| System | Doc Vision | Code Reality |
|--------|-----------|-------------|
| Trudodni -> morale | Workers paid from remainder proportional to trudodni | Trudodni tracked but meaningless to gameplay |
| Vodka/grain diversion | 2 grain -> 1 vodka (key tension) | Vodka produced independently, no grain cost |
| Quota system | Multi-resource 5-year plans | Single quota value |
| Blat spending | 5 purposes (delivery, quota, protection, goods, trading) | Only 'improve_delivery' works (20% implemented) |
| Storage/spoilage | Food decays 5%/tick beyond capacity, seasonal modifiers | Missing entirely |
| Production formula | baseRate x workers x skill x season x doctrine x condition | baseRate x workers x modifier (simplified) |

---

## SECTION 3: WORKERS & POPULATION

**~45% implemented. Core "stop the bleeding" loop entirely missing.**

### Missing Entirely (CRITICAL)

| System | Design Vision | Status |
|--------|--------------|--------|
| **Migration/flight** | Workers flee when morale drops below threshold | Missing — core survival mechanic absent |
| **Youth flight drain** | ~1 per 120 ticks when morale allows | Missing — 1 of 6 documented drains absent |
| **KGB worker removal** | Flagged workers disappear | Broken — investigations flag but never remove |
| **Moscow assignments** | 3-12 new workers arrive via state decree | Missing |
| **Forced resettlement** | 5-30 hostile workers + families arrive | Missing |
| **Kolkhoz amalgamation** | Neighboring collective merges (20-60 workers) | Missing |
| **Disease system** | Typhus, cholera, scurvy, influenza | Missing — hospitals have no effect |
| **Workplace accidents** | Factories occasionally kill workers | Missing |

### Skeleton Implementations (Data Exists, Logic Missing)

| System | What Exists | What's Missing |
|--------|------------|---------------|
| **Trudodni** | `trudodniEarned` field on DvorMember | Annual minimums, shortfall penalties, career tracking, UI display |
| **Private plots** | `privatePlotSize` on DvorComponent | Food production, morale boost, era-dependent access, commissar raids |
| **Gender system** | Gender tracked on citizens | Gender-based labor assignment, double burden mechanic, conscription exclusion |
| **Pregnancy** | Pregnancy field exists | Never triggers gameplay; babies appear instantly |
| **Behavioral governor** | 5-priority stack exists | No player UI, no feedback, no political capital cost for overrides |
| **Household model** | Dvory created with proper composition | Game treats 55 people as disconnected individuals, not 10 families |

---

## SECTION 4: POLITICAL & APPARATUS

### Implementation Spectrum

| Subsystem | % Implemented | Key Gaps |
|-----------|--------------|----------|
| Politburo modifier pipeline | 95% | No de-[Name]-ization, no modifier clamping |
| Coup/purge formulas | 100% | Exact formula match |
| Leader archetypes | 95% | All 8 types present |
| Power transitions | 90% | No transition phase delay |
| Personnel File core | 90% | Threshold effects not wired to entity spawning |
| Ministry events | 90% | 24 of ~29 templates |
| Pripiski/reporting | 70% | Different mark penalty (+2 vs +3), no blat insurance |
| Military/conscription | 40% | No player choice, no deadline window |
| KGB behavior | 30% | No worker disappearances, informant network, skill targeting |
| Politruk behavior | 15% | Rotate + flat penalty only. No loyalty checks, sessions, personalities |
| Doctrine system | 30% | String labels, no composable policies, no signature mechanics |
| **Raikom system** | **0%** | **Completely missing** |
| **Doctrine signature mechanics** | **0%** | **None of 8 designed mechanics exist** |

### Politruk Design vs Implementation

| Design Vision | Code Reality |
|--------------|-------------|
| 1:20 worker ratio, doctrine/difficulty modifiers | Settlement-tier count (0-5 total) |
| Visit buildings, hold ideology sessions | Rotate to random building every 120 ticks |
| Workers pulled off production for sessions | 15% flat production penalty |
| Loyalty threshold checks per worker | Not implemented |
| Flagged workers become KGB targets | Not implemented |
| 4 personality types (Zealous/Lazy/Paranoid/Corrupt) | All politruks identical |
| Player chooses which workers attend sessions | Not implemented |

---

## SECTION 5: UI/UX & INTERACTION

### CRITICAL Gaps

| Issue | Design Vision | Code Reality |
|-------|-------------|-------------|
| **Radial context menu** | Single unified data-driven component | Two separate components (RadialBuildMenu + RadialInspectMenu) with duplicate logic |
| **Population Browser** | Full-screen with filter tabs, multi-sort, search, bulk actions, tap-to-dossier | WorkerRosterPanel: simple vertical list, no filters/sort/search/bulk/tap |
| **Building interiors** | Type-specific radial data (Production ring, Demographic ring, Records ring) | Basic Info/Workers/Demolish actions only |
| **Map Size selector** | Small 20x20, Medium 30x30, Large 50x50 | Completely missing from NewGameSetup |

### Undocumented Additions

- **24 panel components** exist in code with no design documentation
- **22 icon buttons in TopBar** creating a "button bar" contradicting "thin chrome" design principle
- **Two separate tab bar systems** (TabBar.tsx and Toolbar.tsx) with overlapping concepts

### Other UI Gaps

| Issue | Status |
|-------|--------|
| Toast stacking (3 max, top-right) | Single toast, top-center |
| Edge indicators for off-screen events | Missing |
| Building status badges (red !/yellow lightning/green check) | Missing |
| Household demographic navigation in radial | Missing |
| Citizen Dossier household member list + Reassign action | Missing |
| Advisor naming | "COMRADE VANYA" vs docs "Comrade Krupnik" |
| 2x speed option | Missing (only 0/1/3x) |
| Concrete brutalist viewport frame | Missing |
| CRT scanline overlay during gameplay | Missing |

---

## SECTION 6: MINIGAMES, SCORING & AUDIO

### Scoring: EXCELLENT (95%+ alignment)

Every point value, multiplier, difficulty preset, and consequence preset matches exactly:
- All 9 score sources match (workers +2, quotas +50/+25, buildings +5, commendations +30, marks -40, KGB losses -10, conscripted -5, clean era +100)
- Era multiplier formula exact match (1.0 -> 3.0 linear)
- Score multiplier matrix: all 7+ combinations match
- All 3 difficulty presets match
- All 3 consequence presets match
- 12 medals match count
- 31 achievements (5 hidden) match

### Minigames: MAJOR Architecture Divergence

**All 8 documented minigames are text-choice modals**, not the interactive experiences described:
- The Hunt: Should be Oregon Trail side-scrolling. Is 3-button choice.
- Factory Emergency: Should be timing-based repair. Is 3-button choice.
- The Inspection: Should be Papers Please-style. Is 3-button choice.
- The Queue: Should be drag/drop queue management. Is 3-button choice.

**Duration Issue**: Every single minigame is 50-83% shorter than designed:

| Minigame | Doc Duration | Code tickLimit | Reduction |
|----------|-------------|---------------|-----------|
| Factory Emergency | 30s | 10 ticks | ~67% shorter |
| Interrogation | 90s | 15 ticks | ~83% shorter |
| The Hunt | 60s | 25 ticks | ~58% shorter |
| The Inspection | 90s | 25 ticks | ~72% shorter |
| Black Market | 45s | 15 ticks | ~67% shorter |

**9 undocumented minigames** added beyond the 8 designed (17 total).

### Audio Gaps

| Issue | Status |
|-------|--------|
| Track manifest | 24 of 47 OGG files registered (23 unused on disk) |
| Gameplay rotation | Only 7 tracks in active playlist |
| SFX system | Missing entirely (doc shows `playSFX('build')`) |
| Ambient audio | Missing entirely |
| Voice lines | Missing entirely |
| Era context bug | `eternal_soviet` maps to non-existent `'victory'` context (should be `'triumphant'`) |
| Pravda cooldown | 90s in code vs 45s in docs |

---

## AGGREGATE STATISTICS

| Category | CRITICAL | HIGH | MEDIUM | LOW | Total |
|----------|----------|------|--------|-----|-------|
| Game Init | 3 | 4 | 1 | 0 | **8** |
| Economy | 5 | 7 | 2 | 0 | **14** |
| Workers | 5 | 7 | 5 | 0 | **17** |
| Political | 5 | 5 | 3 | 0 | **13** |
| UI/UX | 4 | 9 | 3 | 3 | **19** |
| Minigames/Scoring/Audio | 1 | 2 | 6 | 3 | **12** |
| **TOTAL** | **23** | **34** | **20** | **6** | **83** |

---

## TOP 10 PRIORITIES (Ordered by Impact)

1. **Fix starting state** — Year 1917, no buildings, timber only, correct era timeline
2. **Wire economy systems into game loop** — Compulsory deliveries, remainder allocation, heating consumption
3. **Implement population drain pressure** — Migration/flight, youth flight, auto-conscription, KGB removal
4. **Activate household-centric gameplay** — Dvory as unit of play, private plots, family resource distribution
5. **Implement trudodni enforcement** — Annual minimums, shortfall penalties, career tracking
6. **Complete politruk/KGB interactive loops** — Ideology sessions, worker disappearances, informant network
7. **Implement Raikom system** — District committee chairman as procedural character
8. **Unify radial context menu** — Single data-driven component replacing BUILD + INSPECT
9. **Fix minigame durations** — Restore designed timing (multiply current by ~2.5-3x)
10. **Implement doctrine signature mechanics** — At least 3-4 of the 8 designed era mechanics

---

## WHAT'S WORKING WELL

Despite the gaps, several systems are excellently implemented:

- **Scoring system** — Near-perfect alignment, every value matches
- **Politburo modifier pipeline** — 95%, rich 80-cell personality x ministry matrix
- **Coup/purge formulas** — 100% exact match
- **Leader archetypes & power transitions** — 90-95%
- **Personnel File core** — 90%, marks/commendations/thresholds/decay all work
- **Pravda headline system** — Full 5-layer architecture, event-reactive
- **Achievement system** — All 31 achievements with correct conditions
- **Starting settlement composition** — 10 dvory with historically accurate family templates
- **Russian name generation** — Proper patronymics, gendered surnames
- **3D scene rendering** — All visual components (terrain, buildings, weather, vehicles, etc.) working
