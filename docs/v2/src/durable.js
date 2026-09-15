// Corruption detection only, not encryption or anti-cheat.
export function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
export function seal(value, revision = 0) {
  const data = JSON.stringify(value);
  return JSON.stringify({ format: 1, revision, checksum: checksum(data), data });
}
export function unseal(raw, maximum = 2000000) {
  if (typeof raw !== 'string' || raw.length > maximum) throw new Error('Invalid record size');
  const record = JSON.parse(raw);
  if (record?.format !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 0 || typeof record.data !== 'string' || checksum(record.data) !== record.checksum) throw new Error('Damaged save record');
  return { revision: record.revision, value: JSON.parse(record.data) };
}
export function storageChanged() { globalThis.dispatchEvent?.(new Event('zombie:storagechange')); }
export function writeRecord(key, value) {
  try {
    const old = localStorage.getItem(key);
    if (old !== null) { try { unseal(old); localStorage.setItem(`${key}.backup`, old); } catch { /* Keep the last valid backup. */ } }
    localStorage.setItem(key, seal(value, Date.now())); storageChanged(); return true;
  } catch { return false; }
}
export function readRecord(key) {
  for (const candidate of [key, `${key}.backup`]) {
    try { const raw = localStorage.getItem(candidate); if (raw) return unseal(raw).value; } catch { /* Recover the other generation. */ }
  }
  return null;
}
