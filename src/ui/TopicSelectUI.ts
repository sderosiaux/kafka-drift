import { TOPICS, CLUSTERS } from '../state/TopicData';
import { gameState } from '../state/GameState';

const CLUSTER_COLORS = ['#00ff88', '#00ffff', '#ff69b4', '#ffd700', '#8b00ff', '#ff0066'];

export class TopicSelectUI {
  private overlay: HTMLDivElement;
  private onSelect: ((topicId: string) => void) | null = null;
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

  show(onSelect: (topicId: string) => void, onClose: () => void) {
    this.onSelect = onSelect;
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
    let html = `
      <div style="display:flex; justify-content:space-between; margin-bottom:30px;">
        <h1 style="font-size:28px; text-shadow: 0 0 20px #ff1493;">TOPIC MAP</h1>
        <div>
          <span style="color:#ff69b4">MESSAGES: ${gameState.data.messages.toLocaleString()}</span>
          <span style="margin-left:20px; color:#ffd700">SCHEMAS: ${gameState.data.schemas.toLocaleString()}</span>
          <span style="margin-left:20px; color:#00ff88">CLEARED: ${gameState.data.clearedTopics.length}/24</span>
        </div>
      </div>
    `;

    for (const cluster of CLUSTERS) {
      const unlocked = gameState.isClusterUnlocked(cluster.id);
      const color = CLUSTER_COLORS[cluster.id - 1];
      const topics = TOPICS.filter(t => t.cluster === cluster.id);

      html += `
        <div style="margin-bottom:25px; opacity: ${unlocked ? 1 : 0.3};">
          <h2 style="color: ${color}; font-size: 20px; margin-bottom: 10px;
            border-bottom: 1px solid ${color}33; padding-bottom: 8px;">
            CLUSTER ${cluster.id}: ${cluster.name}
            ${!unlocked ? `<span style="font-size:12px; color:#666"> (need ${cluster.requiredCleared} cleared)</span>` : ''}
          </h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
      `;

      for (const topic of topics) {
        const cleared = gameState.isTopicCleared(topic.id);
        const best = gameState.data.bestScores[topic.id];
        const canPlay = unlocked;

        html += `
          <div class="topic-card" data-topic="${topic.id}" data-playable="${canPlay}"
            style="border: 1px solid ${cleared ? color : '#333'}; padding: 12px; border-radius: 6px;
              cursor: ${canPlay ? 'pointer' : 'default'};
              background: ${cleared ? color + '11' : 'rgba(0,0,0,0.3)'};
              transition: border-color 0.2s, background 0.2s;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color: ${cleared ? color : '#aaa'}">${topic.name}</strong>
              ${cleared ? `<span style="color:#00ff88; font-size:12px;">CLEARED</span>` : ''}
            </div>
            <div style="font-size:11px; color:#666; margin-top:4px;">${topic.description}</div>
            <div style="display:flex; gap:15px; margin-top:6px; font-size:11px; color:#888;">
              <span>SPD:${topic.speed}</span>
              <span>PART:${topic.partitions}</span>
              <span>LEN:${topic.length}m</span>
              ${best ? `<span style="color:${color}">BEST:${best.toLocaleString()}</span>` : ''}
            </div>
          </div>
        `;
      }

      html += `</div></div>`;
    }

    html += `<div style="text-align:center; margin-top:20px; color:#555; font-size:14px;">Press ESC to close</div>`;
    this.overlay.innerHTML = html;

    this.overlay.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.topic-card') as HTMLElement;
      if (!card || card.dataset.playable !== 'true') return;
      const topicId = card.dataset.topic;
      if (topicId) {
        this.hide();
        this.onSelect?.(topicId);
      }
    });
  }

  destroy() { this.overlay.remove(); }
}
