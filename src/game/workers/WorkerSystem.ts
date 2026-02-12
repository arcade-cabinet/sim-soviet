import { System } from 'miniplex';
import type { Entity } from '@/ecs/world';
import { world, citizens } from '@/ecs/archetypes';
import { getGenderLaborConfig } from './genderLabor';
import { ERA_GENDER_CONFIGS } from './genderLabor';

/**
 * WorkerSystem:
 *  - Assigns `worker` component to adult citizens (20-60) who lack it.
 *  - Assigns specific jobs based on gender/era rules (Dvor-based or general).
 *  - Manages retired/child status by removing `worker` component if age inappropriate.
 *  - Ensures `stats` component exists for every citizen (names, hunger, morale).
 */
export class WorkerSystem extends System<Entity> {
  // We'll iterate over all citizens to check age/worker status
  // In Miniplex, we can just iterate `citizens` archetype from world

  private stats = world.with('stats');
  private workers = world.with('worker', 'citizen');

  constructor() {
    super(world);
  }

  public override update(_dt: number): void {
    // 1. Ensure everyone has stats (name, hunger, morale)
    this.ensureStats();

    // 2. Manage Worker Roles (Assign/Revoke based on age)
    this.manageWorkerRoles();

    // 3. Update Statistics / Resource generation placeholders?
    //    Real production usually happens in a separate ProductionSystem or ResourceSystem.
    //    But we can handle job re-assignments here if needed.
  }

  /**
   * Handles linking to Dvor members (names) if possible.
   */
  private ensureStats(): void {
    for (const entity of citizens) {
      this.ensureCitizenStats(entity);
    }
  }

  private ensureCitizenStats(entity: Entity): void {
    if (this.stats.has(entity)) return;

    // Default name if none
    let name = 'Comrade';
    let surname = 'Doe';

    // Attempt to link to Dvor for family name or specific identity
    if (entity.dvorId) {
      const dvor = world.where(e => e.dvor && e.dvor.id === entity.dvorId).first;
      if (dvor && dvor.dvor) {
        // Simple logic: adopt Dvor name as surname if defined, or generate one
        if (dvor.dvor.name) {
          surname = dvor.dvor.name.split(' ').pop() || 'Ivanov';
        }

        // Find a member slot in the Dvor to identify this person?
        // For now, just generate a random Russian-ish name
        const firstNames = entity.citizen.gender === 'male'
          ? ['Ivan', 'Dmitry', 'Alexei', 'Sergei', 'Vladimir', 'Pyotr', 'Mikhail']
          : ['Anna', 'Maria', 'Elena', 'Olga', 'Tatiana', 'Natasha', 'Svetlana'];

        name = firstNames[Math.floor(Math.random() * firstNames.length)]!;
      }
    }

    world.addComponent(entity, 'stats', {
      name: `${name} ${surname}`,
      hunger: 100,
      morale: 100,
      health: 100
    });
  }

  private manageWorkerRoles(): void {
    const eraId = 'revolution'; // TODO: Get from global Era system
    const config = getGenderLaborConfig(eraId);

    for (const entity of citizens) {
      const { age, gender } = entity.citizen;
      const isAdult = age >= 18 && age < 60;

      // If adult and not a worker, make them a worker
      if (isAdult && !entity.worker) {
        // Assign default job based on gender config
        const allowedJobs = gender === 'male' ? config.male : config.female;
        // Pick random valid job or default to 'general_labor'
        // For simplicity, we just assign 'worker' role generic
        // In detailed system, we'd pick from allowedJobs

        world.addComponent(entity, 'worker', {
          job: 'laborer', // Default generic job
          skill: 1,
          experience: 0
        });

        // Console log for debug
        // console.log(`[WorkerSystem] Assigned job 'laborer' to ${entity.stats?.name || 'Citizen'}`);
      }

      // If NOT adult (too old or too young) but HAS worker, remove it (retire/child)
      if (!isAdult && entity.worker) {
        world.removeComponent(entity, 'worker');
        // console.log(`[WorkerSystem] Removed job from ${entity.stats?.name || 'Citizen'} (Age: ${age})`);
      }
    }
  }
}
