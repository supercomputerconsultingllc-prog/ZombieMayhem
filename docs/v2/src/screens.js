/** Retains each screen's DOM and focus. Closing a nested menu restores its owner. */
export class ScreenManager {
  constructor(overlay, app, onChange) {
    this.overlay = overlay; this.app = app; this.onChange = onChange; this.stack = [];
    overlay.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const focusable = [...overlay.querySelectorAll('button:not(:disabled), a, input, select, textarea')].filter(el => el.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  get kind() { return this.stack.at(-1)?.kind || 'playing'; }
  node(markup) { const holder = document.createElement('div'); holder.innerHTML = markup; return holder.firstElementChild; }
  set(kind, content) { this.stack = [{ kind, content: typeof content === 'string' ? this.node(content) : content, focus: document.activeElement }]; this.render(); }
  push(kind, content) { this.stack.push({ kind, content: typeof content === 'string' ? this.node(content) : content, focus: document.activeElement }); this.render(); }
  pop() { const old = this.stack.pop(); this.render(); if (old?.focus?.isConnected) old.focus.focus(); }
  clear() { this.stack = []; this.render(); }
  render() {
    const top = this.stack.at(-1); this.overlay.replaceChildren(...(top ? [top.content] : []));
    this.overlay.classList.toggle('active', !!top); this.app.inert = !!top;
    if (top) {
      top.content.setAttribute('role', 'dialog'); top.content.setAttribute('aria-modal', 'true');
      const heading = top.content.querySelector('h1,h2');
      if (heading) { heading.id ||= 'activeDialogTitle'; top.content.setAttribute('aria-labelledby', heading.id); }
      requestAnimationFrame(() => top.content.querySelector('button:not(:disabled),input,select,textarea,a')?.focus({ preventScroll: true }));
    }
    this.onChange?.(!!top);
  }
}
