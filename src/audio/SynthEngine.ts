export class SynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private runOsc: OscillatorNode | null = null;
  private runGain: GainNode | null = null;
  private arpInterval: ReturnType<typeof setInterval> | null = null;

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  startHubDrone() {
    const ctx = this.ensureContext();
    if (this.droneOsc) return;

    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneGain.connect(this.masterGain!);
    this.droneGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 2);

    this.droneOsc = ctx.createOscillator();
    this.droneOsc.type = 'sawtooth';
    this.droneOsc.frequency.value = 55; // A1
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    this.droneOsc.connect(filter);
    filter.connect(this.droneGain);
    this.droneOsc.start();

    // Sub bass
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 55;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.1;
    sub.connect(subGain);
    subGain.connect(this.droneGain);
    sub.start();
  }

  stopHubDrone() {
    if (this.droneGain && this.ctx) {
      this.droneGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
      setTimeout(() => {
        this.droneOsc?.stop();
        this.droneOsc = null;
        this.droneGain = null;
      }, 1200);
    }
  }

  startRunMusic(bpm = 128) {
    const ctx = this.ensureContext();
    if (this.runOsc) return;

    this.runGain = ctx.createGain();
    this.runGain.gain.value = 0;
    this.runGain.connect(this.masterGain!);
    this.runGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1);

    // Bass arpeggio
    const notes = [110, 130.81, 146.83, 164.81, 146.83, 130.81]; // Am arp
    let noteIndex = 0;
    const beatTime = 60 / bpm / 2;

    this.arpInterval = setInterval(() => {
      if (!this.ctx || !this.runGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = notes[noteIndex % notes.length];
      const env = this.ctx.createGain();
      env.gain.value = 0.08;
      env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + beatTime * 0.8);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      osc.connect(filter);
      filter.connect(env);
      env.connect(this.runGain!);
      osc.start();
      osc.stop(this.ctx.currentTime + beatTime);
      noteIndex++;
    }, beatTime * 1000);
  }

  stopRunMusic() {
    if (this.arpInterval) {
      clearInterval(this.arpInterval);
      this.arpInterval = null;
    }
    if (this.runGain && this.ctx) {
      this.runGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
      setTimeout(() => {
        this.runOsc?.stop();
        this.runOsc = null;
        this.runGain = null;
      }, 1200);
    }
  }

  playCollect() {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    const gain = ctx.createGain();
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  playCombo() {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 440;
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  playPoison() {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 100;
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  playLevelUp() {
    const ctx = this.ensureContext();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 chord arp
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.5);
    });
  }
}
