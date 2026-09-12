import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProfile, sanitizeSettings, exportSave, importSave, saveProfile, loadProfile } from '../docs/v2/src/storage.js';
import { SAVE_KEY, SETTINGS_KEY, SAVE_VERSION } from '../docs/v2/src/config.js';
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
const encode = value => btoa(JSON.stringify(value));
test('profile schema ignores unknown keys, HTML, invalid numbers and unlocks', () => {
  const profile = sanitizeProfile({ accountLevel: '<img onerror=alert(1)>', skillPoints: 1e100, skills: { heavy_damage: 999, other: 99 }, unlockedWeapons: ['constructor', '__proto__', 'rifle'], achievements: { '<img>': true, first_blood: true }, mastery: { rifle: '1000', unknown: 1 }, history: [{ mode: '<img>', seed: '<script>hi</script>', formation: 'constructor', specialists: ['__proto__'], evolutions: { rifle: 'not-valid' } }] });
  assert.equal(profile.accountLevel, 1); assert.equal(profile.skillPoints, 500); assert.equal(profile.skills.heavy_damage, 5);
  assert.equal(profile.skills.other, undefined); assert.deepEqual(profile.unlockedWeapons, ['rifle']); assert.deepEqual(profile.achievements, { first_blood: true });
  assert.equal(profile.mastery.rifle, 0); assert.equal(profile.history[0].mode, 'campaign'); assert.ok(!JSON.stringify(profile).includes('<'));
});
test('every malformed nested value safely falls back to defaults', () => {
  for (const value of [null, true, false, [], 'bad', 4]) { const p = sanitizeProfile({ skills: value, mastery: value, achievements: value, history: value }); assert.equal(p.accountLevel, 1); assert.deepEqual(p.history, []); }
  assert.deepEqual(sanitizeSettings({ masterVolume: -4, musicVolume: Infinity, effectsVolume: '99', quality: 'bogus', reducedMotion: 'true' }), { masterVolume: 0, musicVolume: 28, effectsVolume: 65, quality: 'auto', reducedMotion: false, highContrast: false, damageFlashes: true, screenShake: true, damageNumbers: true, gore: false });
});
test('exports round-trip and versions 2 and 3 migrate without touching V1 data', () => {
  localStorage.setItem('zombieV1Sentinel', 'preserved');
  const p = sanitizeProfile({ accountLevel: 7, tutorialComplete: true }), s = sanitizeSettings({ masterVolume: 41 });
  const loaded = importSave(exportSave(p, s)); assert.equal(loaded.profile.accountLevel, 7); assert.equal(loaded.settings.masterVolume, 41);
  for (const version of [2, 3]) { importSave(encode({ version, profile: p, settings: s })); assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).version, SAVE_VERSION); }
  assert.equal(localStorage.getItem('zombieV1Sentinel'), 'preserved');
});
test('unversioned local profile migrates on the next write', () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ accountLevel: 4 })); assert.equal(loadProfile().accountLevel, 4);
  saveProfile(loadProfile()); assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).version, SAVE_VERSION);
});
test('oversized, future-version and malformed imports fail without modifying saves', () => {
  saveProfile(sanitizeProfile({ accountLevel: 3 })); const before = localStorage.getItem(SAVE_KEY);
  for (const value of ['!', 'a'.repeat(180001), encode(null), encode({ version: 99, profile: {}, settings: {} }), encode({ version: 4, profile: [], settings: {} })]) assert.throws(() => importSave(value));
  assert.equal(localStorage.getItem(SAVE_KEY), before);
});
test('failed settings write rolls back an import and reports failure', () => {
  const original = localStorage.setItem, before = localStorage.getItem(SAVE_KEY);
  localStorage.setItem = (key, value) => { if (key === SETTINGS_KEY) throw new Error('quota'); original(key, value); };
  try { assert.throws(() => importSave(exportSave(sanitizeProfile({ accountLevel: 88 }), sanitizeSettings({}))), /storage/); assert.equal(localStorage.getItem(SAVE_KEY), before); }
  finally { localStorage.setItem = original; }
});
