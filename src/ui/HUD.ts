import './hud.css';

export class HUD {
  private container: HTMLDivElement;
  private msgEl: HTMLSpanElement;
  private schemaEl: HTMLSpanElement;
  private speedEl: HTMLSpanElement;
  private comboEl: HTMLDivElement;
  private centerEl: HTMLDivElement;
  private lagFill: HTMLDivElement;
  private distFill: HTMLDivElement;
  private speedLines: HTMLDivElement;
  private powerUpEl: HTMLSpanElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'hud';
    this.container.innerHTML = `
      <div class="hud-top">
        <span class="hud-messages">MESSAGES: <span id="hud-msg">0</span></span>
        <span class="hud-combo combo-text" id="hud-combo"></span>
        <span class="hud-speed">SPEED: <span id="hud-speed">x1.0</span></span>
      </div>
      <div class="distance-bar"><div class="distance-bar-fill" id="hud-dist" style="width:0%"></div></div>
      <div class="hud-center" id="hud-center"></div>
      <div class="lag-bar"><div class="lag-bar-fill" id="hud-lag" style="width:0%"></div></div>
      <div class="hud-bottom">
        <span>SCHEMAS: <span id="hud-schemas">0</span></span>
        <span id="hud-powerup"></span>
      </div>
      <div class="speed-lines" id="hud-speedlines"></div>
    `;

    document.body.appendChild(this.container);

    this.msgEl = this.container.querySelector('#hud-msg')!;
    this.schemaEl = this.container.querySelector('#hud-schemas')!;
    this.speedEl = this.container.querySelector('#hud-speed')!;
    this.comboEl = this.container.querySelector('#hud-combo')!;
    this.centerEl = this.container.querySelector('#hud-center')!;
    this.lagFill = this.container.querySelector('#hud-lag')!;
    this.distFill = this.container.querySelector('#hud-dist')!;
    this.speedLines = this.container.querySelector('#hud-speedlines')!;
    this.powerUpEl = this.container.querySelector('#hud-powerup')!;
  }

  updateMessages(n: number) { this.msgEl.textContent = n.toLocaleString(); }
  updateSchemas(n: number) { this.schemaEl.textContent = n.toLocaleString(); }
  updateSpeed(mult: number) { this.speedEl.textContent = `x${mult.toFixed(1)}`; }
  updateLag(pct: number) { this.lagFill.style.width = `${Math.min(100, pct * 100)}%`; }
  updateDistance(pct: number) { this.distFill.style.width = `${Math.min(100, pct * 100)}%`; }
  updatePowerUp(name: string | null) { this.powerUpEl.textContent = name ? `[E] ${name}` : ''; }

  showCombo(n: number) {
    this.comboEl.textContent = `x${n} COMBO`;
    this.comboEl.classList.add('pop');
    setTimeout(() => this.comboEl.classList.remove('pop'), 300);
  }

  hideCombo() {
    this.comboEl.classList.remove('pop');
    this.comboEl.textContent = '';
  }

  showCenter(text: string, duration = 2000) {
    this.centerEl.textContent = text;
    this.centerEl.classList.add('visible');
    setTimeout(() => this.centerEl.classList.remove('visible'), duration);
  }

  setSpeedLines(intensity: number) {
    this.speedLines.style.opacity = String(Math.min(1, intensity));
  }

  show() { this.container.style.display = ''; }
  hide() { this.container.style.display = 'none'; }

  destroy() {
    this.container.remove();
  }
}
