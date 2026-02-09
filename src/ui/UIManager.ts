import { GameState } from '../game/GameState';
import { BUILDING_TYPES } from '../config';

export class UIManager {
  constructor(private gameState: GameState) {
    this.initializeToolbar();
    this.drawAdvisorFace();
  }

  private initializeToolbar(): void {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    Object.keys(BUILDING_TYPES).forEach((key) => {
      const b = BUILDING_TYPES[key];
      const btn = document.createElement('button');
      btn.className = 'btn-retro w-24 flex flex-col items-center justify-center p-2';
      btn.innerHTML = `
        <span class="text-2xl mb-1">${b.icon}</span>
        <span class="text-sm font-bold leading-none">${b.name}</span>
        <span class="text-xs text-[var(--soviet-gold)]">${b.cost > 0 ? b.cost + '₽' : ''}</span>
      `;
      btn.onclick = () => this.selectTool(key, btn);
      toolbar.appendChild(btn);
    });
  }

  private selectTool(tool: string, el: HTMLButtonElement): void {
    this.gameState.selectedTool = tool;
    document.querySelectorAll('.btn-retro').forEach((b) => b.classList.remove('active'));
    el.classList.add('active');

    const info = BUILDING_TYPES[tool];
    if (info) {
      this.showToast(info.name.toUpperCase() + ': ' + (info.desc || ''));
    }
  }

  public updateUI(): void {
    const moneyEl = document.getElementById('ui-money');
    const popEl = document.getElementById('ui-pop');
    const dateEl = document.getElementById('ui-date');

    if (moneyEl) moneyEl.innerText = this.gameState.money.toString();
    if (popEl) popEl.innerText = this.gameState.pop.toString();
    if (dateEl) dateEl.innerText = this.gameState.date.year.toString();

    // Quota Bar
    const qPct = Math.min(
      100,
      this.gameState.quota.target > 0
        ? (this.gameState.quota.current / this.gameState.quota.target) * 100
        : 0
    );
    const quotaBar = document.getElementById('quota-bar');
    if (quotaBar) quotaBar.style.width = qPct + '%';

    const quotaTarget = document.getElementById('quota-target');
    if (quotaTarget) {
      quotaTarget.innerText = `${this.gameState.quota.target} ${this.gameState.quota.type.toUpperCase()}`;
    }

    const quotaTime = document.getElementById('quota-time');
    if (quotaTime) {
      quotaTime.innerText = `${this.gameState.quota.deadlineYear - this.gameState.date.year} YEARS`;
    }
  }

  public showToast(msg: string): void {
    const el = document.getElementById('toast');
    if (!el) return;
    el.innerText = msg;
    el.style.display = 'block';
    setTimeout(() => (el.style.display = 'none'), 2000);
  }

  public showAdvisor(msg: string): void {
    const el = document.getElementById('advisor');
    const textEl = document.getElementById('advisor-text');
    if (el && textEl) {
      textEl.innerText = msg;
      el.style.display = 'block';
    }
  }

  public hideAdvisor(): void {
    const el = document.getElementById('advisor');
    if (el) el.style.display = 'none';
  }

  private drawAdvisorFace(): void {
    const fc = document.createElement('canvas');
    fc.width = 60;
    fc.height = 60;
    const fctx = fc.getContext('2d');
    if (!fctx) return;

    fctx.fillStyle = '#ccaa88'; // Skin
    fctx.fillRect(10, 10, 40, 50);
    fctx.fillStyle = '#000'; // Hat
    fctx.fillRect(5, 5, 50, 15);
    fctx.fillStyle = '#a00'; // Star
    fctx.fillRect(25, 8, 10, 10);
    fctx.fillStyle = '#000'; // Eyes
    fctx.fillRect(15, 30, 10, 5);
    fctx.fillRect(35, 30, 10, 5);
    fctx.fillRect(20, 50, 20, 2); // Mouth

    const advisorFace = document.getElementById('advisor-face-canvas');
    if (advisorFace) {
      advisorFace.style.backgroundImage = `url(${fc.toDataURL()})`;
      advisorFace.style.backgroundSize = 'contain';
    }
  }
}
