import { WIDTH, HEIGHT, LANES, MODES, WEAPONS, ENEMIES, LOOT, FORMATIONS, SPECIALISTS, RUN_UPGRADES, EVOLUTIONS, MISSION_TEMPLATES, LIMITS } from './config.js';
import { SeededRandom, SpatialGrid, ObjectPool, EventBus, clamp, sweptCircleTime, sweptCircleHit } from './simulation.js';
import { RunDirector } from './director.js';

/** Owns gameplay only. Presentation and persistence subscribe to discrete events. */
export class CombatEngine {
  constructor(profile, mode = 'campaign', seed = '1', tutorial = false) {
    this.profile = profile; this.mode = Object.hasOwn(MODES, mode) ? mode : 'campaign';
    this.modeConfig = MODES[this.mode]; this.seed = seed;
    this.rng = new SeededRandom(`${seed}:${this.mode}`); this.events = new EventBus(); this.sequence = 0;
    this.grid = new SpatialGrid(); this.pools = Object.fromEntries(Object.entries(LIMITS).map(([id, limit]) => [id, new ObjectPool(limit)]));
    this.state = {
      running: true, paused: false, gameOver: false, victory: false, time: 0, distance: 0, wave: 1, waveStart: 0,
      laneX: LANES[1], previousLaneX: LANES[1], targetLane: 1, lane: 1, squad: 8 + this.skill('command_squad') * 2,
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
    this.director = new RunDirector(this); this.setMission(0);
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
  lane(direction, absolute = false) {
    const s = this.state; if (!s.running || s.paused || s.gameOver) return;
    const lane = clamp(absolute ? direction : s.targetLane + direction, 0, 2);
    if (lane !== s.targetLane && s.tutorial === 0) { s.tutorial = 1; this.emit('tutorial'); }
    s.targetLane = lane;
  }
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
  spawnEnemy(forcedType = null, lane = null) {
    const s = this.state; if (s.enemies.length >= LIMITS.enemies) return null;
    let type = forcedType;
    if (!type) {
      const unlock = { walker: 1, runner: 1, crawler: 2, armored: 3, spitter: 3, exploder: 4, screamer: 5, leader: 5, tank: 6 };
      const choices = Object.entries(ENEMIES).filter(([id]) => id !== 'boss' && s.wave >= unlock[id]);
      let roll = this.rng.range(0, choices.reduce((sum, [, item]) => sum + item.weight, 0));
      type = choices.find(([, item]) => (roll -= item.weight) <= 0)?.[0] || 'walker';
    }
    const base = ENEMIES[type], chosenLane = lane ?? Math.floor(this.rng.range(0, 3));
    const elite = type !== 'boss' && this.rng.chance(Math.min(.03 + s.wave * .006, .22));
    const scale = (1 + (s.wave - 1) * .1) * (elite ? 1.75 : 1);
    const hp = base.hp * scale * (type === 'boss' && this.mode === 'bossrush' ? .75 : 1);
    const x = LANES[chosenLane], y = -base.size - this.rng.range(0, 90);
    const enemy = this.spawn('enemies', { ...base, type, lane: chosenLane, x, y, previousX: x, previousY: y,
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
    for (let i = 0; i < weapon.shots; i++) {
      const angle = weapon.shots === 1 ? this.rng.range(-weapon.spread, weapon.spread) : (i - (weapon.shots - 1) / 2) * weapon.spread * formation.spread;
      const x = s.laneX + this.rng.range(-3, 3), y = HEIGHT - 125;
      const bullet = this.spawn('bullets', { x, y, previousX: x, previousY: y, vx: Math.sin(angle) * weapon.speed, vy: -Math.cos(angle) * weapon.speed,
        damage: weapon.damage * (1 + this.skill('command_focus') * .04 + this.skill('heavy_damage') * .06) * s.runDamage * formation.damage * masteryBonus * (s.specialists.includes('gunner') ? 1.18 : 1) * (active ? 1.3 : 1),
        size: weapon.explosive ? 7 : 3, color: weapon.color, crit: clamp(weapon.crit + this.skill('heavy_crit') * .03 + (s.specialists.includes('sniper') ? .12 : 0), 0, .85),
        pierce: weapon.pierce, knockback: weapon.knockback, status: weapon.status, armorPierce: weapon.armorPierce || 0,
        explosive: (weapon.explosive || 0) * (1 + this.skill('engineer_explosive') * .08) * (s.specialists.includes('engineer') ? 1.25 : 1),
        chain: weapon.chain || 0, shatter: weapon.shatter, life: weapon.status === 'burn' ? 1 : 1.8, weapon: s.selectedWeapon, hitIds: new Set(), counted: false });
      if (bullet) s.shots++;
    }
    this.emit('shot', { weapon: s.selectedWeapon, x: s.laneX, y: HEIGHT - 125, color: weapon.color });
  }
  tick(dt) {
    const s = this.state; if (!s.running || s.paused || s.gameOver) return;
    s.time += dt; s.previousLaneX = s.laneX;
    if (this.mode !== 'horde' && this.mode !== 'bossrush' && !s.boss) s.distance += dt * 34 * this.modeConfig.speed;
    s.fireTimer = Math.max(0, s.fireTimer - dt); s.spawnTimer -= dt; s.heat = Math.max(0, s.heat - dt * 20);
    s.laneX += (LANES[s.targetLane] - s.laneX) * Math.min(1, dt * (s.time < s.slowedUntil ? 5 : 12));
    s.lane = LANES.reduce((best, x, i) => Math.abs(x - s.laneX) < Math.abs(LANES[best] - s.laneX) ? i : best, 0);
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
      b.previousX = b.x; b.previousY = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
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
            h.dead = true; this.emit('explosion', { x: h.x, y: h.y, color: '#ffa94d' });
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
      this.emit('explosion', { x: enemy.x, y: enemy.y, color: '#ffa94d' });
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
      if (e.weave) e.x += (LANES[e.lane] + Math.sin(s.time * 5 + e.id) * 36 - e.x) * dt * 5;
      for (const other of this.grid.nearby(e.x, e.y, 80)) {
        if (other === e || other.dead || other.boss) continue;
        const dx = e.x - other.x, dy = e.y - other.y, distance = Math.hypot(dx, dy), gap = (e.size + other.size) * .65;
        if (distance < gap) e.x += (distance ? dx / distance : (e.id > other.id ? 1 : -1)) * (gap - distance) * dt * 2;
      }
      e.x = clamp(e.x, 175, WIDTH - 175); e.y += speed * dt;
      if (e.ranged && e.y > 70 && e.y < HEIGHT - 220 && (e.attackTimer -= dt) <= 0) {
        e.attackTimer = this.rng.range(1.8, 3); const t = (HEIGHT - 115 - e.y) / 260;
        this.spawn('enemyProjectiles', { x: e.x, y: e.y, previousX: e.x, previousY: e.y, vx: (s.laneX - e.x) / t, vy: 260, damage: e.damage, life: 4 });
      }
      if (e.summon && (e.summonTimer -= dt) <= 0) { e.summonTimer = 7; this.spawnEnemy('runner', (e.lane + 1) % 3); this.emit('warning', { text: 'Screamer called reinforcements' }); }
      if (e.y >= HEIGHT - 95) {
        e.dead = true; s.waveResolved++;
        const fort = s.fortifications.find(item => item.hp > 0 && item.lane === e.lane);
        if (fort) { fort.hp -= e.damage * 10; this.emit('fortHit'); }
        else if (this.mode === 'horde') { s.baseHealth = Math.max(0, s.baseHealth - e.damage * 6); if (s.baseHealth <= 0) this.finish(false); }
        else this.damageSquad(e.damage * (e.explode ? 2 : 1));
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
    enemy.x = LANES[1] + Math.sin(s.time * (.7 + phase * .15)) * 145;
    if (enemy.y < 130 || (enemy.attackTimer -= dt) > 0) return;
    enemy.attackTimer = Math.max(2.5, 4.2 - phase * .4); enemy.weakUntil = s.time + 1.25;
    const lane = Math.floor(this.rng.range(0, 3));
    const lanes = enemy.attack === 'crossfire' || (enemy.attack === 'barrage' && phase >= 2) ? [0, 1, 2].filter(i => i !== lane) : [lane];
    for (const id of lanes) this.spawn('hazards', { type: 'strike', x: LANES[id], y: HEIGHT - 110, previousY: HEIGHT - 110, size: 74, hp: Infinity, warning: 1.25, life: 1.55, damage: 2 + phase, fired: false });
    if (enemy.attack === 'summon') this.spawnEnemy('runner', lane);
    this.emit('warning', { text: lanes.length === 2 ? `${['Left', 'Center', 'Right'][lane]} lane is safe` : `Dodge ${['left', 'center', 'right'][lane]} lane`, attack: enemy.attack });
  }
  updateEnemyProjectiles(dt) {
    const s = this.state;
    for (const p of s.enemyProjectiles) {
      p.previousX = p.x; p.previousY = p.y; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (sweptCircleHit(p.previousX - s.previousLaneX, p.previousY, p.x - s.laneX, p.y, 0, HEIGHT - 105, s.formation === 'wide' ? 65 : 42)) { p.dead = true; this.damageSquad(p.damage); }
    }
  }
  updateHazards(dt) {
    const s = this.state;
    for (const h of s.hazards) {
      if (h.dead) continue;
      h.previousY = h.y; h.life -= dt;
      if (h.type === 'strike') {
        h.warning -= dt;
        if (h.warning <= 0 && !h.fired) { h.fired = true; if (Math.abs(h.x - s.laneX) < h.size + 28) this.damageSquad(h.damage); this.emit('slam', { x: h.x, y: h.y }); }
      } else {
        h.y += dt * 95;
        if (Math.abs(h.y - (HEIGHT - 115)) < 36 && Math.abs(h.x - s.laneX) < h.size + 20) {
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
      if (p.y >= HEIGHT - 130 && Math.abs(p.x - s.laneX) < 100) {
        p.dead = true; const a = p.loot.apply;
        if (a.credits) this.credit(a.credits);
        s.armor = Math.min(500, s.armor + (a.armor || 0)); s.squad = Math.min(40, s.squad + (a.squad || 0));
        s.runDamage = Math.min(8, s.runDamage * (1 + (a.damage || 0))); s.overdrive = Math.min(100, s.overdrive + (a.ability || 0));
        this.emit('loot', { name: p.loot.name, color: p.loot.color });
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
    if (this.mode === 'horde') candidates.push({ id: 'fortify', name: 'Lane Sentry', tag: 'Fortification', detail: 'Deploys a sentry with 100 armor in your lane.' }, { id: 'repair', name: 'Repair Base', tag: 'Defense', detail: 'Restores 30 base integrity.' });
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
        const existing = s.fortifications.find(item => item.lane === s.targetLane);
        if (existing) existing.hp = 100; else s.fortifications.push({ lane: s.targetLane, hp: 100, cooldown: 0 });
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
