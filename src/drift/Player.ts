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
  private trail: THREE.Mesh;
  private targetLane = 0;
  private currentX = 0;
  private velocityY = 0;
  private isGrounded = true;
  private maxLanes = 1;
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
    this.trail = new THREE.Mesh(trailGeo, trailMat);
    this.trail.rotation.x = -Math.PI / 2;
    this.trail.position.set(0, -0.55, 0.5);
    this.group.add(this.trail);

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
  get grounded() { return this.isGrounded; }

  update(delta: number) {
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

    // Board tilt
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

  reset() {
    this.targetLane = 0;
    this.currentX = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.boostActive = false;
    this.boostTimer = 0;
    this.boardTilt = 0;
    this.group.position.set(0, 1, 0);
  }
}
