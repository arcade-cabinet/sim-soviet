export interface SpriteConfig {
  frameWidth: number;
  frameHeight: number;
  animations: Record<string, { row: number; frames: number }>;
}

export class CharacterSpriteLoader {
  private static instance: CharacterSpriteLoader;
  private sprites: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();
  public ready = false;

  // Configuration for 128x128 spritesheet
  public static readonly CONFIG: SpriteConfig = {
    frameWidth: 128,
    frameHeight: 128,
    animations: {
      idle: { row: 0, frames: 1 }, // Just use 1st frame for idle
      walk: { row: 0, frames: 8 }, // 8 frames walking
      work: { row: 1, frames: 6 }, // Assuming row 1 is work
    },
  };

  private constructor() {
    this.loadAll();
  }

  public static getInstance(): CharacterSpriteLoader {
    if (!CharacterSpriteLoader.instance) {
      CharacterSpriteLoader.instance = new CharacterSpriteLoader();
    }
    return CharacterSpriteLoader.instance;
  }

  private async loadAll() {
    const classes = [
      'worker',
      'party_official',
      'engineer',
      'soldier',
      'farmer',
      'prisoner',
      'child',
      'elder'
    ];

    const promises = classes.map(c => this.loadImage(`/sprites/characters/${c}.png`));
    await Promise.all(promises);
    this.ready = true;
  }

  public get(characterClass: string, action: string, frameIndex: number, timestamp: number) {
    const img = this.sprites.get(`/sprites/characters/${characterClass}.png`);
    if (!img) return null;

    // Determine animation frame
    // For now, simple mapping
    const anim = CharacterSpriteLoader.CONFIG.animations[action] || CharacterSpriteLoader.CONFIG.animations.idle!;

    // Calculate actual frame based on time if needed, or use passed frameIndex
    // Here we assume frameIndex is 0..frames-1 provided by renderer
    const safeFrame = frameIndex % anim.frames;

    return {
      image: img,
      sx: safeFrame * CharacterSpriteLoader.CONFIG.frameWidth,
      sy: anim.row * CharacterSpriteLoader.CONFIG.frameHeight,
      sw: CharacterSpriteLoader.CONFIG.frameWidth,
      sh: CharacterSpriteLoader.CONFIG.frameHeight
    };
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    if (this.sprites.has(src)) {
      return Promise.resolve(this.sprites.get(src)!);
    }

    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        this.sprites.set(src, img);
        this.loadingPromises.delete(src);
        resolve(img);
      };
      img.onerror = (err) => {
        console.error(`Failed to load sprite: ${src}`, err);
        // Fallback or reject?
        // Resolve with empty image to prevent crashes
        this.sprites.set(src, new Image());
        resolve(new Image());
      };
    });

    this.loadingPromises.set(src, promise);
    return promise;
  }
}
