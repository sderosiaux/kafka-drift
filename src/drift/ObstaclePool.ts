import * as THREE from 'three';

export type ObstacleType =
  | 'isr-ring'
  | 'checkpoint'
  | 'compaction-zone'
  | 'broker-failure'
  | 'network-partition'
  | 'acl-gate'
  | 'quota-throttle';

interface Obstacle {
  mesh: THREE.Object3D;
  type: ObstacleType;
  active: boolean;
  triggered: boolean;
  /** broker-failure warning countdown (seconds remaining) */
  warningTimer: number;
}

export class ObstacleManager {
  group = new THREE.Group();
  private obstacles: Obstacle[] = [];
  private speed = 10;
  private spawnTimer = 0;
  private brokerTimer = 0;
  private partitionTimer = 0;
  private aclTimer = 0;
  private quotaTimer = 0;
  private enabledTypes: Set<string> = new Set();
  private spawnRateMultiplier = 1.0;
  private compressionWaveActive = false;

  constructor() {
    for (let i = 0; i < 10; i++) this.createRing('isr-ring', 0xffd700);
    for (let i = 0; i < 5; i++) this.createRing('checkpoint', 0x00ff88);
    for (let i = 0; i < 5; i++) this.createZone('compaction-zone');
    for (let i = 0; i < 3; i++) this.createBrokerFailure();
    for (let i = 0; i < 5; i++) this.createNetworkPartition();
    for (let i = 0; i < 3; i++) this.createAclGate();
    for (let i = 0; i < 3; i++) this.createQuotaThrottle();
  }

  private createRing(type: 'isr-ring' | 'checkpoint', color: number) {
    const geo = new THREE.TorusGeometry(3, 0.15, 8, 32);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.visible = false;
    this.group.add(mesh);
    this.obstacles.push({ mesh, type, active: false, triggered: false, warningTimer: 0 });
  }

  private createZone(_type: ObstacleType) {
    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(12, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0x8800ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.01;
    group.add(plane);
    group.visible = false;
    this.group.add(group);
    this.obstacles.push({ mesh: group, type: 'compaction-zone', active: false, triggered: false, warningTimer: 0 });
  }

  private createBrokerFailure() {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(12, 8, 3);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.25,
      emissive: 0xff0000,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
    });
    const box = new THREE.Mesh(geo, mat);
    box.position.y = 4;
    group.add(box);
    // Ceiling warning mesh (drops slightly during warning phase)
    const ceilGeo = new THREE.PlaneGeometry(12, 3);
    const ceilMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 8;
    ceil.name = 'brokerCeiling';
    group.add(ceil);
    group.visible = false;
    this.group.add(group);
    this.obstacles.push({ mesh: group, type: 'broker-failure', active: false, triggered: false, warningTimer: 0 });
  }

  private createNetworkPartition() {
    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(14, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.02;
    group.add(plane);
    // Edge glow lines
    const edgeGeo = new THREE.PlaneGeometry(14, 0.3);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const edgeFront = new THREE.Mesh(edgeGeo, edgeMat);
    edgeFront.rotation.x = -Math.PI / 2;
    edgeFront.position.set(0, 0.03, -3);
    group.add(edgeFront);
    const edgeBack = edgeFront.clone();
    edgeBack.position.set(0, 0.03, 3);
    group.add(edgeBack);
    group.visible = false;
    this.group.add(group);
    this.obstacles.push({ mesh: group, type: 'network-partition', active: false, triggered: false, warningTimer: 0 });
  }

  private createAclGate() {
    const group = new THREE.Group();
    // Main barrier wall
    const wallGeo = new THREE.BoxGeometry(12, 6, 0.2);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xdddd00,
      emissive: 0xaaaa00,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.7,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 3;
    group.add(wall);
    // Small gap on one side (cut out by positioning a dark box)
    const gapGeo = new THREE.BoxGeometry(2.5, 3, 0.25);
    const gapMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0 });
    const gap = new THREE.Mesh(gapGeo, gapMat);
    // Randomly place gap left or right (will be randomised at spawn)
    gap.position.set(-4.5, 1.5, 0);
    gap.name = 'aclGap';
    group.add(gap);
    // Re-punch the wall: move the wall section to leave a visible gap
    // We use two wall halves instead
    wall.visible = false;
    const leftGeo = new THREE.BoxGeometry(3.5, 6, 0.2);
    const leftWall = new THREE.Mesh(leftGeo, wallMat.clone());
    leftWall.position.set(4, 3, 0);
    leftWall.name = 'aclLeft';
    group.add(leftWall);
    const rightGeo = new THREE.BoxGeometry(6, 6, 0.2);
    const rightWall = new THREE.Mesh(rightGeo, wallMat.clone());
    rightWall.position.set(-2.5, 3, 0);
    rightWall.name = 'aclRight';
    group.add(rightWall);
    group.visible = false;
    this.group.add(group);
    this.obstacles.push({ mesh: group, type: 'acl-gate', active: false, triggered: false, warningTimer: 0 });
  }

  private createQuotaThrottle() {
    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(16, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.01;
    group.add(plane);
    // Amber edge markers
    const markerGeo = new THREE.BoxGeometry(0.3, 1.5, 24);
    const markerMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 0.5, transparent: true, opacity: 0.6 });
    const markerL = new THREE.Mesh(markerGeo, markerMat);
    markerL.position.set(-8, 0.75, 0);
    group.add(markerL);
    const markerR = new THREE.Mesh(markerGeo, markerMat.clone());
    markerR.position.set(8, 0.75, 0);
    group.add(markerR);
    group.visible = false;
    this.group.add(group);
    this.obstacles.push({ mesh: group, type: 'quota-throttle', active: false, triggered: false, warningTimer: 0 });
  }

  setSpeed(s: number) { this.speed = s; }

  setEnabledTypes(types: string[]) {
    this.enabledTypes = new Set(types);
  }

  setSpawnRateMultiplier(m: number) { this.spawnRateMultiplier = m; }
  setCompressionWave(active: boolean) { this.compressionWaveActive = active; }

  spawnAt(type: ObstacleType, z: number) {
    const obs = this.obstacles.find(o => o.type === type && !o.active);
    if (!obs) return;
    obs.active = true;
    obs.triggered = false;
    obs.warningTimer = 0;
    obs.mesh.visible = true;
    obs.mesh.position.z = z;

    if (type === 'broker-failure') {
      obs.warningTimer = 3;
      // Start with ceiling lowered and transparent — warning phase
      const ceil = (obs.mesh as THREE.Group).getObjectByName('brokerCeiling') as THREE.Mesh | undefined;
      if (ceil) {
        ceil.position.y = 8;
        (ceil.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    if (type === 'acl-gate') {
      // Randomise which side the gap is on
      const grp = obs.mesh as THREE.Group;
      const left = grp.getObjectByName('aclLeft') as THREE.Mesh | undefined;
      const right = grp.getObjectByName('aclRight') as THREE.Mesh | undefined;
      if (Math.random() < 0.5) {
        // Gap on left side
        if (left) left.position.x = 4;
        if (right) right.position.x = -2.5;
      } else {
        // Gap on right side
        if (left) left.position.x = -4;
        if (right) right.position.x = 2.5;
      }
    }
  }

  update(delta: number) {
    // --- Existing spawn timer (isr-ring, checkpoint, compaction-zone) ---
    this.spawnTimer += delta * this.spawnRateMultiplier;
    if (this.spawnTimer > 3) {
      this.spawnTimer = 0;
      if (this.enabledTypes.has('isr-rings') && Math.random() < 0.3) {
        this.spawnAt('isr-ring', -200);
      }
      if (Math.random() < 0.15) {
        this.spawnAt('checkpoint', -250);
      }
      if (this.enabledTypes.has('compaction') && Math.random() < 0.15) {
        this.spawnAt('compaction-zone', -220);
      }
    }

    // --- broker-failure: 10% chance every 5s ---
    this.brokerTimer += delta;
    if (this.brokerTimer > 5) {
      this.brokerTimer = 0;
      if (this.enabledTypes.has('broker-failure') && Math.random() < 0.1) {
        this.spawnAt('broker-failure', -200);
      }
    }

    // --- network-partition: 15% chance every 4s ---
    this.partitionTimer += delta;
    if (this.partitionTimer > 4) {
      this.partitionTimer = 0;
      if (this.enabledTypes.has('network-partition') && Math.random() < 0.15) {
        this.spawnAt('network-partition', -210);
      }
    }

    // --- acl-gate: 10% chance every 6s ---
    this.aclTimer += delta;
    if (this.aclTimer > 6) {
      this.aclTimer = 0;
      if (this.enabledTypes.has('acl-gate') && Math.random() < 0.1) {
        this.spawnAt('acl-gate', -230);
      }
    }

    // --- quota-throttle: 12% chance every 5s ---
    this.quotaTimer += delta;
    if (this.quotaTimer > 5) {
      this.quotaTimer = 0;
      if (this.enabledTypes.has('quota-throttle') && Math.random() < 0.12) {
        this.spawnAt('quota-throttle', -220);
      }
    }

    // --- Move & animate all active obstacles ---
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      obs.mesh.position.z += this.speed * delta;

      if (obs.type === 'isr-ring') {
        (obs.mesh as THREE.Mesh).rotation.z += delta;
      }

      // broker-failure warning animation: ceiling drops & red flash
      if (obs.type === 'broker-failure' && obs.warningTimer > 0) {
        obs.warningTimer -= delta;
        const ceil = (obs.mesh as THREE.Group).getObjectByName('brokerCeiling') as THREE.Mesh | undefined;
        if (ceil) {
          const t = Math.max(0, obs.warningTimer / 3);
          ceil.position.y = 8 - (1 - t) * 2; // drops from 8 to 6
          (ceil.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.5;
        }
      }

      // Compression wave: shrink obstacles visually
      const targetScale = this.compressionWaveActive ? 0.5 : 1;
      obs.mesh.scale.setScalar(targetScale);

      if (obs.mesh.position.z > 15) {
        obs.active = false;
        obs.mesh.visible = false;
      }
    }
  }

  checkPlayerInside(playerPos: THREE.Vector3): { type: ObstacleType; firstTime: boolean }[] {
    const results: { type: ObstacleType; firstTime: boolean }[] = [];
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      const dz = Math.abs(playerPos.z - obs.mesh.position.z);
      // Wider hit zones for zone-type obstacles
      let hitRange = 2;
      if (obs.type === 'compaction-zone') hitRange = 10;
      if (obs.type === 'quota-throttle') hitRange = 12;
      if (obs.type === 'network-partition') hitRange = 3;
      if (obs.type === 'broker-failure') hitRange = 1.5;
      if (this.compressionWaveActive) hitRange *= 0.5;
      if (dz < hitRange) {
        results.push({ type: obs.type, firstTime: !obs.triggered });
        obs.triggered = true;
      }
    }
    return results;
  }

  getActiveObstacle(type: ObstacleType, nearZ: number): THREE.Object3D | null {
    let best: Obstacle | null = null;
    let bestDist = Infinity;
    for (const obs of this.obstacles) {
      if (!obs.active || obs.type !== type) continue;
      const d = Math.abs(obs.mesh.position.z - nearZ);
      if (d < bestDist) { bestDist = d; best = obs; }
    }
    return best?.mesh ?? null;
  }

  reset() {
    for (const obs of this.obstacles) {
      obs.active = false;
      obs.triggered = false;
      obs.warningTimer = 0;
      obs.mesh.visible = false;
    }
    this.spawnTimer = 0;
    this.brokerTimer = 0;
    this.partitionTimer = 0;
    this.aclTimer = 0;
    this.quotaTimer = 0;
  }
}
