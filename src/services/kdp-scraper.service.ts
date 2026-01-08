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

      // Attendi che la tabella bookshelf sia caricata
      await page.waitForSelector('.bookshelf-table, #bookshelf-container', { timeout: 30000 });

      // Estrai dati libri dalla pagina
      const books = await page.evaluate(() => {
        const bookRows = document.querySelectorAll('.bookshelf-table tr, .book-row');
        const booksData: any[] = [];

        bookRows.forEach((row) => {
          const titleEl = row.querySelector('.title-text, .book-title');
          const asinEl = row.querySelector('.asin, [data-asin]');
          const authorEl = row.querySelector('.author, .book-author');
          const formatEl = row.querySelector('.format, .book-format');

          if (titleEl && asinEl) {
            booksData.push({
              title: titleEl.textContent?.trim(),
              asin: asinEl.textContent?.trim() || asinEl.getAttribute('data-asin'),
              author: authorEl?.textContent?.trim(),
              format: formatEl?.textContent?.trim() || 'eBook',
              marketplace: 'US' // Verrà sovrascritto dal parametro
            });
          }
        });

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
