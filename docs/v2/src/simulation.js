/** Pure simulation primitives. No DOM, wall clock, or presentation randomness. */
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export class SeededRandom {
  constructor(seed = 1) {
    this.state = typeof seed === 'number' ? seed >>> 0 : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  }
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ this.state >>> 15, this.state | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  range(min, max) { return min + this.next() * (max - min); }
  chance(p) { return this.next() < clamp(p, 0, 1); }
  pick(items) { return items[Math.floor(this.next() * items.length)]; }
}
export class FixedStepClock {
  constructor(step = 1 / 60, maxSteps = 8) { this.step = step; this.maxSteps = maxSteps; this.accumulator = 0; }
  reset() { this.accumulator = 0; }
  advance(delta, update) {
    this.accumulator += clamp(Number.isFinite(delta) ? delta : 0, 0, this.step * this.maxSteps);
    let steps = 0;
    while (this.accumulator + 1e-10 >= this.step && steps++ < this.maxSteps) {
      update(this.step); this.accumulator = Math.max(0, this.accumulator - this.step);
    }
    return this.accumulator / this.step;
  }
}
export class ObjectPool {
  constructor(limit) { this.limit = limit; this.free = []; this.active = new Set(); this.created = 0; }
  acquire(values) {
    if (this.active.size >= this.limit) return null;
    let item = this.free.pop();
    if (!item) { item = {}; this.created++; }
    Object.assign(item, values); this.active.add(item); return item;
  }
  release(item) {
    if (!this.active.delete(item)) return;
    for (const key of Object.keys(item)) delete item[key];
    this.free.push(item);
  }
  compact(items, alive) {
    let write = 0;
    for (let read = 0; read < items.length; read++) {
      const item = items[read];
      if (alive(item)) items[write++] = item; else this.release(item);
    }
    items.length = write;
  }
}
export class SpatialGrid {
  constructor(cellSize = 128) { this.cellSize = cellSize; this.cells = new Map(); }
  key(x, y) { return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`; }
  rebuild(entities) {
    for (const cell of this.cells.values()) cell.length = 0;
    for (const entity of entities) {
      if (entity.dead) continue;
      const key = this.key(entity.x, entity.y);
      let cell = this.cells.get(key);
      if (!cell) this.cells.set(key, cell = []);
      cell.push(entity);
    }
  }
  query(minX, minY, maxX, maxY) {
    const found = [];
    for (let x = Math.floor(minX / this.cellSize); x <= Math.floor(maxX / this.cellSize); x++) {
      for (let y = Math.floor(minY / this.cellSize); y <= Math.floor(maxY / this.cellSize); y++) {
        const cell = this.cells.get(`${x},${y}`);
        if (cell) for (const entity of cell) found.push(entity);
      }
    }
    return found;
  }
  nearby(x, y, radius = this.cellSize) { return this.query(x - radius, y - radius, x + radius, y + radius); }
}
/** Earliest circle entry along a segment, or Infinity when it misses. */
export function sweptCircleTime(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1, dy = y2 - y1, fx = x1 - cx, fy = y1 - cy;
  const c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (!a) return Infinity;
  const b = 2 * (fx * dx + fy * dy), discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}
export function sweptCircleHit(...args) { return Number.isFinite(sweptCircleTime(...args)); }
export class EventBus {
  constructor() { this.listeners = new Set(); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(event) { for (const fn of this.listeners) fn(event); }
}
