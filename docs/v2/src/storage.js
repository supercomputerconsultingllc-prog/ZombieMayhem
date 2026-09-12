import { SAVE_KEY, SETTINGS_KEY, SAVE_VERSION, DEFAULT_PROFILE, DEFAULT_SETTINGS, WEAPONS, SKILL_TREES, ACHIEVEMENTS, MODES, FORMATIONS, EVOLUTIONS, SPECIALISTS } from './config.js';
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const n = (v, fallback = 0, max = 1e8) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : fallback;
const integer = (v, fallback, max) => Math.floor(n(v, fallback, max));
const known = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);
export function sanitizeProfile(input) {
  const p = record(input) ? input : {};
  const skills = {}, mastery = {}, achievements = {};
  for (const tree of Object.values(SKILL_TREES)) for (const node of tree.nodes) skills[node.id] = integer(p.skills?.[node.id], 0, node.max);
  for (const id of Object.keys(WEAPONS)) mastery[id] = n(p.mastery?.[id], 0, 1e7);
  for (const id of Object.keys(ACHIEVEMENTS)) if (p.achievements?.[id] === true) achievements[id] = true;
  return {
    ...DEFAULT_PROFILE, accountLevel: Math.max(1, integer(p.accountLevel, 1, 500)), accountXp: n(p.accountXp),
    skillPoints: integer(p.skillPoints, 0, 500), bestDistance: n(p.bestDistance),
    lifetimeKills: integer(p.lifetimeKills, 0, 1e9), lifetimeCredits: integer(p.lifetimeCredits, 0, 1e10),
    dailyBest: n(p.dailyBest), unlockedWeapons: [...new Set(['rifle', ...(Array.isArray(p.unlockedWeapons) ? p.unlockedWeapons.filter(id => known(WEAPONS, id)) : [])])],
    skills, mastery, achievements, tutorialComplete: p.tutorialComplete === true,
    chaptersCompleted: integer(p.chaptersCompleted, 0, 4),
    history: (Array.isArray(p.history) ? p.history : []).slice(0, 20).filter(record).map(sanitizeReport)
  };
}
export function sanitizeReport(p) {
  return {
    mode: known(MODES, p.mode) ? p.mode : 'campaign', victory: p.victory === true,
    seed: String(p.seed || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48),
    date: typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(p.date) ? p.date : '',
    distance: integer(p.distance, 0, 1e8), kills: integer(p.kills, 0, 1e7), bosses: integer(p.bosses, 0, 10000),
    credits: integer(p.credits, 0, 1e8), banked: integer(p.banked, 0, 1e8), time: n(p.time),
    damage: n(p.damage), shots: integer(p.shots, 0, 1e8), hits: integer(p.hits, 0, 1e8), wave: integer(p.wave, 1, 10000),
    formation: known(FORMATIONS, p.formation) ? p.formation : 'wedge',
    specialists: (Array.isArray(p.specialists) ? p.specialists : []).filter(id => known(SPECIALISTS, id)).slice(0, 4),
    evolutions: Object.fromEntries(Object.entries(record(p.evolutions) ? p.evolutions : {}).filter(([id, branch]) => known(EVOLUTIONS, id) && EVOLUTIONS[id].some(item => item.id === branch)))
  };
}
export function sanitizeSettings(input) {
  const p = record(input) ? input : {};
  return {
    masterVolume: n(p.masterVolume, 75, 100), musicVolume: n(p.musicVolume, 28, 100), effectsVolume: n(p.effectsVolume, 65, 100),
    quality: ['auto', 'high', 'medium', 'low'].includes(p.quality) ? p.quality : 'auto',
    reducedMotion: p.reducedMotion === true, highContrast: p.highContrast === true,
    damageFlashes: p.damageFlashes !== false, screenShake: p.screenShake !== false, damageNumbers: p.damageNumbers !== false, gore: p.gore === true
  };
}
export function loadProfile() {
  try { const saved = JSON.parse(localStorage.getItem(SAVE_KEY)); return sanitizeProfile(saved?.version ? saved.profile : saved); }
  catch { return sanitizeProfile(null); }
}
export function loadSettings() {
  try { return sanitizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY))); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveProfile(profile) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, profile: sanitizeProfile(profile) })); return true; }
  catch { return false; }
}
export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings))); return true; }
  catch { return false; }
}
export function exportSave(profile, settings) {
  const json = JSON.stringify({ version: SAVE_VERSION, profile: sanitizeProfile(profile), settings: sanitizeSettings(settings) });
  const bytes = new TextEncoder().encode(json);
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
}
export function importSave(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 180000) throw new Error('Save is too large. Maximum 180 KB.');
  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(encoded.trim()), c => c.charCodeAt(0))));
  if (!record(parsed) || ![2, 3, SAVE_VERSION].includes(parsed.version) || !record(parsed.profile) || !record(parsed.settings)) throw new Error('Unsupported or malformed V2 save.');
  const profile = sanitizeProfile(parsed.profile), settings = sanitizeSettings(parsed.settings);
  const previousProfile = localStorage.getItem(SAVE_KEY), previousSettings = localStorage.getItem(SETTINGS_KEY);
  try {
    if (!saveProfile(profile) || !saveSettings(settings)) throw new Error('Device storage is unavailable. Export a backup and free space.');
  } catch (error) {
    try {
      if (previousProfile === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, previousProfile);
      if (previousSettings === null) localStorage.removeItem(SETTINGS_KEY); else localStorage.setItem(SETTINGS_KEY, previousSettings);
    } catch { /* Storage may remain unavailable; report failure without claiming success. */ }
    throw error;
  }
  return { profile, settings };
}
