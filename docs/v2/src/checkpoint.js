import { VERSION, MODES, WEAPONS, ENEMIES, LOOT, FORMATIONS, LIMITS, MISSION_TEMPLATES, RUN_UPGRADES, SPECIALISTS, EVOLUTIONS } from './config.js';
import { CombatEngine } from './engine.js';
import { readRecord, writeRecord } from './durable.js';
export const RUN_KEY = 'zombieMayhemV2Run';
const groups = ['enemies', 'bullets', 'pickups', 'enemyProjectiles', 'hazards'];
function safeTree(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e12;
  if (typeof value === 'string') return value.length <= 512 && !/[<>]/.test(value);
  if (Array.isArray(value)) return value.length <= 5000 && value.every(v => safeTree(v, depth + 1));
  return value && typeof value === 'object' && Object.entries(value).every(([key, v]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safeTree(v, depth + 1));
}
export function checkpointData(engine, runId) {
  const s = engine.state;
  const state = JSON.parse(JSON.stringify({ ...s, boss: null, particles: [], draft: s.draft?.map(d => d.id) || null }, (key, v) => v instanceof Set ? [...v] : v));
  return { version: VERSION, runId, mode: engine.mode, seed: String(engine.seed), rng: engine.rng.state, sequence: engine.sequence, state };
}
export function saveCheckpoint(engine, runId) {
  if (!engine.state.running || engine.state.gameOver) return false;
  return writeRecord(RUN_KEY, checkpointData(engine, runId));
}
export function clearCheckpoint() { return writeRecord(RUN_KEY, null); }
export function restoreCheckpoint(profile, data = readRecord(RUN_KEY)) {
  try {
    if (!data || data.version !== VERSION || !safeTree(data) || !/^[a-zA-Z0-9-]{1,80}$/.test(data.runId) || data.runId === profile.lastCompletedRun || !Object.hasOwn(MODES, data.mode)) return null;
    const e = new CombatEngine(profile, data.mode, data.seed), s = structuredClone(data.state);
    if (!s || s.gameOver || !s.running || !Object.hasOwn(WEAPONS, s.selectedWeapon) || !Object.hasOwn(FORMATIONS, s.formation) || s.squad <= 0 || s.squad > 40 || !Number.isInteger(s.missionIndex) || s.missionIndex < 0) return null;
    if (!Number.isInteger(data.rng) || data.rng < 0 || data.rng > 0xffffffff || !Number.isSafeInteger(data.sequence) || data.sequence < 0) return null;
    for (const key of Object.keys(e.state)) {
      if (!(key in s)) return null;
      const original = e.state[key];
      if (typeof original === 'number' && typeof s[key] !== 'number') return null;
      if (typeof original === 'boolean' && typeof s[key] !== 'boolean') return null;
      if (Array.isArray(original) && !Array.isArray(s[key])) return null;
    }
    if (!Array.isArray(s.specialists) || !s.specialists.every(id => Object.hasOwn(SPECIALISTS, id)) || s.fortifications.length > 5) return null;
    const numbers = (object, fields) => object && fields.every(key => Number.isFinite(object[key]));
    const numericMap = object => object && !Array.isArray(object) && typeof object === 'object' && Object.values(object).every(value => Number.isFinite(value) && value >= 0);
    if (!numericMap(s.upgrades) || !numericMap(s.mastery) || !s.evolutions || Array.isArray(s.evolutions) || Object.entries(s.evolutions).some(([weapon, id]) => !EVOLUTIONS[weapon]?.some(branch => branch.id === id))) return null;
    if (!numbers(s.mission, ['target']) || s.mission.target <= 0 || s.fortifications.some(f => !numbers(f, ['x', 'hp', 'cooldown']))) return null;
    const choices = [...RUN_UPGRADES, ...Object.entries(SPECIALISTS).map(([id, item]) => ({ ...item, id: `specialist:${id}`, tag: 'Specialist' })), ...Object.entries(EVOLUTIONS).flatMap(([weapon, branches]) => branches.map(branch => ({ ...branch, id: `evolution:${weapon}:${branch.id}`, tag: `${WEAPONS[weapon].name} evolution` }))), { id: 'fortify', name: 'Field Sentry', tag: 'Fortification', detail: 'Deploy a sentry.' }, { id: 'repair', name: 'Repair Base', tag: 'Defense', detail: 'Restore base health.' }];
    if (s.draft && (!Array.isArray(s.draft) || s.draft.length > 3 || s.draft.some(id => !choices.some(c => c.id === id)))) return null;
    Object.assign(e.state, Object.fromEntries(Object.keys(e.state).map(key => [key, s[key]])));
    for (const group of groups) {
      if (!Array.isArray(s[group]) || s[group].length > LIMITS[group]) return null;
      e.state[group] = [];
      for (const item of s[group]) {
        if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isSafeInteger(item.id)) return null;
        if (group === 'enemies' && (!Object.hasOwn(ENEMIES, item.type) || !numericMap(item.status) || !numbers(item, ['hp', 'maxHp', 'armor', 'size', 'damage', 'reward', 'speed', 'phase', 'attackTimer', 'summonTimer']))) return null;
        if (group === 'bullets' && (!Object.hasOwn(WEAPONS, item.weapon) || !Array.isArray(item.hitIds) || !item.hitIds.every(Number.isSafeInteger) || !numbers(item, ['vx', 'vy', 'damage', 'size', 'crit', 'pierce', 'knockback', 'armorPierce', 'explosive', 'chain', 'age', 'life']))) return null;
        if (group === 'enemyProjectiles' && !numbers(item, ['vx', 'vy', 'damage', 'life'])) return null;
        if (group === 'pickups') { const loot = LOOT.find(loot => loot.name === item.loot?.name); if (!loot || !numbers(item, ['life'])) return null; item.loot = structuredClone(loot); }
        if (group === 'hazards' && (!['wreck', 'barrel', 'fire', 'flood', 'strike'].includes(item.type) || !numbers(item, ['size', 'life', 'warning']) || (item.hp !== null && !Number.isFinite(item.hp)) || (item.type === 'strike' && !numbers(item, ['damage'])))) return null;
        if (group === 'bullets') item.hitIds = new Set(item.hitIds);
        if (group === 'hazards' && item.hp === null) item.hp = Infinity;
        const entity = e.pools[group].acquire(item); if (!entity) return null; e.state[group].push(entity);
      }
    }
    e.state.boss = e.state.enemies.find(item => item.boss && !item.dead) || null;
    e.state.mission = { ...MISSION_TEMPLATES[s.missionIndex % MISSION_TEMPLATES.length], target: s.mission.target };
    e.state.draft = s.draft ? s.draft.map(id => ({ ...choices.find(c => c.id === id) })) : null;
    e.rng.state = data.rng; e.sequence = data.sequence; e.state.paused = true; e.stopMovement(); e.syncSquadBounds();
    return { engine: e, runId: data.runId };
  } catch { return null; }
}
