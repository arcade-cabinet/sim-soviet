/**
 * Land grant radius by settlement tier.
 * Territory is a reward/punishment mechanic controlled by the state.
 */
export const LAND_GRANT_TIERS: Record<string, { radius: number; description: string }> = {
  selo: { radius: 15, description: 'Initial allotment — ~15 tiles from HQ' },
  posyolok: { radius: 30, description: '50+ population, 1 industry' },
  pgt: { radius: 60, description: '150+ pop, 50% non-agricultural' },
  gorod: { radius: 120, description: '400+ pop, 85% non-agricultural, 5+ building roles' },
};

/** Get the land grant radius for a settlement tier. */
export function getLandGrantRadius(tier: string): number {
  return LAND_GRANT_TIERS[tier]?.radius ?? LAND_GRANT_TIERS.selo.radius;
}
