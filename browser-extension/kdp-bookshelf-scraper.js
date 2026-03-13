// KDP Bookshelf Scraper - Content Script
// Runs on kdp.amazon.com/*/bookshelf
// Scrapes book metadata (title, ASIN, author, price, cover, etc.) and sends to background

(function() {
  'use strict';

  console.log('[KDP Bookshelf Scraper] Content script loaded on:', window.location.href);

  // forceRefresh: set by background when triggered by manual sync (bypasses BSR cache)
  let _forceRefresh = false;

  // Notify background that scraper is ready
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'kdpBookshelfScraperReady', url: window.location.href });
  }, 2000);

  // Listen for commands from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startBookshelfScraping') {
      _forceRefresh = request.forceRefresh || false;
      console.log('[KDP Bookshelf Scraper] Starting bookshelf scraping, forceRefresh:', _forceRefresh);
      scrapeBookshelf();
    }
  });

  function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
  }

  async function scrapeBookshelf() {
    try {
      const allBooks = [];
      const processedAsins = new Set();
      let currentPage = 1;
      let maxPage = 1;

      // Wait for table to load
      await waitForTable();

      // Scrape all pages
      while (currentPage <= maxPage && currentPage <= 10) {
        console.log(`[KDP Bookshelf Scraper] Scraping page ${currentPage}...`);

        chrome.runtime.sendMessage({
          action: 'kdpBookshelfProgress',
          percent: Math.round((currentPage / Math.max(maxPage, 1)) * 80),
          text: `Pagina ${currentPage}/${maxPage}...`
        });

        const result = scrapePage(processedAsins);

        for (const book of result.books) {
          allBooks.push(book);
          processedAsins.add(book.asin);
        }

        maxPage = result.maxPage || 1;
        console.log(`[KDP Bookshelf Scraper] Page ${currentPage}: found ${result.books.length} books, maxPage=${maxPage}`);

        if (currentPage < maxPage) {
          // Navigate to next page
          const navigated = await goToPage(currentPage + 1);
          if (!navigated) break;
          await waitForTable();
        }

        currentPage++;
      }

      console.log(`[KDP Bookshelf Scraper] Total books found: ${allBooks.length}`);

      // Detect marketplace from URL
      const marketplace = detectMarketplace();

      // Add marketplace to each book
      for (const book of allBooks) {
        book.marketplace = marketplace;
      }

      // Try to enrich books with pageCount from Amazon product pages (async)
      chrome.runtime.sendMessage({
        action: 'kdpBookshelfProgress',
        percent: 85,
        text: 'Recupero numero pagine...'
      });

      await enrichBooksWithPageCount(allBooks);

      chrome.runtime.sendMessage({
        action: 'kdpBookshelfDataComplete',
        success: true,
        data: { books: allBooks, marketplace }
      });

    } catch (error) {
      console.error('[KDP Bookshelf Scraper] Error:', error);
      chrome.runtime.sendMessage({
        action: 'kdpBookshelfScrapeFailed',
        error: error.message
      });
    }
  }

  function waitForTable(timeout = 15000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      function check() {
        const table = document.querySelector('table.refreshedbookshelftable');
        if (table) {
          resolve(table);
          return;
        }
        if (Date.now() - startTime > timeout) {
          reject(new Error('Bookshelf table not found within timeout'));
          return;
        }
        setTimeout(check, 500);
      }
      check();
    });
  }

  function scrapePage(processedAsins) {
    const books = [];
    const mainTable = document.querySelector('table.refreshedbookshelftable');

    if (!mainTable) {
      console.warn('[KDP Bookshelf Scraper] Main table not found');
      return { books: [], maxPage: 1 };
    }

    const rows = mainTable.querySelectorAll('tbody > tr');

    rows.forEach((row, index) => {
      try {
        const rowId = row.id || '';

        // Detect print format (Paperback or Hardcover)
        const formatElement = row.querySelector(`span[id*="print-status-format-${rowId}"]`);
        const formatRaw = formatElement ? cleanText(formatElement.innerText || formatElement.textContent) : '';

        const isPaperback = formatRaw === 'Paperback' || formatRaw === 'Versione cartacea' ||
          formatRaw === 'Tapa blanda' || formatRaw === 'Broch\u00e9' || formatRaw === 'Taschenbuch';
        const isHardcover = formatRaw === 'Hardcover' || formatRaw === 'Copertina rigida' ||
          formatRaw === 'Tapa dura' || formatRaw === 'Reli\u00e9' || formatRaw === 'Gebundene Ausgabe';

        if (!isPaperback && !isHardcover) return;

        const normalizedFormat = isHardcover ? 'Hardcover' : 'Paperback';

        // Extract print ASIN
        const asinElement = row.querySelector(`span[id*="print-price-asin-${rowId}"]`);
        let asin = '';
        if (asinElement) {
          const asinText = cleanText(asinElement.innerText || asinElement.textContent);
          const asinMatch = asinText.match(/(?:Codice\s+)?ASIN:\s*([A-Z0-9]{10})/i);
          if (asinMatch) asin = asinMatch[1];
        }

        if (!asin || processedAsins.has(asin)) return;

        // Extract TITLE
        let title = '';
        const metadataCol = row.querySelector('.bookshelf-itemset-metadata-column');
        if (metadataCol) {
          const textElements = metadataCol.querySelectorAll('.mt-text-content, .title-link-label, .a-text-bold');
          for (const el of Array.from(textElements)) {
            const text = cleanText(el.innerText || el.textContent);
            if (text.length > 20 && !text.startsWith('da ')) {
              title = text;
              break;
            }
          }
        }
        if (!title) return;

        // Extract AUTHOR
        const authorElement = row.querySelector(`span[id*="author-${rowId}"]`);
        let author = '';
        if (authorElement) {
          author = cleanText(authorElement.innerText || authorElement.textContent);
          if (author.startsWith('da ')) author = author.substring(3);
          if (author.startsWith('by ')) author = author.substring(3);
        }

        // Extract SERIES
        const seriesElement = row.querySelector(`span[id*="series_title-${rowId}"]`);
        const seriesName = seriesElement ? cleanText(seriesElement.innerText || seriesElement.textContent) : '';

        // Extract PRICE (print)
        const priceElement = row.querySelector(`a[id*="print-price-list-price-${rowId}"]`);
        const price = priceElement ? cleanText(priceElement.innerText || priceElement.textContent) : '';

        // Extract EBOOK PRICE and ASIN
        const ebookPriceElement = row.querySelector(`a[id*="digital-price-list-price-${rowId}"]`);
        const ebookPrice = ebookPriceElement ? cleanText(ebookPriceElement.innerText || ebookPriceElement.textContent) : '';
        const ebookAsinElement = row.querySelector(`span[id*="digital-price-asin-${rowId}"]`);
        let ebookAsin = '';
        if (ebookAsinElement) {
          const ebookAsinText = cleanText(ebookAsinElement.innerText || ebookAsinElement.textContent);
          const ebookAsinMatch = ebookAsinText.match(/(?:Codice\s+)?ASIN:\s*([A-Z0-9]{10})/i);
          if (ebookAsinMatch) ebookAsin = ebookAsinMatch[1];
        }

        // Extract PUBLISH DATE
        const dateElement = row.querySelector(`span[id*="print-status-release-date-${rowId}"]`);
        let publishDate = '';
        if (dateElement) {
          const dateText = cleanText(dateElement.innerText || dateElement.textContent);
          const colonMatch = dateText.match(/(?:Data di invio|Submission date):\s*(.+)/i);
          if (colonMatch) {
            publishDate = colonMatch[1];
          } else {
            const submittedMatch = dateText.match(/Submitted on\s+(.+)/i);
            if (submittedMatch) publishDate = submittedMatch[1];
          }
        }

        // Extract COVER URL
        const coverElement = row.querySelector(`td[id*="${rowId}-cover"] img`);
        const coverUrl = coverElement ? coverElement.src : '';

        // Push print book (Paperback or Hardcover)
        processedAsins.add(asin);
        books.push({
          titleId: rowId || null,
          title: title.substring(0, 500),
          asin: asin.substring(0, 15),
          author: author ? author.substring(0, 200) : null,
          seriesName: seriesName ? seriesName.substring(0, 200) : null,
          format: normalizedFormat,
          price: price ? price.substring(0, 50) : null,
          ebookPrice: ebookPrice ? ebookPrice.substring(0, 50) : null,
          publishDate: publishDate || null,
          coverUrl: coverUrl || null
        });

        // Push ebook as separate entry if ASIN available
        if (ebookAsin && !processedAsins.has(ebookAsin)) {
          processedAsins.add(ebookAsin);
          books.push({
            titleId: rowId || null,
            title: title.substring(0, 500),
            asin: ebookAsin.substring(0, 15),
            author: author ? author.substring(0, 200) : null,
            seriesName: seriesName ? seriesName.substring(0, 200) : null,
            format: 'Ebook',
            price: ebookPrice ? ebookPrice.substring(0, 50) : null,
            ebookPrice: null,
            publishDate: publishDate || null,
            coverUrl: coverUrl || null
          });
        }

      } catch (error) {
        console.warn(`[KDP Bookshelf Scraper] Error processing row ${index}:`, error);
      }
    });

    // Detect pagination
    const paginationLinks = Array.from(document.querySelectorAll('.a-pagination li'));
    const pageNumbers = [];
    paginationLinks.forEach(li => {
      const link = li.querySelector('a');
      if (link && link.textContent) {
        const num = parseInt(link.textContent.trim());
        if (!isNaN(num)) pageNumbers.push(num);
      }
    });
    const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;

    return { books, maxPage };
  }

  async function goToPage(pageNum) {
    const paginationLinks = document.querySelectorAll('.a-pagination li a');
    for (const link of Array.from(paginationLinks)) {
      if (link.textContent && parseInt(link.textContent.trim()) === pageNum) {
        link.click();
        // Wait for page transition
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
      }
    }
    return false;
  }

  function detectMarketplace() {
    const url = window.location.href;
    // KDP URLs use locale format: kdp.amazon.com/it_IT/bookshelf
    if (url.includes('/it_IT/') || url.includes('.it/')) return 'IT';
    if (url.includes('/en_GB/') || url.includes('.co.uk/')) return 'UK';
    if (url.includes('/de_DE/') || url.includes('.de/')) return 'DE';
    if (url.includes('/fr_FR/') || url.includes('.fr/')) return 'FR';
    if (url.includes('/es_ES/') || url.includes('.es/')) return 'ES';
    if (url.includes('/en_CA/') || url.includes('.ca/')) return 'CA';
    if (url.includes('/en_AU/') || url.includes('.com.au/')) return 'AU';
    if (url.includes('/ja_JP/') || url.includes('.co.jp/')) return 'JP';
    return 'US';
  }

  /**
   * Fetches pageCount from Amazon product page for a single ASIN.
   * Uses the background script to make the request (content scripts can't do cross-origin).
   * Returns null if not found or on error.
   */
  async function fetchPageCountFromAmazon(asin, marketplace) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'fetchPageCount', asin, marketplace, forceRefresh: _forceRefresh },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(`[KDP Bookshelf Scraper] Error fetching ${asin}:`, chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          if (response && response.success) {
            resolve({
              pageCount: response.pageCount || null,
              bsrRank: response.bsrRank || null,
              bsrCategory: response.bsrCategory || null
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Enriches books array with pageCount and BSR by fetching Amazon product pages.
   * Processes books in batches to avoid overwhelming the server.
   */
  async function enrichBooksWithPageCount(books) {
    console.log(`[KDP Bookshelf Scraper] Enriching ${books.length} books with pageCount + BSR...`);

    const booksNeedingMeta = books.filter(b => (!b.pageCount || !b.bsrRank) && b.asin);
    if (booksNeedingMeta.length === 0) {
      console.log('[KDP Bookshelf Scraper] All books already have meta or no ASINs');
      return;
    }

    let enriched = 0;
    let failed = 0;

    // Process in small batches with delays to avoid rate limiting
    const batchSize = 3;
    for (let i = 0; i < booksNeedingMeta.length; i += batchSize) {
      const batch = booksNeedingMeta.slice(i, i + batchSize);

      // Update progress
      const progress = Math.round(85 + (i / booksNeedingMeta.length) * 10);
      chrome.runtime.sendMessage({
        action: 'kdpBookshelfProgress',
        percent: progress,
        text: `Pagine/BSR: ${enriched}/${booksNeedingMeta.length}...`
      });

      // Process batch in parallel
      const promises = batch.map(async (book) => {
        try {
          const meta = await fetchPageCountFromAmazon(book.asin, book.marketplace);
          if (meta) {
            if (meta.pageCount) book.pageCount = meta.pageCount;
            if (meta.bsrRank) { book.bsrRank = meta.bsrRank; book.bsrCategory = meta.bsrCategory; }
            enriched++;
            console.log(`[KDP Bookshelf Scraper] ${book.asin}: pages=${meta.pageCount}, bsr=#${meta.bsrRank}`);
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }
      });

      await Promise.all(promises);

      // Small delay between batches to be respectful
      if (i + batchSize < booksNeedingMeta.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[KDP Bookshelf Scraper] Meta enrichment complete: ${enriched} found, ${failed} failed`);
  }

})();
