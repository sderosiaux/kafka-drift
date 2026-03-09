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
  private chromaPass: ShaderPass;
  private scanlinePass: ShaderPass;
  private bloomPass: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2, 0.4, 0.85
    );
    this.composer.addPass(this.bloomPass);

    this.chromaPass = new ShaderPass(ChromaticAberrationShader);
    this.composer.addPass(this.chromaPass);

    this.scanlinePass = new ShaderPass(ScanlinesShader);
    this.composer.addPass(this.scanlinePass);
  }

  setChromaticAberration(intensity: number) {
    this.chromaPass.uniforms['uIntensity'].value = intensity;
  }

  setBloomStrength(s: number) {
    this.bloomPass.strength = s;
  }

  resize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.scanlinePass.uniforms['uResolution'].value.set(w, h);
  }

  render() {
    this.composer.render();
  }
}
