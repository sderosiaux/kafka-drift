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
