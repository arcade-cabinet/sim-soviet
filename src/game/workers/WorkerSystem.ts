import { System } from 'miniplex';
import type { Entity } from '@/ecs/world';
import { world, citizens } from '@/ecs/archetypes';

/**
 * WorkerSystem:
 *  - Assigns `worker` component to adult citizens (20-60) who lack it.
 *  - Assigns specific jobs based on gender/era rules.
 *  - Manages retired/child status by removing `worker` component if age inappropriate.
 *  - Ensures `stats` component exists for every citizen.
 */
export class WorkerSystem extends System<Entity> {
  private stats = world.with('stats');

  constructor() {
    super(world);
  }

  public override update(_dt: number): void {
    // 1. Ensure everyone has stats (name, hunger, morale)
    for (const entity of citizens) {
      this.ensureCitizenStats(entity);
    }

    // 2. Manage Worker Roles (Assign/Revoke based on age)
    this.manageWorkerRoles();
  }

  private ensureCitizenStats(entity: Entity): void {
    if (this.stats.has(entity)) return;

    let name = 'Comrade';
    let surname = 'Doe';

    // Attempt to link to Dvor for family name or specific identity
    if (entity.dvorId) {
      const dvor = world.where(e => e.dvor && e.dvor.id === entity.dvorId).first;
      if (dvor && dvor.dvor) {
        if (dvor.dvor.name) {
          surname = dvor.dvor.name.split(' ').pop() || 'Ivanov';
        }

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
    for (const entity of citizens) {
      this.manageCitizenRole(entity);
    }
  }

  private manageCitizenRole(entity: Entity): void {
    const { age } = entity.citizen;
    const isAdult = age >= 18 && age < 60;

    if (isAdult && !entity.worker) {
      this.assignWorkerRole(entity);
    } else if (!isAdult && entity.worker) {
      world.removeComponent(entity, 'worker');
    }
  }

  private assignWorkerRole(entity: Entity): void {
    // Assign default job
    // For simplicity, we just assign 'worker' role generic
    world.addComponent(entity, 'worker', {
      job: 'laborer',
      skill: 1,
      experience: 0
    });
  }
}
