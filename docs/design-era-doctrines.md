# Era Doctrine System — Design Spec

## Overview

Era Doctrines are composable policy modifier sets that any leader can adopt at any time, regardless of calendar year. They are ideological archetypes, not historical periods. A Stalinist zealot in 2030 can adopt "Industrialization." An apparatchik in 1925 can adopt "Stagnation."

## Doctrines

### 1. Revolutionary
*"We have nothing to lose but our chains! Also our food. And possibly our lives."*
- Building cost 0.7x, food 0.6x, vodka 0.3x, power 0.5x, fear 0.9, cultural freedom 0.4
- Signature mechanic: **Expropriation** — seize 40-80% of buildings, temporary enthusiasm boost then decay
- No private gardens, no vodka, no foreign trade, no religion
- Political events ×2.5, economic ×1.8

### 2. Industrialization
*"We must make good this distance in ten years. Either we do it, or they will crush us."*
- Building cost 1.5x, food 0.7x, power 1.8x, fear 1.3, corruption 5%
- Signature mechanic: **Five-Year Plan** — 3-5 specific targets, can fabricate reports (risk inspection)
- Gulag active, mandatory parades, no private gardens
- Economic events ×2.0, political ×1.8

### 3. Wartime
*"Everything for the front, everything for victory!"*
- Building cost 2.0x, food 0.5x, conscription 40%, fear 1.5, cultural freedom 0.1
- Signature mechanic: **Factory Conversion** — convert civilian buildings to military production, "Front" meter
- Victory gardens allowed, religion returns for morale, culture buildings converted
- Disaster events ×3.0, economic ×2.5

### 4. Reconstruction
*"From rubble, we build!"*
- Building cost 0.8x, population growth 1.4x, decay 0.5x, fear 0.4
- Signature mechanic: **Rubble Salvage** — harvest destroyed buildings, find hidden artifacts
- Everything allowed, optimistic period
- Economic events ×1.5

### 5. Thaw
*"Perhaps things could be... slightly less terrible?"*
- Food 1.3x, vodka 1.4x, pop growth 1.2x, fear 0.2, cultural freedom 1.5, corruption 8%
- Signature mechanic: **Private Gardens** — per-building food production bypassing corruption, Garden Index threshold triggers Freeze
- Cultural events ×2.5

### 6. Freeze
*"The Thaw was a mistake."*
- Vodka 0.7x, fear 1.4, cultural freedom 0.2, conscription 8%
- Signature mechanic: **Informant Network** — assign informants to buildings, denunciation reports, paranoia spiral at >60% coverage
- Gardens confiscated, borders tightened, gulag expanded
- Political events ×2.0, cultural ×1.8

### 7. Stagnation
*"Everything is fine. The queue for bread is only four hours."*
- Vodka 1.8x, decay 2.0x, corruption 25%, fear 0.3
- Signature mechanic: **The Queue** — growing delay on all resource collection, queue culture mini-events, breaking point at 15-tick delay
- No leader voluntarily adopts this — happens when leader does nothing for 50+ ticks
- Absurdist events ×2.5

### 8. Eternal
*"The year is 2047. The Soviet Union continues to exist. Nobody is entirely sure how."*
- Building cost 0.5x, vodka 2.0x, corruption 30%, cultural freedom 2.0, decay 0.3x
- Food production is probabilistic (×random(0.3, 1.7), reported as 1.0x)
- Signature mechanic: **Bureaucratic Singularity** — Paperwork resource accumulates, at 2000 bureaucracy becomes self-aware, at 5000 offers player merge-or-fight choice
- Terminal doctrine — only exits via deliberate system reboot (70% Revolutionary, 30% loops back)
- Absurdist events ×5.0

## Modifier Composition

Modifiers lerp over 10 ticks during transitions. Leader personality traits stack multiplicatively (e.g., paranoia > 0.7 adds +0.3 fear in any doctrine).

## TypeScript Interfaces

```typescript
interface DoctrineModifiers {
  buildingCost: number;
  foodProduction: number;
  vodkaProduction: number;
  powerProduction: number;
  populationGrowth: number;
  buildingDecay: number;
  corruptionRate: number;
  conscriptionRate: number;
  fearLevel: number;
  culturalFreedom: number;
}

interface DoctrinePolicies {
  privateGardens: PolicyState;
  vodkaLegal: PolicyState;
  foreignTrade: PolicyState;
  religiousBuildings: PolicyState;
  artCultureBuildings: PolicyState;
  gulagSystem: PolicyState;
  mandatoryParades: PolicyState;
}

type PolicyState = 'yes' | 'no' | 'tolerated' | 'restricted' | 'rationed' | 'limited' | 'reduced' | 'minimal' | 'vestigial' | 'unknown';

interface DoctrineEventWeights {
  disaster: number;
  political: number;
  economic: number;
  cultural: number;
  absurdist: number;
}

interface DoctrineDefinition {
  id: string;
  name: string;
  tagline: string;
  modifiers: DoctrineModifiers;
  policies: DoctrinePolicies;
  eventWeights: DoctrineEventWeights;
  transitions: {
    naturalSuccessors: string[];
    forbiddenDirectTransitions: string[];
    voluntaryAdoption: boolean | string;
  };
  signatureMechanic: SignatureMechanic;
}
```

## Transition Graph

Revolutionary → Industrialization/Wartime → Reconstruction → Thaw ↔ Freeze → Stagnation → Eternal (terminal)

Eternal only exits via 70% Revolutionary / 30% loop. Stagnation auto-triggers after 50+ idle ticks.
