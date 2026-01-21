// Content script per scraping client-side di KDP Reports
// Viene iniettato su kdpreports.amazon.com e intercetta le chiamate API

(function() {
  'use strict';

  console.log('[KDP Scraper] ========================================');
  console.log('[KDP Scraper] Content script loaded');
  console.log('[KDP Scraper] URL:', window.location.href);
  console.log('[KDP Scraper] Title:', document.title);
  console.log('[KDP Scraper] ReadyState:', document.readyState);
  console.log('[KDP Scraper] ========================================');

  // Configura intercettazione fetch
  const originalFetch = window.fetch;
  const capturedData = {
    overview: null,
    orders: null,
    marketplace: null,
    topTitles: null,
    historicalMonths: [],
    csrfToken: null,
    timestamp: new Date().toISOString()
  };

  // Estrai CSRF token dalla pagina
  function extractCsrfToken() {
    try {
      // Cerca nel body della pagina il pattern csrftoken
      const bodyHtml = document.documentElement.innerHTML;

      // Pattern 1: csrftoken nel JSON - formato {"csrftoken":{"token":"xxx"}}
      const csrfMatch = bodyHtml.match(/"csrftoken"\s*:\s*\{\s*"token"\s*:\s*"([^"]+)"/);
      if (csrfMatch) {
        capturedData.csrfToken = csrfMatch[1];
        console.log('[KDP Scraper] CSRF token found (pattern 1):', csrfMatch[1].substring(0, 20) + '...');
        return csrfMatch[1];
      }

      // Pattern 2: csrf-token meta tag
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag) {
        const token = metaTag.getAttribute('content');
        if (token) {
          capturedData.csrfToken = token;
          console.log('[KDP Scraper] CSRF token found (meta tag):', token.substring(0, 20) + '...');
          return token;
        }
      }

      // Pattern 3: window.__INITIAL_STATE__ o simile
      const stateMatch = bodyHtml.match(/csrfToken['"]\s*:\s*['"]([^'"]+)['"]/i);
      if (stateMatch) {
        capturedData.csrfToken = stateMatch[1];
        console.log('[KDP Scraper] CSRF token found (pattern 3):', stateMatch[1].substring(0, 20) + '...');
        return stateMatch[1];
      }

      // Pattern 4: Cerca "token" dentro csrftoken object
      const tokenMatch = bodyHtml.match(/"token"\s*:\s*"([a-zA-Z0-9+/=_-]{20,})"/);
      if (tokenMatch) {
        capturedData.csrfToken = tokenMatch[1];
        console.log('[KDP Scraper] CSRF token found (pattern 4 - token field):', tokenMatch[1].substring(0, 20) + '...');
        return tokenMatch[1];
      }

      // Pattern 5: Cerca csrf in qualsiasi formato
      const anyTokenMatch = bodyHtml.match(/csrf[_-]?token['":\s]+['"]([a-zA-Z0-9+/=_-]{20,})['"]/i);
      if (anyTokenMatch) {
        capturedData.csrfToken = anyTokenMatch[1];
        console.log('[KDP Scraper] CSRF token found (pattern 5):', anyTokenMatch[1].substring(0, 20) + '...');
        return anyTokenMatch[1];
      }

      // Debug: cerca tutte le occorrenze di "csrf" nel documento
      const csrfOccurrences = bodyHtml.match(/csrf[^"]{0,50}/gi);
      if (csrfOccurrences) {
        console.log('[KDP Scraper] Found csrf occurrences:', csrfOccurrences.slice(0, 5));
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

  // Funzione per controllare se siamo su una pagina di login
  function isLoginPage() {
    const indicators = {
      title: document.title.toLowerCase(),
      hasSignInForm: !!document.querySelector('form[name="signIn"]'),
      hasEmailInput: !!document.querySelector('#ap_email'),
      hasEmailNameInput: !!document.querySelector('input[name="email"]'),
      hasPasswordInput: !!document.querySelector('#ap_password'),
      hasSignInButton: !!document.querySelector('#signInSubmit'),
      url: window.location.href
    };

    console.log('[KDP Scraper] Login page indicators:', JSON.stringify(indicators));

    const isLogin = indicators.title.includes('sign') ||
                    indicators.hasSignInForm ||
                    indicators.hasEmailInput ||
                    indicators.hasPasswordInput;

    return isLogin;
  }

  // Funzione per attendere che la pagina sia pronta
  async function waitForPageReady(maxWait = 30000) {
    const startTime = Date.now();
    let lastLog = 0;

    console.log('[KDP Scraper] Starting to wait for page ready...');
    console.log('[KDP Scraper] Initial document.readyState:', document.readyState);

    // Prima aspetta che il documento sia completo
    if (document.readyState !== 'complete') {
      console.log('[KDP Scraper] Waiting for document.readyState to be complete...');
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve);
        }
      });
      console.log('[KDP Scraper] Document loaded');
    }

    // Ora cerca il CSRF token
    while (Date.now() - startTime < maxWait) {
      const elapsed = Date.now() - startTime;

      // Log ogni 3 secondi per debug
      if (elapsed - lastLog > 3000) {
        console.log(`[KDP Scraper] Waiting... ${elapsed}ms`);
        console.log(`[KDP Scraper] - Title: "${document.title}"`);
        console.log(`[KDP Scraper] - URL: ${window.location.href}`);
        console.log(`[KDP Scraper] - Body length: ${document.body?.innerHTML?.length || 0}`);
        lastLog = elapsed;
      }

      // Check if we're on a login page (but wait at least 8 seconds first - SPA might be loading)
      if (elapsed > 8000) {
        if (isLoginPage()) {
          console.log('[KDP Scraper] Login page detected after waiting');
          throw new Error('Login required - please login to kdpreports.amazon.com first');
        }
      }

      // Check if CSRF token is available
      const token = extractCsrfToken();
      if (token) {
        console.log(`[KDP Scraper] Page ready! Token found after ${elapsed}ms`);
        return true;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    console.log('[KDP Scraper] ========================================');
    console.log('[KDP Scraper] TIMEOUT - Page info dump:');
    console.log('[KDP Scraper] Title:', document.title);
    console.log('[KDP Scraper] URL:', window.location.href);
    console.log('[KDP Scraper] Body length:', document.body?.innerHTML?.length);
    console.log('[KDP Scraper] Body preview (first 2000 chars):');
    console.log(document.body?.innerHTML?.substring(0, 2000));
    console.log('[KDP Scraper] ========================================');

    // Check again if it's a login page
    if (isLoginPage()) {
      throw new Error('Login required - please login to kdpreports.amazon.com first');
    }

    return false;
  }

  // Funzione per fare le chiamate API direttamente
  async function fetchKdpData() {
    console.log('[KDP Scraper] ========================================');
    console.log('[KDP Scraper] Starting manual data fetch...');
    console.log('[KDP Scraper] Current URL:', window.location.href);
    console.log('[KDP Scraper] Page title:', document.title);
    console.log('[KDP Scraper] ========================================');

    // Attendi che la pagina sia pronta
    console.log('[KDP Scraper] Waiting for page to be ready...');
    try {
      const ready = await waitForPageReady(30000);
      if (!ready) {
        console.error('[KDP Scraper] Page never became ready (no CSRF token found)');
        chrome.runtime.sendMessage({
          action: 'kdpScrapeFailed',
          error: 'Page timeout - CSRF token not found. Make sure you are logged in to kdpreports.amazon.com'
        });
        return;
      }
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
      console.log('[KDP Scraper] Fetching:', url);
      console.log('[KDP Scraper] Headers:', JSON.stringify(options.headers));

      const res = await fetch(url, options);
      console.log('[KDP Scraper] Response status:', res.status, res.statusText);
      console.log('[KDP Scraper] Response headers:', [...res.headers.entries()]);

      if (!res.ok) {
        console.log(`[KDP Scraper] Request failed: ${res.status} ${res.statusText}`);
        const errorText = await res.text();
        console.log('[KDP Scraper] Error response (first 500 chars):', errorText.substring(0, 500));
        return null;
      }

      const contentType = res.headers.get('content-type');
      console.log('[KDP Scraper] Content-Type:', contentType);

      if (!contentType || !contentType.includes('application/json')) {
        console.log(`[KDP Scraper] Non-JSON response: ${contentType}`);
        const text = await res.text();
        console.log('[KDP Scraper] Response text (first 500 chars):', text.substring(0, 500));

        // Check if it's actually a login/signin page (more specific check)
        if (text.includes('ap_email') || text.includes('signIn') || text.includes('auth-portal')) {
          console.log('[KDP Scraper] Detected login page in response');
          throw new Error('Not authenticated - please login to kdpreports.amazon.com first');
        }

        // Se è HTML ma non una login page, potrebbe essere un errore diverso
        console.log('[KDP Scraper] Non-JSON response but not a login page, skipping');
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
        console.log('[KDP Scraper] Overview received:', Object.keys(capturedData.overview));
      }

      // 2. Orders - prova diversi endpoint
      console.log('[KDP Scraper] Fetching orders...');
      // Prova prima l'endpoint ordersWidget
      capturedData.orders = await safeFetch(
        `${baseUrl}/ordersWidget?date=${encodeURIComponent(dateParam)}&viewOption=LAST_30_DAYS`,
        { headers, credentials: 'include' }
      );
      // Se non funziona, prova l'endpoint orders (minuscolo)
      if (!capturedData.orders) {
        console.log('[KDP Scraper] Trying alternative orders endpoint...');
        capturedData.orders = await safeFetch(
          `${baseUrl}/orders?date=${encodeURIComponent(dateParam)}&viewOption=LAST_30_DAYS`,
          { headers, credentials: 'include' }
        );
      }
      if (capturedData.orders) {
        console.log('[KDP Scraper] Orders received:', Object.keys(capturedData.orders));
      } else {
        console.log('[KDP Scraper] Orders endpoint not available - continuing without daily orders data');
      }

      // 3. Marketplace distribution
      console.log('[KDP Scraper] Fetching marketplace distribution...');
      capturedData.marketplace = await safeFetch(
        `${baseUrl}/marketplaceDistributionOverview?date=${encodeURIComponent(dateParam)}&viewOption=THIS_MONTH`,
        { headers, credentials: 'include' }
      );
      if (capturedData.marketplace) {
        console.log('[KDP Scraper] Marketplace received:', Object.keys(capturedData.marketplace));
      }

      // 4. Top titles
      console.log('[KDP Scraper] Fetching top titles...');
      capturedData.topTitles = await safeFetch(
        `${baseUrl}/topEarningTitles?date=${encodeURIComponent(dateParam)}&viewOption=THIS_MONTH`,
        { headers, credentials: 'include' }
      );
      if (capturedData.topTitles) {
        console.log('[KDP Scraper] Top titles received:', Object.keys(capturedData.topTitles));
      }

      // 5. Historical data - fetch last 12 months
      console.log('[KDP Scraper] Fetching historical data (last 12 months)...');
      capturedData.historicalMonths = [];

      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthDateParam = monthDate.toISOString().split('.')[0] + 'Z';
        const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        console.log(`[KDP Scraper] Fetching month ${i + 1}/12: ${monthLabel}...`);

        // Invia progresso al background/popup
        chrome.runtime.sendMessage({
          action: 'kdpScrapingProgress',
          monthIndex: i,
          monthLabel: monthLabel
        }).catch(() => {});

        const monthOverview = await safeFetch(
          `${baseUrl}/overview?date=${encodeURIComponent(monthDateParam)}&viewOption=THIS_MONTH`,
          { headers, credentials: 'include' }
        );

        if (monthOverview?.overviewWidget) {
          capturedData.historicalMonths.push({
            month: monthDate.toISOString().split('T')[0].substring(0, 7), // YYYY-MM format
            label: monthLabel,
            data: monthOverview.overviewWidget
          });
          console.log(`[KDP Scraper] Month ${monthLabel}: $${monthOverview.overviewWidget.totalRoyalties?.toFixed(2) || 0}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      }

      console.log(`[KDP Scraper] Historical data: ${capturedData.historicalMonths.length} months captured`);

      // Invia tutti i dati al background script
      capturedData.timestamp = new Date().toISOString();

      console.log('[KDP Scraper] ========================================');
      console.log('[KDP Scraper] All data fetched!');
      console.log('[KDP Scraper] Has overview:', !!capturedData.overview);
      console.log('[KDP Scraper] Has orders:', !!capturedData.orders);
      console.log('[KDP Scraper] Has marketplace:', !!capturedData.marketplace);
      console.log('[KDP Scraper] Has topTitles:', !!capturedData.topTitles);

      // Considera successo se abbiamo almeno overview (dati principali)
      const isSuccess = !!capturedData.overview;
      console.log('[KDP Scraper] Sync success:', isSuccess);
      console.log('[KDP Scraper] ========================================');

      chrome.runtime.sendMessage({
        action: 'kdpDataComplete',
        data: capturedData,
        success: isSuccess
      });

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
      console.log('[KDP Scraper] Starting scraping process...');
      // Inizia lo scraping manuale
      fetchKdpData().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('[KDP Scraper] Scraping failed:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response
    }

    if (request.action === 'getCapturedData') {
      sendResponse({ data: capturedData });
    }

    if (request.action === 'ping') {
      const hasCsrf = !!extractCsrfToken();
      console.log('[KDP Scraper] Ping response - hasCsrfToken:', hasCsrf);
      sendResponse({ ready: true, hasCsrfToken: hasCsrf });
    }
  });

  // Notifica che lo script e' pronto (dopo un breve delay per lasciare tempo al DOM)
  setTimeout(() => {
    console.log('[KDP Scraper] Sending kdpScraperReady message to background...');
    chrome.runtime.sendMessage({
      action: 'kdpScraperReady',
      url: window.location.href,
      title: document.title,
      readyState: document.readyState
    });
  }, 2000);

})();
