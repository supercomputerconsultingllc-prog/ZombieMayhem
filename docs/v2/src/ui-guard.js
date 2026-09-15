const settingsButton = document.querySelector('#settingsBtn');

settingsButton?.addEventListener('click', () => {
  const snapshot = window.__zombieV2?.snapshot?.();
  if (snapshot?.running && !snapshot.paused && !snapshot.gameOver) {
    window.__zombieV2.pause();
  }
}, { capture: true });

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  const snapshot = window.__zombieV2?.snapshot?.();
  if (snapshot?.running && !snapshot.paused && !snapshot.gameOver) {
    window.__zombieV2.pause();
  }
});

window.addEventListener('blur', () => {
  const snapshot = window.__zombieV2?.snapshot?.();
  if (snapshot?.running && !snapshot.paused && !snapshot.gameOver) {
    window.__zombieV2.pause();
  }
});
