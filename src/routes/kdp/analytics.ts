import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { AnalyticsService } from '../../services/analyticsService';

const router = Router();

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

/**
 * GET /api/kdp/analytics/book/:bookId
 * Restituisce le analytics per un singolo libro in un periodo specificato
 *
 * Query params:
 * - startDate: data inizio (formato YYYY-MM-DD, default: 30 giorni fa)
 * - endDate: data fine (formato YYYY-MM-DD, default: oggi)
 */
router.get('/book/:bookId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookId } = req.params;
    const { startDate, endDate } = req.query;

    // Date di default: ultimi 30 giorni
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Validazione date
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Formato date non valido. Usa YYYY-MM-DD' });
      return;
    }

    if (start > end) {
      res.status(400).json({ error: 'La data di inizio deve essere precedente alla data di fine' });
      return;
    }

    const analytics = await AnalyticsService.calculateBookAnalytics(
      bookId,
      req.userId!,
      start,
      end
    );

    if (!analytics) {
      res.status(404).json({ error: 'Libro non trovato' });
      return;
    }

    res.json(analytics);
  } catch (error) {
    console.error('Errore nel calcolo analytics libro:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * GET /api/kdp/analytics/overview
 * Restituisce le analytics aggregate per tutti i libri dell'utente
 *
 * Query params:
 * - startDate: data inizio (formato YYYY-MM-DD, default: 30 giorni fa)
 * - endDate: data fine (formato YYYY-MM-DD, default: oggi)
 */
router.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    // Date di default: ultimi 30 giorni
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Validazione date
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Formato date non valido. Usa YYYY-MM-DD' });
      return;
    }

    if (start > end) {
      res.status(400).json({ error: 'La data di inizio deve essere precedente alla data di fine' });
      return;
    }

    const analytics = await AnalyticsService.calculateUserAnalytics(
      req.userId!,
      start,
      end
    );

    res.json(analytics);
  } catch (error) {
    console.error('Errore nel calcolo analytics overview:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * GET /api/kdp/analytics/comparison
 * Confronta le performance di più libri nello stesso periodo
 *
 * Query params:
 * - bookIds: lista di bookId separati da virgola (es: id1,id2,id3)
 * - startDate: data inizio (formato YYYY-MM-DD, default: 30 giorni fa)
 * - endDate: data fine (formato YYYY-MM-DD, default: oggi)
 */
router.get('/comparison', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookIds, startDate, endDate } = req.query;

    if (!bookIds) {
      res.status(400).json({ error: 'Parametro bookIds obbligatorio' });
      return;
    }

    const bookIdArray = (bookIds as string).split(',').filter(id => id.trim());

    if (bookIdArray.length === 0) {
      res.status(400).json({ error: 'Almeno un bookId è richiesto' });
      return;
    }

    if (bookIdArray.length > 10) {
      res.status(400).json({ error: 'Massimo 10 libri per confronto' });
      return;
    }

    // Date di default: ultimi 30 giorni
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Validazione date
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Formato date non valido. Usa YYYY-MM-DD' });
      return;
    }

    const comparison = [];

    for (const bookId of bookIdArray) {
      const analytics = await AnalyticsService.calculateBookAnalytics(
        bookId.trim(),
        req.userId!,
        start,
        end
      );

      if (analytics) {
        comparison.push({
          bookId: analytics.bookId,
          bookTitle: analytics.bookTitle,
          asin: analytics.asin,
          marketplace: analytics.marketplace,
          metrics: analytics.overall
        });
      }
    }

    res.json({
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      books: comparison
    });
  } catch (error) {
    console.error('Errore nel confronto analytics:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;
