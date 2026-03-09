import * as THREE from 'three';

export class LagWave {
  group = new THREE.Group();
  private wall: THREE.Mesh;
  private distance = 80;
  private acceleration: number;
  private currentSpeed = 0;
  private baseSpeed = 0;
  private intensity = 0;

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

    // Fog particles
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

  pushBack(amount: number) {
    this.distance = Math.min(80, this.distance + amount);
  }

  resetDistance() {
    this.distance = 80;
    this.currentSpeed = 0;
    this.intensity = 0;
  }

  reset() {
    this.distance = 80;
    this.currentSpeed = 0;
    this.intensity = 0;
  }
}
