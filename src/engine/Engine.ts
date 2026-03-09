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
  private composer: { render(): void; setSize(w: number, h: number): void } | null = null;

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
      this.composer?.setSize(w, h);
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

  setComposer(composer: { render(): void; setSize(w: number, h: number): void } | null) {
    this.composer = composer;
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();
      if (this.currentScene) {
        this.currentScene.update(delta, elapsed);
        if (this.composer) {
          this.composer.render();
        } else {
          this.renderer.render(this.currentScene.scene, this.currentScene.camera);
        }
      }
    };
    loop();
  }

  get canvas() { return this.renderer.domElement; }
  get current() { return this.currentScene; }
}
