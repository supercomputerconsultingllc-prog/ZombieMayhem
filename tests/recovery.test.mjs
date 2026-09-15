import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatEngine } from '../docs/v2/src/engine.js';
import { sanitizeProfile, saveProfile, loadProfile, sanitizeSettings } from '../docs/v2/src/storage.js';
import { checkpointData, restoreCheckpoint, saveCheckpoint, clearCheckpoint, RUN_KEY } from '../docs/v2/src/checkpoint.js';
import { seal, unseal, writeRecord, readRecord } from '../docs/v2/src/durable.js';
import { SAVE_KEY, SAVE_VERSION } from '../docs/v2/src/config.js';
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
test('checksums detect truncated and altered data; journal falls back to previous generation', () => {
  assert.deepEqual(unseal(seal({ score: 3 }, 2)), { revision: 2, value: { score: 3 } });
  assert.throws(() => unseal(seal({ score: 3 }).replace('score', 'scoRe')));
  writeRecord('journal', { score: 2 }); writeRecord('journal', { score: 3 });
  values.set('journal', '{bad'); assert.deepEqual(readRecord('journal'), { score: 2 });
});
test('corrupt profile recovers last complete write; future-version data is never overwritten', () => {
  saveProfile(sanitizeProfile({ accountLevel: 7 })); saveProfile(sanitizeProfile({ accountLevel: 8 }));
  values.set(SAVE_KEY, '{bad'); assert.equal(loadProfile().accountLevel, 7);
  const future = JSON.stringify({ version: SAVE_VERSION + 1, profile: { accountLevel: 90 } });
  values.set(SAVE_KEY, future); assert.equal(saveProfile(sanitizeProfile({})), false); assert.equal(values.get(SAVE_KEY), future);
});
test('checkpoint restores RNG, projectiles, boss references and paused state in every mode', () => {
  const profile = sanitizeProfile({ accountLevel: 8 });
  for (const mode of ['campaign', 'horde', 'extraction', 'bossrush']) {
    const engine = new CombatEngine(profile, mode, 'recovery'); engine.spawnEnemy('boss'); engine.fireWeapon();
    engine.spawn('hazards', { type: 'fire', x: 350, y: 400, size: 42, hp: Infinity, warning: 0, life: 12 });
    const data = checkpointData(engine, 'run-1'), restored = restoreCheckpoint(profile, data);
    assert.ok(restored, mode); assert.ok(restoreCheckpoint(profile, data), 'input is reusable');
    assert.equal(restored.engine.state.paused, true); assert.equal(restored.engine.state.boss, restored.engine.state.enemies[0]);
    assert.ok(restored.engine.state.bullets[0].hitIds instanceof Set); assert.equal(restored.engine.state.hazards[0].hp, Infinity);
    assert.equal(restored.engine.rng.next(), engine.rng.next());
    restored.engine.state.paused = false; restored.engine.tick(1 / 60);
  }
});
test('checkpoint rejects malformed entities, completed runs and unsupported versions', () => {
  const profile = sanitizeProfile({}), engine = new CombatEngine(profile); engine.spawnEnemy('walker'); engine.fireWeapon();
  const original = checkpointData(engine, 'run-2');
  for (const mutate of [d => d.state.enemies[0].hp = 'oops', d => d.state.bullets[0].hitIds = null, d => d.state.mission.target = null, d => d.state.upgrades = [], d => d.version = 'future', d => d.state.squad = -1]) {
    const data = structuredClone(original); mutate(data); assert.equal(restoreCheckpoint(profile, data), null);
  }
  assert.equal(restoreCheckpoint({ ...profile, lastCompletedRun: 'run-2' }, original), null);
  assert.ok(saveCheckpoint(engine, 'run-2')); assert.ok(restoreCheckpoint(profile)); clearCheckpoint(); assert.equal(readRecord(RUN_KEY), null);
});
test('squad firepower increases with recruits and is capped; obstacles remain solid', () => {
  const e = new CombatEngine(sanitizeProfile({})); e.state.squad = 1; const base = e.squadFireRate();
  e.state.squad = 40; assert.ok(e.squadFireRate() > base); assert.equal(e.squadFireRate(), 1.45);
  const s = e.state, h = e.spawn('hazards', { type: 'wreck', x: s.x, y: s.y - 40, size: 42, hp: 100, life: 12 });
  e.updateHazards(1 / 60); assert.equal(h.dead, false); assert.ok(Math.hypot(s.x - h.x, s.y - h.y) >= 67);
});
test('mobile settings are bounded and type checked', () => {
  assert.equal(sanitizeSettings({ textScale: 200 }).textScale, 140);
  assert.equal(sanitizeSettings({ textScale: -1 }).textScale, 100);
  assert.equal(sanitizeSettings({ leftHanded: 'true', haptics: false }).leftHanded, false);
  assert.equal(sanitizeSettings({ haptics: false }).haptics, false);
});
