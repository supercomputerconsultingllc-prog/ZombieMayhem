import { WIDTH, HEIGHT, BIOMES, SPECIALISTS, LIMITS } from './config.js';
import { clamp, SeededRandom, ObjectPool } from './simulation.js';
import { squadLayout, pickupSprite, PROJECTILE_STYLES } from './presentation.js';
const lerp = (a, b, t) => (a ?? b) + (b - (a ?? b)) * t;
export class GameRenderer {
  constructor(canvas, settings) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.settings = settings;
    this.rng = new SeededRandom('presentation'); this.pool = new ObjectPool(LIMITS.particles); this.effects = []; this.decals = [];
    this.shake = 0; this.adaptiveQuality = 'high'; this.slowWindows = 0; this.fastWindows = 0; this.frames = 0; this.frameTime = 0; this.fps = 60;
    this.assets = {}; this.resize();
    this.flame = document.createElement('canvas'); this.flame.width = 96; this.flame.height = 128;
    const fire = this.flame.getContext('2d'), glow = fire.createRadialGradient(48, 47, 2, 48, 55, 44);
    glow.addColorStop(0, '#fff8b8'); glow.addColorStop(.2, '#ffe27a'); glow.addColorStop(.45, '#ff9b22'); glow.addColorStop(.7, 'rgba(242,65,12,.6)'); glow.addColorStop(1, 'rgba(146,25,7,0)');
    fire.fillStyle = glow; fire.fillRect(0, 0, 96, 128); fire.translate(16, 12);
    fire.fillStyle = 'rgba(255,242,159,.65)'; fire.beginPath(); fire.moveTo(30, 10); fire.bezierCurveTo(22, 30, 17, 34, 27, 55); fire.bezierCurveTo(26, 41, 39, 40, 36, 24); fire.lineTo(32, 35); fire.closePath(); fire.fill();
    this.vignette = this.ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 150, WIDTH / 2, HEIGHT / 2, 610);
    this.vignette.addColorStop(0, 'rgba(0,0,0,0)'); this.vignette.addColorStop(1, 'rgba(0,0,0,.65)');
  }
  async load() {
    await Promise.all(['characters', 'environments', 'combat-props'].map(async id => {
      const image = new Image(); image.src = new URL(`../assets/${id}.png`, import.meta.url).href;
      await image.decode(); this.assets[id] = image;
    }));
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.viewWidth = clamp(HEIGHT * (rect.width / Math.max(1, rect.height)), 300, WIDTH);
    this.offsetX = (WIDTH - this.viewWidth) / 2;
    // Match physical display pixels, with a lower cap on phones to control fill cost.
    const dpr = Math.min(window.devicePixelRatio || 1, this.viewWidth < 720 ? 1.5 : 2);
    this.scale = Math.max(.5, rect.height / HEIGHT * dpr);
    const width = Math.round(this.viewWidth * this.scale), height = Math.round(HEIGHT * this.scale);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0); this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high';
  }
  reset() { this.effects.forEach(e => this.pool.release(e)); this.effects.length = 0; this.decals.length = 0; this.shake = 0; }
  quality() { return this.settings.quality === 'auto' ? this.adaptiveQuality : this.settings.quality; }
  effect(values) { const effect = this.pool.acquire(values); if (effect) this.effects.push(effect); }
  event(e) {
    if (e.type === 'loot') { this.effect({ x: e.x, y: e.y, ring: true, radius: 42, color: e.color, life: .4, duration: .4 }); return; }
    if (e.type === 'shot') { this.effect({ x: e.x, y: e.y, muzzle: true, weapon: e.weapon, aim: e.aim, color: e.color, life: .08, duration: .08 }); return; }
    if (e.type === 'explosion') this.effect({ x: e.x, y: e.y, ring: true, radius: e.radius || 115, color: '#ffbb68', life: .45, duration: .45 });
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
  prop(ctx, index, x, y, size) {
    const image = this.assets['combat-props']; if (!image) return;
    const w = image.width / 3, h = image.height / 3;
    ctx.drawImage(image, index % 3 * w, Math.floor(index / 3) * h, w, h, x - size / 2, y - size / 2, size, size);
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
    ctx.save(); ctx.translate(-this.offsetX, 0); ctx.fillStyle = '#071211'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
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
    for (const d of this.decals) {
      if (active) d.life -= dt;
      ctx.globalAlpha = Math.max(0, d.life / 6) * .5; ctx.fillStyle = this.settings.gore ? '#7e1626' : '#111a17';
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.radius, d.radius * .5, 0, 0, Math.PI * 2); ctx.fill();
    } ctx.globalAlpha = 1; this.decals = this.decals.filter(d => d.life > 0);
    this.hazards(ctx, s, alpha);
    for (const fort of s.fortifications) if (fort.hp > 0) {
      this.prop(ctx, 4, fort.x, HEIGHT - 150, 108);
      ctx.fillStyle = '#5cffbb'; ctx.fillRect(fort.x - 30, HEIGHT - 108, .6 * fort.hp, 3);
    }
    for (const p of s.pickups) {
      const y = lerp(p.previousY, p.y, alpha), bob = this.settings.reducedMotion ? 0 : Math.sin(s.time * 4 + p.id) * 3;
      ctx.strokeStyle = p.loot.color; ctx.lineWidth = 2; ctx.globalAlpha = .75;
      ctx.beginPath(); ctx.ellipse(p.x, y + 20, 24, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      this.prop(ctx, pickupSprite(p.loot.apply), p.x, y + bob, 74);
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
    }
    for (const shot of s.enemyProjectiles) { ctx.fillStyle = '#d2ff67'; ctx.beginPath(); ctx.arc(lerp(shot.previousX, shot.x, alpha), lerp(shot.previousY, shot.y, alpha), 9, 0, Math.PI * 2); ctx.fill(); }
    this.squad(ctx, s, alpha);
    for (const b of s.bullets) this.projectile(ctx, b, alpha);
    for (const p of this.effects) {
      if (active) { p.life -= dt; if (!p.arc) { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; } }
      ctx.globalAlpha = clamp(p.life / p.duration, 0, 1); ctx.fillStyle = p.color;
      if (p.ring) { const radius = p.radius * (1 - p.life / p.duration); ctx.strokeStyle = p.color; ctx.lineWidth = 5 * p.life / p.duration + 1; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha *= .2; ctx.fill(); }
      else if (p.muzzle) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.aim || 0); const size = p.weapon === 'shotgun' ? 20 : p.weapon === 'sniper' ? 25 : 12; ctx.beginPath(); ctx.moveTo(-5, 3); ctx.lineTo(-8, -size * .5); ctx.lineTo(-2, -size * .4); ctx.lineTo(0, -size); ctx.lineTo(4, -size * .5); ctx.lineTo(8, -size * .6); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill(); ctx.restore(); }
      else if (p.arc) { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo((p.x + p.tx) / 2 + 12, (p.y + p.ty) / 2); ctx.lineTo(p.tx, p.ty); ctx.stroke(); }
      else if (p.text) { ctx.font = 'bold 15px system-ui'; ctx.fillText(p.text, p.x, p.y); }
      else ctx.fillRect(p.x, p.y, p.size, p.size);
    } ctx.globalAlpha = 1; this.pool.compact(this.effects, p => p.life > 0);
    if (quality === 'high' && !this.settings.reducedMotion) {
      ctx.fillStyle = biome === 2 ? '#ffb570' : '#c7e5de'; ctx.globalAlpha = .35;
      for (let i = 0; i < 18; i++) ctx.fillRect((i * 73 + Math.sin(s.time + i) * 18) % WIDTH, (i * 53 + s.time * (biome === 2 ? -18 : 30) + 99999) % HEIGHT, 2, biome === 0 ? 8 : 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = this.vignette; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#d2e8de'; ctx.font = 'bold 12px system-ui'; ctx.fillText(BIOMES[biome].name.toUpperCase(), this.offsetX + 14, HEIGHT - 22);
    ctx.restore();
  }
  projectile(ctx, b, alpha) {
    if (b.dead) return;
    const x = lerp(b.previousX, b.x, alpha), y = lerp(b.previousY, b.y, alpha), age = b.age || 0;
    const style = b.style || PROJECTILE_STYLES[b.weapon];
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(b.vx, -b.vy));
    ctx.lineCap = 'round'; ctx.strokeStyle = b.color; ctx.fillStyle = b.color;
    const line = (length, width, color) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, length); ctx.stroke(); };
    if (style === 'fire') {
      const radius = 7 + Math.min(18, age * 24);
      ctx.globalAlpha = Math.min(1, b.life * 2); ctx.rotate(Math.sin(age * 23 + b.id) * .2);
      ctx.drawImage(this.flame, -radius * 1.4, -radius * 1.5, radius * 2.8, radius * 4);
    } else if (style === 'lightning') {
      ctx.globalAlpha = .22; line(75, 17, '#ad76ff'); ctx.globalAlpha = 1;
      const bolt = () => { ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 1; i <= 6; i++) ctx.lineTo((i % 2 ? 1 : -1) * (6 + Math.sin(age * 32 + i) * 4), i * 12); ctx.stroke(); };
      ctx.strokeStyle = '#a46dff'; ctx.lineWidth = 6; bolt(); ctx.strokeStyle = '#f2e4ff'; ctx.lineWidth = 2; bolt();
    } else if (style === 'ice') {
      ctx.globalAlpha = .35; line(35, 8, '#41b8ff'); ctx.globalAlpha = 1;
      ctx.fillStyle = '#b9f8ff'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(7, 2); ctx.lineTo(0, 13); ctx.lineTo(-7, 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); line(7, 2, '#4babdf');
    } else if (style === 'grenade') {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(10, 12, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(age * 9); ctx.fillStyle = '#556f28'; ctx.strokeStyle = '#d1e786'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c7d5ac'; ctx.fillRect(-3, -13, 6, 5); ctx.fillStyle = '#ffeaa2'; ctx.beginPath(); ctx.arc(2, -16, 3, 0, Math.PI * 2); ctx.fill();
    } else if (style === 'rail') {
      ctx.globalAlpha = .22; line(115, 13, '#55dbff'); ctx.globalAlpha = .65; line(100, 5, '#72e8ff'); ctx.globalAlpha = 1; line(70, 1.5, '#fff');
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    } else if (style === 'pellet') {
      line(9, 4, '#ffbe60'); ctx.fillStyle = '#fff3ba'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else if (style === 'streak') {
      line(28, 4, '#ff923e'); line(20, 1.5, '#fff6ca');
    } else { line(20, 3, '#edcd75'); line(12, 1.5, '#fff'); }
    ctx.restore();
  }
  weaponModel(ctx, weapon, x, y, aim) {
    ctx.save(); ctx.translate(x + 4, y - 9); ctx.rotate(aim || 0); ctx.scale(.4, .4);
    const length = weapon === 'sniper' ? 29 : weapon === 'shotgun' ? 22 : 17;
    ctx.fillStyle = '#152024'; ctx.fillRect(-4, -length, 8, length + 10); ctx.fillStyle = '#a6b2a7'; ctx.fillRect(-2, -length, 3, length);
    if (weapon === 'minigun') { ctx.fillStyle = '#647375'; ctx.fillRect(-7, -23, 14, 20); ctx.fillStyle = '#202f30'; for (let i = -5; i <= 5; i += 5) ctx.fillRect(i, -26, 2, 26); }
    if (weapon === 'sniper') { ctx.fillStyle = '#6be0eb'; ctx.fillRect(-6, -15, 6, 9); }
    if (weapon === 'shotgun') { ctx.fillStyle = '#9c6945'; ctx.fillRect(-5, -12, 10, 7); ctx.fillStyle = '#b1b6ad'; ctx.fillRect(3, -23, 3, 11); }
    if (['flame', 'freeze', 'tesla'].includes(weapon)) {
      ctx.fillStyle = weapon === 'flame' ? '#e8873b' : weapon === 'freeze' ? '#8bedff' : '#c2a1ff';
      ctx.beginPath(); ctx.ellipse(-7, 3, 5, 10, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i++) ctx.fillRect(-5, -18 + i * 5, 10, 2);
    }
    if (weapon === 'grenade') { ctx.fillStyle = '#87964a'; ctx.fillRect(-6, -17, 12, 19); ctx.fillStyle = '#233124'; ctx.fillRect(-4, -20, 8, 5); }
    ctx.restore();
  }
  squad(ctx, s, alpha) {
    const x = lerp(s.previousX, s.x, alpha), y = lerp(s.previousY, s.y, alpha), layout = squadLayout(s.squad, s.formation);
    for (let i = 0; i < layout.slots.length; i++) {
      const slot = layout.slots[i], specialist = SPECIALISTS[s.specialists[i - 1]], px = x + slot.x, py = y + slot.y;
      ctx.fillStyle = i === 0 ? '#ffc766' : specialist?.color || '#67d6c5'; ctx.beginPath(); ctx.ellipse(px, py + 19, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
      this.sprite(ctx, 0, this.settings.reducedMotion ? 0 : Math.floor(s.time * 8 + i % 2) % 4, px, py, 48);
      this.weaponModel(ctx, s.selectedWeapon, px, py, s.aim);
    }
    const barY = y + layout.halfHeight + 5;
    ctx.fillStyle = '#091713'; ctx.fillRect(x - 55, barY, 110, 5);
    ctx.fillStyle = s.time < s.overdriveUntil ? '#ffc766' : '#67e3d6'; ctx.fillRect(x - 55, barY, 110 * s.overdrive / 100, 5);
    if (s.heat) { ctx.fillStyle = '#ff895b'; ctx.fillRect(x - 55, barY + 8, 110 * s.heat / 100, 3); }
  }
  hazards(ctx, s, alpha) {
    for (const h of s.hazards) {
      if (h.dead) continue;
      const y = lerp(h.previousY, h.y, alpha);
      if (h.type === 'strike') {
        ctx.fillStyle = h.warning > 0 ? 'rgba(255,141,79,.2)' : 'rgba(255,99,60,.7)'; ctx.beginPath(); ctx.arc(h.x, y, h.size, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffbd7b'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(h.x, y, h.size * clamp(h.warning / 1.25, 0, 1), 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(h.x - 12, y); ctx.lineTo(h.x + 12, y); ctx.moveTo(h.x, y - 12); ctx.lineTo(h.x, y + 12); ctx.stroke();
      } else {
        const index = { wreck: 0, barrel: 1, fire: 2, flood: 3 }[h.type];
        const size = h.type === 'barrel' ? 110 : h.type === 'wreck' ? 140 : 145;
        this.prop(ctx, index, h.x, y, size);
        if (h.type === 'fire' && !this.settings.reducedMotion) {
          ctx.fillStyle = '#ffb957'; ctx.globalAlpha = .6;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(h.x + Math.sin(i * 13 + s.time) * 24, y - (s.time * 35 + i * 19) % 65, 2, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
        }
        if (Number.isFinite(h.hp) && h.hp < (h.type === 'wreck' ? 100 : 35)) {
          ctx.fillStyle = '#131c1a'; ctx.fillRect(h.x - 25, y - 48, 50, 3);
          ctx.fillStyle = '#eeaa74'; ctx.fillRect(h.x - 25, y - 48, 50 * Math.max(0, h.hp) / (h.type === 'wreck' ? 100 : 35), 3);
        }
      }
    }
  }
}
