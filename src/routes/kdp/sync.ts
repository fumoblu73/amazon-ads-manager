import { Router, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { KdpBook } from '../../entities/KdpBook';
import { KdpDailyStats } from '../../entities/KdpDailyStats';
import { KdpSyncLog } from '../../entities/KdpSyncLog';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

interface BookData {
  asin: string;
  title: string;
  author?: string;
  marketplace: string;
  seriesName?: string;
  seriesPosition?: number;
  publishDate?: string;
  coverUrl?: string;
}

interface DailyStatsData {
  date: string;
  ebookSales?: number;
  ebookRoyalty?: number;
  paperbackSales?: number;
  paperbackRoyalty?: number;
  hardcoverSales?: number;
  hardcoverRoyalty?: number;
  kenpReads?: number;
  kenpRoyalty?: number;
  bsr?: number;
}

interface SyncPayload {
  books: BookData[];
  dailyStats?: {
    [asin: string]: DailyStatsData[];
  };
}

/**
 * POST /api/kdp/sync
 * Sincronizza i dati KDP dall'estensione browser
 * Questa route riceve:
 * - Lista di libri con metadati
 * - Statistiche giornaliere per ciascun libro
 */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  let booksUpdated = 0;

  try {
    const { books, dailyStats }: SyncPayload = req.body;

    if (!books || !Array.isArray(books)) {
      res.status(400).json({ error: 'Campo books obbligatorio e deve essere un array' });
      return;
    }

    const bookRepo = AppDataSource.getRepository(KdpBook);
    const statsRepo = AppDataSource.getRepository(KdpDailyStats);
    const syncLogRepo = AppDataSource.getRepository(KdpSyncLog);

    // Processa ogni libro
    for (const bookData of books) {
      try {
        // Validazione campi obbligatori
        if (!bookData.asin || !bookData.title || !bookData.marketplace) {
          console.warn('Libro ignorato: mancano campi obbligatori', bookData);
          continue;
        }

        // Cerca o crea il libro
        let book = await bookRepo.findOne({
          where: {
            userId: req.userId,
            asin: bookData.asin,
            marketplace: bookData.marketplace
          }
        });

        if (book) {
          // Aggiorna i metadati del libro esistente
          book.title = bookData.title;
          book.author = bookData.author || book.author;
          book.seriesName = bookData.seriesName || book.seriesName;
          book.seriesPosition = bookData.seriesPosition || book.seriesPosition;
          book.publishDate = bookData.publishDate ? new Date(bookData.publishDate) : book.publishDate;
          book.coverUrl = bookData.coverUrl || book.coverUrl;
        } else {
          // Crea un nuovo libro
          book = bookRepo.create({
            userId: req.userId,
            asin: bookData.asin,
            title: bookData.title,
            author: bookData.author,
            marketplace: bookData.marketplace,
            seriesName: bookData.seriesName,
            seriesPosition: bookData.seriesPosition,
            publishDate: bookData.publishDate ? new Date(bookData.publishDate) : undefined,
            coverUrl: bookData.coverUrl
          });
        }

        await bookRepo.save(book);
        booksUpdated++;

        // Processa le statistiche giornaliere se presenti
        if (dailyStats && dailyStats[bookData.asin]) {
          const statsData = dailyStats[bookData.asin];

          for (const statData of statsData) {
            try {
              const statDate = new Date(statData.date);

              // Cerca o crea la statistica giornaliera
              let stat = await statsRepo.findOne({
                where: {
                  bookId: book.id,
                  date: statDate
                }
              });

              if (stat) {
                // Aggiorna statistica esistente
                stat.ebookSales = statData.ebookSales ?? stat.ebookSales;
                stat.ebookRoyalty = statData.ebookRoyalty ?? stat.ebookRoyalty;
                stat.paperbackSales = statData.paperbackSales ?? stat.paperbackSales;
                stat.paperbackRoyalty = statData.paperbackRoyalty ?? stat.paperbackRoyalty;
                stat.hardcoverSales = statData.hardcoverSales ?? stat.hardcoverSales;
                stat.hardcoverRoyalty = statData.hardcoverRoyalty ?? stat.hardcoverRoyalty;
                stat.kenpReads = statData.kenpReads ?? stat.kenpReads;
                stat.kenpRoyalty = statData.kenpRoyalty ?? stat.kenpRoyalty;
                stat.bsr = statData.bsr ?? stat.bsr;
              } else {
                // Crea nuova statistica
                stat = statsRepo.create({
                  bookId: book.id,
                  date: statDate,
                  ebookSales: statData.ebookSales || 0,
                  ebookRoyalty: statData.ebookRoyalty || 0,
                  paperbackSales: statData.paperbackSales || 0,
                  paperbackRoyalty: statData.paperbackRoyalty || 0,
                  hardcoverSales: statData.hardcoverSales || 0,
                  hardcoverRoyalty: statData.hardcoverRoyalty || 0,
                  kenpReads: statData.kenpReads || 0,
                  kenpRoyalty: statData.kenpRoyalty || 0,
                  bsr: statData.bsr
                });
              }

              await statsRepo.save(stat);
            } catch (error) {
              console.error(`Errore nel salvare la statistica per ${bookData.asin}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Errore nel processare il libro ${bookData.asin}:`, error);
      }
    }

    const durationMs = Date.now() - startTime;

    // Crea il log di sincronizzazione
    const syncLog = syncLogRepo.create({
      userId: req.userId,
      syncType: 'extension',
      status: booksUpdated > 0 ? 'success' : 'partial',
      booksUpdated,
      durationMs
    });

    await syncLogRepo.save(syncLog);

    res.json({
      message: 'Sincronizzazione completata',
      booksUpdated,
      durationMs,
      syncLogId: syncLog.id
    });
  } catch (error) {
    console.error('Errore durante la sincronizzazione:', error);

    // Salva il log di errore
    try {
      const syncLogRepo = AppDataSource.getRepository(KdpSyncLog);
      const syncLog = syncLogRepo.create({
        userId: req.userId,
        syncType: 'extension',
        status: 'error',
        booksUpdated,
        errorMessage: error instanceof Error ? error.message : 'Errore sconosciuto',
        durationMs: Date.now() - startTime
      });
      await syncLogRepo.save(syncLog);
    } catch (logError) {
      console.error('Errore nel salvare il log di sincronizzazione:', logError);
    }

    res.status(500).json({ error: 'Errore durante la sincronizzazione' });
  }
});

/**
 * GET /api/kdp/sync/logs
 * Restituisce lo storico delle sincronizzazioni
 */
router.get('/logs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = 20 } = req.query;

    const syncLogRepo = AppDataSource.getRepository(KdpSyncLog);

    const logs = await syncLogRepo.find({
      where: { userId: req.userId },
      order: { createdAt: 'DESC' },
      take: Number(limit)
    });

    res.json({
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Errore nel recupero dei log di sincronizzazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;
