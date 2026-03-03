/**
 * Minimal ambient type declarations for the yuka AI library.
 *
 * yuka does not ship @types/yuka. These declarations cover only the API surface
 * actually used in SimSoviet's agent architecture (Vehicle, EntityManager,
 * GameEntity, MovingEntity, Position).
 *
 * Method signatures are intentionally loose (any[] params) because SimSoviet
 * agents override update/toJSON/fromJSON/sendMessage with domain-specific
 * signatures that differ from yuka's base declarations.
 */
declare module 'yuka' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    distanceTo(v: Vector3): number;
    length(): number;
    normalize(): this;
    clone(): Vector3;
  }

  /** Position is a Vector3 alias in yuka. */
  export type Position = Vector3;

  export class GameEntity {
    name: string;
    active: boolean;
    position: Vector3;
    boundingRadius: number;
    manager: EntityManager | null;
    sendMessage(...args: any[]): any;
    start(): this;
    update(...args: any[]): any;
    toJSON(...args: any[]): any;
    fromJSON(...args: any[]): any;
  }

  export class MovingEntity extends GameEntity {
    velocity: Vector3;
    maxSpeed: number;
    maxForce: number;
    mass: number;
  }

  export class Vehicle extends MovingEntity {
    maxTurnRate: number;
    steering: SteeringManager;
    /** Allow subclasses to declare any additional properties. */
    [key: string]: any;
  }

  export class SteeringManager {
    add(behavior: SteeringBehavior): this;
    remove(behavior: SteeringBehavior): this;
    clear(): this;
  }

  export class SteeringBehavior {
    active: boolean;
    weight: number;
  }

  export class EntityManager {
    add(entity: GameEntity): this;
    remove(entity: GameEntity): this;
    update(delta: number): this;
    sendMessage(...args: any[]): any;
    entities: GameEntity[];
  }
}
