import * as THREE from 'three';

export const ROOM_W = 30;
export const ROOM_D = 40;
export const ROOM_H = 10;

export class HubRoom {
  group = new THREE.Group();
  private shaderMaterials: THREE.ShaderMaterial[] = [];

  constructor() {
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

    // Walls — data cascade
    const wallMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime; varying vec2 vUv;
        void main() {
          float col = fract(vUv.x * 30.0);
          float drop = fract(vUv.y - uTime * (0.3 + col * 0.2));
          float ch = step(0.95, fract(sin(floor(vUv.x * 30.0) * 127.1 + floor(drop * 20.0) * 311.7) * 43758.5453));
          vec3 color = vec3(0.9, 0.2, 0.6) * ch * 0.3;
          float fade = smoothstep(0.0, 0.3, drop) * smoothstep(1.0, 0.7, drop);
          gl_FragColor = vec4(color * fade, ch * fade * 0.4 + 0.02);
        }`,
      transparent: true, side: THREE.DoubleSide,
    });
    this.shaderMaterials.push(wallMat);

    const wallPositions: { pos: number[]; rot: number[]; size: number[] }[] = [
      { pos: [0, ROOM_H / 2, -ROOM_D / 2], rot: [0, 0, 0], size: [ROOM_W, ROOM_H] },
      { pos: [0, ROOM_H / 2, ROOM_D / 2], rot: [0, Math.PI, 0], size: [ROOM_W, ROOM_H] },
      { pos: [-ROOM_W / 2, ROOM_H / 2, 0], rot: [0, Math.PI / 2, 0], size: [ROOM_D, ROOM_H] },
      { pos: [ROOM_W / 2, ROOM_H / 2, 0], rot: [0, -Math.PI / 2, 0], size: [ROOM_D, ROOM_H] },
    ];

    for (const w of wallPositions) {
      const geo = new THREE.PlaneGeometry(w.size[0], w.size[1]);
      const wall = new THREE.Mesh(geo, wallMat);
      wall.position.set(w.pos[0], w.pos[1], w.pos[2]);
      wall.rotation.set(w.rot[0], w.rot[1], w.rot[2]);
      this.group.add(wall);
    }

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
    const ceilMat = new THREE.MeshBasicMaterial({ color: 0x0a0010, side: THREE.DoubleSide });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = ROOM_H;
    this.group.add(ceil);

    // Window with vaporwave sunset
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

    // Lighting
    this.group.add(new THREE.AmbientLight(0x6633aa, 0.3));
    const p1 = new THREE.PointLight(0xff69b4, 1, 20);
    p1.position.set(0, 8, 0);
    this.group.add(p1);
    const p2 = new THREE.PointLight(0x00ffff, 0.5, 15);
    p2.position.set(-10, 5, -10);
    this.group.add(p2);
    const p3 = new THREE.PointLight(0x8b00ff, 0.5, 15);
    p3.position.set(10, 5, 10);
    this.group.add(p3);
  }

  update(elapsed: number) {
    for (const mat of this.shaderMaterials) {
      mat.uniforms.uTime.value = elapsed;
    }
  }
}
