import * as THREE from 'three';
import { gameState } from '../../state/GameState';
import { TOPICS } from '../../state/TopicData';
import { ProximityTrigger } from '../ProximityTrigger';

export class StatsWallStation {
  group = new THREE.Group();
  trigger: ProximityTrigger;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;

  constructor() {
    this.group.position.set(13, 3, 0);

    // Canvas for stats display
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 256;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);

    // Screen mesh
    const screenGeo = new THREE.PlaneGeometry(6, 3);
    const screenMat = new THREE.MeshBasicMaterial({ map: this.texture });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.rotation.y = -Math.PI / 2;
    this.group.add(screen);

    // Frame
    const frameGeo = new THREE.BoxGeometry(0.1, 3.2, 6.2);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, emissive: 0x220044, emissiveIntensity: 0.3 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.rotation.y = -Math.PI / 2;
    frame.position.x = -0.06;
    this.group.add(frame);

    this.trigger = new ProximityTrigger(
      new THREE.Vector3(13, 0, 0),
      5,
      'Press F — Stats Wall'
    );
  }

  update(elapsed: number) {
    // Update every ~30 frames
    if (Math.floor(elapsed * 10) % 3 !== 0) return;

    const ctx = this.ctx;
    ctx.fillStyle = '#0a0010';
    ctx.fillRect(0, 0, 512, 256);

    ctx.font = '16px Courier New';
    ctx.fillStyle = '#ff69b4';
    ctx.fillText('BROKER STATS', 20, 30);

    ctx.font = '12px Courier New';
    const stats = [
      { label: 'MESSAGES', value: gameState.data.messages.toLocaleString(), color: '#ff69b4' },
      { label: 'SCHEMAS', value: gameState.data.schemas.toLocaleString(), color: '#ffd700' },
      { label: 'THROUGHPUT', value: gameState.data.throughput.toLocaleString(), color: '#00ffff' },
      { label: 'CLEARED', value: `${gameState.data.clearedTopics.length}/24`, color: '#00ff88' },
      { label: 'TECH UNLOCKED', value: `${gameState.data.unlockedTech.length}/30`, color: '#8b00ff' },
      { label: 'CONSUMERS', value: `${gameState.data.consumers.length}`, color: '#ff69b4' },
      { label: 'PIPELINES', value: `${gameState.data.pipelines.length}`, color: '#00ffff' },
      { label: 'IDLE RATE', value: `${gameState.getIdleRate().toFixed(1)} msg/s`, color: '#00ff88' },
    ];

    stats.forEach((s, i) => {
      const y = 55 + i * 22;
      ctx.fillStyle = '#555';
      ctx.fillText(s.label, 20, y);
      ctx.fillStyle = s.color;
      ctx.fillText(s.value, 200, y);
    });

    // Mini bar chart for cluster progress
    ctx.fillStyle = '#ff69b4';
    ctx.fillText('CLUSTER PROGRESS', 300, 30);
    for (let c = 1; c <= 6; c++) {
      const topics = TOPICS.filter(t => t.cluster === c);
      const cleared = topics.filter(t => gameState.isTopicCleared(t.id)).length;
      const pct = cleared / topics.length;
      const barX = 300;
      const barY = 40 + (c - 1) * 30;
      const barW = 180;
      const barH = 16;

      ctx.fillStyle = '#1a0033';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = ['#00ff88', '#00ffff', '#ff69b4', '#ffd700', '#8b00ff', '#ff0066'][c - 1];
      ctx.fillRect(barX, barY, barW * pct, barH);
      ctx.fillStyle = '#aaa';
      ctx.font = '10px Courier New';
      ctx.fillText(`C${c}: ${cleared}/${topics.length}`, barX + 5, barY + 12);
    }

    this.texture.needsUpdate = true;
  }
}
