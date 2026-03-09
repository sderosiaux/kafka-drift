import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { GameScene } from '../engine/SceneManager';
import { input } from '../engine/SceneManager';
import { HubRoom } from './HubRoom';
import { TechTreeStation } from './stations/TechTreeStation';
import { TopicMapStation } from './stations/TopicMapStation';
import { ConsumerStation } from './stations/ConsumerStation';
import { PipelineStation } from './stations/PipelineStation';
import { StatsWallStation } from './stations/StatsWallStation';
import { LaunchPortal } from './stations/LaunchPortal';
import { TechTreeUI } from '../ui/TechTreeUI';
import { TopicSelectUI } from '../ui/TopicSelectUI';
import { ConsumerUI } from '../ui/ConsumerUI';
import { PipelineUI } from '../ui/PipelineUI';
import { StatsUI } from '../ui/StatsUI';

export class HubScene implements GameScene {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private controls: PointerLockControls;
  private room: HubRoom;
  private moveSpeed = 8;

  private techStation: TechTreeStation;
  private topicStation: TopicMapStation;
  private consumerStation: ConsumerStation;
  private pipelineStation: PipelineStation;
  private statsWall: StatsWallStation;
  private launchPortal: LaunchPortal;

  private techUI: TechTreeUI;
  private topicUI: TopicSelectUI;
  private consumerUI: ConsumerUI;
  private pipelineUI: PipelineUI;
  private statsUI: StatsUI;

  private uiOpen = false;
  private onLaunchRun: ((topicId: string) => void) | null = null;

  constructor(canvas: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 2, 10);

    this.scene.background = new THREE.Color(0x050008);
    this.scene.fog = new THREE.FogExp2(0x050008, 0.02);

    this.controls = new PointerLockControls(this.camera, canvas);
    canvas.addEventListener('click', () => {
      if (!this.uiOpen) this.controls.lock();
    });

    this.room = new HubRoom();
    this.scene.add(this.room.group);

    // Stations
    this.techStation = new TechTreeStation();
    this.scene.add(this.techStation.group);

    this.topicStation = new TopicMapStation();
    this.scene.add(this.topicStation.group);

    this.consumerStation = new ConsumerStation();
    this.scene.add(this.consumerStation.group);

    this.pipelineStation = new PipelineStation();
    this.scene.add(this.pipelineStation.group);

    this.statsWall = new StatsWallStation();
    this.scene.add(this.statsWall.group);

    this.launchPortal = new LaunchPortal();
    this.scene.add(this.launchPortal.group);

    // UIs
    this.techUI = new TechTreeUI();
    this.topicUI = new TopicSelectUI();
    this.consumerUI = new ConsumerUI();
    this.pipelineUI = new PipelineUI();
    this.statsUI = new StatsUI();

    // Wire station triggers
    this.techStation.trigger.onAction = () => {
      this.uiOpen = true;
      this.controls.unlock();
      this.techUI.show(
        () => { this.uiOpen = false; this.controls.lock(); },
        () => { this.techStation.refreshVisuals(); }
      );
    };

    this.topicStation.trigger.onAction = () => {
      this.uiOpen = true;
      this.controls.unlock();
      this.topicUI.show(
        (topicId) => {
          this.launchPortal.activate(topicId);
        },
        () => { this.uiOpen = false; this.controls.lock(); }
      );
    };

    this.consumerStation.trigger.onAction = () => {
      this.uiOpen = true;
      this.controls.unlock();
      this.consumerUI.show(
        () => { this.uiOpen = false; this.controls.lock(); },
        () => { this.consumerStation.refreshVisuals(); }
      );
    };

    this.pipelineStation.trigger.onAction = () => {
      this.uiOpen = true;
      this.controls.unlock();
      this.pipelineUI.show(
        () => { this.uiOpen = false; this.controls.lock(); },
        () => { this.pipelineStation.refreshVisuals(); }
      );
    };

    this.statsWall.trigger.onAction = () => {
      this.uiOpen = true;
      this.controls.unlock();
      this.statsUI.show(
        () => { this.uiOpen = false; this.controls.lock(); }
      );
    };

    this.launchPortal.onLaunch = (topicId) => {
      this.onLaunchRun?.(topicId);
    };
  }

  setOnLaunch(cb: (topicId: string) => void) { this.onLaunchRun = cb; }

  onEnter() {
    this.techStation.refreshVisuals();
    this.topicStation.refreshVisuals();
    this.consumerStation.refreshVisuals();
    this.pipelineStation.refreshVisuals();
    this.launchPortal.deactivate();
  }

  onExit() {
    this.controls.unlock();
  }

  update(delta: number, elapsed: number) {
    this.room.update(elapsed);
    this.techStation.update(elapsed);
    this.topicStation.update(elapsed);
    this.consumerStation.update(elapsed);
    this.statsWall.update(elapsed);
    this.launchPortal.update(elapsed);

    if (this.uiOpen) {
      input.endFrame();
      return;
    }

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
    this.camera.position.y = 2;

    // Update triggers
    const actionPressed = input.wasPressed('KeyF');
    this.techStation.trigger.update(this.camera.position, actionPressed);
    this.topicStation.trigger.update(this.camera.position, actionPressed);
    this.consumerStation.trigger.update(this.camera.position, actionPressed);
    this.pipelineStation.trigger.update(this.camera.position, actionPressed);
    this.statsWall.trigger.update(this.camera.position, actionPressed);

    // Check portal walk-through
    if (this.launchPortal.checkWalkThrough(this.camera.position)) {
      this.launchPortal.trigger.onAction?.();
    }

    input.endFrame();
  }

  onResize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
