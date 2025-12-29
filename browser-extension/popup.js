// Configurazione API endpoint
// Auto-detect: usa produzione se disponibile, altrimenti localhost
const PRODUCTION_URL = 'https://amazon-ads-manager-qsio.onrender.com'; // URL Render produzione
const API_URL = PRODUCTION_URL || 'http://localhost:3000';

// Elementi DOM
const syncButton = document.getElementById('syncButton');
const checkStatusButton = document.getElementById('checkStatus');
const statusDiv = document.getElementById('status');
const loadingDiv = document.getElementById('loading');

// Funzione per mostrare status
function showStatus(message, type = 'info') {
  statusDiv.className = `status ${type}`;
  statusDiv.textContent = message;
}

// Funzione per mostrare/nascondere loading
function setLoading(isLoading) {
  loadingDiv.className = isLoading ? 'loading active' : 'loading';
  syncButton.disabled = isLoading;
  checkStatusButton.disabled = isLoading;
}

// Funzione per ottenere marketplace dal dominio corrente
async function detectMarketplace() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  if (url.includes('amazon.com')) return 'US';
  if (url.includes('amazon.it')) return 'IT';
  if (url.includes('amazon.co.uk')) return 'UK';
  if (url.includes('amazon.de')) return 'DE';
  if (url.includes('amazon.fr')) return 'FR';
  if (url.includes('amazon.es')) return 'ES';
  if (url.includes('amazon.ca')) return 'CA';
  if (url.includes('amazon.com.au')) return 'AU';

  return 'US';
}

// Funzione principale di sincronizzazione
async function syncKdpCookies() {
  try {
    setLoading(true);
    showStatus('🔄 Recupero cookie Amazon...', 'info');

    // Verifica che l'utente sia su una pagina Amazon
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.url.includes('amazon')) {
      showStatus('❌ Apri prima una pagina Amazon KDP', 'error');
      setLoading(false);
      return;
    }

    // Rileva marketplace
    const marketplace = await detectMarketplace();

    // Recupera tutti i cookie Amazon
    const cookies = await chrome.cookies.getAll({ domain: '.amazon.com' });

    if (cookies.length === 0) {
      showStatus('❌ Nessun cookie trovato. Assicurati di essere loggato su KDP.', 'error');
      setLoading(false);
      return;
    }

    showStatus(`✅ Trovati ${cookies.length} cookie. Invio al server...`, 'info');

    // Recupera JWT token dal cookie del server
    const serverUrl = new URL(API_URL);
    const authCookies = await chrome.cookies.getAll({
      domain: serverUrl.hostname,
      name: 'extension_token'
    });

    const jwtToken = authCookies.length > 0 ? authCookies[0].value : null;

    if (!jwtToken) {
      showStatus('❌ Non sei autenticato. Fai login prima su ' + API_URL, 'error');
      setLoading(false);
      return;
    }

    // Invia cookie al backend con JWT token
    const response = await fetch(`${API_URL}/api/kdp-sync/cookies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        cookies: cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expirationDate,
          httpOnly: c.httpOnly,
          secure: c.secure
        })),
        marketplace: marketplace
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sync failed');
    }

    const result = await response.json();

    showStatus(`✅ Sincronizzazione completata! ${result.data.cookiesCount} cookie salvati.`, 'success');

    // Salva timestamp in storage
    await chrome.storage.local.set({
      lastSync: new Date().toISOString(),
      marketplace: marketplace
    });

  } catch (error) {
    console.error('Sync error:', error);
    showStatus(`❌ Errore: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// Funzione per controllare lo stato
async function checkSyncStatus() {
  try {
    setLoading(true);

    // Recupera JWT token
    const serverUrl = new URL(API_URL);
    const authCookies = await chrome.cookies.getAll({
      domain: serverUrl.hostname,
      name: 'extension_token'
    });

    const jwtToken = authCookies.length > 0 ? authCookies[0].value : null;

    if (!jwtToken) {
      showStatus('❌ Non sei autenticato. Fai login prima su ' + API_URL, 'error');
      setLoading(false);
      return;
    }

    const response = await fetch(`${API_URL}/api/kdp-sync/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to check status');
    }

    const result = await response.json();
    const data = result.data;

    if (data.syncEnabled) {
      const lastSync = data.cookiesUpdatedAt ? new Date(data.cookiesUpdatedAt).toLocaleString('it-IT') : 'Mai';
      const needsRefresh = data.needsRefresh ? ' (⚠️ Da aggiornare)' : '';

      showStatus(
        `✅ Sync attivo\n📅 Ultimo aggiornamento: ${lastSync}${needsRefresh}\n🌍 Marketplace: ${data.marketplace}`,
        data.needsRefresh ? 'error' : 'success'
      );
    } else {
      showStatus('❌ Sync non attivo. Clicca "Sincronizza con KDP" per iniziare.', 'info');
    }

  } catch (error) {
    console.error('Status check error:', error);
    showStatus(`❌ Errore verifica stato: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// Event listeners
syncButton.addEventListener('click', syncKdpCookies);
checkStatusButton.addEventListener('click', checkSyncStatus);

// Controlla lo stato all'apertura del popup
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['lastSync', 'marketplace'], (result) => {
    if (result.lastSync) {
      const lastSyncDate = new Date(result.lastSync);
      const formatted = lastSyncDate.toLocaleString('it-IT');
      showStatus(`Ultimo sync: ${formatted} (${result.marketplace || 'US'})`, 'success');
    }
  });
});
