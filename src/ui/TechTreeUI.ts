import { TECH_NODES, type TechNode } from '../state/TechTree';
import { gameState } from '../state/GameState';

export class TechTreeUI {
  private overlay: HTMLDivElement;
  private onClose: (() => void) | null = null;
  private onPurchase: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'tech-tree-overlay';
    this.overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      background: rgba(5, 0, 15, 0.92); display: none;
      font-family: 'Courier New', monospace; color: #ff69b4;
      overflow-y: auto; padding: 40px;
    `;
    document.body.appendChild(this.overlay);
  }

  show(onClose: () => void, onPurchase?: () => void) {
    this.onClose = onClose;
    this.onPurchase = onPurchase ?? null;
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
    const branches: Record<string, TechNode[]> = { speed: [], data: [], infra: [], mastery: [] };
    for (const n of TECH_NODES) branches[n.branch]?.push(n);

    const branchColors: Record<string, string> = {
      speed: '#00ffff', data: '#ffd700', infra: '#ff69b4', mastery: '#8b00ff',
    };
    const branchNames: Record<string, string> = {
      speed: 'SPEED', data: 'DATA', infra: 'INFRA', mastery: 'MASTERY',
    };

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
        <h1 style="font-size:28px; text-shadow: 0 0 20px #ff1493;">TECH TREE</h1>
        <div>
          <span style="color:#ff69b4">MESSAGES: ${gameState.data.messages.toLocaleString()}</span>
          <span style="margin-left:20px; color:#ffd700">SCHEMAS: ${gameState.data.schemas.toLocaleString()}</span>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px;">
    `;

    for (const [branch, nodes] of Object.entries(branches)) {
      const color = branchColors[branch];
      html += `<div style="border: 1px solid ${color}33; padding: 20px; border-radius: 8px;">`;
      html += `<h2 style="color: ${color}; margin-bottom: 15px; font-size: 18px;">${branchNames[branch]}</h2>`;
      for (const node of nodes) {
        const unlocked = gameState.isTechUnlocked(node.id);
        const canUnlock = gameState.canUnlockTech(node.id);
        const prereqsMet = node.requires.every(r => gameState.isTechUnlocked(r));

        let status = 'locked';
        let border = '#333';
        let opacity = '0.4';
        if (unlocked) { status = 'unlocked'; border = color; opacity = '1'; }
        else if (canUnlock) { status = 'available'; border = color + '88'; opacity = '0.9'; }
        else if (prereqsMet) { status = 'affordable'; border = '#666'; opacity = '0.7'; }

        html += `
          <div class="tech-node" data-id="${node.id}" data-status="${status}"
            style="border: 1px solid ${border}; padding: 12px; margin-bottom: 8px; border-radius: 4px;
              opacity: ${opacity}; cursor: ${canUnlock ? 'pointer' : 'default'};
              background: ${unlocked ? color + '11' : 'transparent'};
              transition: all 0.2s;">
            <div style="display:flex; justify-content:space-between;">
              <strong style="color: ${unlocked ? color : '#aaa'}">${node.name}</strong>
              <span style="font-size:12px; color: ${unlocked ? '#00ff88' : '#888'}">
                ${unlocked ? 'UNLOCKED' : `${node.cost.messages}msg / ${node.cost.schemas}sch`}
              </span>
            </div>
            <div style="font-size: 12px; color: #888; margin-top: 4px;">${node.description}</div>
          </div>
        `;
      }
      html += `</div>`;
    }

    html += `</div>
      <div style="text-align:center; margin-top:30px; color:#555; font-size:14px;">
        Press ESC to close
      </div>`;

    this.overlay.innerHTML = html;

    // Event delegation for purchases
    this.overlay.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.tech-node') as HTMLElement;
      if (!target) return;
      const id = target.dataset.id;
      if (!id) return;
      if (gameState.unlockTech(id)) {
        gameState.save();
        this.onPurchase?.();
        this.render();
      }
    });
  }

  destroy() {
    this.overlay.remove();
  }
}
