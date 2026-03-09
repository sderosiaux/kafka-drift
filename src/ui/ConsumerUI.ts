import { gameState } from '../state/GameState';
import { TOPICS } from '../state/TopicData';

export class ConsumerUI {
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
    const consumers = gameState.data.consumers;
    const clearedTopics = TOPICS.filter(t => gameState.isTopicCleared(t.id));
    const idleRate = gameState.getIdleRate();

    let html = `
      <div style="display:flex; justify-content:space-between; margin-bottom:30px;">
        <h1 style="font-size:28px; text-shadow: 0 0 20px #00ffff;">CONSUMER MACHINES</h1>
        <div>
          <span style="color:#ff69b4">MESSAGES: ${gameState.data.messages.toLocaleString()}</span>
          <span style="margin-left:20px; color:#00ff88">IDLE: ${idleRate.toFixed(1)} msg/sec</span>
        </div>
      </div>
    `;

    for (const c of consumers) {
      const assignedTopic = c.assignedTopic ? TOPICS.find(t => t.id === c.assignedTopic) : null;
      html += `
        <div style="border: 1px solid ${c.assignedTopic ? '#00ff88' : '#333'}; padding: 15px; margin-bottom: 10px; border-radius: 6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>Consumer LVL ${c.level}</strong>
            <span style="color: #888; font-size: 12px;">${c.id}</span>
          </div>
          <div style="margin-top: 10px; display:flex; gap: 10px; align-items: center;">
            <span style="color:#888;">Assigned:</span>
            <select class="consumer-assign" data-consumer="${c.id}" style="
              background: #0a0020; color: #00ffff; border: 1px solid #333;
              padding: 4px 8px; font-family: 'Courier New', monospace; font-size: 13px;">
              <option value="">-- None --</option>
              ${clearedTopics.map(t =>
                `<option value="${t.id}" ${c.assignedTopic === t.id ? 'selected' : ''}>${t.name}</option>`
              ).join('')}
            </select>
            <button class="consumer-upgrade" data-consumer="${c.id}" style="
              background: #1a0033; color: #ffd700; border: 1px solid #ffd700;
              padding: 4px 12px; cursor: pointer; font-family: 'Courier New', monospace;
              ${c.level >= 5 ? 'opacity: 0.3; cursor: default;' : ''}">
              ${c.level >= 5 ? 'MAX' : `UPGRADE (${500 * Math.pow(2, c.level)}msg)`}
            </button>
          </div>
          ${assignedTopic ? `<div style="color:#00ff88; font-size:12px; margin-top:5px;">
            Producing ${c.level * c.partitions * 2} msg/sec from ${assignedTopic.name}
          </div>` : ''}
        </div>
      `;
    }

    const maxSlots = 3 + (gameState.getEffect('consumerSlots') || 0);
    if (consumers.length < maxSlots) {
      const cost = 1000 * Math.pow(3, consumers.length);
      html += `
        <button class="buy-consumer" style="
          display:block; width:100%; padding: 12px; margin-top: 15px;
          background: #1a0033; color: #00ffff; border: 1px solid #00ffff;
          font-family: 'Courier New', monospace; font-size: 14px; cursor: pointer;">
          BUY NEW CONSUMER (${cost.toLocaleString()} msg)
        </button>
      `;
    }

    html += `<div style="text-align:center; margin-top:20px; color:#555; font-size:14px;">Press ESC to close</div>`;
    this.overlay.innerHTML = html;

    // Events
    this.overlay.querySelectorAll('.consumer-assign').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const el = e.target as HTMLSelectElement;
        const cId = el.dataset.consumer!;
        const topicId = el.value || null;
        gameState.assignConsumer(cId, topicId);
        gameState.save();
        this.onUpdate?.();
        this.render();
      });
    });

    this.overlay.querySelectorAll('.consumer-upgrade').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.target as HTMLElement;
        const cId = el.dataset.consumer!;
        if (gameState.upgradeConsumer(cId)) {
          gameState.save();
          this.onUpdate?.();
          this.render();
        }
      });
    });

    this.overlay.querySelector('.buy-consumer')?.addEventListener('click', () => {
      if (gameState.buyConsumer()) {
        gameState.save();
        this.onUpdate?.();
        this.render();
      }
    });
  }

  destroy() { this.overlay.remove(); }
}
