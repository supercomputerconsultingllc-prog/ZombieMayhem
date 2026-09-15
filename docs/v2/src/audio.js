const TRACKS = ['bed', 'combat', 'boss'];
const EFFECTS = ['rifle', 'shotgun', 'sniper', 'minigun', 'flame', 'tesla', 'freeze', 'grenade', 'hit', 'crit', 'kill', 'hurt', 'slam', 'loot', 'mission', 'overdrive'];
/** Original recorded buffers, synchronized stems, capped voices, separate mix buses. */
export class AudioDirector {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.buffers = {}; this.raw = {}; this.voices = new Set();
    this.stems = []; this.playing = false; this.offset = 0; this.loadPromise = null;
  }
  async preload() {
    await Promise.all([...TRACKS, ...EFFECTS].map(async id => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(new URL(`../assets/audio/${id}.mp3`, import.meta.url), { signal: controller.signal });
        if (!response.ok) return;
        this.raw[id] = await response.arrayBuffer();
      } catch { /* Audio failure must not prevent playing. */ }
      finally { clearTimeout(timeout); }
    }));
  }
  async ensure() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    if (!this.ctx) {
      const ctx = this.ctx = new Context();
      this.master = ctx.createGain(); this.music = ctx.createGain(); this.fx = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 14;
      this.music.connect(this.master); this.fx.connect(this.master); this.master.connect(limiter).connect(ctx.destination);
      this.updateSettings(this.settings);
      this.loadPromise = Promise.all(Object.entries(this.raw).map(async ([id, buffer]) => {
        try { this.buffers[id] = await ctx.decodeAudioData(buffer.slice(0)); } catch { /* optional missing codec */ }
      }));
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
    await this.loadPromise;
  }
  async startMusic() {
    this.playing = true; await this.ensure();
    if (!this.ctx || !this.playing || this.stems.length) return;
    const now = this.ctx.currentTime + .02; this.startedAt = now;
    TRACKS.forEach((id, index) => {
      const buffer = this.buffers[id]; if (!buffer) return;
      const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
      source.buffer = buffer; source.loop = true; gain.gain.value = index === 0 ? .45 : index === 1 ? .4 : 0;
      source.connect(gain).connect(this.music); source.start(now, this.offset % buffer.duration);
      this.stems.push({ id, source, gain });
    });
  }
  intensity(boss, enemies) {
    if (!this.ctx) return;
    for (const stem of this.stems) {
      const level = stem.id === 'bed' ? .4 : stem.id === 'boss' ? (boss ? .38 : 0) : .2 + Math.min(.25, enemies * .025);
      stem.gain.gain.setTargetAtTime(level, this.ctx.currentTime, .6);
    }
  }
  stopMusic(reset = false) {
    this.playing = false;
    if (this.ctx && this.stems.length) this.offset += Math.max(0, this.ctx.currentTime - this.startedAt);
    for (const stem of this.stems) { try { stem.source.stop(); } catch {} stem.source.disconnect(); stem.gain.disconnect(); }
    this.stems = []; if (reset) this.offset = 0;
  }
  play(id, x = 480, gain = .6) {
    const ctx = this.ctx, buffer = this.buffers[id];
    if (!ctx || !buffer || this.voices.size >= 24 || !this.settings.effectsVolume || !this.settings.masterVolume) return;
    const source = ctx.createBufferSource(), amp = ctx.createGain(); source.buffer = buffer;
    amp.gain.value = gain; source.connect(amp);
    const pan = ctx.createStereoPanner?.();
    if (pan) { pan.pan.value = Math.max(-.8, Math.min(.8, (x - 480) / 480)); amp.connect(pan).connect(this.fx); } else amp.connect(this.fx);
    this.voices.add(source); source.onended = () => { this.voices.delete(source); source.disconnect(); amp.disconnect(); pan?.disconnect(); };
    source.start();
  }
  event(e) {
    if (e.type === 'shot') this.play(e.weapon, e.x, .43);
    else if (e.type === 'hit' && (e.crit || e.armorBreak)) this.play('crit', e.x, .3);
    else if (e.type === 'kill') this.play('kill', e.x, .22);
    else if (e.type === 'explosion' || e.type === 'boss' || e.type === 'slam') this.play('slam', e.x, .7);
    else if (['hurt', 'loot', 'mission', 'overdrive'].includes(e.type)) this.play(e.type, e.x);
  }
  updateSettings(settings) {
    this.settings = settings;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.masterVolume / 100, now, .02);
    this.music.gain.setTargetAtTime(settings.musicVolume / 100, now, .02);
    this.fx.gain.setTargetAtTime(settings.effectsVolume / 100, now, .02);
  }
  dispose() { this.stopMusic(); for (const voice of this.voices) { try { voice.stop(); } catch {} } this.ctx?.close(); }
}
