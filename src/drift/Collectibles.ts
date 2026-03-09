import * as THREE from 'three';

export type CollectibleType = 'message' | 'schema' | 'poison-pill' | 'tombstone' | 'power-up';

/** Visual sub-variant for messages */
type MessageVariant = 'normal' | 'large' | 'tiny' | 'compressed';

interface Collectible {
  mesh: THREE.Mesh;
  type: CollectibleType;
  value: number;
  active: boolean;
  retentionTimer: number;
  retentionMax: number;
  variant: MessageVariant;
  spinSpeed: number;
}

const SPAWN_Z = -60;

const MSG_VARIANTS: Record<MessageVariant, { scale: number; color: number; emissive: number; geo: () => THREE.BufferGeometry }> = {
  normal:     { scale: 0.55, color: 0xff69b4, emissive: 0xff1493, geo: () => new THREE.BoxGeometry(1, 1, 1) },
  large:      { scale: 0.9,  color: 0xff85c8, emissive: 0xff3399, geo: () => new THREE.BoxGeometry(1, 1, 1) },
  tiny:       { scale: 0.3,  color: 0xff99cc, emissive: 0xff66aa, geo: () => new THREE.BoxGeometry(1, 1, 1) },
  compressed: { scale: 0.5,  color: 0xcc55ff, emissive: 0x9933cc, geo: () => new THREE.DodecahedronGeometry(0.6) },
};

const TYPE_VISUALS: Record<CollectibleType, { color: number; emissive: number; geo: () => THREE.BufferGeometry; scale: number }> = {
  'message':     { ...MSG_VARIANTS.normal, scale: 0.55 },
  'schema':      { color: 0xffd700, emissive: 0xffaa00, geo: () => new THREE.OctahedronGeometry(0.55), scale: 0.7 },
  'poison-pill': { color: 0xff2200, emissive: 0xcc0000, geo: () => {
    // Spiky danger shape
    const g = new THREE.IcosahedronGeometry(0.5, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const len = Math.sqrt(pos.getX(i) ** 2 + pos.getY(i) ** 2 + pos.getZ(i) ** 2);
      const spike = i % 3 === 0 ? 1.4 : 0.85;
      pos.setXYZ(i, pos.getX(i) / len * 0.5 * spike, pos.getY(i) / len * 0.5 * spike, pos.getZ(i) / len * 0.5 * spike);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, scale: 0.85 },
  'tombstone':   { color: 0x222222, emissive: 0x110011, geo: () => new THREE.BoxGeometry(0.4, 0.9, 0.15), scale: 1.0 },
  'power-up':    { color: 0x00ffff, emissive: 0x00aacc, geo: () => new THREE.IcosahedronGeometry(0.45), scale: 0.8 },
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

  constructor(poolSize = 150) {
    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xff69b4, emissive: 0xff1493, emissiveIntensity: 0.4, transparent: true })
      );
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, type: 'message', value: 1, active: false, retentionTimer: -1, retentionMax: -1, variant: 'normal', spinSpeed: 2 });
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

  private pickMessageVariant(): MessageVariant {
    const r = Math.random();
    if (r < 0.08) return 'large';
    if (r < 0.25) return 'tiny';
    if (r < 0.32) return 'compressed';
    return 'normal';
  }

  private spawn(type: CollectibleType, lane: number, z: number, value: number, retention = -1) {
    const item = this.pool.find(c => !c.active);
    if (!item) return;

    item.type = type;
    item.active = true;
    item.retentionTimer = retention;
    item.retentionMax = retention;

    let vis: { color: number; emissive: number; geo: () => THREE.BufferGeometry; scale: number };

    if (type === 'message') {
      item.variant = this.pickMessageVariant();
      const v = MSG_VARIANTS[item.variant];
      vis = { ...v };
      // Large messages worth 3x, compressed 2x, tiny 0.5x
      const valueMults: Record<MessageVariant, number> = { normal: 1, large: 3, tiny: 0.5, compressed: 2 };
      item.value = Math.ceil(value * valueMults[item.variant]);
    } else {
      item.variant = 'normal';
      item.value = value;
      vis = TYPE_VISUALS[type];
    }

    item.mesh.geometry.dispose();
    item.mesh.geometry = vis.geo();
    const mat = item.mesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(vis.color);
    mat.emissive.setHex(vis.emissive);
    mat.emissiveIntensity = type === 'schema' ? 0.8 : type === 'poison-pill' ? 0.6 : 0.4;
    mat.opacity = 1;

    item.mesh.position.set(
      lane * this.laneWidth,
      type === 'tombstone' ? 0.4 : 1.0 + Math.random() * 2,
      z
    );
    item.mesh.visible = true;
    item.mesh.scale.setScalar(vis.scale);
    item.spinSpeed = type === 'poison-pill' ? 5 : type === 'power-up' ? 4 : 1.5 + Math.random() * 1.5;
  }

  /** Pre-populate collectibles so the corridor isn't empty at run start */
  prePopulate() {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const lane = Math.floor(Math.random() * (this.maxLanes * 2 + 1)) - this.maxLanes;
      const z = -5 - i * 3 - Math.random() * 2;
      this.spawn('message', lane, z, this.baseMessageValue);
    }
  }

  private spawnOne() {
    const lane = Math.floor(Math.random() * (this.maxLanes * 2 + 1)) - this.maxLanes;
    const roll = Math.random();
    const canPoison = this.enabledObstacles.has('poison-pill');
    const canTombstone = this.enabledObstacles.has('tombstone');
    const poisonBound = canPoison ? this.poisonRate * this.poisonRateMultiplier : 0;

    if (canPoison && roll < poisonBound) {
      this.spawn('poison-pill', lane, SPAWN_Z, 0);
    } else if (roll < poisonBound + 0.02 * this.schemaDropRate) {
      this.spawn('schema', lane, SPAWN_Z, 1, 8 * this.retentionMultiplier);
    } else if (roll < poisonBound + 0.04) {
      this.spawn('power-up', lane, SPAWN_Z, 1);
    } else if (canTombstone && roll < poisonBound + 0.07) {
      this.spawn('tombstone', lane, SPAWN_Z, 0);
    } else if (roll < poisonBound + 0.12) {
      // Tiny burst: 3-5 small messages in a tight cluster
      const burstCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < burstCount; i++) {
        const bLane = lane + (Math.random() - 0.5) * 0.6;
        this.spawn('message', 0, SPAWN_Z - i * 1.2, this.baseMessageValue);
        // Override lane manually for tighter clustering
        const lastItem = this.pool.find(c => c.active && c.mesh.position.z <= SPAWN_Z - i * 1.2 + 0.1 && c.variant === 'normal');
        if (lastItem) {
          lastItem.variant = 'tiny';
          lastItem.value = Math.ceil(this.baseMessageValue * 0.5);
          lastItem.mesh.scale.setScalar(MSG_VARIANTS.tiny.scale);
          const mat = lastItem.mesh.material as THREE.MeshStandardMaterial;
          mat.color.setHex(MSG_VARIANTS.tiny.color);
          mat.emissive.setHex(MSG_VARIANTS.tiny.emissive);
          lastItem.mesh.position.x = bLane * this.laneWidth;
        }
      }
    } else {
      this.spawn('message', lane, SPAWN_Z, this.baseMessageValue);
    }
  }

  update(delta: number, _elapsed: number) {
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnOne();
    }

    for (const item of this.pool) {
      if (!item.active) continue;

      item.mesh.position.z += this.speed * delta;
      item.mesh.rotation.y += delta * item.spinSpeed;

      // Poison pills wobble menacingly
      if (item.type === 'poison-pill') {
        item.mesh.rotation.x += delta * 3;
        const wobble = Math.sin(_elapsed * 8 + item.mesh.position.x) * 0.15;
        item.mesh.position.y = 1.2 + wobble;
      }

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
