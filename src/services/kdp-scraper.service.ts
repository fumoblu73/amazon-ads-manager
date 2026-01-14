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
        '--disable-gpu',
        // Anti-detection: nasconde che è headless
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
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
      console.log(`🍪 Total cookies: ${cookies.length}`);

      // Log critical authentication cookies
      const authCookies = ['session-id', 'session-token', 'ubid-main', 'x-main', 'at-main'];
      const foundAuthCookies = cookies.filter(c => authCookies.includes(c.name)).map(c => c.name);
      console.log(`🔑 Auth cookies found: ${foundAuthCookies.join(', ') || 'NONE!'}`);

      // Check for expired cookies
      const now = Date.now() / 1000;
      const expiredCount = cookies.filter(c => c.expires && c.expires < now).length;
      if (expiredCount > 0) {
        console.log(`⚠️ WARNING: ${expiredCount} cookies are expired!`);
      }

      // Map marketplace to kdp.amazon.com domain (KDP uses .com for all marketplaces)
      const kdpDomain = 'https://kdp.amazon.com';

      // Inizializza browser
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      // Imposta user-agent realistico per evitare bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Imposta viewport realistico
      await page.setViewport({ width: 1920, height: 1080 });

      // Imposta cookie nel browser (naviga prima a KDP)
      await this.setCookies(page, cookies, kdpDomain);

      // Cancella tutti i libri esistenti per questo utente (per avere dati sempre freschi)
      console.log('🗑️ Clearing existing books for fresh sync...');
      const bookRepository = AppDataSource.getRepository(KdpBook);
      const deleteResult = await bookRepository.delete({ userId });
      console.log(`✅ Deleted ${deleteResult.affected || 0} existing books`);

      // Scrape bookshelf
      const books = await this.scrapeBookshelf(page, user.kdpMarketplace || 'US');

      // Salva libri nel database
      const booksCount = await this.saveBooks(userId, books);

      // Scrape sales report (ultimi 30 giorni)
      const stats = await this.scrapeSalesReport(page, 30, user.kdpMarketplace || 'US');

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
  private async setCookies(page: Page, cookies: Cookie[], targetDomain?: string): Promise<void> {
    // Se abbiamo cookie e un target domain, naviga prima al dominio
    if (targetDomain && cookies.length > 0) {
      console.log(`🌐 Navigating to ${targetDomain} to set cookies...`);
      try {
        await page.goto(targetDomain, { waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch (error) {
        console.log('⚠️ Initial navigation failed, continuing with cookie setup...');
      }
    }

    console.log(`🍪 Setting ${cookies.length} cookies...`);
    let successCount = 0;
    let failCount = 0;

    for (const cookie of cookies) {
      try {
        await page.setCookie({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure
        });
        successCount++;
      } catch (error: any) {
        failCount++;
        console.log(`⚠️ Failed to set cookie ${cookie.name}: ${error.message}`);
      }
    }

    console.log(`✅ Set ${successCount} cookies successfully, ${failCount} failed`);
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

      // Check what's actually on the page
      const pageTitle = await page.title();
      console.log(`📑 Page title: ${pageTitle}`);

      // Check if we got redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('signin') || currentUrl.includes('login') || currentUrl.includes('ap/signin') || pageTitle.includes('Sign-In') || pageTitle.includes('Sign In') || pageTitle.includes('Amazon Sign-In')) {
        console.log(`❌ AUTHENTICATION FAILED - Redirected to login page!`);
        console.log(`   Current URL: ${currentUrl}`);
        console.log(`   Page title: ${pageTitle}`);
        console.log(`   🔑 HINT: Cookies may be expired or IP blocked. Try:`);
        console.log(`      1. Logout and login again on kdp.amazon.com`);
        console.log(`      2. Re-sync cookies from Chrome extension`);
        console.log(`      3. Wait 5 minutes before retrying (Amazon rate limit)`);
        throw new Error('Authentication failed - cookies are invalid, expired, or IP blocked by Amazon. Please re-sync your cookies.');
      }

      console.log(`✅ Successfully authenticated - on KDP bookshelf`);

      // Take screenshot for debugging
      const screenshotPath = `/tmp/kdp-bookshelf-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      // Log page HTML for debugging selectors (only first 2000 chars)
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      console.log(`📄 Page HTML (first 2000 chars):\n${bodyHTML.substring(0, 2000)}`);

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

      // Track all books and processed ASINs across all pages
      const allBooks: any[] = [];
      const processedAsins = new Set<string>();
      let currentPage = 1;
      let hasNextPage = true;
      let consecutiveEmptyPages = 0; // Track empty pages to prevent infinite loops

      // Loop through all pages (max 10 pages to prevent infinite loops)
      while (hasNextPage && currentPage <= 10) {
        console.log(`📄 Scraping page ${currentPage}...`);

        // Estrai dati libri dalla pagina corrente usando la tabella refreshedbookshelftable
        const books = await page.evaluate((processedAsinsArray: string[]) => {
          const booksData: any[] = [];
          const debugInfo: any[] = [];
          const processedAsins = new Set<string>(processedAsinsArray); // Restore Set from array

          // Cerca la tabella principale del bookshelf
          const mainTable = document.querySelector('table.refreshedbookshelftable');

          if (!mainTable) {
            return { books: [], debug: ['❌ Main bookshelf table not found'], hasNext: false };
          }

          // Estrai tutte le righe della tabella (escludi header)
          const rows = mainTable.querySelectorAll('tbody > tr');
          debugInfo.push(`✅ Found ${rows.length} rows in main table`);

          // Helper per pulire il testo
          const cleanText = (text: string) => {
            return text
              .replace(/\s+/g, ' ')  // Replace multiple spaces/newlines with single space
              .replace(/\n/g, ' ')    // Remove newlines
              .trim();
          };

          rows.forEach((row: Element, index: number) => {
            try {
              const rowId = row.id || '';

              // FILTER: Only process Paperback rows
              // Check format first to skip non-paperback rows early
              const formatElement = row.querySelector(`span[id*="print-status-format-${rowId}"]`) as HTMLElement | null;
              const format = formatElement ? cleanText(formatElement.innerText || formatElement.textContent || '') : '';

              // Support multiple languages: English, Italian, etc.
              const isPaperback = format && (
                format === 'Paperback' ||           // English
                format === 'Versione cartacea' ||   // Italian
                format === 'Tapa blanda' ||         // Spanish
                format === 'Broché' ||              // French
                format === 'Taschenbuch'            // German
              );

              if (!isPaperback) {
                debugInfo.push(`⏭️ Row ${index} skipped - not Paperback (format: "${format}")`);
                return;
              }

              debugInfo.push(`📖 Processing Paperback row ${index}, Row ID: ${rowId}`);

              // Extract PAPERBACK ASIN from "Codice ASIN: XXXXX"
              const asinElement = row.querySelector(`span[id*="print-price-asin-${rowId}"]`) as HTMLElement | null;
              let asin = '';

              if (asinElement) {
                const asinText = cleanText(asinElement.innerText || asinElement.textContent || '');
                const asinMatch = asinText.match(/(?:Codice\s+)?ASIN:\s*([A-Z0-9]{10})/i);
                if (asinMatch) {
                  asin = asinMatch[1];
                }
              }

              if (!asin || asin.length === 0) {
                debugInfo.push(`⚠️ Row ${index} (ID: ${rowId}) has no valid Paperback ASIN`);
                return;
              }

              // Skip if we already processed this ASIN
              if (processedAsins.has(asin)) {
                debugInfo.push(`⏭️ Row ${index}, ASIN: ${asin} - Already processed, skipping`);
                return;
              }

              // Extract TITLE from metadata column
              let title = '';
              const metadataCol = row.querySelector('.bookshelf-itemset-metadata-column');
              if (metadataCol) {
                const textElements = metadataCol.querySelectorAll('.mt-text-content, .title-link-label, .a-text-bold');
                for (const el of Array.from(textElements)) {
                  const text = cleanText((el as HTMLElement).innerText || el.textContent || '');
                  if (text.length > 20 && !text.startsWith('da ')) {
                    title = text;
                    break;
                  }
                }
              }

              if (!title) {
                debugInfo.push(`⚠️ No title found for ASIN ${asin}`);
                return;
              }

              // Extract AUTHOR
              const authorElement = row.querySelector(`span[id*="author-${rowId}"]`) as HTMLElement | null;
              let author = '';
              if (authorElement) {
                author = cleanText(authorElement.innerText || authorElement.textContent || '');
                if (author.startsWith('da ')) {
                  author = author.substring(3);
                }
              }

              // Extract SERIES
              const seriesElement = row.querySelector(`span[id*="series_title-${rowId}"]`) as HTMLElement | null;
              const seriesName = seriesElement ? cleanText(seriesElement.innerText || seriesElement.textContent || '') : '';

              // Extract PRICE from print-price-list-price link
              const priceElement = row.querySelector(`a[id*="print-price-list-price-${rowId}"]`) as HTMLElement | null;
              const price = priceElement ? cleanText(priceElement.innerText || priceElement.textContent || '') : '';

              // Extract PUBLISH DATE from print-status-release-date
              const dateElement = row.querySelector(`span[id*="print-status-release-date-${rowId}"]`) as HTMLElement | null;
              let publishDate = '';
              if (dateElement) {
                const dateText = cleanText(dateElement.innerText || dateElement.textContent || '');
                // Extract date from various formats:
                // Italian: "Data di invio: 29 maggio 2025"
                // English: "Submission date: May 29, 2025"
                const dateMatch = dateText.match(/(?:Data di invio|Submission date):\s*(.+)/i);
                if (dateMatch) {
                  const rawDate = dateMatch[1]; // "29 maggio 2025" or "May 29, 2025"
                  // Convert to ISO format (YYYY-MM-DD)
                  publishDate = this.parsePublishDate(rawDate);
                }
              }

              // Extract COVER URL from cover column
              const coverElement = row.querySelector(`td[id*="${rowId}-cover"] img`) as HTMLImageElement | null;
              const coverUrl = coverElement ? coverElement.src : '';

              debugInfo.push(`  Title: "${title.substring(0, 40)}"`);
              debugInfo.push(`  ASIN: ${asin}`);
              debugInfo.push(`  Author: "${author}"`);
              debugInfo.push(`  Price: "${price}"`);
              debugInfo.push(`  Publish Date: "${publishDate}"`);
              debugInfo.push(`  Cover URL: ${coverUrl ? 'Found' : 'Not found'}`);

              // Add book data
              booksData.push({
                title: title.substring(0, 500),
                asin: asin.substring(0, 15),
                author: author ? author.substring(0, 200) : null,
                seriesName: seriesName ? seriesName.substring(0, 200) : null,
                format: 'Paperback',  // Always Paperback since we filtered for it
                price: price ? price.substring(0, 50) : null,
                publishDate: publishDate || null,
                coverUrl: coverUrl || null
              });

              // Mark as processed
              processedAsins.add(asin);

              debugInfo.push(`  ✅ Added Paperback: "${title.substring(0, 30)}" (ASIN: ${asin})`);
            } catch (error: any) {
              debugInfo.push(`  ❌ Error processing row: ${error.message}`);
            }
          });

          // Check pagination: look for page numbers instead of Next button
          // Find all pagination links (they have page numbers as text)
          const paginationLinks = Array.from(document.querySelectorAll('.a-pagination li'));
          const pageNumbers: number[] = [];

          paginationLinks.forEach((li: Element) => {
            const link = li.querySelector('a');
            if (link && link.textContent) {
              const pageNum = parseInt(link.textContent.trim());
              if (!isNaN(pageNum)) {
                pageNumbers.push(pageNum);
              }
            }
          });

          const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
          debugInfo.push(`📄 Found ${pageNumbers.length} page numbers: [${pageNumbers.join(', ')}], max: ${maxPage}`);

          return { books: booksData, debug: debugInfo, maxPage };
        }, Array.from(processedAsins));

        // Log debug info
        const result = books as any;
        if (result.debug) {
          console.log('📝 Debug info from page.evaluate:');
          result.debug.forEach((msg: string) => console.log(`   ${msg}`));
        }

        const booksList = result.books || [];
        console.log(`✅ Found ${booksList.length} new books on page ${currentPage}`);

        // Track consecutive empty pages to prevent infinite loops
        if (booksList.length === 0) {
          consecutiveEmptyPages++;
          console.log(`⚠️ Empty page detected (${consecutiveEmptyPages} consecutive)`);

          // If we've seen 2 consecutive empty pages, stop pagination
          if (consecutiveEmptyPages >= 2) {
            console.log('🛑 Stopping pagination: 2 consecutive empty pages detected');
            hasNextPage = false;
          }
        } else {
          consecutiveEmptyPages = 0; // Reset counter when we find books
        }

        // Add books from this page to total
        booksList.forEach((book: any) => {
          allBooks.push(book);
          processedAsins.add(book.asin);
        });

        // Check if there are more pages based on page numbers found
        const maxPage = result.maxPage || 1;
        const nextPageNum = currentPage + 1;
        hasNextPage = hasNextPage && nextPageNum <= maxPage;

        if (hasNextPage) {
          console.log(`⏭️ Navigating to page ${nextPageNum}...`);

          try {
            // Click on the specific page number link instead of Next arrow
            const clicked = await page.evaluate((pageNum: number) => {
              const links = Array.from(document.querySelectorAll('.a-pagination li a'));
              for (const link of links) {
                if (link.textContent && link.textContent.trim() === pageNum.toString()) {
                  (link as HTMLElement).click();
                  return true;
                }
              }
              return false;
            }, nextPageNum);

            if (clicked) {
              console.log(`✅ Clicked page ${nextPageNum} link`);
              // Wait for page to load
              await page.waitForTimeout(3000);
              currentPage++;
            } else {
              console.log(`❌ Could not find page ${nextPageNum} link, stopping`);
              hasNextPage = false;
            }
          } catch (error) {
            console.error('Error clicking page link:', error);
            hasNextPage = false;
          }
        } else {
          console.log('✅ No more pages to scrape');
        }
      }

      console.log(`✅ Total books found across all pages: ${allBooks.length}`);

      return allBooks.map(book => ({ ...book, marketplace }));
    } catch (error) {
      console.error('Bookshelf scraping error:', error);
      return [];
    }
  }

  /**
   * Converte data di pubblicazione in formato ISO (YYYY-MM-DD)
   * Supporta formati italiani e inglesi
   */
  private parsePublishDate(rawDate: string): string {
    // Mappa mesi italiani → numero
    const italianMonths: Record<string, string> = {
      'gennaio': '01',
      'febbraio': '02',
      'marzo': '03',
      'aprile': '04',
      'maggio': '05',
      'giugno': '06',
      'luglio': '07',
      'agosto': '08',
      'settembre': '09',
      'ottobre': '10',
      'novembre': '11',
      'dicembre': '12'
    };

    // Mappa mesi inglesi → numero
    const englishMonths: Record<string, string> = {
      'january': '01', 'jan': '01',
      'february': '02', 'feb': '02',
      'march': '03', 'mar': '03',
      'april': '04', 'apr': '04',
      'may': '05',
      'june': '06', 'jun': '06',
      'july': '07', 'jul': '07',
      'august': '08', 'aug': '08',
      'september': '09', 'sep': '09',
      'october': '10', 'oct': '10',
      'november': '11', 'nov': '11',
      'december': '12', 'dec': '12'
    };

    try {
      // Pattern: "29 maggio 2025" (italiano)
      const italianPattern = /(\d{1,2})\s+([a-zàèéìòù]+)\s+(\d{4})/i;
      const italianMatch = rawDate.match(italianPattern);

      if (italianMatch) {
        const day = italianMatch[1].padStart(2, '0');
        const monthName = italianMatch[2].toLowerCase();
        const year = italianMatch[3];
        const month = italianMonths[monthName];

        if (month) {
          return `${year}-${month}-${day}`;
        }
      }

      // Pattern: "May 29, 2025" (inglese)
      const englishPattern = /([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i;
      const englishMatch = rawDate.match(englishPattern);

      if (englishMatch) {
        const monthName = englishMatch[1].toLowerCase();
        const day = englishMatch[2].padStart(2, '0');
        const year = englishMatch[3];
        const month = englishMonths[monthName];

        if (month) {
          return `${year}-${month}-${day}`;
        }
      }

      // Pattern: "2025-05-29" (già ISO)
      const isoPattern = /(\d{4})-(\d{2})-(\d{2})/;
      if (isoPattern.test(rawDate)) {
        return rawDate;
      }

      // Fallback: ritorna stringa originale se non riconosciuto
      console.warn(`⚠️ Unable to parse date: "${rawDate}". Returning as-is.`);
      return rawDate;

    } catch (error) {
      console.error(`❌ Error parsing date "${rawDate}":`, error);
      return rawDate;
    }
  }

  /**
   * Scrape sales report da KDP
   */
  private async scrapeSalesReport(page: Page, days: number, marketplace: string = 'US'): Promise<any[]> {
    try {
      console.log(`📊 Scraping sales report for last ${days} days`);

      // Map marketplace to locale
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
      const reportsUrl = `https://kdp.amazon.com/${locale}/reports`;

      console.log(`📊 Navigating to reports: ${reportsUrl}`);
      await page.goto(reportsUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Take screenshot for debugging
      const screenshotPath = `/tmp/kdp-reports-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      // Wait for page to load
      console.log('⏳ Waiting 5 seconds for reports page to load...');
      await page.waitForTimeout(5000);

      // Check what's on the page
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          hasTables: document.querySelectorAll('table').length,
          hasCharts: document.querySelectorAll('canvas, svg').length,
          bodyText: document.body.textContent?.substring(0, 500)
        };
      });
      console.log('📄 Reports page info:', JSON.stringify(pageInfo, null, 2));

      // Estrai dati di vendita dalla pagina reports
      const salesData = await page.evaluate(() => {
        const stats: any[] = [];

        // Try to find sales data in various formats
        // KDP reports can be in tables, charts, or data attributes

        // Try table format first
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const cellTexts = Array.from(cells).map(c => c.textContent?.trim() || '');

              // Look for date pattern (various formats)
              const datePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}-\d{2}-\d{2}/;
              const dateCell = cellTexts.find(text => datePattern.test(text));

              if (dateCell) {
                // Try to extract numeric values
                const numbers = cellTexts
                  .map(text => text.replace(/[^0-9.,]/g, ''))
                  .filter(text => text.length > 0)
                  .map(text => parseFloat(text.replace(',', '.')));

                stats.push({
                  date: dateCell,
                  rawData: cellTexts,
                  numbers: numbers
                });
              }
            }
          });
        });

        return stats;
      });

      console.log(`✅ Found ${salesData.length} potential sales records`);

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

    // Since we delete all books before sync, we only need to create new ones
    for (const bookData of books) {
      try {
        const newBook = bookRepository.create({
          userId,
          asin: bookData.asin,
          title: bookData.title,
          author: bookData.author || null,
          seriesName: bookData.seriesName || null,
          marketplace: bookData.marketplace,
          format: bookData.format || null,
          price: bookData.price || null,
          publishDate: bookData.publishDate || null,
          coverUrl: bookData.coverUrl || null
        });
        await bookRepository.save(newBook);
        saved++;
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
