/**
 * SpriteLoader — Async image loader with caching.
 *
 * Loads building sprites from the manifest at /sprites/soviet/manifest.json.
 * Each sprite has width, height, anchor_x, anchor_y for correct positioning.
 */

export interface SpriteInfo {
  image: HTMLImageElement;
  width: number;
  height: number;
  /** X offset from top-left of image to the tile base center. */
  anchorX: number;
  /** Y offset from top-left of image to the tile base center. */
  anchorY: number;
  role: string;
}

interface ManifestSprite {
  sprite: string;
  role: string;
  width: number;
  height: number;
  anchor_x: number;
  anchor_y: number;
  model_size: { x: number; y: number; z: number };
}

interface SpriteManifest {
  sprites: Record<string, ManifestSprite>;
}

export class SpriteLoader {
  private cache = new Map<string, SpriteInfo>();
  private loading = new Map<string, Promise<SpriteInfo>>();
  private manifest: SpriteManifest | null = null;

  /** Load the manifest and preload all building sprites. */
  async init(): Promise<void> {
    const resp = await fetch('/sprites/soviet/manifest.json');
    this.manifest = (await resp.json()) as SpriteManifest;

    // Preload all sprites in parallel
    const entries = Object.entries(this.manifest.sprites);
    await Promise.all(entries.map(([name]) => this.load(name)));
  }

  /** Load a single sprite by name. Returns cached if already loaded. */
  async load(name: string): Promise<SpriteInfo> {
    const cached = this.cache.get(name);
    if (cached) return cached;

    const existing = this.loading.get(name);
    if (existing) return existing;

    const promise = this._loadSprite(name);
    this.loading.set(name, promise);
    const info = await promise;
    this.loading.delete(name);
    return info;
  }

  /** Get a sprite synchronously (returns undefined if not yet loaded). */
  get(name: string): SpriteInfo | undefined {
    return this.cache.get(name);
  }

  /** Check if all sprites are loaded. */
  get ready(): boolean {
    return this.manifest !== null && this.loading.size === 0;
  }

  /** Get all available sprite names from the manifest. */
  get spriteNames(): string[] {
    if (!this.manifest) return [];
    return Object.keys(this.manifest.sprites);
  }

  private async _loadSprite(name: string): Promise<SpriteInfo> {
    if (!this.manifest) throw new Error('SpriteLoader: manifest not loaded');

    const entry = this.manifest.sprites[name];
    if (!entry) throw new Error(`SpriteLoader: unknown sprite "${name}"`);

    const image = await this._loadImage(`/sprites/soviet/${name}.png`);

    const info: SpriteInfo = {
      image,
      width: entry.width,
      height: entry.height,
      anchorX: entry.anchor_x,
      anchorY: entry.anchor_y,
      role: entry.role,
    };

    this.cache.set(name, info);
    return info;
  }

  private _loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }
}
