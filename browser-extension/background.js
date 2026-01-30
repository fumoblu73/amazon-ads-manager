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

// Bookshelf scraping state
let bookshelfTabId = null;
let bookshelfJwtToken = null;
let bookshelfMarketplace = null;

// Helper per inviare messaggi al popup (se aperto) E ai content scripts dell'app
async function sendToPopup(message) {
  // Invia al popup
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup potrebbe essere chiuso, ignora l'errore
  });

  // Invia anche ai tab dell'app (dove gira auth-helper.js)
  try {
    const appTabs = await chrome.tabs.query({
      url: [
        'https://amazon-ads-manager-qsio.onrender.com/*',
        'http://localhost:3000/*'
      ]
    });
    for (const tab of appTabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab potrebbe non avere il content script, ignora
      });
    }
  } catch (e) {
    // Ignora errori
  }
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

          // Chiudi il tab di kdpreports dopo il sync (successo o errore)
          if (scrapeTabId) {
            const tabToClose = scrapeTabId;
            setTimeout(() => {
              chrome.tabs.remove(tabToClose).catch(() => {
                // Tab potrebbe essere già chiuso, ignora
              });
              console.log('[Background] Closed kdpreports tab:', tabToClose);
            }, 2000);
          }
          scrapeTabId = null;
        });
    } else {
      scrapeTabId = null;
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

  // ========== BOOKSHELF SCRAPING ==========

  // Popup richiede scraping bookshelf
  if (request.action === 'startBookshelfScraping') {
    bookshelfJwtToken = request.jwtToken;
    bookshelfMarketplace = request.marketplace || 'US';
    console.log('[Background] Starting bookshelf scraping, marketplace:', bookshelfMarketplace);

    sendResponse({ success: true, message: 'Bookshelf scraping started' });

    startBookshelfScraping(bookshelfMarketplace)
      .catch(error => {
        console.error('[Background] Bookshelf scraping failed:', error.message);
        updateBadge('!', '#ff0000');
        sendToPopup({ action: 'bookshelfSyncError', error: error.message });
      });

    return false;
  }

  // Bookshelf content script ready
  if (request.action === 'kdpBookshelfScraperReady') {
    console.log('[Background] Bookshelf scraper ready on:', request.url);
    if (bookshelfTabId && sender.tab?.id === bookshelfTabId) {
      sendToPopup({ action: 'syncProgress', percent: 15, text: 'Bookshelf caricato, avvio scraping...' });
      setTimeout(() => {
        chrome.tabs.sendMessage(bookshelfTabId, { action: 'startBookshelfScraping' });
      }, 3000);
    }
  }

  // Bookshelf scraping progress
  if (request.action === 'kdpBookshelfProgress') {
    sendToPopup({
      action: 'syncProgress',
      percent: request.percent,
      text: request.text
    });
  }

  // Bookshelf scraping complete
  if (request.action === 'kdpBookshelfDataComplete') {
    console.log('[Background] Bookshelf data complete:', request.success, 'Books:', request.data?.books?.length);

    if (request.success && bookshelfJwtToken) {
      sendToPopup({ action: 'syncProgress', percent: 85, text: 'Invio libri al server...' });

      sendBooksToServer(request.data.books, bookshelfJwtToken, request.data.marketplace)
        .then(result => {
          console.log('[Background] Books sent to server:', result);
          updateBadge('✓', '#00aa00');

          sendToPopup({
            action: 'bookshelfSyncComplete',
            success: true,
            booksCount: request.data.books.length,
            booksUpdated: result.booksUpdated
          });

          chrome.storage.local.set({
            lastBookshelfSync: new Date().toISOString(),
            lastBookshelfSyncSuccess: true,
            lastBookshelfBooksCount: request.data.books.length
          });

          setTimeout(() => updateBadge('', '#ff9900'), 5000);
        })
        .catch(error => {
          console.error('[Background] Failed to send books:', error);
          updateBadge('!', '#ff0000');

          sendToPopup({
            action: 'bookshelfSyncComplete',
            success: false,
            error: error.message
          });

          chrome.storage.local.set({
            lastBookshelfSync: new Date().toISOString(),
            lastBookshelfSyncSuccess: false,
            lastBookshelfSyncError: error.message
          });
        })
        .finally(() => {
          bookshelfJwtToken = null;
          bookshelfMarketplace = null;

          if (bookshelfTabId) {
            const tabToClose = bookshelfTabId;
            setTimeout(() => {
              chrome.tabs.remove(tabToClose).catch(() => {});
            }, 2000);
          }
          bookshelfTabId = null;
        });
    } else {
      bookshelfTabId = null;
    }
  }

  // Bookshelf scraping failed
  if (request.action === 'kdpBookshelfScrapeFailed') {
    console.error('[Background] Bookshelf scrape failed:', request.error);
    sendToPopup({ action: 'bookshelfSyncError', error: request.error });
    bookshelfTabId = null;
    bookshelfJwtToken = null;
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
    // Apri nuovo tab kdpreports in background
    sendToPopup({ action: 'syncProgress', percent: 10, text: 'Apertura kdpreports...' });

    // Trova la finestra corrente per aprire il tab lì
    const currentWindow = await chrome.windows.getCurrent();

    tab = await chrome.tabs.create({
      url: 'https://kdpreports.amazon.com/dashboard',
      active: false,  // Apri in background per non disturbare l'utente
      windowId: currentWindow.id
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

// Funzione per aprire tab KDP bookshelf e fare scraping
async function startBookshelfScraping(marketplace) {
  console.log('[Background] Starting bookshelf scraping...');

  // Map marketplace to KDP locale
  const localeMap = { US: 'en_US', UK: 'en_GB', IT: 'it_IT', DE: 'de_DE', FR: 'fr_FR', ES: 'es_ES', CA: 'en_CA', AU: 'en_AU', JP: 'ja_JP' };
  const locale = localeMap[marketplace] || 'en_US';
  const bookshelfUrl = `https://kdp.amazon.com/${locale}/bookshelf`;

  // Check for existing tab
  const existingTabs = await chrome.tabs.query({ url: 'https://kdp.amazon.com/*/bookshelf*' });

  let tab;
  if (existingTabs.length > 0) {
    tab = existingTabs[0];
    bookshelfTabId = tab.id;
    sendToPopup({ action: 'syncProgress', percent: 12, text: 'Usando tab bookshelf esistente...' });
    setTimeout(() => {
      chrome.tabs.sendMessage(bookshelfTabId, { action: 'startBookshelfScraping' });
    }, 2000);
  } else {
    sendToPopup({ action: 'syncProgress', percent: 10, text: 'Apertura KDP Bookshelf...' });
    const currentWindow = await chrome.windows.getCurrent();
    tab = await chrome.tabs.create({
      url: bookshelfUrl,
      active: false,
      windowId: currentWindow.id
    });
    bookshelfTabId = tab.id;
    console.log('[Background] Opened bookshelf tab:', tab.id);
    // startBookshelfScraping will be sent when kdpBookshelfScraperReady fires
  }
}

// Funzione per inviare libri al server
async function sendBooksToServer(books, jwtToken, marketplace) {
  console.log('[Background] Sending', books.length, 'books to server...');

  const response = await fetch(`${API_URL}/api/kdp/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({ books })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send books');
  }

  return response.json();
}

// Imposta badge iniziale
updateBadge('', '#ff9900');
