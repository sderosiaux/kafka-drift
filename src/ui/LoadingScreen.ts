export class LoadingScreen {
  private container: HTMLDivElement;
  private progressBar: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #0a0010; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: 'Courier New', monospace;
    `;
    this.container.innerHTML = `
      <h1 style="
        font-size: 48px; color: #ff69b4; letter-spacing: 8px;
        text-shadow: 0 0 20px #ff1493, 0 0 40px #ff1493;
        margin-bottom: 30px;
        animation: loadPulse 1.5s ease-in-out infinite;
      ">KAFKA DRIFT</h1>
      <div style="width: 300px; height: 3px; background: #1a0033; border-radius: 2px; overflow: hidden;">
        <div id="loading-progress" style="
          width: 0%; height: 100%;
          background: linear-gradient(90deg, #ff69b4, #00ffff);
          transition: width 0.3s;
          box-shadow: 0 0 10px #ff69b4;
        "></div>
      </div>
      <p style="color: #555; font-size: 12px; margin-top: 15px;">INITIALIZING BROKERS...</p>
      <style>
        @keyframes loadPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      </style>
    `;
    document.body.appendChild(this.container);
    this.progressBar = this.container.querySelector('#loading-progress')!;
  }

  setProgress(pct: number) {
    this.progressBar.style.width = `${Math.min(100, pct)}%`;
  }

  hide() {
    this.container.style.opacity = '0';
    this.container.style.transition = 'opacity 0.5s';
    setTimeout(() => this.container.remove(), 500);
  }
}
