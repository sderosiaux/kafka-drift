import { gameState } from '../state/GameState';
import { TOPICS } from '../state/TopicData';

export class PipelineUI {
  private overlay: HTMLDivElement;
  private onClose: (() => void) | null = null;
  private onUpdate: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      background: rgba(5, 0, 15, 0.92); display: none;
      font-family: 'Courier New', monospace; color: #ff69b4;
      overflow-y: auto; padding: 40px;
    `;
    document.body.appendChild(this.overlay);
  }

  show(onClose: () => void, onUpdate?: () => void) {
    this.onClose = onClose;
    this.onUpdate = onUpdate ?? null;
    this.render();
    this.overlay.style.display = 'block';

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        window.removeEventListener('keydown', handler);
      }
    };
    window.addEventListener('keydown', handler);
  }

  hide() {
    this.overlay.style.display = 'none';
    this.onClose?.();
  }

  private render() {
    const pipelines = gameState.data.pipelines;
    const clearedTopics = TOPICS.filter(t => gameState.isTopicCleared(t.id));
    const multiplier = gameState.getPipelineMultiplier();

    let html = `
      <div style="display:flex; justify-content:space-between; margin-bottom:30px;">
        <h1 style="font-size:28px; text-shadow: 0 0 20px #ff69b4;">PIPELINES</h1>
        <div>
          <span style="color:#ff69b4">MULTIPLIER: x${multiplier.toFixed(1)}</span>
          <span style="margin-left:20px; color:#888">Each pipeline adds +50% to idle income</span>
        </div>
      </div>
    `;

    // Existing pipelines
    if (pipelines.length > 0) {
      html += `<h3 style="color:#00ffff; margin-bottom:10px;">ACTIVE PIPELINES</h3>`;
      for (const p of pipelines) {
        const from = TOPICS.find(t => t.id === p.fromTopic);
        const to = TOPICS.find(t => t.id === p.toTopic);
        html += `
          <div style="border: 1px solid #ff69b433; padding: 10px; margin-bottom: 8px; border-radius: 4px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="color:#00ffff">${from?.name ?? p.fromTopic}</span>
              <span style="color:#ff69b4"> → </span>
              <span style="color:#00ffff">${to?.name ?? p.toTopic}</span>
            </div>
            <button class="pipe-remove" data-pipe="${p.id}" style="
              background: #1a0033; color: #ff0066; border: 1px solid #ff0066;
              padding: 4px 12px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 12px;">
              REMOVE
            </button>
          </div>
        `;
      }
    }

    // Create new pipeline
    if (clearedTopics.length >= 2) {
      const cost = 5000 * (pipelines.length + 1);
      html += `
        <h3 style="color:#ffd700; margin: 20px 0 10px;">CREATE PIPELINE (${cost.toLocaleString()} msg + 10 sch)</h3>
        <div style="display:flex; gap:10px; align-items:center;">
          <select id="pipe-from" style="background:#0a0020; color:#00ffff; border:1px solid #333; padding:6px; font-family:'Courier New',monospace;">
            ${clearedTopics.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
          <span style="color:#ff69b4">→</span>
          <select id="pipe-to" style="background:#0a0020; color:#00ffff; border:1px solid #333; padding:6px; font-family:'Courier New',monospace;">
            ${clearedTopics.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
          <button id="pipe-create" style="background:#1a0033; color:#ffd700; border:1px solid #ffd700; padding:6px 16px; cursor:pointer; font-family:'Courier New',monospace;">
            CREATE
          </button>
        </div>
      `;
    } else {
      html += `<p style="color:#555; margin-top:20px;">Clear at least 2 topics to create pipelines.</p>`;
    }

    html += `<div style="text-align:center; margin-top:30px; color:#555; font-size:14px;">Press ESC to close</div>`;
    this.overlay.innerHTML = html;

    this.overlay.querySelector('#pipe-create')?.addEventListener('click', () => {
      const from = (this.overlay.querySelector('#pipe-from') as HTMLSelectElement)?.value;
      const to = (this.overlay.querySelector('#pipe-to') as HTMLSelectElement)?.value;
      if (from && to && from !== to) {
        if (gameState.addPipeline(from, to)) {
          gameState.save();
          this.onUpdate?.();
          this.render();
        }
      }
    });

    this.overlay.querySelectorAll('.pipe-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.target as HTMLElement;
        const pipeId = el.dataset.pipe!;
        gameState.removePipeline(pipeId);
        gameState.save();
        this.onUpdate?.();
        this.render();
      });
    });
  }

  destroy() { this.overlay.remove(); }
}
