/**
 * ParticleSystem2D — Screen-space snow/rain particles for Canvas 2D.
 *
 * Particles are drawn in screen coordinates (after the camera transform is restored),
 * so they fall straight down regardless of camera pan/zoom.
 */

export type WeatherType = 'snow' | 'rain' | 'none';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export class ParticleSystem2D {
  private particles: Particle[] = [];
  private weatherType: WeatherType = 'none';
  private maxParticles = 120;
  private width = 0;
  private height = 0;

  /** Update viewport size (call on resize). */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** Set the weather type. */
  setWeather(type: WeatherType): void {
    if (type === this.weatherType) return;
    this.weatherType = type;
    if (type === 'none') {
      this.particles = [];
    }
  }

  /** Update and draw particles. Called each frame with the screen-space context. */
  update(ctx: CanvasRenderingContext2D): void {
    if (this.weatherType === 'none' || this.width === 0) return;

    // Spawn new particles
    while (this.particles.length < this.maxParticles) {
      this.particles.push(this.spawnParticle());
    }

    // Update + draw
    if (this.weatherType === 'snow') {
      this.updateSnow(ctx);
    } else if (this.weatherType === 'rain') {
      this.updateRain(ctx);
    }
  }

  private spawnParticle(): Particle {
    if (this.weatherType === 'rain') {
      return {
        x: Math.random() * this.width,
        y: -10,
        vx: -0.5,
        vy: 8 + Math.random() * 4,
        size: 1,
        alpha: 0.3 + Math.random() * 0.4,
      };
    }
    // Snow
    return {
      x: Math.random() * this.width,
      y: -10,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.5 + Math.random() * 1.5,
      size: 1 + Math.random() * 2,
      alpha: 0.5 + Math.random() * 0.5,
    };
  }

  private updateSnow(ctx: CanvasRenderingContext2D): void {
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.x += p.vx + Math.sin(p.y * 0.01) * 0.3; // Gentle drift
      p.y += p.vy;

      if (p.y > this.height + 10) continue; // Off-screen, remove
      alive.push(p);

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.particles = alive;
  }

  private updateRain(ctx: CanvasRenderingContext2D): void {
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y > this.height + 10) continue;
      alive.push(p);

      ctx.globalAlpha = p.alpha;
      ctx.strokeStyle = '#8899aa';
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.particles = alive;
  }

  public dispose(): void {
    this.particles = [];
    this.weatherType = 'none';
  }
}
