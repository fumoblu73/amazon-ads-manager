import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { BsrService } from '../../services/bsrService';

const router = Router();

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

/**
 * GET /api/kdp/bsr/:bookId
 * Analisi completa BSR per un libro con statistiche e correlazioni
 *
 * Query params:
 * - startDate: data inizio (formato YYYY-MM-DD, default: 30 giorni fa)
 * - endDate: data fine (formato YYYY-MM-DD, default: oggi)
 */
router.get('/:bookId', async (req: AuthRequest, res: Response): Promise<void> => {
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

    const analysis = await BsrService.analyzeBsr(bookId, req.userId!, start, end);

    if (!analysis) {
      res.status(404).json({ error: 'Libro non trovato o nessun dato disponibile' });
      return;
    }

    res.json(analysis);
  } catch (error) {
    console.error('Errore nell\'analisi BSR:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * GET /api/kdp/bsr/:bookId/trend
 * Restituisce solo le statistiche di trend BSR (senza storico completo)
 * Utile per dashboard widgets
 */
router.get('/:bookId/trend', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookId } = req.params;
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Formato date non valido. Usa YYYY-MM-DD' });
      return;
    }

    const analysis = await BsrService.analyzeBsr(bookId, req.userId!, start, end);

    if (!analysis) {
      res.status(404).json({ error: 'Libro non trovato o nessun dato disponibile' });
      return;
    }

    // Restituisce solo statistiche e correlazione, senza storico completo
    res.json({
      bookId: analysis.bookId,
      bookTitle: analysis.bookTitle,
      asin: analysis.asin,
      marketplace: analysis.marketplace,
      period: analysis.period,
      statistics: analysis.statistics,
      correlation: {
        ...analysis.correlation,
        // Aggiungi interpretazione semplificata
        summary:
          analysis.correlation.adSpendImpact === 'positive'
            ? 'Le campagne pubblicitarie stanno migliorando il BSR ✅'
            : analysis.correlation.adSpendImpact === 'negative'
            ? 'Le campagne pubblicitarie non stanno migliorando il BSR ⚠️'
            : analysis.correlation.adSpendImpact === 'neutral'
            ? 'Impatto pubblicitario sul BSR non chiaro'
            : 'Dati insufficienti per valutare l\'impatto'
      }
    });
  } catch (error) {
    console.error('Errore nel recupero trend BSR:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * GET /api/kdp/bsr/comparison
 * Confronta il BSR di più libri
 *
 * Query params:
 * - bookIds: lista di bookId separati da virgola (es: id1,id2,id3)
 * - startDate: data inizio (formato YYYY-MM-DD, default: 30 giorni fa)
 * - endDate: data fine (formato YYYY-MM-DD, default: oggi)
 */
router.get('/comparison/books', async (req: AuthRequest, res: Response): Promise<void> => {
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

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Formato date non valido. Usa YYYY-MM-DD' });
      return;
    }

    const comparison = await BsrService.compareBsr(
      bookIdArray.map(id => id.trim()),
      req.userId!,
      start,
      end
    );

    // Ordina per BSR corrente (migliore prima)
    comparison.sort((a, b) => {
      const bsrA = a.statistics.currentBsr || 999999;
      const bsrB = b.statistics.currentBsr || 999999;
      return bsrA - bsrB;
    });

    res.json({
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      },
      booksCompared: comparison.length,
      books: comparison
    });
  } catch (error) {
    console.error('Errore nel confronto BSR:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * GET /api/kdp/bsr/:bookId/alert
 * Verifica se ci sono alert BSR (variazioni significative)
 *
 * Query params:
 * - days: numero di giorni da controllare (default: 7)
 * - threshold: soglia di variazione % per alert (default: 20)
 */
router.get('/:bookId/alert', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookId } = req.params;
    const days = parseInt(req.query.days as string) || 7;
    const threshold = parseInt(req.query.threshold as string) || 20;

    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const analysis = await BsrService.analyzeBsr(bookId, req.userId!, start, end);

    if (!analysis) {
      res.status(404).json({ error: 'Libro non trovato o nessun dato disponibile' });
      return;
    }

    const { statistics } = analysis;

    // Determina se c'è un alert
    const hasAlert =
      statistics.trendPercentage !== null &&
      Math.abs(statistics.trendPercentage) >= threshold;

    let alertType: 'improvement' | 'decline' | 'none' = 'none';
    let message = '';

    if (hasAlert) {
      if (statistics.trend === 'improving') {
        alertType = 'improvement';
        message = `BSR migliorato del ${Math.abs(
          statistics.trendPercentage!
        )}% negli ultimi ${days} giorni! 🎉`;
      } else if (statistics.trend === 'declining') {
        alertType = 'decline';
        message = `BSR peggiorato del ${Math.abs(
          statistics.trendPercentage!
        )}% negli ultimi ${days} giorni ⚠️`;
      }
    }

    res.json({
      bookId: analysis.bookId,
      bookTitle: analysis.bookTitle,
      hasAlert,
      alertType,
      message,
      currentBsr: statistics.currentBsr,
      trendPercentage: statistics.trendPercentage,
      period: {
        days,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Errore nel controllo alert BSR:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;
