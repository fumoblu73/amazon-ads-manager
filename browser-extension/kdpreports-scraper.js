// Content script per scraping client-side di KDP Reports
// Viene iniettato su kdpreports.amazon.com e intercetta le chiamate API

(function() {
  'use strict';

  console.log('[KDP Scraper] Content script loaded');

  // Configura intercettazione fetch
  const originalFetch = window.fetch;
  const capturedData = {
    overview: null,
    orders: null,
    marketplace: null,
    topTitles: null,
    csrfToken: null,
    timestamp: new Date().toISOString()
  };

  // Estrai CSRF token dalla pagina
  function extractCsrfToken() {
    try {
      // Cerca nel body della pagina il pattern csrftoken
      const bodyHtml = document.documentElement.innerHTML;
      const csrfMatch = bodyHtml.match(/"csrftoken"\s*:\s*\{\s*"token"\s*:\s*"([^"]+)"/);
      if (csrfMatch) {
        capturedData.csrfToken = csrfMatch[1];
        console.log('[KDP Scraper] CSRF token found');
        return csrfMatch[1];
      }
    } catch (e) {
      console.error('[KDP Scraper] Error extracting CSRF token:', e);
    }
    return null;
  }

  // Intercetta fetch per catturare risposte API
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

      // Cattura solo le API di kdpreports
      if (url.includes('/reports/dashboard/')) {
        // Clone response per poterla leggere
        const clone = response.clone();
        const data = await clone.json();

        if (url.includes('/overview')) {
          capturedData.overview = data;
          console.log('[KDP Scraper] Captured overview data');
        } else if (url.includes('/ORDERS')) {
          capturedData.orders = data;
          console.log('[KDP Scraper] Captured orders data');
        } else if (url.includes('/marketplaceDistributionOverview')) {
          capturedData.marketplace = data;
          console.log('[KDP Scraper] Captured marketplace data');
        } else if (url.includes('/topEarningTitles')) {
          capturedData.topTitles = data;
          console.log('[KDP Scraper] Captured top titles data');
        }

        // Notifica background script dei dati catturati
        notifyDataCaptured();
      }
    } catch (e) {
      // Ignora errori di parsing
    }

    return response;
  };

  // Notifica background script quando abbiamo dati
  function notifyDataCaptured() {
    chrome.runtime.sendMessage({
      action: 'kdpDataCaptured',
      data: capturedData,
      hasAllData: !!(capturedData.overview && capturedData.orders && capturedData.marketplace)
    });
  }

  // Funzione per attendere che la pagina sia pronta
  async function waitForPageReady(maxWait = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      // Check if we're on a login page
      if (document.title.toLowerCase().includes('sign') ||
          document.querySelector('form[name="signIn"]') ||
          document.querySelector('#ap_email')) {
        throw new Error('Login required - please login to kdpreports.amazon.com first');
      }
      // Check if CSRF token is available
      if (extractCsrfToken()) {
        return true;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }

  // Funzione per fare le chiamate API direttamente
  async function fetchKdpData() {
    console.log('[KDP Scraper] Starting manual data fetch...');
    console.log('[KDP Scraper] Current URL:', window.location.href);
    console.log('[KDP Scraper] Page title:', document.title);

    // Attendi che la pagina sia pronta
    console.log('[KDP Scraper] Waiting for page to be ready...');
    try {
      await waitForPageReady(15000);
    } catch (e) {
      console.error('[KDP Scraper] Page not ready:', e.message);
      chrome.runtime.sendMessage({
        action: 'kdpScrapeFailed',
        error: e.message
      });
      return;
    }

    // Estrai CSRF token
    const csrfToken = extractCsrfToken();
    if (!csrfToken) {
      console.error('[KDP Scraper] Could not find CSRF token after waiting');
      console.log('[KDP Scraper] Page HTML preview:', document.body?.innerHTML?.substring(0, 500));
      chrome.runtime.sendMessage({
        action: 'kdpScrapeFailed',
        error: 'CSRF token not found - page may not be fully loaded or user not logged in'
      });
      return;
    }
    console.log('[KDP Scraper] CSRF token found, proceeding with API calls...');

    // Date per le query
    const now = new Date();
    const dateParam = now.toISOString().split('.')[0] + 'Z';

    const baseUrl = 'https://kdpreports.amazon.com/reports/dashboard';
    const headers = {
      'Accept': 'application/json',
      'x-csrf-token': csrfToken
    };

    // Helper per fare fetch sicuro con controllo content-type
    async function safeFetch(url, options) {
      const res = await fetch(url, options);
      if (!res.ok) {
        console.log(`[KDP Scraper] Request failed: ${res.status} ${res.statusText}`);
        return null;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log(`[KDP Scraper] Non-JSON response: ${contentType}`);
        // Check if it's a login page
        const text = await res.text();
        if (text.includes('signin') || text.includes('login') || text.includes('<!doctype')) {
          console.log('[KDP Scraper] Detected login page - user not authenticated');
          throw new Error('Not authenticated - please login to kdpreports.amazon.com first');
        }
        return null;
      }
      return res.json();
    }

    try {
      // 1. Overview (THIS_MONTH)
      console.log('[KDP Scraper] Fetching overview...');
      capturedData.overview = await safeFetch(
        `${baseUrl}/overview?date=${encodeURIComponent(dateParam)}&viewOption=THIS_MONTH`,
        { headers, credentials: 'include' }
      );
      if (capturedData.overview) {
        console.log('[KDP Scraper] Overview:', capturedData.overview);
      }

      // 2. Orders (LAST_30_DAYS)
      console.log('[KDP Scraper] Fetching orders...');
      capturedData.orders = await safeFetch(
        `${baseUrl}/ORDERS?date=${encodeURIComponent(dateParam)}&viewOption=LAST_30_DAYS`,
        { headers, credentials: 'include' }
      );
      if (capturedData.orders) {
        console.log('[KDP Scraper] Orders:', capturedData.orders);
      }

      // 3. Marketplace distribution
      console.log('[KDP Scraper] Fetching marketplace distribution...');
      capturedData.marketplace = await safeFetch(
        `${baseUrl}/marketplaceDistributionOverview?date=${encodeURIComponent(dateParam)}&viewOption=THIS_MONTH`,
        { headers, credentials: 'include' }
      );
      if (capturedData.marketplace) {
        console.log('[KDP Scraper] Marketplace:', capturedData.marketplace);
      }

      // 4. Top titles
      console.log('[KDP Scraper] Fetching top titles...');
      capturedData.topTitles = await safeFetch(
        `${baseUrl}/topEarningTitles?date=${encodeURIComponent(dateParam)}&viewOption=THIS_MONTH`,
        { headers, credentials: 'include' }
      );
      if (capturedData.topTitles) {
        console.log('[KDP Scraper] Top titles:', capturedData.topTitles);
      }

      // Invia tutti i dati al background script
      capturedData.timestamp = new Date().toISOString();

      chrome.runtime.sendMessage({
        action: 'kdpDataComplete',
        data: capturedData,
        success: !!(capturedData.overview && capturedData.orders)
      });

      console.log('[KDP Scraper] All data fetched successfully');

    } catch (error) {
      console.error('[KDP Scraper] Fetch error:', error);
      chrome.runtime.sendMessage({
        action: 'kdpScrapeFailed',
        error: error.message
      });
    }
  }

  // Ascolta messaggi dal background/popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[KDP Scraper] Received message:', request.action);

    if (request.action === 'startScraping') {
      // Inizia lo scraping manuale
      fetchKdpData().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response
    }

    if (request.action === 'getCapturedData') {
      sendResponse({ data: capturedData });
    }

    if (request.action === 'ping') {
      sendResponse({ ready: true, hasCsrfToken: !!extractCsrfToken() });
    }
  });

  // Notifica che lo script e' pronto
  setTimeout(() => {
    chrome.runtime.sendMessage({
      action: 'kdpScraperReady',
      url: window.location.href
    });
  }, 1000);

})();
