# Leader Archetypes — Game Design Spec

## Overview

This document defines the procedurally generated leader archetypes for SimSoviet 2000, a satirical city-builder set in an alternate Soviet-style republic. Each archetype governs how a leader behaves when in power, what policies they enact, how they distort the economy, and how they interact with other archetypes in the Politburo.

Leaders are not direct copies of historical figures — they are exaggerated composites, filtered through dark comedy. The game should feel like a playable political cartoon from *Krokodil* magazine.

---

## Core Mechanics Glossary

Before diving into archetypes, here are the resource and event categories referenced throughout:

**Resources:** Heavy Industry, Light Industry (consumer goods), Agriculture, Science, Culture, Military, Housing, Morale, Party Loyalty, Foreign Relations, Vodka (yes, it's a resource)

**Event Categories:** Disasters (natural/industrial), Political (purges, coups, defections), Economic (shortages, black markets, windfalls), Cultural (art movements, censorship, festivals), Absurdist (cosmonauts landing in wrong country, bears elected to local soviet, etc.)

---

## I. Core Archetypes

---

### 1. THE ZEALOT

**Satirical Tagline:** *"He loves the people so much, he's willing to kill most of them to save the rest."*

#### Historical Inspiration
Primarily Josef Stalin (1924–1953), with elements of Yezhov (the "Bloody Dwarf" who ran the Great Terror), Andropov's KGB paranoia, and the general phenomenon of revolutionary movements devouring their own. Also draws from Mao's Cultural Revolution for the "permanent purge" mentality, and Enver Hoxha's Albania for the bunker-building obsession.

#### Defining Policies and Behaviors

**Resources Favored:** Heavy Industry, Military, Party Loyalty
**Resources Neglected:** Agriculture, Housing, Morale, Light Industry
**Resources Banned/Suppressed:** Culture (unless it's socialist realism praising the leader), Foreign Relations ("cosmopolitanism is treason")

**Core Behavioral Loop:**
- Launches Five-Year Plans that demand impossible quotas
- When quotas fail, blames saboteurs rather than the plan
- Purges "saboteurs," which removes skilled workers, which causes more failures
- Repeat until either the player intervenes or the economy collapses
- Simultaneously builds enormous vanity projects (canals, monuments, palaces of culture) that drain resources

**Fear:** Conspiracy. The Zealot sees enemies everywhere. Random loyalty checks on all Politburo members; anyone below a threshold is purged. The threshold *rises over time*, meaning eventually even loyalists are at risk.

#### Power Transitions

**How They Come to Power:**
- After the death of an Idealist (historical: Lenin -> Stalin)
- After a period of instability where "strong hand" sentiment rises
- Through bureaucratic maneuvering — they don't seize power in a dramatic coup; they slowly accumulate it while everyone else underestimates them
- Game mechanic: Zealots have a hidden "power accumulation" counter that ticks up while they hold any Politburo position

**How They Leave Power:**
- Death (most common — they almost never leave voluntarily)
- Very rarely, a palace coup by a coalition of Reformers, Technocrats, and Militarists who are all terrified
- Assassination (low probability, triggers massive instability)
- Game mechanic: When a Zealot dies, there is a "Succession Crisis" event that lasts 2–5 game years

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Idealist | Purges first — "dangerous dreamers who question the correct line" |
| Reformer | Purges second — "revisionists" |
| Technocrat | Tolerates briefly, then purges when they become too competent and thus threatening |
| Apparatchik | Promotes heavily — useful yes-men |
| Populist | Purges on sight — "demagogues undermining party discipline" |
| Militarist | Complex — needs them but fears them; promotes/purges cyclically |
| Mystic | Surprisingly tolerant if the Mystic flatters them; may appoint as "science advisor" |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x1.5 (industrial accidents from impossible quotas) |
| Political | x3.0 (purges, show trials, denouncements) |
| Economic | x2.0 (shortages, hoarding, black markets) |
| Cultural | x0.5 (heavily suppressed; what remains is all propaganda) |
| Absurdist | x0.5 (the Zealot's world is too grim for absurdism — but when absurd events DO fire, they're darker) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| Heavy Industry | +80% production, -30% efficiency (quantity over quality) |
| Agriculture | -50% (collectivization disasters) |
| Military | +40% |
| Culture | -60% (only approved art) |
| Morale | -40% (terror) |
| Party Loyalty | +60% (enforced, not genuine) |
| Housing | -30% (communal apartments, but at least there are some) |

#### Signature Policy: THE GREAT PLAN

The Zealot announces an enormous infrastructure project (canal, railway, dam, space elevator) that consumes 40% of all production for 5 game years. If completed, it provides a massive permanent bonus. However, the project has a hidden 70% failure rate based on the Agriculture and Morale stats at the time of announcement. If it fails, it triggers a cascading "Blame the Wreckers" purge chain that can eliminate up to half the player's skilled workforce.

---

### 2. THE IDEALIST

**Satirical Tagline:** *"He will electrify the entire nation — assuming the nation survives the revolution first."*

#### Historical Inspiration
Vladimir Lenin (1917–1924), with elements of Trotsky's permanent revolution ideology, Bukharin's intellectual Marxism, and early Bolshevik utopianism. Also touches on Che Guevara's "New Man" theory and the genuine (if naive) belief that ideology could reshape human nature overnight. The GOELRO electrification plan is a key reference.

#### Defining Policies and Behaviors

**Resources Favored:** Science, Culture, Party Loyalty (ideological, not personal), Literacy/Education (abstract modifier on Science and Culture)
**Resources Neglected:** Light Industry ("bourgeois comforts"), Housing ("the revolution requires sacrifice")
**Resources They Have a Complex Relationship With:** Agriculture (they believe in collectivization intellectually but haven't yet caused the disasters), Military (necessary evil — "the revolution must defend itself")

**Core Behavioral Loop:**
- Launches ambitious literacy and electrification campaigns
- Issues ideological decrees that reshape culture (new alphabet, new calendar, new naming conventions for cities)
- Debates endlessly in the Politburo rather than making practical decisions
- Creates new institutions faster than they can be staffed
- Gradually loses health (historical: Lenin's strokes), creating a power vacuum that other archetypes exploit

**Fear:** Counter-revolution and ideological impurity, but unlike the Zealot, the Idealist fears *ideas* rather than *people*. They ban books and philosophies rather than purging individuals (though they're not above it).

#### Power Transitions

**How They Come to Power:**
- Revolution (game start / after total collapse of previous system)
- Coup during extreme crisis when populace demands radical change
- Game mechanic: Idealists can only come to power when Morale is below 20% OR at game start. They are "crisis leaders."

**How They Leave Power:**
- Death from overwork / illness (most common — they burn out)
- Sidelined by more pragmatic Zealots or Apparatchiks who "interpret" their legacy
- Exile (rare — pushed out by their own faction splitting)
- Game mechanic: Idealists have a "Health" bar that depletes faster the more policies they enact. More ambitious = shorter lifespan.

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Zealot | Distrusts but cannot control — often warns "do not give this one power" (which is ignored) |
| Reformer | Sees as "soft but salvageable" — tries to educate them |
| Technocrat | Respects their competence but considers them ideologically hollow |
| Apparatchik | Despises — "bureaucratic parasites on the body of revolution" |
| Populist | Cautiously approves — "the masses must be engaged, but guided" |
| Militarist | Necessary alliance — "defend the revolution, then we disarm" |
| Mystic | Purges — "superstition is the opiate of the masses" (irony not lost on the player) |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x1.0 (normal) |
| Political | x2.0 (factional debates, ideological splits, foreign intervention fears) |
| Economic | x1.5 (disruption from rapid reform) |
| Cultural | x2.5 (art movements, manifestos, new theaters, censorship of the old) |
| Absurdist | x1.5 (renaming everything, new calendars, banning handshakes as "bourgeois") |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| Science | +50% |
| Culture | +60% (but ideologically filtered) |
| Heavy Industry | +20% (GOELRO-style electrification) |
| Agriculture | +/-0% (no bonus, no penalty yet — collectivization hasn't been forced) |
| Light Industry | -40% ("not a priority") |
| Morale | +20% initially, decaying -5% per year (revolutionary enthusiasm fades) |
| Vodka | -30% (temperance campaigns) |

#### Signature Policy: TOTAL ELECTRIFICATION

All Science and Heavy Industry output is redirected to building power infrastructure for 3 game years. If successful (requires Science > 50 and Heavy Industry > 40), permanently increases all production by 15% and unlocks the "Electrified" trait for the republic. If it fails, causes rolling blackouts that reduce all production by 20% for 2 years and spawns the absurdist event "Comrades Discover Candles Are Also Technology."

---

### 3. THE REFORMER

**Satirical Tagline:** *"He opened the window to let in fresh air and the whole wall fell down."*

#### Historical Inspiration
Nikita Khrushchev (1953–1964) primarily — the "Secret Speech" denouncing Stalin, the Thaw in arts and culture, the erratic policy swings (corn campaign, splitting the Party into industrial and agricultural branches, the shoe-banging incident at the UN). Also draws from Alexander Dubcek's "socialism with a human face" and early Gorbachev before things fully unraveled.

#### Defining Policies and Behaviors

**Resources Favored:** Agriculture (corn! always corn!), Housing (Khrushchyovka mass housing), Morale, Culture (thaw periods)
**Resources Neglected:** Party Loyalty (destabilized by reforms), Heavy Industry (attention diverted)
**Resources They Oscillate On:** Culture and Foreign Relations swing wildly — one year it's "peaceful coexistence," the next it's "we will bury you"

**Core Behavioral Loop:**
- Denounces predecessor (triggers "De-[Name]-ification" event chain)
- Launches bold but poorly planned reforms
- Reforms show early promise, raising Morale
- Entrenched interests resist; Reformer doubles down with increasingly erratic policies
- Cultural thaw allows dissent, which frightens the Reformer into periodic crackdowns
- Net result: sawtooth pattern of hope and disappointment

**Fear:** Being seen as weak AND being seen as another Zealot. This impossible balancing act is the core of their dysfunction.

#### Power Transitions

**How They Come to Power:**
- After a Zealot dies — they are the "we need something different" candidate
- Coalition support from Technocrats and Militarists who think they can control the Reformer
- Game mechanic: Reformers gain power when Party Loyalty is high but Morale is low (the party is strong but the people are miserable)

**How They Leave Power:**
- Politburo coup — "retired for health reasons" (historical: Khrushchev removed in 1964)
- Their own reforms create instability that empowers Apparatchiks to organize against them
- Game mechanic: When Party Loyalty drops below 30% (because reforms destabilized it), a "Vote of No Confidence" event fires with 80% chance of removal

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Zealot | Denounces publicly, fears privately — "we must never return to that" |
| Idealist | Admires in theory, considers impractical |
| Technocrat | Appoints to key positions but overrides their advice with gut feelings |
| Apparatchik | Tries to purge (gently), but they're like cockroaches — they survive everything |
| Populist | Natural successor — "finishes what I started, but goes too far" |
| Militarist | Volatile relationship — needs them for Cuban-missile-crisis moments but resents their budget demands |
| Mystic | Bans (Lysenko is finally fired), but may fall for new pseudoscience |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x1.2 (agricultural experiments go wrong) |
| Political | x2.0 (de-Stalinization, rehabilitation campaigns, factional maneuvering) |
| Economic | x1.5 (reforms create turbulence) |
| Cultural | x2.0 (thaw/freeze cycles generate constant cultural events) |
| Absurdist | x2.5 (corn in Siberia, shoe diplomacy, splitting the party apparatus in half for no reason) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| Agriculture | +30% initially but with x2 variance (boom or bust corn harvests) |
| Housing | +50% (mass construction of cheap apartments) |
| Morale | +30% initially, oscillating +/-20% thereafter |
| Heavy Industry | -20% (attention diverted) |
| Party Loyalty | -30% (destabilized by reforms) |
| Culture | Oscillates: +40% during thaw, -20% during freeze, switching every 1–2 years |
| Foreign Relations | Oscillates: +30% (peaceful coexistence) then -40% (we will bury you) |

#### Signature Policy: THE CORN CRUSADE

The Reformer mandates that 60% of all agricultural land be converted to growing a single crop (randomly selected from: corn, sugar beets, flax, or — absurdly — pineapples). For 2 years, Agriculture output doubles if the crop matches the climate zone. If it doesn't match (50% chance), Agriculture drops to 10% of normal and triggers the famine event "The Great [Crop] Disaster." Either way, the Reformer insists it was a success and commissions a documentary.

---

### 4. THE TECHNOCRAT

**Satirical Tagline:** *"He could make the trains run on time, if anyone had bothered to build trains."*

#### Historical Inspiration
Alexei Kosygin (1964–1980), the quietly competent Premier who tried genuine economic reform under Brezhnev but was repeatedly undermined. Also draws from Andrei Gromyko's stolid diplomacy ("Grim Grom"), Gosplan central planners, and the broader phenomenon of Soviet engineers and economists who knew the system was broken but could only tinker at the margins. Elements of Yuri Andropov's brief, efficiency-focused leadership (1982–1984).

#### Defining Policies and Behaviors

**Resources Favored:** Science, Heavy Industry (but efficiently), Light Industry (cautious market experiments)
**Resources Neglected:** Culture ("not quantifiable"), Morale ("an externality"), Vodka (neither for nor against — merely a data point)
**Resources They Quietly Improve:** Everything, marginally — the Technocrat's curse is that nothing is dramatic enough to be noticed

**Core Behavioral Loop:**
- Proposes rational, evidence-based reforms
- Reforms are watered down by Apparatchiks in implementation
- Incremental improvements occur but are invisible to the populace
- Morale stagnates because nothing exciting happens
- Eventually sidelined by someone more charismatic or more ruthless

**Fear:** Irrationality. The Technocrat is horrified by the Mystic, baffled by the Zealot, and exhausted by the Reformer. Their nightmare scenario is a policy being adopted because it "sounds good" rather than because the data supports it.

#### Power Transitions

**How They Come to Power:**
- Appointed as "the safe pair of hands" after chaotic predecessors
- Often as a deputy/premier rather than the top position — they govern without ruling
- Game mechanic: Technocrats are the default "fill" when no other archetype has enough support. They come to power when all factions are balanced (no single archetype dominates).

**How They Leave Power:**
- Quietly pushed aside by Apparatchiks who find them inconvenient
- Health failure (overwork, stress from being ignored)
- Replaced by a more charismatic leader during a crisis — "we need vision, not spreadsheets"
- Game mechanic: If any single event causes more than 20% swing in any resource, the Technocrat is "overwhelmed" and can be replaced.

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Zealot | Serves reluctantly, dies inside daily — "the data does not support executing the entire engineering faculty" |
| Idealist | Respects the vision, despairs at the implementation — "electrification is good but we need a budget" |
| Reformer | Natural ally but frustrated — "your instincts are correct but please stop making policy based on what you saw from a train window" |
| Apparatchik | Mutual parasitism — the Technocrat needs the Apparatchik's bureaucratic network; the Apparatchik needs the Technocrat's plans to take credit for |
| Populist | Distrusts — "you cannot solve supply chain problems with speeches" |
| Militarist | Pragmatic cooperation — both appreciate systems and logistics |
| Mystic | Mortal enemies — "Comrade, wheat does not respond to ideological motivation" |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x0.7 (better safety standards, if anyone follows them) |
| Political | x0.5 (boring politics is stable politics) |
| Economic | x1.5 (economic reforms create market-like disturbances that nobody in the system knows how to handle) |
| Cultural | x0.5 (nothing interesting happens) |
| Absurdist | x0.3 (the Technocrat eliminates most absurdity through sheer bureaucratic competence) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| Science | +40% |
| Heavy Industry | +20% (efficiency gains, not expansion) |
| Light Industry | +30% (Kosygin reforms) |
| Agriculture | +15% (evidence-based farming) |
| Culture | -20% (funding cuts — "not a priority sector") |
| Morale | -10% (boredom) |
| Party Loyalty | +/-0% (nobody cares enough to be loyal or disloyal) |
| Housing | +10% (modest, rational improvements) |

#### Signature Policy: THE OPTIMAL PLAN

The Technocrat implements a comprehensive economic reform that introduces limited profit incentives and rational pricing for 20% of the economy. For 3 years, Light Industry and Agriculture improve by 25%. However, this triggers a "Ideological Contamination" event where hardliners accuse the reforms of being capitalist. The player must choose: defend the reforms (risking Party Loyalty -30%) or abandon them (losing all gains and triggering the "Promising Reform Quietly Buried" event, which gives +10% Apparatchik influence forever).

---

### 5. THE APPARATCHIK

**Satirical Tagline:** *"He has awarded himself the Order of Lenin for his heroic contribution to the awarding of medals."*

#### Historical Inspiration
Leonid Brezhnev (1964–1982) is the primary model — the era of stagnation (*zastoi*), the cult of mediocrity, the medal obsession (Brezhnev awarded himself over 100 decorations including the Order of Victory, which was reserved for WWII commanders). Also draws from Konstantin Chernenko (the ultimate placeholder leader), the *nomenklatura* system of patronage, and the broader phenomenon of communist parties ossifying into self-serving bureaucracies. The joke: "Under Brezhnev, we pretend to work and they pretend to pay us."

#### Defining Policies and Behaviors

**Resources Favored:** Party Loyalty (through patronage, not ideology), Vodka (keep the people sedated), Military (pork barrel spending)
**Resources Neglected:** Science (brain drain), Agriculture (who cares, we can import grain), Housing (the waiting list is 15 years, just like last year)
**Resources They Actively Corrupt:** All of them — the Apparatchik doesn't destroy resources, they siphon them. A hidden "corruption" modifier reduces effective output of everything by 2% per year, compounding.

**Core Behavioral Loop:**
- Does nothing
- Awards medals for doing nothing
- Appoints loyalists to positions they're unqualified for
- Covers up problems rather than solving them
- The economy slowly decays while official statistics show record growth
- Eventually dies in office, usually while receiving another medal

**Fear:** Change. Any change. The Apparatchik's entire power base rests on the status quo. Reform threatens their patronage network. Revolution is unthinkable. Even improvement is dangerous because it implies the current situation was bad.

#### Power Transitions

**How They Come to Power:**
- After a Reformer is deposed — "we need stability"
- Through seniority and patronage — they simply outlast everyone else
- Coalition of mediocrities who agree on nothing except opposing anyone with ideas
- Game mechanic: Apparatchiks gain influence passively. Every year they hold any position, their influence grows by 5%. They come to power when their accumulated influence exceeds all other candidates.

**How They Leave Power:**
- Death in office (most common — they are old when they take power and get older)
- Physical incapacity so severe even the Politburo notices (historical: Brezhnev's last years, Chernenko's entire tenure)
- Game mechanic: Apparatchiks have a "Biological Clock" — each year in power, there's a growing probability of death. By year 15, it's nearly certain. When they die, 2–3 more Apparatchiks compete for succession (the "Funeral Race" mini-event).

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Zealot | Genuinely afraid — survived the purges by being too boring to notice |
| Idealist | Pays lip service to the ideology while hollowing it out completely |
| Reformer | Actively undermines — "reforms are destabilizing" |
| Technocrat | Uses their plans, takes their credit, blocks their promotions |
| Populist | Opposes — "speaking directly to the masses? That's not how things are done" |
| Militarist | Natural ally — both benefit from high military spending and both fear change |
| Mystic | Indifferent — "as long as they don't cause trouble, let them have their superstitions" |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x1.5 (deferred maintenance, covered-up safety violations) |
| Political | x0.5 (everything is suppressed — no purges, no reforms, no anything) |
| Economic | x0.5 initially, rising to x2.0 over time (problems compound until they can't be hidden) |
| Cultural | x0.3 (absolute cultural stagnation — same movies, same books, same songs) |
| Absurdist | x1.5 (the gap between official reality and actual reality generates absurdist events naturally) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| All Resources | -2% per year (compounding corruption/stagnation decay) |
| Party Loyalty | +20% (patronage works... for a while) |
| Vodka | +40% (keep the people quiet) |
| Military | +30% (pork barrel) |
| Science | -30% (brain drain, funding diverted to patronage) |
| Morale | -5% per year (slow, grinding despair) |
| Foreign Relations | -10% (but stable — detente is boring but functional) |

#### Signature Policy: THE MEDAL ECONOMY

The Apparatchik introduces a parallel reward system where every institution, factory, and collective farm is rated not by output but by "socialist achievement points." Medals and honorifics replace material incentives. For 2 years, Party Loyalty increases by 30% while actual productivity is hidden from the player (production numbers are replaced by "GLORIOUS" / "HEROIC" / "ADEQUATE" ratings). When the policy ends, the real numbers are revealed — typically 20–40% lower than expected. The player then faces the "Potemkin Audit" event: admit the truth (Morale -20%, Party Loyalty -40%) or double down on the fiction (hidden decay continues at 2x rate).

---

### 6. THE POPULIST

**Satirical Tagline:** *"He promised the people openness, and they told him exactly what they thought of him."*

#### Historical Inspiration
Mikhail Gorbachev (1985–1991), specifically the *glasnost* and *perestroika* era, the anti-alcohol campaign of 1985 (which actually worsened the budget deficit because vodka taxes were a major revenue source), and the phenomenon of reform unleashing forces that destroyed the reformer. Also draws from Alexander Kerensky's brief, doomed attempt to lead democratic Russia in 1917, and Boris Yeltsin's populist challenge from within the system.

#### Defining Policies and Behaviors

**Resources Favored:** Morale, Foreign Relations, Culture, Light Industry (consumer goods to win popular support)
**Resources Neglected:** Military (peace dividend), Party Loyalty (deliberately weakened), Heavy Industry (conversion to consumer goods)
**Resources They Accidentally Destroy:** Vodka (anti-alcohol campaigns that backfire), Party Loyalty (glasnost reveals too much), the economy itself (perestroika without a plan)

**Core Behavioral Loop:**
- Announces sweeping transparency reforms
- Hidden problems are revealed, causing Morale to initially drop before (theoretically) recovering
- Anti-corruption campaigns target Apparatchiks, destabilizing the bureaucracy
- Economic reforms are half-implemented, creating worst-of-both-worlds outcomes
- Nationalist movements emerge in peripheral republics
- The Populist tries to hold everything together through personal charisma
- It doesn't work

**Fear:** Irrelevance and the accusation of being "just another apparatchik." The Populist must constantly prove they're different, which drives increasingly radical reforms.

#### Power Transitions

**How They Come to Power:**
- After a string of Apparatchik leaders die in rapid succession (historical: Brezhnev -> Andropov -> Chernenko -> Gorbachev, three funerals in three years)
- When the gap between official statistics and reality becomes undeniable
- Game mechanic: Populists can come to power when the cumulative corruption modifier exceeds 30% (the system is visibly rotting)

**How They Leave Power:**
- The system they tried to reform collapses entirely (game over or new era)
- Coup by hardliners who blame the reforms for the chaos (historical: August 1991 coup)
- Sidelined by a more radical Populist or a resurgent Zealot
- Game mechanic: The Populist has a "Reform Momentum" meter. If it exceeds 80%, the system fractures. If it drops below 20%, hardliners stage a coup.

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Zealot | Mortal enemy — "never again" |
| Idealist | Spiritual kinship — "we share the dream but I'm more practical" (narrator: they weren't) |
| Reformer | Predecessor and cautionary tale — "Khrushchev went too fast... wait, am I going even faster?" |
| Technocrat | Appoints them, then ignores their warnings — "the people demand change NOW, not in five years" |
| Apparatchik | Primary target for purging, but they resist through institutional inertia |
| Militarist | Tense standoff — the Populist cuts their budget, they plot coups |
| Mystic | Oddly tolerant — freedom of conscience is part of the reform platform |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x1.5 (Chernobyl-type revelations of covered-up disasters) |
| Political | x3.0 (everything is political now — strikes, protests, nationalist movements, attempted coups) |
| Economic | x2.5 (the economy is being restructured with no blueprint) |
| Cultural | x2.0 (cultural explosion — banned books published, emigres return, rock music) |
| Absurdist | x2.0 (the gap between intentions and results is inherently absurd) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| Morale | +30% initially, then volatile (+/-40% swings) |
| Foreign Relations | +50% (the West loves this person) |
| Culture | +40% (glasnost) |
| Party Loyalty | -40% (deliberately undermined) |
| Military | -30% (peace dividend / budget cuts) |
| Vodka | -60% (anti-alcohol campaign) -> triggers "Budget Crisis" because vodka taxes were 15% of state revenue |
| Heavy Industry | -20% (conversion chaos) |
| Light Industry | +20% attempted, but actual results are +/-30% variance |

#### Signature Policy: THE GREAT OPENNESS

All hidden game statistics become visible to the player for the first time (previously obscured by Apparatchik cover-ups). This includes: true corruption levels, actual vs. reported production, secret Politburo loyalty scores, and hidden environmental damage. The revelation triggers a cascade: Morale drops 30% immediately ("they've been lying to us for decades"), then a "Window of Reform" opens for 3 game years where all reform policies are 50% more effective. However, if the player doesn't achieve Morale recovery above the pre-revelation level within those 3 years, a "Conservative Backlash" event fires that removes the Populist and installs either a Militarist or a Zealot.

---

### 7. THE MILITARIST

**Satirical Tagline:** *"In his defense budget, there is a line item for 'more defense budget.'"*

#### Historical Inspiration
Marshal Georgy Zhukov (the war hero who briefly held enormous political power in 1957), Dmitry Ustinov (Defense Minister who drove the Afghanistan invasion), Andrei Grechko, and the broader Soviet military-industrial complex that consumed an estimated 15–25% of GDP. Also draws from the "fortress besieged" mentality that justified military spending even during peacetime, and the phenomenon of military leaders who see every problem as requiring a military solution.

#### Defining Policies and Behaviors

**Resources Favored:** Military (obviously), Heavy Industry (tanks, not tractors), Science (weapons research only)
**Resources Neglected:** Light Industry ("consumer goods are for peacetime, and it's always wartime"), Culture ("songs about the army are culture"), Agriculture ("soldiers eat less than you think")
**Resources They Distort:** Science is redirected entirely to weapons research; Housing becomes "barracks"; Foreign Relations becomes "threat assessment"

**Core Behavioral Loop:**
- Identifies an external threat (real or imagined)
- Demands military buildup to counter the threat
- Military buildup requires more heavy industry
- Heavy industry diverts resources from consumer goods and agriculture
- Shortages increase, causing unrest
- Unrest is attributed to foreign sabotage, justifying more military spending
- Eventually launches a foreign adventure (proxy war, intervention, "fraternal assistance") that drains the economy

**Fear:** Vulnerability. The Militarist cannot accept that the nation might be strong enough. There is always another weapon system needed, another division to be raised, another border to fortify.

#### Power Transitions

**How They Come to Power:**
- External crisis (real or manufactured)
- After a Populist weakens the military and a border incident occurs
- Through a coup during political instability (rare but dramatic)
- Game mechanic: Militarists gain power when Foreign Relations drops below 25% or when a "Border Incident" event fires

**How They Leave Power:**
- Removed by coalition of other archetypes who realize the military budget is unsustainable
- The foreign adventure fails catastrophically (Afghanistan analogue)
- Rare: natural death (Militarists tend to be vigorous but the stress gets them eventually)
- Game mechanic: If Military spending exceeds 50% of total production for more than 5 years, an "Economic Collapse from Militarization" event fires that removes them

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Zealot | Respected rival — both believe in strength, but disagree on whether enemies are internal or external |
| Idealist | Contempt — "dreamers get soldiers killed" |
| Reformer | Suspicious — "reforms weaken defense readiness" |
| Technocrat | Valued subordinate — "I need someone who can actually build the missiles" |
| Apparatchik | Comfortable alliance — both benefit from high spending and low accountability |
| Populist | Enemy — "this fool is disarming us while the enemy sharpens their knives" |
| Mystic | Bizarre tolerance — "if they say the stars favor our attack, so much the better" |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x1.5 (weapons tests, military accidents, nuclear near-misses) |
| Political | x1.5 (military-civilian tensions, coup rumors, generals jockeying for position) |
| Economic | x2.0 (guns-vs-butter crisis is constant) |
| Cultural | x0.5 (all cultural production is military-themed) |
| Absurdist | x1.0 (military absurdity is its own genre — the parade that takes a wrong turn, the general who fortifies the wrong border) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| Military | +80% |
| Heavy Industry | +40% (military-industrial complex) |
| Science | +20% (weapons research) but civilian science -30% |
| Agriculture | -30% |
| Light Industry | -50% |
| Housing | -20% (barracks don't count) |
| Morale | +10% initially (patriotic fervor), -5% per year thereafter |
| Foreign Relations | -30% (everyone is an enemy) |

#### Signature Policy: TOTAL MOBILIZATION

The Militarist places the entire economy on a war footing. All production converts to military output. For 3 years, Military increases by 100% and the republic is immune to foreign political events. However, Agriculture drops by 50%, Light Industry drops by 70%, and Morale drops by 10% per year. At the end, if no actual war occurred, the "Grand Parade of Nothing" event fires: all the military hardware is paraded through the capital, the population watches stoically, and Morale drops an additional 20% as everyone wonders what it was all for. If a war DID occur, the Militarist is vindicated and gets +40% Party Loyalty.

---

### 8. THE MYSTIC

**Satirical Tagline:** *"Comrade, the wheat harvest will improve once we align the dialectics with the constellation of Taurus."*

#### Historical Inspiration
Trofim Lysenko (the pseudo-biologist who rejected Mendelian genetics in favor of ideologically correct "Michurin biology," setting Soviet agriculture back decades and contributing to famines), with elements of the Cosmist movement (Nikolai Fyodorov's philosophy of resurrecting the dead through science), Rasputin's influence on the Romanovs (for the "shadowy advisor" gameplay role), and the bizarre real-world Soviet experiments in parapsychology, telepathy, and psychotronic weapons during the Cold War. Also touches on Juche ideology's quasi-mystical elements and cargo-cult science.

#### Defining Policies and Behaviors

**Resources Favored:** "Science" (pseudoscience that actively harms real science), Culture (mystical/ideological art), Party Loyalty (through superstition and cult of personality)
**Resources Neglected:** Actual Science (purged as "bourgeois"), Agriculture (subjected to pseudoscientific farming methods), Foreign Relations ("foreign science is a plot")
**Resources They Actively Destroy:** Science (by replacing real scientists with charlatans), Agriculture (Lysenko's vernalization destroyed crops), Morale (people know it's nonsense but can't say so)

**Core Behavioral Loop:**
- Proposes a revolutionary "scientific" theory that contradicts established science
- Theory is adopted because it aligns with ideology or flatters the current leader
- Real scientists who object are purged or silenced
- Policy based on the theory fails catastrophically
- Failure is blamed on saboteurs who "incorrectly applied" the theory
- New, even more bizarre theory is proposed to fix the problems caused by the first one
- Repeat, each cycle more divorced from reality

**Fear:** Evidence. The Mystic's entire position depends on their theories never being tested against reality. Peer review is treason. Controlled experiments are bourgeois fetishism.

#### Power Transitions

**How They Come to Power:**
- Rarely become supreme leader — more often they are the power behind the throne
- Appointed as "science advisor" by a Zealot or Apparatchik who doesn't understand science
- Come to prominence when real science fails to solve a crisis and the leader wants a miracle
- Game mechanic: Mystics don't lead directly. Instead, they attach to another leader as an "advisor," modifying that leader's policies. They come to power when Science is low and a crisis demands a scientific response.

**How They Leave Power:**
- Patron dies or is removed
- Their theories fail so spectacularly that even the most willfully blind leader notices
- A Technocrat or Reformer takes power and purges them
- Game mechanic: Each failed prediction/policy has a cumulative "Exposed" counter. When it reaches 100%, the Mystic is removed regardless of patron support.

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Zealot | Perfect symbiosis — the Zealot needs "science" that confirms ideology; the Mystic provides it |
| Idealist | Tense — the Idealist believes in science but might be fooled by pseudoscience dressed in revolutionary language |
| Reformer | Purged — the Reformer's first act is often to fire the court charlatan |
| Technocrat | Mortal enemies — "your 'data' is a bourgeois conspiracy against true proletarian science" |
| Apparatchik | Tolerated if useful — the Apparatchik doesn't care if the science is real as long as the reports look good |
| Populist | Marginalized — glasnost exposes pseudoscience |
| Militarist | Surprisingly useful — the Militarist will fund psychic warfare research |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x2.5 (pseudoscience-based policy causes ecological and agricultural disasters) |
| Political | x1.5 (purges of real scientists, academic factional warfare) |
| Economic | x1.5 (policy based on fantasy produces fantasy results) |
| Cultural | x1.5 (mystical art movements, banned science fiction that's too accurate, "new Soviet man" eugenics) |
| Absurdist | x3.0 (this archetype IS absurdism — vernalized wheat, telepathic espionage, ideological plant breeding) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| Science | -50% (real science) / +30% ("science" — but the output is useless) |
| Agriculture | -40% (Lysenko effect) |
| Culture | +20% (mystical art is at least interesting) |
| Military | +10% (psychotronic weapons research, at least they're trying) |
| Morale | -20% (everyone knows it's nonsense but can't say so) |
| Party Loyalty | +10% (superstition provides comfort to the fearful) |
| Heavy Industry | -10% (metallurgy based on "dialectical material science" produces bad steel) |

#### Signature Policy: THE NEW BIOLOGY

The Mystic announces that a revolutionary scientific breakthrough will double agricultural output by applying ideological principles to plant genetics. All Science funding is redirected to the new program. Real scientists who object are reassigned to manual labor. For 2 years, Agriculture statistics appear to improve dramatically (the numbers are fabricated). In year 3, the actual harvest reveals the truth: Agriculture drops by 60%, triggering a famine event. The Mystic blames "wreckers in the academy" and proposes an even more radical theory. The player must choose: support the Mystic (Agriculture continues to decline, but no political disruption) or purge the Mystic (Agriculture begins recovering, but triggers "Academic Chaos" that reduces Science by 30% for 3 years as the field rebuilds).

---

## II. Additional Archetypes

---

### 9. THE POET

**Satirical Tagline:** *"He banned concrete in favor of marble, then banned marble in favor of verse."*

#### Historical Inspiration
Draws from Anatoly Lunacharsky (first Soviet Commissar of Enlightenment, who genuinely tried to preserve Russian culture while revolutionizing it), Andrei Zhdanov (Stalin's cultural enforcer who turned art into a weapon), the phenomenon of poet-politicians like Vaclav Havel (though Czech, the archetype fits), and the extraordinary importance of poetry in Russian political life — where poets like Mayakovsky, Akhmatova, and Brodsky were political figures simply by existing. Also touches on the "thaw" generation of intellectuals who thought culture could reform the system from within.

#### Defining Policies and Behaviors

**Resources Favored:** Culture (overwhelmingly), Morale (through cultural events), Foreign Relations (cultural diplomacy — ballet, chess, literature)
**Resources Neglected:** Heavy Industry ("factories are ugly"), Military ("missiles lack aesthetic merit"), Agriculture ("the pastoral ideal does not require actual farming")
**Resources They Transform:** Housing becomes "architectural expression"; Science becomes "the beauty of mathematics"

**Core Behavioral Loop:**
- Commissions enormous cultural projects (opera houses, film studios, literary journals)
- Declares certain art forms mandatory or forbidden based on personal taste
- Foreign cultural prestige rises dramatically
- Meanwhile, the actual infrastructure crumbles because nobody is maintaining it
- Cultural factions form and begin purging EACH OTHER (formalists vs. realists vs. futurists)
- The Poet is eventually deposed when someone points out there's no bread, but the ballet is magnificent

**Fear:** Philistinism — the Poet is terrified of a world where art doesn't matter.

#### Power Transitions

**How They Come to Power:** After a period of cultural repression (post-Zealot) or cultural stagnation (post-Apparatchik), when the people hunger for meaning. Game mechanic: Poets emerge when Culture is below 20% but Morale is above 30% — the people are emotionally capable of caring but culturally starving.

**How They Leave Power:** Economic crisis makes cultural spending untenable. Replaced by a Technocrat or Apparatchik who "restores priorities." Game mechanic: If any core resource (Agriculture, Heavy Industry) drops below 15%, the Poet is automatically removed.

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Zealot | Terrified — "they kill poets" |
| Idealist | Soulmates who cannot agree on priorities |
| Reformer | Allies during the thaw, enemies during the freeze |
| Technocrat | Mutual incomprehension — "you can't quantify Pushkin" / "you can't eat Pushkin" |
| Apparatchik | Despised — "they have turned Lenin's dream into a filing cabinet" |
| Militarist | Ignored and ignoring |
| Mystic | Dangerous fascination — mysticism is at least aesthetically interesting |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x0.8 |
| Political | x1.0 |
| Economic | x1.5 (neglect) |
| Cultural | x4.0 (culture is everything — art scandals, literary feuds, ballet defections, censorship debates) |
| Absurdist | x2.0 (declaring pigeons a protected species because Chekhov wrote about them) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| Culture | +80% |
| Foreign Relations | +30% (cultural diplomacy) |
| Morale | +20% |
| Heavy Industry | -40% |
| Military | -30% |
| Agriculture | -20% |
| Science | +/-0% (some boost from intellectual climate, some drain from funding reallocation) |

#### Signature Policy: THE CULTURAL REVOLUTION (THE GOOD KIND)

The Poet mandates that every factory, farm, and military unit must dedicate 4 hours per day to cultural activities (reading circles, choir practice, amateur theater). Production of all physical resources drops by 30% for 2 years. However, Culture triples and Morale increases by 40%. At the end, a random outcome: 40% chance of "Cultural Renaissance" (permanent +15% to Morale and Culture), 30% chance of "The People Discover They Prefer Television" (all bonuses vanish), 30% chance of "Cultural Schism" (two opposing art movements form factions that paralyze the Politburo for 3 years).

---

### 10. THE COLLECTOR

**Satirical Tagline:** *"He has personally liberated the people's wealth into his personal dacha."*

#### Historical Inspiration
Draws from the late-Soviet *nomenklatura* privilege system (special stores, dachas, imported goods), post-Soviet oligarchs like the "semibankirshchina" (rule of seven bankers), the phenomenon of Communist Party leaders living in luxury while preaching equality (Ceausescu's palace, Zhivkov's hunting lodges), and specific figures like Yuri Sokolov (head of Moscow's Yeliseev Gastronome, executed for embezzlement in 1984). Also touches on kleptocratic states like Mobutu's Zaire and Marcos's Philippines — the universal archetype of the ruler who treats the state as a personal piggy bank.

#### Defining Policies and Behaviors

**Resources Favored:** Light Industry (luxury goods — for themselves), Foreign Relations (access to Western imports), Vodka (premium brands, naturally)
**Resources Neglected:** Housing (for the people), Agriculture (unless it's their private hunting estate), Morale ("the people don't need morale, they need to work harder so I can have nicer things")
**Resources They Siphon:** A unique "Embezzlement" mechanic — the Collector redirects a percentage of ALL production to a hidden "Personal Wealth" counter. This wealth is lost to the player's economy.

**Core Behavioral Loop:**
- Establishes special distribution networks for elite goods
- Creates a two-tier economy (elite luxury / mass poverty)
- Foreign trade deals that benefit their personal accounts
- Builds increasingly ostentatious personal residences while housing shortages worsen
- A growing black market emerges as the official economy is hollowed out
- Eventually, the gap between elite luxury and mass poverty becomes a political crisis

**Fear:** Audits, transparency, and honest accountants.

#### Power Transitions

**How They Come to Power:** During periods of stability and stagnation — they don't seize power, they gradually redirect it. Often emerge from within an Apparatchik's patronage network. Game mechanic: Collectors can come to power when Party Loyalty is above 50% and corruption is above 20% — the system is stable enough to be exploited.

**How They Leave Power:** Anti-corruption campaigns (Reformer or Populist), exposure scandals, or the economy becomes so hollowed out that even loyalists rebel. Rare: flee to a foreign country with the treasury. Game mechanic: If the hidden "Personal Wealth" counter exceeds 30% of total GDP, a "Corruption Scandal" event fires automatically.

#### Relationships to Other Archetypes

| Archetype | Relationship |
|-----------|-------------|
| Zealot | Fears — the Zealot will execute them for corruption |
| Idealist | Hides from — ideological purity is the enemy of embezzlement |
| Reformer | Resists — reforms expose graft |
| Technocrat | Bribes or removes — accountants are dangerous |
| Apparatchik | Natural host — the Collector is a parasitic evolution of the Apparatchik |
| Populist | Mortal enemy — transparency is the Collector's doom |
| Militarist | Profitable relationship — military procurement is easy to skim from |

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x1.2 (infrastructure decay from embezzlement) |
| Political | x1.5 (corruption scandals, faction buyouts) |
| Economic | x2.5 (black markets, parallel economies, currency manipulation) |
| Cultural | x0.5 (culture doesn't generate profit, so who cares) |
| Absurdist | x2.0 (the contrast between official equality and actual kleptocracy is inherently absurd) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| All Resources | -X% where X = years in power x 3 (compounding embezzlement) |
| Light Industry | +20% (luxury goods production... that the player doesn't benefit from) |
| Foreign Relations | +10% (trade deals... benefiting the Collector personally) |
| Party Loyalty | +15% (patronage buys loyalty) |
| Morale | -10% per year (growing inequality) |
| Housing | -30% (budget redirected to dachas) |

#### Signature Policy: THE SPECIAL DISTRIBUTION

The Collector creates a parallel economy: "Special Stores" for party elites stocked with imported goods, alongside increasingly empty regular stores for the masses. For the duration of their rule, official GDP statistics look healthy (+10% reported growth) but actual resources available to the player decrease by 5% per year (siphoned to the elite). The mechanic: the player's UI shows two sets of numbers — "Official" (rosy) and "Actual" (grim). If the player tries to audit the Special Distribution, a "Nothing To See Here, Comrade" event fires, costing 10 Party Loyalty but revealing the true deficit. If the deficit exceeds 40% of GDP, the "People's Uprising Against Privilege" event triggers, which can only be resolved by purging the Collector and redistributing the stolen wealth (one-time economic boost of +25% to all resources).

---

### 11. THE GHOST

**Satirical Tagline:** *"Nobody has seen the General Secretary in months, but the decrees keep arriving — each one more unhinged than the last."*

#### Historical Inspiration
Draws from the very real phenomenon of Soviet leaders who were incapacitated but still "in charge" — Brezhnev's final years (barely conscious, propped up for appearances), Chernenko's entire 13-month tenure (hospitalized for most of it, his signature forged on documents), and Stalin's final days (when he may have been dead for hours before anyone dared check). Also inspired by the North Korean model of ruling through bureaucratic proxies, the Chinese concept of "ruling from behind the curtain," and Kafka's *The Castle* — authority that is everywhere and nowhere.

#### Defining Policies and Behaviors

**Resources Favored:** None directly — the Ghost doesn't have preferences because nobody knows what the Ghost wants. Policies are generated by competing factions who each claim to speak for the absent leader.
**Resources Neglected:** All of them, gradually — without clear direction, everything drifts.
**Resources They Distort:** The randomness of competing factions claiming authority means resources swing unpredictably.

**Core Behavioral Loop:**
- The leader disappears from public view (illness? paranoia? death? nobody knows)
- Competing Politburo factions issue contradictory decrees "on behalf of" the leader
- The player receives conflicting policy directives every turn
- Nobody can confirm or deny any policy because nobody can reach the leader
- Rumors proliferate (the leader is dead / the leader is a hologram / the leader has ascended to a higher plane of dialectical materialism)
- Eventually the truth is revealed — but even the truth might be ambiguous

**Fear:** Irrelevant — the Ghost may not be conscious enough to fear anything. The fear belongs to their subordinates, who are terrified of guessing wrong about what the Ghost would want.

#### Power Transitions

**How They Come to Power:** They don't — they were already in power when they became a Ghost. This archetype is a *state* that can afflict any aging leader, though it's most common with Apparatchiks. Game mechanic: Any leader over "age 70" has a yearly 10% chance of becoming a Ghost. Their archetype is overlaid with Ghost mechanics while their original archetype continues to influence background policy.

**How They Leave Power:** Death (which may have already happened — the announcement is delayed while factions position themselves), or a dramatic "return" where the Ghost reasserts control (rare, triggers "The Lazarus Event"). Game mechanic: Each year as Ghost, there's a 30% chance of death and a 5% chance of recovery.

#### Relationships to Other Archetypes
The Ghost doesn't have relationships — the factions AROUND the Ghost use the Ghost's authority against each other. Every archetype in the Politburo claims to be "carrying out the leader's wishes" while pursuing their own agenda.

#### Event Probability Modifiers

| Category | Modifier |
|----------|----------|
| Disasters | x1.5 (nobody is in charge of preventing them) |
| Political | x3.0 (factional warfare, succession positioning, "who actually signed this decree?") |
| Economic | x1.5 (contradictory policies create chaos) |
| Cultural | x1.0 (culture continues on autopilot) |
| Absurdist | x4.0 (this is peak absurdism — a nation run by a possibly-dead leader whose subordinates are too afraid to check) |

#### Resource Biases

| Resource | Modifier |
|----------|----------|
| All Resources | +/-20% random variance per turn (nobody is steering) |
| Party Loyalty | -10% per year (loyalty to whom?) |
| Morale | -15% per year (the existential dread of being governed by nobody) |
| Foreign Relations | -20% (foreign leaders can't get a meeting; ambassadors are left waiting indefinitely) |

#### Signature Policy: THE UNSIGNED DECREE

Every 6 game months, a mysterious decree arrives from the Ghost's office. The player must choose to implement it without knowing if it's genuine. Decrees are randomly generated from a table of 20 possibilities ranging from sensible ("increase grain reserves") to deranged ("all buildings must face magnetic north") to terrifying ("arrest everyone whose surname begins with K"). Implementing a genuine decree provides +10 Party Loyalty. Implementing a fake one (planted by a faction) causes a random negative event. Ignoring a decree risks the wrath of whichever faction sent it. The player never knows which decrees are real.

---

## III. Cross-Archetype Systems

### Succession Mechanics

When a leader leaves power, the next leader is determined by:

1. **Politburo Composition** — each member has an archetype, and the dominant faction nominates the successor
2. **Crisis Type** — certain crises favor certain archetypes (external threat -> Militarist, economic collapse -> Technocrat, cultural stagnation -> Poet)
3. **Predecessor Type** — historical patterns of succession:

| Predecessor | Most Likely Successor | Second Most Likely | Least Likely |
|-------------|----------------------|-------------------|-------------|
| Zealot | Reformer (35%) | Apparatchik (25%) | Populist (5%) |
| Idealist | Zealot (30%) | Technocrat (25%) | Collector (5%) |
| Reformer | Apparatchik (30%) | Technocrat (25%) | Zealot (5%) |
| Technocrat | Apparatchik (30%) | Reformer (20%) | Poet (5%) |
| Apparatchik | Apparatchik (35%) | Populist (20%) | Idealist (5%) |
| Populist | Militarist (25%) | Zealot (25%) | Populist (5%) |
| Militarist | Technocrat (25%) | Apparatchik (25%) | Poet (5%) |
| Mystic | Reformer (30%) | Technocrat (30%) | Mystic (5%) |
| Poet | Technocrat (30%) | Apparatchik (25%) | Militarist (5%) |
| Collector | Populist (30%) | Zealot (25%) | Collector (5%) |
| Ghost | (determined by dominant Politburo faction) | — | — |

### Purge Chains

When a leader purges an archetype, the purged individuals don't simply vanish — they create downstream effects:

- **Purging Scientists** (Zealot/Mystic): -20% Science for 10 years, "Brain Drain" event chain
- **Purging Military Officers** (Zealot/Populist): -30% Military effectiveness, vulnerability to foreign threats for 5 years
- **Purging Bureaucrats** (Reformer/Populist): -25% to all production for 3 years (nobody knows how anything works anymore)
- **Purging Artists** (Zealot/Militarist): -40% Culture, +20% Absurdist event probability (suppressed creativity emerges in weird ways)
- **Purging Economists** (Zealot/Mystic): -30% Light Industry and Agriculture for 5 years

### The "History Repeats" Mechanic

If the same archetype succession occurs twice (e.g., Zealot -> Reformer -> Apparatchik -> Zealot -> Reformer -> Apparatchik), the game triggers a "History Repeats" event where citizens become increasingly cynical. Each repetition:
- Morale -10% permanent
- Absurdist events +20% probability
- A unique "We've Seen This Before" event fires where the populace predicts the next policy before it's announced, reducing its effectiveness by 50%

---

## IV. Summary Reference Table

| Archetype | Overproduces | Neglects | Signature Mechanic | Absurdist Rating |
|-----------|-------------|---------|-------------------|-----------------|
| Zealot | Heavy Industry, Party Loyalty | Agriculture, Morale | The Great Plan (megaproject gamble) | Low |
| Idealist | Science, Culture | Light Industry, Housing | Total Electrification (infrastructure bet) | Medium |
| Reformer | Housing, Agriculture (variable) | Party Loyalty, Heavy Industry | The Corn Crusade (crop roulette) | High |
| Technocrat | Science, Light Industry | Culture, Morale | The Optimal Plan (reform vs. orthodoxy) | Very Low |
| Apparatchik | Party Loyalty, Vodka | Science, Housing | The Medal Economy (hidden decay) | Medium |
| Populist | Morale, Foreign Relations | Military, Party Loyalty | The Great Openness (reveal the truth) | High |
| Militarist | Military, Heavy Industry | Light Industry, Agriculture | Total Mobilization (war economy) | Medium |
| Mystic | Pseudoscience | Real Science, Agriculture | The New Biology (pseudoscience disaster) | Very High |
| Poet | Culture, Morale | Heavy Industry, Military | Cultural Revolution (productivity vs. beauty) | High |
| Collector | Personal Wealth (hidden) | Housing, Morale | Special Distribution (parallel economy) | High |
| Ghost | Nothing (random drift) | Everything (slowly) | The Unsigned Decree (mystery governance) | Extreme |

---

## V. Implementation Notes

### Procedural Generation

Leaders should be generated with:
- **Primary Archetype** (dominant behavior pattern)
- **Secondary Archetype** (minor influence, 30% weight — e.g., a "Zealot with Poet tendencies" commissions propaganda art between purges)
- **Personal Traits** (randomly assigned modifiers: "chain smoker" -> health penalty, "chess player" -> +5% Science, "former partisan" -> +10% Military, "reads poetry in private" -> occasional Culture boost)
- **Name** (procedurally generated from a pool of Slavic name components)
- **Physical Description** (randomly assembled from components: eyebrows, medals, hat size, mustache density)

### Balance Considerations

- No archetype should be purely beneficial — even the Technocrat's stability breeds complacency
- The "best" strategy should involve navigating between archetypes, not finding one and keeping it
- Absurdist events should increase over time regardless of leader type — entropy is the true antagonist
- The game should be *difficult to win* but *entertaining to lose* — the humor comes from the cascading failures

### Tone Guidelines

- **Dark comedy, not cruelty** — the satire targets the *system* and its *absurdity*, not the suffering of ordinary people
- **Equal opportunity mockery** — every ideology and archetype is skewered; no single political position is presented as correct
- **Historical accuracy in spirit** — specific events are exaggerated, but the underlying dynamics (central planning failures, cult of personality, bureaucratic inertia) should feel authentic
- **The player is complicit** — you are not an outside observer; you are trying to manage this system, and every choice has trade-offs

---

*Document version: 1.0*
*For use with SimSoviet 2000 game design specification*
*"Workers of the world, good luck — you will need it."*
