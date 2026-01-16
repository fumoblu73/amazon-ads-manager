// Configurazione API endpoint
// Auto-detect: usa produzione se disponibile, altrimenti localhost
const PRODUCTION_URL = 'https://amazon-ads-manager-qsio.onrender.com'; // URL Render produzione
const API_URL = PRODUCTION_URL || 'http://localhost:3000';

// Elementi DOM
const syncButton = document.getElementById('syncButton');
const syncSalesButton = document.getElementById('syncSalesButton');
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
  syncSalesButton.disabled = isLoading;
  checkStatusButton.disabled = isLoading;
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

    console.log(`Detecting cookies for marketplace ${marketplace}`);

    // ========================================================
    // CATTURA COOKIE COME PUBLISHER CHAMP
    // Cattura TUTTI i cookie Amazon da diversi domini/metodi
    // ========================================================

    // 1. Cookie da .amazon.com (autenticazione base KDP)
    const dotAmazonCookies = await chrome.cookies.getAll({ domain: '.amazon.com' });

    // 2. Cookie da amazon.com (senza punto)
    const amazonCookies = await chrome.cookies.getAll({ domain: 'amazon.com' });

    // 3. Cookie da .kdpreports.amazon.com (subdomain specifico)
    const dotKdpreportsCookies = await chrome.cookies.getAll({ domain: '.kdpreports.amazon.com' });

    // 4. Cookie da kdpreports.amazon.com (senza punto)
    const kdpreportsDomainCookies = await chrome.cookies.getAll({ domain: 'kdpreports.amazon.com' });

    // 5. Cookie tramite URL kdpreports (cattura anche httpOnly)
    const kdpreportsUrlCookies = await chrome.cookies.getAll({ url: 'https://kdpreports.amazon.com' });

    // 6. Cookie tramite URL kdp.amazon.com
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

    console.log(`Found cookies breakdown:`);
    console.log(`  - .amazon.com: ${dotAmazonCookies.length}`);
    console.log(`  - amazon.com: ${amazonCookies.length}`);
    console.log(`  - .kdpreports.amazon.com: ${dotKdpreportsCookies.length}`);
    console.log(`  - kdpreports.amazon.com: ${kdpreportsDomainCookies.length}`);
    console.log(`  - URL kdpreports: ${kdpreportsUrlCookies.length}`);
    console.log(`  - URL kdp: ${kdpUrlCookies.length}`);
    console.log(`Total unique: ${cookies.length} KDP + ${kdpreportsCookies.length} Reports`);

    if (cookies.length === 0) {
      showStatus('❌ Nessun cookie trovato. Assicurati di essere loggato su KDP.', 'error');
      setLoading(false);
      return;
    }

    // Mostra info sui cookie kdpreports
    const kdpreportsMsg = kdpreportsCookies.length > 0
      ? `✅ ${cookies.length} cookie KDP + ${kdpreportsCookies.length} cookie Reports.`
      : `⚠️ ${cookies.length} cookie KDP. Visita kdpreports.amazon.com per i dati vendite.`;

    showStatus(`${kdpreportsMsg} Invio al server...`, 'info');
    console.log(`Sending to server: ${cookies.length} KDP cookies + ${kdpreportsCookies.length} Reports cookies`);

    // Recupera JWT token da chrome.storage (salvato dall'app)
    console.log('Looking for JWT token in chrome.storage...');

    const storageData = await chrome.storage.local.get(['jwtToken']);
    let jwtToken = storageData.jwtToken;

    if (!jwtToken) {
      console.log('No JWT token in storage, trying to get from cookie...');

      // Fallback: prova a leggere dal cookie (potrebbe non funzionare cross-domain)
      const authCookies = await chrome.cookies.getAll({
        url: API_URL,
        name: 'extension_token'
      });

      if (authCookies.length > 0) {
        jwtToken = authCookies[0].value;
        // Salva in storage per il futuro
        await chrome.storage.local.set({ jwtToken });
        console.log('✅ Found token in cookie and saved to storage');
      }
    } else {
      console.log('✅ Found JWT token in storage');
    }

    if (!jwtToken) {
      showStatus('❌ Non sei autenticato. Apri l\'app e fai login, poi riprova.', 'error');

      // Mostra pulsante per aprire l'app
      setTimeout(() => {
        if (confirm('Vuoi aprire l\'app per autenticarti?')) {
          chrome.tabs.create({ url: API_URL });
        }
      }, 500);

      setLoading(false);
      return;
    }

    console.log('✅ JWT token ready, proceeding with sync...');

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
        // NUOVO: Invia anche i cookie di kdpreports per le statistiche
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

    // Recupera JWT token da chrome.storage
    console.log('[Status Check] Looking for JWT token in storage...');
    const storageData = await chrome.storage.local.get(['jwtToken']);
    const jwtToken = storageData.jwtToken;

    if (!jwtToken) {
      showStatus('❌ Non sei autenticato. Apri l\'app e fai login, poi riprova.', 'error');
      setLoading(false);
      return;
    }

    console.log('[Status Check] ✅ Found JWT token');

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

// ========================================================
// SINCRONIZZAZIONE DATI VENDITE (Client-Side Scraping)
// Come Publisher Champ: apre kdpreports, cattura API, invia dati
// ========================================================

async function syncSalesData() {
  try {
    setLoading(true);
    showStatus('🔄 Avvio sincronizzazione vendite...', 'info');

    // Verifica JWT token
    const storageData = await chrome.storage.local.get(['jwtToken']);
    const jwtToken = storageData.jwtToken;

    if (!jwtToken) {
      showStatus('❌ Non sei autenticato. Apri l\'app e fai login, poi riprova.', 'error');
      setLoading(false);
      return;
    }

    // Rileva marketplace
    const marketplace = await detectMarketplace();

    showStatus('📊 Apertura kdpreports.amazon.com...', 'info');

    // Chiedi al background script di aprire kdpreports e fare scraping
    const response = await chrome.runtime.sendMessage({
      action: 'startClientScraping'
    });

    if (!response.success) {
      throw new Error(response.error || 'Scraping failed');
    }

    const scrapedData = response.data;
    console.log('Scraped data:', scrapedData);

    // Verifica che abbiamo dati
    if (!scrapedData.overview && !scrapedData.orders) {
      throw new Error('Nessun dato ricevuto da kdpreports');
    }

    showStatus('📤 Invio dati al server...', 'info');

    // Invia dati al server
    const serverResponse = await fetch(`${API_URL}/api/kdp-sync/sales-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        data: scrapedData,
        marketplace: marketplace,
        source: 'extension-client-scrape'
      })
    });

    if (!serverResponse.ok) {
      // Check if response is JSON or HTML
      const contentType = serverResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await serverResponse.json();
        throw new Error(error.error || 'Failed to send data');
      } else {
        throw new Error(`Server error ${serverResponse.status}: ${serverResponse.statusText}`);
      }
    }

    const result = await serverResponse.json();

    // Mostra riepilogo dati
    const overview = scrapedData.overview?.overviewWidget || {};
    const summary = [];
    if (overview.totalRoyalties !== undefined) {
      summary.push(`Royalties: $${overview.totalRoyalties.toFixed(2)}`);
    }
    if (overview.printOrders !== undefined) {
      summary.push(`Print: ${overview.printOrders}`);
    }
    if (overview.digitalOrders !== undefined) {
      summary.push(`Digital: ${overview.digitalOrders}`);
    }

    showStatus(
      `✅ Dati vendite sincronizzati!\n${summary.join(' | ') || 'Dati ricevuti'}`,
      'success'
    );

    // Salva timestamp
    await chrome.storage.local.set({
      lastSalesSync: new Date().toISOString(),
      lastSalesData: scrapedData
    });

  } catch (error) {
    console.error('Sales sync error:', error);
    showStatus(`❌ Errore: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// Event listeners
syncButton.addEventListener('click', syncKdpCookies);
syncSalesButton.addEventListener('click', syncSalesData);
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
