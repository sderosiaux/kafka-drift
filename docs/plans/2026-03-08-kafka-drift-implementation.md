# Kafka Drift — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Production-ready 3D first-person hoverboard game where players surf through Kafka topic corridors, collect messages, outrun a lag wave, and manage a Broker Hub with tech tree, idle consumers, and pipelines.

**Architecture:** Vite + vanilla TypeScript + Three.js. Game state managed via a central store with localStorage persistence. Two main scenes (DriftRun, BrokerHub) with shared state. Procedural corridor generation. Post-processing pipeline for synthwave aesthetics.

**Tech Stack:** Vite, TypeScript, Three.js (r170+), EffectComposer (bloom, chromatic aberration), PointerLockControls, Web Audio API, localStorage.

---

## Design Resolutions (Post-Review)

These decisions override any conflicting code in the tasks below. The implementing agent MUST apply these:

### R1: Dynamic Corridor Width
The corridor widens based on partition count. `LANE_WIDTH` stays fixed at 3. Corridor width = `(partitions + 1) * LANE_WIDTH`. A 3-partition topic = 12 units wide. An 8-partition topic = 27 units wide. Walls, floor, ceiling all scale. Shaders adapt.

### R2: Free Look FPS During Drift
PointerLockControls active during drift runs. The player can look around freely while surfing. Camera is attached to player group. Mouse controls head orientation, A/D still switch lanes. This makes the corridor feel immersive and the forks explorable.

### R3: Real Geometric Forks
Partition forks are real corridor splits — the tunnel physically branches into 2-3 paths. Each branch has different risk/reward (visible via color coding: green=safe/low reward, red=dangerous/high reward). The player must steer into a branch. Branches merge back after 50-100 units. Implementation: pre-built fork segment meshes swapped into the corridor pool.

### R4: Combo Multiplier
Combo is a gameplay multiplier: each message collected within 2s of the last adds +1 combo. Message value = `baseValue * min(combo, 10)`. Cap at x10. Combo resets on poison pill hit or 2s timeout. ISR rings add +2 combo instantly.

### R5: Checkpoint Respawn
Touching a checkpoint (offset ring) grants 1 respawn charge. If lag catches you with a charge, you respawn at the last checkpoint instead of ending the run. Max 1 charge at a time. Visual: checkpoint ring turns from green to gold when "charged".

### R6: Power-Up Drops
Power-ups drop rarely during runs (~2% chance per spawn cycle). 3 inventory slots. Press E to use. Types:
- **Compaction Burst**: all messages in 20m radius merge into one high-value message
- **Compression Wave**: obstacles shrink for 5s, easier to dodge
- **Exactly-Once Shield**: blocks 1 lag hit (separate from checkpoint)
- **Rewind**: teleport 20 units forward (away from lag)
Power-ups are stored in SaveData, persist between runs.

### R7: Message Value Scales Per Topic
Each TopicConfig gets a `baseMessageValue` field. Topic 1 = 1, scaling up to topic 24 = 500. The value of collected messages = `baseMessageValue * combo_multiplier * tech_tree_multipliers`. This prevents late-game grind.

### R8: Hub Interaction Flow
Player approaches station → enters proximity zone (5 units) → HUD shows "Press F to interact" → F pressed → pointer unlocks, 2D overlay UI opens → player interacts with mouse → Escape closes overlay → pointer re-locks. Each station has a ProximityTrigger component.

### R9: getEffect() Rework
Each TechNode.effect entry has a mode:
- `set`: last value wins (e.g., `shieldCharges: 3`)
- `add`: sum all (e.g., `extraLanes: 1` + `extraLanes: 2` = 3)
- `multiply`: product of all (e.g., `speedMultiplier: 1.15` * `1.3` * `1.5`)
Store mode in a separate `EFFECT_MODES` map. `getEffect(key)` applies the correct aggregation.

### R10: CSS via Vite Imports
All CSS loaded via `import './file.css'` in TypeScript files. No `<link>` tag injection. Vite handles bundling for production.

### R11: Obstacle Spawning System
`DriftScene` reads `topicConfig.obstacles[]` and spawns matching obstacles at intervals during the run. Each obstacle type has a spawn frequency and visual implementation:
- `poison-pill`: red glitch cubes (already in collectibles)
- `tombstone`: black blocks (already in collectibles)
- `broker-failure`: corridor section collapses (ceiling drops, walls shake, floor cracks — 3s warning)
- `network-partition`: gap in floor, must jump over
- `isr-rings`: golden rings to fly through for combo
- `compaction`: zone with purple glow, messages merge
- `retention`: messages fade faster in this section
- `acl-gate`: barrier across corridor, requires ACL Passkey tech or dodge through side gap
- `quota-throttle`: speed-limiting zone, slows player unless Quota Bypass tech

---

## Milestone 1: Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/style.css`

**Step 1: Initialize project**

```bash
cd /private/tmp/kafka-walk
npm init -y
npm install three@latest
npm install -D typescript vite @types/three
```

**Step 2: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
});
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["three"]
  },
  "include": ["src"]
}
```

**Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kafka Drift</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="game"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**Step 5: Create src/style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0a; }
#game { width: 100%; height: 100%; }
canvas { display: block; }
```

**Step 6: Create src/main.ts with basic Three.js scene**

```ts
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('game')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0010);
scene.fog = new THREE.FogExp2(0x0a0010, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

// Placeholder cube
const geo = new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshStandardMaterial({ color: 0xff69b4, emissive: 0xff69b4, emissiveIntensity: 0.3 });
const cube = new THREE.Mesh(geo, mat);
scene.add(cube);

const ambient = new THREE.AmbientLight(0x6633aa, 0.5);
scene.add(ambient);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();
```

**Step 7: Verify**

Run: `npx vite --open`
Expected: Pink glowing cube rotating on dark purple background in browser.

**Step 8: Init git and commit**

```bash
git init
echo 'node_modules/\ndist/\n.DS_Store' > .gitignore
git add -A
git commit -m "feat: project scaffolding with Vite + Three.js + TypeScript"
```

---

### Task 2: Game Engine Core

**Files:**
- Create: `src/engine/Engine.ts`
- Create: `src/engine/SceneManager.ts`
- Create: `src/engine/InputManager.ts`
- Modify: `src/main.ts`

**Step 1: Create src/engine/Engine.ts**

Central game engine: manages renderer, clock, game loop, scene switching.

```ts
import * as THREE from 'three';

export interface GameScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  onEnter?(): void;
  onExit?(): void;
  update(delta: number, elapsed: number): void;
  onResize?(width: number, height: number): void;
}

export class Engine {
  renderer: THREE.WebGLRenderer;
  clock = new THREE.Clock();
  private currentScene: GameScene | null = null;
  private scenes = new Map<string, GameScene>();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.renderer.setSize(w, h);
      this.currentScene?.onResize?.(w, h);
    });
  }

  register(name: string, scene: GameScene) {
    this.scenes.set(name, scene);
  }

  switchTo(name: string) {
    this.currentScene?.onExit?.();
    this.currentScene = this.scenes.get(name) ?? null;
    this.currentScene?.onEnter?.();
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();
      if (this.currentScene) {
        this.currentScene.update(delta, elapsed);
        this.renderer.render(this.currentScene.scene, this.currentScene.camera);
      }
    };
    loop();
  }

  get canvas() { return this.renderer.domElement; }
}
```

**Step 2: Create src/engine/InputManager.ts**

```ts
export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  isDown(code: string) { return this.keys.has(code); }

  wasPressed(code: string) { return this.justPressed.has(code); }

  /** Call at end of each frame */
  endFrame() { this.justPressed.clear(); }
}

export const input = new InputManager();
```

**Step 3: Create src/engine/SceneManager.ts**

Re-export for clean imports:

```ts
export { Engine } from './Engine';
export type { GameScene } from './Engine';
export { InputManager, input } from './InputManager';
```

**Step 4: Update src/main.ts**

```ts
import { Engine } from './engine/SceneManager';

const container = document.getElementById('game')!;
const engine = new Engine(container);

// Placeholder — will be replaced by real scenes
import * as THREE from 'three';
const placeholderScene: import('./engine/SceneManager').GameScene = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
  update() {},
  onEnter() {
    this.scene.background = new THREE.Color(0x0a0010);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff69b4, emissive: 0xff69b4, emissiveIntensity: 0.3 });
    this.scene.add(new THREE.Mesh(geo, mat));
    this.scene.add(new THREE.AmbientLight(0x6633aa, 0.5));
    (this.camera as THREE.PerspectiveCamera).position.set(0, 2, 5);
  },
  update(delta) {
    this.scene.children[0].rotation.y += delta;
  },
  onResize(w, h) {
    const cam = this.camera as THREE.PerspectiveCamera;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  },
};

engine.register('placeholder', placeholderScene);
engine.switchTo('placeholder');
engine.start();
```

**Step 5: Verify**

Run: `npx vite`
Expected: Same pink cube, but now driven by Engine.

**Step 6: Commit**

```bash
git add src/engine/ src/main.ts
git commit -m "feat: game engine core with scene management and input"
```

---

### Task 3: Game State Store

**Files:**
- Create: `src/state/GameState.ts`
- Create: `src/state/TechTree.ts`
- Create: `src/state/TopicData.ts`
- Create: `src/state/__tests__/GameState.test.ts`

**Step 1: Install vitest**

```bash
npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run", "test:watch": "vitest"`

**Step 2: Create src/state/TopicData.ts**

Static data for all 24 topics:

```ts
export interface TopicConfig {
  id: string;
  name: string;
  cluster: number;
  clusterName: string;
  speed: number;          // base corridor speed
  partitions: number;     // number of lanes
  lagAccel: number;       // how fast lag wave accelerates
  messageDensity: number; // messages per 100m of corridor
  length: number;         // corridor length in units
  rewards: { messages: number; schemas: number };
  obstacles: string[];    // types of obstacles present
  description: string;    // flavor text
}

export const TOPICS: TopicConfig[] = [
  // Cluster 1: Getting Started
  { id: 'hello-world', name: 'Hello World', cluster: 1, clusterName: 'Getting Started', speed: 8, partitions: 1, lagAccel: 0.1, messageDensity: 20, length: 500, rewards: { messages: 100, schemas: 0 }, obstacles: [], description: 'Your first topic. Just surf and collect.' },
  { id: 'first-messages', name: 'First Messages', cluster: 1, clusterName: 'Getting Started', speed: 10, partitions: 2, lagAccel: 0.15, messageDensity: 25, length: 600, rewards: { messages: 200, schemas: 0 }, obstacles: ['poison-pill'], description: 'Watch out for poison pills.' },
  { id: 'basic-partitions', name: 'Basic Partitions', cluster: 1, clusterName: 'Getting Started', speed: 12, partitions: 3, lagAccel: 0.2, messageDensity: 30, length: 700, rewards: { messages: 300, schemas: 1 }, obstacles: ['poison-pill'], description: 'Choose your lane wisely.' },
  { id: 'consumer-basics', name: 'Consumer Basics', cluster: 1, clusterName: 'Getting Started', speed: 14, partitions: 3, lagAccel: 0.25, messageDensity: 35, length: 800, rewards: { messages: 500, schemas: 2 }, obstacles: ['poison-pill', 'tombstone'], description: 'Learn to consume at speed.' },

  // Cluster 2: The Producer
  { id: 'key-value-pairs', name: 'Key-Value Pairs', cluster: 2, clusterName: 'The Producer', speed: 16, partitions: 3, lagAccel: 0.3, messageDensity: 40, length: 900, rewards: { messages: 800, schemas: 3 }, obstacles: ['poison-pill', 'tombstone'], description: 'Keys determine your partition lane.' },
  { id: 'serialization', name: 'Serialization', cluster: 2, clusterName: 'The Producer', speed: 18, partitions: 4, lagAccel: 0.35, messageDensity: 45, length: 1000, rewards: { messages: 1200, schemas: 5 }, obstacles: ['poison-pill', 'tombstone', 'retention'], description: 'Avro messages appear. Grab them.' },
  { id: 'batch-compression', name: 'Batch Compression', cluster: 2, clusterName: 'The Producer', speed: 20, partitions: 4, lagAccel: 0.4, messageDensity: 50, length: 1100, rewards: { messages: 1800, schemas: 8 }, obstacles: ['poison-pill', 'compaction'], description: 'Compaction zones compress rewards.' },
  { id: 'acks-reliability', name: 'Acks & Reliability', cluster: 2, clusterName: 'The Producer', speed: 22, partitions: 4, lagAccel: 0.45, messageDensity: 55, length: 1200, rewards: { messages: 2500, schemas: 10 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'compaction'], description: 'Reliability matters at speed.' },

  // Cluster 3: The Broker
  { id: 'replication', name: 'Replication', cluster: 3, clusterName: 'The Broker', speed: 24, partitions: 4, lagAccel: 0.5, messageDensity: 55, length: 1300, rewards: { messages: 4000, schemas: 12 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure'], description: 'Replicas keep you safe. Sometimes.' },
  { id: 'isr-dance', name: 'ISR Dance', cluster: 3, clusterName: 'The Broker', speed: 26, partitions: 5, lagAccel: 0.55, messageDensity: 60, length: 1400, rewards: { messages: 6000, schemas: 15 }, obstacles: ['poison-pill', 'isr-rings', 'broker-failure'], description: 'Stay in sync for massive combos.' },
  { id: 'log-segments', name: 'Log Segments', cluster: 3, clusterName: 'The Broker', speed: 28, partitions: 5, lagAccel: 0.6, messageDensity: 65, length: 1500, rewards: { messages: 8000, schemas: 18 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'broker-failure'], description: 'Segments roll. Stay ahead.' },
  { id: 'controller-election', name: 'Controller Election', cluster: 3, clusterName: 'The Broker', speed: 30, partitions: 5, lagAccel: 0.65, messageDensity: 70, length: 1600, rewards: { messages: 12000, schemas: 22 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure', 'network-partition'], description: 'The controller changes mid-run.' },

  // Cluster 4: The Stream Processor
  { id: 'join-streams', name: 'Join Streams', cluster: 4, clusterName: 'The Stream Processor', speed: 32, partitions: 5, lagAccel: 0.7, messageDensity: 70, length: 1700, rewards: { messages: 18000, schemas: 28 }, obstacles: ['poison-pill', 'tombstone', 'network-partition'], description: 'Two streams merge. Double the chaos.' },
  { id: 'windowed-aggregation', name: 'Windowed Aggregation', cluster: 4, clusterName: 'The Stream Processor', speed: 34, partitions: 6, lagAccel: 0.75, messageDensity: 75, length: 1800, rewards: { messages: 25000, schemas: 35 }, obstacles: ['poison-pill', 'retention', 'compaction', 'network-partition'], description: 'Windows open and close. Time your collection.' },
  { id: 'ktable-changelog', name: 'KTable Changelog', cluster: 4, clusterName: 'The Stream Processor', speed: 36, partitions: 6, lagAccel: 0.8, messageDensity: 80, length: 1900, rewards: { messages: 35000, schemas: 42 }, obstacles: ['poison-pill', 'tombstone', 'compaction', 'broker-failure'], description: 'The table materializes around you.' },
  { id: 'state-store', name: 'State Store', cluster: 4, clusterName: 'The Stream Processor', speed: 38, partitions: 6, lagAccel: 0.85, messageDensity: 85, length: 2000, rewards: { messages: 50000, schemas: 50 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'broker-failure', 'network-partition'], description: 'State persists. Mistakes too.' },

  // Cluster 5: The Architect
  { id: 'multi-datacenter', name: 'Multi-Datacenter', cluster: 5, clusterName: 'The Architect', speed: 40, partitions: 6, lagAccel: 0.9, messageDensity: 85, length: 2200, rewards: { messages: 75000, schemas: 60 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure', 'network-partition'], description: 'Data crosses continents.' },
  { id: 'mirror-maker', name: 'MirrorMaker', cluster: 5, clusterName: 'The Architect', speed: 42, partitions: 7, lagAccel: 0.95, messageDensity: 90, length: 2400, rewards: { messages: 100000, schemas: 75 }, obstacles: ['poison-pill', 'tombstone', 'compaction', 'broker-failure', 'network-partition'], description: 'Mirror everything. Miss nothing.' },
  { id: 'rack-awareness', name: 'Rack Awareness', cluster: 5, clusterName: 'The Architect', speed: 44, partitions: 7, lagAccel: 1.0, messageDensity: 90, length: 2600, rewards: { messages: 150000, schemas: 90 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure', 'network-partition'], description: 'Racks fall. Replicas survive.' },
  { id: 'tiered-storage', name: 'Tiered Storage', cluster: 5, clusterName: 'The Architect', speed: 46, partitions: 7, lagAccel: 1.05, messageDensity: 95, length: 2800, rewards: { messages: 200000, schemas: 110 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'compaction', 'broker-failure', 'network-partition'], description: 'Cold and hot. Navigate both.' },

  // Cluster 6: The Guardian
  { id: 'acl-maze', name: 'ACL Maze', cluster: 6, clusterName: 'The Guardian', speed: 48, partitions: 8, lagAccel: 1.1, messageDensity: 95, length: 3000, rewards: { messages: 300000, schemas: 140 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure', 'network-partition', 'acl-gate'], description: 'Only the authorized pass.' },
  { id: 'quota-management', name: 'Quota Management', cluster: 6, clusterName: 'The Guardian', speed: 50, partitions: 8, lagAccel: 1.15, messageDensity: 100, length: 3200, rewards: { messages: 500000, schemas: 180 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'broker-failure', 'network-partition', 'quota-throttle'], description: 'Quotas limit your speed. Upgrade or suffer.' },
  { id: 'exactly-once-gauntlet', name: 'Exactly-Once Gauntlet', cluster: 6, clusterName: 'The Guardian', speed: 55, partitions: 8, lagAccel: 1.2, messageDensity: 100, length: 3500, rewards: { messages: 1000000, schemas: 250 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'compaction', 'broker-failure', 'network-partition', 'acl-gate', 'quota-throttle'], description: 'The final run. Every message counts. Exactly once.' },
];

export const CLUSTERS = [
  { id: 1, name: 'Getting Started', requiredCleared: 0 },
  { id: 2, name: 'The Producer', requiredCleared: 3 },
  { id: 3, name: 'The Broker', requiredCleared: 7 },
  { id: 4, name: 'The Stream Processor', requiredCleared: 11 },
  { id: 5, name: 'The Architect', requiredCleared: 15 },
  { id: 6, name: 'The Guardian', requiredCleared: 19 },
];
```

**Step 3: Create src/state/TechTree.ts**

```ts
export interface TechNode {
  id: string;
  name: string;
  branch: 'speed' | 'data' | 'infra' | 'mastery';
  cost: { messages: number; schemas: number };
  requires: string[];  // prerequisite node ids
  effect: Record<string, number>;  // key-value modifiers
  description: string;
}

export const TECH_NODES: TechNode[] = [
  // SPEED branch
  { id: 'board-speed-1', name: 'Board Speed I', branch: 'speed', cost: { messages: 200, schemas: 0 }, requires: [], effect: { speedMultiplier: 1.15 }, description: '+15% board speed' },
  { id: 'board-speed-2', name: 'Board Speed II', branch: 'speed', cost: { messages: 1000, schemas: 5 }, requires: ['board-speed-1'], effect: { speedMultiplier: 1.3 }, description: '+30% board speed' },
  { id: 'board-speed-3', name: 'Board Speed III', branch: 'speed', cost: { messages: 8000, schemas: 20 }, requires: ['board-speed-2'], effect: { speedMultiplier: 1.5 }, description: '+50% board speed' },
  { id: 'partition-lanes-1', name: 'Partition Lanes +1', branch: 'speed', cost: { messages: 500, schemas: 2 }, requires: [], effect: { extraLanes: 1 }, description: 'See one extra lane in forks' },
  { id: 'partition-lanes-2', name: 'Partition Lanes +2', branch: 'speed', cost: { messages: 5000, schemas: 15 }, requires: ['partition-lanes-1'], effect: { extraLanes: 2 }, description: 'See two extra lanes in forks' },
  { id: 'boost-duration', name: 'Boost Duration+', branch: 'speed', cost: { messages: 3000, schemas: 10 }, requires: ['board-speed-1'], effect: { boostDuration: 2.0 }, description: 'Boost lasts 2x longer' },
  { id: 'air-control', name: 'Air Control', branch: 'speed', cost: { messages: 2000, schemas: 8 }, requires: ['partition-lanes-1'], effect: { airControl: 1 }, description: 'Change lanes mid-jump' },
  { id: 'magnetic-collect', name: 'Magnetic Collect', branch: 'speed', cost: { messages: 15000, schemas: 30 }, requires: ['board-speed-2', 'air-control'], effect: { collectRadius: 3.0 }, description: 'Messages are attracted to you' },

  // DATA branch
  { id: 'schema-registry', name: 'Schema Registry', branch: 'data', cost: { messages: 800, schemas: 0 }, requires: [], effect: { schemaDropRate: 1.5 }, description: 'Schema messages appear 50% more often' },
  { id: 'avro-decoder', name: 'Avro Decoder', branch: 'data', cost: { messages: 2000, schemas: 5 }, requires: ['schema-registry'], effect: { schemaValue: 2.0 }, description: 'Schema messages worth 2x' },
  { id: 'protobuf-decoder', name: 'Protobuf Decoder', branch: 'data', cost: { messages: 6000, schemas: 15 }, requires: ['avro-decoder'], effect: { schemaValue: 3.0 }, description: 'Schema messages worth 3x' },
  { id: 'header-reader', name: 'Header Reader', branch: 'data', cost: { messages: 1500, schemas: 3 }, requires: ['schema-registry'], effect: { messagePreview: 1 }, description: 'See message value before collecting' },
  { id: 'compression-lz4', name: 'Compression LZ4', branch: 'data', cost: { messages: 4000, schemas: 12 }, requires: ['header-reader'], effect: { messageSize: 0.7 }, description: 'Messages 30% smaller, easier to dodge between' },
  { id: 'compaction-view', name: 'Compaction View', branch: 'data', cost: { messages: 10000, schemas: 25 }, requires: ['compression-lz4'], effect: { compactionMultiplier: 2.0 }, description: 'Compaction zones give 2x more' },
  { id: 'serde', name: 'SerDe', branch: 'data', cost: { messages: 20000, schemas: 40 }, requires: ['protobuf-decoder', 'compaction-view'], effect: { allMessageValue: 1.5 }, description: 'All messages worth 50% more' },

  // INFRA branch
  { id: 'replication-2', name: 'Replication x2', branch: 'infra', cost: { messages: 1000, schemas: 0 }, requires: [], effect: { replicationReward: 2.0 }, description: 'End-of-run rewards doubled' },
  { id: 'replication-3', name: 'Replication x3', branch: 'infra', cost: { messages: 8000, schemas: 20 }, requires: ['replication-2'], effect: { replicationReward: 3.0 }, description: 'End-of-run rewards tripled' },
  { id: 'multi-broker', name: 'Multi-Broker', branch: 'infra', cost: { messages: 3000, schemas: 8 }, requires: ['replication-2'], effect: { consumerSlots: 2 }, description: '+2 consumer machine slots' },
  { id: 'rack-awareness', name: 'Rack Awareness', branch: 'infra', cost: { messages: 12000, schemas: 25 }, requires: ['multi-broker'], effect: { brokerFailureResist: 0.5 }, description: '50% less impact from broker failures' },
  { id: 'tiered-storage', name: 'Tiered Storage', branch: 'infra', cost: { messages: 25000, schemas: 50 }, requires: ['rack-awareness'], effect: { retentionExtend: 2.0 }, description: 'Messages stay 2x longer before fading' },
  { id: 'controller-ha', name: 'Controller HA', branch: 'infra', cost: { messages: 15000, schemas: 35 }, requires: ['rack-awareness'], effect: { lagSlowdown: 0.8 }, description: 'Lag wave 20% slower' },
  { id: 'mirrormaker', name: 'MirrorMaker', branch: 'infra', cost: { messages: 50000, schemas: 80 }, requires: ['controller-ha', 'tiered-storage'], effect: { idleMultiplier: 2.0 }, description: 'Idle income doubled' },

  // MASTERY branch
  { id: 'idempotent-producer', name: 'Idempotent Producer', branch: 'mastery', cost: { messages: 2000, schemas: 5 }, requires: [], effect: { noDuplicatePenalty: 1 }, description: 'No penalty for touching same message twice' },
  { id: 'exactly-once', name: 'Exactly-Once Shield', branch: 'mastery', cost: { messages: 10000, schemas: 30 }, requires: ['idempotent-producer'], effect: { shieldCharges: 3 }, description: '3 shield charges per run (block lag hit)' },
  { id: 'transactions', name: 'Transactions', branch: 'mastery', cost: { messages: 20000, schemas: 45 }, requires: ['exactly-once'], effect: { transactionWindow: 5 }, description: '5s undo window after collecting poison pill' },
  { id: 'acl-passkeys', name: 'ACL Passkeys', branch: 'mastery', cost: { messages: 5000, schemas: 15 }, requires: ['idempotent-producer'], effect: { aclBypass: 1 }, description: 'Pass through ACL gates without slowing' },
  { id: 'quota-bypass', name: 'Quota Bypass', branch: 'mastery', cost: { messages: 30000, schemas: 60 }, requires: ['acl-passkeys'], effect: { quotaImmune: 1 }, description: 'Immune to quota throttling' },
  { id: 'consumer-isolation', name: 'Consumer Isolation', branch: 'mastery', cost: { messages: 40000, schemas: 70 }, requires: ['transactions', 'quota-bypass'], effect: { consumerEfficiency: 2.0 }, description: 'Consumer machines 2x more efficient' },
];
```

**Step 4: Create src/state/GameState.ts**

```ts
import { TECH_NODES, type TechNode } from './TechTree';
import { TOPICS, CLUSTERS, type TopicConfig } from './TopicData';

export interface ConsumerMachine {
  id: string;
  level: number;          // 1-5
  assignedTopic: string | null;
  partitions: number;     // assigned partitions
}

export interface Pipeline {
  id: string;
  fromTopic: string;
  toTopic: string;
}

export interface SaveData {
  version: number;
  messages: number;
  schemas: number;
  throughput: number;
  unlockedTech: string[];
  clearedTopics: string[];
  bestScores: Record<string, number>;
  consumers: ConsumerMachine[];
  pipelines: Pipeline[];
  lastOnline: number;     // timestamp for idle calc
  totalTimePlayed: number;
  equippedPowerUp: string | null;
}

const DEFAULT_SAVE: SaveData = {
  version: 1,
  messages: 0,
  schemas: 0,
  throughput: 0,
  unlockedTech: [],
  clearedTopics: [],
  bestScores: {},
  consumers: [
    { id: 'consumer-1', level: 1, assignedTopic: null, partitions: 1 },
  ],
  pipelines: [],
  lastOnline: Date.now(),
  totalTimePlayed: 0,
  equippedPowerUp: null,
};

const STORAGE_KEY = 'kafka-drift-save';

export class GameState {
  data: SaveData;

  constructor() {
    this.data = this.load();
    this.calcIdleIncome();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
    } catch { /* corrupted save, start fresh */ }
    return { ...DEFAULT_SAVE, lastOnline: Date.now() };
  }

  save() {
    this.data.lastOnline = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = { ...DEFAULT_SAVE, lastOnline: Date.now() };
  }

  // --- Currencies ---

  addMessages(n: number) { this.data.messages += n; }
  addSchemas(n: number) { this.data.schemas += n; }
  addThroughput(n: number) { this.data.throughput += n; }

  canAfford(cost: { messages: number; schemas: number }) {
    return this.data.messages >= cost.messages && this.data.schemas >= cost.schemas;
  }

  spend(cost: { messages: number; schemas: number }) {
    if (!this.canAfford(cost)) return false;
    this.data.messages -= cost.messages;
    this.data.schemas -= cost.schemas;
    return true;
  }

  // --- Tech Tree ---

  isTechUnlocked(id: string) { return this.data.unlockedTech.includes(id); }

  canUnlockTech(id: string): boolean {
    const node = TECH_NODES.find(n => n.id === id);
    if (!node || this.isTechUnlocked(id)) return false;
    if (!node.requires.every(r => this.isTechUnlocked(r))) return false;
    return this.canAfford(node.cost);
  }

  unlockTech(id: string): boolean {
    const node = TECH_NODES.find(n => n.id === id);
    if (!node || !this.canUnlockTech(id)) return false;
    this.spend(node.cost);
    this.data.unlockedTech.push(id);
    return true;
  }

  getEffect(key: string): number {
    let value = 0;
    for (const id of this.data.unlockedTech) {
      const node = TECH_NODES.find(n => n.id === id);
      if (node && key in node.effect) value = node.effect[key];
    }
    return value;
  }

  // --- Topics ---

  isTopicCleared(id: string) { return this.data.clearedTopics.includes(id); }

  clearTopic(id: string, score: number) {
    if (!this.data.clearedTopics.includes(id)) {
      this.data.clearedTopics.push(id);
    }
    const best = this.data.bestScores[id] ?? 0;
    if (score > best) this.data.bestScores[id] = score;
  }

  isClusterUnlocked(clusterId: number): boolean {
    const cluster = CLUSTERS.find(c => c.id === clusterId);
    if (!cluster) return false;
    return this.data.clearedTopics.length >= cluster.requiredCleared;
  }

  getAvailableTopics(): TopicConfig[] {
    return TOPICS.filter(t => this.isClusterUnlocked(t.cluster));
  }

  // --- Consumers (Idle) ---

  getIdleRate(): number {
    let rate = 0;
    for (const c of this.data.consumers) {
      if (!c.assignedTopic) continue;
      const baseRate = c.level * c.partitions * 2; // msg/sec
      rate += baseRate;
    }
    const idleMult = this.getEffect('idleMultiplier') || 1;
    const effMult = this.getEffect('consumerEfficiency') || 1;
    const pipelineBonus = this.getPipelineMultiplier();
    return rate * idleMult * effMult * pipelineBonus;
  }

  getPipelineMultiplier(): number {
    return 1 + this.data.pipelines.length * 0.5;
  }

  calcIdleIncome() {
    const now = Date.now();
    const elapsed = (now - this.data.lastOnline) / 1000;
    if (elapsed > 0) {
      const earned = Math.floor(this.getIdleRate() * elapsed);
      if (earned > 0) this.addMessages(earned);
    }
    this.data.lastOnline = now;
  }

  // --- Consumer Machines ---

  buyConsumer(): boolean {
    const maxSlots = 3 + (this.getEffect('consumerSlots') || 0);
    if (this.data.consumers.length >= maxSlots) return false;
    const cost = { messages: 1000 * Math.pow(3, this.data.consumers.length), schemas: 0 };
    if (!this.spend(cost)) return false;
    this.data.consumers.push({
      id: `consumer-${Date.now()}`,
      level: 1,
      assignedTopic: null,
      partitions: 1,
    });
    return true;
  }

  upgradeConsumer(id: string): boolean {
    const c = this.data.consumers.find(c => c.id === id);
    if (!c || c.level >= 5) return false;
    const cost = { messages: 500 * Math.pow(2, c.level), schemas: c.level * 3 };
    if (!this.spend(cost)) return false;
    c.level++;
    return true;
  }

  assignConsumer(consumerId: string, topicId: string | null) {
    const c = this.data.consumers.find(c => c.id === consumerId);
    if (c) c.assignedTopic = topicId;
  }

  // --- Pipelines ---

  addPipeline(from: string, to: string): boolean {
    const exists = this.data.pipelines.some(p => p.fromTopic === from && p.toTopic === to);
    if (exists) return false;
    if (!this.isTopicCleared(from) || !this.isTopicCleared(to)) return false;
    const cost = { messages: 5000 * (this.data.pipelines.length + 1), schemas: 10 };
    if (!this.spend(cost)) return false;
    this.data.pipelines.push({ id: `pipe-${Date.now()}`, fromTopic: from, toTopic: to });
    return true;
  }
}

export const gameState = new GameState();
```

**Step 5: Create test src/state/__tests__/GameState.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../GameState';

// Mock localStorage
const store: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
});

describe('GameState', () => {
  let gs: GameState;

  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    gs = new GameState();
  });

  it('starts with default values', () => {
    expect(gs.data.messages).toBe(0);
    expect(gs.data.schemas).toBe(0);
    expect(gs.data.consumers).toHaveLength(1);
  });

  it('adds and spends currencies', () => {
    gs.addMessages(500);
    gs.addSchemas(10);
    expect(gs.canAfford({ messages: 500, schemas: 10 })).toBe(true);
    expect(gs.canAfford({ messages: 501, schemas: 0 })).toBe(false);
    expect(gs.spend({ messages: 200, schemas: 5 })).toBe(true);
    expect(gs.data.messages).toBe(300);
    expect(gs.data.schemas).toBe(5);
  });

  it('unlocks tech with prerequisites', () => {
    gs.addMessages(50000);
    gs.addSchemas(100);
    expect(gs.canUnlockTech('board-speed-2')).toBe(false); // needs board-speed-1
    expect(gs.unlockTech('board-speed-1')).toBe(true);
    expect(gs.isTechUnlocked('board-speed-1')).toBe(true);
    expect(gs.canUnlockTech('board-speed-2')).toBe(true);
  });

  it('clears topics and tracks best scores', () => {
    gs.clearTopic('hello-world', 1500);
    expect(gs.isTopicCleared('hello-world')).toBe(true);
    expect(gs.data.bestScores['hello-world']).toBe(1500);
    gs.clearTopic('hello-world', 1200);
    expect(gs.data.bestScores['hello-world']).toBe(1500); // keeps best
    gs.clearTopic('hello-world', 2000);
    expect(gs.data.bestScores['hello-world']).toBe(2000);
  });

  it('calculates cluster unlocks', () => {
    expect(gs.isClusterUnlocked(1)).toBe(true); // needs 0
    expect(gs.isClusterUnlocked(2)).toBe(false); // needs 3
    gs.clearTopic('hello-world', 100);
    gs.clearTopic('first-messages', 100);
    gs.clearTopic('basic-partitions', 100);
    expect(gs.isClusterUnlocked(2)).toBe(true);
  });

  it('calculates idle rate', () => {
    gs.data.consumers[0].assignedTopic = 'hello-world';
    gs.data.consumers[0].level = 2;
    gs.data.consumers[0].partitions = 2;
    // rate = level * partitions * 2 = 2 * 2 * 2 = 8
    expect(gs.getIdleRate()).toBe(8);
  });

  it('saves and loads', () => {
    gs.addMessages(999);
    gs.save();
    const gs2 = new GameState();
    expect(gs2.data.messages).toBe(999);
  });
});
```

**Step 6: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/state/ package.json
git commit -m "feat: game state, tech tree, topic data with tests"
```

---

## Milestone 2: Drift Run

### Task 4: Synthwave Corridor Generator

**Files:**
- Create: `src/drift/Corridor.ts`
- Create: `src/drift/SynthwaveShaders.ts`

**Step 1: Create src/drift/SynthwaveShaders.ts**

Custom shader for the retro grid floor and glowing walls:

```ts
import * as THREE from 'three';

export const gridFloorMaterial = () => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(0xff1493) },
    uColor2: { value: new THREE.Color(0x8b00ff) },
    uSpeed: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPos;
    void main() {
      vUv = uv;
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uSpeed;
    varying vec2 vUv;
    varying vec3 vPos;

    void main() {
      vec2 grid = abs(fract(vPos.xz * 0.5 - vec2(0.0, uTime * uSpeed)) - 0.5);
      float line = min(grid.x, grid.y);
      float gridLine = 1.0 - smoothstep(0.0, 0.05, line);
      vec3 color = mix(uColor1, uColor2, vUv.y);
      float fade = smoothstep(0.0, 0.5, vUv.y);
      gl_FragColor = vec4(color * gridLine * fade, gridLine * 0.8 + 0.05);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
});

export const wallMaterial = (side: 'left' | 'right') => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(side === 'left' ? 0xff69b4 : 0x00ffff) },
    uSpeed: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPos;
    void main() {
      vUv = uv;
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uSpeed;
    varying vec2 vUv;
    varying vec3 vPos;

    void main() {
      float hLine = abs(fract(vPos.y * 2.0) - 0.5);
      float vLine = abs(fract(vPos.z * 0.3 - uTime * uSpeed) - 0.5);
      float grid = 1.0 - smoothstep(0.0, 0.04, min(hLine, vLine));
      float glow = exp(-3.0 * vUv.x) * 0.3;
      vec3 col = uColor * (grid * 0.7 + glow);
      float alpha = grid * 0.6 + glow + 0.02;
      gl_FragColor = vec4(col, alpha);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
});

export const ceilingMaterial = () => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x4400aa) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;

    void main() {
      float pulse = sin(uTime * 0.5) * 0.1 + 0.2;
      gl_FragColor = vec4(uColor * pulse, 0.4);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
});
```

**Step 2: Create src/drift/Corridor.ts**

Procedurally generates corridor segments, handles pooling and scrolling:

```ts
import * as THREE from 'three';
import { gridFloorMaterial, wallMaterial, ceilingMaterial } from './SynthwaveShaders';

const SEGMENT_LENGTH = 50;
const CORRIDOR_WIDTH = 12;
const CORRIDOR_HEIGHT = 8;
const POOL_SIZE = 8;

export class Corridor {
  group = new THREE.Group();
  private segments: THREE.Group[] = [];
  private shaderMaterials: THREE.ShaderMaterial[] = [];
  private nextZ = 0;
  private speed = 10;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const seg = this.createSegment();
      seg.position.z = -i * SEGMENT_LENGTH;
      this.segments.push(seg);
      this.group.add(seg);
    }
    this.nextZ = -POOL_SIZE * SEGMENT_LENGTH;
  }

  private createSegment(): THREE.Group {
    const seg = new THREE.Group();

    // Floor
    const floorGeo = new THREE.PlaneGeometry(CORRIDOR_WIDTH, SEGMENT_LENGTH);
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
    leftWall.position.set(-CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, -SEGMENT_LENGTH / 2);
    seg.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, rightMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, -SEGMENT_LENGTH / 2);
    seg.add(rightWall);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(CORRIDOR_WIDTH, SEGMENT_LENGTH);
    const ceilMat = ceilingMaterial();
    this.shaderMaterials.push(ceilMat);
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, CORRIDOR_HEIGHT, -SEGMENT_LENGTH / 2);
    seg.add(ceil);

    // Edge glow strips (neon lines where wall meets floor)
    const stripGeo = new THREE.PlaneGeometry(SEGMENT_LENGTH, 0.1);
    const stripMatL = new THREE.MeshBasicMaterial({ color: 0xff69b4, transparent: true, opacity: 0.8 });
    const stripMatR = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    const stripL = new THREE.Mesh(stripGeo, stripMatL);
    stripL.rotation.y = Math.PI / 2;
    stripL.position.set(-CORRIDOR_WIDTH / 2, 0.05, -SEGMENT_LENGTH / 2);
    seg.add(stripL);
    const stripR = new THREE.Mesh(stripGeo, stripMatR);
    stripR.rotation.y = -Math.PI / 2;
    stripR.position.set(CORRIDOR_WIDTH / 2, 0.05, -SEGMENT_LENGTH / 2);
    seg.add(stripR);

    return seg;
  }

  setSpeed(s: number) { this.speed = s; }

  update(delta: number, elapsed: number) {
    // Update shader uniforms
    for (const mat of this.shaderMaterials) {
      mat.uniforms.uTime.value = elapsed;
      if (mat.uniforms.uSpeed) mat.uniforms.uSpeed.value = this.speed * 0.05;
    }

    // Move segments toward player and recycle
    for (const seg of this.segments) {
      seg.position.z += this.speed * delta;
      if (seg.position.z > SEGMENT_LENGTH) {
        seg.position.z = this.nextZ;
        this.nextZ -= SEGMENT_LENGTH;
      }
    }
  }

  get width() { return CORRIDOR_WIDTH; }
  get height() { return CORRIDOR_HEIGHT; }
  get segmentLength() { return SEGMENT_LENGTH; }
}
```

**Step 3: Verify visually**

Temporarily wire corridor into main.ts, run `npx vite`, confirm:
- Scrolling synthwave grid floor (pink/purple)
- Glowing walls (pink left, cyan right)
- Neon edge strips
- Dark ceiling with pulse

**Step 4: Commit**

```bash
git add src/drift/
git commit -m "feat: procedural synthwave corridor with custom shaders"
```

---

### Task 5: Hoverboard Player Controller

**Files:**
- Create: `src/drift/Player.ts`

**Step 1: Create src/drift/Player.ts**

```ts
import * as THREE from 'three';
import { input } from '../engine/SceneManager';

const LANE_WIDTH = 3;
const GRAVITY = -25;
const JUMP_FORCE = 12;
const BOARD_TILT_SPEED = 8;
const LANE_SWITCH_SPEED = 12;

export class Player {
  group = new THREE.Group();
  private board: THREE.Mesh;
  private targetLane = 0;
  private currentX = 0;
  private velocityY = 0;
  private isGrounded = true;
  private maxLanes = 1;      // lanes to each side: 0=center only, 1=3 lanes, 2=5 lanes
  private boostActive = false;
  private boostTimer = 0;
  private boardTilt = 0;
  private collectRadius = 1.5;
  private canAirControl = false;

  camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    // Hoverboard mesh
    const boardGeo = new THREE.BoxGeometry(1.2, 0.08, 2.5);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0xff69b4,
      emissive: 0xff69b4,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.board = new THREE.Mesh(boardGeo, boardMat);
    this.board.position.y = -0.5;
    this.board.position.z = -1;
    this.group.add(this.board);

    // Glow trail under board
    const trailGeo = new THREE.PlaneGeometry(0.6, 3);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xff69b4,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.rotation.x = -Math.PI / 2;
    trail.position.set(0, -0.55, 0.5);
    this.group.add(trail);

    this.group.position.y = 1;
  }

  setMaxLanes(n: number) { this.maxLanes = n; }
  setCollectRadius(r: number) { this.collectRadius = r; }
  setAirControl(v: boolean) { this.canAirControl = v; }

  activateBoost(duration: number) {
    this.boostActive = true;
    this.boostTimer = duration;
  }

  get position() { return this.group.position; }
  get isBoost() { return this.boostActive; }
  get radius() { return this.collectRadius; }

  update(delta: number) {
    // Lane switching
    const canSwitch = this.isGrounded || this.canAirControl;
    if (canSwitch) {
      if (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft')) {
        this.targetLane = Math.max(-this.maxLanes, this.targetLane - 1);
      }
      if (input.wasPressed('KeyD') || input.wasPressed('ArrowRight')) {
        this.targetLane = Math.min(this.maxLanes, this.targetLane + 1);
      }
    }

    // Smooth lane movement
    const targetX = this.targetLane * LANE_WIDTH;
    this.currentX += (targetX - this.currentX) * Math.min(1, LANE_SWITCH_SPEED * delta);
    this.group.position.x = this.currentX;

    // Jump
    if (input.wasPressed('Space') && this.isGrounded) {
      this.velocityY = JUMP_FORCE;
      this.isGrounded = false;
    }

    // Gravity
    if (!this.isGrounded) {
      this.velocityY += GRAVITY * delta;
      this.group.position.y += this.velocityY * delta;
      if (this.group.position.y <= 1) {
        this.group.position.y = 1;
        this.velocityY = 0;
        this.isGrounded = true;
      }
    }

    // Board tilt when switching lanes
    const tiltTarget = (targetX - this.currentX) * 0.3;
    this.boardTilt += (tiltTarget - this.boardTilt) * Math.min(1, BOARD_TILT_SPEED * delta);
    this.board.rotation.z = -this.boardTilt;

    // Hover bob
    this.board.position.y = -0.5 + Math.sin(Date.now() * 0.005) * 0.05;

    // Boost timer
    if (this.boostActive) {
      this.boostTimer -= delta;
      if (this.boostTimer <= 0) this.boostActive = false;
    }

    // Camera follows player
    this.camera.position.x = this.currentX;
    this.camera.position.y = this.group.position.y + 1.5;
  }
}
```

**Step 2: Verify**

Wire into scene, run `npx vite`:
- Board visible below camera
- A/D switches lanes smoothly with tilt
- Space jumps with gravity
- Board hovers/bobs

**Step 3: Commit**

```bash
git add src/drift/Player.ts
git commit -m "feat: hoverboard player controller with lanes, jump, boost"
```

---

### Task 6: Collectibles & Obstacles

**Files:**
- Create: `src/drift/Collectibles.ts`
- Create: `src/drift/ObstaclePool.ts`

**Step 1: Create src/drift/Collectibles.ts**

Manages spawning, movement, and collection detection for all message types:

```ts
import * as THREE from 'three';

export type CollectibleType = 'message' | 'schema' | 'poison-pill' | 'tombstone';

interface Collectible {
  mesh: THREE.Mesh;
  type: CollectibleType;
  value: number;
  active: boolean;
  retentionTimer: number;    // -1 = no retention
  retentionMax: number;
}

const COLORS: Record<CollectibleType, { color: number; emissive: number }> = {
  'message': { color: 0xff69b4, emissive: 0xff1493 },
  'schema': { color: 0xffd700, emissive: 0xffaa00 },
  'poison-pill': { color: 0xff0000, emissive: 0xaa0000 },
  'tombstone': { color: 0x111111, emissive: 0x000000 },
};

const GEOMETRIES: Record<CollectibleType, () => THREE.BufferGeometry> = {
  'message': () => new THREE.BoxGeometry(0.6, 0.6, 0.6),
  'schema': () => new THREE.OctahedronGeometry(0.5),
  'poison-pill': () => new THREE.BoxGeometry(0.7, 0.7, 0.7),
  'tombstone': () => new THREE.BoxGeometry(0.4, 0.8, 0.2),
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

  constructor(poolSize = 100) {
    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xff69b4, emissive: 0xff1493, emissiveIntensity: 0.4 })
      );
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, type: 'message', value: 1, active: false, retentionTimer: -1, retentionMax: -1 });
    }
  }

  configure(opts: { speed: number; density: number; lanes: number; schemaRate: number; poisonRate: number }) {
    this.speed = opts.speed;
    this.spawnInterval = 1 / (opts.density * 0.1);
    this.maxLanes = opts.lanes;
    this.schemaDropRate = opts.schemaRate;
    this.poisonRate = opts.poisonRate;
  }

  private spawn(type: CollectibleType, lane: number, z: number, value: number, retention = -1) {
    const item = this.pool.find(c => !c.active);
    if (!item) return;

    item.type = type;
    item.value = value;
    item.active = true;
    item.retentionTimer = retention;
    item.retentionMax = retention;

    // Update geometry and material
    item.mesh.geometry.dispose();
    item.mesh.geometry = GEOMETRIES[type]();
    const mat = item.mesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(COLORS[type].color);
    mat.emissive.setHex(COLORS[type].emissive);
    mat.emissiveIntensity = type === 'schema' ? 0.8 : 0.4;

    item.mesh.position.set(
      lane * this.laneWidth,
      type === 'tombstone' ? 0.4 : 1.0 + Math.random() * 2,
      z
    );
    item.mesh.visible = true;
    item.mesh.scale.setScalar(1);
  }

  update(delta: number, elapsed: number) {
    // Spawn new collectibles
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      const lane = Math.floor(Math.random() * (this.maxLanes * 2 + 1)) - this.maxLanes;
      const roll = Math.random();
      if (roll < this.poisonRate) {
        this.spawn('poison-pill', lane, -200, 0);
      } else if (roll < this.poisonRate + 0.02 * this.schemaDropRate) {
        this.spawn('schema', lane, -200, 1, 8);
      } else if (roll < this.poisonRate + 0.05) {
        this.spawn('tombstone', lane, -200, 0);
      } else {
        this.spawn('message', lane, -200, 1);
      }
    }

    // Move and update active collectibles
    for (const item of this.pool) {
      if (!item.active) continue;

      item.mesh.position.z += this.speed * delta;
      item.mesh.rotation.y += delta * 2;

      // Retention fade
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

      // Remove if past player
      if (item.mesh.position.z > 10) {
        item.active = false;
        item.mesh.visible = false;
      }
    }
  }

  checkCollisions(playerPos: THREE.Vector3, radius: number): { type: CollectibleType; value: number }[] {
    const collected: { type: CollectibleType; value: number }[] = [];
    for (const item of this.pool) {
      if (!item.active) continue;
      const dist = playerPos.distanceTo(item.mesh.position);
      if (dist < radius) {
        collected.push({ type: item.type, value: item.value });
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
```

**Step 2: Create src/drift/ObstaclePool.ts**

ISR rings, compaction zones, checkpoints, partition forks:

```ts
import * as THREE from 'three';

export type ObstacleType = 'isr-ring' | 'checkpoint' | 'compaction-zone';

interface Obstacle {
  mesh: THREE.Object3D;
  type: ObstacleType;
  active: boolean;
}

export class ObstacleManager {
  group = new THREE.Group();
  private obstacles: Obstacle[] = [];
  private speed = 10;

  constructor() {
    // Pre-create pool of each type
    for (let i = 0; i < 10; i++) this.createRing('isr-ring', 0xffd700);
    for (let i = 0; i < 5; i++) this.createRing('checkpoint', 0x00ff88);
    for (let i = 0; i < 5; i++) this.createZone('compaction-zone');
  }

  private createRing(type: 'isr-ring' | 'checkpoint', color: number) {
    const geo = new THREE.TorusGeometry(3, 0.15, 8, 32);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.visible = false;
    this.group.add(mesh);
    this.obstacles.push({ mesh, type, active: false });
  }

  private createZone(type: ObstacleType) {
    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(12, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0x8800ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.01;
    group.add(plane);
    group.visible = false;
    this.group.add(group);
    this.obstacles.push({ mesh: group, type, active: false });
  }

  setSpeed(s: number) { this.speed = s; }

  spawnAt(type: ObstacleType, z: number) {
    const obs = this.obstacles.find(o => o.type === type && !o.active);
    if (!obs) return;
    obs.active = true;
    obs.mesh.visible = true;
    obs.mesh.position.z = z;
  }

  update(delta: number) {
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      obs.mesh.position.z += this.speed * delta;
      if (obs.mesh.position.z > 15) {
        obs.active = false;
        obs.mesh.visible = false;
      }
    }
  }

  checkPlayerInside(playerPos: THREE.Vector3): ObstacleType[] {
    const types: ObstacleType[] = [];
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      const dz = Math.abs(playerPos.z - obs.mesh.position.z);
      if (dz < 2) types.push(obs.type);
    }
    return types;
  }

  reset() {
    for (const obs of this.obstacles) {
      obs.active = false;
      obs.mesh.visible = false;
    }
  }
}
```

**Step 3: Verify visually**

Wire into scene. Confirm cubes spawn, rotate, approach, are collectable.

**Step 4: Commit**

```bash
git add src/drift/Collectibles.ts src/drift/ObstaclePool.ts
git commit -m "feat: collectibles and obstacles with pooling and collision"
```

---

### Task 7: Lag Wave

**Files:**
- Create: `src/drift/LagWave.ts`

**Step 1: Create src/drift/LagWave.ts**

```ts
import * as THREE from 'three';

export class LagWave {
  group = new THREE.Group();
  private wall: THREE.Mesh;
  private distance = 80;      // distance behind player
  private acceleration: number;
  private currentSpeed = 0;
  private baseSpeed = 0;
  private intensity = 0;      // 0-1, increases as wave approaches

  constructor(corridorWidth: number, corridorHeight: number, accel: number) {
    this.acceleration = accel;

    const geo = new THREE.PlaneGeometry(corridorWidth * 1.2, corridorHeight * 1.2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        varying vec2 vUv;

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float wave = sin(dist * 20.0 - uTime * 3.0) * 0.5 + 0.5;
          float noise = fract(sin(dot(vUv * uTime, vec2(12.9898, 78.233))) * 43758.5453);

          vec3 purple = vec3(0.5, 0.0, 0.8);
          vec3 magenta = vec3(0.9, 0.0, 0.5);
          vec3 color = mix(purple, magenta, wave + noise * 0.2);

          float alpha = (0.6 + uIntensity * 0.4) * (1.0 - dist * 0.8);
          float glitch = step(0.97, noise) * uIntensity;
          color += vec3(glitch);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.wall = new THREE.Mesh(geo, mat);
    this.wall.position.set(0, corridorHeight / 2, this.distance);
    this.group.add(this.wall);

    // Fog particles in front of wall
    const particleCount = 200;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * corridorWidth;
      positions[i * 3 + 1] = Math.random() * corridorHeight;
      positions[i * 3 + 2] = Math.random() * -20;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x8800aa,
      size: 0.3,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    this.group.add(particles);
  }

  setBaseSpeed(s: number) { this.baseSpeed = s; }

  update(delta: number, elapsed: number) {
    // Wave accelerates over time
    this.currentSpeed += this.acceleration * delta;
    const catchUp = this.currentSpeed - this.baseSpeed;
    if (catchUp > 0) {
      this.distance -= catchUp * delta;
    }

    this.intensity = Math.max(0, Math.min(1, 1 - this.distance / 80));
    this.wall.position.z = this.distance;

    const mat = this.wall.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = elapsed;
    mat.uniforms.uIntensity.value = this.intensity;
  }

  get distanceBehind() { return this.distance; }
  get dangerLevel() { return this.intensity; }
  get caught() { return this.distance <= 0; }

  reset() {
    this.distance = 80;
    this.currentSpeed = 0;
    this.intensity = 0;
  }
}
```

**Step 2: Verify**

Purple/magenta wall behind player, slowly approaching, getting more intense.

**Step 3: Commit**

```bash
git add src/drift/LagWave.ts
git commit -m "feat: lag wave with shader, particles, and acceleration"
```

---

### Task 8: HUD Overlay

**Files:**
- Create: `src/ui/HUD.ts`
- Create: `src/ui/hud.css`

**Step 1: Create src/ui/hud.css**

```css
.hud {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  font-family: 'Courier New', monospace;
  color: #ff69b4;
  z-index: 10;
}

.hud-top {
  display: flex;
  justify-content: space-between;
  padding: 20px 30px;
  font-size: 18px;
  text-shadow: 0 0 10px #ff1493, 0 0 20px #ff1493;
}

.hud-bottom {
  position: absolute;
  bottom: 20px;
  left: 0; right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 30px;
  font-size: 14px;
}

.hud-center {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 48px;
  text-shadow: 0 0 20px #ff1493;
  opacity: 0;
  transition: opacity 0.3s;
}

.hud-center.visible { opacity: 1; }

.lag-bar {
  position: absolute;
  bottom: 60px;
  left: 30px; right: 30px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.lag-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b00ff, #ff0066);
  border-radius: 2px;
  transition: width 0.1s;
  box-shadow: 0 0 10px #8b00ff;
}

.combo-text {
  font-size: 24px;
  color: #ffd700;
  text-shadow: 0 0 15px #ffaa00;
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s;
  transform: scale(1);
}

.combo-text.pop {
  opacity: 1;
  transform: scale(1.3);
}

.speed-lines {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(255, 105, 180, 0.05) 100%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}
```

**Step 2: Create src/ui/HUD.ts**

```ts
export class HUD {
  private container: HTMLDivElement;
  private msgEl: HTMLSpanElement;
  private schemaEl: HTMLSpanElement;
  private speedEl: HTMLSpanElement;
  private comboEl: HTMLDivElement;
  private centerEl: HTMLDivElement;
  private lagFill: HTMLDivElement;
  private speedLines: HTMLDivElement;
  private powerUpEl: HTMLSpanElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'hud';
    this.container.innerHTML = `
      <div class="hud-top">
        <span class="hud-messages">MESSAGES: <span id="hud-msg">0</span></span>
        <span class="hud-combo combo-text" id="hud-combo"></span>
        <span class="hud-speed">SPEED: <span id="hud-speed">x1.0</span></span>
      </div>
      <div class="hud-center" id="hud-center"></div>
      <div class="lag-bar"><div class="lag-bar-fill" id="hud-lag"></div></div>
      <div class="hud-bottom">
        <span>SCHEMAS: <span id="hud-schemas">0</span></span>
        <span id="hud-powerup"></span>
      </div>
      <div class="speed-lines" id="hud-speedlines"></div>
    `;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/src/ui/hud.css';
    document.head.appendChild(link);

    document.body.appendChild(this.container);

    this.msgEl = this.container.querySelector('#hud-msg')!;
    this.schemaEl = this.container.querySelector('#hud-schemas')!;
    this.speedEl = this.container.querySelector('#hud-speed')!;
    this.comboEl = this.container.querySelector('#hud-combo')!;
    this.centerEl = this.container.querySelector('#hud-center')!;
    this.lagFill = this.container.querySelector('#hud-lag')!;
    this.speedLines = this.container.querySelector('#hud-speedlines')!;
    this.powerUpEl = this.container.querySelector('#hud-powerup')!;
  }

  updateMessages(n: number) { this.msgEl.textContent = n.toLocaleString(); }
  updateSchemas(n: number) { this.schemaEl.textContent = n.toLocaleString(); }
  updateSpeed(mult: number) { this.speedEl.textContent = `x${mult.toFixed(1)}`; }
  updateLag(pct: number) { this.lagFill.style.width = `${Math.min(100, pct * 100)}%`; }
  updatePowerUp(name: string | null) { this.powerUpEl.textContent = name ? `[E] ${name}` : ''; }

  showCombo(n: number) {
    this.comboEl.textContent = `x${n} COMBO`;
    this.comboEl.classList.add('pop');
    setTimeout(() => this.comboEl.classList.remove('pop'), 300);
  }

  showCenter(text: string, duration = 2000) {
    this.centerEl.textContent = text;
    this.centerEl.classList.add('visible');
    setTimeout(() => this.centerEl.classList.remove('visible'), duration);
  }

  setSpeedLines(intensity: number) {
    this.speedLines.style.opacity = String(Math.min(1, intensity));
  }

  show() { this.container.style.display = ''; }
  hide() { this.container.style.display = 'none'; }

  destroy() {
    this.container.remove();
  }
}
```

**Step 3: Commit**

```bash
git add src/ui/
git commit -m "feat: HUD overlay with messages, lag bar, combos, speed lines"
```

---

### Task 9: Drift Run Scene (Full Assembly)

**Files:**
- Create: `src/drift/DriftScene.ts`
- Modify: `src/main.ts`

**Step 1: Create src/drift/DriftScene.ts**

Assembles all drift components into a playable scene:

```ts
import * as THREE from 'three';
import type { GameScene } from '../engine/SceneManager';
import { input } from '../engine/SceneManager';
import { Corridor } from './Corridor';
import { Player } from './Player';
import { CollectibleManager } from './Collectibles';
import { ObstacleManager } from './ObstaclePool';
import { LagWave } from './LagWave';
import { HUD } from '../ui/HUD';
import { gameState } from '../state/GameState';
import { TOPICS, type TopicConfig } from '../state/TopicData';

export class DriftScene implements GameScene {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private corridor: Corridor;
  private player: Player;
  private collectibles: CollectibleManager;
  private obstacles: ObstacleManager;
  private lagWave: LagWave;
  private hud: HUD;

  private topicConfig: TopicConfig | null = null;
  private runMessages = 0;
  private runSchemas = 0;
  private runDistance = 0;
  private combo = 0;
  private comboTimer = 0;
  private isRunning = false;
  private isPaused = false;
  private speed = 10;

  private onRunEnd: ((cleared: boolean) => void) | null = null;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 2.5, 0);
    this.camera.lookAt(0, 2, -100);

    this.scene.background = new THREE.Color(0x0a0010);
    this.scene.fog = new THREE.FogExp2(0x0a0010, 0.008);

    // Lighting
    const ambient = new THREE.AmbientLight(0x6633aa, 0.4);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xff69b4, 0.3);
    dirLight.position.set(0, 10, -10);
    this.scene.add(dirLight);

    // Vaporwave sun backdrop
    const sunGeo = new THREE.CircleGeometry(30, 32);
    const sunMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float y = vUv.y;
          vec3 top = vec3(1.0, 0.4, 0.1);
          vec3 bot = vec3(0.8, 0.0, 0.5);
          vec3 col = mix(bot, top, y);
          // Horizontal lines
          float lines = step(0.5, fract(y * 15.0 - uTime * 0.2));
          col *= 0.7 + lines * 0.3;
          float circle = 1.0 - smoothstep(0.45, 0.5, length(vUv - 0.5));
          gl_FragColor = vec4(col, circle * 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(0, 15, -250);
    this.scene.add(sun);

    this.corridor = new Corridor();
    this.scene.add(this.corridor.group);

    this.player = new Player(this.camera);
    this.scene.add(this.player.group);

    this.collectibles = new CollectibleManager(150);
    this.scene.add(this.collectibles.group);

    this.obstacles = new ObstacleManager();
    this.scene.add(this.obstacles.group);

    this.lagWave = new LagWave(this.corridor.width, this.corridor.height, 0.2);
    this.scene.add(this.lagWave.group);

    this.hud = new HUD();
    this.hud.hide();
  }

  startRun(topicId: string, onEnd: (cleared: boolean) => void) {
    this.topicConfig = TOPICS.find(t => t.id === topicId) ?? TOPICS[0];
    this.onRunEnd = onEnd;
    this.speed = this.topicConfig.speed;
    this.runMessages = 0;
    this.runSchemas = 0;
    this.runDistance = 0;
    this.combo = 0;
    this.isRunning = true;

    // Apply tech tree effects
    const speedMult = gameState.getEffect('speedMultiplier') || 1;
    this.speed *= speedMult;

    const extraLanes = gameState.getEffect('extraLanes') || 0;
    const baseLanes = Math.floor(this.topicConfig.partitions / 2);
    this.player.setMaxLanes(baseLanes + extraLanes);

    const collectRadius = gameState.getEffect('collectRadius') || 1.5;
    this.player.setCollectRadius(collectRadius);
    this.player.setAirControl(!!gameState.getEffect('airControl'));

    this.corridor.setSpeed(this.speed);
    this.collectibles.configure({
      speed: this.speed,
      density: this.topicConfig.messageDensity,
      lanes: baseLanes,
      schemaRate: gameState.getEffect('schemaDropRate') || 1,
      poisonRate: 0.1,
    });
    this.obstacles.setSpeed(this.speed);
    this.lagWave.setBaseSpeed(this.speed);
    this.lagWave.reset();

    this.hud.show();
    this.hud.showCenter(this.topicConfig.name, 2000);
  }

  private endRun(cleared: boolean) {
    this.isRunning = false;

    // Apply rewards
    const replicationMult = gameState.getEffect('replicationReward') || 1;
    const msgReward = cleared
      ? Math.floor(this.runMessages * replicationMult)
      : Math.floor(this.runMessages * 0.5);
    const schemaReward = cleared ? this.runSchemas : Math.floor(this.runSchemas * 0.3);

    gameState.addMessages(msgReward);
    gameState.addSchemas(schemaReward);

    if (cleared) {
      gameState.clearTopic(this.topicConfig!.id, this.runMessages);
      this.hud.showCenter('TOPIC CLEARED!', 3000);
    } else {
      this.hud.showCenter('LAG CAUGHT YOU', 3000);
    }

    gameState.save();
    setTimeout(() => {
      this.hud.hide();
      this.collectibles.reset();
      this.obstacles.reset();
      this.onRunEnd?.(cleared);
    }, 3000);
  }

  update(delta: number, elapsed: number) {
    if (!this.isRunning || this.isPaused) return;

    this.corridor.update(delta, elapsed);
    this.player.update(delta);
    this.collectibles.update(delta, elapsed);
    this.obstacles.update(delta);
    this.lagWave.update(delta, elapsed);

    // Boost
    if (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) {
      this.speed = (this.topicConfig?.speed ?? 10) * 1.8;
      this.corridor.setSpeed(this.speed);
      this.hud.setSpeedLines(0.5);
    } else {
      this.speed = this.topicConfig?.speed ?? 10;
      const speedMult = gameState.getEffect('speedMultiplier') || 1;
      this.speed *= speedMult;
      this.corridor.setSpeed(this.speed);
      this.hud.setSpeedLines(0);
    }

    // Track distance
    this.runDistance += this.speed * delta;

    // Check if topic completed
    if (this.topicConfig && this.runDistance >= this.topicConfig.length) {
      this.endRun(true);
      return;
    }

    // Check lag
    if (this.lagWave.caught) {
      this.endRun(false);
      return;
    }

    // Collect messages
    const collected = this.collectibles.checkCollisions(this.player.position, this.player.radius);
    for (const item of collected) {
      if (item.type === 'message') {
        const valueMult = gameState.getEffect('allMessageValue') || 1;
        this.runMessages += Math.ceil(item.value * valueMult);
        this.combo++;
        this.comboTimer = 2;
      } else if (item.type === 'schema') {
        const schemaMult = gameState.getEffect('schemaValue') || 1;
        this.runSchemas += Math.ceil(item.value * schemaMult);
        this.combo++;
        this.comboTimer = 2;
      } else if (item.type === 'poison-pill') {
        this.combo = 0;
        this.speed *= 0.5;
        setTimeout(() => { this.speed = this.topicConfig?.speed ?? 10; }, 2000);
      }
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Check obstacle effects
    const inside = this.obstacles.checkPlayerInside(this.player.position);
    for (const type of inside) {
      if (type === 'isr-ring') {
        this.combo += 2;
        this.comboTimer = 3;
      }
    }

    // Update HUD
    this.hud.updateMessages(this.runMessages);
    this.hud.updateSchemas(this.runSchemas);
    this.hud.updateSpeed(this.speed / (this.topicConfig?.speed ?? 10));
    this.hud.updateLag(this.lagWave.dangerLevel);
    if (this.combo > 1) this.hud.showCombo(this.combo);

    input.endFrame();
  }

  onResize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onEnter() {}
  onExit() { this.hud.hide(); }
}
```

**Step 2: Update src/main.ts to wire DriftScene**

```ts
import { Engine } from './engine/SceneManager';
import { DriftScene } from './drift/DriftScene';

const container = document.getElementById('game')!;
const engine = new Engine(container);

const driftScene = new DriftScene();
engine.register('drift', driftScene);

// Temporary: start a run directly on first topic
engine.switchTo('drift');
driftScene.startRun('hello-world', (cleared) => {
  console.log(cleared ? 'CLEARED!' : 'FAILED');
  // Restart for testing
  setTimeout(() => driftScene.startRun('hello-world', () => {}), 1000);
});

engine.start();
```

**Step 3: Verify**

Run: `npx vite`
Expected: Full drift run — corridor scrolling, hoverboard with lanes, messages spawning, lag wave approaching, HUD showing stats.

**Step 4: Commit**

```bash
git add src/drift/DriftScene.ts src/main.ts
git commit -m "feat: complete drift run scene assembly with all mechanics"
```

---

## Milestone 3: Post-Processing & Polish

### Task 10: Post-Processing Pipeline

**Files:**
- Create: `src/engine/PostProcessing.ts`
- Modify: `src/engine/Engine.ts`

**Step 1: Create src/engine/PostProcessing.ts**

```ts
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      float offset = uIntensity * 0.01;
      float r = texture2D(tDiffuse, vUv + vec2(offset, 0.0)).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - vec2(offset, 0.0)).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

const ScanlinesShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uIntensity: { value: 0.08 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float scanline = sin(vUv.y * uResolution.y * 1.5) * uIntensity;
      float vignette = 1.0 - smoothstep(0.5, 1.4, length(vUv - 0.5) * 2.0);
      color.rgb -= scanline;
      color.rgb *= vignette;
      gl_FragColor = color;
    }
  `,
};

export class PostProcessing {
  composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private chromaPass: ShaderPass;
  private scanlinePass: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2,   // strength
      0.4,   // radius
      0.85   // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.chromaPass = new ShaderPass(ChromaticAberrationShader);
    this.composer.addPass(this.chromaPass);

    this.scanlinePass = new ShaderPass(ScanlinesShader);
    this.composer.addPass(this.scanlinePass);
  }

  setChromaticAberration(intensity: number) {
    this.chromaPass.uniforms.uIntensity.value = intensity;
  }

  setBloomStrength(s: number) {
    this.bloomPass.strength = s;
  }

  resize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.scanlinePass.uniforms.uResolution.value.set(w, h);
  }

  render() {
    this.composer.render();
  }
}
```

**Step 2: Integrate into Engine.ts**

Modify the render loop to use PostProcessing composer instead of raw renderer when post-processing is active. Add a `setPostProcessing` method to Engine.

**Step 3: Wire chromatic aberration to lag intensity in DriftScene**

```ts
// In DriftScene.update():
this.postProcessing?.setChromaticAberration(this.lagWave.dangerLevel * 3);
```

**Step 4: Verify**

Run: `npx vite`
Expected: Bloom on all emissive objects, scanlines visible, chromatic aberration increases as lag approaches.

**Step 5: Commit**

```bash
git add src/engine/PostProcessing.ts src/engine/Engine.ts
git commit -m "feat: post-processing pipeline with bloom, chromatic aberration, scanlines"
```

---

### Task 11: Particle Systems

**Files:**
- Create: `src/effects/Particles.ts`

**Step 1: Create src/effects/Particles.ts**

Data particles flowing on corridor walls, collect burst particles, speed lines:

```ts
import * as THREE from 'three';

export class DataParticles {
  points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private count: number;

  constructor(count = 500, corridorWidth = 12, corridorHeight = 8) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      this.positions[i * 3] = side * (corridorWidth / 2 - 0.5 + Math.random() * 0.5);
      this.positions[i * 3 + 1] = Math.random() * corridorHeight;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      this.velocities[i * 3] = 0;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      this.velocities[i * 3 + 2] = 2 + Math.random() * 3;
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
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * delta;
      this.positions[i * 3 + 2] += speed * delta;
      if (this.positions[i * 3 + 2] > 20) {
        this.positions[i * 3 + 2] = -200;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export class CollectBurst {
  private particles: THREE.Points[] = [];
  private pool: { points: THREE.Points; life: number; active: boolean }[] = [];

  constructor(scene: THREE.Scene, poolSize = 20) {
    for (let i = 0; i < poolSize; i++) {
      const count = 15;
      const positions = new Float32Array(count * 3);
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
      this.pool.push({ points, life: 0, active: false });
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

    const pos = p.points.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    p.points.geometry.attributes.position.needsUpdate = true;
  }

  update(delta: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= delta;
      const scale = p.life / 0.5;
      (p.points.material as THREE.PointsMaterial).opacity = scale;
      p.points.scale.setScalar(1 + (1 - scale) * 3);
      if (p.life <= 0) {
        p.active = false;
        p.points.visible = false;
      }
    }
  }
}
```

**Step 2: Integrate DataParticles into DriftScene, emit CollectBurst on message collection**

**Step 3: Verify**

Particles flowing on corridor walls, burst effects on collect.

**Step 4: Commit**

```bash
git add src/effects/
git commit -m "feat: data particles and collect burst effects"
```

---

## Milestone 4: Broker Hub

### Task 12: Hub Room Geometry & Ambiance

**Files:**
- Create: `src/hub/HubScene.ts`
- Create: `src/hub/HubRoom.ts`

**Step 1: Create src/hub/HubRoom.ts**

The physical room: retro grid floor, data cascade walls, vaporwave sunset windows, ambient lighting:

```ts
import * as THREE from 'three';

export class HubRoom {
  group = new THREE.Group();
  private shaderMaterials: THREE.ShaderMaterial[] = [];

  constructor() {
    const ROOM_W = 30;
    const ROOM_D = 40;
    const ROOM_H = 10;

    // Floor — retro grid
    const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
    const floorMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x8b00ff) } },
      vertexShader: `varying vec2 vUv; varying vec3 vPos; void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor; varying vec3 vPos;
        void main() {
          vec2 grid = abs(fract(vPos.xz * 0.3) - 0.5);
          float line = 1.0 - smoothstep(0.0, 0.03, min(grid.x, grid.y));
          float pulse = sin(uTime * 0.3) * 0.1 + 0.3;
          gl_FragColor = vec4(uColor * line * pulse, line * 0.5 + 0.05);
        }`,
      transparent: true,
    });
    this.shaderMaterials.push(floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // Walls — dark with data cascade
    const wallMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime; varying vec2 vUv;
        void main() {
          float col = fract(vUv.x * 30.0);
          float drop = fract(vUv.y - uTime * (0.3 + col * 0.2));
          float char = step(0.95, fract(sin(floor(vUv.x * 30.0) * 127.1 + floor(drop * 20.0) * 311.7) * 43758.5453));
          vec3 color = vec3(0.9, 0.2, 0.6) * char * 0.3;
          float fade = smoothstep(0.0, 0.3, drop) * smoothstep(1.0, 0.7, drop);
          gl_FragColor = vec4(color * fade, char * fade * 0.4 + 0.02);
        }`,
      transparent: true, side: THREE.DoubleSide,
    });
    this.shaderMaterials.push(wallMat);

    // 4 walls
    const wallPositions = [
      { pos: [0, ROOM_H / 2, -ROOM_D / 2], rot: [0, 0, 0], size: [ROOM_W, ROOM_H] },
      { pos: [0, ROOM_H / 2, ROOM_D / 2], rot: [0, Math.PI, 0], size: [ROOM_W, ROOM_H] },
      { pos: [-ROOM_W / 2, ROOM_H / 2, 0], rot: [0, Math.PI / 2, 0], size: [ROOM_D, ROOM_H] },
      { pos: [ROOM_W / 2, ROOM_H / 2, 0], rot: [0, -Math.PI / 2, 0], size: [ROOM_D, ROOM_H] },
    ];

    for (const w of wallPositions) {
      const geo = new THREE.PlaneGeometry(w.size[0], w.size[1]);
      const wall = new THREE.Mesh(geo, wallMat);
      wall.position.set(w.pos[0] as number, w.pos[1] as number, w.pos[2] as number);
      wall.rotation.set(w.rot[0] as number, w.rot[1] as number, w.rot[2] as number);
      this.group.add(wall);
    }

    // Window with vaporwave sunset (back wall cutout illusion)
    const sunGeo = new THREE.PlaneGeometry(12, 6);
    const sunMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime; varying vec2 vUv;
        void main() {
          vec3 sky = mix(vec3(0.1, 0.0, 0.3), vec3(1.0, 0.3, 0.1), vUv.y);
          float sun = 1.0 - smoothstep(0.15, 0.18, length(vUv - vec2(0.5, 0.6)));
          vec3 sunCol = vec3(1.0, 0.6, 0.2) * sun;
          float lines = step(0.5, fract((vUv.y - 0.4) * 20.0 - uTime * 0.1)) * sun * 0.3;
          gl_FragColor = vec4(sky + sunCol - lines, 1.0);
        }`,
      side: THREE.DoubleSide,
    });
    this.shaderMaterials.push(sunMat);
    const sunWindow = new THREE.Mesh(sunGeo, sunMat);
    sunWindow.position.set(0, 5, -ROOM_D / 2 + 0.1);
    this.group.add(sunWindow);

    // Ambient lighting
    this.group.add(new THREE.AmbientLight(0x6633aa, 0.3));
    const pointLight1 = new THREE.PointLight(0xff69b4, 1, 20);
    pointLight1.position.set(0, 8, 0);
    this.group.add(pointLight1);
    const pointLight2 = new THREE.PointLight(0x00ffff, 0.5, 15);
    pointLight2.position.set(-10, 5, -10);
    this.group.add(pointLight2);
    const pointLight3 = new THREE.PointLight(0x8b00ff, 0.5, 15);
    pointLight3.position.set(10, 5, 10);
    this.group.add(pointLight3);
  }

  update(elapsed: number) {
    for (const mat of this.shaderMaterials) {
      mat.uniforms.uTime.value = elapsed;
    }
  }
}
```

**Step 2: Create src/hub/HubScene.ts (skeleton)**

```ts
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { GameScene } from '../engine/SceneManager';
import { input } from '../engine/SceneManager';
import { HubRoom } from './HubRoom';

export class HubScene implements GameScene {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private controls: PointerLockControls;
  private room: HubRoom;
  private moveSpeed = 8;
  private velocity = new THREE.Vector3();

  private onLaunchRun: ((topicId: string) => void) | null = null;

  constructor(canvas: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 2, 10);

    this.scene.background = new THREE.Color(0x050008);
    this.scene.fog = new THREE.FogExp2(0x050008, 0.02);

    this.controls = new PointerLockControls(this.camera, canvas);
    canvas.addEventListener('click', () => this.controls.lock());

    this.room = new HubRoom();
    this.scene.add(this.room.group);

    // Stations will be added in subsequent tasks
  }

  setOnLaunch(cb: (topicId: string) => void) { this.onLaunchRun = cb; }

  onEnter() {}
  onExit() { this.controls.unlock(); }

  update(delta: number, elapsed: number) {
    this.room.update(elapsed);

    // FPS movement
    const dir = new THREE.Vector3();
    if (input.isDown('KeyW')) dir.z = -1;
    if (input.isDown('KeyS')) dir.z = 1;
    if (input.isDown('KeyA')) dir.x = -1;
    if (input.isDown('KeyD')) dir.x = 1;
    dir.normalize();

    if (this.controls.isLocked) {
      this.controls.moveRight(dir.x * this.moveSpeed * delta);
      this.controls.moveForward(-dir.z * this.moveSpeed * delta);
    }

    // Clamp position inside room
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -13, 13);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -18, 18);

    input.endFrame();
  }

  onResize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
```

**Step 3: Verify**

Walk around in the hub room with pointer lock. See retro grid floor, data cascade walls, vaporwave sunset through window.

**Step 4: Commit**

```bash
git add src/hub/
git commit -m "feat: broker hub room with synthwave ambiance and FPS controls"
```

---

### Task 13: Hub Stations — Tech Tree Hologram

**Files:**
- Create: `src/hub/stations/TechTreeStation.ts`
- Create: `src/ui/TechTreeUI.ts`

**Step 1: Create src/hub/stations/TechTreeStation.ts**

3D holographic tree in the center of the hub. Glowing nodes, connection lines, pulse animations. Player approaches → UI opens.

The station creates a 3D representation of the tech tree with sphere nodes and line connections. Unlocked nodes glow bright, locked ones are dim. A proximity trigger opens the 2D UI overlay for interaction.

**Step 2: Create src/ui/TechTreeUI.ts**

HTML/CSS overlay that shows the tech tree as an interactive diagram. Click nodes to purchase. Shows costs, descriptions, prerequisites. Styled with synthwave neon aesthetic.

**Step 3: Commit**

```bash
git add src/hub/stations/ src/ui/TechTreeUI.ts
git commit -m "feat: tech tree hologram station with interactive UI"
```

---

### Task 14: Hub Stations — Topic Map Globe

**Files:**
- Create: `src/hub/stations/TopicMapStation.ts`
- Create: `src/ui/TopicSelectUI.ts`

**Step 1: Create src/hub/stations/TopicMapStation.ts**

3D spinning globe with topic markers. Clusters as colored regions. Approach triggers UI.

**Step 2: Create src/ui/TopicSelectUI.ts**

Overlay showing available topics organized by cluster. Each topic shows name, difficulty indicators, best score, rewards. Click to launch run.

**Step 3: Commit**

```bash
git add src/hub/stations/TopicMapStation.ts src/ui/TopicSelectUI.ts
git commit -m "feat: topic map globe with selection UI"
```

---

### Task 15: Hub Stations — Consumer Machines

**Files:**
- Create: `src/hub/stations/ConsumerStation.ts`
- Create: `src/ui/ConsumerUI.ts`

**Step 1: Create src/hub/stations/ConsumerStation.ts**

Animated machine meshes (cylinders with spinning gears). Each machine has visible particles flowing when active. Approach triggers UI.

**Step 2: Create src/ui/ConsumerUI.ts**

Overlay to assign consumers to topics, upgrade levels, buy new machines. Shows idle income rate.

**Step 3: Commit**

```bash
git add src/hub/stations/ConsumerStation.ts src/ui/ConsumerUI.ts
git commit -m "feat: consumer machines with idle income management"
```

---

### Task 16: Hub Stations — Pipeline Table & Stats Wall

**Files:**
- Create: `src/hub/stations/PipelineStation.ts`
- Create: `src/hub/stations/StatsWallStation.ts`
- Create: `src/ui/PipelineUI.ts`
- Create: `src/ui/StatsUI.ts`

**Step 1: Pipeline table**

Miniature 3D representation of connected topics with glowing flow lines between them. UI overlay to create/remove pipeline connections.

**Step 2: Stats wall**

Array of "screen" meshes on the wall displaying animated bar charts and counters using Canvas textures updated each frame.

**Step 3: Commit**

```bash
git add src/hub/stations/PipelineStation.ts src/hub/stations/StatsWallStation.ts src/ui/PipelineUI.ts src/ui/StatsUI.ts
git commit -m "feat: pipeline table and stats wall stations"
```

---

### Task 17: Hub Stations — Launch Portal

**Files:**
- Create: `src/hub/stations/LaunchPortal.ts`

**Step 1: Create src/hub/stations/LaunchPortal.ts**

Glowing portal ring at the back of the room. When a topic is selected from the Topic Map, the portal activates (changes color, particles swirl). Walking into it starts the drift run. Visual: torus geometry with animated shader, particle vortex.

**Step 2: Commit**

```bash
git add src/hub/stations/LaunchPortal.ts
git commit -m "feat: launch portal with activation animation"
```

---

## Milestone 5: Scene Integration & Flow

### Task 18: Main Game Flow

**Files:**
- Modify: `src/main.ts`
- Create: `src/ui/MainMenu.ts`
- Create: `src/ui/menu.css`

**Step 1: Create src/ui/MainMenu.ts**

Title screen: "KAFKA DRIFT" in large neon text, "CLICK TO START" prompt. Synthwave background animation (CSS). Shows idle income earned while away.

**Step 2: Update src/main.ts**

Wire the full flow:
1. Main Menu → click → Broker Hub
2. Broker Hub → select topic → portal activates → walk into portal → Drift Run
3. Drift Run → end → back to Broker Hub (with rewards summary overlay)

```ts
import { Engine } from './engine/SceneManager';
import { DriftScene } from './drift/DriftScene';
import { HubScene } from './hub/HubScene';
import { gameState } from './state/GameState';

const container = document.getElementById('game')!;
const engine = new Engine(container);

const hubScene = new HubScene(engine.canvas);
const driftScene = new DriftScene();

engine.register('hub', hubScene);
engine.register('drift', driftScene);

hubScene.setOnLaunch((topicId) => {
  engine.switchTo('drift');
  driftScene.startRun(topicId, (cleared) => {
    setTimeout(() => engine.switchTo('hub'), 3000);
  });
});

// Start in hub
engine.switchTo('hub');
engine.start();
```

**Step 3: Commit**

```bash
git add src/main.ts src/ui/MainMenu.ts src/ui/menu.css
git commit -m "feat: full game flow — menu, hub, drift, rewards"
```

---

## Milestone 6: Audio

### Task 19: Audio System

**Files:**
- Create: `src/audio/AudioManager.ts`
- Create: `src/audio/SynthEngine.ts`

**Step 1: Create src/audio/SynthEngine.ts**

Procedural audio using Web Audio API — no external audio files needed:
- Synthwave bass drone for hub
- Arpeggiated synth that speeds up with the run
- SFX: collect ping (sine wave burst), combo whoosh (noise sweep), poison hit (low buzz), level up (chord)

**Step 2: Create src/audio/AudioManager.ts**

Manages audio context, music state, SFX triggers. Respects user mute preference (localStorage). Crossfades between hub and run music.

**Step 3: Wire into DriftScene and HubScene**

- Hub: ambient drone plays
- Run start: crossfade to run music
- Collect message: trigger ping SFX
- Lag approaching: drone pitch rises
- Run end: music fades

**Step 4: Commit**

```bash
git add src/audio/
git commit -m "feat: procedural synthwave audio with Web Audio API"
```

---

## Milestone 7: Polish & Production

### Task 20: Scene Transitions

**Files:**
- Create: `src/effects/Transition.ts`

**Step 1: Create src/effects/Transition.ts**

Fade-to-black with scanline wipe effect between hub and drift scenes. Uses a full-screen overlay div with CSS animation.

**Step 2: Commit**

```bash
git add src/effects/Transition.ts
git commit -m "feat: synthwave scene transitions"
```

---

### Task 21: Save System Polish & Idle Notifications

**Files:**
- Modify: `src/state/GameState.ts`
- Create: `src/ui/IdleRewardUI.ts`

**Step 1: Auto-save every 30 seconds during gameplay**

**Step 2: Create src/ui/IdleRewardUI.ts**

When returning to the game after being away, show a styled overlay: "While you were away... Your consumers earned X messages!" with a collect button.

**Step 3: Commit**

```bash
git add src/state/GameState.ts src/ui/IdleRewardUI.ts
git commit -m "feat: auto-save and idle reward notifications"
```

---

### Task 22: Responsive Design & Loading Screen

**Files:**
- Create: `src/ui/LoadingScreen.ts`
- Modify: `src/style.css`

**Step 1: Loading screen**

Animated "KAFKA DRIFT" text with a progress bar. Shown while Three.js initializes.

**Step 2: Responsive handling**

Handle resize gracefully. Lock to landscape on mobile with a "rotate device" message. Adjust HUD font sizes for smaller screens.

**Step 3: Commit**

```bash
git add src/ui/LoadingScreen.ts src/style.css
git commit -m "feat: loading screen and responsive design"
```

---

### Task 23: Final Polish Pass

**Files:**
- Various tweaks across all files

**Step 1: Visual polish**
- Verify bloom levels on all scenes
- Tune fog density for each corridor difficulty
- Add subtle camera shake on poison pill hit
- Ensure all shader materials dispose properly

**Step 2: Game balance pass**
- Verify progression curve (can player reach cluster 6 in ~3-4 hours of total play)
- Tune lag acceleration per topic
- Balance tech tree costs vs rewards
- Ensure idle income is meaningful but not game-breaking

**Step 3: Performance**
- Object pooling verification
- Dispose unused geometries/materials
- Verify 60fps on mid-range hardware
- Add `renderer.info` debug display (toggle with F3)

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: final polish — visuals, balance, performance"
```

---

### Task 24: Build & Deploy Setup

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`
- Create: `public/og-image.png` (placeholder)

**Step 1: Production build config**

```bash
npm run build
```

Verify dist/ output works with `npx vite preview`.

**Step 2: Add meta tags for sharing**

Open Graph tags in index.html for social sharing (title, description, image).

**Step 3: Add deploy script**

Add npm script for deploying to Netlify/Vercel/GitHub Pages (static export).

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: production build and deploy configuration"
```

---

## File Structure Summary

```
kafka-walk/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── docs/plans/
│   ├── 2026-03-08-kafka-drift-design.md
│   └── 2026-03-08-kafka-drift-implementation.md
├── src/
│   ├── main.ts
│   ├── style.css
│   ├── engine/
│   │   ├── Engine.ts
│   │   ├── SceneManager.ts
│   │   ├── InputManager.ts
│   │   └── PostProcessing.ts
│   ├── state/
│   │   ├── GameState.ts
│   │   ├── TechTree.ts
│   │   ├── TopicData.ts
│   │   └── __tests__/
│   │       └── GameState.test.ts
│   ├── drift/
│   │   ├── DriftScene.ts
│   │   ├── Corridor.ts
│   │   ├── SynthwaveShaders.ts
│   │   ├── Player.ts
│   │   ├── Collectibles.ts
│   │   ├── ObstaclePool.ts
│   │   └── LagWave.ts
│   ├── hub/
│   │   ├── HubScene.ts
│   │   ├── HubRoom.ts
│   │   └── stations/
│   │       ├── TechTreeStation.ts
│   │       ├── TopicMapStation.ts
│   │       ├── ConsumerStation.ts
│   │       ├── PipelineStation.ts
│   │       ├── StatsWallStation.ts
│   │       └── LaunchPortal.ts
│   ├── ui/
│   │   ├── HUD.ts
│   │   ├── hud.css
│   │   ├── TechTreeUI.ts
│   │   ├── TopicSelectUI.ts
│   │   ├── ConsumerUI.ts
│   │   ├── PipelineUI.ts
│   │   ├── StatsUI.ts
│   │   ├── MainMenu.ts
│   │   ├── menu.css
│   │   ├── IdleRewardUI.ts
│   │   └── LoadingScreen.ts
│   ├── effects/
│   │   ├── Particles.ts
│   │   └── Transition.ts
│   └── audio/
│       ├── AudioManager.ts
│       └── SynthEngine.ts
└── public/
```
