import puppeteer, { Browser, Page, HTTPResponse } from 'puppeteer';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { KdpDailyStats } from '../models/KdpDailyStats';
import { KdpBook } from '../entities/KdpBook';
import { KdpSyncLog } from '../models/KdpSyncLog';
import { decryptCookies, Cookie } from '../utils/encryption';
import * as csv from 'csv-parse/sync';

/**
 * Servizio per scraping dati da KDP Reports Beta (kdpreports.amazon.com)
 * Supporta Sales Dashboard, Payments & Royalties, e CSV downloads
 */
export class KdpReportsScraperService {
  private browser: Browser | null = null;
  private interceptedApiData: Map<string, any> = new Map();

  /**
   * Inizializza browser Puppeteer
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        // Memory optimization for Render Free tier (512MB limit)
        '--single-process',                    // Run in single process (saves ~100MB)
        '--disable-extensions',                 // Don't load extensions
        '--disable-background-networking',      // Disable background network requests
        '--disable-default-apps',               // Don't load default apps
        '--disable-sync',                       // Disable sync
        '--disable-translate',                  // Disable translate
        '--hide-scrollbars',                    // Hide scrollbars
        '--mute-audio',                         // Mute audio
        '--disable-plugins',                    // Disable plugins
        '--disable-webgl',                      // Disable WebGL
        '--disable-threaded-animation',         // Disable threaded animation
        '--disable-threaded-scrolling',         // Disable threaded scrolling
        '--disable-web-security',               // Disable web security (for scraping)
        '--disable-site-isolation-trials',      // Disable site isolation
        '--disable-blink-features=AutomationControlled'  // Anti-detection
      ]
    });

    return this.browser;
  }

  /**
   * Chiude browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Sincronizza dati vendite e royalties per utente
   */
  async syncSalesAndRoyalties(userId: string, importAllHistory = false): Promise<{
    salesRecords: number;
    royaltiesRecords: number;
    historicalMonths: number;
  }> {
    const userRepository = AppDataSource.getRepository(User);
    const syncLogRepository = AppDataSource.getRepository(KdpSyncLog);

    // Crea sync log
    const syncLog = syncLogRepository.create({
      userId,
      syncType: 'daily_stats',
      status: 'in_progress',
      startedAt: new Date()
    });
    await syncLogRepository.save(syncLog);

    try {
      // Recupera utente e cookie
      const user = await userRepository.findOne({ where: { id: userId } });

      if (!user || !user.kdpCookiesEncrypted) {
        throw new Error('KDP cookies not found for user');
      }

      if (!user.kdpSyncEnabled) {
        throw new Error('KDP sync is disabled for user');
      }

      // Decripta cookie KDP standard (.amazon.com)
      const cookiesJson = decryptCookies(user.kdpCookiesEncrypted);
      const cookies: Cookie[] = JSON.parse(cookiesJson);

      // Decripta cookie kdpreports (specifici per kdpreports.amazon.com)
      let reportsCookies: Cookie[] = [];
      if (user.kdpReportsCookiesEncrypted) {
        const reportsCookiesJson = decryptCookies(user.kdpReportsCookiesEncrypted);
        reportsCookies = JSON.parse(reportsCookiesJson);
        console.log(`📊 Found ${reportsCookies.length} kdpreports-specific cookies`);
      } else {
        console.log(`⚠️ No kdpreports cookies found - may require user to visit kdpreports.amazon.com`);
      }

      console.log(`🔄 Starting KDP Reports sync for user ${userId}`);
      console.log(`🍪 Total cookies: ${cookies.length} (KDP) + ${reportsCookies.length} (Reports)`);

      const marketplace = user.kdpMarketplace || 'US';

      // Inizializza browser
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      // Setup combined interception (API + memory optimization)
      await this.setupApiInterception(page);

      // Imposta cookie (sia KDP che kdpreports)
      await this.setCookies(page, cookies, reportsCookies);

      // Scrape Sales Dashboard (ultimi 90 giorni)
      console.log('📊 Scraping Sales Dashboard...');
      const salesData = await this.scrapeSalesDashboard(page, marketplace, 90);

      // Scrape Payments & Royalties
      console.log('💰 Scraping Payments & Royalties...');
      const royaltiesData = await this.scrapePaymentsAndRoyalties(page, marketplace);

      // Merge sales + royalties data
      const mergedData = this.mergeSalesAndRoyalties(salesData, royaltiesData);

      // Salva nel database
      const savedRecords = await this.saveDailyStats(userId, mergedData);

      let historicalMonths = 0;

      // Import historical data if requested
      if (importAllHistory) {
        console.log('📅 Importing historical data from CSV reports...');
        historicalMonths = await this.importHistoricalDataFromCSV(page, userId, marketplace);
      }

      // Chiudi browser
      await page.close();

      // Aggiorna sync log
      syncLog.status = 'completed';
      syncLog.completedAt = new Date();
      syncLog.recordsProcessed = savedRecords;
      syncLog.recordsCreated = savedRecords;
      await syncLogRepository.save(syncLog);

      // Aggiorna last sync timestamp
      await userRepository.update(userId, {
        kdpLastSyncAt: new Date()
      });

      console.log(`✅ KDP Reports sync completed: ${savedRecords} records saved`);
      if (historicalMonths > 0) {
        console.log(`📅 Imported ${historicalMonths} months of historical data`);
      }

      return {
        salesRecords: salesData.length,
        royaltiesRecords: royaltiesData.length,
        historicalMonths
      };
    } catch (error: any) {
      console.error('KDP Reports sync error:', error);

      // Aggiorna sync log con errore
      syncLog.status = 'failed';
      syncLog.completedAt = new Date();
      syncLog.errorMessage = error.message;
      await syncLogRepository.save(syncLog);

      throw error;
    }
  }

  /**
   * Setup API request interception per catturare chiamate XHR/Fetch
   */
  private async setupApiInterception(page: Page): Promise<void> {
    this.interceptedApiData.clear();

    // Enable request interception
    await page.setRequestInterception(true);

    page.on('request', (request) => {
      // Memory optimization: Block unnecessary resources
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
        request.abort();
        return;
      }

      // Log API calls to kdpreports
      const url = request.url();
      if (url.includes('kdpreports.amazon.com') && (url.includes('/api/') || url.includes('graphql'))) {
        console.log(`🌐 API Request: ${request.method()} ${url}`);
      }
      request.continue();
    });

    page.on('response', async (response: HTTPResponse) => {
      const url = response.url();

      // Capture JSON responses from KDP Reports API
      if (url.includes('kdpreports.amazon.com') && response.status() === 200) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();

            // DIAGNOSTIC: log ALL JSON responses to discover real endpoint names
            const dataKeys = Array.isArray(data) ? `[array:${data.length}]` : Object.keys(data).slice(0, 8).join(',');
            console.log(`📡 KDP JSON response: ${url} → keys: ${dataKeys}`);

            // Store by endpoint type
            if (url.includes('orders') || url.includes('sales')) {
              this.interceptedApiData.set('sales', data);
              console.log('✅ Intercepted Sales API data');
            } else if (url.includes('royalties') || url.includes('payments')) {
              this.interceptedApiData.set('royalties', data);
              console.log('✅ Intercepted Royalties API data');
            }
          }
        } catch (error) {
          // Non-JSON response, ignore
        }
      }
    });
  }

  /**
   * Imposta cookie nel browser (metodo Publisher Champ)
   * @param page - Puppeteer page
   * @param amazonCookies - Cookie da .amazon.com (per autenticazione base)
   * @param reportsCookies - Cookie specifici da kdpreports.amazon.com (opzionali)
   */
  private async setCookies(page: Page, amazonCookies: Cookie[], reportsCookies: Cookie[] = []): Promise<void> {
    const kdpReportsUrl = 'https://kdpreports.amazon.com';

    console.log(`🌐 Navigating to ${kdpReportsUrl} to set cookies...`);
    try {
      await page.goto(kdpReportsUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch (error) {
      console.log('⚠️ Initial navigation failed, continuing...');
    }

    // ========================================================
    // IMPOSTA COOKIE COME PUBLISHER CHAMP
    // Mantieni il dominio originale di ogni cookie
    // ========================================================

    // Prima imposta i cookie Amazon (con il loro dominio originale)
    console.log(`🍪 Setting ${amazonCookies.length} Amazon cookies...`);
    let amazonSet = 0;
    for (const cookie of amazonCookies) {
      try {
        // Usa il dominio originale del cookie, o .amazon.com come fallback
        let domain = cookie.domain || '.amazon.com';
        // Assicurati che il dominio inizi con punto per essere valido per tutti i subdomain
        if (!domain.startsWith('.') && !domain.includes('kdpreports')) {
          domain = '.' + domain;
        }

        await page.setCookie({
          name: cookie.name,
          value: cookie.value,
          domain: domain,
          path: cookie.path || '/',
          expires: cookie.expires,
          httpOnly: cookie.httpOnly ?? false,
          secure: cookie.secure ?? true
        });
        amazonSet++;
      } catch (error: any) {
        // Ignora errori sui singoli cookie
      }
    }
    console.log(`✅ Set ${amazonSet}/${amazonCookies.length} Amazon cookies`);

    // Poi imposta i cookie specifici di kdpreports
    if (reportsCookies.length > 0) {
      console.log(`📊 Setting ${reportsCookies.length} kdpreports cookies...`);
      let reportsSet = 0;

      for (const cookie of reportsCookies) {
        try {
          // Usa il dominio originale - importante per kdpreports!
          let domain = cookie.domain || 'kdpreports.amazon.com';

          // I cookie kdpreports possono avere diversi domini:
          // - .kdpreports.amazon.com
          // - kdpreports.amazon.com
          // - .amazon.com (condivisi)
          // Mantieni il dominio originale

          await page.setCookie({
            name: cookie.name,
            value: cookie.value,
            domain: domain,
            path: cookie.path || '/',
            expires: cookie.expires,
            httpOnly: cookie.httpOnly ?? false,
            secure: cookie.secure ?? true
          });
          reportsSet++;
        } catch (error: any) {
          console.log(`⚠️ Failed to set cookie ${cookie.name}: ${error.message}`);
        }
      }
      console.log(`✅ Set ${reportsSet}/${reportsCookies.length} kdpreports cookies`);
    } else {
      console.log(`⚠️ No kdpreports-specific cookies to set - authentication may fail!`);
    }

    // Log dei cookie impostati per debug
    const browserCookies = await page.cookies();
    console.log(`🍪 Browser now has ${browserCookies.length} total cookies`);

    // Verifica cookie chiave
    const keyCookies = ['session-id', 'ubid-main', 'x-main', 'at-main', 'sess-at-main'];
    const foundKeyCookies = browserCookies.filter(c => keyCookies.includes(c.name));
    console.log(`🔑 Key auth cookies found: ${foundKeyCookies.map(c => c.name).join(', ')}`);
  }

  /**
   * Scrape Sales Dashboard (Orders page)
   */
  private async scrapeSalesDashboard(
    page: Page,
    marketplace: string,
    days: number = 90
  ): Promise<Array<{
    date: string;
    asin: string;
    title: string;
    marketplace: string;
    paidUnits: number;
    freeUnits: number;
    kenpReads: number;
  }>> {
    try {
      const url = 'https://kdpreports.amazon.com/#/orders';
      console.log(`📊 Navigating to Sales Dashboard: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Check authentication
      const currentUrl = page.url();
      const pageTitle = await page.title();

      console.log(`📍 Current URL: ${currentUrl}`);
      console.log(`📄 Page title: ${pageTitle}`);

      if (currentUrl.includes('signin') || currentUrl.includes('login') ||
          pageTitle.toLowerCase().includes('sign in') || pageTitle.toLowerCase().includes('sign-in')) {
        // Log page content for debugging
        const pageInfo = await page.evaluate(() => ({
          title: document.title,
          h1: document.querySelector('h1')?.textContent || '',
          forms: document.querySelectorAll('form').length
        }));
        console.log(`❌ Auth failed - Page info:`, JSON.stringify(pageInfo));
        throw new Error(`Authentication failed - redirected to login (${pageTitle})`);
      }

      console.log('✅ Successfully authenticated to KDP Reports');

      // Wait for React SPA to load
      console.log('⏳ Waiting for page content to load...');
      await page.waitForTimeout(8000);

      // Take screenshot for debugging
      await page.screenshot({ path: `/tmp/kdp-sales-${Date.now()}.png`, fullPage: true });

      // Check if we intercepted API data
      if (this.interceptedApiData.has('sales')) {
        console.log('✅ Using intercepted API data for sales');
        const apiData = this.interceptedApiData.get('sales');
        return this.parseSalesApiData(apiData, marketplace);
      }

      // Fallback: HTML scraping
      console.log('⚠️ No API data intercepted, trying HTML scraping...');
      return await this.scrapeSalesFromHTML(page, marketplace);

    } catch (error: any) {
      console.error('Sales Dashboard scraping error:', error.message);
      return [];
    }
  }

  /**
   * Parse API data per Sales Dashboard
   */
  private parseSalesApiData(apiData: any, marketplace: string): Array<any> {
    const results: Array<any> = [];

    try {
      // Struttura API potrebbe variare, gestisci diverse possibilità
      const orders = apiData.orders || apiData.data?.orders || apiData.results || [];

      orders.forEach((order: any) => {
        results.push({
          date: order.date || order.orderDate || new Date().toISOString().split('T')[0],
          asin: order.asin || order.productAsin || '',
          title: order.title || order.productTitle || '',
          marketplace: marketplace,
          paidUnits: parseInt(order.paidUnits || order.unitsSold || 0),
          freeUnits: parseInt(order.freeUnits || order.unitsFree || 0),
          kenpReads: parseInt(order.kenpPages || order.kenpReads || 0)
        });
      });

      console.log(`✅ Parsed ${results.length} sales records from API`);
    } catch (error: any) {
      console.error('Error parsing sales API data:', error.message);
    }

    return results;
  }

  /**
   * Scrape sales da HTML (fallback)
   */
  private async scrapeSalesFromHTML(page: Page, marketplace: string): Promise<Array<any>> {
    const salesData = await page.evaluate((mp: string) => {
      const results: Array<any> = [];

      // Try to find table with sales data
      const tables = document.querySelectorAll('table');

      tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4) {
            const date = cells[0]?.textContent?.trim() || '';
            const asin = cells[1]?.textContent?.trim() || '';
            const title = cells[2]?.textContent?.trim() || '';
            const units = cells[3]?.textContent?.trim() || '0';

            if (date && asin) {
              results.push({
                date,
                asin,
                title,
                marketplace: mp,
                paidUnits: parseInt(units) || 0,
                freeUnits: 0,
                kenpReads: 0
              });
            }
          }
        });
      });

      return results;
    }, marketplace);

    console.log(`✅ Scraped ${salesData.length} sales records from HTML`);
    return salesData;
  }

  /**
   * Scrape Payments & Royalties page
   */
  private async scrapePaymentsAndRoyalties(
    page: Page,
    marketplace: string
  ): Promise<Array<{
    date: string;
    asin: string;
    marketplace: string;
    grossRoyalties: number;
    spending: number;
    netRoyalties: number;
  }>> {
    try {
      const url = 'https://kdpreports.amazon.com/#/royalties';
      console.log(`💰 Navigating to Payments & Royalties: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for React SPA to load
      await page.waitForTimeout(8000);

      // Take screenshot
      await page.screenshot({ path: `/tmp/kdp-royalties-${Date.now()}.png`, fullPage: true });

      // Check if we intercepted API data
      if (this.interceptedApiData.has('royalties')) {
        console.log('✅ Using intercepted API data for royalties');
        const apiData = this.interceptedApiData.get('royalties');
        return this.parseRoyaltiesApiData(apiData, marketplace);
      }

      // Fallback: HTML scraping
      console.log('⚠️ No API data intercepted, trying HTML scraping...');
      return await this.scrapeRoyaltiesFromHTML(page, marketplace);

    } catch (error: any) {
      console.error('Royalties scraping error:', error.message);
      return [];
    }
  }

  /**
   * Parse API data per Royalties
   */
  private parseRoyaltiesApiData(apiData: any, marketplace: string): Array<any> {
    const results: Array<any> = [];

    try {
      const royalties = apiData.royalties || apiData.data?.royalties || apiData.results || [];

      royalties.forEach((item: any) => {
        results.push({
          date: item.date || item.transactionDate || new Date().toISOString().split('T')[0],
          asin: item.asin || '',
          marketplace: marketplace,
          grossRoyalties: parseFloat(item.grossRoyalties || item.royalty || 0),
          spending: parseFloat(item.adSpend || item.spending || 0),
          netRoyalties: parseFloat(item.netRoyalties || item.netRoyalty || 0)
        });
      });

      console.log(`✅ Parsed ${results.length} royalty records from API`);
    } catch (error: any) {
      console.error('Error parsing royalties API data:', error.message);
    }

    return results;
  }

  /**
   * Scrape royalties da HTML (fallback)
   */
  private async scrapeRoyaltiesFromHTML(page: Page, marketplace: string): Promise<Array<any>> {
    const royaltiesData = await page.evaluate((mp: string) => {
      const results: Array<any> = [];

      const tables = document.querySelectorAll('table');

      tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4) {
            const date = cells[0]?.textContent?.trim() || '';
            const asin = cells[1]?.textContent?.trim() || '';
            const royalty = cells[2]?.textContent?.trim().replace(/[^0-9.-]/g, '') || '0';
            const adSpend = cells[3]?.textContent?.trim().replace(/[^0-9.-]/g, '') || '0';

            if (date && asin) {
              const grossRoy = parseFloat(royalty) || 0;
              const spend = parseFloat(adSpend) || 0;

              results.push({
                date,
                asin,
                marketplace: mp,
                grossRoyalties: grossRoy,
                spending: spend,
                netRoyalties: grossRoy - spend
              });
            }
          }
        });
      });

      return results;
    }, marketplace);

    console.log(`✅ Scraped ${royaltiesData.length} royalty records from HTML`);
    return royaltiesData;
  }

  /**
   * Merge sales data e royalties data per giorno/ASIN
   */
  private mergeSalesAndRoyalties(
    salesData: Array<any>,
    royaltiesData: Array<any>
  ): Array<any> {
    const merged = new Map<string, any>();

    // Add sales data
    salesData.forEach(sale => {
      const key = `${sale.date}-${sale.asin}`;
      merged.set(key, {
        date: sale.date,
        asin: sale.asin,
        marketplace: sale.marketplace,
        paidUnits: sale.paidUnits,
        freeUnits: sale.freeUnits,
        kenpReads: sale.kenpReads,
        grossRoyalties: 0,
        spending: 0,
        netRoyalties: 0
      });
    });

    // Merge royalties data
    royaltiesData.forEach(royalty => {
      const key = `${royalty.date}-${royalty.asin}`;
      const existing = merged.get(key);

      if (existing) {
        existing.grossRoyalties = royalty.grossRoyalties;
        existing.spending = royalty.spending;
        existing.netRoyalties = royalty.netRoyalties;
      } else {
        merged.set(key, {
          date: royalty.date,
          asin: royalty.asin,
          marketplace: royalty.marketplace,
          paidUnits: 0,
          freeUnits: 0,
          kenpReads: 0,
          grossRoyalties: royalty.grossRoyalties,
          spending: royalty.spending,
          netRoyalties: royalty.netRoyalties
        });
      }
    });

    const results = Array.from(merged.values());
    console.log(`✅ Merged ${results.length} total records`);
    return results;
  }

  /**
   * Salva daily stats nel database
   */
  private async saveDailyStats(userId: string, data: Array<any>): Promise<number> {
    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    let saved = 0;

    for (const record of data) {
      try {
        // Check if record already exists (by userId, date, and asin)
        const existing = await statsRepository.findOne({
          where: {
            userId: userId,
            date: record.date,
            asin: record.asin
          }
        });

        if (existing) {
          // Update existing record
          Object.assign(existing, {
            paidUnits: record.paidUnits,
            freeUnits: record.freeUnits,
            kenpReads: record.kenpReads,
            grossRoyalties: record.grossRoyalties,
            spending: record.spending,
            netRoyalties: record.netRoyalties,
            marketplace: record.marketplace
          });
          await statsRepository.save(existing);
        } else {
          // Create new record
          const newStat = statsRepository.create({
            userId: userId,
            date: record.date,
            asin: record.asin,
            paidUnits: record.paidUnits,
            freeUnits: record.freeUnits,
            kenpReads: record.kenpReads,
            grossRoyalties: record.grossRoyalties,
            spending: record.spending,
            netRoyalties: record.netRoyalties,
            marketplace: record.marketplace
          });
          await statsRepository.save(newStat);
        }

        saved++;
      } catch (error: any) {
        console.error(`Error saving stat for ${record.date}-${record.asin}:`, error.message);
      }
    }

    console.log(`✅ Saved ${saved} daily stats records`);
    return saved;
  }

  /**
   * Import dati storici da CSV "Prior Month's Royalties"
   */
  private async importHistoricalDataFromCSV(
    page: Page,
    userId: string,
    marketplace: string
  ): Promise<number> {
    try {
      console.log('📅 Starting historical data import from CSV...');

      // Navigate to reports download page
      const url = 'https://kdpreports.amazon.com/#/reports';
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForTimeout(5000);

      // Find all available monthly CSV reports
      const csvLinks = await page.evaluate(() => {
        const links: Array<{ href: string; month: string }> = [];
        const anchors = document.querySelectorAll('a[href*=".csv"]');

        anchors.forEach(anchor => {
          const href = (anchor as HTMLAnchorElement).href;
          const text = anchor.textContent?.trim() || '';

          // Look for "Prior Month's Royalties" or similar
          if (text.includes('Royalties') || text.includes('Month')) {
            links.push({ href, month: text });
          }
        });

        return links;
      });

      console.log(`📋 Found ${csvLinks.length} CSV reports to download`);

      let monthsImported = 0;

      // Download and process each CSV
      for (const link of csvLinks.slice(0, 12)) { // Limit to last 12 months
        try {
          console.log(`📥 Downloading CSV: ${link.month}`);

          // Download CSV
          const csvContent = await this.downloadCSV(page, link.href);

          // Parse CSV
          const records = this.parseRoyaltiesCSV(csvContent, marketplace);

          // Save to database
          const saved = await this.saveDailyStats(userId, records);

          if (saved > 0) {
            monthsImported++;
          }

          console.log(`✅ Imported ${saved} records from ${link.month}`);

          // Wait between downloads
          await page.waitForTimeout(2000);
        } catch (error: any) {
          console.error(`Error importing ${link.month}:`, error.message);
        }
      }

      return monthsImported;
    } catch (error: any) {
      console.error('Historical import error:', error.message);
      return 0;
    }
  }

  /**
   * Download CSV file
   */
  private async downloadCSV(page: Page, url: string): Promise<string> {
    const response = await page.goto(url, { waitUntil: 'networkidle2' });
    if (!response) {
      throw new Error('Failed to download CSV');
    }
    return await response.text();
  }

  /**
   * Parse CSV "Prior Month's Royalties"
   */
  private parseRoyaltiesCSV(csvContent: string, marketplace: string): Array<any> {
    const results: Array<any> = [];

    try {
      const records = csv.parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      records.forEach((row: any) => {
        // CSV columns may vary, handle common variations
        const date = row['Transaction Date'] || row['Date'] || row['date'];
        const asin = row['ASIN'] || row['asin'];
        const royalty = row['Royalty'] || row['Gross Royalty'] || row['royalty'] || '0';
        const adSpend = row['Ad Spend'] || row['Advertising Cost'] || row['ad_spend'] || '0';

        if (date && asin) {
          const grossRoy = parseFloat(royalty.replace(/[^0-9.-]/g, '')) || 0;
          const spend = parseFloat(adSpend.replace(/[^0-9.-]/g, '')) || 0;

          results.push({
            date,
            asin,
            marketplace,
            paidUnits: 0, // CSV may not have unit data
            freeUnits: 0,
            kenpReads: 0,
            grossRoyalties: grossRoy,
            spending: spend,
            netRoyalties: grossRoy - spend
          });
        }
      });

      console.log(`✅ Parsed ${results.length} records from CSV`);
    } catch (error: any) {
      console.error('CSV parsing error:', error.message);
    }

    return results;
  }
}

// Export singleton
export const kdpReportsScraperService = new KdpReportsScraperService();
