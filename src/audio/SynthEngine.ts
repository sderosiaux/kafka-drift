export class SynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Hub music nodes
  private hubNodes: AudioNode[] = [];
  private hubOscs: OscillatorNode[] = [];
  private hubGain: GainNode | null = null;
  private hubArpInterval: ReturnType<typeof setInterval> | null = null;

  // Run music nodes
  private runGain: GainNode | null = null;
  private runIntervals: ReturnType<typeof setInterval>[] = [];
  private runOscs: OscillatorNode[] = [];
  private runActive = false;

  // SFX bus (slightly louder than music)
  private sfxGain: GainNode | null = null;

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  // --- Helper: create a filtered oscillator note ---
  private note(dest: AudioNode, freq: number, type: OscillatorType, vol: number, start: number, dur: number, filterFreq = 2000) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, start);
    env.gain.linearRampToValueAtTime(vol, start + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, start + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    osc.connect(filter);
    filter.connect(env);
    env.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    return osc;
  }

  // --- Helper: noise burst (percussion) ---
  private noise(dest: AudioNode, vol: number, start: number, dur: number, filterFreq = 4000, filterType: BiquadFilterType = 'highpass') {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, start);
    env.gain.exponentialRampToValueAtTime(0.001, start + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.start(start);
  }

  // =========================================================
  // HUB MUSIC — chill synthwave pad + slow arpeggio
  // =========================================================
  startHubDrone() {
    const ctx = this.ensureContext();
    if (this.hubGain) return;

    this.hubGain = ctx.createGain();
    this.hubGain.gain.setValueAtTime(0, ctx.currentTime);
    this.hubGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 3);
    this.hubGain.connect(this.masterGain!);

    // Warm pad: layered detuned saws through LP filter
    const padFreqs = [55, 82.41, 110]; // A1, E2, A2
    for (const freq of padFreqs) {
      for (const detune of [-8, 0, 8]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.03;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 180;
        // Slow filter sweep
        f.frequency.setValueAtTime(120, ctx.currentTime);
        f.frequency.linearRampToValueAtTime(250, ctx.currentTime + 8);
        osc.connect(f);
        f.connect(g);
        g.connect(this.hubGain);
        osc.start();
        this.hubOscs.push(osc);
        this.hubNodes.push(g, f);
      }
    }

    // Slow ambient arp — pentatonic Am
    const arpNotes = [220, 261.63, 329.63, 392, 440, 523.25, 440, 392, 329.63, 261.63];
    let arpIdx = 0;
    this.hubArpInterval = setInterval(() => {
      if (!this.ctx || !this.hubGain) return;
      const t = this.ctx.currentTime;
      const freq = arpNotes[arpIdx % arpNotes.length];
      // Sine + triangle layered
      this.note(this.hubGain!, freq, 'sine', 0.04, t, 1.2, 1500);
      this.note(this.hubGain!, freq * 2, 'triangle', 0.015, t + 0.02, 0.8, 2000);
      arpIdx++;
    }, 800);
  }

  stopHubDrone() {
    if (this.hubGain && this.ctx) {
      this.hubGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
      const oscs = [...this.hubOscs];
      const interval = this.hubArpInterval;
      setTimeout(() => {
        oscs.forEach(o => { try { o.stop(); } catch {} });
        if (interval) clearInterval(interval);
      }, 1800);
      this.hubOscs = [];
      this.hubNodes = [];
      this.hubGain = null;
      this.hubArpInterval = null;
    }
  }

  // =========================================================
  // DRIFT RUN MUSIC — driving bass + arp + kick/hat pattern
  // =========================================================
  startRunMusic(bpm = 138) {
    const ctx = this.ensureContext();
    if (this.runActive) return;
    this.runActive = true;

    this.runGain = ctx.createGain();
    this.runGain.gain.setValueAtTime(0, ctx.currentTime);
    this.runGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 1.5);
    this.runGain.connect(this.masterGain!);

    const beatTime = 60 / bpm;
    const eighthTime = beatTime / 2;

    // --- Sub bass: follows root pattern ---
    const bassPattern = [55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42]; // Am groove
    let bassIdx = 0;
    const bassInterval = setInterval(() => {
      if (!this.ctx || !this.runGain) return;
      const t = this.ctx.currentTime;
      const freq = bassPattern[bassIdx % bassPattern.length];
      // Sub sine
      this.note(this.runGain!, freq, 'sine', 0.1, t, beatTime * 0.9, 120);
      // Gritty layer
      this.note(this.runGain!, freq, 'sawtooth', 0.04, t, beatTime * 0.7, 250);
      bassIdx++;
    }, beatTime * 1000);
    this.runIntervals.push(bassInterval);

    // --- Synth arp: 16th note pattern ---
    const arpNotes = [
      220, 329.63, 440, 523.25,  // Am ascending
      493.88, 440, 392, 329.63,  // descending
      261.63, 329.63, 392, 523.25,  // C ascending
      493.88, 440, 329.63, 261.63,  // back down
    ];
    let arpIdx = 0;
    const arpInterval = setInterval(() => {
      if (!this.ctx || !this.runGain) return;
      const t = this.ctx.currentTime;
      const freq = arpNotes[arpIdx % arpNotes.length];
      // Main arp voice: square through bandpass
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.05, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + eighthTime * 0.7);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq * 2;
      bp.Q.value = 2;
      osc.connect(bp);
      bp.connect(env);
      env.connect(this.runGain!);
      osc.start(t);
      osc.stop(t + eighthTime);
      // Ghost note: octave up, quieter
      if (arpIdx % 4 === 2) {
        this.note(this.runGain!, freq * 2, 'triangle', 0.025, t, eighthTime * 0.5, 3000);
      }
      arpIdx++;
    }, eighthTime * 1000);
    this.runIntervals.push(arpInterval);

    // --- Drum machine: kick + hat + snare ---
    let drumStep = 0;
    const drumInterval = setInterval(() => {
      if (!this.ctx || !this.runGain) return;
      const t = this.ctx.currentTime;
      const step = drumStep % 16;

      // Kick on 1, 5, 9, 13 (four-on-floor)
      if (step % 4 === 0) {
        const kick = ctx.createOscillator();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(150, t);
        kick.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        const kickEnv = ctx.createGain();
        kickEnv.gain.setValueAtTime(0.18, t);
        kickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        kick.connect(kickEnv);
        kickEnv.connect(this.runGain!);
        kick.start(t);
        kick.stop(t + 0.3);
        // Kick click
        this.noise(this.runGain!, 0.08, t, 0.02, 5000, 'highpass');
      }

      // Snare on 5, 13
      if (step === 4 || step === 12) {
        this.noise(this.runGain!, 0.1, t, 0.15, 2000, 'highpass');
        this.note(this.runGain!, 200, 'triangle', 0.06, t, 0.1, 800);
      }

      // Hi-hat on every other 16th
      if (step % 2 === 0) {
        this.noise(this.runGain!, step % 4 === 0 ? 0.04 : 0.025, t, 0.04, 8000, 'highpass');
      }
      // Open hat on offbeats
      if (step % 4 === 2) {
        this.noise(this.runGain!, 0.03, t, 0.12, 6000, 'highpass');
      }

      drumStep++;
    }, (eighthTime / 2) * 1000); // 16th note grid
    this.runIntervals.push(drumInterval);

    // --- Pad: sustained filtered chord ---
    const padOsc1 = ctx.createOscillator();
    padOsc1.type = 'sawtooth';
    padOsc1.frequency.value = 110;
    padOsc1.detune.value = -5;
    const padOsc2 = ctx.createOscillator();
    padOsc2.type = 'sawtooth';
    padOsc2.frequency.value = 110;
    padOsc2.detune.value = 5;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 300;
    padFilter.Q.value = 3;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.035;
    padOsc1.connect(padFilter);
    padOsc2.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.runGain);
    padOsc1.start();
    padOsc2.start();
    this.runOscs.push(padOsc1, padOsc2);

    // Slow filter sweep on pad
    const sweepInterval = setInterval(() => {
      if (!this.ctx || !padFilter) return;
      const t = this.ctx.currentTime;
      padFilter.frequency.setValueAtTime(200, t);
      padFilter.frequency.linearRampToValueAtTime(600, t + 4);
      padFilter.frequency.linearRampToValueAtTime(200, t + 8);
    }, 8000);
    this.runIntervals.push(sweepInterval);
  }

  stopRunMusic() {
    if (!this.runActive) return;
    this.runActive = false;
    this.runIntervals.forEach(id => clearInterval(id));
    this.runIntervals = [];
    if (this.runGain && this.ctx) {
      this.runGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
      const oscs = [...this.runOscs];
      setTimeout(() => {
        oscs.forEach(o => { try { o.stop(); } catch {} });
      }, 1200);
    }
    this.runOscs = [];
    this.runGain = null;
  }

  // =========================================================
  // SFX
  // =========================================================

  /** Message collect — bright rising pling, pitch based on combo */
  playCollect(combo = 0) {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const baseFreq = 660 + Math.min(combo, 10) * 60; // rises with combo
    // Main tone
    this.note(this.sfxGain!, baseFreq, 'sine', 0.1, t, 0.12);
    this.note(this.sfxGain!, baseFreq * 1.5, 'triangle', 0.04, t + 0.02, 0.08, 4000);
    // Sparkle
    this.note(this.sfxGain!, baseFreq * 2, 'sine', 0.02, t + 0.04, 0.06);
  }

  /** Schema collect — magical sparkle chord */
  playSchema() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const freqs = [880, 1108.73, 1318.51, 1760]; // A5 major-ish
    freqs.forEach((f, i) => {
      this.note(this.sfxGain!, f, 'sine', 0.06, t + i * 0.04, 0.3 - i * 0.04);
      this.note(this.sfxGain!, f * 2, 'triangle', 0.02, t + i * 0.04 + 0.02, 0.15);
    });
  }

  /** Power-up collect — ascending whoosh */
  playPowerUp() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.08, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.3);
    osc.connect(f);
    f.connect(env);
    env.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.45);
    // Sparkle layer
    this.note(this.sfxGain!, 1046.5, 'sine', 0.06, t + 0.15, 0.2);
    this.note(this.sfxGain!, 1318.51, 'sine', 0.04, t + 0.2, 0.2);
  }

  /** Combo milestone (every 5) — quick rising chord burst */
  playCombo() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    this.note(this.sfxGain!, 523.25, 'triangle', 0.08, t, 0.15);
    this.note(this.sfxGain!, 659.25, 'triangle', 0.07, t + 0.05, 0.12);
    this.note(this.sfxGain!, 783.99, 'sine', 0.06, t + 0.1, 0.1);
    this.noise(this.sfxGain!, 0.04, t, 0.08, 6000, 'highpass');
  }

  /** Poison pill hit — crunchy distorted drop */
  playPoison() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    // Low impact
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
    const dist = ctx.createWaveShaper();
    {
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
      }
      dist.curve = curve;
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.15, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    osc.connect(lp);
    lp.connect(dist);
    dist.connect(env);
    env.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.45);
    // Crunch noise
    this.noise(this.sfxGain!, 0.12, t, 0.15, 1500, 'lowpass');
  }

  /** Tombstone — dark thud */
  playTombstone() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    this.note(this.sfxGain!, 80, 'sine', 0.12, t, 0.2, 200);
    this.noise(this.sfxGain!, 0.06, t, 0.08, 800, 'lowpass');
  }

  /** Checkpoint — warm confirmation ding */
  playCheckpoint() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    this.note(this.sfxGain!, 523.25, 'sine', 0.08, t, 0.3);
    this.note(this.sfxGain!, 659.25, 'sine', 0.06, t + 0.1, 0.25);
    this.note(this.sfxGain!, 783.99, 'sine', 0.05, t + 0.2, 0.3);
    this.note(this.sfxGain!, 1046.5, 'triangle', 0.03, t + 0.3, 0.35);
  }

  /** Boost engage — whoosh with reverb-like tail */
  playBoost() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    this.noise(this.sfxGain!, 0.06, t, 0.3, 3000, 'bandpass');
    this.note(this.sfxGain!, 220, 'sawtooth', 0.04, t, 0.15, 600);
  }

  /** Level up / topic cleared — triumphant fanfare */
  playLevelUp() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    fanfare.forEach((freq, i) => {
      this.note(this.sfxGain!, freq, 'sine', 0.07, t + i * 0.12, 0.5);
      this.note(this.sfxGain!, freq, 'triangle', 0.03, t + i * 0.12 + 0.01, 0.4);
      // Octave shimmer
      this.note(this.sfxGain!, freq * 2, 'sine', 0.015, t + i * 0.12 + 0.03, 0.3);
    });
    // Final impact
    this.noise(this.sfxGain!, 0.05, t + 0.5, 0.2, 5000, 'highpass');
  }

  /** Lag approaching — low rumble pulse */
  playLagWarning() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    this.note(this.sfxGain!, 40, 'sawtooth', 0.08, t, 0.5, 100);
    this.noise(this.sfxGain!, 0.04, t, 0.3, 200, 'lowpass');
  }
}
