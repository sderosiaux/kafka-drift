import * as THREE from 'three';

export class ProximityTrigger {
  private position: THREE.Vector3;
  private radius: number;
  private active = false;
  private label: HTMLDivElement | null = null;
  private actionLabel: string;
  onEnter: (() => void) | null = null;
  onAction: (() => void) | null = null;

  constructor(position: THREE.Vector3, radius: number, actionLabel = 'Press F to interact') {
    this.position = position;
    this.radius = radius;
    this.actionLabel = actionLabel;
  }

  update(playerPos: THREE.Vector3, actionPressed: boolean) {
    const dist = playerPos.distanceTo(this.position);
    const inRange = dist < this.radius;

    if (inRange && !this.active) {
      this.active = true;
      this.showLabel();
      this.onEnter?.();
    } else if (!inRange && this.active) {
      this.active = false;
      this.hideLabel();
    }

    if (this.active && actionPressed) {
      this.onAction?.();
    }
  }

  private showLabel() {
    if (this.label) return;
    this.label = document.createElement('div');
    this.label.className = 'proximity-label';
    this.label.textContent = this.actionLabel;
    this.label.style.cssText = `
      position: fixed; bottom: 120px; left: 50%; transform: translateX(-50%);
      font-family: 'Courier New', monospace; font-size: 16px; color: #00ffff;
      text-shadow: 0 0 10px #00ffff; padding: 8px 20px;
      border: 1px solid rgba(0, 255, 255, 0.3); background: rgba(0, 0, 0, 0.6);
      z-index: 20; pointer-events: none;
    `;
    document.body.appendChild(this.label);
  }

  private hideLabel() {
    this.label?.remove();
    this.label = null;
  }

  destroy() {
    this.hideLabel();
  }
}
