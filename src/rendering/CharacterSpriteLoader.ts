/**
 * CharacterSpriteLoader — Loads AI-generated character sprite sheets
 * and provides lookup by citizenClass × gender × ageCategory.
 *
 * Each sprite sheet is a grid of 128×128 cells. The top-left cell (0,0)
 * is the canonical idle frame used for map rendering.
 *
 * Fallback chain when exact match is missing:
 *   1. {class}_{gender}_{age}
 *   2. {class}_{gender}_adult
 *   3. worker_{gender}_{age}
 *   4. worker_{gender}_adult
 */

/** All character sprite filenames (without .png extension). */
const CHARACTER_NAMES = [
  // Household civilians
  'worker_male_adult',
  'worker_female_adult',
  'worker_male_elder',
  'worker_female_elder',
  'worker_male_adolescent',
  'worker_female_adolescent',
  'worker_male_child',
  'worker_female_child',
  // Specialist classes
  'engineer_male_adult',
  'engineer_female_adult',
  'farmer_male_adult',
  'farmer_female_adult',
  // External force / authority
  'soldier_male_adult',
  'kgb_male_adult',
  'party_official_male_adult',
  // Prisoners
  'prisoner_male_adult',
  'prisoner_female_adult',
] as const;

/** Size of one cell in the sprite sheet grid. */
const CELL_PX = 128;

export interface CharacterSprite {
  image: HTMLImageElement;
  /** Source X in the sprite sheet (top-left cell). */
  sx: number;
  /** Source Y in the sprite sheet (top-left cell). */
  sy: number;
  /** Source width to sample. */
  sw: number;
  /** Source height to sample. */
  sh: number;
}

export class CharacterSpriteLoader {
  private cache = new Map<string, HTMLImageElement>();
  private _ready = false;

  /** Load all character sprite sheets. Call once at startup. */
  async init(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    const loads = CHARACTER_NAMES.map(async (name) => {
      const img = await this.loadImage(`${base}sprites/soviet/characters/${name}.png`);
      this.cache.set(name, img);
    });

    // Load in parallel, but don't fail if individual sprites are missing
    const results = await Promise.allSettled(loads);
    const loaded = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`CharacterSpriteLoader: ${loaded}/${CHARACTER_NAMES.length} sprites loaded`);
    this._ready = true;
  }

  get ready(): boolean {
    return this._ready;
  }

  /**
   * Look up a character sprite by class, gender, and age category.
   * Returns the sprite image + source rect for the idle frame (top-left cell),
   * or undefined if no matching sprite exists.
   */
  get(
    citizenClass: string,
    gender: string | undefined,
    ageCategory: string | undefined
  ): CharacterSprite | undefined {
    const g = gender ?? 'male';
    const a = ageCategory ?? 'adult';

    // Fallback chain
    const candidates = [
      `${citizenClass}_${g}_${a}`,
      `${citizenClass}_${g}_adult`,
      `worker_${g}_${a}`,
      `worker_${g}_adult`,
    ];

    for (const key of candidates) {
      const img = this.cache.get(key);
      if (img) {
        return {
          image: img,
          sx: 0,
          sy: 0,
          sw: CELL_PX,
          sh: CELL_PX,
        };
      }
    }

    return undefined;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${src}`));
      img.src = src;
    });
  }
}
