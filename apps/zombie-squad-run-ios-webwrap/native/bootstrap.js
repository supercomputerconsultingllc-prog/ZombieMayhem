import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { seal, unseal } from '../../../docs/v2/src/durable.js';
const native = Capacitor.isNativePlatform();
const keys = ['zombieMayhemV2Profile', 'zombieMayhemV2Profile.backup', 'zombieMayhemV2Settings', 'zombieMayhemV2Run', 'zombieMayhemV2Run.backup'];
let revision = 0, dirty = false, writing = null, timer;
const options = path => ({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
async function restore() {
  const records = [];
  for (const path of ['zombie-save-a.json', 'zombie-save-b.json']) {
    try { const file = await Filesystem.readFile(options(path)); const record = unseal(file.data, 5000000);
      if (record.value && typeof record.value === 'object' && keys.every(key => record.value[key] === null || typeof record.value[key] === 'string')) records.push(record);
    } catch { /* Recover the other complete generation. */ }
  }
  const latest = records.sort((a, b) => b.revision - a.revision)[0];
  if (latest) { revision = latest.revision; for (const key of keys) { const value = latest.value[key]; if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } }
}
async function flush() {
  clearTimeout(timer);
  if (!native || writing || !dirty) return writing;
  writing = (async () => {
    while (dirty) {
      dirty = false;
      try {
        const next = revision + 1, data = seal(Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), next);
        await Filesystem.writeFile({ ...options(next % 2 ? 'zombie-save-a.json' : 'zombie-save-b.json'), data }); revision = next;
      } catch { dirty = true; window.dispatchEvent(new Event('zombie:storageerror')); break; }
    }
  })().finally(() => { writing = null; });
  return writing;
}
let lastHaptic = 0;
window.ZombiePlatform = { native, flush, haptic: async type => {
  if (!native || performance.now() - lastHaptic < 150) return;
  lastHaptic = performance.now();
  try { await Haptics.impact({ style: type === 'hurt' ? ImpactStyle.Heavy : ImpactStyle.Light }); } catch { /* Optional hardware. */ }
} };
try {
  if (native) {
    await restore();
    window.addEventListener('zombie:storagechange', () => { dirty = true; clearTimeout(timer); timer = setTimeout(flush, 250); });
    await App.addListener('appStateChange', ({ isActive }) => { window.dispatchEvent(new CustomEvent('zombie:appstate', { detail: { isActive } })); if (!isActive) void flush(); });
  }
  await import('./src/game.js');
} catch (error) {
  document.body.textContent = 'Zombie Mayhem could not start. Your saved files have not been deleted. Close and reopen the app.';
  console.error(error);
}
