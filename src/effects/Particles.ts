import * as THREE from 'three';

export class DataParticles {
  points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private count: number;
  private corridorHeight: number;

  constructor(count = 500, corridorWidth = 12, corridorHeight = 8) {
    this.count = count;
    this.corridorHeight = corridorHeight;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      this.positions[i * 3] = side * (corridorWidth / 2 - 0.5 + Math.random() * 0.5);
      this.positions[i * 3 + 1] = Math.random() * corridorHeight;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xff69b4,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geo, mat);
  }

  update(delta: number, speed: number) {
    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3 + 2] += speed * delta;
      if (this.positions[i * 3 + 2] > 20) {
        this.positions[i * 3 + 2] = -200;
      }
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * delta;
      if (this.positions[i * 3 + 1] > this.corridorHeight) {
        this.positions[i * 3 + 1] = 0;
      } else if (this.positions[i * 3 + 1] < 0) {
        this.positions[i * 3 + 1] = this.corridorHeight;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export class CollectBurst {
  private pool: { points: THREE.Points; life: number; active: boolean; velocities: Float32Array }[] = [];

  constructor(scene: THREE.Scene, poolSize = 20) {
    for (let i = 0; i < poolSize; i++) {
      const count = 15;
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xff69b4,
        size: 0.2,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      points.visible = false;
      scene.add(points);
      this.pool.push({ points, life: 0, active: false, velocities });
    }
  }

  emit(position: THREE.Vector3, color = 0xff69b4) {
    const p = this.pool.find(p => !p.active);
    if (!p) return;
    p.active = true;
    p.life = 0.5;
    p.points.visible = true;
    p.points.position.copy(position);
    (p.points.material as THREE.PointsMaterial).color.setHex(color);
    (p.points.material as THREE.PointsMaterial).opacity = 1;

    const pos = p.points.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      p.velocities[i * 3] = (Math.random() - 0.5) * 4;
      p.velocities[i * 3 + 1] = (Math.random() - 0.5) * 4;
      p.velocities[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    p.points.geometry.attributes.position.needsUpdate = true;
  }

  update(delta: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= delta;
      const scale = Math.max(0, p.life / 0.5);
      (p.points.material as THREE.PointsMaterial).opacity = scale;

      const pos = p.points.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3] += p.velocities[i * 3] * delta;
        pos[i * 3 + 1] += p.velocities[i * 3 + 1] * delta;
        pos[i * 3 + 2] += p.velocities[i * 3 + 2] * delta;
      }
      p.points.geometry.attributes.position.needsUpdate = true;

      if (p.life <= 0) {
        p.active = false;
        p.points.visible = false;
      }
    }
  }
}
