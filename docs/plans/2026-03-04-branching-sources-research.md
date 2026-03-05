---
type: design
status: draft
---

# Branching Sources Research: Greg Bear, Dune, Firefly

## "The Way extends infinitely. File Form 27-B for access."

### Purpose

This document catalogs cold branch designs inspired by three science fiction universes:
Greg Bear's Eon trilogy, Frank Herbert's Dune, and Joss Whedon's Firefly/Serenity.
Each cold branch follows the `ColdBranch` interface from `src/ai/agents/core/worldBranches.ts`
and uses existing `PressureDomain`, `WorldState`, and `SphereId` types.

All branches activate organically via sustained pressure conditions -- never on fixed dates,
never by dice roll. The game discovers them.

---

## 1. Greg Bear -- The Eon Trilogy (Eon, Eternity, Legacy)

### Source Material Summary

**Eon (1985)**: In 2005, an asteroid dubbed "the Stone" (Thistledown) enters Earth orbit. American
scientists discover it is hollow, containing seven chambers of increasing impossibility. The seventh
chamber extends infinitely -- "The Way," a corridor through parallel realities. The Stone comes from
an alternate future where nuclear war between the US and USSR occurred in 1991. Soviet forces attack
the Stone, triggering the very war its builders tried to prevent. The Jarts, hostile alien
intelligences, occupy parts of The Way.

**Eternity (1988)**: Centuries later, the Way has been sealed after conflict with the Jarts. Factions
debate reopening it. An alternate Earth (Gaia) exists where Alexander the Great's empire never fell --
a Hellenistic world without Christianity or Islam. Time is malleable. The Way can "gate" to any
parallel timeline.

**Legacy (1995)**: Set on Lamarkia, a world colonized through a Way gate. The colonists discover
their planet is a single macro-organism. Isolation from the Way forces adaptation. Colonial politics
echo Soviet central planning vs. frontier pragmatism.

### SimSoviet Relevance

The Eon trilogy is uniquely suited to SimSoviet because:
- The Stone discovery is a Soviet-American cold war flashpoint
- The Way is literally an infinite expansion mechanism (matches freeform eternal mode)
- The Jarts are hostile aliens that force militarization and resource drain
- Parallel timelines justify alternate-history branches
- Lamarkia's colonial isolation mirrors the player's remote settlement experience

### Cold Branch Designs

**Branch: stone_discovery**
- id: `stone_discovery`
- Trigger conditions:
  - `worldStateConditions`: `techLevel >= 0.65`
  - `yearRange`: `{ min: 1990 }`
  - `pressureThresholds`: `{ political: 0.3 }`
  - `sustainedTicks`: 12
- Effects:
  - `worldStateOverrides`: `{ globalTension: 0.85, moscowAttention: 0.9 }`
  - `pressureSpikes`: `{ political: 0.25, economic: 0.15, morale: -0.1 }`
  - Narrative: Space race intensifies, Moscow demands your settlement contribute personnel
    and resources to the Thistledown mission. Population drain, but morale boost from
    Soviet pride.
- Pravda headline: ANOMALOUS ASTEROID DETECTED IN EARTH ORBIT -- SOVIET COSMONAUTS DISPATCHED. ALL SETTLEMENTS CONTRIBUTE ENGINEERS.
- Toast: "Moscow requisitions your best engineers for the Thistledown mission. They won't be coming back."
- Historical/SF basis: Greg Bear, *Eon* (1985) -- the Stone/Thistledown enters Earth orbit

---

**Branch: way_opens**
- id: `way_opens`
- Trigger conditions:
  - `worldStateConditions`: `techLevel >= 0.8`
  - `yearRange`: `{ min: 2010 }`
  - Requires `stone_discovery` already activated (checked via `worldStateConditions` or
    pre-branch activation tracking)
  - `sustainedTicks`: 6
- Effects:
  - `worldStateOverrides`: `{ tradeAccess: 0.9, techLevel: 0.95 }`
  - `pressureSpikes`: `{ economic: -0.15, political: 0.2, loyalty: 0.15 }`
  - Narrative: The seventh chamber opens. Infinite parallel Earths accessible. Moscow
    scrambles to control access. Your settlement is reassigned as a Way-access
    logistics hub. Technology leaps forward but ideological control tightens --
    if citizens can see alternate realities where the USSR fell, loyalty crumbles.
- Pravda headline: INFINITE CORRIDOR DISCOVERED INSIDE ASTEROID -- SOVIET SCIENCE TRIUMPHANT. CITIZENS REMINDED THAT CURIOSITY IS NOT A RIGHT.
- Toast: "The Way is open. Infinite parallel realities exist. Moscow has classified all of them."
- Historical/SF basis: Greg Bear, *Eon* -- the Way (seventh chamber) extends infinitely through spacetime

---

**Branch: jart_incursion**
- id: `jart_incursion`
- Trigger conditions:
  - `worldStateConditions`: `techLevel >= 0.85, globalTension >= 0.5`
  - `yearRange`: `{ min: 2020 }`
  - Requires `way_opens` already activated
  - `sustainedTicks`: 4
- Effects:
  - `pressureSpikes`: `{ demographic: 0.3, infrastructure: 0.25, food: 0.15, morale: 0.3, political: 0.2 }`
  - `crisisDefinition`: type `war`, severity `existential`, conscriptionRate 0.25,
    productionMult 1.5 (wartime mobilization), bombardmentRate 0.03
  - Narrative: Hostile alien intelligences (the Jarts) push through the Way. Moscow
    orders total mobilization. Your settlement becomes a staging ground. Alien
    technology wrecks infrastructure but captured specimens advance science.
    KGB suspects Jart sympathizers in every collective.
- Pravda headline: ALIEN AGGRESSION REPELLED BY HEROIC SOVIET DEFENDERS -- ENEMY CASUALTIES IN THE TRILLIONS. VICTORY IMMINENT.
- Toast: "The Jarts are coming through the Way. They don't negotiate. Moscow says hold the line."
- Historical/SF basis: Greg Bear, *Eon/Eternity* -- the Jarts, hostile intelligences occupying the Way

---

**Branch: nuclear_exchange_1991**
- id: `nuclear_exchange_1991`
- Trigger conditions:
  - `worldStateConditions`: `globalTension >= 0.95, borderThreat >= 0.9`
  - `yearRange`: `{ min: 1988, max: 1995 }`
  - `sustainedTicks`: 3
- Effects:
  - `pressureSpikes`: `{ demographic: 0.4, infrastructure: 0.35, food: 0.3, health: 0.3, morale: 0.35 }`
  - `crisisDefinition`: type `war`, severity `existential`, bombardmentRate 0.08,
    foodDrain 80, infrastructureDamageRate 0.06
  - Narrative: The Stone's original timeline manifests. The nuclear war that the
    Thistledown builders tried to prevent actually happens. Your remote settlement
    survives because nobody wastes a warhead on it. Radiation, fallout, supply
    chain collapse. You are now the center of Soviet continuity.
  - `relocation`: type `forced_transfer`, breathable atmosphere, rivers, soil, baseSurvivalCost `very_high`
  - `newSettlement`: true (fallout forces relocation)
- Pravda headline: STRATEGIC NUCLEAR EXCHANGE CONCLUDED SUCCESSFULLY -- CASUALTIES WITHIN ACCEPTABLE PARAMETERS. LONG LIVE THE SOVIET UNION.
- Toast: "Nuclear war. Your settlement survived because it wasn't worth targeting. Congratulations."
- Historical/SF basis: Greg Bear, *Eon* -- the Stone's builders came from a timeline where nuclear war occurred in 1991

---

**Branch: gaia_gate**
- id: `gaia_gate`
- Trigger conditions:
  - `worldStateConditions`: `techLevel >= 0.9`
  - `yearRange`: `{ min: 2050 }`
  - Requires `way_opens` already activated
  - `sustainedTicks`: 18
- Effects:
  - `worldStateOverrides`: `{ tradeAccess: 0.5 }` (trade disrupted by ontological crisis)
  - `pressureSpikes`: `{ loyalty: 0.25, morale: 0.2, political: 0.15 }`
  - Narrative: A Way gate opens to Gaia -- an alternate Earth where Alexander the Great's
    empire persisted for 2000 years. No Christianity, no Islam, no Marxism. A Hellenistic
    paradise. Citizens learn that parallel Earths exist where the Soviet experiment never
    happened. Loyalty crisis. Defection through the gate becomes the new "flight."
    KGB establishes Way Border Patrol.
- Pravda headline: ALTERNATE EARTH DISCOVERED -- DECADENT HELLENISTIC CIVILIZATION PROVES SUPERIORITY OF SOCIALIST PATH. GATE ACCESS RESTRICTED.
- Toast: "They found a world where there are no Soviets. The KGB would like a word with anyone who finds that appealing."
- Historical/SF basis: Greg Bear, *Eternity* -- Gaia, alternate Earth where Hellenistic civilization persisted

---

**Branch: lamarkia_exile**
- id: `lamarkia_exile`
- Trigger conditions:
  - `pressureThresholds`: `{ demographic: 0.8, food: 0.7 }`
  - `worldStateConditions`: `techLevel >= 0.85`
  - `yearRange`: `{ min: 2060 }`
  - Requires `way_opens` already activated
  - `sustainedTicks`: 24
- Effects:
  - `pressureSpikes`: `{ demographic: 0.15, morale: 0.15 }`
  - `relocation`: type `interstellar`, gravity 0.95, atmosphere `breathable`,
    water `rivers`, farming `soil` (but alien ecology), construction `standard`,
    baseSurvivalCost `high`
  - `newSettlement`: true
  - Narrative: Population pressure forces colonization through a Way gate.
    Your settlement is "volunteered" to establish a colony on Lamarkia -- a world
    that is itself a single macro-organism. The gate seals behind you. Traditional
    farming fails because the biosphere rejects Earth crops. You must adapt or starve.
    Moscow's orders arrive by courier pigeon through occasional gate flickers.
- Pravda headline: COLONIAL EXPEDITION TO NEW WORLD DEPARTS -- VOLUNTEERS THANKED FOR THEIR VOLUNTARY PARTICIPATION. GATE SEALED FOR SECURITY.
- Toast: "You've been exiled to an alien world through a space-time corridor. The gate closed behind you. Moscow sends regards."
- Historical/SF basis: Greg Bear, *Legacy* -- Lamarkia colonization through Way gate, isolation, alien ecology

---

## 2. Frank Herbert -- Dune

### Source Material Summary

**Dune (1965)** and its sequels depict a feudal interstellar empire where:
- **CHOAM** (Combine Honnete Ober Advancer Mercantiles) controls all commerce. Corporations
  with sovereign powers, shares distributed among noble houses. The spice melange is the
  only commodity that matters.
- **The Landsraad** is a council of noble houses that counterbalances the Emperor. Feudal
  governance with democratic pretensions.
- **Mentats** are human computers trained to replace AI after the **Butlerian Jihad** --
  a galaxy-wide war against "thinking machines" that resulted in the commandment: "Thou
  shalt not make a machine in the likeness of a human mind."
- **The Spacing Guild** monopolizes interstellar travel via prescient navigators who fold space.
  No Guild, no trade, no empire.
- **Spice (melange)**: Found only on Arrakis. Extends life, expands consciousness, enables
  space travel. Whoever controls the spice controls the universe. A single critical resource
  that warps all political and economic systems around it.
- **Paul Muad'Dib**: Raised as aristocrat, becomes messianic leader of oppressed desert people
  (Fremen). Leads jihad against imperial center. Revolutionary who becomes tyrant.

### SimSoviet Relevance

Dune's systems map directly to SimSoviet's existing mechanics:
- CHOAM = the `corporate` sphere and `corporate` governance type
- Landsraad = `feudal` governance type in worldCountries.ts
- Spice monopoly = `commodityIndex` on WorldState
- Butlerian Jihad = backlash against `ai_singularity` cold branch
- Guild monopoly = space travel control in freeform eternal mode
- Paul's revolution = Moscow's worst nightmare (charismatic leader from the periphery)

### Cold Branch Designs

**Branch: choam_emergence**
- id: `choam_emergence`
- Trigger conditions:
  - `sphereConditions`: `[{ sphere: 'corporate', governance: 'corporate' }]`
  - `worldStateConditions`: `commodityIndex >= 0.8, techLevel >= 0.7`
  - `yearRange`: `{ min: 2050 }`
  - `sustainedTicks`: 24
- Effects:
  - `worldStateOverrides`: `{ tradeAccess: 0.4, centralPlanningEfficiency: 0.5 }`
  - `pressureSpikes`: `{ economic: 0.25, political: 0.2, loyalty: 0.15 }`
  - Narrative: A single megacorporation achieves CHOAM-like dominance over global
    commodity markets. Central planning becomes irrelevant -- the corporation sets
    prices, allocates resources, and dictates production quotas more efficiently
    than Gosplan ever could. Moscow's authority erodes. Your settlement must decide:
    serve Moscow (ideologically pure, economically starving) or serve the corporation
    (fed, but spiritually dead). The Party line is that corporations are capitalist
    parasites. The corporation's line is that your quota is overdue.
- Pravda headline: CORPORATE MONOPOLY DETECTED -- CAPITALIST PARASITE CONTROLS GLOBAL TRADE. SOVIET ECONOMY IMMUNE DUE TO SUPERIOR PLANNING.
- Toast: "A megacorp now controls more of the world economy than Gosplan. Moscow says this is fine. Your empty warehouses disagree."
- Historical/SF basis: Frank Herbert, *Dune* -- CHOAM (Combine Honnete Ober Advancer Mercantiles), corporate sovereignty over commerce

---

**Branch: spice_monopoly**
- id: `spice_monopoly`
- Trigger conditions:
  - `worldStateConditions`: `commodityIndex <= 0.3, techLevel >= 0.75`
  - `pressureThresholds`: `{ economic: 0.6 }`
  - `yearRange`: `{ min: 2080 }`
  - `sustainedTicks`: 18
- Effects:
  - `worldStateOverrides`: `{ commodityIndex: 0.15, tradeAccess: 0.3 }`
  - `pressureSpikes`: `{ economic: 0.3, political: 0.2, power: 0.15, morale: 0.15 }`
  - Narrative: A single critical resource (helium-3, rare earths, or fusion fuel)
    becomes the new spice. One faction controls it. Without it, no power generation,
    no space travel, no advanced manufacturing. Your settlement's power grid depends
    on it. Moscow demands you secure an independent supply. There is no independent
    supply. The resource exists in exactly one place, and someone else owns it.
- Pravda headline: CRITICAL RESOURCE SHORTAGE IS TEMPORARY -- SOVIET SCIENTISTS DEVELOPING ALTERNATIVE. CITIZENS ADVISED TO CONSERVE ELECTRICITY.
- Toast: "The universe runs on one resource and someone else has all of it. Sound familiar? It's oil, but worse."
- Historical/SF basis: Frank Herbert, *Dune* -- spice melange, monopoly resource that warps all political systems

---

**Branch: butlerian_jihad**
- id: `butlerian_jihad`
- Trigger conditions:
  - `worldStateConditions`: `techLevel >= 0.95`
  - `pressureThresholds`: `{ loyalty: 0.5, morale: 0.5 }`
  - `yearRange`: `{ min: 2050 }`
  - Requires `ai_singularity` already activated
  - `sustainedTicks`: 12
- Effects:
  - `worldStateOverrides`: `{ techLevel: 0.4 }` (massive regression)
  - `pressureSpikes`: `{ infrastructure: 0.35, economic: 0.3, political: 0.2 }`
  - `crisisDefinition`: type `political`, severity `national`,
    productionMult 0.4, description "Anti-machine uprising destroys computing infrastructure"
  - Narrative: After AI achieves self-improvement, a populist uprising destroys all
    computing infrastructure. "Thou shalt not make a machine in the likeness of a
    human mind." Tech level crashes. Factories revert to manual operation. The abacus
    returns. Gosplan must calculate Five-Year Plans by hand again. Mentats
    (human computers) become the most valued workers. Your settlement's automated
    systems go dark. Everything that depended on computers -- which is everything --
    stops working.
- Pravda headline: THINKING MACHINES DESTROYED BY RIGHTEOUS FURY OF THE PEOPLE -- MANUAL LABOR RESTORED TO ITS PROPER GLORY. ABACUS PRODUCTION TRIPLED.
- Toast: "The people destroyed every computer. Gosplan is back to slide rules. Your automated greenhouse just became a very expensive shed."
- Historical/SF basis: Frank Herbert, *Dune* -- Butlerian Jihad, galaxy-wide destruction of AI/thinking machines, commandment against machine intelligence

---

**Branch: guild_monopoly**
- id: `guild_monopoly`
- Trigger conditions:
  - `worldStateConditions`: `techLevel >= 0.9`
  - `yearRange`: `{ min: 2150 }`
  - `sustainedTicks`: 24
- Effects:
  - `worldStateOverrides`: `{ tradeAccess: 0.2 }`
  - `pressureSpikes`: `{ economic: 0.25, political: 0.15, morale: 0.1 }`
  - Narrative: A single organization achieves monopoly over interplanetary/interstellar
    transport. Like Herbert's Spacing Guild, they are politically neutral but
    economically omnipotent. No shipment moves without their approval. Your colony's
    supply chain depends on their goodwill. Moscow threatens nationalization. The Guild
    threatens to strand Moscow on Earth. Standoff. Your settlement starves while
    empires negotiate.
- Pravda headline: TRANSPORT GUILD COOPERATING FULLY WITH SOVIET AUTHORITIES -- SUPPLY DELAYS ARE WEATHER-RELATED, NOT POLITICAL.
- Toast: "One organization controls all space travel. They don't care about ideology. They care about fees. Your colony is 4 AU from the nearest alternative."
- Historical/SF basis: Frank Herbert, *Dune* -- Spacing Guild, monopoly on space travel via prescient navigators

---

**Branch: landsraad_formation**
- id: `landsraad_formation`
- Trigger conditions:
  - `sphereConditions`: `[{ sphere: 'european', governance: 'feudal' }, { sphere: 'eurasian', governance: 'feudal' }]`
  - `yearRange`: `{ min: 2200 }`
  - `sustainedTicks`: 36
- Effects:
  - `pressureSpikes`: `{ political: 0.2, loyalty: 0.2, economic: -0.1 }`
  - Narrative: Multiple spheres regress to feudal governance simultaneously. The great
    houses (former nation-states, now hereditary fiefdoms) form a Landsraad -- a council
    of nobles that counterbalances any central authority. Soviet ideology is now
    an anachronism. Your settlement's Party committee is a feudal court in all but name.
    The commissar is a baron. The KGB agent is a spymaster. The Five-Year Plan is
    a tithe schedule. Nothing has changed except the vocabulary.
- Pravda headline: INTER-SPHERE COUNCIL ESTABLISHED -- DEMOCRATIC CENTRALISM NOW OPERATING UNDER UPDATED NOMENCLATURE. PARTY MEMBERSHIP HEREDITARY EFFECTIVE IMMEDIATELY.
- Toast: "Feudalism returns. The commissar is now a baron. The Five-Year Plan is a tithe. The KGB is the Inquisition. Same meetings, different hats."
- Historical/SF basis: Frank Herbert, *Dune* -- Landsraad, council of noble houses, feudal interstellar governance

---

**Branch: desert_messiah**
- id: `desert_messiah`
- Trigger conditions:
  - `pressureThresholds`: `{ loyalty: 0.8, morale: 0.7 }`
  - `worldStateConditions`: `ideologyRigidity <= 0.3`
  - `yearRange`: `{ min: 1950 }`
  - `sustainedTicks`: 12
- Effects:
  - `pressureSpikes`: `{ political: 0.35, loyalty: 0.3 }`
  - `crisisDefinition`: type `political`, severity `national`,
    moraleHit -0.3, kgbAggressionMult 3.0,
    description "Charismatic peripheral leader challenges Moscow's authority"
  - Narrative: A charismatic figure emerges from the periphery -- not Moscow, not
    Leningrad, but from the settlements, the camps, the forgotten places. They speak
    of liberation from the center. Workers follow them. Your settlement is the
    epicenter. Moscow sends the KGB. The messiah's followers don't care. You must
    choose: shelter the revolutionary (and face Moscow's wrath) or betray them
    (and face your people's wrath). There is no good option. There never is.
- Pravda headline: COUNTER-REVOLUTIONARY AGITATOR IDENTIFIED IN PERIPHERAL SETTLEMENT -- KGB DISPATCHED. CITIZENS REMINDED THAT CHARISMA IS BOURGEOIS.
- Toast: "A prophet has risen from the desert. Your desert. Moscow wants them dead. Your workers want to follow them. You want to be invisible."
- Historical/SF basis: Frank Herbert, *Dune* -- Paul Muad'Dib, messianic revolutionary from the periphery who challenges imperial center

---

## 3. Joss Whedon -- Firefly / Serenity

### Source Material Summary

**Firefly (2002)** and **Serenity (2005)** depict a post-Earth civilization where:
- **The Alliance**: A central government formed from the merger of America and China. Controls
  the core worlds -- wealthy, technologically advanced, culturally homogeneous. Exercises
  total surveillance and social control over its citizens.
- **The Rim**: Outer planets and moons, poorly terraformed, underfunded, frontier conditions.
  Settlers are effectively abandoned by the Alliance once the terraforming equipment ships.
  Poverty, lawlessness, self-reliance.
- **The Unification War**: The rim worlds (Independents/"Browncoats") fought for independence
  from the Alliance. They lost. Serenity Valley was the decisive battle. The Browncoats were
  crushed, disarmed, and scattered.
- **Miranda**: The Alliance secretly tested "Pax" (G-23 Paxilon Hydrochlorate) on Miranda's
  population to suppress aggression and create compliant citizens. 99.9% of the population
  simply lay down and died -- lost the will to live. The remaining 0.1% had the opposite
  reaction: became ultra-violent Reavers. The Alliance covered it up.
- **Reavers**: The failed experiment's product. Insane, cannibalistic, self-mutilating raiders
  who attack anything that moves. The Alliance pretends they don't exist.

### SimSoviet Relevance

Firefly IS SimSoviet from the other side of the telescope:
- The Alliance = Moscow (technologically superior center, total surveillance, "we know best")
- The Rim = your settlement (abandoned frontier, making do with scraps, forgotten by center)
- Browncoats = any independence movement the player might sympathize with
- Miranda = what happens when Moscow's "improvement programs" go wrong (Lysenkoism, forced collectivization, chemical pacification)
- Reavers = what the failed program produces (not zombies, but people driven insane by state intervention)
- The cover-up = standard Soviet practice (Chernobyl, Aral Sea, etc.)

### Cold Branch Designs

**Branch: independence_crushed**
- id: `independence_crushed`
- Trigger conditions:
  - `pressureThresholds`: `{ loyalty: 0.7, political: 0.5 }`
  - `worldStateConditions`: `moscowAttention >= 0.7, ideologyRigidity >= 0.6`
  - `yearRange`: `{ min: 1920 }`
  - `sustainedTicks`: 8
- Effects:
  - `pressureSpikes`: `{ loyalty: 0.3, morale: 0.35, demographic: 0.15, political: 0.25 }`
  - `crisisDefinition`: type `political`, severity `national`,
    kgbAggressionMult 3.0, moraleHit -0.6, conscriptionRate 0.1,
    description "Moscow crushes peripheral independence movement with overwhelming force"
  - Narrative: Your settlement (or a neighboring one) declared independence from Moscow.
    It lasted three weeks. The Red Army came. Serenity Valley, Soviet edition.
    The survivors are scattered, disarmed, and given new identities. Your settlement
    absorbs refugees who carry the memory of defeat. Loyalty plummets. Morale
    collapses. The KGB watches everyone who was even remotely sympathetic.
    You were remotely sympathetic. They know.
- Pravda headline: COUNTER-REVOLUTIONARY INSURRECTION LIQUIDATED -- ORDER RESTORED. PARTICIPANTS VOLUNTARILY RELOCATED. INCIDENT NEVER HAPPENED.
- Toast: "The independence movement lasted three weeks. The executions lasted longer. You had nothing to do with it. The KGB agrees, provisionally."
- Historical/SF basis: Joss Whedon, *Firefly/Serenity* -- Unification War, Battle of Serenity Valley, Browncoat defeat

---

**Branch: pacification_program**
- id: `pacification_program`
- Trigger conditions:
  - `pressureThresholds`: `{ loyalty: 0.8, morale: 0.6 }`
  - `worldStateConditions`: `moscowAttention >= 0.8, techLevel >= 0.5`
  - `yearRange`: `{ min: 1930 }`
  - `sustainedTicks`: 6
- Effects:
  - `pressureSpikes`: `{ demographic: 0.35, health: 0.3, morale: 0.4, loyalty: 0.25 }`
  - `crisisDefinition`: type `political`, severity `existential`,
    description "Moscow's chemical pacification program catastrophically backfires",
    moraleHit -0.8, productionMult 0.3
  - Narrative: Moscow decides that loyalty problems in peripheral settlements
    require a chemical solution. A new compound (Soviet Pax) is introduced
    into the water supply to "reduce anti-social tendencies." 30% of the population
    loses the will to work -- they sit, stare, and slowly starve. 2% become
    violently psychotic. The program is classified. Moscow denies everything.
    Your settlement is ground zero. The compound was tested on YOUR people.
    The survivors are either catatonic or homicidal. You must manage both.
- Pravda headline: WATER QUALITY IMPROVEMENT PROGRAM COMPLETE SUCCESS -- CITIZENS REPORT UNPRECEDENTED CALM. PRODUCTIVITY METRICS UNDER REVIEW.
- Toast: "Moscow put something in the water. Most people stopped caring. About anything. Forever. A few people started caring too much. About violence."
- Historical/SF basis: Joss Whedon, *Serenity* -- Miranda, G-23 Paxilon Hydrochlorate pacification experiment, Reavers

---

**Branch: rim_abandonment**
- id: `rim_abandonment`
- Trigger conditions:
  - `worldStateConditions`: `moscowAttention <= 0.1, centralPlanningEfficiency <= 0.4`
  - `pressureThresholds`: `{ economic: 0.5 }`
  - `yearRange`: `{ min: 1985 }`
  - `sustainedTicks`: 24
- Effects:
  - `worldStateOverrides`: `{ moscowAttention: 0.0, centralPlanningEfficiency: 0.2 }`
  - `pressureSpikes`: `{ economic: 0.2, infrastructure: 0.15, morale: 0.1 }`
  - Narrative: Moscow simply forgets you exist. Supply trains stop. Orders stop.
    Quota demands stop. The telegraph goes silent. No commissar visits. No KGB
    inspections. You are free. You are also alone. No supplies, no trade partners,
    no military protection, no ideology. Your settlement must become self-sufficient
    or die. The Party committee meets out of habit. The portrait of Lenin watches
    an empty room. This is either liberation or death sentence, depending on
    your reserves.
- Pravda headline: (No Pravda. Pravda stopped coming.)
- Toast: "Moscow hasn't sent orders in two years. No supplies. No inspections. No quota. You're on your own. Is this freedom or abandonment?"
- Historical/SF basis: Joss Whedon, *Firefly* -- rim worlds abandoned by the Alliance, frontier self-reliance

---

**Branch: cover_up_exposed**
- id: `cover_up_exposed`
- Trigger conditions:
  - `worldStateConditions`: `moscowAttention >= 0.6, ideologyRigidity <= 0.4`
  - `pressureThresholds`: `{ political: 0.6, health: 0.4 }`
  - `yearRange`: `{ min: 1960 }`
  - `sustainedTicks`: 12
- Effects:
  - `pressureSpikes`: `{ political: 0.3, loyalty: 0.25, morale: 0.2 }`
  - Narrative: Evidence surfaces of a past government atrocity -- a covered-up
    disaster, a secret experiment, a buried massacre. Could be the pacification
    program, could be something else entirely. The information spreads despite
    censorship. Citizens learn that Moscow lied. Not the usual lies (quotas met,
    harvests bountiful) but a fundamental lie about something that killed people.
    Their people. Trust collapses. The Party's credibility -- already threadbare --
    disintegrates. You must decide whether to suppress the information (maintaining
    Moscow's line) or let it spread (earning citizen trust but Moscow's fury).
- Pravda headline: IMPERIALIST PROPAGANDA DETECTED -- CITIZENS WARNED AGAINST UNAUTHORIZED INFORMATION. TRUTH IS WHAT THE PARTY SAYS IT IS.
- Toast: "Someone found the files. The real files. The ones that prove what Moscow did. Now everyone knows. Moscow is not pleased that everyone knows."
- Historical/SF basis: Joss Whedon, *Serenity* -- Mr. Universe broadcasts Miranda recording, exposing Alliance cover-up; also Chernobyl, Katyn Forest, Aral Sea

---

## 4. Implementation Notes

### Fitting into worldBranches.ts

All branches above follow the existing `ColdBranch` interface exactly:
- `conditions` use `pressureThresholds` (mapped to the 10 `PressureDomain` values),
  `worldStateConditions` (mapped to `WorldState` fields like `techLevel`, `globalTension`,
  `moscowAttention`, `ideologyRigidity`, `commodityIndex`, `centralPlanningEfficiency`),
  `sphereConditions` (using existing `SphereId` and `GovernanceType` values),
  `yearRange`, and `sustainedTicks`.
- `effects` use `worldStateOverrides`, `pressureSpikes`, `crisisDefinition`, `narrative`
  (with `pravdaHeadline` and `toast`), and optional `relocation`/`newSettlement`.
- All are `oneShot: true` (activate once per playthrough).

### Prerequisite Chains

Several branches form chains that require prior activation:

```
stone_discovery → way_opens → jart_incursion
                           → gaia_gate
                           → lamarkia_exile

ai_singularity (existing) → butlerian_jihad

corporate_sovereignty (existing) → choam_emergence → spice_monopoly

neofeudal_transition (existing) → landsraad_formation
```

**Implementation**: Prerequisite branches can be checked via the `activatedBranches` Set
that `evaluateBranches()` already maintains. Add an optional `requires?: string[]` field
to `ColdBranch.conditions` that checks `activatedBranches.has(id)` for each prerequisite.

### Condition Patterns

| Pattern | Example | Domains Used |
|---------|---------|-------------|
| Tech threshold + year | `stone_discovery` | `techLevel`, `yearRange` |
| Pressure cascade | `butlerian_jihad` | `loyalty`, `morale` after `ai_singularity` |
| Sphere governance | `landsraad_formation` | `sphereConditions` with `feudal` |
| Moscow attention | `pacification_program` | `moscowAttention`, `loyalty` |
| Resource scarcity | `spice_monopoly` | `commodityIndex`, `economic` pressure |
| Abandonment | `rim_abandonment` | Low `moscowAttention`, low `centralPlanningEfficiency` |
| Political crisis | `independence_crushed` | `loyalty`, `political`, `moscowAttention` |
| Cover-up/transparency | `cover_up_exposed` | `political`, `health`, `ideologyRigidity` |

### Cross-References to Per-World Timelines

| Cold Branch | Per-World Timeline Connection |
|-------------|-------------------------------|
| `stone_discovery` → `way_opens` | Opens access to exoplanet timelines via Way gates instead of generation ships |
| `lamarkia_exile` | Creates a unique per-world timeline for Lamarkia (alien macro-organism ecology) |
| `gaia_gate` | Opens parallel Earth timeline (Hellenistic world) -- different from exoplanet colonization |
| `jart_incursion` | Modifies ALL active per-world timelines (alien war affects every colony) |
| `guild_monopoly` | Constrains per-world timeline transitions (no colony expansion without Guild approval) |
| `spice_monopoly` | Critical resource for interplanetary colonies -- affects all off-Earth settlements |
| `butlerian_jihad` | Resets tech prerequisites for per-world milestones, potentially stranding colonies |
| `nuclear_exchange_1991` | Delays or prevents space timeline milestones (infrastructure destroyed) |

### Narrative Integration

Each branch produces:
1. **Pravda headline** -- displayed in the Pravda newspaper system (ALL CAPS, Soviet doublespeak)
2. **Toast** -- darkly funny notification (the game's signature tone)
3. **Crisis definition** (where applicable) -- feeds into the Governor/CrisisImpactApplicator pipeline
4. **Pressure spikes** -- immediately affect the 10-domain pressure system
5. **World state overrides** -- permanently modify WorldState fields

### JSON Implementation

These branches should be added to `src/config/coldBranches.json`. The prerequisite chain
feature requires a minor addition to the `ColdBranch` interface:

```typescript
// In ColdBranch.conditions:
requires?: string[];  // IDs of branches that must have already activated
```

And a corresponding check in `checkConditions()`:

```typescript
if (conditions.requires) {
  for (const reqId of conditions.requires) {
    if (!activatedBranches.has(reqId)) return false;
  }
}
```

This is a 3-line addition to the evaluation engine.

---

## Appendix: Source Cross-Reference Table

| Source | Work | Element | Cold Branch ID | Year Range |
|--------|------|---------|---------------|------------|
| Greg Bear | Eon | Thistledown asteroid | `stone_discovery` | 1990+ |
| Greg Bear | Eon | The Way (infinite corridor) | `way_opens` | 2010+ |
| Greg Bear | Eon/Eternity | Jarts (hostile aliens) | `jart_incursion` | 2020+ |
| Greg Bear | Eon | 1991 nuclear exchange | `nuclear_exchange_1991` | 1988-1995 |
| Greg Bear | Eternity | Gaia (alternate Earth) | `gaia_gate` | 2050+ |
| Greg Bear | Legacy | Lamarkia (alien world) | `lamarkia_exile` | 2060+ |
| Frank Herbert | Dune | CHOAM (corporate monopoly) | `choam_emergence` | 2050+ |
| Frank Herbert | Dune | Spice (critical resource) | `spice_monopoly` | 2080+ |
| Frank Herbert | Dune | Butlerian Jihad (anti-AI) | `butlerian_jihad` | 2050+ |
| Frank Herbert | Dune | Spacing Guild (transport) | `guild_monopoly` | 2150+ |
| Frank Herbert | Dune | Landsraad (feudal council) | `landsraad_formation` | 2200+ |
| Frank Herbert | Dune | Paul Muad'Dib (messiah) | `desert_messiah` | 1950+ |
| Joss Whedon | Firefly | Serenity Valley (defeat) | `independence_crushed` | 1920+ |
| Joss Whedon | Serenity | Miranda/Pax (pacification) | `pacification_program` | 1930+ |
| Joss Whedon | Firefly | Rim abandonment | `rim_abandonment` | 1985+ |
| Joss Whedon | Serenity | Cover-up exposed | `cover_up_exposed` | 1960+ |
