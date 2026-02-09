import { Scene } from '@babylonjs/core/scene';
import { ParticleSystem as BabylonParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export class ParticleSystem {
  private snowSystem: BabylonParticleSystem | null = null;
  private smokeSystem: BabylonParticleSystem | null = null;

  constructor(private scene: Scene) {}

  public createSnowEffect(): void {
    // Dispose existing snow system before creating a new one
    if (this.snowSystem) {
      this.snowSystem.dispose();
      this.snowSystem = null;
    }

    // Create snow particle system
    this.snowSystem = new BabylonParticleSystem('snow', 1000, this.scene);

    // Create a simple white texture for snow
    this.snowSystem.particleTexture = new Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAD0lEQVQYV2P8//8/AwMDAwAG/AL+3FwFGgAAAABJRU5ErkJggg==',
      this.scene
    );

    // Emission area - from above
    this.snowSystem.emitter = new Vector3(0, 20, 0);
    this.snowSystem.minEmitBox = new Vector3(-30, 0, -30);
    this.snowSystem.maxEmitBox = new Vector3(30, 0, 30);

    // Colors
    this.snowSystem.color1 = new Color4(1, 1, 1, 1);
    this.snowSystem.color2 = new Color4(0.9, 0.9, 0.9, 1);
    this.snowSystem.colorDead = new Color4(1, 1, 1, 0);

    // Size
    this.snowSystem.minSize = 0.1;
    this.snowSystem.maxSize = 0.3;

    // Life time
    this.snowSystem.minLifeTime = 5;
    this.snowSystem.maxLifeTime = 10;

    // Emission rate
    this.snowSystem.emitRate = 100;

    // Gravity
    this.snowSystem.gravity = new Vector3(0, -2, 0);

    // Direction
    this.snowSystem.direction1 = new Vector3(-0.5, -1, -0.5);
    this.snowSystem.direction2 = new Vector3(0.5, -1, 0.5);

    // Speed
    this.snowSystem.minEmitPower = 0.5;
    this.snowSystem.maxEmitPower = 1;
    this.snowSystem.updateSpeed = 0.01;

    this.snowSystem.start();
  }

  public createSmokeEffect(position: Vector3): BabylonParticleSystem {
    const smoke = new BabylonParticleSystem('smoke', 100, this.scene);

    smoke.particleTexture = new Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAD0lEQVQYV2NgYGD4DwQAAP//AwIAAdX+OwAAAABJRU5ErkJggg==',
      this.scene
    );

    smoke.emitter = position;
    smoke.minEmitBox = new Vector3(-0.1, 0, -0.1);
    smoke.maxEmitBox = new Vector3(0.1, 0, 0.1);

    // Smoke colors (grey)
    smoke.color1 = new Color4(0.3, 0.3, 0.3, 0.8);
    smoke.color2 = new Color4(0.4, 0.4, 0.4, 0.6);
    smoke.colorDead = new Color4(0.5, 0.5, 0.5, 0);

    smoke.minSize = 0.5;
    smoke.maxSize = 1.5;

    smoke.minLifeTime = 2;
    smoke.maxLifeTime = 4;

    smoke.emitRate = 20;

    // Rising smoke
    smoke.direction1 = new Vector3(-0.2, 1, -0.2);
    smoke.direction2 = new Vector3(0.2, 2, 0.2);

    smoke.minEmitPower = 0.5;
    smoke.maxEmitPower = 1.5;
    smoke.updateSpeed = 0.02;

    smoke.start();
    return smoke;
  }

  public stopSnow(): void {
    if (this.snowSystem) {
      this.snowSystem.stop();
    }
  }

  public startSnow(): void {
    if (this.snowSystem) {
      this.snowSystem.start();
    }
  }

  public dispose(): void {
    if (this.snowSystem) {
      this.snowSystem.dispose();
    }
    if (this.smokeSystem) {
      this.smokeSystem.dispose();
    }
  }
}
