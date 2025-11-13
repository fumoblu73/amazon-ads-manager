import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Book } from '../models/Book';
import { CreateBookInput, UpdateBookInput, BookModel } from '../models/Book';

const router = Router();

// Middleware per autenticazione Bearer token
const requireAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// ================================================
// GET /api/books - Lista tutti i libri
// ================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const bookRepository = AppDataSource.getRepository(Book);
    const books = await bookRepository.find({
      order: { createdAt: 'DESC' }
    });

    res.json({
      success: true,
      count: books.length,
      data: books
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/books:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei libri',
      details: error.message
    });
  }
});

// ================================================
// GET /api/books/:id - Dettagli libro singolo
// ================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bookRepository = AppDataSource.getRepository(Book);
    const book = await bookRepository.findOne({
      where: { id: req.params.id }
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
    console.error('❌ Errore GET /api/books/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero del libro',
      details: error.message
    });
  }
});

// ================================================
// GET /api/books/asin/:asin - Trova libro per ASIN
// ================================================
router.get('/asin/:asin', async (req: Request, res: Response) => {
  try {
    const bookRepository = AppDataSource.getRepository(Book);
    const book = await bookRepository.findOne({
      where: { asin: req.params.asin }
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
    console.error('❌ Errore GET /api/books/asin/:asin:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero del libro',
      details: error.message
    });
  }
});

// ================================================
// POST /api/books - Crea nuovo libro
// ================================================
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const bookData: CreateBookInput = req.body;

    // Validazione
    const errors = BookModel.validate(bookData);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Errore validazione',
        details: errors
      });
    }

    const bookRepository = AppDataSource.getRepository(Book);

    // Verifica se ASIN già esistente
    const existingBook = await bookRepository.findOne({
      where: { asin: bookData.asin }
    });

    if (existingBook) {
      return res.status(409).json({
        success: false,
        error: 'ASIN già esistente'
      });
    }

    // Crea nuovo libro
    const book = bookRepository.create({
      ...bookData,
      royaltyPercentage: bookData.royaltyPercentage || 60
    });

    await bookRepository.save(book);

    console.log(`✅ Libro creato: ${book.title} (${book.asin}) - FAST ACoS: ${book.fastAcos}%`);

    res.status(201).json({
      success: true,
      data: book
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/books:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione del libro',
      details: error.message
    });
  }
});

// ================================================
// PUT /api/books/:id - Aggiorna libro esistente
// ================================================
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const bookData: UpdateBookInput = req.body;

    // Validazione
    const errors = BookModel.validate(bookData);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Errore validazione',
        details: errors
      });
    }

    const bookRepository = AppDataSource.getRepository(Book);
    const book = await bookRepository.findOne({
      where: { id: req.params.id }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Libro non trovato'
      });
    }

    // Aggiorna campi
    Object.assign(book, bookData);
    await bookRepository.save(book);

    console.log(`✅ Libro aggiornato: ${book.title} (${book.asin}) - FAST ACoS: ${book.fastAcos}%`);

    res.json({
      success: true,
      data: book
    });
  } catch (error: any) {
    console.error('❌ Errore PUT /api/books/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento del libro',
      details: error.message
    });
  }
});

// ================================================
// DELETE /api/books/:id - Elimina libro
// ================================================
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const bookRepository = AppDataSource.getRepository(Book);
    const book = await bookRepository.findOne({
      where: { id: req.params.id }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Libro non trovato'
      });
    }

    await bookRepository.remove(book);

    console.log(`✅ Libro eliminato: ${book.title} (${book.asin})`);

    res.json({
      success: true,
      message: 'Libro eliminato con successo'
    });
  } catch (error: any) {
    console.error('❌ Errore DELETE /api/books/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione del libro',
      details: error.message
    });
  }
});

export default router;
