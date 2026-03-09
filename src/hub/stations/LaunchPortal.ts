import * as THREE from 'three';
import { ProximityTrigger } from '../ProximityTrigger';

export class LaunchPortal {
  group = new THREE.Group();
  trigger: ProximityTrigger;
  private torus: THREE.Mesh;
  private particles: THREE.Points;
  private particlePositions: Float32Array;
  private isActivated = false;
  private selectedTopicId: string | null = null;
  private launching = false;
  onLaunch: ((topicId: string) => void) | null = null;

  get isActive() { return this.isActivated; }
  get isLaunching() { return this.launching; }
  get topicId() { return this.selectedTopicId; }
  setLaunching(v: boolean) { this.launching = v; }

  constructor() {
    this.group.position.set(0, 0, -18);

    // Portal ring
    const torusGeo = new THREE.TorusGeometry(3, 0.2, 16, 48);
    const torusMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uActivated: { value: 0 },
        uColor: { value: new THREE.Color(0x4400aa) },
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
        uniform float uActivated;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          float pulse = sin(uTime * 3.0 + vUv.x * 10.0) * 0.3 + 0.7;
          float glow = uActivated * 0.5 + 0.3;
          vec3 col = uColor * pulse * glow;
          float alpha = glow * 0.8 + 0.2;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.torus = new THREE.Mesh(torusGeo, torusMat);
    this.torus.position.y = 4;
    this.group.add(this.torus);

    // Portal interior (flat disc)
    const discGeo = new THREE.CircleGeometry(2.8, 32);
    const discMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uActivated: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uActivated;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float spiral = sin(atan(center.y, center.x) * 5.0 - uTime * 4.0 + dist * 10.0);
          float intensity = uActivated * 0.6;
          vec3 col = mix(vec3(0.2, 0.0, 0.4), vec3(1.0, 0.0, 0.5), spiral * 0.5 + 0.5);
          float alpha = intensity * (1.0 - dist * 1.5) * (spiral * 0.3 + 0.7);
          gl_FragColor = vec4(col, max(0.0, alpha));
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(0, 4, 0.01);
    this.group.add(disc);

    // Particle vortex
    const count = 100;
    this.particlePositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 2;
      this.particlePositions[i * 3] = Math.cos(angle) * r;
      this.particlePositions[i * 3 + 1] = 4 + (Math.random() - 0.5) * 2;
      this.particlePositions[i * 3 + 2] = Math.sin(angle) * r;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xff69b4,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(pGeo, pMat);
    this.group.add(this.particles);

    // Platform
    const platGeo = new THREE.BoxGeometry(4, 0.2, 2);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, emissive: 0x4400aa, emissiveIntensity: 0.2 });
    const plat = new THREE.Mesh(platGeo, platMat);
    plat.position.set(0, 0.1, 1);
    this.group.add(plat);

    this.trigger = new ProximityTrigger(
      new THREE.Vector3(0, 0, -18),
      3,
      'Walk into the portal to launch'
    );

    // Default onAction — overridden by HubScene for richer flow
    this.trigger.onAction = () => {
      if (this.isActivated && this.selectedTopicId && !this.launching) {
        this.launching = true;
        this.onLaunch?.(this.selectedTopicId);
      }
    };
  }

  activate(topicId: string) {
    this.isActivated = true;
    this.selectedTopicId = topicId;
    const mat = this.torus.material as THREE.ShaderMaterial;
    mat.uniforms.uColor.value.setHex(0xff1493);
  }

  deactivate() {
    this.isActivated = false;
    this.selectedTopicId = null;
    this.launching = false;
    const mat = this.torus.material as THREE.ShaderMaterial;
    mat.uniforms.uColor.value.setHex(0x4400aa);
  }

  update(elapsed: number) {
    const activated = this.isActivated ? 1 : 0;

    // Torus
    const torusMat = this.torus.material as THREE.ShaderMaterial;
    torusMat.uniforms.uTime.value = elapsed;
    torusMat.uniforms.uActivated.value = activated;
    this.torus.rotation.z = elapsed * 0.3;

    // Disc
    const disc = this.group.children[1] as THREE.Mesh;
    if (disc?.material && 'uniforms' in disc.material) {
      (disc.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
      (disc.material as THREE.ShaderMaterial).uniforms.uActivated.value = activated;
    }

    // Particles vortex
    if (this.isActivated) {
      for (let i = 0; i < this.particlePositions.length / 3; i++) {
        const angle = elapsed * 2 + i * 0.5;
        const r = 1 + Math.sin(i * 0.3 + elapsed) * 0.5;
        this.particlePositions[i * 3] = Math.cos(angle) * r;
        this.particlePositions[i * 3 + 2] = Math.sin(angle) * r;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      (this.particles.material as THREE.PointsMaterial).opacity = 0.8;
    } else {
      (this.particles.material as THREE.PointsMaterial).opacity = 0.2;
    }
  }

  checkWalkThrough(playerPos: THREE.Vector3): boolean {
    if (!this.isActivated) return false;
    const dx = playerPos.x;
    const dz = playerPos.z + 18;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return dist < 3;
  }
}
