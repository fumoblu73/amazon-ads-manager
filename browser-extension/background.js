// Background service worker per l'estensione

// Configurazione
const PRODUCTION_URL = 'https://amazon-ads-manager-qsio.onrender.com';
const API_URL = PRODUCTION_URL || 'http://localhost:3000';

// Storage per i dati scrappati
let scrapedData = null;
let scrapeTabId = null;
let scrapePromiseResolve = null;
let scrapePromiseReject = null;
let pendingSyncJwtToken = null;
let pendingSyncMarketplace = null;

// Helper per inviare messaggi al popup (se aperto)
function sendToPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup potrebbe essere chiuso, ignora l'errore
  });
}

// Listener per installazione estensione
chrome.runtime.onInstalled.addListener(() => {
  console.log('Amazon Ads Manager - KDP Sync extension installed');
});

// Listener per messaggi dal popup e content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message received:', request.action);

  if (request.action === 'getCookies') {
    chrome.cookies.getAll({ domain: '.amazon.com' }, (cookies) => {
      sendResponse({ cookies });
    });
    return true;
  }

  // Content script di kdpreports e' pronto
  if (request.action === 'kdpScraperReady') {
    console.log('[Background] KDP Scraper ready on:', request.url);
    // Invia comando per iniziare scraping
    if (scrapeTabId && sender.tab?.id === scrapeTabId) {
      sendToPopup({ action: 'syncProgress', percent: 15, text: 'Pagina caricata, avvio scraping...' });
      setTimeout(() => {
        chrome.tabs.sendMessage(scrapeTabId, { action: 'startScraping' });
      }, 3000); // Aspetta 3 secondi che la pagina sia completamente caricata
    }
  }

  // Progresso scraping dal content script
  if (request.action === 'kdpScrapingProgress') {
    const percent = 20 + Math.round((request.monthIndex / 12) * 60); // 20-80%
    sendToPopup({
      action: 'syncProgress',
      percent: percent,
      text: `Scaricamento ${request.monthLabel}... (${request.monthIndex + 1}/12)`
    });
  }

  // Dati catturati dal content script
  if (request.action === 'kdpDataComplete') {
    console.log('[Background] KDP data complete:', request.success);
    console.log('[Background] Data received:', JSON.stringify(request.data).substring(0, 500));
    scrapedData = request.data;

    if (scrapePromiseResolve && request.success) {
      scrapePromiseResolve(scrapedData);
      scrapePromiseResolve = null;
      scrapePromiseReject = null;
    }

    // Se abbiamo dati e JWT token, invia automaticamente al server
    if (request.success && pendingSyncJwtToken) {
      console.log('[Background] Auto-sending data to server...');
      sendToPopup({ action: 'syncProgress', percent: 85, text: 'Invio dati al server...' });

      sendDataToServer(scrapedData, pendingSyncJwtToken, pendingSyncMarketplace || 'US')
        .then(result => {
          console.log('[Background] ✅ Data sent to server successfully:', result);
          updateBadge('✓', '#00aa00');

          // Notifica il popup del completamento
          sendToPopup({
            action: 'syncComplete',
            success: true,
            monthsCount: scrapedData.historicalMonths?.length || 12,
            currency: scrapedData.overview?.overviewWidget?.currency || 'USD',
            totalRoyalties: scrapedData.overview?.overviewWidget?.totalRoyalties || 0
          });

          // Salva in storage per notificare il popup
          chrome.storage.local.set({
            lastSalesSync: new Date().toISOString(),
            lastSalesSyncSuccess: true,
            lastSalesData: scrapedData
          });

          // Reset badge dopo 5 secondi
          setTimeout(() => updateBadge('', '#ff9900'), 5000);
        })
        .catch(error => {
          console.error('[Background] ❌ Failed to send data to server:', error);
          updateBadge('!', '#ff0000');

          sendToPopup({
            action: 'syncComplete',
            success: false,
            error: error.message
          });

          chrome.storage.local.set({
            lastSalesSync: new Date().toISOString(),
            lastSalesSyncSuccess: false,
            lastSalesSyncError: error.message
          });
        })
        .finally(() => {
          pendingSyncJwtToken = null;
          pendingSyncMarketplace = null;
        });
    }

    scrapeTabId = null;
  }

  // Scraping fallito
  if (request.action === 'kdpScrapeFailed') {
    console.error('[Background] KDP scrape failed:', request.error);

    if (scrapePromiseReject) {
      scrapePromiseReject(new Error(request.error));
      scrapePromiseResolve = null;
      scrapePromiseReject = null;
    }

    sendToPopup({
      action: 'syncError',
      error: request.error
    });

    scrapeTabId = null;
  }

  // Popup richiede di iniziare scraping client-side
  if (request.action === 'startClientScraping') {
    // Salva JWT token e marketplace per l'invio automatico quando i dati sono pronti
    pendingSyncJwtToken = request.jwtToken;
    pendingSyncMarketplace = request.marketplace;
    console.log('[Background] Saved JWT token for auto-send, marketplace:', pendingSyncMarketplace);

    // Rispondi subito al popup
    sendResponse({ success: true, message: 'Scraping started' });

    // Avvia lo scraping in background
    startClientSideScraping()
      .then(data => {
        console.log('[Background] Scraping completed, data will be auto-sent');
      })
      .catch(error => {
        console.error('[Background] Scraping failed:', error.message);
        updateBadge('!', '#ff0000');
        sendToPopup({
          action: 'syncError',
          error: error.message
        });
      });

    return false;
  }

  // Popup richiede di inviare dati al server
  if (request.action === 'sendDataToServer') {
    sendDataToServer(request.data, request.jwtToken, request.marketplace)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Recupera ultimi dati scrappati
  if (request.action === 'getScrapedData') {
    sendResponse({ data: scrapedData });
  }
});

// Funzione per aprire tab kdpreports e fare scraping
async function startClientSideScraping() {
  console.log('[Background] Starting client-side scraping...');

  // Crea promise per aspettare i dati
  const dataPromise = new Promise((resolve, reject) => {
    scrapePromiseResolve = resolve;
    scrapePromiseReject = reject;

    // Timeout dopo 120 secondi (aumentato per i 12 mesi)
    setTimeout(() => {
      if (scrapePromiseReject) {
        reject(new Error('Scraping timeout - nessun dato ricevuto'));
        scrapePromiseResolve = null;
        scrapePromiseReject = null;
      }
    }, 120000);
  });

  // Prima cerca se c'è già un tab di kdpreports aperto
  const existingTabs = await chrome.tabs.query({ url: 'https://kdpreports.amazon.com/*' });
  console.log('[Background] Found existing kdpreports tabs:', existingTabs.length);

  let tab;
  if (existingTabs.length > 0) {
    // Usa il tab esistente
    tab = existingTabs[0];
    scrapeTabId = tab.id;
    console.log('[Background] Using existing tab:', tab.id, 'URL:', tab.url);

    // NON portare il tab in primo piano per non chiudere il popup
    // await chrome.tabs.update(tab.id, { active: true });
    // await chrome.windows.update(tab.windowId, { focused: true });

    sendToPopup({ action: 'syncProgress', percent: 12, text: 'Usando tab esistente...' });

    // Invia direttamente il comando di scraping dopo un breve delay
    setTimeout(() => {
      console.log('[Background] Sending startScraping to existing tab');
      chrome.tabs.sendMessage(scrapeTabId, { action: 'startScraping' });
    }, 2000);
  } else {
    // Apri nuovo tab kdpreports IN BACKGROUND (active: false) per non chiudere il popup
    sendToPopup({ action: 'syncProgress', percent: 10, text: 'Apertura kdpreports in background...' });

    tab = await chrome.tabs.create({
      url: 'https://kdpreports.amazon.com/dashboard',
      active: false  // <-- NON attivare il tab, così il popup rimane aperto
    });
    scrapeTabId = tab.id;
    console.log('[Background] Opened NEW kdpreports tab in background:', tab.id);
    // Il messaggio startScraping verrà inviato quando riceviamo kdpScraperReady
  }

  // Aspetta i dati
  return dataPromise;
}

// Funzione per inviare dati al server
async function sendDataToServer(data, jwtToken, marketplace) {
  console.log('[Background] Sending data to server...');

  const response = await fetch(`${API_URL}/api/kdp-sync/sales-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      data: data,
      marketplace: marketplace,
      source: 'extension-client-scrape'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send data');
  }

  return response.json();
}

// Badge di notifica
function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Imposta badge iniziale
updateBadge('', '#ff9900');
