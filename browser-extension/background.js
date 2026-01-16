// Background service worker per l'estensione

// Configurazione
const PRODUCTION_URL = 'https://amazon-ads-manager-qsio.onrender.com';
const API_URL = PRODUCTION_URL || 'http://localhost:3000';

// Storage per i dati scrappati
let scrapedData = null;
let scrapeTabId = null;
let scrapePromiseResolve = null;
let scrapePromiseReject = null;

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
    scrapedData = request.data;

    if (scrapePromiseResolve && request.success) {
      scrapePromiseResolve(scrapedData);
      scrapePromiseResolve = null;
      scrapePromiseReject = null;
    }

    // Chiudi tab dopo aver ricevuto i dati
    if (scrapeTabId) {
      setTimeout(() => {
        chrome.tabs.remove(scrapeTabId).catch(() => {});
        scrapeTabId = null;
      }, 1000);
    }
  }

  // Scraping fallito
  if (request.action === 'kdpScrapeFailed') {
    console.error('[Background] KDP scrape failed:', request.error);

    if (scrapePromiseReject) {
      scrapePromiseReject(new Error(request.error));
      scrapePromiseResolve = null;
      scrapePromiseReject = null;
    }

    // Chiudi tab
    if (scrapeTabId) {
      setTimeout(() => {
        chrome.tabs.remove(scrapeTabId).catch(() => {});
        scrapeTabId = null;
      }, 1000);
    }
  }

  // Popup richiede di iniziare scraping client-side
  if (request.action === 'startClientScraping') {
    startClientSideScraping()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async
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

    // Timeout dopo 60 secondi
    setTimeout(() => {
      if (scrapePromiseReject) {
        reject(new Error('Scraping timeout - nessun dato ricevuto'));
        scrapePromiseResolve = null;
        scrapePromiseReject = null;
      }
    }, 60000);
  });

  // Apri tab kdpreports (dashboard con dati)
  // NOTA: active: true perche' Amazon richiede la tab in foreground per la sessione
  const tab = await chrome.tabs.create({
    url: 'https://kdpreports.amazon.com/#/dashboard',
    active: true // Apri in foreground - necessario per autenticazione Amazon
  });

  scrapeTabId = tab.id;
  console.log('[Background] Opened kdpreports tab:', tab.id);

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
