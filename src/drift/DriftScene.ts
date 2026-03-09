import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { GameScene } from '../engine/SceneManager';
import { input } from '../engine/SceneManager';
import { Corridor, type ForkBranch } from './Corridor';
import { Player } from './Player';
import { CollectibleManager } from './Collectibles';
import { ObstacleManager } from './ObstaclePool';
import { LagWave } from './LagWave';
import { HUD } from '../ui/HUD';
import { gameState } from '../state/GameState';
import { TOPICS, type TopicConfig } from '../state/TopicData';
import { DataParticles, CollectBurst } from '../effects/Particles';
import { PostProcessing } from '../engine/PostProcessing';

const POWER_UP_TYPES = ['compaction-burst', 'compression-wave', 'exactly-once-shield', 'rewind'] as const;
type PowerUpType = typeof POWER_UP_TYPES[number];

export class DriftScene implements GameScene {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private corridor!: Corridor;
  private player!: Player;
  private collectibles!: CollectibleManager;
  private obstacles!: ObstacleManager;
  private lagWave!: LagWave;
  private hud: HUD;
  private dataParticles!: DataParticles;
  private collectBurst!: CollectBurst;
  postProcessing: PostProcessing | null = null;

  private topicConfig: TopicConfig | null = null;
  private runMessages = 0;
  private runSchemas = 0;
  private runDistance = 0;
  private combo = 0;
  private comboTimer = 0;
  private isRunning = false;
  private speed = 10;
  private sunMesh: THREE.Mesh | null = null;

  private onRunEnd: ((cleared: boolean) => void) | null = null;
  private currentBranch: ForkBranch = 'none';
  private forkNotified = false; // avoid spamming HUD on each fork

  /** Temporary speed multiplier from obstacle debuffs (1 = normal) */
  private speedDebuffMult = 1;
  private speedDebuffTimer = 0;
  /** Screen shake offset for broker-failure */
  private shakeIntensity = 0;
  private shakeTimer = 0;

  // R2: Free-look FPS controls
  private controls: PointerLockControls;

  // R5: Checkpoint respawn
  private checkpointCharge = 0;
  private lastCheckpointDistance = 0;

  // R6: Power-up system
  private powerUpInventory: PowerUpType[] = [];
  private compressionWaveTimer = 0;
  private exactlyOnceShield = false;

  // Fix 4: Pause
  private isPaused = false;

  constructor(canvas: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 2.5, 0);

    // R2: PointerLockControls for free-look FPS during drift
    this.controls = new PointerLockControls(this.camera, canvas);
    canvas.addEventListener('click', () => {
      if (this.isRunning && !this.isPaused) this.controls.lock();
    });

    this.scene.background = new THREE.Color(0x0a0010);
    this.scene.fog = new THREE.FogExp2(0x0a0010, 0.008);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0x6633aa, 0.4));
    const dirLight = new THREE.DirectionalLight(0xff69b4, 0.3);
    dirLight.position.set(0, 10, -10);
    this.scene.add(dirLight);

    // Vaporwave sun
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
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(0, 15, -250);
    this.scene.add(this.sunMesh);

    // Default corridor
    this.initComponents(3);

    this.hud = new HUD();
    this.hud.hide();
  }

  private initComponents(partitions: number) {
    // Clean up old components if they exist
    if (this.corridor) this.scene.remove(this.corridor.group);
    if (this.player) this.scene.remove(this.player.group);
    if (this.collectibles) this.scene.remove(this.collectibles.group);
    if (this.obstacles) this.scene.remove(this.obstacles.group);
    if (this.lagWave) this.scene.remove(this.lagWave.group);
    if (this.dataParticles) this.scene.remove(this.dataParticles.points);

    this.corridor = new Corridor(partitions);
    this.scene.add(this.corridor.group);

    this.player = new Player(this.camera);
    this.scene.add(this.player.group);

    this.collectibles = new CollectibleManager(150);
    this.scene.add(this.collectibles.group);

    this.obstacles = new ObstacleManager();
    this.scene.add(this.obstacles.group);

    this.lagWave = new LagWave(this.corridor.width, this.corridor.height, 0.2);
    this.scene.add(this.lagWave.group);

    this.dataParticles = new DataParticles(500, this.corridor.width, this.corridor.height);
    this.scene.add(this.dataParticles.points);

    this.collectBurst = new CollectBurst(this.scene, 20);
  }

  initPostProcessing(renderer: THREE.WebGLRenderer) {
    this.postProcessing = new PostProcessing(renderer, this.scene, this.camera);
  }

  /** Apply a temporary speed debuff multiplier for a given duration */
  private applySpeedDebuff(mult: number, duration: number) {
    // Take the worst (lowest) active debuff
    if (this.speedDebuffTimer > 0) {
      this.speedDebuffMult = Math.min(this.speedDebuffMult, mult);
      this.speedDebuffTimer = Math.max(this.speedDebuffTimer, duration);
    } else {
      this.speedDebuffMult = mult;
      this.speedDebuffTimer = duration;
    }
  }

  /** Trigger a screen shake effect */
  private triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  startRun(topicId: string, onEnd: (cleared: boolean) => void) {
    this.topicConfig = TOPICS.find(t => t.id === topicId) ?? TOPICS[0];
    this.onRunEnd = onEnd;

    // Rebuild corridor for topic partitions
    this.initComponents(this.topicConfig.partitions);

    this.speed = this.topicConfig.speed;
    this.runMessages = 0;
    this.runSchemas = 0;
    this.runDistance = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.isRunning = true;
    this.isPaused = false;
    this.speedDebuffMult = 1;
    this.speedDebuffTimer = 0;
    this.shakeIntensity = 0;
    this.shakeTimer = 0;
    this.checkpointCharge = 0;
    this.lastCheckpointDistance = 0;
    this.powerUpInventory = [];
    this.compressionWaveTimer = 0;
    this.exactlyOnceShield = false;

    // R2: Pointer lock — try to lock, but may fail outside user gesture.
    // Canvas click handler will re-lock if needed.
    try { this.controls.lock(); } catch (_) { /* handled by canvas click */ }

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
    this.corridor.resetForks();
    this.currentBranch = 'none';
    this.forkNotified = false;

    // Retention multiplier: topics with 'retention' obstacle shorten schema fade time
    let retentionMultiplier = 1;
    if (this.topicConfig.obstacles.includes('retention')) {
      retentionMultiplier = 0.6; // schemas fade 40% faster
      const retentionExtend = gameState.getEffect('retentionExtend') || 0;
      if (retentionExtend > 0) {
        retentionMultiplier *= retentionExtend; // e.g. 2.0 counteracts the penalty
      }
    }

    this.collectibles.configure({
      speed: this.speed,
      density: this.topicConfig.messageDensity,
      lanes: baseLanes,
      schemaRate: gameState.getEffect('schemaDropRate') || 1,
      poisonRate: 0.1,
      baseMessageValue: this.topicConfig.baseMessageValue,
      retentionMultiplier,
    });
    this.collectibles.setEnabledObstacles(this.topicConfig.obstacles);
    this.obstacles.setSpeed(this.speed);
    this.obstacles.setEnabledTypes(this.topicConfig.obstacles);

    const lagSlowdown = gameState.getEffect('lagSlowdown') || 1;
    this.lagWave.setBaseSpeed(this.speed);
    (this.lagWave as any).acceleration = this.topicConfig.lagAccel * lagSlowdown;
    this.lagWave.reset();

    this.hud.show();
    this.hud.showCenter(this.topicConfig.name, 2000);

    // Fix 7: Visual notification for retention modifier
    if (this.topicConfig.obstacles.includes('retention')) {
      setTimeout(() => this.hud.showCenter('RETENTION: Schemas fade faster!', 2000), 2200);
    }
  }

  private endRun(cleared: boolean) {
    this.isRunning = false;
    this.controls.unlock();

    const replicationMult = gameState.getEffect('replicationReward') || 1;
    const msgReward = cleared
      ? Math.floor(this.runMessages * replicationMult)
      : Math.floor(this.runMessages * 0.5);
    const schemaReward = cleared ? this.runSchemas : Math.floor(this.runSchemas * 0.3);

    gameState.addMessages(msgReward);
    gameState.addSchemas(schemaReward);
    gameState.addThroughput(this.runMessages);

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
      this.player.reset();
      this.onRunEnd?.(cleared);
    }, 3000);
  }

  update(delta: number, elapsed: number) {
    // Fix 4: Pause toggle on Escape during a run
    if (this.isRunning && input.wasPressed('Escape')) {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        this.controls.unlock();
        this.hud.showCenter('PAUSED', 999999);
      } else {
        this.controls.lock();
        this.hud.showCenter('', 1);
      }
    }

    if (!this.isRunning || this.isPaused) {
      input.endFrame();
      return;
    }

    // R6: Power-up activation on KeyE
    if (input.wasPressed('KeyE') && this.powerUpInventory.length > 0) {
      const pu = this.powerUpInventory.shift()!;
      this.activatePowerUp(pu);
    }

    // Sun shader update
    if (this.sunMesh) {
      (this.sunMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
    }

    this.corridor.update(delta, elapsed);
    this.player.update(delta);
    this.collectibles.update(delta, elapsed);
    this.obstacles.update(delta);
    this.lagWave.update(delta, elapsed);
    this.dataParticles.update(delta, this.speed);
    this.collectBurst.update(delta);

    // Speed debuff timer
    if (this.speedDebuffTimer > 0) {
      this.speedDebuffTimer -= delta;
      if (this.speedDebuffTimer <= 0) {
        this.speedDebuffMult = 1;
        this.speedDebuffTimer = 0;
      }
    }

    // Screen shake timer
    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta;
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
      if (this.shakeTimer <= 0) {
        this.shakeIntensity = 0;
        this.shakeTimer = 0;
      }
    }

    // Compression wave timer: shrink obstacles while active
    if (this.compressionWaveTimer > 0) {
      this.compressionWaveTimer -= delta;
      this.obstacles.setCompressionWave(true);
      if (this.compressionWaveTimer <= 0) {
        this.obstacles.setCompressionWave(false);
      }
    }

    // Boost (Fix 5: boostDuration tech effect multiplies boost speed)
    if (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) {
      const boostDurationMult = gameState.getEffect('boostDuration') || 1;
      this.speed = (this.topicConfig?.speed ?? 10) * 1.8 * boostDurationMult;
      this.corridor.setSpeed(this.speed);
      this.collectibles.configure({
        speed: this.speed,
        density: this.topicConfig?.messageDensity ?? 20,
        lanes: Math.floor((this.topicConfig?.partitions ?? 3) / 2),
        schemaRate: gameState.getEffect('schemaDropRate') || 1,
        poisonRate: 0.1,
        baseMessageValue: this.topicConfig?.baseMessageValue ?? 1,
      });
      this.hud.setSpeedLines(0.5);
    } else {
      this.speed = this.topicConfig?.speed ?? 10;
      const speedMult = gameState.getEffect('speedMultiplier') || 1;
      this.speed *= speedMult;
      this.corridor.setSpeed(this.speed);
      this.hud.setSpeedLines(0);
    }

    // Apply speed debuff on top of calculated speed
    this.speed *= this.speedDebuffMult;

    // Distance tracking
    this.runDistance += this.speed * delta;

    // Fork branch detection
    const prevBranch = this.currentBranch;
    this.currentBranch = this.corridor.getPlayerBranch(this.player.position.x);

    if (this.currentBranch !== 'none' && prevBranch === 'none') {
      // Just entered a fork
      if (!this.forkNotified) {
        const label = this.currentBranch === 'right' ? 'RISKY PATH - 2x REWARDS'
          : this.currentBranch === 'center' ? 'NORMAL PATH' : 'SAFE PATH';
        this.hud.showCenter(label, 1500);
        this.forkNotified = true;
        // Reset after fork passes so next fork can notify
        setTimeout(() => { this.forkNotified = false; }, 5000);
      }
    }

    // Risky branch: more obstacles and poison pills
    if (this.currentBranch === 'right') {
      this.obstacles.setSpawnRateMultiplier(2.5);
      this.collectibles.setPoisonRateMultiplier(2.0);
    } else {
      this.obstacles.setSpawnRateMultiplier(1.0);
      this.collectibles.setPoisonRateMultiplier(1.0);
    }

    // Topic completion
    if (this.topicConfig && this.runDistance >= this.topicConfig.length) {
      this.endRun(true);
      return;
    }

    // Lag check (R5: checkpoint respawn, R6: exactly-once-shield)
    if (this.lagWave.caught) {
      if (this.exactlyOnceShield) {
        this.exactlyOnceShield = false;
        this.lagWave.pushBack(40);
        this.hud.showCenter('SHIELD ABSORBED!', 1500);
      } else if (this.checkpointCharge > 0) {
        this.checkpointCharge = 0;
        this.runDistance = this.lastCheckpointDistance;
        this.lagWave.resetDistance();
        this.hud.showCenter('RESPAWNED!', 1500);
      } else {
        this.endRun(false);
        return;
      }
    }

    // Collect messages
    const collected = this.collectibles.checkCollisions(this.player.position, this.player.radius);
    for (const item of collected) {
      this.collectBurst.emit(item.position, item.type === 'schema' ? 0xffd700 : 0xff69b4);

      if (item.type === 'message') {
        const valueMult = gameState.getEffect('allMessageValue') || 1;
        const comboMult = Math.min(this.combo, 10);
        const forkMult = this.currentBranch === 'right' ? 2 : 1;
        this.runMessages += Math.ceil(item.value * valueMult * Math.max(1, comboMult) * forkMult);
        this.combo++;
        this.comboTimer = 2;
      } else if (item.type === 'schema') {
        const schemaMult = gameState.getEffect('schemaValue') || 1;
        const forkMult = this.currentBranch === 'right' ? 2 : 1;
        this.runSchemas += Math.ceil(item.value * schemaMult * forkMult);
        this.combo++;
        this.comboTimer = 2;
      } else if (item.type === 'poison-pill') {
        this.combo = 0;
        this.applySpeedDebuff(0.5, 2);
      } else if (item.type === 'tombstone') {
        // Tombstones reduce combo timer by 1s, making combo harder to maintain
        this.comboTimer = Math.max(0, this.comboTimer - 1);
        if (this.comboTimer <= 0) {
          this.combo = 0;
          this.hud.hideCombo();
        }
      } else if (item.type === 'power-up') {
        // R6: Collect power-up (max 3)
        if (this.powerUpInventory.length < 3) {
          const puType = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
          this.powerUpInventory.push(puType);
          this.hud.updatePowerUp(this.powerUpInventory[0]);
          this.hud.showCenter(`POWER-UP: ${puType.toUpperCase()}`, 1500);
          this.collectBurst.emit(item.position, 0x00ffff);
        }
      }
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.hud.hideCombo();
      }
    }

    // Obstacle effects
    const inside = this.obstacles.checkPlayerInside(this.player.position);
    for (const obs of inside) {
      if (obs.firstTime && obs.type === 'isr-ring') {
        this.combo += 2;
        this.comboTimer = 2;
      }

      // R5: checkpoint-charge system
      if (obs.firstTime && obs.type === 'checkpoint') {
        this.checkpointCharge = 1;
        this.lastCheckpointDistance = this.runDistance;
        // Change checkpoint ring color to gold
        const cpMesh = this.obstacles.getActiveObstacle('checkpoint', this.player.position.z);
        if (cpMesh && cpMesh instanceof THREE.Mesh) {
          const mat = cpMesh.material as THREE.MeshStandardMaterial;
          mat.color.setHex(0xffd700);
          mat.emissive.setHex(0xffd700);
        }
        this.hud.showCenter('CHECKPOINT!', 1000);
      }

      // compaction-zone: award bonus messages on first entry
      if (obs.firstTime && obs.type === 'compaction-zone') {
        const baseVal = this.topicConfig?.baseMessageValue ?? 1;
        const compactionMult = gameState.getEffect('compactionMultiplier') || 1;
        this.runMessages += Math.floor(50 * baseVal * compactionMult);
        this.hud.showCenter('COMPACTION!', 1500);
      }

      // broker-failure: screen shake + 30% speed reduction for 3s
      if (obs.firstTime && obs.type === 'broker-failure') {
        const resist = gameState.getEffect('brokerFailureResist') || 1;
        this.applySpeedDebuff(1 - 0.3 * resist, 3);
        this.triggerShake(0.4, 0.6);
        this.hud.showCenter('BROKER FAILURE!', 1500);
      }

      // network-partition: grounded = 50% speed reduction 2s; jumping = no effect
      if (obs.firstTime && obs.type === 'network-partition') {
        if (this.player.grounded) {
          this.applySpeedDebuff(0.5, 2);
          this.hud.showCenter('NETWORK PARTITION!', 1500);
        }
        // If player is jumping, they clear the gap — no penalty
      }

      // acl-gate: if aclBypass unlocked, no effect; otherwise 70% speed reduction 2s
      if (obs.firstTime && obs.type === 'acl-gate') {
        const aclBypass = gameState.getEffect('aclBypass') || 0;
        if (!aclBypass) {
          this.applySpeedDebuff(0.3, 2);
          this.hud.showCenter('ACL BLOCKED!', 1500);
        }
      }

      // quota-throttle: if quotaImmune unlocked, no effect; otherwise 40% speed reduction 3s
      if (obs.firstTime && obs.type === 'quota-throttle') {
        const quotaImmune = gameState.getEffect('quotaImmune') || 0;
        if (!quotaImmune) {
          this.applySpeedDebuff(0.6, 3);
          this.hud.showCenter('QUOTA THROTTLED!', 1500);
        }
      }
    }

    // Update HUD
    this.hud.updateMessages(this.runMessages);
    this.hud.updateSchemas(this.runSchemas);
    this.hud.updateSpeed(this.speed / (this.topicConfig?.speed ?? 10));
    this.hud.updateLag(this.lagWave.dangerLevel);
    this.hud.updateDistance(this.topicConfig ? this.runDistance / this.topicConfig.length : 0);
    if (this.combo > 1) this.hud.showCombo(this.combo);

    // Update HUD power-up display
    this.hud.updatePowerUp(this.powerUpInventory.length > 0 ? this.powerUpInventory[0] : null);

    // Post-processing effects
    this.postProcessing?.setChromaticAberration(this.lagWave.dangerLevel * 3);

    input.endFrame();
  }

  private activatePowerUp(type: PowerUpType) {
    switch (type) {
      case 'compaction-burst': {
        const baseVal = this.topicConfig?.baseMessageValue ?? 1;
        this.runMessages += 500 * baseVal;
        this.hud.showCenter('COMPACTION BURST!', 1500);
        break;
      }
      case 'compression-wave':
        this.compressionWaveTimer = 5;
        this.hud.showCenter('COMPRESSION WAVE! (5s)', 1500);
        break;
      case 'exactly-once-shield':
        this.exactlyOnceShield = true;
        this.hud.showCenter('SHIELD ACTIVE!', 1500);
        break;
      case 'rewind':
        this.lagWave.pushBack(20);
        this.hud.showCenter('REWIND!', 1500);
        break;
    }
    // Update HUD to show next power-up (or clear)
    this.hud.updatePowerUp(this.powerUpInventory.length > 0 ? this.powerUpInventory[0] : null);
  }

  onResize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.postProcessing?.resize(w, h);
  }

  onEnter() {}
  onExit() {
    this.hud.hide();
    this.controls.unlock();
  }
}
