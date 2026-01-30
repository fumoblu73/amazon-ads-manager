// KDP Bookshelf Scraper - Content Script
// Runs on kdp.amazon.com/*/bookshelf
// Scrapes book metadata (title, ASIN, author, price, cover, etc.) and sends to background

(function() {
  'use strict';

  console.log('[KDP Bookshelf Scraper] Content script loaded on:', window.location.href);

  // Notify background that scraper is ready
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'kdpBookshelfScraperReady', url: window.location.href });
  }, 2000);

  // Listen for commands from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startBookshelfScraping') {
      console.log('[KDP Bookshelf Scraper] Starting bookshelf scraping...');
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

        // Check format - only Paperback
        const formatElement = row.querySelector(`span[id*="print-status-format-${rowId}"]`);
        const format = formatElement ? cleanText(formatElement.innerText || formatElement.textContent) : '';

        const isPaperback = format && (
          format === 'Paperback' ||
          format === 'Versione cartacea' ||
          format === 'Tapa blanda' ||
          format === 'Broch\u00e9' ||
          format === 'Taschenbuch'
        );

        if (!isPaperback) return;

        // Extract ASIN
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

        // Extract PRICE
        const priceElement = row.querySelector(`a[id*="print-price-list-price-${rowId}"]`);
        const price = priceElement ? cleanText(priceElement.innerText || priceElement.textContent) : '';

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

        books.push({
          title: title.substring(0, 500),
          asin: asin.substring(0, 15),
          author: author ? author.substring(0, 200) : null,
          seriesName: seriesName ? seriesName.substring(0, 200) : null,
          format: 'Paperback',
          price: price ? price.substring(0, 50) : null,
          publishDate: publishDate || null,
          coverUrl: coverUrl || null
        });

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
    if (url.includes('.it/')) return 'IT';
    if (url.includes('.co.uk/')) return 'UK';
    if (url.includes('.de/')) return 'DE';
    if (url.includes('.fr/')) return 'FR';
    if (url.includes('.es/')) return 'ES';
    if (url.includes('.ca/')) return 'CA';
    if (url.includes('.com.au/')) return 'AU';
    if (url.includes('.co.jp/')) return 'JP';
    return 'US';
  }

})();
