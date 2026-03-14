import { Router, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { KdpBook } from '../../entities/KdpBook';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

/**
 * GET /api/kdp/books
 * Restituisce tutti i libri dell'utente autenticato
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { marketplace, search, limit, format, sort } = req.query;

    const bookRepo = AppDataSource.getRepository(KdpBook);

    const queryBuilder = bookRepo
      .createQueryBuilder('book')
      .where('book.userId = :userId', { userId: req.userId })
      .leftJoinAndSelect('book.linkedCampaign', 'campaign')
      .orderBy('book.title', 'ASC');

    // Filtra per marketplace se specificato
    if (marketplace) {
      queryBuilder.andWhere('book.marketplace = :marketplace', { marketplace });
    }

    // Filtra per formato se specificato (NULL trattato come Paperback per libri pre-migrazione)
    if (format && typeof format === 'string' && format !== 'all') {
      if (format === 'Paperback') {
        queryBuilder.andWhere('(book.format = :format OR book.format IS NULL)', { format });
      } else {
        queryBuilder.andWhere('book.format = :format', { format });
      }
    }

    // Ricerca case-insensitive (ILIKE) su titolo e ASIN
    if (search && typeof search === 'string' && search.trim()) {
      queryBuilder.andWhere(
        '(book.title ILIKE :search OR book.asin ILIKE :search)',
        { search: `%${search.trim()}%` }
      );
    }

    // Fetch ALL books first, then dedup by ASIN, then apply limit.
    const books = await queryBuilder.getMany();

    // Deduplica per ASIN: stesso libro può esistere su più marketplace.
    const byAsin = new Map<string, KdpBook>();
    for (const book of books) {
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
    let deduped = Array.from(byAsin.values());

    // Ordinamento dopo dedup
    const parsePrice = (p: string | null | undefined) => parseFloat((p || '0').replace(/[^0-9.]/g, '')) || 0;
    if (sort === 'title_desc') {
      deduped.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sort === 'price_asc') {
      deduped.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    } else if (sort === 'price_desc') {
      deduped.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    } else {
      deduped.sort((a, b) => a.title.localeCompare(b.title)); // default A-Z
    }

    // Apply limit after dedup
    if (limit) deduped = deduped.slice(0, Number(limit));

    res.json({
      success: true,
      data: deduped,
      count: deduped.length,
      books: deduped   // backward compat per estensione Chrome
    });
  } catch (error) {
    console.error('Errore nel recupero dei libri:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * GET /api/kdp/books/:id
 * Restituisce un singolo libro con le sue statistiche
 */
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const bookRepo = AppDataSource.getRepository(KdpBook);

    const book = await bookRepo.findOne({
      where: { id, userId: req.userId },
      relations: ['linkedCampaign', 'dailyStats', 'journalEvents']
    });

    if (!book) {
      res.status(404).json({ error: 'Libro non trovato' });
      return;
    }

    res.json({ book });
  } catch (error) {
    console.error('Errore nel recupero del libro:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * POST /api/kdp/books
 * Crea un nuovo libro (generalmente chiamato dall'estensione)
 */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      asin,
      title,
      author,
      marketplace,
      seriesName,
      seriesPosition,
      publishDate,
      coverUrl,
      linkedCampaignId
    } = req.body;

    // Validazione campi obbligatori
    if (!asin || !title || !marketplace) {
      res.status(400).json({ error: 'ASIN, titolo e marketplace sono obbligatori' });
      return;
    }

    const bookRepo = AppDataSource.getRepository(KdpBook);

    // Verifica se il libro esiste già
    const existingBook = await bookRepo.findOne({
      where: { userId: req.userId, asin, marketplace }
    });

    if (existingBook) {
      res.status(409).json({ error: 'Libro già presente per questo marketplace' });
      return;
    }

    // Crea il nuovo libro
    const book = bookRepo.create({
      userId: req.userId,
      asin,
      title,
      author,
      marketplace,
      seriesName,
      seriesPosition,
      publishDate,
      coverUrl,
      linkedCampaignId
    });

    await bookRepo.save(book);

    res.status(201).json({
      message: 'Libro creato con successo',
      book
    });
  } catch (error) {
    console.error('Errore nella creazione del libro:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * PATCH /api/kdp/books/:id
 * Aggiorna un libro esistente
 */
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const bookRepo = AppDataSource.getRepository(KdpBook);

    const book = await bookRepo.findOne({
      where: { id, userId: req.userId }
    });

    if (!book) {
      res.status(404).json({ error: 'Libro non trovato' });
      return;
    }

    // Campi aggiornabili
    const allowedUpdates = [
      'title',
      'author',
      'seriesName',
      'seriesPosition',
      'publishDate',
      'coverUrl',
      'linkedCampaignId'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        (book as any)[field] = updates[field];
      }
    });

    await bookRepo.save(book);

    res.json({
      message: 'Libro aggiornato con successo',
      book
    });
  } catch (error) {
    console.error('Errore nell\'aggiornamento del libro:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * DELETE /api/kdp/books/:id
 * Elimina un libro
 */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const bookRepo = AppDataSource.getRepository(KdpBook);

    const book = await bookRepo.findOne({
      where: { id, userId: req.userId }
    });

    if (!book) {
      res.status(404).json({ error: 'Libro non trovato' });
      return;
    }

    await bookRepo.remove(book);

    res.json({ message: 'Libro eliminato con successo' });
  } catch (error) {
    console.error('Errore nell\'eliminazione del libro:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * POST /api/kdp/books/:id/link-campaign
 * Collega un libro a una campagna
 */
router.post('/:id/link-campaign', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { campaignId } = req.body;

    if (!campaignId) {
      res.status(400).json({ error: 'campaignId è obbligatorio' });
      return;
    }

    const bookRepo = AppDataSource.getRepository(KdpBook);

    const book = await bookRepo.findOne({
      where: { id, userId: req.userId }
    });

    if (!book) {
      res.status(404).json({ error: 'Libro non trovato' });
      return;
    }

    book.linkedCampaignId = campaignId;
    await bookRepo.save(book);

    res.json({
      message: 'Campagna collegata con successo',
      book
    });
  } catch (error) {
    console.error('Errore nel collegamento della campagna:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;
