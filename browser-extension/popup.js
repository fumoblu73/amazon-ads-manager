// Configurazione API endpoint
// Auto-detect: usa produzione se disponibile, altrimenti localhost
const PRODUCTION_URL = 'https://amazon-ads-manager-qsio.onrender.com'; // URL Render produzione
const API_URL = PRODUCTION_URL || 'http://localhost:3000';

// Elementi DOM
const syncButton = document.getElementById('syncButton');
const syncSalesButton = document.getElementById('syncSalesButton');
const checkStatusButton = document.getElementById('checkStatus');
const statusDiv = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Funzione per mostrare status
function showStatus(message, type = 'info') {
  statusDiv.className = `status ${type}`;
  statusDiv.textContent = message;
}

// Funzione per mostrare/nascondere progress
function showProgress(show, percent = 0, text = '') {
  if (show) {
    progressContainer.classList.add('active');
    progressFill.style.width = `${percent}%`;
    progressText.textContent = text;
  } else {
    progressContainer.classList.remove('active');
  }
}

// Funzione per abilitare/disabilitare bottoni
function setButtonsEnabled(enabled) {
  syncButton.disabled = !enabled;
  syncSalesButton.disabled = !enabled;
  checkStatusButton.disabled = !enabled;
}

// Funzione per ottenere marketplace dal dominio corrente
async function detectMarketplace() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  // Check for KDP locale in URL path first (e.g., kdp.amazon.com/it_IT/)
  if (url.includes('/it_IT/')) return 'IT';
  if (url.includes('/en_GB/')) return 'UK';
  if (url.includes('/de_DE/')) return 'DE';
  if (url.includes('/fr_FR/')) return 'FR';
  if (url.includes('/es_ES/')) return 'ES';
  if (url.includes('/ja_JP/')) return 'JP';
  if (url.includes('/en_CA/')) return 'CA';
  if (url.includes('/en_AU/')) return 'AU';
  if (url.includes('/en_IN/')) return 'IN';
  if (url.includes('/pt_BR/')) return 'BR';
  if (url.includes('/es_MX/')) return 'MX';
  if (url.includes('/en_US/')) return 'US';

  // Fallback to domain detection (for non-KDP pages)
  if (url.includes('amazon.it')) return 'IT';
  if (url.includes('amazon.co.uk')) return 'UK';
  if (url.includes('amazon.de')) return 'DE';
  if (url.includes('amazon.fr')) return 'FR';
  if (url.includes('amazon.es')) return 'ES';
  if (url.includes('amazon.co.jp')) return 'JP';
  if (url.includes('amazon.ca')) return 'CA';
  if (url.includes('amazon.com.au')) return 'AU';
  if (url.includes('amazon.in')) return 'IN';
  if (url.includes('amazon.com.br')) return 'BR';
  if (url.includes('amazon.com.mx')) return 'MX';
  if (url.includes('amazon.com')) return 'US';

  return 'US';
}

// Funzione principale di sincronizzazione cookie
async function syncKdpCookies() {
  try {
    setButtonsEnabled(false);
    showStatus('🔄 Recupero cookie Amazon...', 'syncing');

    // Verifica che l'utente sia su una pagina Amazon
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.url.includes('amazon')) {
      showStatus('❌ Apri prima una pagina Amazon KDP', 'error');
      setButtonsEnabled(true);
      return;
    }

    // Rileva marketplace
    const marketplace = await detectMarketplace();

    console.log(`Detecting cookies for marketplace ${marketplace}`);

    // Cattura cookie da diversi domini
    const dotAmazonCookies = await chrome.cookies.getAll({ domain: '.amazon.com' });
    const amazonCookies = await chrome.cookies.getAll({ domain: 'amazon.com' });
    const dotKdpreportsCookies = await chrome.cookies.getAll({ domain: '.kdpreports.amazon.com' });
    const kdpreportsDomainCookies = await chrome.cookies.getAll({ domain: 'kdpreports.amazon.com' });
    const kdpreportsUrlCookies = await chrome.cookies.getAll({ url: 'https://kdpreports.amazon.com' });
    const kdpUrlCookies = await chrome.cookies.getAll({ url: 'https://kdp.amazon.com' });

    // Combina tutti i cookie KDP (rimuovi duplicati per nome)
    const allKdpCookiesMap = new Map();
    [...dotAmazonCookies, ...amazonCookies, ...kdpUrlCookies].forEach(c => {
      allKdpCookiesMap.set(`${c.name}-${c.domain}`, c);
    });
    const cookies = Array.from(allKdpCookiesMap.values());

    // Combina tutti i cookie kdpreports (rimuovi duplicati per nome)
    const allReportsCookiesMap = new Map();
    [...dotKdpreportsCookies, ...kdpreportsDomainCookies, ...kdpreportsUrlCookies].forEach(c => {
      allReportsCookiesMap.set(`${c.name}-${c.domain}`, c);
    });
    const kdpreportsCookies = Array.from(allReportsCookiesMap.values());

    if (cookies.length === 0) {
      showStatus('❌ Nessun cookie trovato. Assicurati di essere loggato su KDP.', 'error');
      setButtonsEnabled(true);
      return;
    }

    showStatus(`📦 ${cookies.length} cookie KDP + ${kdpreportsCookies.length} cookie Reports trovati.\nInvio al server...`, 'syncing');

    // Recupera JWT token
    const storageData = await chrome.storage.local.get(['jwtToken']);
    let jwtToken = storageData.jwtToken;

    if (!jwtToken) {
      const authCookies = await chrome.cookies.getAll({
        url: API_URL,
        name: 'extension_token'
      });

      if (authCookies.length > 0) {
        jwtToken = authCookies[0].value;
        await chrome.storage.local.set({ jwtToken });
      }
    }

    if (!jwtToken) {
      showStatus('❌ Non sei autenticato. Apri l\'app e fai login, poi riprova.', 'error');
      setTimeout(() => {
        if (confirm('Vuoi aprire l\'app per autenticarti?')) {
          chrome.tabs.create({ url: API_URL });
        }
      }, 500);
      setButtonsEnabled(true);
      return;
    }

    // Invia cookie al backend
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
        kdpreportsCookies: kdpreportsCookies.map(c => ({
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

    showStatus(`✅ Cookie sincronizzati!\n${result.data.cookiesCount} KDP + ${result.data.reportsCookiesCount} Reports`, 'success');

    await chrome.storage.local.set({
      lastSync: new Date().toISOString(),
      marketplace: marketplace
    });

  } catch (error) {
    console.error('Sync error:', error);
    showStatus(`❌ Errore: ${error.message}`, 'error');
  } finally {
    setButtonsEnabled(true);
  }
}

// Funzione per controllare lo stato
async function checkSyncStatus() {
  try {
    setButtonsEnabled(false);
    showStatus('🔍 Verifica stato...', 'syncing');

    const storageData = await chrome.storage.local.get(['jwtToken']);
    const jwtToken = storageData.jwtToken;

    if (!jwtToken) {
      showStatus('❌ Non sei autenticato. Apri l\'app e fai login, poi riprova.', 'error');
      setButtonsEnabled(true);
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
      const needsRefresh = data.needsRefresh ? ' ⚠️ Da aggiornare' : '';

      showStatus(
        `✅ Sync attivo\n📅 Ultimo: ${lastSync}${needsRefresh}\n🌍 Marketplace: ${data.marketplace}`,
        data.needsRefresh ? 'error' : 'success'
      );
    } else {
      showStatus('❌ Sync non attivo. Clicca "Sincronizza Cookie KDP" per iniziare.', 'info');
    }

  } catch (error) {
    console.error('Status check error:', error);
    showStatus(`❌ Errore: ${error.message}`, 'error');
  } finally {
    setButtonsEnabled(true);
  }
}

// Listener per messaggi dal background script (per aggiornare progresso)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Popup] Received message:', request.action);

  if (request.action === 'syncProgress') {
    showProgress(true, request.percent, request.text);
  }

  if (request.action === 'syncComplete') {
    showProgress(false);
    if (request.success) {
      showStatus(`✅ Sincronizzazione completata!\n${request.monthsCount || 12} mesi importati\nRoyalties: ${request.currency || 'USD'} ${request.totalRoyalties?.toFixed(2) || '0.00'}`, 'success');
    } else {
      showStatus(`❌ Errore: ${request.error || 'Sincronizzazione fallita'}`, 'error');
    }
    setButtonsEnabled(true);
  }

  if (request.action === 'syncError') {
    showProgress(false);
    showStatus(`❌ Errore: ${request.error}`, 'error');
    setButtonsEnabled(true);
  }
});

// Funzione per sincronizzare dati vendite
async function syncSalesData() {
  try {
    setButtonsEnabled(false);
    showStatus('🔄 Avvio sincronizzazione vendite...', 'syncing');
    showProgress(true, 5, 'Preparazione...');

    // Verifica JWT token
    const storageData = await chrome.storage.local.get(['jwtToken']);
    const jwtToken = storageData.jwtToken;

    if (!jwtToken) {
      showStatus('❌ Non sei autenticato. Apri l\'app e fai login, poi riprova.', 'error');
      showProgress(false);
      setButtonsEnabled(true);
      return;
    }

    // Rileva marketplace
    const marketplace = await detectMarketplace();

    showStatus('📊 Apertura kdpreports.amazon.com...\nScaricamento dati 12 mesi in corso...', 'syncing');
    showProgress(true, 10, 'Apertura kdpreports...');

    // Invia messaggio al background per iniziare lo scraping
    chrome.runtime.sendMessage({
      action: 'startClientScraping',
      jwtToken: jwtToken,
      marketplace: marketplace
    });

    // Il popup rimane aperto e riceverà gli aggiornamenti via onMessage

  } catch (error) {
    console.error('Sales sync error:', error);
    showStatus(`❌ Errore: ${error.message}`, 'error');
    showProgress(false);
    setButtonsEnabled(true);
  }
}

// Event listeners
syncButton.addEventListener('click', syncKdpCookies);
syncSalesButton.addEventListener('click', syncSalesData);
checkStatusButton.addEventListener('click', checkSyncStatus);

// Controlla lo stato all'apertura del popup
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['lastSync', 'marketplace', 'lastSalesSync', 'lastSalesSyncSuccess'], (result) => {
    if (result.lastSalesSync) {
      const lastSyncDate = new Date(result.lastSalesSync);
      const formatted = lastSyncDate.toLocaleString('it-IT');
      const status = result.lastSalesSyncSuccess ? '✅' : '❌';
      showStatus(`${status} Ultimo sync vendite: ${formatted}\nMarketplace: ${result.marketplace || 'US'}`, result.lastSalesSyncSuccess ? 'success' : 'error');
    } else if (result.lastSync) {
      const lastSyncDate = new Date(result.lastSync);
      const formatted = lastSyncDate.toLocaleString('it-IT');
      showStatus(`Ultimo sync cookie: ${formatted} (${result.marketplace || 'US'})`, 'success');
    }
  });
});
