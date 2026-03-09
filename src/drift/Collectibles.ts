import * as THREE from 'three';

export type CollectibleType = 'message' | 'schema' | 'poison-pill' | 'tombstone' | 'power-up';

interface Collectible {
  mesh: THREE.Mesh;
  type: CollectibleType;
  value: number;
  active: boolean;
  retentionTimer: number;
  retentionMax: number;
}

const COLORS: Record<CollectibleType, { color: number; emissive: number }> = {
  'message': { color: 0xff69b4, emissive: 0xff1493 },
  'schema': { color: 0xffd700, emissive: 0xffaa00 },
  'poison-pill': { color: 0xff0000, emissive: 0xaa0000 },
  'tombstone': { color: 0x111111, emissive: 0x000000 },
  'power-up': { color: 0x00ffff, emissive: 0x00aaaa },
};

const GEOMETRIES: Record<CollectibleType, () => THREE.BufferGeometry> = {
  'message': () => new THREE.BoxGeometry(0.6, 0.6, 0.6),
  'schema': () => new THREE.OctahedronGeometry(0.5),
  'poison-pill': () => new THREE.BoxGeometry(0.7, 0.7, 0.7),
  'tombstone': () => new THREE.BoxGeometry(0.4, 0.8, 0.2),
  'power-up': () => new THREE.IcosahedronGeometry(0.5),
};

export class CollectibleManager {
  group = new THREE.Group();
  private pool: Collectible[] = [];
  private speed = 10;
  private spawnTimer = 0;
  private spawnInterval = 0.3;
  private laneWidth = 3;
  private maxLanes = 1;
  private schemaDropRate = 1.0;
  private poisonRate = 0.1;
  private poisonRateMultiplier = 1.0;
  private baseMessageValue = 1;
  private retentionMultiplier = 1.0;
  private enabledObstacles = new Set<string>();

  constructor(poolSize = 100) {
    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xff69b4, emissive: 0xff1493, emissiveIntensity: 0.4, transparent: true })
      );
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, type: 'message', value: 1, active: false, retentionTimer: -1, retentionMax: -1 });
    }
  }

  configure(opts: { speed: number; density: number; lanes: number; schemaRate: number; poisonRate: number; baseMessageValue?: number; retentionMultiplier?: number }) {
    this.speed = opts.speed;
    this.spawnInterval = 1 / (opts.density * 0.1);
    this.maxLanes = opts.lanes;
    this.schemaDropRate = opts.schemaRate;
    this.poisonRate = opts.poisonRate;
    this.baseMessageValue = opts.baseMessageValue ?? 1;
    this.retentionMultiplier = opts.retentionMultiplier ?? 1.0;
  }

  setPoisonRateMultiplier(m: number) { this.poisonRateMultiplier = m; }
  setEnabledObstacles(types: string[]) { this.enabledObstacles = new Set(types); }

  private spawn(type: CollectibleType, lane: number, z: number, value: number, retention = -1) {
    const item = this.pool.find(c => !c.active);
    if (!item) return;

    item.type = type;
    item.value = value;
    item.active = true;
    item.retentionTimer = retention;
    item.retentionMax = retention;

    item.mesh.geometry.dispose();
    item.mesh.geometry = GEOMETRIES[type]();
    const mat = item.mesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(COLORS[type].color);
    mat.emissive.setHex(COLORS[type].emissive);
    mat.emissiveIntensity = type === 'schema' ? 0.8 : 0.4;
    mat.opacity = 1;

    item.mesh.position.set(
      lane * this.laneWidth,
      type === 'tombstone' ? 0.4 : 1.0 + Math.random() * 2,
      z
    );
    item.mesh.visible = true;
    item.mesh.scale.setScalar(1);
  }

  update(delta: number, _elapsed: number) {
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      const lane = Math.floor(Math.random() * (this.maxLanes * 2 + 1)) - this.maxLanes;
      const roll = Math.random();
      const canPoison = this.enabledObstacles.has('poison-pill');
      const canTombstone = this.enabledObstacles.has('tombstone');
      const poisonBound = canPoison ? this.poisonRate * this.poisonRateMultiplier : 0;
      if (canPoison && roll < poisonBound) {
        this.spawn('poison-pill', lane, -200, 0);
      } else if (roll < poisonBound + 0.02 * this.schemaDropRate) {
        this.spawn('schema', lane, -200, 1, 8 * this.retentionMultiplier);
      } else if (roll < poisonBound + 0.04) {
        this.spawn('power-up', lane, -200, 1);
      } else if (canTombstone && roll < poisonBound + 0.07) {
        this.spawn('tombstone', lane, -200, 0);
      } else {
        this.spawn('message', lane, -200, this.baseMessageValue);
      }
    }

    for (const item of this.pool) {
      if (!item.active) continue;

      item.mesh.position.z += this.speed * delta;
      item.mesh.rotation.y += delta * 2;

      if (item.retentionTimer > 0) {
        item.retentionTimer -= delta;
        const ratio = item.retentionTimer / item.retentionMax;
        item.mesh.scale.setScalar(0.5 + ratio * 0.5);
        (item.mesh.material as THREE.MeshStandardMaterial).opacity = 0.3 + ratio * 0.7;
        if (item.retentionTimer <= 0) {
          item.active = false;
          item.mesh.visible = false;
        }
      }

      if (item.mesh.position.z > 10) {
        item.active = false;
        item.mesh.visible = false;
      }
    }
  }

  checkCollisions(playerPos: THREE.Vector3, radius: number): { type: CollectibleType; value: number; position: THREE.Vector3 }[] {
    const collected: { type: CollectibleType; value: number; position: THREE.Vector3 }[] = [];
    for (const item of this.pool) {
      if (!item.active) continue;
      const dist = playerPos.distanceTo(item.mesh.position);
      if (dist < radius) {
        collected.push({ type: item.type, value: item.value, position: item.mesh.position.clone() });
        item.active = false;
        item.mesh.visible = false;
      }
    }
    return collected;
  }

  reset() {
    for (const item of this.pool) {
      item.active = false;
      item.mesh.visible = false;
    }
    this.spawnTimer = 0;
  }
}
