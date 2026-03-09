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
let bookshelfForceRefresh = false;

// Book metadata cache: { 'asin:marketplace': { pageCount, bsrRank, bsrCategory, bsrUpdatedAt } }
// BSR TTL: 6 hours — updates frequently. pageCount: kept indefinitely (rarely changes).
let _bookMetaCache = {};
const BSR_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Load cache from storage on startup
chrome.storage.local.get(['bookMetaCache'], (result) => {
  if (result.bookMetaCache) {
    _bookMetaCache = result.bookMetaCache;
    console.log('[Background] Book meta cache loaded:', Object.keys(_bookMetaCache).length, 'entries');
  }
});

// Combined sync state (bookshelf + sales in sequence)
let combinedSyncActive = false;

// Helper per inviare messaggi al popup (se aperto) E ai content scripts dell'app
async function sendToPopup(message) {
  // Invia al popup
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup potrebbe essere chiuso, ignora l'errore
  });

  // Mappa action → messaggio window.postMessage (fallback se content script non caricato)
  const PAGE_MESSAGE_MAP = {
    'syncProgress':          (m) => ({ type: 'KDP_SYNC_PROGRESS', percent: m.percent, text: m.text }),
    'syncComplete':          (m) => ({ type: 'KDP_SYNC_COMPLETE', success: m.success, monthsCount: m.monthsCount, totalRoyalties: m.totalRoyalties, error: m.error }),
    'syncError':             (m) => ({ type: 'KDP_SYNC_ERROR', error: m.error }),
    'bookshelfSyncComplete': (m) => ({ type: 'KDP_BOOKSHELF_SYNC_COMPLETE', success: m.success, booksCount: m.booksCount, error: m.error }),
    'bookshelfSyncError':    (m) => ({ type: 'KDP_BOOKSHELF_SYNC_ERROR', error: m.error }),
  };

  // Invia anche ai tab dell'app (dove gira auth-helper.js)
  try {
    const appTabs = await chrome.tabs.query({
      url: [
        'https://amazon-ads-manager-qsio.onrender.com/*',
        'http://localhost:3000/*'
      ]
    });
    for (const tab of appTabs) {
      const sent = await chrome.tabs.sendMessage(tab.id, message).then(() => true).catch(() => false);
      // Fallback: se il content script non è caricato, inietta window.postMessage direttamente
      if (!sent && PAGE_MESSAGE_MAP[message.action]) {
        const pageMsg = PAGE_MESSAGE_MAP[message.action](message);
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: (msg) => window.postMessage(msg, '*'),
          args: [pageMsg]
        }).catch(() => {});
      }
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
    const rawPercent = 20 + Math.round((request.monthIndex / 12) * 60); // 20-80%
    const percent = combinedSyncActive
      ? 40 + Math.round(rawPercent * 0.6) // 40-88% range in combined mode
      : rawPercent;
    const text = combinedSyncActive
      ? `Fase 2/2: ${request.monthLabel}... (${request.monthIndex + 1}/12)`
      : `Scaricamento ${request.monthLabel}... (${request.monthIndex + 1}/12)`;
    sendToPopup({ action: 'syncProgress', percent, text });
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
        .then(async result => {
          console.log('[Background] ✅ Data sent to server successfully:', result);
          updateBadge('✓', '#00aa00');

          // Notifica il popup del completamento
          await sendToPopup({
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
        .catch(async error => {
          console.error('[Background] ❌ Failed to send data to server:', error);
          updateBadge('!', '#ff0000');

          await sendToPopup({
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
          combinedSyncActive = false;

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

  // ========== COMBINED SYNC (Bookshelf + Sales) ==========

  if (request.action === 'startCombinedSync') {
    combinedSyncActive = true;
    pendingSyncJwtToken = request.jwtToken;
    pendingSyncMarketplace = request.marketplace || 'IT';
    bookshelfJwtToken = request.jwtToken;
    bookshelfMarketplace = request.marketplace || 'IT';
    console.log('[Background] Starting combined sync, marketplace:', pendingSyncMarketplace);

    sendResponse({ success: true, message: 'Combined sync started' });

    sendToPopup({ action: 'syncProgress', percent: 5, text: 'Fase 1/2: Sincronizzazione libri...' });

    // Timeout: if bookshelf doesn't complete within 60s, skip to sales
    const bookshelfTimeout = setTimeout(() => {
      if (combinedSyncActive && bookshelfTabId) {
        console.warn('[Background] Bookshelf scraping timeout, skipping to sales...');
        if (bookshelfTabId) {
          chrome.tabs.remove(bookshelfTabId).catch(() => {});
          bookshelfTabId = null;
        }
        bookshelfJwtToken = null;
        bookshelfMarketplace = null;
        sendToPopup({ action: 'syncProgress', percent: 40, text: 'Fase 2/2: Sincronizzazione vendite...' });
        startClientSideScraping().catch(err => {
          console.error('[Background] Sales scraping failed:', err.message);
          combinedSyncActive = false;
          sendToPopup({ action: 'syncError', error: err.message });
        });
      }
    }, 60000);

    // Store timeout so it can be cleared when bookshelf completes
    globalThis._bookshelfTimeout = bookshelfTimeout;

    startBookshelfScraping(pendingSyncMarketplace)
      .catch(error => {
        clearTimeout(globalThis._bookshelfTimeout);
        console.error('[Background] Bookshelf scraping failed in combined sync:', error.message);
        // Continue with sales even if bookshelf fails
        sendToPopup({ action: 'syncProgress', percent: 40, text: 'Fase 2/2: Sincronizzazione vendite...' });
        startClientSideScraping().catch(err => {
          console.error('[Background] Sales scraping also failed:', err.message);
          combinedSyncActive = false;
          sendToPopup({ action: 'syncError', error: err.message });
        });
      });

    return false;
  }

  // ========== BOOKSHELF SCRAPING ==========

  // Manual bookshelf-only sync triggered from web app UI (no sales phase after)
  if (request.action === 'startBookshelfSyncOnly') {
    bookshelfJwtToken = request.jwtToken;
    bookshelfMarketplace = request.marketplace || 'IT';
    bookshelfForceRefresh = request.forceRefresh || false;
    combinedSyncActive = false;

    sendToPopup({ action: 'syncProgress', percent: 5, text: 'Apertura KDP Bookshelf...' });

    startBookshelfScraping(bookshelfMarketplace)
      .catch(error => {
        console.error('[Background] Bookshelf-only sync failed:', error.message);
        bookshelfJwtToken = null;
        sendToPopup({ action: 'bookshelfSyncError', error: error.message });
      });
    return false;
  }

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
        chrome.tabs.sendMessage(bookshelfTabId, { action: 'startBookshelfScraping', forceRefresh: bookshelfForceRefresh });
      }, 3000);
    }
  }

  // Bookshelf scraping progress
  if (request.action === 'kdpBookshelfProgress') {
    const percent = combinedSyncActive
      ? 5 + Math.round(request.percent * 0.35) // 5-40% range in combined mode
      : request.percent;
    const text = combinedSyncActive
      ? `Fase 1/2: ${request.text}`
      : request.text;
    sendToPopup({ action: 'syncProgress', percent, text });
  }

  // Bookshelf scraping complete
  if (request.action === 'kdpBookshelfDataComplete') {
    clearTimeout(globalThis._bookshelfTimeout);
    console.log('[Background] Bookshelf data complete:', request.success, 'Books:', request.data?.books?.length);

    if (request.success && bookshelfJwtToken) {
      const progressText = combinedSyncActive ? 'Fase 1/2: Invio libri al server...' : 'Invio libri al server...';
      const progressPercent = combinedSyncActive ? 35 : 85;
      sendToPopup({ action: 'syncProgress', percent: progressPercent, text: progressText });

      sendBooksToServer(request.data.books, bookshelfJwtToken, request.data.marketplace)
        .then(async result => {
          console.log('[Background] Books sent to server:', result);

          await sendToPopup({
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

          if (!combinedSyncActive) {
            updateBadge('✓', '#00aa00');
            setTimeout(() => updateBadge('', '#ff9900'), 5000);
          }
        })
        .catch(async error => {
          console.error('[Background] Failed to send books:', error);

          await sendToPopup({
            action: 'bookshelfSyncComplete',
            success: false,
            error: error.message
          });

          chrome.storage.local.set({
            lastBookshelfSync: new Date().toISOString(),
            lastBookshelfSyncSuccess: false,
            lastBookshelfSyncError: error.message
          });

          if (!combinedSyncActive) {
            updateBadge('!', '#ff0000');
          }
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

          // In combined mode, proceed to sales scraping
          if (combinedSyncActive) {
            console.log('[Background] Combined sync: bookshelf done, starting sales...');
            sendToPopup({ action: 'syncProgress', percent: 40, text: 'Fase 2/2: Sincronizzazione vendite...' });
            startClientSideScraping().catch(err => {
              console.error('[Background] Sales scraping failed:', err.message);
              combinedSyncActive = false;
              sendToPopup({ action: 'syncError', error: err.message });
            });
          }
        });
    } else {
      bookshelfTabId = null;
      // If bookshelf had no data but combined sync, still proceed to sales
      if (combinedSyncActive) {
        console.log('[Background] Combined sync: bookshelf skipped, starting sales...');
        sendToPopup({ action: 'syncProgress', percent: 40, text: 'Fase 2/2: Sincronizzazione vendite...' });
        startClientSideScraping().catch(err => {
          console.error('[Background] Sales scraping failed:', err.message);
          combinedSyncActive = false;
          sendToPopup({ action: 'syncError', error: err.message });
        });
      }
    }
  }

  // Bookshelf scraping failed
  if (request.action === 'kdpBookshelfScrapeFailed') {
    clearTimeout(globalThis._bookshelfTimeout);
    console.error('[Background] Bookshelf scrape failed:', request.error);
    bookshelfTabId = null;
    bookshelfJwtToken = null;

    if (combinedSyncActive) {
      // In combined mode, log warning and proceed to sales
      console.warn('[Background] Combined sync: bookshelf failed, continuing with sales...');
      sendToPopup({ action: 'syncProgress', percent: 40, text: 'Fase 2/2: Sincronizzazione vendite...' });
      startClientSideScraping().catch(err => {
        console.error('[Background] Sales scraping failed:', err.message);
        combinedSyncActive = false;
        sendToPopup({ action: 'syncError', error: err.message });
      });
    } else {
      sendToPopup({ action: 'bookshelfSyncError', error: request.error });
    }
  }

  // ========== PAGE COUNT + BSR FETCH (for content script) ==========
  // Content scripts cannot make cross-origin requests, so we handle it here
  if (request.action === 'fetchPageCount') {
    fetchPageCountFromAmazon(request.asin, request.marketplace)
      .then(result => sendResponse({ success: true, pageCount: result.pageCount, bsrRank: result.bsrRank, bsrCategory: result.bsrCategory }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
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

  // Always open a fresh bookshelf tab to ensure content script is loaded
  // (reusing existing tabs fails if extension was updated or content script not injected)
  const existingTabs = await chrome.tabs.query({ url: 'https://kdp.amazon.com/*/bookshelf*' });
  for (const t of existingTabs) {
    chrome.tabs.remove(t.id).catch(() => {});
  }

  sendToPopup({ action: 'syncProgress', percent: 10, text: 'Apertura KDP Bookshelf...' });
  const currentWindow = await chrome.windows.getCurrent();
  const tab = await chrome.tabs.create({
    url: bookshelfUrl,
    active: false,
    windowId: currentWindow.id
  });
  bookshelfTabId = tab.id;
  console.log('[Background] Opened bookshelf tab:', tab.id);
  // startBookshelfScraping will be sent when kdpBookshelfScraperReady fires
}

// Funzione per inviare libri al server
async function sendBooksToServer(books, jwtToken, marketplace) {
  console.log('[Background] Sending', books.length, 'books to server, marketplace:', marketplace);

  // Inject marketplace into each book (scraper detects it from URL but backend requires it per-book)
  const booksWithMarketplace = books.map(book => ({
    ...book,
    marketplace: book.marketplace || marketplace || 'IT'
  }));

  const response = await fetch(`${API_URL}/api/kdp/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({ books: booksWithMarketplace })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send books');
  }

  return response.json();
}

// Imposta badge iniziale
updateBadge('', '#ff9900');

// ========== PAGE COUNT FETCHING ==========

/**
 * Maps marketplace code to Amazon store domain
 */
function getAmazonDomain(marketplace) {
  const domains = {
    'US': 'www.amazon.com',
    'UK': 'www.amazon.co.uk',
    'DE': 'www.amazon.de',
    'FR': 'www.amazon.fr',
    'ES': 'www.amazon.es',
    'IT': 'www.amazon.it',
    'CA': 'www.amazon.ca',
    'AU': 'www.amazon.com.au',
    'JP': 'www.amazon.co.jp'
  };
  return domains[marketplace] || 'www.amazon.com';
}

/**
 * Fetches pageCount and BSR from Amazon product page for a single ASIN.
 * BSR and pageCount are cached for BSR_CACHE_TTL_MS (6h): neither is used in
 * calculations (display only), so a 6h refresh cycle is sufficient and keeps sync fast.
 * Cache is also used as fallback when the HTTP request fails.
 * Returns { pageCount, bsrRank, bsrCategory }.
 */
async function fetchPageCountFromAmazon(asin, marketplace) {
  const cacheKey = `${asin}:${marketplace}`;
  const cached = _bookMetaCache[cacheKey];

  // Return cached data if still fresh AND bsrRank was actually found.
  // If cached bsrRank is null, bypass cache so we retry the fetch (extraction may have failed).
  if (cached && cached.bsrUpdatedAt && cached.bsrRank && (Date.now() - cached.bsrUpdatedAt) < BSR_CACHE_TTL_MS) {
    const ageMin = Math.round((Date.now() - cached.bsrUpdatedAt) / 60000);
    console.log(`[Background] ${asin}: using cache (age: ${ageMin}min, bsr=#${cached.bsrRank})`);
    return { pageCount: cached.pageCount, bsrRank: cached.bsrRank, bsrCategory: cached.bsrCategory };
  }
  // If we have a recent pageCount but stale/missing bsrRank, still return cached pageCount to avoid re-fetching
  if (cached && cached.pageCount && !cached.bsrRank) {
    console.log(`[Background] ${asin}: cached pageCount=${cached.pageCount} but bsrRank null — will re-fetch`);
  }

  const domain = getAmazonDomain(marketplace);
  const url = `https://${domain}/dp/${asin}`;

  console.log(`[Background] Fetching book meta for ${asin} from ${url}`);

  const response = await fetch(url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    console.warn(`[Background] Failed to fetch ${asin}: ${response.status}`);
    // Return cached data (even stale) as fallback
    return {
      pageCount: cached?.pageCount || null,
      bsrRank: cached?.bsrRank || null,
      bsrCategory: cached?.bsrCategory || null
    };
  }

  const html = await response.text();
  const pageCount = extractPageCountFromHtml(html);
  const bsr = extractBsrFromHtml(html);

  // Update cache.
  // - pageCount: use new value, or preserve old if not returned
  // - bsrRank: use new value, or preserve old if extraction failed (don't overwrite good BSR with null)
  // - bsrUpdatedAt: only mark fresh if BSR was actually found; otherwise keep old timestamp so next sync retries
  const newBsrRank = bsr?.rank || null;
  _bookMetaCache[cacheKey] = {
    pageCount: pageCount || cached?.pageCount || null,
    bsrRank: newBsrRank || cached?.bsrRank || null,
    bsrCategory: newBsrRank ? (bsr?.category || null) : (cached?.bsrCategory || null),
    bsrUpdatedAt: newBsrRank ? Date.now() : (cached?.bsrUpdatedAt || null)
  };
  chrome.storage.local.set({ bookMetaCache: _bookMetaCache });

  console.log(`[Background] ${asin}: pageCount=${_bookMetaCache[cacheKey].pageCount}, bsrRank=${_bookMetaCache[cacheKey].bsrRank}`);
  return {
    pageCount: _bookMetaCache[cacheKey].pageCount,
    bsrRank: _bookMetaCache[cacheKey].bsrRank,
    bsrCategory: _bookMetaCache[cacheKey].bsrCategory
  };
}

/**
 * Extracts BSR (Best Sellers Rank) from Amazon product page HTML.
 * Returns { rank: number, category: string } or null if not found.
 */
function extractBsrFromHtml(html) {
  const bsrHeaders = [
    'Best Sellers Rank',
    'Best Seller Rank',
    'Classifica Bestseller',
    'Rang unter Amazon',
    'Classement des meilleures ventes',
    'Posición en los más vendidos',
    'ベストセラー'
  ];

  let snippetStart = -1;
  for (const header of bsrHeaders) {
    const idx = html.indexOf(header);
    if (idx !== -1) { snippetStart = idx; break; }
  }

  if (snippetStart === -1) return null;

  const snippet = html.slice(snippetStart, snippetStart + 600);
  const match = snippet.match(/#([\d,\.]+)\s+in\s+([^<\n(]{3,60})/);
  if (!match) return null;

  const rank = parseInt(match[1].replace(/[,.]/g, ''));
  const category = match[2].trim().replace(/\s+/g, ' ');

  if (rank > 0 && rank < 10000000) return { rank, category };
  return null;
}

/**
 * Extracts page count from Amazon product page HTML.
 * Looks for patterns like "Print length: 320 pages" or "Pagine: 320"
 */
function extractPageCountFromHtml(html) {
  // Common patterns for page count in product details
  const patterns = [
    // English patterns
    /Print length[:\s<>\/\w]*?(\d+)\s*pages?/i,
    /(\d+)\s*pages?<\/span>/i,
    /"numberOfPages"\s*:\s*"?(\d+)"?/i,

    // Italian
    /Lunghezza stampa[:\s<>\/\w]*?(\d+)/i,
    /(\d+)\s*pagine<\/span>/i,

    // German
    /Seitenzahl[:\s<>\/\w]*?(\d+)/i,
    /(\d+)\s*Seiten<\/span>/i,

    // French
    /Nombre de pages[:\s<>\/\w]*?(\d+)/i,

    // Spanish
    /Longitud de impresi[óo]n[:\s<>\/\w]*?(\d+)/i,
    /(\d+)\s*p[áa]ginas<\/span>/i,

    // JSON-LD format (often in structured data)
    /"numberOfPages"\s*:\s*(\d+)/i,

    // Generic detail row pattern
    />(\d{2,4})\s*(?:pages?|pagine|Seiten|páginas)<\/span>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const pageCount = parseInt(match[1]);
      if (pageCount > 10 && pageCount < 10000) {
        return pageCount;
      }
    }
  }

  return null;
}
