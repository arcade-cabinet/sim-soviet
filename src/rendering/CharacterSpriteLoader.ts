export class CharacterSpriteLoader {
    private sprites = new Map<string, HTMLImageElement>();
    private loadingPromise: Promise<void> | null = null;
    private _ready = false;

    get ready() {
      return this._ready;
    }

    load(): Promise<void> {
      if (this.loadingPromise) return this.loadingPromise;

      // Load the single atlas file
      this.loadingPromise = this.loadImage('/assets/sprites/characters.png')
        .then((img) => {
          if (img) {
            this.sprites.set('atlas', img);
            this._ready = true;
          } else {
            console.error('Failed to load character atlas');
          }
        })
        .catch((err) => {
          console.error('Error loading character sprites:', err);
        });

      return this.loadingPromise;
    }

    get(citizenClass: string): { image: HTMLImageElement; sx: number; sy: number; sw: number; sh: number } | undefined {
      if (!this._ready) return undefined;
      const atlas = this.sprites.get('atlas');
      if (!atlas) return undefined;

      // Map class to sprite index/coordinates
      // Assuming a simple grid or specific layout.
      // For now, let's assume specific coordinates or indices for each class.
      // 128x128 sprites, 4 cols x 2 rows

      let col = 0;
      let row = 0;

      switch (citizenClass) {
        case 'worker': col = 0; row = 0; break;
        case 'farmer': col = 1; row = 0; break;
        case 'soldier': col = 2; row = 0; break;
        case 'engineer': col = 3; row = 0; break;
        case 'party_official': col = 0; row = 1; break;
        case 'prisoner': col = 1; row = 1; break;
        case 'child': col = 2; row = 1; break;
        default: col = 0; row = 0; break; // Fallback to worker
      }

      return {
        image: atlas,
        sx: col * 128,
        sy: row * 128,
        sw: 128,
        sh: 128
      };
    }

    private loadImage(src: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }
  }
