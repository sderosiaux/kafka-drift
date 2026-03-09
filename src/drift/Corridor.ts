import * as THREE from 'three';
import { gridFloorMaterial, wallMaterial, ceilingMaterial } from './SynthwaveShaders';

const SEGMENT_LENGTH = 50;
const LANE_WIDTH = 3;
const DEFAULT_PARTITIONS = 3;
const CORRIDOR_HEIGHT = 8;
const POOL_SIZE = 8;

// Fork geometry constants
const FORK_LENGTH = 80;
const FORK_ENTRY_LENGTH = 10;
const FORK_EXIT_LENGTH = 10;
const FORK_BRANCH_LENGTH = FORK_LENGTH - FORK_ENTRY_LENGTH - FORK_EXIT_LENGTH; // 60
const FORK_SPAWN_MIN = 200;
const FORK_SPAWN_MAX = 400;
const DIVIDER_HEIGHT = 5;
const DIVIDER_THICKNESS = 0.3;

export type ForkBranch = 'left' | 'center' | 'right' | 'none';

interface ForkZone {
  startZ: number; // world Z where fork divider starts
  endZ: number;   // world Z where fork divider ends
  segmentGroup: THREE.Group;
  branchLength: number;
  numPaths: 2 | 3;
}

export class Corridor {
  group = new THREE.Group();
  private segments: THREE.Group[] = [];
  private shaderMaterials: THREE.ShaderMaterial[] = [];
  private nextZ = 0;
  private speed = 10;
  private corridorWidth = (DEFAULT_PARTITIONS + 1) * LANE_WIDTH;
  private partitions = DEFAULT_PARTITIONS;

  // Fork state
  private distanceTraveled = 0;
  private nextForkAt = FORK_SPAWN_MIN;
  private activeForks: ForkZone[] = [];
  private forkSegmentPool: THREE.Group[] = [];
  private forkPoolUsed: boolean[] = [];

  constructor(partitions = DEFAULT_PARTITIONS) {
    this.partitions = partitions;
    this.corridorWidth = (partitions + 1) * LANE_WIDTH;
    for (let i = 0; i < POOL_SIZE; i++) {
      const seg = this.createSegment();
      seg.position.z = -i * SEGMENT_LENGTH;
      this.segments.push(seg);
      this.group.add(seg);
    }
    this.nextZ = -POOL_SIZE * SEGMENT_LENGTH;

    // Pre-build fork segment pool (max 2 concurrent forks)
    for (let i = 0; i < 2; i++) {
      const fork = this.createForkSegment(60, 2);
      fork.visible = false;
      this.group.add(fork);
      this.forkSegmentPool.push(fork);
      this.forkPoolUsed.push(false);
    }

    this.distanceTraveled = 0;
    this.nextForkAt = FORK_SPAWN_MIN + Math.random() * (FORK_SPAWN_MAX - FORK_SPAWN_MIN);
  }

  private createSegment(): THREE.Group {
    const seg = new THREE.Group();
    const w = this.corridorWidth;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(w, SEGMENT_LENGTH);
    const floorMat = gridFloorMaterial();
    this.shaderMaterials.push(floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -SEGMENT_LENGTH / 2);
    seg.add(floor);

    // Walls
    const wallGeo = new THREE.PlaneGeometry(SEGMENT_LENGTH, CORRIDOR_HEIGHT);
    const leftMat = wallMaterial('left');
    const rightMat = wallMaterial('right');
    this.shaderMaterials.push(leftMat, rightMat);

    const leftWall = new THREE.Mesh(wallGeo, leftMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-w / 2, CORRIDOR_HEIGHT / 2, -SEGMENT_LENGTH / 2);
    seg.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, rightMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(w / 2, CORRIDOR_HEIGHT / 2, -SEGMENT_LENGTH / 2);
    seg.add(rightWall);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(w, SEGMENT_LENGTH);
    const ceilMat = ceilingMaterial();
    this.shaderMaterials.push(ceilMat);
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, CORRIDOR_HEIGHT, -SEGMENT_LENGTH / 2);
    seg.add(ceil);

    // Edge glow strips
    const stripGeo = new THREE.PlaneGeometry(SEGMENT_LENGTH, 0.1);
    const stripMatL = new THREE.MeshBasicMaterial({ color: 0xff69b4, transparent: true, opacity: 0.8 });
    const stripMatR = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    const stripL = new THREE.Mesh(stripGeo, stripMatL);
    stripL.rotation.y = Math.PI / 2;
    stripL.position.set(-w / 2, 0.05, -SEGMENT_LENGTH / 2);
    seg.add(stripL);
    const stripR = new THREE.Mesh(stripGeo, stripMatR);
    stripR.rotation.y = -Math.PI / 2;
    stripR.position.set(w / 2, 0.05, -SEGMENT_LENGTH / 2);
    seg.add(stripR);

    return seg;
  }

  /**
   * Creates a fork segment with parameterized branch length and path count.
   * 2-path: central divider → left (safe) + right (risky)
   * 3-path: two dividers → left (safe) + center (normal) + right (risky)
   */
  private createForkSegment(branchLength: number, numPaths: 2 | 3): THREE.Group {
    const seg = new THREE.Group();
    const w = this.corridorWidth;
    const totalLength = FORK_ENTRY_LENGTH + branchLength + FORK_EXIT_LENGTH;

    // --- Full-length floor ---
    const floorGeo = new THREE.PlaneGeometry(w, totalLength);
    const floorMat = gridFloorMaterial();
    this.shaderMaterials.push(floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -totalLength / 2);
    seg.add(floor);

    // --- Outer walls (full length) ---
    const wallGeo = new THREE.PlaneGeometry(totalLength, CORRIDOR_HEIGHT);
    const leftMat = wallMaterial('left');
    const rightMat = wallMaterial('right');
    this.shaderMaterials.push(leftMat, rightMat);

    const leftWall = new THREE.Mesh(wallGeo, leftMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-w / 2, CORRIDOR_HEIGHT / 2, -totalLength / 2);
    seg.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, rightMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(w / 2, CORRIDOR_HEIGHT / 2, -totalLength / 2);
    seg.add(rightWall);

    // --- Ceiling (full length) ---
    const ceilGeo = new THREE.PlaneGeometry(w, totalLength);
    const ceilMat = ceilingMaterial();
    this.shaderMaterials.push(ceilMat);
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, CORRIDOR_HEIGHT, -totalLength / 2);
    seg.add(ceil);

    const dividerMat = new THREE.MeshStandardMaterial({
      color: 0x8844cc,
      emissive: 0x6622aa,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.2,
    });
    const dividerCenterZ = -(FORK_ENTRY_LENGTH + branchLength / 2);
    const exitStartZ = -(FORK_ENTRY_LENGTH + branchLength);
    const taperLength = Math.sqrt(FORK_ENTRY_LENGTH ** 2 + (DIVIDER_THICKNESS / 2) ** 2);
    const taperAngle = Math.atan2(DIVIDER_THICKNESS / 2, FORK_ENTRY_LENGTH);
    const taperMat = new THREE.MeshStandardMaterial({
      color: 0x8844cc,
      emissive: 0x6622aa,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.3,
    });

    // Divider positions: 2-path = [0], 3-path = [-w/6, +w/6]
    const dividerXPositions = numPaths === 2 ? [0] : [-w / 6, w / 6];

    for (const dx of dividerXPositions) {
      // --- Divider wall ---
      const dividerGeo = new THREE.BoxGeometry(DIVIDER_THICKNESS, DIVIDER_HEIGHT, branchLength);
      const divider = new THREE.Mesh(dividerGeo, dividerMat.clone());
      divider.position.set(dx, DIVIDER_HEIGHT / 2, dividerCenterZ);
      seg.add(divider);

      // --- Divider glow strip (top edge) ---
      const glowStripGeo = new THREE.BoxGeometry(DIVIDER_THICKNESS + 0.1, 0.12, branchLength);
      const glowStripMat = new THREE.MeshBasicMaterial({ color: 0xcc66ff, transparent: true, opacity: 0.9 });
      const glowStrip = new THREE.Mesh(glowStripGeo, glowStripMat);
      glowStrip.position.set(dx, DIVIDER_HEIGHT + 0.06, dividerCenterZ);
      seg.add(glowStrip);

      // --- Entry tapers ---
      const taperGeo = new THREE.BoxGeometry(0.15, DIVIDER_HEIGHT, taperLength);
      const taperEntryL = new THREE.Mesh(taperGeo, taperMat.clone());
      taperEntryL.position.set(dx - DIVIDER_THICKNESS / 4, DIVIDER_HEIGHT / 2, -FORK_ENTRY_LENGTH / 2);
      taperEntryL.rotation.y = -taperAngle;
      seg.add(taperEntryL);

      const taperEntryR = new THREE.Mesh(taperGeo.clone(), taperMat.clone());
      taperEntryR.position.set(dx + DIVIDER_THICKNESS / 4, DIVIDER_HEIGHT / 2, -FORK_ENTRY_LENGTH / 2);
      taperEntryR.rotation.y = taperAngle;
      seg.add(taperEntryR);

      // --- Exit tapers ---
      const taperExitL = new THREE.Mesh(taperGeo.clone(), taperMat.clone());
      taperExitL.position.set(dx - DIVIDER_THICKNESS / 4, DIVIDER_HEIGHT / 2, exitStartZ - FORK_EXIT_LENGTH / 2);
      taperExitL.rotation.y = taperAngle;
      seg.add(taperExitL);

      const taperExitR = new THREE.Mesh(taperGeo.clone(), taperMat.clone());
      taperExitR.position.set(dx + DIVIDER_THICKNESS / 4, DIVIDER_HEIGHT / 2, exitStartZ - FORK_EXIT_LENGTH / 2);
      taperExitR.rotation.y = -taperAngle;
      seg.add(taperExitR);
    }

    // --- Color-coded floor tint overlays ---
    const tintHeight = 0.02;
    if (numPaths === 2) {
      const branchWidth = w / 2 - DIVIDER_THICKNESS / 2;
      // Left: green (safe)
      const leftTint = new THREE.Mesh(
        new THREE.PlaneGeometry(branchWidth, branchLength),
        new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
      );
      leftTint.rotation.x = -Math.PI / 2;
      leftTint.position.set(-(branchWidth / 2 + DIVIDER_THICKNESS / 2), tintHeight, dividerCenterZ);
      seg.add(leftTint);
      // Right: red (risky)
      const rightTint = new THREE.Mesh(
        new THREE.PlaneGeometry(branchWidth, branchLength),
        new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
      );
      rightTint.rotation.x = -Math.PI / 2;
      rightTint.position.set(branchWidth / 2 + DIVIDER_THICKNESS / 2, tintHeight, dividerCenterZ);
      seg.add(rightTint);
    } else {
      const pathWidth = w / 3 - DIVIDER_THICKNESS;
      // Left: green (safe)
      const leftTint = new THREE.Mesh(
        new THREE.PlaneGeometry(pathWidth, branchLength),
        new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
      );
      leftTint.rotation.x = -Math.PI / 2;
      leftTint.position.set(-w / 3, tintHeight, dividerCenterZ);
      seg.add(leftTint);
      // Center: blue (normal)
      const centerTint = new THREE.Mesh(
        new THREE.PlaneGeometry(pathWidth, branchLength),
        new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.10, side: THREE.DoubleSide })
      );
      centerTint.rotation.x = -Math.PI / 2;
      centerTint.position.set(0, tintHeight, dividerCenterZ);
      seg.add(centerTint);
      // Right: red (risky)
      const rightTint = new THREE.Mesh(
        new THREE.PlaneGeometry(pathWidth, branchLength),
        new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
      );
      rightTint.rotation.x = -Math.PI / 2;
      rightTint.position.set(w / 3, tintHeight, dividerCenterZ);
      seg.add(rightTint);
    }

    // --- Edge glow strips (full length) ---
    const stripGeo = new THREE.PlaneGeometry(totalLength, 0.1);
    const stripL = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8 }));
    stripL.rotation.y = Math.PI / 2;
    stripL.position.set(-w / 2, 0.05, -totalLength / 2);
    seg.add(stripL);
    const stripR = new THREE.Mesh(stripGeo.clone(), new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.8 }));
    stripR.rotation.y = -Math.PI / 2;
    stripR.position.set(w / 2, 0.05, -totalLength / 2);
    seg.add(stripR);

    // --- Branch label indicators ---
    const safeRingGeo = new THREE.TorusGeometry(0.6, 0.08, 8, 16);
    const safeRing = new THREE.Mesh(safeRingGeo, new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.9 }));
    safeRing.rotation.x = Math.PI / 2;
    const riskyMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.9 }));

    if (numPaths === 2) {
      safeRing.position.set(-w / 4, 3, -FORK_ENTRY_LENGTH - 2);
      riskyMarker.position.set(w / 4, 3, -FORK_ENTRY_LENGTH - 2);
    } else {
      safeRing.position.set(-w / 3, 3, -FORK_ENTRY_LENGTH - 2);
      riskyMarker.position.set(w / 3, 3, -FORK_ENTRY_LENGTH - 2);
      // Center marker: blue sphere
      const centerMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.9 })
      );
      centerMarker.position.set(0, 3, -FORK_ENTRY_LENGTH - 2);
      seg.add(centerMarker);
    }
    seg.add(safeRing);
    seg.add(riskyMarker);
    (seg as any)._forkMarkers = { safeRing, riskyMarker };

    return seg;
  }

  /**
   * Determines which fork branch the player is currently in.
   * Returns 'none' if player is not inside any active fork zone.
   */
  getPlayerBranch(playerX: number): ForkBranch {
    const w = this.corridorWidth;
    for (const fork of this.activeForks) {
      const segZ = fork.segmentGroup.position.z;
      const dividerStartWorld = segZ - FORK_ENTRY_LENGTH;
      const dividerEndWorld = segZ - FORK_ENTRY_LENGTH - fork.branchLength;

      if (0 < dividerStartWorld && 0 > dividerEndWorld) {
        if (fork.numPaths === 3) {
          const innerBound = w / 6;
          if (playerX < -innerBound) return 'left';
          if (playerX > innerBound) return 'right';
          return 'center';
        }
        // 2-path fork
        if (playerX < -DIVIDER_THICKNESS / 2) return 'left';
        if (playerX > DIVIDER_THICKNESS / 2) return 'right';
        return playerX <= 0 ? 'left' : 'right';
      }
    }
    return 'none';
  }

  setSpeed(s: number) { this.speed = s; }

  update(delta: number, elapsed: number) {
    for (const mat of this.shaderMaterials) {
      mat.uniforms.uTime.value = elapsed;
      if (mat.uniforms.uSpeed) mat.uniforms.uSpeed.value = this.speed * 0.05;
    }

    // Move normal corridor segments
    for (const seg of this.segments) {
      seg.position.z += this.speed * delta;
      if (seg.position.z > SEGMENT_LENGTH) {
        seg.position.z = this.nextZ;
        this.nextZ -= SEGMENT_LENGTH;
      }
    }

    // Track distance for fork spawning
    this.distanceTraveled += this.speed * delta;

    // Spawn fork if due and partitions >= 3
    if (this.partitions >= 3 && this.distanceTraveled >= this.nextForkAt) {
      this.spawnFork();
      this.nextForkAt = this.distanceTraveled + FORK_SPAWN_MIN + Math.random() * (FORK_SPAWN_MAX - FORK_SPAWN_MIN);
    }

    // Move and manage active fork segments
    for (let i = this.activeForks.length - 1; i >= 0; i--) {
      const fork = this.activeForks[i];
      fork.segmentGroup.position.z += this.speed * delta;

      // Animate fork markers
      const markers = (fork.segmentGroup as any)._forkMarkers;
      if (markers) {
        markers.safeRing.rotation.z = elapsed * 2;
        markers.riskyMarker.rotation.y = elapsed * 3;
        markers.riskyMarker.rotation.x = elapsed * 1.5;
      }

      // Recycle when fully passed the player
      const totalForkLen = FORK_ENTRY_LENGTH + fork.branchLength + FORK_EXIT_LENGTH;
      if (fork.segmentGroup.position.z > totalForkLen + 10) {
        fork.segmentGroup.visible = false;
        // Return to pool
        const poolIdx = this.forkSegmentPool.indexOf(fork.segmentGroup);
        if (poolIdx >= 0) this.forkPoolUsed[poolIdx] = false;
        this.activeForks.splice(i, 1);
      }
    }
  }

  private spawnFork() {
    const poolIdx = this.forkPoolUsed.indexOf(false);
    if (poolIdx < 0) return;

    // Randomize fork params (R3: 50-100 unit branch, 2-3 paths)
    const branchLength = 50 + Math.random() * 50;
    const numPaths: 2 | 3 = Math.random() < 0.3 ? 3 : 2;

    // Rebuild fork segment with new params
    const oldSeg = this.forkSegmentPool[poolIdx];
    this.group.remove(oldSeg);
    oldSeg.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else (child.material as THREE.Material).dispose();
      }
    });

    const newSeg = this.createForkSegment(branchLength, numPaths);
    this.forkSegmentPool[poolIdx] = newSeg;
    this.forkPoolUsed[poolIdx] = true;

    const spawnZ = Math.min(this.nextZ, -150);
    newSeg.position.z = spawnZ;
    newSeg.visible = true;
    this.group.add(newSeg);

    this.activeForks.push({
      startZ: spawnZ - FORK_ENTRY_LENGTH,
      endZ: spawnZ - FORK_ENTRY_LENGTH - branchLength,
      segmentGroup: newSeg,
      branchLength,
      numPaths,
    });
  }

  /** Reset fork state (called on new run) */
  resetForks() {
    this.distanceTraveled = 0;
    this.nextForkAt = FORK_SPAWN_MIN + Math.random() * (FORK_SPAWN_MAX - FORK_SPAWN_MIN);
    for (let i = 0; i < this.forkSegmentPool.length; i++) {
      this.forkSegmentPool[i].visible = false;
      this.forkPoolUsed[i] = false;
    }
    this.activeForks.length = 0;
  }

  get width() { return this.corridorWidth; }
  get height() { return CORRIDOR_HEIGHT; }
  get segmentLength() { return SEGMENT_LENGTH; }
}
