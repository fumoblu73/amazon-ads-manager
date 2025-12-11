import { Router, Response } from 'express';
import { Between } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { JournalEvent } from '../../entities/JournalEvent';
import { KdpBook } from '../../entities/KdpBook';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

// Categorie eventi supportate
export const EVENT_CATEGORIES = [
  'price_change',
  'ad_launch',
  'ad_pause',
  'promo',
  'republish',
  'milestone',
  'review',
  'other'
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];

/**
 * GET /api/kdp/journal-events
 * Restituisce tutti gli eventi dell'utente o filtrati per libro/date
 *
 * Query params:
 * - bookId: filtra per libro specifico
 * - startDate: data inizio (formato YYYY-MM-DD)
 * - endDate: data fine (formato YYYY-MM-DD)
 * - category: filtra per categoria
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookId, startDate, endDate, category } = req.query;

    const eventRepo = AppDataSource.getRepository(JournalEvent);
    const queryBuilder = eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.book', 'book')
      .where('event.userId = :userId', { userId: req.userId });

    // Filtra per libro se specificato
    if (bookId) {
      queryBuilder.andWhere('event.bookId = :bookId', { bookId });
    }

    // Filtra per date se specificate
    if (startDate && endDate) {
      queryBuilder.andWhere('event.eventDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      });
    } else if (startDate) {
      queryBuilder.andWhere('event.eventDate >= :startDate', {
        startDate: new Date(startDate as string)
      });
    } else if (endDate) {
      queryBuilder.andWhere('event.eventDate <= :endDate', {
        endDate: new Date(endDate as string)
      });
    }

    // Filtra per categoria se specificata
    if (category) {
      queryBuilder.andWhere('event.category = :category', { category });
    }

    const events = await queryBuilder.orderBy('event.eventDate', 'DESC').getMany();

    res.json({
      count: events.length,
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        eventDate: event.eventDate,
        bookId: event.bookId,
        bookTitle: event.book?.title,
        createdAt: event.createdAt
      }))
    });
  } catch (error) {
    console.error('Errore nel recupero eventi:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * GET /api/kdp/journal-events/:id
 * Restituisce un singolo evento
 */
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const eventRepo = AppDataSource.getRepository(JournalEvent);
    const event = await eventRepo.findOne({
      where: { id, userId: req.userId },
      relations: ['book']
    });

    if (!event) {
      res.status(404).json({ error: 'Evento non trovato' });
      return;
    }

    res.json({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        eventDate: event.eventDate,
        bookId: event.bookId,
        bookTitle: event.book?.title,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
      }
    });
  } catch (error) {
    console.error('Errore nel recupero evento:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * POST /api/kdp/journal-events
 * Crea un nuovo evento
 */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, eventDate, bookId } = req.body;

    // Validazione campi obbligatori
    if (!title || !eventDate) {
      res.status(400).json({ error: 'Title e eventDate sono obbligatori' });
      return;
    }

    // Validazione categoria
    if (category && !EVENT_CATEGORIES.includes(category)) {
      res.status(400).json({
        error: `Categoria non valida. Valori ammessi: ${EVENT_CATEGORIES.join(', ')}`
      });
      return;
    }

    // Se è specificato un bookId, verifica che appartenga all'utente
    if (bookId) {
      const bookRepo = AppDataSource.getRepository(KdpBook);
      const book = await bookRepo.findOne({
        where: { id: bookId, userId: req.userId }
      });

      if (!book) {
        res.status(404).json({ error: 'Libro non trovato' });
        return;
      }
    }

    const eventRepo = AppDataSource.getRepository(JournalEvent);
    const event = eventRepo.create({
      userId: req.userId,
      title,
      description,
      category: category || 'other',
      eventDate: new Date(eventDate),
      bookId: bookId || null
    });

    await eventRepo.save(event);

    res.status(201).json({
      message: 'Evento creato con successo',
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        eventDate: event.eventDate,
        bookId: event.bookId,
        createdAt: event.createdAt
      }
    });
  } catch (error) {
    console.error('Errore nella creazione evento:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * PATCH /api/kdp/journal-events/:id
 * Aggiorna un evento esistente
 */
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, category, eventDate, bookId } = req.body;

    const eventRepo = AppDataSource.getRepository(JournalEvent);
    const event = await eventRepo.findOne({
      where: { id, userId: req.userId }
    });

    if (!event) {
      res.status(404).json({ error: 'Evento non trovato' });
      return;
    }

    // Validazione categoria se fornita
    if (category && !EVENT_CATEGORIES.includes(category)) {
      res.status(400).json({
        error: `Categoria non valida. Valori ammessi: ${EVENT_CATEGORIES.join(', ')}`
      });
      return;
    }

    // Se cambia bookId, verifica che appartenga all'utente
    if (bookId !== undefined && bookId !== event.bookId) {
      if (bookId !== null) {
        const bookRepo = AppDataSource.getRepository(KdpBook);
        const book = await bookRepo.findOne({
          where: { id: bookId, userId: req.userId }
        });

        if (!book) {
          res.status(404).json({ error: 'Libro non trovato' });
          return;
        }
      }
      event.bookId = bookId;
    }

    // Aggiorna i campi
    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (category !== undefined) event.category = category;
    if (eventDate !== undefined) event.eventDate = new Date(eventDate);

    await eventRepo.save(event);

    res.json({
      message: 'Evento aggiornato con successo',
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        eventDate: event.eventDate,
        bookId: event.bookId,
        updatedAt: event.updatedAt
      }
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento evento:", error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * DELETE /api/kdp/journal-events/:id
 * Elimina un evento
 */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const eventRepo = AppDataSource.getRepository(JournalEvent);
    const event = await eventRepo.findOne({
      where: { id, userId: req.userId }
    });

    if (!event) {
      res.status(404).json({ error: 'Evento non trovato' });
      return;
    }

    await eventRepo.remove(event);

    res.json({ message: 'Evento eliminato con successo' });
  } catch (error) {
    console.error("Errore nell'eliminazione evento:", error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * GET /api/kdp/journal-events/book/:bookId/timeline
 * Restituisce gli eventi di un libro in formato timeline per grafici
 * Utile per sovrapporre eventi ai grafici di performance
 */
router.get(
  '/book/:bookId/timeline',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { bookId } = req.params;
      const { startDate, endDate } = req.query;

      // Verifica che il libro appartenga all'utente
      const bookRepo = AppDataSource.getRepository(KdpBook);
      const book = await bookRepo.findOne({
        where: { id: bookId, userId: req.userId }
      });

      if (!book) {
        res.status(404).json({ error: 'Libro non trovato' });
        return;
      }

      const eventRepo = AppDataSource.getRepository(JournalEvent);
      const queryBuilder = eventRepo
        .createQueryBuilder('event')
        .where('event.bookId = :bookId', { bookId })
        .andWhere('event.userId = :userId', { userId: req.userId });

      // Filtra per date se specificate
      if (startDate && endDate) {
        queryBuilder.andWhere('event.eventDate BETWEEN :startDate AND :endDate', {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        });
      }

      const events = await queryBuilder.orderBy('event.eventDate', 'ASC').getMany();

      // Formatta per timeline/grafico
      const timeline = events.map(event => {
        // Converti data in formato stringa
        const dateStr =
          event.eventDate instanceof Date
            ? event.eventDate.toISOString().split('T')[0]
            : String(event.eventDate).split('T')[0];

        return {
          date: dateStr,
          title: event.title,
          category: event.category,
          description: event.description,
          icon: getCategoryIcon(event.category)
        };
      });

      res.json({
        bookId: book.id,
        bookTitle: book.title,
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        eventsCount: timeline.length,
        timeline
      });
    } catch (error) {
      console.error('Errore nel recupero timeline:', error);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  }
);

/**
 * GET /api/kdp/journal-events/categories
 * Restituisce le categorie disponibili con icone e descrizioni
 */
router.get('/meta/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = EVENT_CATEGORIES.map(cat => ({
      value: cat,
      label: getCategoryLabel(cat),
      icon: getCategoryIcon(cat),
      color: getCategoryColor(cat)
    }));

    res.json({ categories });
  } catch (error) {
    console.error('Errore nel recupero categorie:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Helper functions
function getCategoryIcon(category: string | null): string {
  const icons: Record<string, string> = {
    price_change: '💰',
    ad_launch: '🚀',
    ad_pause: '⏸️',
    promo: '🎁',
    republish: '📚',
    milestone: '🎯',
    review: '⭐',
    other: '📌'
  };
  return icons[category || 'other'] || '📌';
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    price_change: 'Cambio Prezzo',
    ad_launch: 'Lancio Campagna',
    ad_pause: 'Pausa Campagna',
    promo: 'Promozione',
    republish: 'Ripubblicazione',
    milestone: 'Traguardo',
    review: 'Recensione',
    other: 'Altro'
  };
  return labels[category] || 'Altro';
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    price_change: '#f59e0b',
    ad_launch: '#10b981',
    ad_pause: '#6b7280',
    promo: '#8b5cf6',
    republish: '#3b82f6',
    milestone: '#ef4444',
    review: '#fbbf24',
    other: '#6b7280'
  };
  return colors[category] || '#6b7280';
}

export default router;
