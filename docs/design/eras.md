# Era-Based Campaigns

Structure like Civilization — progress through eras, accumulate score, carry your collective forward.

---

## Era Overview

| # | Era | Years | Settlement Status | Core Mechanic | Victory Condition |
|---|-----|-------|-------------------|---------------|-------------------|
| 1 | **Revolution** | 1917-1922 | Selo (12 peasants) | Land redistribution, survival basics | Survive Civil War chaos, establish collective |
| 2 | **Collectivization** | 1922-1932 | Selo → Posyolok | Forced grain quotas, kulak purges | Meet first Five-Year Plan |
| 3 | **Industrialization** | 1932-1941 | Posyolok | Factory conversion, gulag labor | Transform to industrial center |
| 4 | **Great Patriotic War** | 1941-1945 | Posyolok → PGT | Conscription, factory conversion, rationing | Survive with >50% population |
| 5 | **Reconstruction** | 1945-1956 | PGT (war-damaged) | Rubble salvage, veteran integration | Rebuild infrastructure |
| 6 | **Thaw & Freeze** | 1956-1982 | PGT → Gorod | Policy oscillation | Navigate 3 doctrine switches |
| 7 | **Stagnation** | 1982-2000 | Gorod (aging) | The Queue, decay, vodka economy | Keep city functional 18 years |
| 8 | **The Eternal** | 2000-??? | Gorod (bizarre) | Bureaucratic Singularity | Reach 5000 paperwork |

*Settlement status is a natural progression based on population and building thresholds — see `overview.md` for tier details.*

---

## Era Transitions — What Carries Over

The collective is continuous. Same map, same buildings, same workers. Era transitions are narrative/mechanical shifts, not resets.

### What Carries Over
- **Map**: Same terrain, same tile layout
- **Buildings**: All buildings survive (unless era events destroy some)
- **Workers**: Same workers with their stats (morale, loyalty, skill, health)
- **Blat**: Connections persist (reduced by 30% — new era, some contacts shuffled)
- **Score**: Cumulative across all eras

### What Changes
- **Doctrine**: New default doctrine for the era (modifiers shift over 10 ticks)
- **Available buildings**: New building types unlocked, some may be banned
- **Quota structure**: New 5-year plan with era-appropriate targets
- **Political apparatus**: Politruks reshuffled, KGB posture changes
- **Black marks**: Reset to 2 (fresh-ish start, but the file follows you)
- **Compulsory delivery rates**: Change per era

### Era Checkpoint System
- Completing an era saves a **checkpoint** — the state of your collective at that moment
- If you fail an era (arrested), you can restart FROM that era's checkpoint
- You can also restart the entire game from Era 1
- Checkpoints allow replaying specific eras for better scores

### What Happens to Buildings That Don't Fit?
- Buildings banned by new doctrine are **shuttered** — they stand but produce nothing
- Shuttered buildings can be **repurposed** if a later doctrine re-allows them
- Example: Cultural Palace shuttered during Freeze, reopened during next Thaw
- Wartime era: some buildings **converted** to military production (forced, not player choice)

---

## Era Doctrine Integration

Each era has a default doctrine. Leaders can adopt doctrines independently of calendar year.

| Era | Default Doctrine | Can Also Trigger |
|-----|-----------------|------------------|
| Revolution | Revolutionary | — |
| Collectivization | Revolutionary → Industrialization | — |
| Industrialization | Industrialization | Wartime (war events) |
| Great Patriotic War | Wartime | — |
| Reconstruction | Reconstruction | Thaw |
| Thaw & Freeze | Thaw ↔ Freeze | Stagnation (passive leader) |
| Stagnation | Stagnation | Freeze (reactionary) |
| The Eternal | Eternal | Revolutionary (system reboot, 70%) |

See `../design-era-doctrines.md` for full doctrine definitions.

---

## Era-Specific Mechanics

### Era 1: Revolution (1917-1922)
- **Start**: 12 peasants, no buildings, undeveloped land
- **Resources**: Timber only. No steel, no power.
- **Buildings available**: Kolkhoz HQ, wooden barracks, watchtower, well, granary
- **Threats**: Civil War chaos (random events: bandits, requisition squads, White Army raids)
- **Special**: Workers can forage in forests (hunting minigame). Improvised shelters for first 2 years.
- **MTS**: Not yet created. All labor is manual.

### Era 2: Collectivization (1922-1932)
- **Start**: Established collective from Era 1
- **Unlocks**: Collective farm, tractor station, village school, party HQ
- **Key tension**: Forced grain quotas destroy farming capacity. Historical: millions starved.
- **Special**: Kulak events — "rich peasants" identified and purged. You choose: resist (marks) or comply (lose skilled farmers).
- **MTS arrives**: Heavy equipment available but costs grain.

### Era 3: Industrialization (1932-1941)
- **Unlocks**: Factory, power station, rail depot, concrete apartments, gulag
- **Key tension**: Workers pulled from farms to factories. Food production drops while industrial quotas soar.
- **Special**: Stakhanovite events begin. Gulag labor force available (free workers, but fear/morale consequences).
- **Great Terror**: Random purge waves. Even loyal workers disappear. Nothing you can do.

### Era 4: Great Patriotic War (1941-1945)
- **Immediate effect**: 30-40% workers conscripted. Factories converted.
- **Resources**: Everything rationed. Ration cards mandatory.
- **Key tension**: Feed workers vs. meet military production quotas with half the workforce.
- **Special**: Evacuees may arrive (workers from other collectives). "Victory gardens" allowed.
- **Threats**: Bombardment events (buildings destroyed). Partisan requests (give supplies, risk marks).

### Era 5: Reconstruction (1945-1956)
- **Start**: War-damaged collective. Some buildings destroyed. Population reduced.
- **Unlocks**: Construction yard, memorial, rebuilt housing, cultural center
- **Key tension**: Rebuilding with reduced workforce. Veterans return but are traumatized.
- **Special**: Rubble salvage — damaged buildings can be harvested for materials. Low quotas but also low resources.
- **MTS abolished (1958)**: Near end of era, kolkhozes must acquire their own equipment.

### Era 6: Thaw & Freeze (1956-1982)
- **Unlocks**: University, cinema, KGB station, radio tower, private gardens
- **Key tension**: Policy oscillates. Cultural freedom → crackdown → freedom → crackdown.
- **Special**: Private gardens allowed during Thaw (food supplement). Confiscated during Freeze.
- **Victory**: Navigate 3 doctrine switches without collapse. The whiplash is the enemy.
- **Consumer goods**: First appearance of consumer economy. Workers can buy things (sometimes).

### Era 7: Stagnation (1982-2000)
- **Unlocks**: Queue management office, vodka distillery expansion, bureaucratic center
- **Key tension**: Everything slowly decays. Buildings crumble. Queues grow. Nothing works.
- **Special**: Vodka becomes primary morale tool. Paperwork resource accumulates.
- **Corruption**: Compulsory delivery rates include "administrative losses" — corruption eats the remainder.
- **The Queue**: Visible lines form at buildings. Queue management minigame triggers.

### Era 8: The Eternal (2000-???)
- **Unlocks**: Monument to Bureaucracy, Archive of Everything, The Queue (building)
- **Key tension**: Food production is probabilistic — output varies randomly but is REPORTED as stable.
- **Special**: Bureaucratic Singularity — Paperwork resource accumulates. At 2000: bureaucracy becomes self-aware. At 5000: offers merge-or-fight choice.
- **Absurdist events x5**: The game becomes increasingly surreal.
- **Terminal state**: Only exits via Revolutionary reboot (70%) or loops (30%).
