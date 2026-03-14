import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { KdpBook } from '../entities/KdpBook';
import { CreateKdpBookInput, UpdateKdpBookInput, BookshelfFilters } from '../models/KdpBook';
import { KdpSyncLog } from '../models/KdpSyncLog';
import { Like } from 'typeorm';
import { mockBooks } from '../utils/mock-kdp-data';
import { authMiddleware } from '../middleware/auth';
import { kdpSyncScheduler } from '../services/kdp-sync-scheduler';

const router = Router();
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';

// Extended Request interface with userId
interface AuthRequest extends Request {
  userId?: string;
  // Explicitly include Express Request properties for TypeScript compatibility
  query: any;
  body: any;
  params: any;
}

// ================================================
// GET /api/kdp/books - Lista libri KDP con filtri
// ================================================
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      return res.json({
        success: true,
        data: mockBooks,
        pagination: {
          page: 1,
          limit: 25,
          total: mockBooks.length,
          totalPages: 1
        }
      });
    }

    const filters: BookshelfFilters = {
      status: (req.query.status as any) || 'all',
      search: req.query.search as string,
      marketplace: req.query.marketplace as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 25,
      format: req.query.format as string
    };

    const bookRepository = AppDataSource.getRepository(KdpBook);
    const skip = (filters.page! - 1) * filters.limit!;

    // Build query
    const whereConditions: any = {};

    // Use authenticated user's ID
    whereConditions.userId = req.userId;

    if (filters.marketplace) {
      whereConditions.marketplace = filters.marketplace;
    }

    if (filters.format && filters.format !== 'all') {
      whereConditions.format = filters.format;
    }

    if (filters.search) {
      // Search in title or ASIN
      const searchResults = await bookRepository
        .createQueryBuilder('book')
        .where('book.userId = :userId', { userId: req.userId })
        .andWhere('(book.title LIKE :search OR book.asin LIKE :search)', {
          search: `%${filters.search}%`
        })
        .andWhere(filters.format && filters.format !== 'all' ? 'book.format = :format' : '1=1', { format: filters.format })
        .skip(skip)
        .take(filters.limit!)
        .orderBy('book.createdAt', 'DESC')
        .getManyAndCount();

      return res.json({
        success: true,
        data: searchResults[0],
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: searchResults[1],
          totalPages: Math.ceil(searchResults[1] / filters.limit!)
        }
      });
    }

    // Fetch all (no skip/take) to dedup by ASIN before paginating
    const allBooks = await bookRepository.find({
      where: whereConditions,
      order: { createdAt: 'DESC' }
    });

    // Dedup: same ASIN can appear in multiple marketplaces — keep the one with most data
    const byAsin = new Map<string, typeof allBooks[0]>();
    for (const book of allBooks) {
      const key = (book.asin || '').trim().toUpperCase();
      const existing = byAsin.get(key);
      if (!existing) {
        byAsin.set(key, book);
      } else {
        const existingScore = (existing.bsrRank ? 2 : 0) + (existing.pageCount ? 1 : 0);
        const bookScore = (book.bsrRank ? 2 : 0) + (book.pageCount ? 1 : 0);
        if (bookScore > existingScore) byAsin.set(key, book);
      }
    }
    const deduped = Array.from(byAsin.values());
    const total = deduped.length;
    const books = deduped.slice(skip, skip + filters.limit!);

    res.json({
      success: true,
      data: books,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit!)
      }
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/books:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei libri KDP',
      details: error.message
    });
  }
});

// ================================================
// GET /api/kdp/books/:id - Dettagli libro singolo
// ================================================
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const bookRepository = AppDataSource.getRepository(KdpBook);
    const book = await bookRepository.findOne({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Libro non trovato'
      });
    }

    res.json({
      success: true,
      data: book
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/books/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero del libro',
      details: error.message
    });
  }
});

// ================================================
// POST /api/kdp/sync - Sincronizza libri da KDP
// ================================================
router.post('/sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    console.log(`🔄 Manual KDP sync requested for user ${userId}`);

    // Trigger manual sync using kdpSyncScheduler
    const result = await kdpSyncScheduler.syncUser(userId);

    console.log(`✅ Manual sync completed: ${result.books} books, ${result.stats} stats`);

    res.json({
      success: true,
      data: {
        books: result.books,
        stats: result.stats,
        message: 'KDP data synchronized successfully'
      }
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/kdp/sync:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella sincronizzazione KDP',
      details: error.message
    });
  }
});

// ================================================
// POST /api/kdp/sync-historical - Importa dati storici da CSV
// ================================================
router.post('/sync-historical', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    console.log(`📅 Historical data import requested for user ${userId} — handled via extension`);

    // Historical import ora gestito dall'estensione Chrome via POST /api/kdp-sync/sales-data
    res.json({
      success: true,
      data: {
        monthsImported: 0,
        message: 'Historical data import is handled by the Chrome extension (12 months captured automatically on sync)'
      }
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/kdp/sync-historical:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'import dei dati storici',
      details: error.message
    });
  }
});

// ================================================
// POST /api/kdp/books - Crea libro manualmente
// ================================================
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const bookData: CreateKdpBookInput = {
      ...req.body,
      userId: req.userId
    };

    const bookRepository = AppDataSource.getRepository(KdpBook);

    // Check if ASIN already exists
    const existingBook = await bookRepository.findOne({
      where: { userId: bookData.userId, asin: bookData.asin }
    });

    if (existingBook) {
      return res.status(409).json({
        success: false,
        error: 'ASIN già esistente per questo utente'
      });
    }

    const book = bookRepository.create(bookData);
    await bookRepository.save(book);

    console.log(`✅ Libro KDP creato: ${book.title} (${book.asin})`);

    res.status(201).json({
      success: true,
      data: book
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/kdp/books:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione del libro',
      details: error.message
    });
  }
});

// ================================================
// PUT /api/kdp/books/:id - Aggiorna libro
// ================================================
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const bookData: UpdateKdpBookInput = req.body;
    console.log(`📝 PUT /api/kdp/books/${req.params.id} - Updating:`, JSON.stringify(bookData));

    const bookRepository = AppDataSource.getRepository(KdpBook);
    const book = await bookRepository.findOne({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Libro non trovato'
      });
    }

    Object.assign(book, bookData);
    await bookRepository.save(book);

    console.log(`✅ Libro KDP aggiornato: ${book.title} (${book.asin}) - trimSize: ${book.trimSize}, inkType: ${book.inkType}`);

    res.json({
      success: true,
      data: book
    });
  } catch (error: any) {
    console.error('❌ Errore PUT /api/kdp/books/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento del libro',
      details: error.message
    });
  }
});

// ================================================
// DELETE /api/kdp/books/:id - Elimina libro
// ================================================
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const bookRepository = AppDataSource.getRepository(KdpBook);
    const book = await bookRepository.findOne({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Libro non trovato'
      });
    }

    await bookRepository.remove(book);

    console.log(`✅ Libro KDP eliminato: ${book.title} (${book.asin})`);

    res.json({
      success: true,
      message: 'Libro eliminato con successo'
    });
  } catch (error: any) {
    console.error('❌ Errore DELETE /api/kdp/books/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione del libro',
      details: error.message
    });
  }
});

export default router;
