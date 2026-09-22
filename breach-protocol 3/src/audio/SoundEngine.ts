/**
 * BREACH PROTOCOL - Procedural Web Audio Sound Engine
 * Synthesizes tactical audio in real-time with 3D spatial pan and attenuation.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.7, this.ctx.currentTime);
    }
  }

  // Calculate 3D distance volume attenuation and stereo panning
  private getSpatialPanner(sourcePos?: { x: number; y: number; z: number }, listenerPos?: { x: number; y: number; z: number }) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return null;

    let distGain = 1.0;
    let panValue = 0.0;

    if (sourcePos && listenerPos) {
      const dx = sourcePos.x - listenerPos.x;
      const dy = sourcePos.y - listenerPos.y;
      const dz = sourcePos.z - listenerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Inverse falloff with cutoff
      const maxDistance = 45;
      if (dist > maxDistance) return null;
      distGain = Math.max(0.02, 1.0 - (dist / maxDistance));

      // Stereo pan
      panValue = Math.max(-1, Math.min(1, dx / 15));
    }

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = panValue;
    }

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(distGain, this.ctx.currentTime);

    if (panner) {
      panner.connect(this.masterGain);
      gainNode.connect(panner);
    } else {
      gainNode.connect(this.masterGain);
    }

    return gainNode;
  }

  // Gunfire synthesis
  public playGunshot(profile: 'rifle' | 'heavy' | 'smg' | 'shotgun' | 'pistol' | 'suppressed' = 'rifle', sourcePos?: { x: number; y: number; z: number }, listenerPos?: { x: number; y: number; z: number }) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const outNode = this.getSpatialPanner(sourcePos, listenerPos);
    if (!outNode) return;

    const now = this.ctx.currentTime;

    // Noise burst for mechanical attack / gas blast
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * (profile === 'shotgun' ? 0.35 : 0.15)));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = profile === 'suppressed' ? 'lowpass' : 'bandpass';
    noiseFilter.frequency.setValueAtTime(profile === 'suppressed' ? 600 : (profile === 'heavy' ? 1200 : 2400), now);
    noiseFilter.Q.setValueAtTime(1.5, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(profile === 'suppressed' ? 0.25 : 0.8, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (profile === 'shotgun' ? 0.2 : 0.12));

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(outNode);
    noise.start(now);

    // Punchy low-end sub-oscillator
    if (profile !== 'suppressed') {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      const startFreq = profile === 'heavy' ? 180 : (profile === 'shotgun' ? 120 : 150);
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.14);

      oscGain.gain.setValueAtTime(profile === 'heavy' ? 0.9 : 0.6, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(oscGain);
      oscGain.connect(outNode);

      osc.start(now);
      osc.stop(now + 0.16);
    }
  }

  // Powerful explosion for breach charges / grenades
  public playExplosion(sourcePos?: { x: number; y: number; z: number }, listenerPos?: { x: number; y: number; z: number }) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const outNode = this.getSpatialPanner(sourcePos, listenerPos);
    if (!outNode) return;

    const now = this.ctx.currentTime;

    // Sub rumble oscillator
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(130, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.8);

    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    subOsc.connect(subGain);
    subGain.connect(outNode);
    subOsc.start(now);
    subOsc.stop(now + 1.2);

    // Shockwave noise burst
    const dur = 1.4;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(120, now + dur);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(outNode);
    noise.start(now);
  }

  // Wood barricade hammering / destruction sound
  public playBarricadeHit(sourcePos?: { x: number; y: number; z: number }, listenerPos?: { x: number; y: number; z: number }) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const outNode = this.getSpatialPanner(sourcePos, listenerPos);
    if (!outNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(outNode);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Glass shattering
  public playGlassBreak(sourcePos?: { x: number; y: number; z: number }, listenerPos?: { x: number; y: number; z: number }) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const outNode = this.getSpatialPanner(sourcePos, listenerPos);
    if (!outNode) return;

    const now = this.ctx.currentTime;
    const dur = 0.4;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(outNode);
    noise.start(now);
  }

  // Footstep synthesis with surface profiles
  public playFootstep(surface: 'concrete' | 'wood' | 'metal' | 'gravel' = 'concrete', isSprint = false, sourcePos?: { x: number; y: number; z: number }, listenerPos?: { x: number; y: number; z: number }) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const outNode = this.getSpatialPanner(sourcePos, listenerPos);
    if (!outNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const basePitch = surface === 'wood' ? 120 : (surface === 'metal' ? 380 : 80);
    osc.frequency.setValueAtTime(basePitch, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.05);

    const vol = isSprint ? 0.35 : 0.18;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(outNode);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Drone motor hum
  public playDroneHop() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(380, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // UI / Tactical Radio ping
  public playRadioPing(isEnemy: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const f1 = isEnemy ? 880 : 587.33;
    const f2 = isEnemy ? 1174.66 : 880;

    osc.frequency.setValueAtTime(f1, now);
    osc.frequency.setValueAtTime(f2, now + 0.06);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Defuser tick / countdown
  public playDefuserTick(isDefusing: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDefusing ? 1760 : 1320, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Reload click
  public playReloadSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.setValueAtTime(750, now + 0.06);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // Hitmarker sound
  public playHitmarker() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.setValueAtTime(1850, now + 0.03);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Gadget deployment click / mount
  public playGadgetDeploy() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // EMP discharge sound
  public playEmpDischarge() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  // Gas / Smoke / Fire hiss
  public playGasHiss(duration = 2.0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(1.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  // Flashbang pop & high-pitch ring
  public playFlashbang() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    // Pop
    const pop = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    pop.frequency.setValueAtTime(260, now);
    pop.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    popGain.gain.setValueAtTime(0.5, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    pop.connect(popGain);
    popGain.connect(this.masterGain);
    pop.start(now);
    pop.stop(now + 0.13);

    // High tinnitus ringing
    const ring = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(4200, now);
    ringGain.gain.setValueAtTime(0.25, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    ring.connect(ringGain);
    ringGain.connect(this.masterGain);
    ring.start(now);
    ring.stop(now + 1.3);
  }

  // Cardiac heartbeat thump (Pulse)
  public playHeartbeat() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    [0, 0.14].forEach(delay => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, now + delay);
      osc.frequency.exponentialRampToValueAtTime(35, now + delay + 0.08);

      gain.gain.setValueAtTime(0.4, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + delay);
      osc.stop(now + delay + 0.12);
    });
  }

  // Dokkaebi phone buzzer ring
  public playPhoneBuzz() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Electric taser shock / Shock wire
  public playShockZap() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(1200, now + 0.04);
    osc.frequency.setValueAtTime(600, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Sledgehammer heavy strike
  public playSledgeSmash() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.2);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
    this.playBarricadeHit();
  }
}

export const sound = new SoundEngine();
