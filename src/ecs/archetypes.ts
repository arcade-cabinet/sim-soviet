import { World } from 'miniplex';
import type { Entity } from '../world';

const world = new World<Entity>();
export { world };

export const citizens = world.with('citizen');
export const dvory = world.with('dvor');
export const resources = world.with('resources');
export const meta = world.with('meta');
export const ui = world.with('ui');
export const producers = world.with('production'); // Assuming 'production' component exists
export const consumers = world.with('consumption'); // Assuming 'consumption' component exists

export function getResourceEntity() {
  return resources.first;
}

export function getMetaEntity() {
  return meta.first;
}
