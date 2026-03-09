import './menu.css';

export class MainMenu {
  private container: HTMLDivElement;
  private onStart: (() => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'main-menu';
    this.container.innerHTML = `
      <div class="menu-bg"></div>
      <div class="menu-content">
        <h1 class="menu-title">KAFKA DRIFT</h1>
        <p class="menu-subtitle">SURF THE STREAMS. OUTRUN THE LAG.</p>
        <div class="menu-idle" id="menu-idle"></div>
        <button class="menu-start" id="menu-start">CLICK TO START</button>
        <div class="menu-controls">
          <span>WASD — Move</span>
          <span>MOUSE — Look</span>
          <span>A/D — Switch Lanes</span>
          <span>SPACE — Jump</span>
          <span>SHIFT — Boost</span>
          <span>F — Interact</span>
          <span>ESC — Close Menu</span>
        </div>
      </div>
    `;
    document.body.appendChild(this.container);
  }

  show(idleEarned: number, onStart: () => void) {
    this.onStart = onStart;
    this.container.style.display = 'flex';

    const idleEl = this.container.querySelector('#menu-idle')!;
    if (idleEarned > 0) {
      idleEl.innerHTML = `
        <div class="idle-reward">
          While you were away, your consumers earned<br>
          <strong>${idleEarned.toLocaleString()}</strong> messages!
        </div>
      `;
    } else {
      idleEl.innerHTML = '';
    }

    const btn = this.container.querySelector('#menu-start')!;
    const handler = () => {
      btn.removeEventListener('click', handler);
      this.hide();
      this.onStart?.();
    };
    btn.addEventListener('click', handler);
  }

  hide() {
    this.container.style.display = 'none';
  }

  destroy() {
    this.container.remove();
  }
}
