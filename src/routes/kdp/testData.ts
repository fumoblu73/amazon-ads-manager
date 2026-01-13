import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { AppDataSource } from '../../config/database';
import { KdpBook } from '../../entities/KdpBook';
import { KdpDailyStats } from '../../entities/KdpDailyStats';

const router = Router();

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

/**
 * POST /api/kdp/test-data/create-sample
 * Crea dati di esempio per testare le analytics
 * SOLO PER SVILUPPO - Rimuovere in produzione
 */
router.post('/create-sample', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookRepo = AppDataSource.getRepository(KdpBook);
    const statsRepo = AppDataSource.getRepository(KdpDailyStats);

    // Crea un libro di test
    const testBook = bookRepo.create({
      userId: req.userId,
      asin: 'B0TEST123',
      title: 'Il Mio Libro di Test - Guida al Self Publishing',
      author: 'John Doe',
      marketplace: 'IT',
      seriesName: 'Serie Test',
      seriesPosition: 1,
      publishDate: '1 gennaio 2024'
    });

    await bookRepo.save(testBook);

    // Crea 30 giorni di statistiche simulate
    const stats = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Simula andamento realistico:
      // - Vendite variabili tra 5-15 al giorno
      // - Royalty medio €2.50 per ebook
      // - KENP reads tra 1000-3000
      // - Ad spend tra €5-€25 al giorno
      // - BSR che migliora nel tempo

      const ebookSales = Math.floor(Math.random() * 10) + 5; // 5-15
      const ebookRoyalty = ebookSales * 2.5; // €2.50 per vendita
      const kenpReads = Math.floor(Math.random() * 2000) + 1000; // 1000-3000
      const kenpRoyalty = kenpReads * 0.00195; // ~€0.00195 per pagina
      const adSpend = Math.random() * 20 + 5; // €5-€25
      const bsr = Math.floor(50000 - (i * 1000) + Math.random() * 5000); // Migliora nel tempo

      const stat = statsRepo.create({
        bookId: testBook.id,
        date,
        ebookSales,
        ebookRoyalty: Math.round(ebookRoyalty * 100) / 100,
        paperbackSales: 0,
        paperbackRoyalty: 0,
        hardcoverSales: 0,
        hardcoverRoyalty: 0,
        kenpReads,
        kenpRoyalty: Math.round(kenpRoyalty * 100) / 100,
        bsr,
        adSpend: Math.round(adSpend * 100) / 100
      });

      stats.push(stat);
    }

    await statsRepo.save(stats);

    // Calcola le metriche totali per riepilogo
    const totalRoyalties = stats.reduce(
      (sum, s) => sum + Number(s.ebookRoyalty) + Number(s.kenpRoyalty),
      0
    );
    const totalAdSpend = stats.reduce((sum, s) => sum + Number(s.adSpend), 0);
    const netProfit = totalRoyalties - totalAdSpend;
    const roi = (netProfit / totalAdSpend) * 100;
    const acos = (totalAdSpend / totalRoyalties) * 100;

    res.json({
      message: 'Dati di test creati con successo',
      book: {
        id: testBook.id,
        title: testBook.title,
        asin: testBook.asin,
        marketplace: testBook.marketplace
      },
      stats: {
        daysCreated: stats.length,
        totalRoyalties: Math.round(totalRoyalties * 100) / 100,
        totalAdSpend: Math.round(totalAdSpend * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        acos: Math.round(acos * 100) / 100
      },
      analyticsUrl: `/api/kdp/analytics/book/${testBook.id}`
    });
  } catch (error) {
    console.error('Errore nella creazione dati di test:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * DELETE /api/kdp/test-data/clear
 * Elimina tutti i dati di test
 * SOLO PER SVILUPPO - Rimuovere in produzione
 */
router.delete('/clear', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookRepo = AppDataSource.getRepository(KdpBook);
    const statsRepo = AppDataSource.getRepository(KdpDailyStats);

    // Trova tutti i libri di test (iniziano con B0TEST)
    const testBooks = await bookRepo.find({
      where: { userId: req.userId }
    });

    const testBooksFiltered = testBooks.filter(book => book.asin.startsWith('B0TEST'));

    let deletedStats = 0;

    for (const book of testBooksFiltered) {
      // Elimina le statistiche
      const stats = await statsRepo.find({ where: { bookId: book.id } });
      await statsRepo.remove(stats);
      deletedStats += stats.length;

      // Elimina il libro
      await bookRepo.remove(book);
    }

    res.json({
      message: 'Dati di test eliminati con successo',
      deletedBooks: testBooksFiltered.length,
      deletedStats
    });
  } catch (error) {
    console.error('Errore nell\'eliminazione dati di test:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;
