import { SynthEngine } from './SynthEngine';

const MUTE_KEY = 'kafka-drift-muted';

export class AudioManager {
  private synth = new SynthEngine();
  private muted: boolean;
  private currentScene: 'hub' | 'drift' | 'none' = 'none';

  constructor() {
    this.muted = localStorage.getItem(MUTE_KEY) === 'true';
    if (this.muted) this.synth.setVolume(0);
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, String(this.muted));
    this.synth.setVolume(this.muted ? 0 : 0.3);
  }

  get isMuted() { return this.muted; }

  enterHub() {
    if (this.currentScene === 'drift') this.synth.stopRunMusic();
    this.synth.startHubDrone();
    this.currentScene = 'hub';
  }

  enterDrift() {
    if (this.currentScene === 'hub') this.synth.stopHubDrone();
    this.synth.startRunMusic();
    this.currentScene = 'drift';
  }

  stopAll() {
    this.synth.stopHubDrone();
    this.synth.stopRunMusic();
    this.currentScene = 'none';
  }

  onCollect() { if (!this.muted) this.synth.playCollect(); }
  onCombo() { if (!this.muted) this.synth.playCombo(); }
  onPoison() { if (!this.muted) this.synth.playPoison(); }
  onLevelUp() { if (!this.muted) this.synth.playLevelUp(); }
}

export const audio = new AudioManager();
