import { HEIGHT } from './config.js';

/** Relative dragging keeps the squad visible above a thumb; no tap teleporting. */
export class FreeMovementInput {
  constructor(canvas, pad, buttons, engine, active, viewWidth) {
    this.engine = engine; this.active = active; this.keys = new Set(); this.drag = null;
    const axes = () => this.engine().moveAxes(Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft')), Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup')));
    window.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (!active() || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || !['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) return;
      event.preventDefault(); this.keys.add(key); axes();
    });
    window.addEventListener('keyup', event => { if (this.keys.delete(event.key.toLowerCase())) { axes(); if (!this.keys.size) this.engine().stopMovement(); } });
    for (const surface of [canvas, pad]) {
      surface.addEventListener('pointerdown', event => {
        if (!active() || this.drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault(); this.reset();
        const s = engine().state;
        this.drag = { id: event.pointerId, surface, clientX: event.clientX, clientY: event.clientY, x: s.x, y: s.y };
        surface.setPointerCapture(event.pointerId); surface.classList.add('steering');
      });
      surface.addEventListener('pointermove', event => {
        const d = this.drag; if (!d || event.pointerId !== d.id || !active()) return;
        event.preventDefault(); const rect = canvas.getBoundingClientRect();
        engine().moveTo(d.x + (event.clientX - d.clientX) * viewWidth() / rect.width, d.y + (event.clientY - d.clientY) * HEIGHT / rect.height);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(type, event => { if (event.pointerId === this.drag?.id) this.reset(); });
    }
    for (const [button, direction] of buttons) {
      button.addEventListener('pointerdown', event => { if (!active()) return; event.preventDefault(); button.setPointerCapture(event.pointerId); engine().moveAxes(direction, 0); });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => engine().stopMovement());
    }
  }
  reset() {
    const d = this.drag; this.drag = null; this.keys.clear(); this.engine().stopMovement();
    if (d) { d.surface.classList.remove('steering'); if (d.surface.hasPointerCapture(d.id)) d.surface.releasePointerCapture(d.id); }
  }
}
