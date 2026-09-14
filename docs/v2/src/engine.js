import { WIDTH, HEIGHT, MODES, WEAPONS, ENEMIES, LOOT, FORMATIONS, SPECIALISTS, RUN_UPGRADES, EVOLUTIONS, MISSION_TEMPLATES, LIMITS } from './config.js';
import { SeededRandom, SpatialGrid, ObjectPool, EventBus, clamp, sweptCircleTime, sweptCircleHit } from './simulation.js';
import { RunDirector } from './director.js';
import { squadLayout, PROJECTILE_STYLES } from './presentation.js';

/** Owns gameplay only. Presentation and persistence subscribe to discrete events. */
export class CombatEngine {
  constructor(profile, mode = 'campaign', seed = '1', tutorial = false) {
    this.profile = profile; this.mode = Object.hasOwn(MODES, mode) ? mode : 'campaign';
    this.modeConfig = MODES[this.mode]; this.seed = seed;
    this.rng = new SeededRandom(`${seed}:${this.mode}`); this.events = new EventBus(); this.sequence = 0;
    this.grid = new SpatialGrid(); this.pools = Object.fromEntries(Object.entries(LIMITS).map(([id, limit]) => [id, new ObjectPool(limit)]));
    this.state = {
      running: true, paused: false, gameOver: false, victory: false, time: 0, distance: 0, wave: 1, waveStart: 0,
      x: WIDTH / 2, previousX: WIDTH / 2, targetX: WIDTH / 2, y: HEIGHT - 115, previousY: HEIGHT - 115, targetY: HEIGHT - 115, inputX: 0, inputY: 0, squad: 8 + this.skill('command_squad') * 2,
      armor: this.skill('medic_armor') * 12, revives: 1 + this.skill('command_revive'), baseHealth: 100,
      credits: 0, creditsEarned: 0, kills: 0, eliteKills: 0, bosses: 0, fireTimer: 0, spawnTimer: .7,
      overdrive: 100, overdriveUntil: 0, heat: 0, runDamage: 1, fireRate: 1, runLuck: 0, incomingDamage: 1,
      selectedWeapon: 'rifle', formation: 'wedge', specialists: [], upgrades: {}, evolutions: {}, mastery: {},
      nextWaveDistance: 260, waveSpawned: 0, waveResolved: 0, boss: null, bossDelay: 1,
      pendingDrafts: 0, draft: null, nextHazard: 10, extracting: false, extractProgress: 0,
      enemies: [], bullets: [], particles: [], pickups: [], enemyProjectiles: [], hazards: [], fortifications: [],
      damageDealt: 0, shots: 0, hits: 0, combo: 0, bestCombo: 0, comboUntil: 0,
      missionIndex: 0, missionValue: 0, missionBase: 0, mission: null,
      tutorial: tutorial ? 0 : -1, tutorialKills: 0, slowedUntil: 0, invulnerableUntil: 0
    };
    this.setViewport(); this.director = new RunDirector(this); this.setMission(0);
  }
  skill(id) { return this.profile.skills?.[id] || 0; }
  emit(type, data = {}) { this.events.emit({ type, ...data }); }
  spawn(group, values) {
    const entity = this.pools[group].acquire({ dead: false, id: ++this.sequence, ...values });
    if (entity) this.state[group].push(entity);
    return entity;
  }
  weapon() {
    const id = this.state.selectedWeapon, base = WEAPONS[id];
    const branch = EVOLUTIONS[id].find(item => item.id === this.state.evolutions[id]);
    return branch ? { ...base, ...branch.mods, name: branch.name } : base;
  }
  selectWeapon(id) {
    if (!Object.hasOwn(WEAPONS, id) || !(this.profile.unlockedWeapons.includes(id) || this.profile.accountLevel >= WEAPONS[id].unlock)) return false;
    this.state.selectedWeapon = id; this.emit('weapon', { name: this.weapon().name }); return true;
  }
  setViewport(width = WIDTH) {
    this.viewWidth = clamp(width, 300, WIDTH); this.syncSquadBounds();
    const s = this.state;
    for (const group of ['enemies', 'hazards', 'pickups', 'fortifications']) for (const item of s[group]) {
      item.x = clamp(item.x, this.bounds.left, this.bounds.right); item.previousX = item.x;
    }
  }
  syncSquadBounds() {
    const s = this.state, layout = squadLayout(s.squad, s.formation), half = this.viewWidth / 2;
    this.layoutKey = `${Math.ceil(s.squad)}:${s.formation}`;
    const margin = Math.max(65, layout.halfWidth + 10);
    this.bounds = { left: WIDTH / 2 - half + margin, right: WIDTH / 2 + half - margin, top: 300, bottom: Math.min(HEIGHT - 95, HEIGHT - layout.halfHeight - 28) };
    s.x = clamp(s.x, this.bounds.left, this.bounds.right); s.y = clamp(s.y, this.bounds.top, this.bounds.bottom);
    s.previousX = s.x; s.previousY = s.y;
    s.targetX = clamp(s.targetX, this.bounds.left, this.bounds.right); s.targetY = clamp(s.targetY, this.bounds.top, this.bounds.bottom);
  }
  moveTo(x, y = this.state.y) {
    const s = this.state; if (!s.running || s.paused || s.gameOver || !Number.isFinite(x) || !Number.isFinite(y)) return;
    s.targetX = clamp(x, this.bounds.left, this.bounds.right); s.targetY = clamp(y, this.bounds.top, this.bounds.bottom);
    if (s.tutorial === 0 && Math.hypot(s.targetX - s.x, s.targetY - s.y) > 2) { s.tutorial = 1; this.emit('tutorial'); }
  }
  moveAxes(x, y) {
    const s = this.state;
    if (s.paused || s.gameOver) return;
    s.inputX = clamp(x, -1, 1); s.inputY = clamp(y, -1, 1);
    if (s.tutorial === 0 && (x || y)) { s.tutorial = 1; this.emit('tutorial'); }
  }
  stopMovement() { const s = this.state; s.inputX = s.inputY = 0; s.targetX = s.x; s.targetY = s.y; }
  overdrive() {
    const s = this.state; if (s.paused || s.gameOver || s.overdrive < 100) return false;
    s.overdrive = 0; s.overdriveUntil = s.time + 5.5 * (1 + this.skill('engineer_overdrive') * .12);
    if (s.tutorial === 1) { s.tutorial = 2; s.tutorialKills = s.kills; this.emit('tutorial'); }
    this.emit('overdrive'); return true;
  }
  skipTutorial() { this.state.tutorial = -1; this.emit('tutorialComplete'); }
  extract() {
    const s = this.state;
    if (this.mode !== 'extraction' || s.distance < 600 || s.paused || s.gameOver) return false;
    s.extracting = !s.extracting; s.extractProgress = 0; this.emit('evac', { active: s.extracting }); return true;
  }
  setMission(index) {
    const template = MISSION_TEMPLATES[index % MISSION_TEMPLATES.length];
    this.state.mission = { ...template, target: Math.round(template.target * (1 + Math.floor(index / 6) * .35)) };
    this.state.missionIndex = index; this.state.missionBase = this.metric(template.type); this.state.missionValue = 0;
  }
  metric(type) { const s = this.state; return ({ kills: s.kills, distance: s.distance, elite: s.eliteKills, credits: s.creditsEarned, survive: s.time, boss: s.bosses })[type]; }
  updateMission() {
    const s = this.state, m = s.mission;
    s.missionValue = this.metric(m.type) - s.missionBase;
    if (s.missionValue >= m.target) {
      this.credit(m.reward); s.pendingDrafts++; this.emit('mission', { reward: m.reward }); this.setMission(s.missionIndex + 1);
    }
  }
  credit(amount) { this.state.credits += amount; this.state.creditsEarned += amount; }
  spawnEnemy(forcedType = null) {
    const s = this.state; if (s.enemies.length >= LIMITS.enemies) return null;
    let type = forcedType;
    if (!type) {
      const unlock = { walker: 1, runner: 1, crawler: 2, armored: 3, spitter: 3, exploder: 4, screamer: 5, leader: 5, tank: 6 };
      const choices = Object.entries(ENEMIES).filter(([id]) => id !== 'boss' && s.wave >= unlock[id]);
      let roll = this.rng.range(0, choices.reduce((sum, [, item]) => sum + item.weight, 0));
      type = choices.find(([, item]) => (roll -= item.weight) <= 0)?.[0] || 'walker';
    }
    const base = ENEMIES[type];
    const elite = type !== 'boss' && this.rng.chance(Math.min(.03 + s.wave * .006, .22));
    const scale = (1 + (s.wave - 1) * .1) * (elite ? 1.75 : 1);
    const hp = base.hp * scale * (type === 'boss' && this.mode === 'bossrush' ? .75 : 1);
    const x = type === 'boss' ? WIDTH / 2 : this.rng.range(this.bounds.left, this.bounds.right), y = -base.size - this.rng.range(0, 90);
    const enemy = this.spawn('enemies', { ...base, type, originX: x, x, y, previousX: x, previousY: y,
      name: base.name, hp, maxHp: hp, armor: (base.armor || 0) * scale, size: base.size * (elite ? 1.1 : 1),
      damage: base.damage * (elite ? 1.5 : 1), reward: base.reward * (elite ? 2 : 1),
      speed: base.speed * this.modeConfig.speed, color: base.color, elite, status: {}, phase: 1,
      attackTimer: this.rng.range(1.5, 3), summonTimer: 6, hitUntil: 0 });
    if (enemy?.boss) {
      const chapter = this.director.chapter; enemy.name = chapter.boss; enemy.attack = chapter.attack;
      enemy.attackTimer = 3; s.boss = enemy; this.emit('boss', { name: enemy.name });
    }
    return enemy;
  }
  fireWeapon() {
    const s = this.state, weapon = this.weapon(), formation = FORMATIONS[s.formation];
    if (s.fireTimer > 0 || (weapon.heat && s.heat >= 96)) return;
    const active = s.time < s.overdriveUntil;
    s.fireTimer = Math.max(.035, weapon.cooldown / 1000 / (active ? 1.9 : 1) / formation.fireRate / s.fireRate);
    if (weapon.heat) s.heat = Math.min(100, s.heat + 5 * (1 - this.skill('heavy_heat') * .08));
    const masteryBonus = 1 + Math.min(.12, Math.floor((this.profile.mastery[s.selectedWeapon] || 0) / 250) * .02);
    let target = null, closest = Infinity;
    for (const enemy of s.enemies) if (!enemy.dead && enemy.y < s.y - 25) {
      const distance = (enemy.x - s.x) ** 2 + (enemy.y - s.y) ** 2;
      if (distance < closest) { target = enemy; closest = distance; }
    }
    const slots = squadLayout(s.squad, s.formation).slots;
    const shooter = slots[(s.volley || 0) % slots.length] || { x: 0, y: 0 }; s.volley = (s.volley || 0) + 1;
    const originX = s.x + shooter.x + 7, originY = s.y + shooter.y - 22;
    const aim = target ? clamp(Math.atan2(target.x - originX, originY - target.y), -.7, .7) : 0;
    s.aim = aim;
    for (let i = 0; i < weapon.shots; i++) {
      const angle = aim + (weapon.shots === 1 ? this.rng.range(-weapon.spread, weapon.spread) : (i - (weapon.shots - 1) / 2) * weapon.spread * formation.spread);
      const x = originX + this.rng.range(-3, 3), y = originY;
      const bullet = this.spawn('bullets', { x, y, previousX: x, previousY: y, vx: Math.sin(angle) * weapon.speed, vy: -Math.cos(angle) * weapon.speed,
        damage: weapon.damage * (1 + this.skill('command_focus') * .04 + this.skill('heavy_damage') * .06) * s.runDamage * formation.damage * masteryBonus * (s.specialists.includes('gunner') ? 1.18 : 1) * (active ? 1.3 : 1),
        size: weapon.explosive ? 7 : 3, color: weapon.color, crit: clamp(weapon.crit + this.skill('heavy_crit') * .03 + (s.specialists.includes('sniper') ? .12 : 0), 0, .85),
        pierce: weapon.pierce, knockback: weapon.knockback, status: weapon.status, armorPierce: weapon.armorPierce || 0,
        explosive: (weapon.explosive || 0) * (1 + this.skill('engineer_explosive') * .08) * (s.specialists.includes('engineer') ? 1.25 : 1),
        chain: weapon.chain || 0, shatter: weapon.shatter, age: 0, style: PROJECTILE_STYLES[s.selectedWeapon], life: weapon.status === 'burn' ? 1 : 1.8, weapon: s.selectedWeapon, hitIds: new Set(), counted: false });
      if (bullet) s.shots++;
    }
    this.emit('shot', { weapon: s.selectedWeapon, x: originX, y: originY, color: weapon.color, aim });
  }
  tick(dt) {
    const s = this.state; if (!s.running || s.paused || s.gameOver) return;
    if (this.layoutKey !== `${Math.ceil(s.squad)}:${s.formation}`) this.syncSquadBounds();
    s.time += dt; s.previousX = s.x; s.previousY = s.y;
    if (this.mode !== 'horde' && this.mode !== 'bossrush' && !s.boss) s.distance += dt * 34 * this.modeConfig.speed;
    s.fireTimer = Math.max(0, s.fireTimer - dt); s.spawnTimer -= dt; s.heat = Math.max(0, s.heat - dt * 20);
    const speed = s.time < s.slowedUntil ? 180 : 470;
    if (s.inputX || s.inputY) {
      const length = Math.max(1, Math.hypot(s.inputX, s.inputY));
      this.moveTo(s.x + s.inputX / length * speed * dt, s.y + s.inputY / length * speed * dt);
      s.x = s.targetX; s.y = s.targetY;
    } else {
      const dx = s.targetX - s.x, dy = s.targetY - s.y, distance = Math.hypot(dx, dy);
      const travel = Math.min(distance, speed * dt, distance * (1 - Math.exp(-18 * dt)));
      if (distance > .01) { s.x += dx / distance * travel; s.y += dy / distance * travel; }
    }
    if (s.time >= s.overdriveUntil) s.overdrive = Math.min(100, s.overdrive + dt * 6);
    if (s.time >= s.comboUntil) s.combo = 0;
    this.director.tick(dt); if (s.gameOver) return;
    this.fireWeapon(); this.updateEnemies(dt); if (s.gameOver) return;
    this.updateBullets(dt); if (s.gameOver) return;
    this.updateEnemyProjectiles(dt); this.updateHazards(dt); this.updatePickups(dt);
    if (s.gameOver) return;
    this.updateMission();
    if (s.tutorial === 2 && s.kills >= s.tutorialKills + 3) this.skipTutorial();
    if (s.pendingDrafts > 0 && !s.draft && s.tutorial < 0) { s.pendingDrafts--; this.showUpgradeDraft(); }
    this.cleanup();
  }
  updateBullets(dt) {
    const s = this.state; this.grid.rebuild(s.enemies);
    for (const b of s.bullets) {
      b.previousX = b.x; b.previousY = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; b.age = (b.age || 0) + dt;
      const padding = 100 + b.size;
      const possible = this.grid.query(Math.min(b.x, b.previousX) - padding, Math.min(b.y, b.previousY) - padding, Math.max(b.x, b.previousX) + padding, Math.max(b.y, b.previousY) + padding);
      const hits = possible.filter(e => !e.dead && !b.hitIds.has(e.id)).map(e => ({ enemy: e, t: sweptCircleTime(b.previousX, b.previousY, b.x, b.y, e.x, e.y, e.size + b.size) })).filter(h => Number.isFinite(h.t)).sort((a, b) => a.t - b.t || a.enemy.id - b.enemy.id);
      for (const h of s.hazards) if (Number.isFinite(h.hp) && !h.dead) {
        const t = sweptCircleTime(b.previousX, b.previousY, b.x, b.y, h.x, h.y, h.size + b.size);
        if (Number.isFinite(t)) hits.push({ hazard: h, t });
      }
      hits.sort((a, b) => a.t - b.t);
      for (const hit of hits) {
        if (b.dead) break;
        if (hit.enemy) {
          if (hit.enemy.dead) continue;
          b.hitIds.add(hit.enemy.id); this.hitEnemy(hit.enemy, b);
          if (!b.counted) { b.counted = true; s.hits++; }
          if (b.pierce-- <= 0) b.dead = true;
        } else {
          const h = hit.hazard; h.hp -= b.damage; b.dead = true;
          if (h.hp <= 0) {
            h.dead = true; this.emit('explosion', { x: h.x, y: h.y, color: '#ffa94d', radius: h.type === 'barrel' ? 190 : 70 });
            if (h.type === 'barrel') for (const enemy of s.enemies) {
              const distance = Math.hypot(enemy.x - h.x, enemy.y - h.y);
              if (distance < 190) this.directDamage(enemy, 180 * (1 - distance / 190), b.weapon);
            }
          }
        }
      }
    }
  }
  hitEnemy(enemy, bullet) {
    if (enemy.dead) return;
    const crit = this.rng.chance(bullet.crit), s = this.state;
    const frozen = (enemy.status.freeze || 0) > 0;
    const amount = bullet.damage * (crit ? 2 : 1) * (bullet.shatter && frozen ? 2 : 1) * (enemy.weakUntil > s.time ? 1.35 : 1);
    this.directDamage(enemy, amount, bullet.weapon, bullet.armorPierce, crit);
    if (!enemy.boss) enemy.y -= bullet.knockback * .12;
    this.applyStatus(enemy, bullet, crit);
    if (bullet.explosive) {
      this.emit('explosion', { x: enemy.x, y: enemy.y, color: '#ffa94d', radius: bullet.explosive });
      for (const other of s.enemies) {
        if (other === enemy || other.dead) continue;
        const distance = Math.hypot(other.x - enemy.x, other.y - enemy.y);
        if (distance < bullet.explosive) {
          this.directDamage(other, bullet.damage * (1 - distance / bullet.explosive) * .75, bullet.weapon, bullet.armorPierce);
          this.applyStatus(other, bullet, false);
        }
      }
    }
    let from = enemy, damage = bullet.damage;
    const visited = new Set([enemy.id]);
    for (let i = 0; i < bullet.chain; i++) {
      let next = null, distance = 190;
      for (const other of s.enemies) {
        if (other.dead || visited.has(other.id)) continue;
        const d = Math.hypot(other.x - from.x, other.y - from.y);
        if (d < distance) { next = other; distance = d; }
      }
      if (!next) break;
      visited.add(next.id); damage *= .7;
      this.emit('arc', { x: from.x, y: from.y, targetX: next.x, targetY: next.y });
      this.directDamage(next, damage, bullet.weapon); this.applyStatus(next, bullet, false); from = next;
    }
  }
  applyStatus(enemy, bullet, crit) {
    if (enemy.dead) return;
    if (bullet.status === 'burn' || this.state.upgrades.incendiary) { enemy.status.burn = 3.5; enemy.status.burnWeapon = bullet.weapon; }
    if (bullet.status === 'freeze' || (crit && this.state.upgrades.cryo)) enemy.status.freeze = 2.4 * (1 + this.skill('engineer_freeze') * .1);
    if (bullet.status === 'shock') enemy.status.shock = 1.2;
  }
  directDamage(enemy, amount, weapon = 'rifle', armorPierce = 0, crit = false) {
    if (enemy.dead || !Number.isFinite(amount) || amount <= 0) return;
    const wasArmored = enemy.armor > 0;
    const absorbed = Math.min(enemy.armor, amount * .55 * (1 - armorPierce));
    enemy.armor -= absorbed; const damage = amount - absorbed;
    this.state.damageDealt += Math.min(Math.max(0, enemy.hp), damage); enemy.hp -= damage; enemy.hitUntil = this.state.time + .08;
    this.state.mastery[weapon] = (this.state.mastery[weapon] || 0) + Math.min(damage, enemy.maxHp) * .025 * (1 + this.skill('scavenger_mastery') * .1);
    this.emit('hit', { x: enemy.x, y: enemy.y, damage: Math.round(damage), crit, armorBreak: wasArmored && enemy.armor <= 0 });
    if (enemy.hp <= 0) this.killEnemy(enemy, weapon);
  }
  killEnemy(enemy) {
    if (enemy.dead) return;
    const s = this.state; enemy.dead = true; s.kills++; s.waveResolved++;
    if (enemy.elite || enemy.boss) s.eliteKills++;
    s.combo++; s.comboUntil = s.time + 3; s.bestCombo = Math.max(s.bestCombo, s.combo);
    this.credit(Math.round(enemy.reward * this.modeConfig.reward * (1 + this.skill('scavenger_credit') * .08) * (this.mode === 'horde' ? 1 + Math.min(.5, s.combo * .01) : 1)));
    this.emit('kill', { x: enemy.x, y: enemy.y, boss: !!enemy.boss, color: enemy.color });
    if (enemy.boss || this.rng.chance(.09 + this.skill('scavenger_luck') * .03 + s.runLuck + (enemy.elite ? .2 : 0))) this.dropLoot(enemy.x, enemy.y);
    if (enemy.boss) {
      s.bosses++; s.boss = null; this.emit('bossDefeated', { name: enemy.name });
      s.enemyProjectiles.forEach(item => { item.dead = true; }); s.hazards.forEach(item => { if (item.type === 'strike') item.dead = true; });
      this.director.bossDefeated();
    }
  }
  updateEnemies(dt) {
    const s = this.state; this.grid.rebuild(s.enemies);
    const leader = s.enemies.some(e => e.aura && !e.dead);
    // Snapshot length: summons are updated on the next step, never recursively this step.
    const count = s.enemies.length;
    for (let i = 0; i < count && !s.gameOver; i++) {
      const e = s.enemies[i]; if (e.dead) continue;
      e.previousX = e.x; e.previousY = e.y;
      let speed = e.speed * (leader && !e.aura ? 1.12 : 1);
      for (const id of ['freeze', 'shock', 'burn']) if (e.status[id] > 0) e.status[id] = Math.max(0, e.status[id] - dt);
      if (e.status.freeze > 0) speed *= .36;
      if (e.status.shock > 0) speed *= .72;
      if (e.status.burn > 0) { this.directDamage(e, dt * 13, e.status.burnWeapon); if (e.dead) continue; }
      if (e.boss) { e.y = Math.min(175, e.y + speed * dt); this.updateBoss(e, dt); continue; }
      if (e.weave) e.x += ((e.originX ?? e.x) + Math.sin(s.time * 5 + e.id) * 36 - e.x) * dt * 5;
      for (const other of this.grid.nearby(e.x, e.y, 80)) {
        if (other === e || other.dead || other.boss) continue;
        const dx = e.x - other.x, dy = e.y - other.y, distance = Math.hypot(dx, dy), gap = (e.size + other.size) * .65;
        if (distance < gap) e.x += (distance ? dx / distance : (e.id > other.id ? 1 : -1)) * (gap - distance) * dt * 2;
      }
      if (!e.ranged) e.x += clamp(s.x - e.x, -speed * .3, speed * .3) * dt;
      e.x = clamp(e.x, this.bounds.left, this.bounds.right); e.y += speed * dt;
      if (e.ranged && e.y > 70 && e.y < HEIGHT - 220 && (e.attackTimer -= dt) <= 0) {
        e.attackTimer = this.rng.range(1.8, 3); const t = Math.max(.2, Math.hypot(s.x - e.x, s.y - e.y) / 260);
        this.spawn('enemyProjectiles', { x: e.x, y: e.y, previousX: e.x, previousY: e.y, vx: (s.x - e.x) / t, vy: (s.y - e.y) / t, damage: e.damage, life: 4 });
      }
      if (e.summon && (e.summonTimer -= dt) <= 0) { e.summonTimer = 7; this.spawnEnemy('runner'); this.emit('warning', { text: 'Screamer called reinforcements' }); }
      if (this.mode !== 'horde' && sweptCircleHit(e.previousX - s.previousX, e.previousY - s.previousY, e.x - s.x, e.y - s.y, 0, 0, e.size + 27)) {
        e.dead = true; s.waveResolved++; this.damageSquad(e.damage * (e.explode ? 2 : 1));
      }
      if (!e.dead && e.y >= HEIGHT - 95) {
        e.dead = true; s.waveResolved++;
        const fort = s.fortifications.find(item => item.hp > 0 && Math.abs(item.x - e.x) < 85);
        if (fort) { fort.hp -= e.damage * 10; this.emit('fortHit'); }
        else if (this.mode === 'horde') { s.baseHealth = Math.max(0, s.baseHealth - e.damage * 6); if (s.baseHealth <= 0) this.finish(false); }
      }
    }
  }
  updateBoss(enemy, dt) {
    const s = this.state, phase = enemy.hp / enemy.maxHp > .66 ? 1 : enemy.hp / enemy.maxHp > .33 ? 2 : 3;
    if (phase !== enemy.phase) {
      enemy.phase = phase; enemy.attackTimer = 1.8;
      for (let i = 0; i < phase; i++) this.spawnEnemy(phase === 3 ? 'runner' : 'walker', i % 3);
      this.emit('phase', { phase });
    }
    enemy.x = WIDTH / 2 + Math.sin(s.time * (.7 + phase * .15)) * Math.min(145, (this.bounds.right - this.bounds.left) * .4);
    if (enemy.y < 130 || (enemy.attackTimer -= dt) > 0) return;
    enemy.attackTimer = Math.max(2.5, 4.2 - phase * .4); enemy.weakUntil = s.time + 1.25;
    const count = enemy.attack === 'crossfire' || (enemy.attack === 'barrage' && phase >= 2) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const x = i ? clamp(s.x + (s.x < WIDTH / 2 ? 135 : -135), this.bounds.left, this.bounds.right) : s.x;
      const y = i ? clamp(s.y - 140, this.bounds.top, this.bounds.bottom) : s.y;
      this.spawn('hazards', { type: 'strike', x, y, previousY: y, size: 62, hp: Infinity, warning: 1.25, life: 1.55, damage: 2 + phase, fired: false });
    }
    if (enemy.attack === 'summon') this.spawnEnemy('runner');
    this.emit('warning', { text: 'Move out of the marked impact zones', attack: enemy.attack });
  }
  updateEnemyProjectiles(dt) {
    const s = this.state;
    for (const p of s.enemyProjectiles) {
      p.previousX = p.x; p.previousY = p.y; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (sweptCircleHit(p.previousX - s.previousX, p.previousY - s.previousY, p.x - s.x, p.y - s.y, 0, 0, s.formation === 'wide' ? 65 : 42)) { p.dead = true; this.damageSquad(p.damage); }
    }
  }
  updateHazards(dt) {
    const s = this.state;
    for (const h of s.hazards) {
      if (h.dead) continue;
      h.previousY = h.y; h.life -= dt;
      if (h.type === 'strike') {
        h.warning -= dt;
        if (h.warning <= 0 && !h.fired) { h.fired = true; if (Math.hypot(h.x - s.x, h.y - s.y) < h.size + 28) this.damageSquad(h.damage); this.emit('slam', { x: h.x, y: h.y }); }
      } else {
        h.y += dt * 95;
        if (Math.abs(h.y - s.y) < 36 && Math.abs(h.x - s.x) < h.size + 20) {
          if (h.type === 'flood') { s.slowedUntil = s.time + .7; }
          else { h.dead = true; this.damageSquad(h.type === 'fire' ? 3 : 2); }
        }
      }
    }
  }
  damageSquad(damage) {
    const s = this.state; if (s.gameOver || s.tutorial >= 0 || s.time < s.invulnerableUntil) return;
    let amount = damage * s.incomingDamage / FORMATIONS[s.formation].armor * (1 - this.skill('medic_resist') * .05);
    const absorbed = Math.min(s.armor, amount * 7); s.armor -= absorbed; amount -= absorbed / 7;
    s.squad = Math.max(0, s.squad - Math.max(0, amount)); this.emit('hurt');
    if (s.squad <= 0) {
      if (s.revives > 0) { s.revives--; s.squad = 5; s.armor += 18; s.invulnerableUntil = s.time + 2; this.emit('revive'); }
      else this.finish(false);
    }
  }
  dropLoot(x, y) {
    let roll = this.rng.range(0, 100); const loot = LOOT.find(item => (roll -= item.weight) <= 0) || LOOT[0];
    this.spawn('pickups', { x, y, previousY: y, loot, life: 12 });
  }
  updatePickups(dt) {
    const s = this.state;
    for (const p of s.pickups) {
      p.previousY = p.y; p.y += dt * 105; p.life -= dt;
      if (Math.hypot(p.x - s.x, p.y - s.y) < 95) {
        p.dead = true; const a = p.loot.apply;
        if (a.credits) this.credit(a.credits);
        s.armor = Math.min(500, s.armor + (a.armor || 0)); s.squad = Math.min(40, s.squad + (a.squad || 0));
        s.runDamage = Math.min(8, s.runDamage * (1 + (a.damage || 0))); s.overdrive = Math.min(100, s.overdrive + (a.ability || 0));
        this.emit('loot', { name: p.loot.name, color: p.loot.color, x: p.x, y: p.y });
      }
    }
  }
  showUpgradeDraft() {
    const s = this.state;
    const candidates = RUN_UPGRADES.filter(u => (s.upgrades[u.id] || 0) < (['incendiary', 'cryo'].includes(u.id) ? 1 : 3)).map(u => ({ ...u }));
    for (const [id, specialist] of Object.entries(SPECIALISTS)) if (!s.specialists.includes(id)) candidates.push({ ...specialist, id: `specialist:${id}`, tag: 'Specialist' });
    if (s.wave >= 3 || s.kills >= 35) for (const [weapon, branches] of Object.entries(EVOLUTIONS)) {
      if (s.evolutions[weapon] || !(this.profile.unlockedWeapons.includes(weapon) || this.profile.accountLevel >= WEAPONS[weapon].unlock)) continue;
      for (const branch of branches) candidates.push({ ...branch, id: `evolution:${weapon}:${branch.id}`, tag: `${WEAPONS[weapon].name} evolution` });
    }
    if (this.mode === 'horde') candidates.push({ id: 'fortify', name: 'Field Sentry', tag: 'Fortification', detail: 'Deploys a sentry with 100 armor at your current position.' }, { id: 'repair', name: 'Repair Base', tag: 'Defense', detail: 'Restores 30 base integrity.' });
    if (!candidates.length) candidates.push({ id: 'plates', name: 'Armor Supply', tag: 'Defense', detail: '+45 armor' });
    const draft = [];
    while (draft.length < 3 && candidates.length) draft.push(candidates.splice(Math.floor(this.rng.range(0, candidates.length)), 1)[0]);
    s.draft = draft; s.paused = true; this.emit('draft', { choices: draft });
  }
  applyRunUpgrade(id) {
    const s = this.state; if (!s.draft?.some(item => item.id === id)) return false;
    if (id.startsWith('specialist:')) {
      const specialist = id.split(':')[1]; s.specialists.push(specialist);
      if (specialist === 'engineer') s.armor = Math.min(500, s.armor + 35);
    } else if (id.startsWith('evolution:')) {
      const [, weapon, branch] = id.split(':'); s.evolutions[weapon] = branch; s.selectedWeapon = weapon;
    } else {
      s.upgrades[id] = (s.upgrades[id] || 0) + 1;
      if (id === 'hollowpoints') s.runDamage = Math.min(8, s.runDamage * 1.18);
      if (id === 'rapidcycle') s.fireRate = Math.min(2.2, s.fireRate * 1.14);
      if (id === 'plates') s.armor = Math.min(500, s.armor + 45);
      if (id === 'reinforcements') s.squad = Math.min(40, s.squad + 3);
      if (id === 'scavenger') s.runLuck += .15;
      if (id === 'glasscannon') { s.runDamage = Math.min(8, s.runDamage * 1.4); s.incomingDamage *= 1.25; }
      if (id === 'repair') s.baseHealth = Math.min(100, s.baseHealth + 30);
      if (id === 'fortify') {
        const existing = s.fortifications.find(item => Math.abs(item.x - s.x) < 85);
        if (existing) existing.hp = 100; else if (s.fortifications.length < 5) s.fortifications.push({ x: s.x, hp: 100, cooldown: 0 });
      }
    }
    s.draft = null; s.paused = false; this.emit('upgrade'); return true;
  }
  cleanup() {
    const s = this.state;
    this.pools.enemies.compact(s.enemies, e => !e.dead);
    this.pools.bullets.compact(s.bullets, e => !e.dead && e.life > 0 && e.y > -100 && e.x > -100 && e.x < WIDTH + 100);
    this.pools.enemyProjectiles.compact(s.enemyProjectiles, e => !e.dead && e.life > 0 && e.y < HEIGHT + 60);
    this.pools.pickups.compact(s.pickups, e => !e.dead && e.life > 0 && e.y < HEIGHT + 40);
    this.pools.hazards.compact(s.hazards, e => !e.dead && e.life > 0 && e.y < HEIGHT + 70);
  }
  finish(victory) {
    const s = this.state; if (s.gameOver) return;
    s.gameOver = true; s.paused = true; s.running = false; s.victory = victory; this.emit('finish', { victory });
  }
}
