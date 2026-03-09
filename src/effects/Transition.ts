export class Transition {
  private overlay: HTMLDivElement;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1000;
      background: #0a0010; pointer-events: none;
      opacity: 0; transition: opacity 0.5s ease-in-out;
    `;
    // Scanline effect
    this.overlay.innerHTML = `
      <div style="width:100%; height:100%; background: repeating-linear-gradient(
        0deg, transparent, transparent 2px, rgba(255,105,180,0.03) 2px, rgba(255,105,180,0.03) 4px
      );"></div>
    `;
    document.body.appendChild(this.overlay);
  }

  async fadeOut(): Promise<void> {
    this.overlay.style.pointerEvents = 'all';
    this.overlay.style.opacity = '1';
    return new Promise(r => setTimeout(r, 500));
  }

  async fadeIn(): Promise<void> {
    this.overlay.style.opacity = '0';
    return new Promise(r => {
      setTimeout(() => {
        this.overlay.style.pointerEvents = 'none';
        r();
      }, 500);
    });
  }

  async transition(fn: () => void | Promise<void>): Promise<void> {
    await this.fadeOut();
    await fn();
    await this.fadeIn();
  }
}
