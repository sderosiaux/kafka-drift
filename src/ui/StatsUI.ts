import { gameState } from '../state/GameState';
import { TOPICS, CLUSTERS } from '../state/TopicData';

export class StatsUI {
  private overlay: HTMLDivElement;
  private onClose: (() => void) | null = null;

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

  show(onClose: () => void) {
    this.onClose = onClose;
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
    const d = gameState.data;
    const totalMinutes = Math.floor(d.totalTimePlayed / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timePlayed = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const stats = [
      { label: 'MESSAGES', value: d.messages.toLocaleString(), color: '#ff69b4' },
      { label: 'SCHEMAS', value: d.schemas.toLocaleString(), color: '#ffd700' },
      { label: 'THROUGHPUT', value: d.throughput.toLocaleString(), color: '#00ffff' },
      { label: 'TOPICS CLEARED', value: `${d.clearedTopics.length} / ${TOPICS.length}`, color: '#00ff88' },
      { label: 'TECH UNLOCKED', value: `${d.unlockedTech.length} / 30`, color: '#8b00ff' },
      { label: 'CONSUMERS', value: `${d.consumers.length}`, color: '#ff69b4' },
      { label: 'PIPELINES', value: `${d.pipelines.length}`, color: '#00ffff' },
      { label: 'IDLE RATE', value: `${gameState.getIdleRate().toFixed(1)} msg/s`, color: '#00ff88' },
      { label: 'TIME PLAYED', value: timePlayed, color: '#ffd700' },
    ];

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
        <h1 style="font-size:28px; text-shadow: 0 0 20px #ff69b4;">BROKER STATS</h1>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px;">
    `;

    for (const s of stats) {
      html += `
        <div style="border: 1px solid ${s.color}33; padding: 16px; border-radius: 6px; background: ${s.color}08;">
          <div style="color: #888; font-size: 12px; margin-bottom: 6px;">${s.label}</div>
          <div style="color: ${s.color}; font-size: 22px;">${s.value}</div>
        </div>
      `;
    }

    html += `</div>`;

    // Cluster progress bars
    html += `<h2 style="color: #ff69b4; margin-bottom: 16px; font-size: 18px;">CLUSTER PROGRESS</h2>`;
    const clusterColors = ['#00ff88', '#00ffff', '#ff69b4', '#ffd700', '#8b00ff', '#ff0066'];

    for (let c = 1; c <= 6; c++) {
      const cluster = CLUSTERS.find(cl => cl.id === c);
      const topics = TOPICS.filter(t => t.cluster === c);
      const cleared = topics.filter(t => gameState.isTopicCleared(t.id)).length;
      const pct = topics.length > 0 ? (cleared / topics.length) * 100 : 0;
      const color = clusterColors[c - 1];
      const name = cluster?.name ?? `Cluster ${c}`;

      html += `
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: ${color}; font-size: 13px;">${name}</span>
            <span style="color: #888; font-size: 13px;">${cleared} / ${topics.length}</span>
          </div>
          <div style="background: #1a0033; height: 18px; border-radius: 3px; overflow: hidden;">
            <div style="background: ${color}; height: 100%; width: ${pct}%; transition: width 0.3s;"></div>
          </div>
        </div>
      `;
    }

    html += `<div style="text-align:center; margin-top:30px; color:#555; font-size:14px;">Press ESC to close</div>`;
    this.overlay.innerHTML = html;
  }

  destroy() { this.overlay.remove(); }
}
