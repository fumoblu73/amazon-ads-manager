import cron from 'node-cron';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { KdpBook } from '../models/KdpBook';
import { Not, IsNull, MoreThan } from 'typeorm';
import { kdpScraperService } from './kdp-scraper.service';
import { kdpReportsScraperService } from './kdp-reports-scraper.service';
import { fetchPageCount } from './googleBooksService';

export class KdpSyncScheduler {
  private isRunning = false;

  /**
   * Avvia lo scheduler per sync periodico
   */
  start(): void {
    // Sync ogni 6 ore per tutti gli utenti con sync abilitato
    cron.schedule('0 */6 * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️  KDP sync already running, skipping...');
        return;
      }

      this.isRunning = true;

      try {
        await this.syncAllUsers();
      } catch (error) {
        console.error('Scheduler error:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ KDP sync scheduler started (runs every 6 hours)');
  }

  /**
   * Sincronizza tutti gli utenti con KDP sync abilitato
   */
  private async syncAllUsers(): Promise<void> {
    console.log('🔄 Starting scheduled KDP sync for all users');

    const userRepository = AppDataSource.getRepository(User);

    // Trova utenti con sync abilitato e cookie validi (< 7 giorni)
    const users = await userRepository.find({
      where: {
        kdpSyncEnabled: true,
        kdpCookiesEncrypted: Not(IsNull()),
        kdpCookiesUpdatedAt: MoreThan(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      },
      select: ['id', 'email', 'kdpMarketplace', 'kdpLastSyncAt']
    });

    console.log(`📋 Found ${users.length} users with KDP sync enabled`);

    for (const user of users) {
      try {
        console.log(`🔄 Syncing user ${user.email} (${user.kdpMarketplace})`);

        // 1. Sync bookshelf (libri metadata)
        console.log('📚 Step 1/2: Syncing bookshelf...');
        const bookResult = await kdpScraperService.syncUserData(user.id);
        console.log(`✅ Bookshelf: ${bookResult.books} books`);

        // 2. Sync sales & royalties (dati vendite e guadagni)
        console.log('💰 Step 2/2: Syncing sales & royalties...');
        const salesResult = await kdpReportsScraperService.syncSalesAndRoyalties(user.id, false);
        console.log(`✅ Sales: ${salesResult.salesRecords} sales, ${salesResult.royaltiesRecords} royalties`);

        // 3. Enrich books with page count from Google Books
        console.log('📖 Step 3/3: Fetching page counts from Google Books...');
        const enriched = await this.enrichBooksWithPageCount(user.id);
        console.log(`✅ Page counts: ${enriched} books enriched`);

        console.log(`✅ User ${user.email} fully synced`);
      } catch (error: any) {
        console.error(`❌ Failed to sync user ${user.email}:`, error.message);
      }

      // Attendi 5 secondi tra un utente e l'altro per non sovraccaricare Amazon
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Chiudi browser alla fine
    await kdpScraperService.closeBrowser();
    await kdpReportsScraperService.closeBrowser();

    console.log('✅ Scheduled KDP sync completed');
  }

  /**
   * Forza sync manuale per un utente
   */
  async syncUser(userId: string): Promise<{ books: number; stats: number }> {
    // Sync bookshelf
    const bookResult = await kdpScraperService.syncUserData(userId);

    // Sync sales & royalties
    const salesResult = await kdpReportsScraperService.syncSalesAndRoyalties(userId, false);

    // Enrich books with page count from Google Books API
    const enriched = await this.enrichBooksWithPageCount(userId);
    console.log(`[KdpSync] Page counts enriched: ${enriched} books`);

    return {
      books: bookResult.books,
      stats: salesResult.salesRecords + salesResult.royaltiesRecords
    };
  }

  /**
   * Import dati storici da CSV per un utente
   */
  /**
   * Fetch page counts from Google Books API for books missing pageCount
   */
  async enrichBooksWithPageCount(userId: string): Promise<number> {
    const bookRepo = AppDataSource.getRepository(KdpBook);
    const booksWithoutPageCount = await bookRepo.find({
      where: { userId, pageCount: IsNull() as any }
    });

    if (booksWithoutPageCount.length === 0) return 0;

    let enriched = 0;
    for (const book of booksWithoutPageCount) {
      const pageCount = await fetchPageCount(book.asin);
      if (pageCount !== null) {
        book.pageCount = pageCount;
        await bookRepo.save(book);
        enriched++;
      }
    }

    return enriched;
  }

  async importHistoricalData(userId: string): Promise<number> {
    const result = await kdpReportsScraperService.syncSalesAndRoyalties(userId, true);
    return result.historicalMonths;
  }
}

// Esporta istanza singleton
export const kdpSyncScheduler = new KdpSyncScheduler();
