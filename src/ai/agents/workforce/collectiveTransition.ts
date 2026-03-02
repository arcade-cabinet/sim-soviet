/**
 * @fileoverview Population mode detection and entity-to-aggregate collapse transition.
 *
 * When population exceeds 200, the game transitions from tracking individual
 * citizen/dvor entities to aggregate workforce stats on buildings + a district-level
 * RaionPool. This is a one-way transition — once collapsed, the collective has
 * absorbed the individuals.
 *
 * @param totalPop - Current total population count
 * @param raion - Existing RaionPool (if already transitioned)
 */

import type { Entity, RaionPool } from '@/ecs/world';
import { world } from '@/ecs/world';
import { workforce } from '@/config';
import type { World } from 'miniplex';

const tcfg = workforce.transition;

/** Population tracking mode: individual entities or aggregate statistics. */
export type PopulationMode = 'entity' | 'aggregate';

/** Population threshold that triggers the one-way transition to aggregate mode. */
const AGGREGATE_THRESHOLD = tcfg.aggregateThreshold;

/** Default stats for citizens without WorkerStats data. */
const DEFAULT_MORALE = tcfg.defaultMorale;
const DEFAULT_SKILL = tcfg.defaultSkill;
const DEFAULT_LOYALTY = tcfg.defaultLoyalty;
const DEFAULT_VODKA_DEP = tcfg.defaultVodkaDep;

/** Number of 5-year age buckets (0-4 through 95-99). */
const AGE_BUCKET_COUNT = tcfg.ageBucketCount;

/**
 * Determine whether the game should use entity or aggregate population mode.
 *
 * Once a RaionPool exists, the mode is permanently 'aggregate' (one-way).
 * Otherwise, transitions to 'aggregate' when population exceeds the threshold.
 *
 * @param totalPop - Current total population
 * @param raion - Existing RaionPool if already transitioned
 * @returns The current population mode
 */
export function getPopulationMode(totalPop: number, raion?: RaionPool): PopulationMode {
  if (raion != null) return 'aggregate';
  if (totalPop > AGGREGATE_THRESHOLD) return 'aggregate';
  return 'entity';
}

/**
 * Collapse all citizen and dvor entities into building-level workforce aggregates
 * and a district-level RaionPool.
 *
 * This is a one-way, irreversible transition. After calling this function:
 * - All citizen entities are removed from the world
 * - All dvor entities are removed from the world
 * - Building entities have their workforce fields populated
 * - The returned RaionPool contains the district-level demographic summary
 *
 * @param w - The miniplex world to operate on (defaults to the singleton)
 * @returns The newly created RaionPool
 */
export function collapseEntitiesToBuildings(w: World<Entity> = world): RaionPool {
  // Step 1: Query all entity types
  const buildingEntities = [...w.with('building', 'position')];
  const citizenEntities = [...w.with('citizen')];
  const dvorEntities = [...w.with('dvor')];

  // Step 2: Build grid→building lookup for housing assignment
  const gridToBuilding = new Map<string, Entity>();
  for (const b of buildingEntities) {
    const key = `${b.position!.gridX},${b.position!.gridY}`;
    gridToBuilding.set(key, b);
  }

  // Build defId→buildings lookup for worker assignment (multiple buildings can share a defId)
  const defIdToBuildings = new Map<string, Entity[]>();
  for (const b of buildingEntities) {
    const defId = b.building!.defId;
    let list = defIdToBuildings.get(defId);
    if (!list) {
      list = [];
      defIdToBuildings.set(defId, list);
    }
    list.push(b);
  }

  // Step 3: Aggregate citizens into buildings
  // Track per-building worker counts for weighted average calculation
  const buildingWorkerCounts = new Map<Entity, number>();

  for (const citizen of citizenEntities) {
    const c = citizen.citizen!;

    // Worker assignment: distribute across buildings with matching defId
    if (c.assignment) {
      const matchingBuildings = defIdToBuildings.get(c.assignment);
      if (matchingBuildings && matchingBuildings.length > 0) {
        // Distribute proportionally by staffCap (or evenly if no staffCap)
        // For simplicity: round-robin assignment based on current fill level
        let target = matchingBuildings[0]!;
        let minWorkers = target.building!.workerCount;
        for (const b of matchingBuildings) {
          if (b.building!.workerCount < minWorkers) {
            target = b;
            minWorkers = b.building!.workerCount;
          }
        }

        const bld = target.building!;
        const oldCount = bld.workerCount;
        const morale = c.happiness ?? DEFAULT_MORALE;
        const skill = DEFAULT_SKILL;
        const loyalty = DEFAULT_LOYALTY;
        const vodkaDep = DEFAULT_VODKA_DEP;

        // Weighted average blending
        if (oldCount === 0) {
          bld.avgMorale = morale;
          bld.avgSkill = skill;
          bld.avgLoyalty = loyalty;
          bld.avgVodkaDep = vodkaDep;
        } else {
          bld.avgMorale = (bld.avgMorale * oldCount + morale) / (oldCount + 1);
          bld.avgSkill = (bld.avgSkill * oldCount + skill) / (oldCount + 1);
          bld.avgLoyalty = (bld.avgLoyalty * oldCount + loyalty) / (oldCount + 1);
          bld.avgVodkaDep = (bld.avgVodkaDep * oldCount + vodkaDep) / (oldCount + 1);
        }
        bld.workerCount = oldCount + 1;
        buildingWorkerCounts.set(target, bld.workerCount);
      }
    }

    // Housing assignment: use home grid position
    if (c.home) {
      const key = `${c.home.gridX},${c.home.gridY}`;
      const housingBuilding = gridToBuilding.get(key);
      if (housingBuilding?.building) {
        housingBuilding.building.residentCount++;
      }
    }
  }

  // Step 4: Build RaionPool from dvory
  const maleAgeBuckets = new Array<number>(AGE_BUCKET_COUNT).fill(0);
  const femaleAgeBuckets = new Array<number>(AGE_BUCKET_COUNT).fill(0);
  const classCounts: Record<string, number> = {};
  const pregnancyWaves = [0, 0, 0]; // [delivering, mid-term, newly conceived]
  let totalPopulation = 0;
  let totalHouseholds = 0;

  // Accumulators for population-weighted averages
  let moraleSum = 0;
  let loyaltySum = 0;
  let skillSum = 0;

  for (const dEntity of dvorEntities) {
    const dvor = dEntity.dvor!;
    totalHouseholds++;

    for (const member of dvor.members) {
      totalPopulation++;

      // Age bucket: floor(age/5), capped at 19
      const bucket = Math.min(Math.floor(member.age / 5), AGE_BUCKET_COUNT - 1);
      if (member.gender === 'male') {
        maleAgeBuckets[bucket]++;
      } else {
        femaleAgeBuckets[bucket]++;
      }

      // Pregnancy tracking: distribute into trimester buckets
      if (member.pregnant != null && member.pregnant > 0) {
        // pregnant is ticks remaining; assume 3 trimesters mapped to 3 buckets
        // High ticks = newly conceived, low ticks = about to deliver
        const maxPregnancyTicks = tcfg.maxPregnancyTicks; // ~3 months at 30 ticks/month
        const ratio = member.pregnant / maxPregnancyTicks;
        if (ratio > 0.66) {
          pregnancyWaves[2]++; // newly conceived
        } else if (ratio > 0.33) {
          pregnancyWaves[1]++; // mid-term
        } else {
          pregnancyWaves[0]++; // delivering
        }
      }
    }
  }

  // Class counts from citizen entities
  for (const citizen of citizenEntities) {
    const cls = citizen.citizen!.class;
    classCounts[cls] = (classCounts[cls] ?? 0) + 1;

    // Accumulate stats for population-weighted averages
    moraleSum += citizen.citizen!.happiness ?? DEFAULT_MORALE;
    loyaltySum += DEFAULT_LOYALTY;
    skillSum += DEFAULT_SKILL;
  }

  // Calculate labor force from citizen assignments
  let assignedWorkers = 0;
  for (const citizen of citizenEntities) {
    if (citizen.citizen!.assignment) {
      assignedWorkers++;
    }
  }

  // Working-age population: age buckets 3-11 (ages 15-59)
  let laborForce = 0;
  for (let i = 3; i <= 11; i++) {
    laborForce += maleAgeBuckets[i]! + femaleAgeBuckets[i]!;
  }

  const popCount = citizenEntities.length || 1; // avoid division by zero
  const avgMorale = moraleSum / popCount;
  const avgLoyalty = loyaltySum / popCount;
  const avgSkill = skillSum / popCount;
  const idleWorkers = Math.max(0, laborForce - assignedWorkers);

  // Household counts on housing buildings from dvory
  for (const dEntity of dvorEntities) {
    // Find which housing building this dvor belongs to via its citizens
    // For simplicity, distribute households across housing buildings evenly
    // (citizens have home positions linking to buildings)
  }

  // Count households per housing building from citizen home assignments
  const buildingHouseholdIds = new Map<string, Set<string>>();
  for (const citizen of citizenEntities) {
    const c = citizen.citizen!;
    if (c.home && c.dvorId) {
      const key = `${c.home.gridX},${c.home.gridY}`;
      let set = buildingHouseholdIds.get(key);
      if (!set) {
        set = new Set();
        buildingHouseholdIds.set(key, set);
      }
      set.add(c.dvorId);
    }
  }
  for (const [key, dvorIds] of buildingHouseholdIds) {
    const housingBuilding = gridToBuilding.get(key);
    if (housingBuilding?.building) {
      housingBuilding.building.householdCount = dvorIds.size;
    }
  }

  // Step 5: Remove all citizen entities
  for (const citizen of citizenEntities) {
    w.remove(citizen);
  }

  // Step 6: Remove all dvor entities
  for (const dEntity of dvorEntities) {
    w.remove(dEntity);
  }

  // Step 7: Return the RaionPool
  return {
    totalPopulation,
    totalHouseholds,
    maleAgeBuckets,
    femaleAgeBuckets,
    classCounts,
    birthsThisYear: 0,
    deathsThisYear: 0,
    totalBirths: 0,
    totalDeaths: 0,
    pregnancyWaves,
    laborForce,
    assignedWorkers,
    idleWorkers,
    avgMorale,
    avgLoyalty,
    avgSkill,
  };
}
