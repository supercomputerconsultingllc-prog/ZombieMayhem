import { WIDTH, HEIGHT, LANES, BIOMES, SPECIALISTS, LIMITS } from './config.js';
import { clamp, SeededRandom, ObjectPool } from './simulation.js';
const lerp = (a, b, t) => (a ?? b) + (b - (a ?? b)) * t;
export class GameRenderer {
  constructor(canvas, settings) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.settings = settings;
    this.rng = new SeededRandom('presentation'); this.pool = new ObjectPool(LIMITS.particles); this.effects = []; this.decals = [];
    this.shake = 0; this.adaptiveQuality = 'high'; this.slowWindows = 0; this.fastWindows = 0; this.frames = 0; this.frameTime = 0; this.fps = 60;
    this.assets = {}; this.resize();
    this.vignette = this.ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 150, WIDTH / 2, HEIGHT / 2, 610);
    this.vignette.addColorStop(0, 'rgba(0,0,0,0)'); this.vignette.addColorStop(1, 'rgba(0,0,0,.65)');
  }
  async load() {
    await Promise.all(['characters', 'environments'].map(async id => {
      const image = new Image(); image.src = new URL(`../assets/${id}.png`, import.meta.url).href;
      await image.decode(); this.assets[id] = image;
    }));
  }
  resize() {
    this.scale = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = WIDTH * this.scale; this.canvas.height = HEIGHT * this.scale;
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0); this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high';
  }
  reset() { this.effects.forEach(e => this.pool.release(e)); this.effects.length = 0; this.decals.length = 0; this.shake = 0; }
  quality() { return this.settings.quality === 'auto' ? this.adaptiveQuality : this.settings.quality; }
  effect(values) { const effect = this.pool.acquire(values); if (effect) this.effects.push(effect); }
  event(e) {
    if (e.type === 'arc' || e.type === 'turret') { this.effect({ x: e.x, y: e.y || HEIGHT - 150, tx: e.targetX, ty: e.targetY, arc: true, color: e.type === 'arc' ? '#c6a7ff' : '#78e8d2', life: .15, duration: .15 }); return; }
    if (e.type === 'hit') {
      if (this.settings.damageNumbers && e.damage >= 1) this.effect({ x: e.x, y: e.y - 35, text: `${e.crit ? 'CRIT ' : ''}${e.damage}`, color: e.crit ? '#ffdd89' : '#fff', life: .65, duration: .65, vx: 0, vy: -35 });
      if (e.crit) this.shake = Math.max(this.shake, 3);
      return;
    }
    const count = ({ shot: 3, kill: 14, explosion: 30, slam: 25 })[e.type];
    if (e.type === 'hurt' || e.type === 'boss' || e.type === 'phase') this.shake = 9;
    if (!count) return;
    if (e.type === 'explosion' || e.boss) this.shake = 10;
    if (e.type === 'kill') {
      this.decals.push({ x: e.x, y: e.y, life: 6, radius: e.boss ? 45 : 16 }); if (this.decals.length > 80) this.decals.shift();
    }
    const scale = this.quality() === 'high' ? 1 : this.quality() === 'medium' ? .55 : .25;
    for (let i = 0; i < count * scale; i++) {
      const angle = this.rng.range(0, Math.PI * 2), speed = this.rng.range(35, e.type === 'explosion' ? 320 : 130), life = this.rng.range(.15, .6);
      this.effect({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color: e.color || '#f4c077', size: this.rng.range(1.5, 4), life, duration: life });
    }
  }
  sprite(ctx, row, frame, x, y, size, rotation = 0) {
    const image = this.assets.characters; if (!image) return;
    const w = image.width / 4, h = image.height / 6;
    ctx.save(); ctx.translate(x, y); if (rotation) ctx.rotate(rotation);
    ctx.drawImage(image, frame * w, row * h, w, h, -size / 2, -size / 2, size, size); ctx.restore();
  }
  render(engine, alpha = 1, dt = 0) {
    const s = engine.state, ctx = this.ctx, active = s.running && !s.paused, quality = this.quality();
    if (active) {
      this.frames++; this.frameTime += dt;
      if (this.frameTime > 2) {
        this.fps = Math.round(this.frames / this.frameTime); this.frames = 0; this.frameTime = 0;
        this.slowWindows = this.fps < 45 ? this.slowWindows + 1 : 0; this.fastWindows = this.fps > 57 ? this.fastWindows + 1 : 0;
        if (this.slowWindows >= 2) { this.adaptiveQuality = this.adaptiveQuality === 'high' ? 'medium' : 'low'; this.slowWindows = 0; }
        if (this.fastWindows >= 4) { this.adaptiveQuality = this.adaptiveQuality === 'low' ? 'medium' : 'high'; this.fastWindows = 0; }
      }
    }
    ctx.save(); ctx.fillStyle = '#071211'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const shake = this.settings.screenShake && !this.settings.reducedMotion ? this.shake : 0;
    ctx.translate(this.rng.range(-shake, shake), this.rng.range(-shake, shake)); this.shake *= Math.exp(-dt * 16);
    const biome = engine.director.biomeIndex, background = this.assets.environments;
    if (background) {
      const sw = background.width / 2, sh = background.height / 2;
      const offset = !this.settings.reducedMotion && engine.mode !== 'horde' && engine.mode !== 'bossrush' ? s.distance * 2 % (HEIGHT * 2) : 0;
      // Alternate vertical orientation so adjacent tiles share the identical edge.
      // This removes the abrupt top-to-bottom lighting seam in the authored art.
      for (let tile = -2; tile <= 0; tile++) {
        ctx.save(); ctx.translate(0, offset + tile * HEIGHT);
        if (Math.abs(tile) % 2) { ctx.translate(0, HEIGHT); ctx.scale(1, -1); }
        ctx.drawImage(background, (biome % 2) * sw, Math.floor(biome / 2) * sh, sw, sh, 0, 0, WIDTH, HEIGHT + 1);
        ctx.restore();
      }
    }
    ctx.fillStyle = this.settings.highContrast ? 'rgba(0,0,0,.48)' : 'rgba(0,0,0,.12)'; ctx.fillRect(145, 0, 670, HEIGHT);
    ctx.strokeStyle = 'rgba(224,251,247,.28)'; ctx.lineWidth = 2; ctx.setLineDash([18, 25]); ctx.lineDashOffset = -s.distance * 2;
    for (const x of [375, 585]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); } ctx.setLineDash([]);
    for (const d of this.decals) {
      if (active) d.life -= dt;
      ctx.globalAlpha = Math.max(0, d.life / 6) * .5; ctx.fillStyle = this.settings.gore ? '#7e1626' : '#111a17';
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.radius, d.radius * .5, 0, 0, Math.PI * 2); ctx.fill();
    } ctx.globalAlpha = 1; this.decals = this.decals.filter(d => d.life > 0);
    this.hazards(ctx, s, alpha);
    for (const fort of s.fortifications) if (fort.hp > 0) {
      const x = LANES[fort.lane]; ctx.fillStyle = '#345c61'; ctx.fillRect(x - 45, HEIGHT - 160, 90, 22);
      ctx.fillStyle = '#b8e4d9'; ctx.fillRect(x - 7, HEIGHT - 180, 14, 36);
      ctx.fillStyle = '#5cffbb'; ctx.fillRect(x - 45, HEIGHT - 131, .9 * fort.hp, 3);
    }
    for (const p of s.pickups) {
      const y = lerp(p.previousY, p.y, alpha); ctx.save(); ctx.translate(p.x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#162626'; ctx.fillRect(-11, -11, 22, 22); ctx.strokeStyle = p.loot.color; ctx.lineWidth = 3; ctx.strokeRect(-11, -11, 22, 22); ctx.restore();
      ctx.fillStyle = p.loot.color; ctx.font = 'bold 14px sans-serif'; ctx.fillText('+', p.x - 5, y + 5);
    }
    const rows = { walker: 1, runner: 2, crawler: 1, armored: 3, spitter: 4, exploder: 4, screamer: 2, leader: 3, tank: 3, boss: 5 };
    for (const e of s.enemies) {
      if (e.dead) continue;
      const x = lerp(e.previousX, e.x, alpha), y = lerp(e.previousY, e.y, alpha), size = e.size * 2.7;
      const frame = this.settings.reducedMotion ? 0 : Math.floor(s.time * (e.type === 'runner' ? 10 : 6) + e.id) % 4;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x, y + size * .33, e.size * .8, e.size * .3, 0, 0, Math.PI * 2); ctx.fill();
      if (e.elite || e.boss || e.status.freeze > 0 || e.status.shock > 0) {
        ctx.strokeStyle = e.status.freeze > 0 ? '#84e5ff' : e.status.shock > 0 ? '#c6a7ff' : '#ffca78'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, y + size * .33, e.size, e.size * .4, 0, 0, Math.PI * 2); ctx.stroke();
      }
      this.sprite(ctx, rows[e.type], frame, x, y, size, e.type === 'crawler' ? -.22 : 0);
      if (e.status.burn > 0) { ctx.fillStyle = '#ff833b'; ctx.globalAlpha = .65; ctx.beginPath(); ctx.arc(x - e.size * .3, y + e.size * .5, 7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      if (e.hitUntil > s.time && quality !== 'low') { ctx.strokeStyle = '#ffe4b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, e.size * .6, 0, Math.PI * 2); ctx.stroke(); }
      if (e.hp < e.maxHp || e.elite) { ctx.fillStyle = '#071110'; ctx.fillRect(x - e.size, y - size * .52, e.size * 2, 5); ctx.fillStyle = e.armor > 0 ? '#b9d6e8' : '#e97656'; ctx.fillRect(x - e.size, y - size * .52, e.size * 2 * clamp(e.hp / e.maxHp, 0, 1), 5); }
      if (e.elite || ['exploder', 'screamer', 'leader', 'tank'].includes(e.type)) { ctx.fillStyle = '#fff0c7'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(e.elite ? `ELITE ${e.type.toUpperCase()}` : e.type.toUpperCase(), x, y - size * .57); ctx.textAlign = 'left'; }
    }
    for (const shot of s.enemyProjectiles) { ctx.fillStyle = '#d2ff67'; ctx.beginPath(); ctx.arc(lerp(shot.previousX, shot.x, alpha), lerp(shot.previousY, shot.y, alpha), 9, 0, Math.PI * 2); ctx.fill(); }
    for (const b of s.bullets) {
      const x = lerp(b.previousX, b.x, alpha), y = lerp(b.previousY, b.y, alpha);
      ctx.strokeStyle = b.color; ctx.lineWidth = b.size * 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - b.vx * .016, y - b.vy * .016); ctx.stroke();
    }
    this.squad(ctx, s, alpha);
    for (const p of this.effects) {
      if (active) { p.life -= dt; if (!p.arc) { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; } }
      ctx.globalAlpha = clamp(p.life / p.duration, 0, 1); ctx.fillStyle = p.color;
      if (p.arc) { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo((p.x + p.tx) / 2 + 12, (p.y + p.ty) / 2); ctx.lineTo(p.tx, p.ty); ctx.stroke(); }
      else if (p.text) { ctx.font = 'bold 15px system-ui'; ctx.fillText(p.text, p.x, p.y); }
      else ctx.fillRect(p.x, p.y, p.size, p.size);
    } ctx.globalAlpha = 1; this.pool.compact(this.effects, p => p.life > 0);
    if (quality === 'high' && !this.settings.reducedMotion) {
      ctx.fillStyle = biome === 2 ? '#ffb570' : '#c7e5de'; ctx.globalAlpha = .35;
      for (let i = 0; i < 18; i++) ctx.fillRect((i * 73 + Math.sin(s.time + i) * 18) % WIDTH, (i * 53 + s.time * (biome === 2 ? -18 : 30) + 99999) % HEIGHT, 2, biome === 0 ? 8 : 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = this.vignette; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#d2e8de'; ctx.font = 'bold 12px system-ui'; ctx.fillText(BIOMES[biome].name.toUpperCase(), 22, HEIGHT - 22);
    ctx.restore();
  }
  squad(ctx, s, alpha) {
    const x = lerp(s.previousLaneX, s.laneX, alpha), count = Math.min(12, Math.ceil(s.squad));
    for (let i = count - 1; i >= 0; i--) {
      const row = Math.floor(i / 4), col = i % 4;
      let dx = (col - 1.5) * 26, dy = row * 23;
      if (s.formation === 'wedge') { dx = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 15; dy = Math.ceil(i / 2) * 10; }
      if (s.formation === 'wide') { dx = (col - 1.5) * 43; dy = row * 17; }
      const specialist = SPECIALISTS[s.specialists[i - 1]], px = x + dx, py = HEIGHT - 101 + dy;
      this.sprite(ctx, 0, this.settings.reducedMotion ? 0 : Math.floor(s.time * 8 + i % 2) % 4, px, py, 64);
      ctx.fillStyle = i === 0 ? '#ffc766' : specialist?.color || '#67d6c5'; ctx.beginPath(); ctx.ellipse(px, py + 26, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#091713'; ctx.fillRect(x - 80, HEIGHT - 18, 160, 6);
    ctx.fillStyle = s.time < s.overdriveUntil ? '#ffc766' : '#67e3d6'; ctx.fillRect(x - 80, HEIGHT - 18, 160 * s.overdrive / 100, 6);
    if (s.heat) { ctx.fillStyle = '#ff895b'; ctx.fillRect(x - 80, HEIGHT - 9, 160 * s.heat / 100, 3); }
  }
  hazards(ctx, s, alpha) {
    for (const h of s.hazards) {
      if (h.dead) continue;
      const y = lerp(h.previousY, h.y, alpha);
      if (h.type === 'strike') {
        ctx.fillStyle = h.warning > 0 ? 'rgba(255,141,79,.2)' : 'rgba(255,99,60,.7)'; ctx.fillRect(h.x - 85, 215, 170, HEIGHT - 240);
        ctx.strokeStyle = '#ffbd7b'; ctx.lineWidth = 3; ctx.strokeRect(h.x - 85, 215, 170, HEIGHT - 240);
        ctx.fillStyle = '#ffe3c2'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText(h.warning > 0 ? '! INCOMING' : 'IMPACT', h.x, 280); ctx.textAlign = 'left';
      } else if (h.type === 'barrel') {
        ctx.fillStyle = '#d9a642'; ctx.fillRect(h.x - 23, y - 30, 46, 60); ctx.strokeStyle = '#1c2729'; ctx.lineWidth = 6; ctx.strokeRect(h.x - 23, y - 30, 46, 60); ctx.fillStyle = '#272420'; ctx.font = 'bold 28px sans-serif'; ctx.fillText('!', h.x - 5, y + 10);
      } else if (h.type === 'wreck') {
        ctx.fillStyle = '#1c282c'; ctx.fillRect(h.x - 40, y - 48, 80, 96); ctx.fillStyle = '#859b9e'; ctx.fillRect(h.x - 32, y - 35, 64, 70); ctx.fillStyle = '#18292f'; ctx.fillRect(h.x - 25, y - 19, 50, 22);
      } else {
        ctx.fillStyle = h.type === 'fire' ? 'rgba(255,121,45,.75)' : 'rgba(76,175,218,.5)'; ctx.beginPath(); ctx.ellipse(h.x, y, 63, 43, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = h.type === 'fire' ? '#ffe4a0' : '#abf4ff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(h.type === 'fire' ? 'FIRE' : 'SLOW', h.x, y + 5); ctx.textAlign = 'left';
      }
    }
  }
}
