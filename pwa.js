(() => {
  'use strict';
  const button = document.getElementById('installAppBtn');
  const dialog = document.getElementById('installAppDialog');
  if (!button || !dialog) return;
  const standalone = window.matchMedia('(display-mode: standalone)');
  let installPrompt = null;
  const isInstalled = () => standalone.matches || navigator.standalone === true;
  const refresh = () => { button.hidden = isInstalled(); };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    button.hidden = true;
    if (dialog.open) dialog.close();
  });
  standalone.addEventListener('change', refresh);
  document.getElementById('closeInstallApp').addEventListener('click', () => dialog.close());
  button.addEventListener('click', async () => {
    if (!installPrompt) { dialog.showModal(); return; }
    const prompt = installPrompt;
    installPrompt = null;
    button.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') button.hidden = true;
    } catch {
      dialog.showModal();
    } finally {
      button.disabled = false;
    }
  });
  refresh();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .catch(error => console.warn('Bird Atlas: service worker registration failed', error));
  }
})();
