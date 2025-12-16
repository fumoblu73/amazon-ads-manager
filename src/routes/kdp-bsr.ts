import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { KdpBook } from '../models/KdpBook';

const router = Router();

// Middleware per autenticazione Bearer token
const requireAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  next();
};

// ================================================
// GET /api/kdp/bsr - Lista BSR per tutti i libri
// ================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = 'demo-user'; // TODO: Get from auth
    const marketplace = req.query.marketplace as string;
    const asin = req.query.asin as string;

    const bookRepository = AppDataSource.getRepository(KdpBook);

    const whereConditions: any = { userId };
    if (marketplace) whereConditions.marketplace = marketplace;
    if (asin) whereConditions.asin = asin;

    const books = await bookRepository.find({
      where: whereConditions,
      order: { lastSyncDate: 'DESC' }
    });

    // TODO: In futuro, creare una entità separata BsrHistory per trackare BSR nel tempo
    // Per ora restituiamo i libri con info BSR mockate
    const bsrData = books.map(book => ({
      asin: book.asin,
      title: book.title,
      marketplace: book.marketplace,
      currentBsr: Math.floor(Math.random() * 100000) + 1000, // Mock data
      category: 'Kindle Store > Fiction',
      lastUpdated: book.lastSyncDate || book.updatedAt,
      history: [] // TODO: Implement BSR history tracking
    }));

    res.json({
      success: true,
      data: bsrData
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/bsr:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei BSR',
      details: error.message
    });
  }
});

// ================================================
// GET /api/kdp/bsr/:asin - BSR dettagliato per libro
// ================================================
router.get('/:asin', async (req: Request, res: Response) => {
  try {
    const userId = 'demo-user'; // TODO: Get from auth
    const { asin } = req.params;

    const bookRepository = AppDataSource.getRepository(KdpBook);
    const book = await bookRepository.findOne({
      where: { userId, asin }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Libro non trovato'
      });
    }

    // TODO: Implement actual BSR tracking with historical data
    // For now, return mock data
    const bsrData = {
      asin: book.asin,
      title: book.title,
      marketplace: book.marketplace,
      currentBsr: Math.floor(Math.random() * 100000) + 1000,
      bestBsr: Math.floor(Math.random() * 10000) + 500,
      averageBsr: Math.floor(Math.random() * 50000) + 5000,
      category: 'Kindle Store > Fiction',
      subCategories: [
        { name: 'Mystery & Suspense', rank: Math.floor(Math.random() * 1000) + 50 },
        { name: 'Crime Fiction', rank: Math.floor(Math.random() * 500) + 20 }
      ],
      history: [
        // Last 30 days mock data
        ...Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          bsr: Math.floor(Math.random() * 100000) + 1000
        })).reverse()
      ],
      lastUpdated: book.lastSyncDate || book.updatedAt
    };

    res.json({
      success: true,
      data: bsrData
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/bsr/:asin:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero del BSR',
      details: error.message
    });
  }
});

// ================================================
// POST /api/kdp/bsr/sync - Sincronizza BSR da Amazon
// ================================================
router.post('/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = 'demo-user'; // TODO: Get from auth
    const { asin } = req.body;

    // TODO: Implement actual Amazon API BSR sync
    // For now, just return success
    console.log(`✅ BSR sync requested for ${asin || 'all books'}`);

    res.json({
      success: true,
      message: 'BSR sync initiated',
      data: {
        booksUpdated: asin ? 1 : 5,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/kdp/bsr/sync:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella sincronizzazione BSR',
      details: error.message
    });
  }
});

export default router;
