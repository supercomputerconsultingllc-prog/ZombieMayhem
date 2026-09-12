import { BIOMES, CHAPTERS, LANES } from './config.js';
import { clamp } from './simulation.js';
/** Authored mode rules, independent of rendering and account persistence. */
export class RunDirector {
  constructor(engine) { this.engine = engine; }
  get biomeIndex() {
    const e = this.engine;
    return e.mode === 'campaign' ? Math.min(3, e.state.bosses) : Math.floor((e.state.wave - 1) / 3) % BIOMES.length;
  }
  get chapter() { return CHAPTERS[Math.min(3, this.engine.state.bosses)]; }
  nextWave() {
    const e = this.engine, s = e.state;
    s.wave++; s.waveSpawned = 0; s.waveResolved = 0; s.waveStart = s.time;
    s.nextWaveDistance = s.distance + 250 + s.wave * 10;
    s.squad = Math.min(40, s.squad + e.skill('medic_recovery') + (s.specialists.includes('medic') ? 1 : 0));
    if (s.specialists.includes('engineer')) s.armor = Math.min(500, s.armor + 6);
    if (e.mode === 'horde') s.pendingDrafts++;
    else if (e.mode !== 'bossrush') s.pendingDrafts++;
    e.emit('wave', { wave: s.wave, biome: BIOMES[this.biomeIndex].name });
  }
  bossDefeated() {
    const e = this.engine, s = e.state;
    if ((e.mode === 'campaign' || e.mode === 'bossrush') && s.bosses >= 4) { e.finish(true); return; }
    if (e.mode === 'campaign') {
      s.wave = s.bosses * 3; this.nextWave();
      s.enemies.forEach(enemy => { if (!enemy.boss) enemy.dead = true; });
      e.emit('chapter', { ...this.chapter, number: s.bosses + 1 });
    } else if (e.mode === 'bossrush') {
      s.squad = Math.min(40, s.squad + 1); s.pendingDrafts++; s.bossDelay = 2;
      s.wave = s.bosses + 1;
      s.enemies.forEach(enemy => { enemy.dead = true; });
    }
  }
  tick(dt) {
    const e = this.engine, s = e.state;
    if (e.mode === 'bossrush') {
      if (!s.boss) {
        s.bossDelay -= dt;
        if (s.bossDelay <= 0) e.spawnEnemy('boss', 1);
      }
    } else if (e.mode === 'horde') {
      const quota = 12 + s.wave * 4;
      if (s.waveSpawned >= quota && !s.enemies.some(enemy => !enemy.dead)) this.nextWave();
      if (s.waveSpawned < 12 + s.wave * 4 && s.spawnTimer <= 0) {
        e.spawnEnemy(s.wave % 4 === 0 && s.waveSpawned === 0 ? 'boss' : null);
        s.waveSpawned++; s.spawnTimer = Math.max(.3, 1 - s.wave * .03);
      }
    } else {
      if (!s.boss && s.distance >= s.nextWaveDistance) {
        if (e.mode === 'campaign' && s.wave % 3 === 0) {
          e.spawnEnemy('boss', 1);
        } else this.nextWave();
      }
      if (!s.boss && s.spawnTimer <= 0) {
        e.spawnEnemy(); s.spawnTimer = clamp(1.1 - s.wave * .035, .3, 1.1) / e.modeConfig.spawn;
      }
      if (e.mode === 'extraction' && s.extracting) {
        s.extractProgress += dt;
        if (s.extractProgress >= 5) e.finish(true);
      }
    }
    if (!s.boss && e.mode !== 'bossrush' && s.wave >= 2 && s.time >= s.nextHazard) {
      s.nextHazard = s.time + e.rng.range(7, 11);
      const type = ['wreck', 'barrel', 'fire', 'flood'][this.biomeIndex];
      e.spawn('hazards', { type, x: e.rng.pick(LANES), y: -60, previousY: -60, size: 42,
        hp: type === 'barrel' ? 35 : type === 'wreck' ? 100 : Infinity, warning: 0, life: 12, dead: false });
    }
    if (e.mode === 'horde') {
      for (const fort of s.fortifications) if (fort.hp > 0) {
        fort.cooldown -= dt;
        if (fort.cooldown <= 0) {
          const target = s.enemies.find(enemy => !enemy.dead && Math.abs(enemy.x - LANES[fort.lane]) < 105);
          if (target) { e.directDamage(target, 20 + s.wave * 2, 'rifle'); fort.cooldown = .6; e.emit('turret', { x: LANES[fort.lane], targetX: target.x, targetY: target.y }); }
        }
      }
    }
  }
  objective() {
    const e = this.engine, s = e.state;
    if (e.mode === 'campaign') return `Chapter ${Math.min(4, s.bosses + 1)}/4 · ${this.chapter.name}`;
    if (e.mode === 'horde') return `Base ${Math.ceil(s.baseHealth)}% · ${s.waveResolved}/${12 + s.wave * 4} threats cleared`;
    if (e.mode === 'bossrush') return `Boss ${Math.min(4, s.bosses + 1)}/4 · ${this.chapter.boss}`;
    if (s.extracting) return `Evac arriving · ${Math.max(0, 5 - s.extractProgress).toFixed(1)} seconds`;
    return s.distance >= 600 ? `Evac available · ${Math.floor(s.credits)} supplies at risk` : `Reach the evacuation corridor · ${Math.max(0, 600 - Math.floor(s.distance))}m`;
  }
}
