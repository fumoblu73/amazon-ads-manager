/**
 * Script per mostrare una tabella con i dati FAST ACOS di tutti i libri
 * Eseguire con: npx ts-node scripts/show-books-fastacos.ts
 */

import 'dotenv/config';
import { AppDataSource } from '../src/config/database';
import { KdpBook } from '../src/entities/KdpBook';
import { calculateBookFastAcos, parseKdpPrice, InkType, TrimSize } from '../src/utils/printingCost';

interface BookFastAcosData {
  asin: string;
  title: string;
  pageCount: number | null;
  inkType: string;
  trimSize: string;
  price: number | null;
  printingCost: number | null;
  royalty: number | null;
  fastAcos: number | null;
  error?: string;
}

async function main() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connected.\n');

    // Get all books
    const kdpBookRepo = AppDataSource.getRepository(KdpBook);
    const books = await kdpBookRepo.find({
      order: { title: 'ASC' }
    });

    console.log(`Found ${books.length} books.\n`);

    // VAT settings (22% IVA)
    const vatSettings = { useVat: true, vatPercentage: 22 };

    // Calculate FAST ACOS for each book
    const results: BookFastAcosData[] = [];

    for (const book of books) {
      const price = parseKdpPrice(book.price);
      const pageCount = book.pageCount;
      const inkType = (book.inkType || 'black_white') as InkType;
      const trimSize = (book.trimSize || '6x9') as TrimSize;
      const royaltyPct = Number(book.royaltyPercentage) || 60;
      const marketplace = book.marketplace || 'IT';

      let result: BookFastAcosData = {
        asin: book.asin,
        title: book.title.substring(0, 40) + (book.title.length > 40 ? '...' : ''),
        pageCount,
        inkType,
        trimSize,
        price,
        printingCost: null,
        royalty: null,
        fastAcos: null,
      };

      if (!price) {
        result.error = 'No price';
      } else if (!pageCount) {
        result.error = 'No pages';
      } else {
        const calcResult = calculateBookFastAcos(
          price,
          pageCount,
          marketplace,
          inkType,
          royaltyPct,
          vatSettings,
          trimSize
        );

        if (calcResult) {
          result.printingCost = calcResult.printingCost;
          result.royalty = calcResult.royalty;
          result.fastAcos = calcResult.fastAcos;
        } else {
          result.error = 'Calc failed';
        }
      }

      results.push(result);
    }

    // Print table header
    console.log('=' .repeat(140));
    console.log(
      'ASIN'.padEnd(12) +
      'Pages'.padStart(6) +
      'Ink'.padStart(10) +
      'Trim'.padStart(10) +
      'Price'.padStart(8) +
      'Print$'.padStart(8) +
      'Royalty'.padStart(8) +
      'FAST%'.padStart(8) +
      '  ' +
      'Title'
    );
    console.log('=' .repeat(140));

    // Print each book
    for (const r of results) {
      const row =
        r.asin.padEnd(12) +
        (r.pageCount?.toString() || '-').padStart(6) +
        r.inkType.substring(0, 8).padStart(10) +
        r.trimSize.padStart(10) +
        (r.price?.toFixed(2) || '-').padStart(8) +
        (r.printingCost?.toFixed(2) || '-').padStart(8) +
        (r.royalty?.toFixed(2) || '-').padStart(8) +
        (r.fastAcos ? r.fastAcos.toFixed(1) + '%' : r.error || '-').padStart(8) +
        '  ' +
        r.title;

      console.log(row);
    }

    console.log('=' .repeat(140));

    // Summary
    const validBooks = results.filter(r => r.fastAcos !== null);
    const invalidBooks = results.filter(r => r.fastAcos === null);

    console.log(`\nSummary:`);
    console.log(`  Valid calculations: ${validBooks.length}`);
    console.log(`  Missing data: ${invalidBooks.length}`);

    if (validBooks.length > 0) {
      const avgFastAcos = validBooks.reduce((sum, r) => sum + (r.fastAcos || 0), 0) / validBooks.length;
      console.log(`  Average FAST ACOS: ${avgFastAcos.toFixed(1)}%`);
    }

    if (invalidBooks.length > 0) {
      console.log(`\nBooks with missing data:`);
      for (const r of invalidBooks) {
        console.log(`  - ${r.asin}: ${r.error}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

main();
