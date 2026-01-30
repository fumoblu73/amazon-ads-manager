/**
 * Google Books API service
 * Fetches book metadata (pageCount) using ISBN/ASIN
 * API docs: https://developers.google.com/books/docs/v1/using
 */

interface GoogleBooksVolume {
  totalItems: number;
  items?: Array<{
    volumeInfo: {
      title?: string;
      pageCount?: number;
      printType?: string;
      language?: string;
    };
  }>;
}

/**
 * Fetch page count for a book from Google Books API using its ASIN (= ISBN-10).
 * @param asin - The book ASIN (same as ISBN-10 for physical books)
 * @returns pageCount or null if not found
 */
export async function fetchPageCount(asin: string): Promise<number | null> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${asin}&fields=totalItems,items(volumeInfo/pageCount)`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[GoogleBooks] API error for ASIN ${asin}: ${response.status}`);
      return null;
    }

    const data: GoogleBooksVolume = await response.json();

    if (!data.items || data.items.length === 0) {
      console.warn(`[GoogleBooks] No results for ASIN ${asin}`);
      return null;
    }

    const pageCount = data.items[0].volumeInfo?.pageCount;
    if (!pageCount) {
      console.warn(`[GoogleBooks] No pageCount for ASIN ${asin}`);
      return null;
    }

    console.log(`[GoogleBooks] ASIN ${asin}: ${pageCount} pages`);
    return pageCount;
  } catch (error) {
    console.error(`[GoogleBooks] Error fetching ASIN ${asin}:`, error);
    return null;
  }
}

/**
 * Fetch page counts for multiple ASINs. Processes sequentially to avoid rate limits.
 * @param asins - Array of ASINs to look up
 * @returns Map of ASIN → pageCount (only includes successful lookups)
 */
export async function fetchPageCounts(asins: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  for (const asin of asins) {
    const pageCount = await fetchPageCount(asin);
    if (pageCount !== null) {
      results.set(asin, pageCount);
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}
