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
      setTimeout(() => {
        chrome.tabs.sendMessage(scrapeTabId, { action: 'startScraping' });
      }, 5000); // Aspetta 5 secondi che la pagina sia completamente caricata
    }
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
      sendDataToServer(scrapedData, pendingSyncJwtToken, pendingSyncMarketplace || 'US')
        .then(result => {
          console.log('[Background] ✅ Data sent to server successfully:', result);
          updateBadge('✓', '#00aa00');
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

    // NON chiudere il tab in caso di errore - lascialo aperto per debug
    // L'utente può chiuderlo manualmente
    scrapeTabId = null;
  }

  // Popup richiede di iniziare scraping client-side
  if (request.action === 'startClientScraping') {
    // Salva JWT token e marketplace per l'invio automatico quando i dati sono pronti
    pendingSyncJwtToken = request.jwtToken;
    pendingSyncMarketplace = request.marketplace;
    console.log('[Background] Saved JWT token for auto-send, marketplace:', pendingSyncMarketplace);

    // Rispondi subito al popup (che potrebbe chiudersi)
    sendResponse({ success: true, message: 'Scraping started - data will be sent automatically' });

    // Avvia lo scraping in background
    startClientSideScraping()
      .then(data => {
        console.log('[Background] Scraping completed, data will be auto-sent');
      })
      .catch(error => {
        console.error('[Background] Scraping failed:', error.message);
        updateBadge('!', '#ff0000');
      });

    return false; // Non async - rispondiamo subito
  }

  // Popup richiede di inviare dati al server
  if (request.action === 'sendDataToServer') {
    sendDataToServer(request.data, request.jwtToken, request.marketplace)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async
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

    // Timeout dopo 90 secondi
    setTimeout(() => {
      if (scrapePromiseReject) {
        reject(new Error('Scraping timeout - nessun dato ricevuto'));
        scrapePromiseResolve = null;
        scrapePromiseReject = null;
      }
    }, 90000);
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

    // Porta il tab in primo piano
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });

    // Invia direttamente il comando di scraping dopo un breve delay
    setTimeout(() => {
      console.log('[Background] Sending startScraping to existing tab');
      chrome.tabs.sendMessage(scrapeTabId, { action: 'startScraping' });
    }, 2000);
  } else {
    // Apri nuovo tab kdpreports (URL senza hash - la SPA caricherà la dashboard)
    tab = await chrome.tabs.create({
      url: 'https://kdpreports.amazon.com/dashboard',
      active: true
    });
    scrapeTabId = tab.id;
    console.log('[Background] Opened NEW kdpreports tab:', tab.id);
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
