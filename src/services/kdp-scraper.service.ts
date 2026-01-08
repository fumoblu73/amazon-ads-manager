import puppeteer, { Browser, Page } from 'puppeteer';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { KdpBook } from '../models/KdpBook';
import { KdpDailyStats } from '../models/KdpDailyStats';
import { KdpSyncLog } from '../models/KdpSyncLog';
import { decryptCookies, Cookie, cookiesToHeaderString } from '../utils/encryption';

export class KdpScraperService {
  private browser: Browser | null = null;

  /**
   * Inizializza il browser Puppeteer
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
        '--disable-gpu'
      ]
    });

    return this.browser;
  }

  /**
   * Chiude il browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Sincronizza dati KDP per un utente
   */
  async syncUserData(userId: string): Promise<{ books: number; stats: number }> {
    const userRepository = AppDataSource.getRepository(User);
    const syncLogRepository = AppDataSource.getRepository(KdpSyncLog);

    // Crea sync log
    const syncLog = syncLogRepository.create({
      userId,
      syncType: 'books',
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

      // Decripta cookie
      const cookiesJson = decryptCookies(user.kdpCookiesEncrypted);
      const cookies: Cookie[] = JSON.parse(cookiesJson);

      console.log(`🔄 Starting KDP sync for user ${userId} on ${user.kdpMarketplace || 'US'} marketplace`);

      // Inizializza browser
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      // Imposta cookie nel browser
      await this.setCookies(page, cookies);

      // Scrape bookshelf
      const books = await this.scrapeBookshelf(page, user.kdpMarketplace || 'US');

      // Salva libri nel database
      const booksCount = await this.saveBooks(userId, books);

      // Scrape sales report (ultimi 30 giorni)
      const stats = await this.scrapeSalesReport(page, 30);

      // Salva statistiche
      const statsCount = await this.saveStats(userId, stats);

      // Chiudi browser
      await page.close();

      // Aggiorna sync log
      syncLog.status = 'completed';
      syncLog.completedAt = new Date();
      syncLog.recordsProcessed = booksCount + statsCount;
      syncLog.recordsCreated = booksCount;
      await syncLogRepository.save(syncLog);

      // Aggiorna last sync timestamp
      await userRepository.update(userId, {
        kdpLastSyncAt: new Date()
      });

      console.log(`✅ KDP sync completed: ${booksCount} books, ${statsCount} stats`);

      return { books: booksCount, stats: statsCount };
    } catch (error: any) {
      console.error('KDP sync error:', error);

      // Aggiorna sync log con errore
      syncLog.status = 'failed';
      syncLog.completedAt = new Date();
      syncLog.errorMessage = error.message;
      await syncLogRepository.save(syncLog);

      throw error;
    }
  }

  /**
   * Imposta cookie in Puppeteer page
   */
  private async setCookies(page: Page, cookies: Cookie[]): Promise<void> {
    for (const cookie of cookies) {
      await page.setCookie({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure
      });
    }
  }

  /**
   * Scrape bookshelf da KDP
   */
  private async scrapeBookshelf(page: Page, marketplace: string): Promise<any[]> {
    try {
      // Map marketplace code to correct KDP locale
      const marketplaceLocaleMap: Record<string, string> = {
        'US': 'en_US',
        'UK': 'en_GB',
        'DE': 'de_DE',
        'FR': 'fr_FR',
        'ES': 'es_ES',
        'IT': 'it_IT',
        'JP': 'ja_JP',
        'CA': 'en_CA',
        'AU': 'en_AU',
        'IN': 'en_IN',
        'BR': 'pt_BR',
        'MX': 'es_MX'
      };

      const locale = marketplaceLocaleMap[marketplace.toUpperCase()] || 'en_US';
      const kdpUrl = `https://kdp.amazon.com/${locale}/bookshelf`;

      console.log(`📚 Navigating to ${kdpUrl} (marketplace: ${marketplace})`);

      await page.goto(kdpUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Take screenshot for debugging
      const screenshotPath = `/tmp/kdp-bookshelf-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      // Log page HTML for debugging selectors
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      console.log(`📄 Page HTML (first 2000 chars):\n${bodyHTML.substring(0, 2000)}`);

      // Check what's actually on the page
      const pageTitle = await page.title();
      console.log(`📑 Page title: ${pageTitle}`);

      // Wait extra time for SPA to load content
      console.log('⏳ Waiting 5 seconds for SPA content to load...');
      await page.waitForTimeout(5000);

      // Try to find any table or container
      const hasElements = await page.evaluate(() => {
        // Get all tables and their info
        const tables = Array.from(document.querySelectorAll('table'));
        const tableInfo = tables.slice(0, 5).map((table, i) => ({
          index: i,
          id: table.id || 'no-id',
          className: table.className || 'no-class',
          rows: table.querySelectorAll('tr').length,
          firstCellText: table.querySelector('td, th')?.textContent?.substring(0, 50) || 'empty'
        }));

        return {
          tables: tables.length,
          divs: document.querySelectorAll('div').length,
          mainContent: document.querySelector('main')?.className || 'no-main',
          bodyClass: document.body.className || 'no-body-class',
          tableInfo: tableInfo
        };
      });
      console.log(`🔍 Page elements:`, JSON.stringify(hasElements, null, 2));

      // Try to find bookshelf without strict selector - just get all tables
      console.log('📋 Attempting to scrape from any available table...');

      // Estrai dati libri dalla pagina - prova con selettori multipli
      const books = await page.evaluate(() => {
        const booksData: any[] = [];

        // Try multiple possible selectors for book rows
        const possibleSelectors = [
          'table tr',  // Any table row
          '[data-book-id]', // Books with data attribute
          '.book-row',
          '.bookshelf-table tr',
          'tr[data-asin]',
          '[class*="book"]',
          '[id*="book"]'
        ];

        for (const selector of possibleSelectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Trying selector "${selector}": found ${elements.length} elements`);

          if (elements.length > 0 && elements.length < 100) { // Reasonable number
            elements.forEach((el: any) => {
              // Look for text that might be a title
              const text = el.textContent?.trim() || '';
              const hasAsin = el.getAttribute('data-asin') ||
                            el.querySelector('[data-asin]')?.getAttribute('data-asin');

              // Only add if it looks like a book (has some text and maybe an ASIN)
              if (text.length > 10 && text.length < 200) {
                booksData.push({
                  title: text.substring(0, 100),
                  asin: hasAsin || 'unknown',
                  found_with: selector,
                  element_html: el.outerHTML?.substring(0, 200)
                });
              }
            });

            if (booksData.length > 0) break; // Found books, stop trying
          }
        }

        return booksData;
      });

      console.log(`✅ Found ${books.length} books in bookshelf`);

      return books.map(book => ({ ...book, marketplace }));
    } catch (error) {
      console.error('Bookshelf scraping error:', error);
      return [];
    }
  }

  /**
   * Scrape sales report da KDP
   */
  private async scrapeSalesReport(page: Page, days: number): Promise<any[]> {
    try {
      console.log(`📊 Scraping sales report for last ${days} days`);

      await page.goto('https://kdp.amazon.com/en_US/reports', { waitUntil: 'networkidle2' });

      // Take screenshot for debugging
      const screenshotPath = `/tmp/kdp-reports-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      // Attendi caricamento report
      await page.waitForSelector('#sales-dashboard, .report-container', { timeout: 30000 });

      // Estrai dati di vendita
      const salesData = await page.evaluate(() => {
        const rows = document.querySelectorAll('.report-row, tr[data-date]');
        const stats: any[] = [];

        rows.forEach((row) => {
          const dateEl = row.querySelector('.date, [data-date]');
          const royaltyEl = row.querySelector('.royalty, .earnings');
          const unitsEl = row.querySelector('.units, .sales');

          if (dateEl) {
            stats.push({
              date: dateEl.textContent?.trim() || dateEl.getAttribute('data-date'),
              grossRoyalties: parseFloat(royaltyEl?.textContent?.replace(/[^0-9.]/g, '') || '0'),
              paidUnits: parseInt(unitsEl?.textContent?.replace(/[^0-9]/g, '') || '0')
            });
          }
        });

        return stats;
      });

      console.log(`✅ Found ${salesData.length} sales records`);

      return salesData;
    } catch (error) {
      console.error('Sales report scraping error:', error);
      return [];
    }
  }

  /**
   * Salva libri nel database
   */
  private async saveBooks(userId: string, books: any[]): Promise<number> {
    const bookRepository = AppDataSource.getRepository(KdpBook);
    let saved = 0;

    for (const bookData of books) {
      try {
        const existingBook = await bookRepository.findOne({
          where: { userId, asin: bookData.asin }
        });

        if (existingBook) {
          Object.assign(existingBook, {
            title: bookData.title,
            author: bookData.author,
            format: bookData.format,
            lastSyncDate: new Date()
          });
          await bookRepository.save(existingBook);
        } else {
          const newBook = bookRepository.create({
            userId,
            ...bookData,
            lastSyncDate: new Date()
          });
          await bookRepository.save(newBook);
          saved++;
        }
      } catch (error) {
        console.error(`Error saving book ${bookData.asin}:`, error);
      }
    }

    return saved;
  }

  /**
   * Salva statistiche nel database
   */
  private async saveStats(userId: string, stats: any[]): Promise<number> {
    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    let saved = 0;

    for (const statData of stats) {
      try {
        // Implementa logica di salvataggio stats
        // (necessita entity KdpDailyStats con userId)
        saved++;
      } catch (error) {
        console.error(`Error saving stat for ${statData.date}:`, error);
      }
    }

    return saved;
  }
}

// Esporta istanza singleton
export const kdpScraperService = new KdpScraperService();
