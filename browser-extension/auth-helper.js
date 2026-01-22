// Script helper per salvare il JWT token in chrome.storage
// e gestire la comunicazione tra app e estensione per sync automatico

(function() {
  console.log('[Auth Helper] Script loaded');

  // Notifica all'app che l'estensione è installata
  window.postMessage({ type: 'EXTENSION_INSTALLED', version: '1.3.0' }, '*');

  // Leggi il cookie extension_token
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Funzione per mostrare notifica
  function showNotification(message, type = 'success') {
    const colors = {
      success: '#10b981',
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444'
    };

    const notification = document.createElement('div');
    notification.id = 'extension-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.success};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      max-width: 350px;
    `;
    notification.textContent = message;

    // Rimuovi notifica precedente se esiste
    const existing = document.getElementById('extension-notification');
    if (existing) existing.remove();

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 4000);
  }

  // Salva JWT token se disponibile
  const jwtToken = getCookie('extension_token');

  if (jwtToken && typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ jwtToken }, () => {
      console.log('[Auth Helper] ✅ JWT token saved to extension storage');
    });
  }

  // Ascolta messaggi dall'app per sync automatico
  window.addEventListener('message', async (event) => {
    // Verifica origine
    if (event.origin !== window.location.origin) return;

    const { type, action } = event.data || {};

    // L'app chiede di fare sync
    if (type === 'KDP_SYNC_REQUEST' && action === 'startSync') {
      console.log('[Auth Helper] Received sync request from app');

      // Verifica che abbiamo il JWT token
      const storageData = await chrome.storage.local.get(['jwtToken']);
      if (!storageData.jwtToken) {
        showNotification('❌ Estensione non autenticata. Ricarica la pagina.', 'error');
        window.postMessage({ type: 'KDP_SYNC_RESPONSE', success: false, error: 'Not authenticated' }, '*');
        return;
      }

      showNotification('🔄 Avvio sincronizzazione KDP...', 'info');

      // Invia richiesta al background script
      chrome.runtime.sendMessage({
        action: 'startClientScraping',
        jwtToken: storageData.jwtToken,
        marketplace: 'US'
      });

      window.postMessage({ type: 'KDP_SYNC_RESPONSE', success: true, message: 'Sync started' }, '*');
    }

    // L'app chiede lo stato dell'estensione
    if (type === 'KDP_EXTENSION_CHECK') {
      const storageData = await chrome.storage.local.get(['jwtToken', 'lastSalesSync', 'lastSalesSyncSuccess']);
      window.postMessage({
        type: 'KDP_EXTENSION_STATUS',
        installed: true,
        authenticated: !!storageData.jwtToken,
        lastSync: storageData.lastSalesSync,
        lastSyncSuccess: storageData.lastSalesSyncSuccess
      }, '*');
    }
  });

  // Ascolta messaggi dal background script per aggiornare l'app
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncProgress') {
      window.postMessage({
        type: 'KDP_SYNC_PROGRESS',
        percent: request.percent,
        text: request.text
      }, '*');
    }

    if (request.action === 'syncComplete') {
      const message = request.success
        ? `✅ Sincronizzazione completata! ${request.monthsCount || 12} mesi importati.`
        : `❌ Errore: ${request.error}`;
      showNotification(message, request.success ? 'success' : 'error');

      window.postMessage({
        type: 'KDP_SYNC_COMPLETE',
        success: request.success,
        monthsCount: request.monthsCount,
        totalRoyalties: request.totalRoyalties,
        error: request.error
      }, '*');
    }

    if (request.action === 'syncError') {
      showNotification(`❌ Errore: ${request.error}`, 'error');
      window.postMessage({
        type: 'KDP_SYNC_ERROR',
        error: request.error
      }, '*');
    }
  });

  console.log('[Auth Helper] Listeners registered');
})();
