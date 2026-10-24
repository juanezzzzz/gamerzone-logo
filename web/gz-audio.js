// Sonidos del logo GamerZone, sintetizados con Web Audio (sin archivos de audio).
// El navegador sólo permite sonar después de una interacción del usuario: llamar enable() desde un clic.

export class GZAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.ambient = null;
  }

  async enable() {
    if (!this.ctx) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(comp).connect(ctx.destination);
      // ruido blanco reutilizable
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._startAmbient();
    }
    await this.ctx.resume();
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    if (this.ctx) this.ctx.suspend();
  }

  get _ok() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

  _env(gain, t0, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  _noise(t0, dur, filterType, freq, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t0);
    f.Q.value = q;
    const g = this.ctx.createGain();
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
    return { f, g };
  }

  /** Golpe grave cuando una capa encaja. strength 0..1 */
  impact(strength = 1) {
    if (!this._ok) return;
    const t = this.ctx.currentTime, s = Math.max(0.2, strength);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.28);
    const g = this.ctx.createGain();
    o.connect(g).connect(this.master);
    this._env(g, t, 0.9 * s, 0.005, 0.38);
    o.start(t);
    o.stop(t + 0.45);
    const n = this._noise(t, 0.2, 'lowpass', 1200);
    this._env(n.g, t, 0.35 * s, 0.002, 0.16);
    const c = this._noise(t, 0.05, 'highpass', 3500);
    this._env(c.g, t, 0.18 * s, 0.001, 0.04);
  }

  /** Zumbido eléctrico cuando se enciende el neón. */
  neon() {
    if (!this._ok) return;
    const t = this.ctx.currentTime;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 1.5;
    const g = this.ctx.createGain();
    bp.connect(g).connect(this.master);
    for (const [type, f] of [['sawtooth', 120], ['square', 240]]) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(bp);
      o.start(t);
      o.stop(t + 1.0);
    }
    // parpadeo irregular, como un tubo que arranca
    g.gain.setValueAtTime(0.0001, t);
    let tt = t;
    for (const [dt, v] of [[0.04, 0.12], [0.05, 0.01], [0.04, 0.16], [0.08, 0.02], [0.05, 0.2], [0.1, 0.06], [0.35, 0.05]]) {
      tt += dt;
      g.gain.linearRampToValueAtTime(v, tt);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
  }

  /** Los ojos se encienden: barrido ascendente + brillo. */
  ignite() {
    if (!this._ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(1300, t + 0.32);
    const g = this.ctx.createGain();
    o.connect(g).connect(this.master);
    this._env(g, t, 0.22, 0.05, 0.4);
    o.start(t);
    o.stop(t + 0.5);
    for (const [f, d] of [[1760, 0.9], [2637, 0.7]]) {
      const s = this.ctx.createOscillator();
      s.type = 'sine';
      s.frequency.value = f;
      const sg = this.ctx.createGain();
      s.connect(sg).connect(this.master);
      this._env(sg, t + 0.28, 0.07, 0.01, d);
      s.start(t + 0.28);
      s.stop(t + 0.3 + d);
    }
    const n = this._noise(t, 0.4, 'bandpass', 500, 2);
    n.f.frequency.exponentialRampToValueAtTime(3000, t + 0.35);
    this._env(n.g, t, 0.12, 0.25, 0.12);
  }

  /** Soplido corto para los gestos del personaje. */
  whoosh(strength = 1) {
    if (!this._ok) return;
    const t = this.ctx.currentTime;
    const n = this._noise(t, 0.45, 'bandpass', 300, 1.2);
    n.f.frequency.exponentialRampToValueAtTime(1800, t + 0.22);
    n.f.frequency.exponentialRampToValueAtTime(500, t + 0.42);
    this._env(n.g, t, 0.25 * strength, 0.12, 0.3);
  }

  /** Zumbido de fondo muy suave (0..1), sube cuando el logo está armado. */
  setAmbient(level) {
    if (!this.ambient || !this.ctx) return;
    this.ambient.gain.setTargetAtTime(0.05 * level, this.ctx.currentTime, 0.3);
  }

  _startAmbient() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    lp.connect(g).connect(this.master);
    for (const f of [55, 55.4, 110]) {
      const o = ctx.createOscillator();
      o.type = f > 100 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
    this.ambient = g;
  }
}
