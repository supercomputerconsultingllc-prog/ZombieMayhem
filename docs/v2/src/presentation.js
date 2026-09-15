/** Shared formation geometry: the rendered army and its movement bounds agree. */
const layouts = new Map();
export function squadLayout(squad, formation = 'wedge') {
  const count = Math.max(0, Math.min(40, Math.ceil(squad))), key = `${count}:${formation}`;
  if (layouts.has(key)) return layouts.get(key);
  const slots = []; let remaining = count, row = 0;
  const columns = Math.max(2, Math.ceil(Math.sqrt(count) * (formation === 'wide' ? 1.4 : 1)));
  while (remaining > 0) {
    const n = Math.min(remaining, formation === 'wedge' ? row + 1 : columns);
    for (let col = 0; col < n; col++) slots.push({ x: (col - (n - 1) / 2) * 23, y: row * 25 });
    remaining -= n; row++;
  }
  const middle = (row - 1) * 12.5;
  for (const slot of slots) slot.y -= middle;
  const layout = { slots, halfWidth: Math.max(25, ...slots.map(p => Math.abs(p.x) + 25)), halfHeight: Math.max(25, middle + 27) };
  layouts.set(key, layout); return layout;
}
export function pickupSprite(apply) { return apply.squad ? 7 : apply.armor ? 6 : apply.ability ? 8 : 5; }
export const PROJECTILE_STYLES = Object.freeze({ rifle: 'tracer', shotgun: 'pellet', sniper: 'rail', minigun: 'streak', flame: 'fire', tesla: 'lightning', freeze: 'ice', grenade: 'grenade' });
